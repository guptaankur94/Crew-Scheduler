/**
 * Original roster files (and pasted text), kept on this device only so a roster can be read again later
 * without uploading it again. Stored in the browser's IndexedDB (localStorage is too small for images),
 * keyed by the file's SHA-256 fingerprint so the same file is kept once. Never sent anywhere, except to
 * the roster reader when the person chooses "Read again". Deletable at any time from Settings.
 */

const DB_NAME = 'crewcircadian-files';
const STORE = 'files';
/** Stop keeping new files once this much is stored (older files stay until deleted). */
export const MAX_STORED_BYTES = 80 * 1024 * 1024;

export interface StoredFile {
  fingerprint: string;
  name: string;
  type: string;
  size: number;
  savedAt: string;
  blob: Blob;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('Storage is not available in this browser'));
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: 'fingerprint' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

export async function listStoredFiles(): Promise<Omit<StoredFile, 'blob'>[]> {
  try {
    const all = await run<StoredFile[]>('readonly', (s) => s.getAll() as IDBRequest<StoredFile[]>);
    return all.map(({ blob: _b, ...meta }) => meta);
  } catch {
    return [];
  }
}

export async function storedBytes(): Promise<number> {
  return (await listStoredFiles()).reduce((sum, f) => sum + f.size, 0);
}

/** Keeps a file. Returns false if it could not be kept (no storage, or over the size limit). */
export async function keepFile(fingerprint: string | null, file: Blob, name: string): Promise<boolean> {
  if (!fingerprint) return false;
  try {
    if ((await storedBytes()) + file.size > MAX_STORED_BYTES) return false;
    const record: StoredFile = { fingerprint, name, type: file.type || 'application/octet-stream', size: file.size, savedAt: new Date().toISOString(), blob: file };
    await run('readwrite', (s) => s.put(record));
    return true;
  } catch {
    return false;
  }
}

export async function getStoredFile(fingerprint: string): Promise<StoredFile | null> {
  try {
    return (await run<StoredFile | undefined>('readonly', (s) => s.get(fingerprint) as IDBRequest<StoredFile | undefined>)) ?? null;
  } catch {
    return null;
  }
}

export async function deleteStoredFile(fingerprint: string): Promise<void> {
  try {
    await run('readwrite', (s) => s.delete(fingerprint));
  } catch {
    // Nothing stored, or storage unavailable
  }
}

export async function deleteAllStoredFiles(): Promise<void> {
  try {
    await run('readwrite', (s) => s.clear());
  } catch {
    // Nothing stored, or storage unavailable
  }
}

/** SHA-256 fingerprint of pasted text, so pasted rosters can be kept and read again too. */
export async function textFingerprint(text: string): Promise<string | null> {
  try {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return null;
  }
}
