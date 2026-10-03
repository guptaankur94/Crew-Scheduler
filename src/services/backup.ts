import { CrewPreferences, RosterHistoryEntry } from '../types/circadian';
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
