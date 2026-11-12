// tiny promise wrapper over IndexedDB. stores: lifts, days, sessions, meta.
const NAME = 'myologia';
const VER = 1;
export type StoreName = 'lifts' | 'days' | 'sessions' | 'meta';

let dbp: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  if (dbp) return dbp;
  dbp = new Promise((res, rej) => {
    const r = indexedDB.open(NAME, VER);
    r.onupgradeneeded = () => {
      const db = r.result;
      if (!db.objectStoreNames.contains('lifts')) db.createObjectStore('lifts', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('days')) db.createObjectStore('days', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('sessions')) db.createObjectStore('sessions', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'key' });
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  return dbp;
}

const done = (t: IDBTransaction) =>
  new Promise<void>((res, rej) => { t.oncomplete = () => res(); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error); });

export async function getAll<T>(store: StoreName): Promise<T[]> {
  const db = await open();
  return new Promise((res, rej) => {
    const r = db.transaction(store).objectStore(store).getAll();
    r.onsuccess = () => res(r.result as T[]);
    r.onerror = () => rej(r.error);
  });
}

export async function putMany(store: StoreName, vals: unknown[]): Promise<void> {
  const db = await open();
  const t = db.transaction(store, 'readwrite');
  const s = t.objectStore(store);
  for (const v of vals) s.put(v);
  return done(t);
}

export const put = (store: StoreName, val: unknown) => putMany(store, [val]);

export async function clear(store: StoreName): Promise<void> {
  const db = await open();
  const t = db.transaction(store, 'readwrite');
  t.objectStore(store).clear();
  return done(t);
}

export async function get<T>(store: StoreName, key: string): Promise<T | undefined> {
  const db = await open();
  return new Promise((res, rej) => {
    const r = db.transaction(store).objectStore(store).get(key);
    r.onsuccess = () => res(r.result as T | undefined);
    r.onerror = () => rej(r.error);
  });
}
