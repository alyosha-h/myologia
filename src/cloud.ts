// Cloud save via the myologia-saves worker — the same vault system as the
// other apps (Lantern Days, Seat at the Table, A Minister in Your Sleeve).
// One record per sync code in a Cloudflare KV namespace; the code is the
// password, so anyone holding it can read and overwrite the save.
// IndexedDB stays the source of truth while you train; the cloud copy is
// pulled when the app opens / returns to the foreground and pushed a few
// seconds after real changes. Hourly checkpoints are kept server-side.
import { clear, get, getAll, put, putMany } from './db';
import { PROGRAM_VERSION, type Day, type Lift, type Session } from './data';

const VAULT = 'https://myologia-saves.alex-c-hartke.workers.dev';
const CODE_RE = /^[A-Za-z0-9-]{6,64}$/;

export type CloudStatus = 'off' | 'syncing' | 'synced' | 'offline';

export interface SaveShape {
  app: 'myologia';
  v: 1;
  program: number;
  lifts: Lift[];
  days: Day[];
  sessions: Session[];
}

interface CloudMeta {
  code?: string;
  device: string;
  syncedAt?: number;
  fp?: string;
}

type AdoptFn = (s: SaveShape) => void;
type StatusFn = (s: CloudStatus) => void;

const newDevice = () => Math.random().toString(36).slice(2, 10);
export const newCode = () =>
  'myologia-' + Math.random().toString(36).slice(2, 7) + Math.random().toString(36).slice(2, 7);

async function meta(): Promise<CloudMeta> {
  const row = await get<CloudMeta & { key: string }>('meta', 'cloud').catch(() => undefined);
  if (row?.device) return row;
  const fresh: CloudMeta = { device: newDevice() };
  if (row?.code) fresh.code = row.code;
  return fresh;
}

async function saveMeta(m: CloudMeta): Promise<void> {
  await put('meta', { key: 'cloud', ...m }).catch(() => {});
}

export async function exportSave(): Promise<SaveShape> {
  const [lifts, days, sessions] = await Promise.all([
    getAll<Lift>('lifts'), getAll<Day>('days'), getAll<Session>('sessions'),
  ]);
  const prog = (await get<{ key: string; v: number }>('meta', 'program').catch(() => undefined))?.v ?? PROGRAM_VERSION;
  return { app: 'myologia', v: 1, program: prog, lifts, days, sessions };
}

/** progress-bearing fingerprint: the lifts, the rotation, the log */
export const fingerprint = (s: SaveShape) => JSON.stringify([s.lifts, s.days, s.sessions]);

const looksFresh = (s: SaveShape) =>
  !s.sessions.some((x) => x.sealed || Object.values(x.entries).some((e) => e.setsDone.some(Boolean)));

export async function importSave(s: SaveShape): Promise<void> {
  await clear('lifts');
  await clear('days');
  await clear('sessions');
  await putMany('lifts', s.lifts);
  await putMany('days', s.days);
  await putMany('sessions', s.sessions);
  await put('meta', { key: 'program', v: s.program });
}

function parseSave(text: string): SaveShape | null {
  try {
    const o = JSON.parse(text) as SaveShape;
    if (o?.app !== 'myologia' || !Array.isArray(o.lifts) || !Array.isArray(o.days) || !Array.isArray(o.sessions)) return null;
    return o;
  } catch { return null; }
}

let status: CloudStatus = 'off';
let pushTimer: number | undefined;
let writing = false;
let again = false;

async function push(onStatus: StatusFn): Promise<void> {
  const m = await meta();
  if (!m.code) return;
  if (writing) { again = true; return; }
  writing = true;
  onStatus('syncing');
  try {
    const save = await exportSave();
    const savedAt = Date.now();
    const res = await fetch(`${VAULT}/save/${encodeURIComponent(m.code)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ save: JSON.stringify(save), savedAt, v: 1, device: m.device }),
    });
    if (!res.ok) throw new Error(String(res.status));
    m.syncedAt = savedAt;
    m.fp = fingerprint(save);
    await saveMeta(m);
    onStatus('synced');
    status = 'synced';
  } catch {
    onStatus('offline');
    status = 'offline';
  }
  writing = false;
  if (again) { again = false; void push(onStatus); }
}

/** Pull the cloud copy; adopt it when this device has nothing it would lose. */
export async function pull(onAdopt: AdoptFn, onStatus: StatusFn): Promise<void> {
  const m = await meta();
  if (!m.code || !CODE_RE.test(m.code)) { onStatus('off'); status = 'off'; return; }
  onStatus('syncing');
  let rec: { save: string; savedAt: number } | null = null;
  try {
    const res = await fetch(`${VAULT}/save/${encodeURIComponent(m.code)}`);
    if (res.status === 404) rec = null;
    else if (res.ok) rec = (await res.json()) as { save: string; savedAt: number };
    else throw new Error(String(res.status));
  } catch {
    onStatus('offline');
    status = 'offline';
    return;
  }
  if (!rec) { await push(onStatus); return; } // first link: this device's save becomes the cloud copy
  const remote = parseSave(rec.save);
  if (!remote) { await push(onStatus); return; } // unreadable cloud copy: replace it with this device's
  const local = await exportSave();
  const localFp = fingerprint(local);
  if (fingerprint(remote) === localFp) {
    m.syncedAt = rec.savedAt;
    m.fp = localFp;
    await saveMeta(m);
    onStatus('synced');
    status = 'synced';
    return;
  }
  if (rec.savedAt === m.syncedAt) { // nobody else wrote since this device last synced
    if (localFp !== m.fp) await push(onStatus);
    else { onStatus('synced'); status = 'synced'; }
    return;
  }
  // Another device saved since this one last synced.
  const neverSynced = m.fp === undefined;
  const dirty = localFp !== m.fp;
  if ((neverSynced && !looksFresh(local)) || (!neverSynced && dirty)) {
    const when = new Date(rec.savedAt).toLocaleString();
    const useCloud = window.confirm(
      `Cloud sync conflict.\n\nThe cloud copy (saved ${when}) and this device have both changed since the last sync.\n\nOK — use the cloud copy, replacing what's on this device.\nCancel — keep this device and overwrite the cloud.`,
    );
    if (!useCloud) { await push(onStatus); return; }
  }
  await importSave(remote);
  m.syncedAt = rec.savedAt;
  m.fp = fingerprint(remote);
  await saveMeta(m);
  onAdopt(remote);
  onStatus('synced');
  status = 'synced';
}

/** Call after every local save; writes a few seconds after the last real change. */
export function cloudChanged(onStatus: StatusFn): void {
  void (async () => {
    const m = await meta();
    if (!m.code) return;
    const fp = fingerprint(await exportSave());
    if (fp === m.fp && status === 'synced') return;
    window.clearTimeout(pushTimer);
    pushTimer = window.setTimeout(() => { void push(onStatus); }, 2500);
  })();
}

/** Link this device to a sync code (a new one is generated when omitted), then pull. */
export async function linkCloud(code: string | undefined, onAdopt: AdoptFn, onStatus: StatusFn): Promise<string | null> {
  const c = (code ?? '').trim() || newCode();
  if (!CODE_RE.test(c)) return null;
  const m = await meta();
  m.code = c;
  delete m.syncedAt;
  delete m.fp;
  await saveMeta(m);
  await pull(onAdopt, onStatus);
  return c;
}

export async function unlinkCloud(onStatus: StatusFn): Promise<void> {
  const m = await meta();
  delete m.code;
  delete m.syncedAt;
  delete m.fp;
  await saveMeta(m);
  onStatus('off');
  status = 'off';
}

export async function cloudCode(): Promise<string | null> {
  const m = await meta();
  return m.code ?? null;
}
