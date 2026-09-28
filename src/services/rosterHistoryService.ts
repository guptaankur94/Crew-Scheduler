import { RosterData, RosterHistoryEntry } from '../types/circadian';

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
    crewName: 'Cabin Crew',
    homeBase,
    homeBaseTzOffset,
    flights: [],
    layovers: [],
    parsedAt: new Date().toISOString(),
  };
}

export function loadRosterHistory(): RosterHistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
    return [];
  } catch (err) {
    console.warn('Failed to load roster history from localStorage', err);
    return [];
  }
}

export function saveRosterHistory(entries: RosterHistoryEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch (err) {
    console.warn('Failed to save roster history to localStorage', err);
  }
}

export function recordRosterAction(
  entry: Omit<RosterHistoryEntry, 'id' | 'timestamp'>
): RosterHistoryEntry[] {
  const current = loadRosterHistory();
  
  // Mark previous entries as not active if the new one is active
  const updatedCurrent = current.map((item) => ({
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
    localStorage.removeItem(STORAGE_KEY);
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
