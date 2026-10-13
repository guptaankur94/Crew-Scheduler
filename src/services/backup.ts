import { CrewPreferences, RosterHistoryEntry } from '../types/circadian';
import { clearImportRecords } from './importRecords';
import { deleteAllStoredFiles } from './fileStore';
import { clearAppState, loadRawAppState, PersistedAppState, reviveAppState, reviveRoster, saveAppState } from './appStateStorage';
import { clearRosterHistoryLogs, loadRosterHistory, saveRosterHistory } from './rosterHistoryService';

/**
 * Everything the app keeps lives on this device only. These helpers let the user take a copy
 * (backup), put it back (restore), or remove it all. When the app moves to an on-phone database,
 * only the storage modules change; the backup format stays the same.
 */

const BACKUP_APP = 'CrewCircadian';
const BACKUP_VERSION = 1;

export interface RestoredData {
  state: PersistedAppState | null;
  history: RosterHistoryEntry[];
}

export function buildBackup(state: unknown, history: RosterHistoryEntry[], now: Date = new Date()): string {
  return JSON.stringify(
    { app: BACKUP_APP, version: BACKUP_VERSION, exportedAt: now.toISOString(), state, history },
    null,
    2
  );
}

/** Reads a backup file's text. Anything unusable is dropped; a file that is not a backup is refused. */
export function parseBackup(text: string, defaultPreferences: CrewPreferences): RestoredData | { error: string } {
  let parsed: any;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { error: 'That file is not a CrewCircadian backup.' };
  }
  if (!parsed || parsed.app !== BACKUP_APP || typeof parsed.version !== 'number') {
    return { error: 'That file is not a CrewCircadian backup.' };
  }
  if (parsed.version > BACKUP_VERSION) {
    return { error: 'This backup was made by a newer version of the app. Please update the app first.' };
  }

  const state = parsed.state ? reviveAppState(parsed.state, defaultPreferences) : null;
  const history: RosterHistoryEntry[] = Array.isArray(parsed.history)
    ? parsed.history
        .filter((h: any) => h && typeof h.id === 'string' && typeof h.timestamp === 'string' && typeof h.title === 'string')
        .map((h: any) => {
          const snapshot = h.rosterSnapshot ? reviveRoster(h.rosterSnapshot) : null;
          const { rosterSnapshot, ...rest } = h;
          return snapshot ? { ...rest, rosterSnapshot: snapshot } : rest;
        })
    : [];

  if (!state && history.length === 0) {
    return { error: 'This backup does not contain any roster or history the app can use.' };
  }
  return { state, history };
}

export function createBackupFromDevice(): string {
  return buildBackup(loadRawAppState(), loadRosterHistory());
}

export function writeRestoredData(data: RestoredData): void {
  if (data.state) saveAppState(data.state);
  saveRosterHistory(data.history);
}

export function deleteAllLocalData(): void {
  clearAppState();
  clearRosterHistoryLogs();
  clearImportRecords();
  void deleteAllStoredFiles();
}

/**
 * Asks the browser to keep this app's data even when storage runs low. Browsers may say no;
 * the backup is the reliable safeguard either way.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (typeof navigator === 'undefined' || !navigator.storage?.persist) return false;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

// ─── Password-protected backups ────────────────────────────────────────────────
// AES-256-GCM with a key from the password (PBKDF2-SHA-256, 310,000 rounds, random salt). Without the password the
// file cannot be read, so it is safe to email or keep in a cloud drive. The password is never stored.

const ITERATIONS = 310_000;
// In chunks: spreading a large file's bytes into one call overflows the stack
const b64 = (bytes: Uint8Array) => {
  let text = '';
  for (let i = 0; i < bytes.length; i += 0x8000) text += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(text);
};
const unb64 = (s: string): Uint8Array<ArrayBuffer> => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function keyFrom(password: string, salt: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

/** Wraps a backup in password protection. */
export async function encryptBackup(backupJson: string, password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await keyFrom(password, salt), new TextEncoder().encode(backupJson)));
  return JSON.stringify({ app: BACKUP_APP, encrypted: true, v: 1, kdf: 'PBKDF2-SHA256', iterations: ITERATIONS, salt: b64(salt), iv: b64(iv), data: b64(data) });
}

/** True when the file is a password-protected backup. */
export function isEncryptedBackup(text: string): boolean {
  try {
    const parsed = JSON.parse(text);
    return parsed?.app === BACKUP_APP && parsed?.encrypted === true;
  } catch {
    return false;
  }
}

/** Opens a password-protected backup; returns the plain backup, or null if the password is wrong. */
export async function decryptBackup(text: string, password: string): Promise<string | null> {
  try {
    const p = JSON.parse(text);
    const key = await keyFrom(password, unb64(p.salt));
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(p.iv) }, key, unb64(p.data));
    return new TextDecoder().decode(plain);
  } catch {
    return null;
  }
}
