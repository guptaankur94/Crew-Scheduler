import { RosterData, RosterHistoryEntry, UserUpdate } from '../types/circadian';
import { kv } from './kv';

const STORAGE_KEY = 'crew_roster_history_v1';

export function computeRosterDateRange(roster: RosterData): string {
  if (!roster.flights || roster.flights.length === 0) {
    return 'No active sectors';
  }

  const sorted = [...roster.flights].sort(
    (a, b) => new Date(a.departureTimeUtc).getTime() - new Date(b.departureTimeUtc).getTime()
  );

  const firstDate = new Date(sorted[0].departureTimeUtc);
  const lastDate = new Date(sorted[sorted.length - 1].departureTimeUtc);

  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  const firstStr = firstDate.toLocaleDateString('en-US', opts);
  const lastStr = lastDate.toLocaleDateString('en-US', opts);

  return `${firstStr} – ${lastStr}`;
}

export function createEmptyRoster(homeBase = 'DEL', homeBaseTzOffset = 5.5): RosterData {
  return {
    id: `cleared-roster-${Date.now()}`,
    airline: 'None',
    homeBase,
    homeBaseTzOffset,
    flights: [],
    layovers: [],
    parsedAt: new Date().toISOString(),
  };
}

function withoutCrewName(entry: RosterHistoryEntry): RosterHistoryEntry {
  const strip = (r?: RosterData) => {
    if (!r || !('crewName' in r)) return r;
    const { crewName: _name, ...rest } = r as RosterData & { crewName?: string };
    return rest;
  };
  return { ...entry, rosterSnapshot: strip(entry.rosterSnapshot), previousSnapshot: strip(entry.previousSnapshot) };
}

export function loadRosterHistory(): RosterHistoryEntry[] {
  try {
    const raw = kv.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    // The crew member's name is no longer kept; names saved by earlier versions are dropped
    if (Array.isArray(parsed)) return parsed.map(withoutCrewName);
    return [];
  } catch (err) {
    console.warn('Failed to load roster history', err);
    return [];
  }
}

export function saveRosterHistory(entries: RosterHistoryEntry[]): void {
  try {
    kv.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch (err) {
    console.warn('Failed to save roster history', err);
  }
}

export function recordRosterAction(
  entry: Omit<RosterHistoryEntry, 'id' | 'timestamp'>
): RosterHistoryEntry[] {
  const current = loadRosterHistory();
  
  // Mark previous entries as not active if the new one is active. Only the newest entry keeps the
  // roster from before its change (for Undo), so storage stays small.
  const updatedCurrent = current.map(({ previousSnapshot: _dropped, previousUpdates: _droppedUpdates, ...item }) => ({
    ...item,
    isActive: entry.isActive ? false : item.isActive,
  }));

  const newEntry: RosterHistoryEntry = {
    id: `hist-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
    ...entry,
  };

  const newHistory = [newEntry, ...updatedCurrent];
  // Keep up to 50 historical entries to prevent excessive localStorage usage
  const trimmed = newHistory.slice(0, 50);
  saveRosterHistory(trimmed);
  return trimmed;
}

export function deleteRosterHistoryItem(id: string): RosterHistoryEntry[] {
  const current = loadRosterHistory();
  const updated = current.filter((item) => item.id !== id);
  saveRosterHistory(updated);
  return updated;
}

export function clearRosterHistoryLogs(): void {
  try {
    kv.removeItem(STORAGE_KEY);
  } catch (err) {
    console.warn('Failed to clear roster history', err);
  }
}

export function setActiveHistoryItem(id: string): RosterHistoryEntry[] {
  const current = loadRosterHistory();
  const updated = current.map((item) => ({
    ...item,
    isActive: item.id === id,
  }));
  saveRosterHistory(updated);
  return updated;
}

/**
 * The newest change can be undone while the saved roster is still exactly what that change produced.
 * Returns that entry, or undefined when there is nothing safe to undo.
 */
export function undoableEntry(history: RosterHistoryEntry[], current: RosterData, currentUpdates: UserUpdate[] = []): RosterHistoryEntry | undefined {
  const latest = history[0];
  if (!latest?.previousSnapshot || !latest.rosterSnapshot || latest.actionType === 'undo') return undefined;
  if (JSON.stringify(latest.rosterSnapshot) !== JSON.stringify(current)) return undefined;
  if (latest.updatesSnapshot && JSON.stringify(latest.updatesSnapshot) !== JSON.stringify(currentUpdates)) return undefined;
  return latest;
}
