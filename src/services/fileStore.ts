/**
 * Original roster files (and pasted text), kept on this device only so a roster can be read again later
 * without uploading it again. In a browser: IndexedDB (localStorage is too small for images); in the phone app:
 * the app's private Library folder, which the phone does not clear. Both
 * keyed by the file's SHA-256 fingerprint so the same file is kept once. Never sent anywhere, except to
 * the roster reader when the person chooses "Read again". Deletable at any time from Settings.
 */

import { isNativeApp } from './platform';
import { kv } from './kv';

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

// ─── Phone app: files in the app's private Library folder (not cleared by the phone), with a small index ───
const NATIVE_DIR = 'crewcircadian-files';
const NATIVE_INDEX = 'crew_kept_files_v1';
type Meta = Omit<StoredFile, 'blob'>;
const nativeIndex = (): Meta[] => {
  try {
    const parsed = JSON.parse(kv.getItem(NATIVE_INDEX) ?? '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};
const saveNativeIndex = (list: Meta[]) => kv.setItem(NATIVE_INDEX, JSON.stringify(list));
const fs = async () => {
  const { Filesystem, Directory } = await import('@capacitor/filesystem');
  return { Filesystem, where: { directory: Directory.Library } };
};
const blobToBase64 = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
const base64ToBlob = (data: string, type: string) => {
  const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
  return new Blob([bytes], { type });
};

export async function listStoredFiles(): Promise<Omit<StoredFile, 'blob'>[]> {
  if (isNativeApp()) return nativeIndex();
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
  if (isNativeApp()) {
    try {
      const index = nativeIndex().filter((f) => f.fingerprint !== fingerprint);
      if (index.reduce((sum, f) => sum + f.size, 0) + file.size > MAX_STORED_BYTES) return false;
      const { Filesystem, where } = await fs();
      await Filesystem.writeFile({ ...where, path: `${NATIVE_DIR}/${fingerprint}`, data: await blobToBase64(file), recursive: true });
      saveNativeIndex([...index, { fingerprint, name, type: file.type || 'application/octet-stream', size: file.size, savedAt: new Date().toISOString() }]);
      return true;
    } catch {
      return false;
    }
  }
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
  if (isNativeApp()) {
    const meta = nativeIndex().find((f) => f.fingerprint === fingerprint);
    if (!meta) return null;
    try {
      const { Filesystem, where } = await fs();
      const { data } = await Filesystem.readFile({ ...where, path: `${NATIVE_DIR}/${fingerprint}` });
      return { ...meta, blob: typeof data === 'string' ? base64ToBlob(data, meta.type) : data };
    } catch {
      return null;
    }
  }
  try {
    return (await run<StoredFile | undefined>('readonly', (s) => s.get(fingerprint) as IDBRequest<StoredFile | undefined>)) ?? null;
  } catch {
    return null;
  }
}

export async function deleteStoredFile(fingerprint: string): Promise<void> {
  if (isNativeApp()) {
    saveNativeIndex(nativeIndex().filter((f) => f.fingerprint !== fingerprint));
    try {
      const { Filesystem, where } = await fs();
      await Filesystem.deleteFile({ ...where, path: `${NATIVE_DIR}/${fingerprint}` });
    } catch {
      // Already gone
    }
    return;
  }
  try {
    await run('readwrite', (s) => s.delete(fingerprint));
  } catch {
    // Nothing stored, or storage unavailable
  }
}

export async function deleteAllStoredFiles(): Promise<void> {
  if (isNativeApp()) {
    saveNativeIndex([]);
    try {
      const { Filesystem, where } = await fs();
      await Filesystem.rmdir({ ...where, path: NATIVE_DIR, recursive: true });
    } catch {
      // Nothing kept
    }
    return;
  }
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
