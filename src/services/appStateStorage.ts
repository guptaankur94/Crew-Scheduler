import { CrewPreferences, FlightLeg, RosterData } from '../types/circadian';

const STORAGE_KEY = 'crew_app_state_v1';

export interface PersistedAppState {
  roster: RosterData;
  preferences: CrewPreferences;
  customNudges: Record<string, number>;
  activePresetId: string;
}

const isValidIso = (value: unknown): value is string => typeof value === 'string' && !isNaN(Date.parse(value));

const isValidFlight = (f: any): f is FlightLeg =>
  !!f &&
  typeof f.id === 'string' &&
  typeof f.flightNumber === 'string' &&
  typeof f.origin === 'string' &&
  typeof f.destination === 'string' &&
  isValidIso(f.departureTimeUtc) &&
  isValidIso(f.arrivalTimeUtc) &&
  isValidIso(f.reportTimeUtc) &&
  isValidIso(f.releaseTimeUtc) &&
  typeof f.originTzOffset === 'number' &&
  typeof f.destTzOffset === 'number' &&
  typeof f.durationMinutes === 'number';

/**
 * Checks that a value read from storage really is a roster the app can render.
 * Blob preview links are dropped because they stop working once the page reloads.
 */
export function reviveRoster(value: any): RosterData | null {
  if (
    !value ||
    typeof value !== 'object' ||
    typeof value.homeBase !== 'string' ||
    typeof value.homeBaseTzOffset !== 'number' ||
    !Array.isArray(value.flights) ||
    !value.flights.every(isValidFlight)
  ) {
    return null;
  }

  const roster: RosterData = {
    ...value,
    airline: typeof value.airline === 'string' ? value.airline : 'Airline',
    layovers: Array.isArray(value.layovers) ? value.layovers : [],
    parsedAt: isValidIso(value.parsedAt) ? value.parsedAt : new Date().toISOString(),
  };
  if (typeof roster.sourceDocumentUrl === 'string' && roster.sourceDocumentUrl.startsWith('blob:')) {
    delete roster.sourceDocumentUrl;
  }
  return roster;
}

/**
 * Loads the saved roster, preferences and adjustments.
 * Returns null when nothing is saved or the saved data is unusable, so the app falls back to defaults.
 */
export function loadAppState(defaultPreferences: CrewPreferences): PersistedAppState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const roster = reviveRoster(parsed?.roster);
    if (!roster) return null;

    const savedPrefs = parsed.preferences && typeof parsed.preferences === 'object' ? parsed.preferences : {};
    const nudges: Record<string, number> = {};
    if (parsed.customNudges && typeof parsed.customNudges === 'object') {
      for (const [key, minutes] of Object.entries(parsed.customNudges)) {
        if (typeof minutes === 'number' && isFinite(minutes)) nudges[key] = minutes;
      }
    }

    return {
      roster,
      // Defaults first so a preference added in a later version is never undefined
      preferences: { ...defaultPreferences, ...savedPrefs },
      customNudges: nudges,
      activePresetId: typeof parsed.activePresetId === 'string' ? parsed.activePresetId : 'custom-upload',
    };
  } catch (err) {
    console.warn('Failed to load saved app state', err);
    return null;
  }
}

export function saveAppState(state: PersistedAppState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.warn('Failed to save app state to localStorage', err);
  }
}

export function clearAppState(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.warn('Failed to clear saved app state', err);
  }
}
