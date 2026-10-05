import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recordRosterAction, undoableEntry, clearRosterHistoryLogs } from '../src/services/rosterHistoryService';
import { describeChanges, diffRoster } from '../src/services/rosterDiff';
import { rosterClock } from '../src/services/rosterKeys';
import { flightSource, standbySource } from '../src/services/provenance';
import type { FlightLeg, RosterData } from '../src/types/circadian';

const store = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};

let n = 0;
const leg = (fn: string, from: string, to: string, depIst: string, minutes: number, extra: Partial<FlightLeg> = {}): FlightLeg => {
  const dep = Date.parse(`${depIst}:00+05:30`);
  return {
    id: `f${++n}`, flightNumber: fn, origin: from, destination: to,
    departureTimeUtc: new Date(dep).toISOString(), arrivalTimeUtc: new Date(dep + minutes * 60000).toISOString(),
    reportTimeUtc: new Date(dep - 3600000).toISOString(), releaseTimeUtc: new Date(dep + (minutes + 30) * 60000).toISOString(),
    originTzOffset: 5.5, destTzOffset: 5.5, durationMinutes: minutes, ...extra,
  };
};
const roster = (flights: FlightLeg[], parsedAt = 'v'): RosterData => ({ id: 'r', airline: 'IndiGo', homeBase: 'BLR', homeBaseTzOffset: 5.5, flights, layovers: [], parsedAt });
const entry = (title: string, after: RosterData, before?: RosterData) => ({
  actionType: 'upload' as const, title, airline: 'IndiGo', homeBase: 'BLR', flightsCount: after.flights.length, isActive: true, rosterSnapshot: after, ...(before ? { previousSnapshot: before } : {}),
});

test('only the newest change keeps the roster from before it, and it can be undone only while nothing changed since', () => {
  clearRosterHistoryLogs();
  const v1 = roster([leg('6E 1', 'BLR', 'DEL', '2026-10-02T08:00', 160)], 'v1');
  const v2 = roster([...v1.flights, leg('6E 2', 'DEL', 'BLR', '2026-10-03T08:00', 160)], 'v2');
  const v3 = roster(v2.flights.slice(1), 'v3');
  recordRosterAction(entry('first', v1, roster([], 'v0')));
  recordRosterAction(entry('second', v2, v1));
  const history = recordRosterAction(entry('third', v3, v2));
  assert.equal(history.filter((h) => h.previousSnapshot).length, 1, 'older entries drop their undo copy');
  assert.equal(undoableEntry(history, v3)?.title, 'third');
  assert.deepEqual(undoableEntry(history, v3)?.previousSnapshot, v2);
  assert.equal(undoableEntry(history, { ...v3, parsedAt: 'edited later' }), undefined, 'not after a later change');
  const afterUndo = recordRosterAction({ ...entry('Undone: third', v2), actionType: 'undo' });
  assert.equal(undoableEntry(afterUndo, v2), undefined, 'an undo itself is not undone (no redo)');
});

test('history describes each changed day in plain words', () => {
  const clock = rosterClock(roster([]));
  const saved = roster([leg('6E 6595', 'BLR', 'AMD', '2026-10-02T13:55', 125), leg('6E 408', 'BLR', 'PNQ', '2026-10-05T04:30', 90)]);
  const upload = { flights: [leg('6E 408', 'BLR', 'PNQ', '2026-10-02T04:12', 91), leg('6E 408', 'BLR', 'PNQ', '2026-10-05T05:30', 90)], visibleDates: ['2026-10-02', '2026-10-05'] };
  const changes = describeChanges(diffRoster(saved, upload, upload.visibleDates, clock), clock);
  assert.deepEqual(changes, [
    { date: '2026-10-02', label: 'Changed', lines: ['6E 6595 BLR→AMD 13:55 removed', '6E 408 BLR→PNQ 04:12 added'] },
    { date: '2026-10-05', label: 'Changed', lines: ['6E 408 BLR→PNQ 04:30 → 6E 408 BLR→PNQ 05:30'] },
  ]);
});

test('every duty can say where it came from; unknown sources say nothing rather than guess', () => {
  const src = { title: 'October roster.jpeg', at: '2026-10-05T09:29:00.000Z' };
  assert.match(flightSource(leg('6E 1', 'BLR', 'DEL', '2026-10-02T08:00', 160, { importedFrom: src }))!, /^From October roster\.jpeg, uploaded 5 Oct/);
  assert.equal(flightSource(leg('6E 1', 'BLR', 'DEL', '2026-10-02T08:00', 160, { userChange: 'added' })), 'Added by you');
  assert.equal(flightSource(leg('6E 1', 'BLR', 'DEL', '2026-10-02T08:00', 160, { userChange: 'callout' })), 'Callout added by you');
  assert.match(flightSource(leg('6E 1', 'BLR', 'DEL', '2026-10-02T08:00', 160, { importedFrom: src, userChange: 'delayed', userDelayMinutes: 45 }))!, /delayed \+45 min by you$/);
  assert.equal(flightSource(leg('6E 1', 'BLR', 'DEL', '2026-10-02T08:00', 160)), null);
  assert.equal(standbySource({ id: 's', kind: 'home', airport: 'BLR', startUtc: '', endUtc: '' }), null);
});
