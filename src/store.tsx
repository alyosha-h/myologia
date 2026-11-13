import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { cloudChanged, cloudCode, exportSave, fingerprint, linkCloud as linkCloudSave, migrated, pull as pullCloud, unlinkCloud as unlinkCloudSave, type CloudStatus, type SaveShape } from './cloud';
import { clear, get, getAll, put, putMany } from './db';
import { MUSCLES, PROGRAM_VERSION, normLift, snap, stepOf, seedCore, seedProgram, type Core, type Day, type Entry, type Lift, type Session } from './data';

/* ---------- dates (local, not UTC) ---------- */

export const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const fromIso = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
/** monday of d's week */
export const weekStart = (d: Date) => addDays(new Date(d.getFullYear(), d.getMonth(), d.getDate()), -((d.getDay() + 6) % 7));
export const ddmm = (d: Date) => `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`;
export const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const isoWeek = (d: Date) => {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t.getTime() - y0.getTime()) / 86400000 + 1) / 7);
};

/* ---------- derived helpers ---------- */

export const setsDoneIn = (s: Session, liftId: string) => s.entries[liftId]?.setsDone.filter(Boolean).length ?? 0;
export const hasWork = (s: Session) => s.sealed || Object.values(s.entries).some((e) => e.setsDone.some(Boolean));
/** any ab set ticked that day */
export const hasCore = (s: Session | undefined) => !!s && Object.values(s.core ?? {}).some((e) => e.setsDone.some(Boolean));
export const coreSetsDone = (s: Session, liftId: string) => s.core?.[liftId]?.setsDone.filter(Boolean).length ?? 0;

interface Data {
  ready: boolean;
  lifts: Record<string, Lift>;
  days: Day[];
  sessions: Record<string, Session>;
  core: Core;
}

export interface Suggestion {
  weight: number | null;
  /** start: first time, from the programme. up: earned an increase. hold: same again. deload: three stalls, −10% */
  why: 'start' | 'up' | 'hold' | 'deload' | 'none';
  from: number | null;
}

/** did this entry earn the next increase: every set done and the last set reached the top of the range */
export const earned = (l: Lift, e: { setsDone: boolean[]; reps?: number | null }) =>
  e.setsDone.filter(Boolean).length >= l.sets && (e.reps ?? l.repMax) >= l.repMax;

/** next weight after a session at `w` with entry `e` */
export const nextAfter = (l: Lift, w: number, e: { setsDone: boolean[]; reps?: number | null }) =>
  earned(l, e) && l.inc > 0 ? snap(w + l.inc, stepOf(l), 'up') : w;

interface Api extends Data {
  today: string;
  dayById: (id: string) => Day;
  sessionFor: (date: string) => Session;
  saveSession: (s: Session) => void;
  plannedDays: (from: string, n: number) => Day[];
  prevWeight: (liftId: string, before: string) => number | null;
  /** completed sets per muscle for the 7 days starting monday. primary = 1, secondary = 0.5 */
  weekVolume: (monday: Date) => Record<string, number>;
  sessionNumber: (date: string) => number;
  /** what to put on the bar for this lift on `date`, from the last time it was done */
  suggest: (liftId: string, date: string) => Suggestion;
  /** days with ab work in the 7 days starting monday */
  coreWeek: (monday: Date) => number;
  saveLift: (l: Lift) => void;
  saveDays: (days: Day[]) => void;
  saveCore: (c: Core) => void;
  resetProgram: () => Promise<void>;
  cloudStatus: CloudStatus;
  cloudCode: string | null;
  linkCloud: (code?: string) => Promise<boolean>;
  unlinkCloud: () => Promise<void>;
  syncNow: () => Promise<void>;
}

const Ctx = createContext<Api | null>(null);

export function useStore(): Api {
  const v = useContext(Ctx);
  if (!v) throw new Error('no store');
  return v;
}

function useToday() {
  const [t, setT] = useState(() => iso(new Date()));
  useEffect(() => {
    const tick = () => setT(iso(new Date()));
    const iv = setInterval(tick, 60_000);
    document.addEventListener('visibilitychange', tick);
    return () => { clearInterval(iv); document.removeEventListener('visibilitychange', tick); };
  }, []);
  return t;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Data>({ ready: false, lifts: {}, days: [], sessions: {}, core: { perWeek: 4, lifts: [] } });
  const [cloudStatus, setCloudStatus] = useState<CloudStatus>('off');
  const [cloudCodeState, setCloudCodeState] = useState<string | null>(null);
  const today = useToday();

  const adoptSave = useCallback((s: SaveShape) => {
    const lifts = s.lifts.map(normLift);
    const days = [...s.days].sort((a, b) => ((a as Day & { order?: number }).order ?? 0) - ((b as Day & { order?: number }).order ?? 0));
    setData((d) => ({
      ready: true,
      lifts: Object.fromEntries(lifts.map((l) => [l.id, l])),
      days,
      sessions: Object.fromEntries(s.sessions.map((x) => [x.id, x])),
      core: s.core ?? d.core,
    }));
  }, []);

  useEffect(() => {
    (async () => {
      let [lifts, days, sessions] = await Promise.all([
        getAll<Lift>('lifts'), getAll<Day & { order?: number }>('days'), getAll<Session>('sessions'),
      ]);
      const ver = (await get<{ key: string; v: number }>('meta', 'program'))?.v ?? 0;
      if (ver < PROGRAM_VERSION) {
        // v1 → v2: install the PPL split from the sheet. history stays; lift ids that match carry over.
        const seed = seedProgram();
        const keep = lifts.filter((l) => !seed.lifts.some((x) => x.id === l.id));
        lifts = [...keep.map(normLift), ...seed.lifts];
        days = seed.days;
        const remap: Record<string, string> = { push: 'push-a', pull: 'pull-a', legs: 'legs-a' };
        sessions = sessions.map((s) => (remap[s.dayId] ? { ...s, dayId: remap[s.dayId] } : s));
        await clear('days');
        await putMany('days', days);
        await putMany('lifts', lifts);
        await putMany('sessions', sessions);
        await put('meta', { key: 'program', v: PROGRAM_VERSION });
      }
      let core = await get<Core & { key: string }>('meta', 'core');
      if (!core) {
        // ab work arrives: two ab lifts and a weekly quota, beside the rotation. lift ids already taken are left alone
        const before = fingerprint(await exportSave());
        const seed = seedCore();
        const add = seed.lifts.filter((l) => !lifts.some((x) => x.id === l.id));
        lifts = [...lifts, ...add];
        core = { key: 'core', ...seed.core };
        await putMany('lifts', add);
        await put('meta', core);
        await migrated(before);
      }
      lifts = lifts.map(normLift);
      days.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      setData({
        ready: true,
        lifts: Object.fromEntries(lifts.map((l) => [l.id, l])),
        days,
        sessions: Object.fromEntries(sessions.map((s) => [s.id, s])),
        core: { perWeek: core.perWeek, lifts: core.lifts },
      });
      navigator.storage?.persist?.().catch(() => {});
      const code = await cloudCode();
      setCloudCodeState(code);
      if (code) await pullCloud(adoptSave, setCloudStatus);
    })();
  }, [adoptSave]);

  // coming back to the app: another device may have saved in the meantime
  useEffect(() => {
    const onVis = () => { if (document.visibilityState === 'visible') void pullCloud(adoptSave, setCloudStatus); };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [adoptSave]);

  const saveSession = useCallback((s: Session) => {
    setData((d) => ({ ...d, sessions: { ...d.sessions, [s.id]: s } }));
    put('sessions', s).catch((e) => console.error('save failed', e));
    cloudChanged(setCloudStatus);
  }, []);

  const saveLift = useCallback((l: Lift) => {
    setData((d) => ({ ...d, lifts: { ...d.lifts, [l.id]: l } }));
    put('lifts', l).catch((e) => console.error('save failed', e));
    cloudChanged(setCloudStatus);
  }, []);

  const saveDays = useCallback((days: Day[]) => {
    const ordered = days.map((d, i) => ({ ...d, order: i }));
    setData((d) => ({ ...d, days: ordered }));
    (async () => { await clear('days'); await putMany('days', ordered); })().catch((e) => console.error('save failed', e));
    cloudChanged(setCloudStatus);
  }, []);

  const saveCore = useCallback((c: Core) => {
    setData((d) => ({ ...d, core: c }));
    put('meta', { key: 'core', perWeek: c.perWeek, lifts: c.lifts }).catch((e) => console.error('save failed', e));
    cloudChanged(setCloudStatus);
  }, []);

  const resetProgram = useCallback(async () => {
    const seed = seedProgram();
    await clear('days');
    await putMany('days', seed.days);
    await putMany('lifts', seed.lifts);
    setData((d) => ({ ...d, days: seed.days, lifts: { ...d.lifts, ...Object.fromEntries(seed.lifts.map((l) => [l.id, l])) } }));
    cloudChanged(setCloudStatus);
  }, []);

  const linkCloud = useCallback(async (code?: string) => {
    const c = await linkCloudSave(code, adoptSave, setCloudStatus);
    if (c) setCloudCodeState(c);
    return !!c;
  }, [adoptSave]);

  const unlinkCloud = useCallback(async () => {
    await unlinkCloudSave(setCloudStatus);
    setCloudCodeState(null);
  }, []);

  const syncNow = useCallback(async () => {
    await pullCloud(adoptSave, setCloudStatus);
  }, [adoptSave]);

  const api = useMemo<Api>(() => {
    const { days, sessions, lifts, core } = data;
    const sorted = Object.values(sessions).filter(hasWork).sort((a, b) => a.date.localeCompare(b.date));
    const coreSorted = Object.values(sessions).filter(hasCore).sort((a, b) => a.date.localeCompare(b.date));
    /** where a lift's history lives: ab lifts in `core` on any day, the rest in `entries` on worked days */
    const historyOf = (liftId: string): [Session[], (s: Session) => Entry | undefined] =>
      core.lifts.includes(liftId) ? [coreSorted, (s) => s.core?.[liftId]] : [sorted, (s) => s.entries[liftId]];
    const dayById = (id: string) => days.find((d) => d.id === id) ?? days[0];
    const after = (id: string) => days[(days.findIndex((d) => d.id === id) + 1) % days.length];

    /** rotation: the day after the most recent worked session before `date` */
    const plannedDayId = (date: string) => {
      let last: Session | undefined;
      for (const s of sorted) if (s.date < date) last = s;
      return last ? after(last.dayId).id : days[0]?.id;
    };

    const sessionFor = (date: string): Session =>
      sessions[date] ?? { id: date, date, dayId: plannedDayId(date), entries: {}, sealed: false };

    const plannedDays = (from: string, n: number) => {
      const out: Day[] = [];
      let d = dayById(sessionFor(from).dayId);
      for (let i = 0; i < n; i++) { out.push(d); d = after(d.id); }
      return out;
    };

    const prevWeight = (liftId: string, before: string) => {
      const [pool, entryIn] = historyOf(liftId);
      for (let i = pool.length - 1; i >= 0; i--) {
        const s = pool[i];
        if (s.date >= before) continue;
        const w = entryIn(s)?.weight;
        if (w != null) return w;
      }
      return null;
    };

    const weekVolume = (monday: Date) => {
      const vol: Record<string, number> = Object.fromEntries(Object.keys(MUSCLES).map((k) => [k, 0]));
      const lo = iso(monday), hi = iso(addDays(monday, 7));
      for (const s of Object.values(sessions)) {
        if (s.date < lo || s.date >= hi) continue;
        for (const [liftId, e] of [...Object.entries(s.entries), ...Object.entries(s.core ?? {})]) {
          const l = lifts[liftId];
          if (!l) continue;
          const n = e.setsDone.filter(Boolean).length;
          l.hit.forEach((m, i) => { if (m in vol) vol[m] += i === 0 ? n : n * 0.5; });
        }
      }
      return vol;
    };

    const sessionNumber = (date: string) => sorted.filter((s) => s.date < date).length + 1;

    const suggest = (liftId: string, date: string): Suggestion => {
      const l = lifts[liftId];
      if (!l) return { weight: null, why: 'none', from: null };
      // past exposures, newest first: a weight and at least one set
      const hist: { w: number; e: Entry }[] = [];
      const [pool, entryIn] = historyOf(liftId);
      for (let i = pool.length - 1; i >= 0 && hist.length < 3; i--) {
        const s = pool[i];
        if (s.date >= date) continue;
        const e = entryIn(s);
        if (e?.weight != null && e.setsDone.some(Boolean)) hist.push({ w: e.weight, e });
      }
      if (!hist.length) return l.start != null ? { weight: l.start, why: 'start', from: null } : { weight: null, why: 'none', from: null };
      const { w, e } = hist[0];
      if (earned(l, e) && l.inc > 0) return { weight: snap(w + l.inc, stepOf(l), 'up'), why: 'up', from: w };
      // three sessions in a row at the same weight without earning it: back off 10%
      if (hist.length === 3 && l.inc > 0 && hist.every((h) => h.w === w && !earned(l, h.e)))
        return { weight: snap(w * 0.9, stepOf(l), 'down'), why: 'deload', from: w };
      return { weight: w, why: 'hold', from: w };
    };

    const coreWeek = (monday: Date) => {
      const lo = iso(monday), hi = iso(addDays(monday, 7));
      return coreSorted.filter((s) => s.date >= lo && s.date < hi).length;
    };

    return { ...data, today, dayById, sessionFor, saveSession, plannedDays, prevWeight, weekVolume, sessionNumber, suggest, coreWeek, saveLift, saveDays, saveCore, resetProgram, cloudStatus, cloudCode: cloudCodeState, linkCloud, unlinkCloud, syncNow };
  }, [data, today, saveSession, saveLift, saveDays, saveCore, resetProgram, cloudStatus, cloudCodeState, linkCloud, unlinkCloud, syncNow]);

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}
