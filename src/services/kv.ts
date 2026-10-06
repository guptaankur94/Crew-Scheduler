import { isNativeApp } from './platform';

/*
 * WHERE SAVED DATA LIVES
 *
 * One small key-value store for everything the app saves (roster, settings, history, upload records…).
 *   In a browser   the browser's localStorage, exactly as before.
 *   In the phone app  one file per key in the app's private Library folder, which the phone does not clear when
 *                  space runs low (unlike web storage). A copy is kept in memory so reads stay instant; writes go
 *                  to the file in the background, in order. On first launch anything saved the old way (web
 *                  storage inside the app) is moved across.
 * Reads and writes are synchronous for the rest of the app; initStorage() must finish before the app starts.
 */

const DIR = 'crewcircadian';
const memory = new Map<string, string>();
let nativeWrite: ((key: string, value: string | null) => void) | null = null;

const web = (): Storage | undefined => (globalThis as { localStorage?: Storage }).localStorage;
const fileName = (key: string) => `${DIR}/${encodeURIComponent(key)}.json`;

/** Loads saved data in the phone app. Does nothing in a browser. */
export async function initStorage(): Promise<void> {
  if (!isNativeApp()) return;
  const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
  const where = { directory: Directory.Library };
  try {
    await Filesystem.mkdir({ ...where, path: DIR, recursive: true });
  } catch {
    // Already there
  }
  const { files } = await Filesystem.readdir({ ...where, path: DIR });
  for (const f of files) {
    if (!f.name.endsWith('.json')) continue;
    const { data } = await Filesystem.readFile({ ...where, path: `${DIR}/${f.name}`, encoding: Encoding.UTF8 });
    memory.set(decodeURIComponent(f.name.slice(0, -5)), typeof data === 'string' ? data : '');
  }

  // Writes happen in the background, one at a time, so a later write never lands before an earlier one
  let queue: Promise<unknown> = Promise.resolve();
  nativeWrite = (key, value) => {
    queue = queue
      .then(async () => {
        if (value === null) await Filesystem.deleteFile({ ...where, path: fileName(key) });
        else await Filesystem.writeFile({ ...where, path: fileName(key), data: value, encoding: Encoding.UTF8 });
      })
      .catch((err) => console.warn(`Could not save ${key}`, err));
  };

  // First launch after an update: move anything saved in the app's web storage into files
  const old = web();
  if (memory.size === 0 && old && old.length > 0) {
    for (let i = 0; i < old.length; i++) {
      const key = old.key(i);
      const value = key ? old.getItem(key) : null;
      if (key && value !== null) {
        memory.set(key, value);
        nativeWrite(key, value);
      }
    }
  }
}

export const kv = {
  getItem(key: string): string | null {
    if (nativeWrite) return memory.get(key) ?? null;
    return web()?.getItem(key) ?? null;
  },
  setItem(key: string, value: string): void {
    if (nativeWrite) {
      memory.set(key, value);
      nativeWrite(key, value);
      return;
    }
    const store = web();
    if (!store) throw new Error('Storage is not available');
    store.setItem(key, value);
  },
  removeItem(key: string): void {
    if (nativeWrite) {
      memory.delete(key);
      nativeWrite(key, null);
      return;
    }
    web()?.removeItem(key);
  },
};
