import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compactHistory, expandHistory } from '../src/services/historyCompact';
import { getPresets } from '../src/data/rosterPresets';
import type { RosterHistoryEntry } from '../src/types/circadian';

test('history saved compactly comes back exactly as it was, and older saves still load', () => {
  const rosters = getPresets().map((p) => p.roster);
  const entries: RosterHistoryEntry[] = rosters.flatMap((r, i) => [
    { id: `a${i}`, timestamp: `2026-10-0${i + 1}T10:00:00Z`, actionType: 'upload', title: 'Upload', description: '', flightsCount: r.flights.length, rosterSnapshot: r, previousSnapshot: { ...r, flights: r.flights.slice(1) } } as RosterHistoryEntry,
    { id: `b${i}`, timestamp: `2026-10-0${i + 1}T11:00:00Z`, actionType: 'manual_edit', title: 'Edit', description: '', flightsCount: r.flights.length, rosterSnapshot: r } as RosterHistoryEntry,
  ]);
  const stored = JSON.parse(JSON.stringify(compactHistory(entries)));
  assert.deepEqual(expandHistory(stored), entries);
  assert.ok(JSON.stringify(stored).length < JSON.stringify(entries).length / 2, 'at least half the size');
  // An old-format save (a plain list) loads unchanged
  assert.deepEqual(expandHistory(JSON.parse(JSON.stringify(entries))), entries);
  assert.deepEqual(expandHistory(null), []);
});
