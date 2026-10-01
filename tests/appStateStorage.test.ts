import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { loadAppState, saveAppState, clearAppState } from '../src/services/appStateStorage';
import type { CrewPreferences, RosterData } from '../src/types/circadian';

const store = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};

const prefs: CrewPreferences = {
  airline: 'airline',
  homeBaseIata: 'DEL',
  homeBaseTzOffset: 5.5,
  chronotype: 'intermediate',
  targetSleepHours: 7.5,
  caffeineCutoffHours: 6,
  preferredNapDuration: 26,
  groomingMinutes: 60,
  cabBufferMinutes: 60,
  crewRank: 'senior',
  currency: 'INR',
};

const roster: RosterData = {
  id: 'r1',
  airline: 'IndiGo',
  homeBase: 'DEL',
  homeBaseTzOffset: 5.5,
  layovers: [],
  parsedAt: '2026-09-30T00:00:00.000Z',
  flights: [
    {
      id: 'f1',
      flightNumber: '6E 205',
      origin: 'DEL',
      destination: 'BOM',
      departureTimeUtc: '2026-10-01T01:00:00.000Z',
      arrivalTimeUtc: '2026-10-01T03:15:00.000Z',
      reportTimeUtc: '2026-09-30T23:45:00.000Z',
      releaseTimeUtc: '2026-10-01T03:45:00.000Z',
      originTzOffset: 5.5,
      destTzOffset: 5.5,
      durationMinutes: 135,
    },
  ],
};

beforeEach(() => store.clear());

test('returns null when nothing is saved', () => {
  assert.equal(loadAppState(prefs), null);
});

test('round-trips roster, preferences, nudges and preset id', () => {
  saveAppState({ roster, preferences: { ...prefs, chronotype: 'owl' }, customNudges: { e1: 15 }, activePresetId: 'custom-upload' });
  const loaded = loadAppState(prefs);
  assert.deepEqual(loaded?.roster, roster);
  assert.equal(loaded?.preferences.chronotype, 'owl');
  assert.deepEqual(loaded?.customNudges, { e1: 15 });
  assert.equal(loaded?.activePresetId, 'custom-upload');
});

test('corrupt or malformed saved data is ignored instead of crashing', () => {
  store.set('crew_app_state_v1', '{not json');
  assert.equal(loadAppState(prefs), null);

  store.set('crew_app_state_v1', JSON.stringify({ roster: { ...roster, flights: [{ id: 'x' }] } }));
  assert.equal(loadAppState(prefs), null);

  store.set('crew_app_state_v1', JSON.stringify({ roster: { ...roster, flights: [{ ...roster.flights[0], departureTimeUtc: 'garbage' }] } }));
  assert.equal(loadAppState(prefs), null);
});

test('missing preferences get defaults, bad nudges and dead blob links are dropped', () => {
  store.set(
    'crew_app_state_v1',
    JSON.stringify({
      roster: { ...roster, sourceDocumentUrl: 'blob:http://localhost/abc' },
      preferences: { currency: 'AED' },
      customNudges: { ok: 10, bad: 'x' },
    })
  );
  const loaded = loadAppState(prefs);
  assert.equal(loaded?.preferences.currency, 'AED');
  assert.equal(loaded?.preferences.targetSleepHours, 7.5);
  assert.deepEqual(loaded?.customNudges, { ok: 10 });
  assert.equal(loaded?.roster.sourceDocumentUrl, undefined);
});

test('clearAppState removes the saved state', () => {
  saveAppState({ roster, preferences: prefs, customNudges: {}, activePresetId: 'x' });
  clearAppState();
  assert.equal(loadAppState(prefs), null);
});
