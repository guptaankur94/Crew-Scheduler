import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addImportRecord, ImportRecord, loadImportRecords, recordsFromHistory, uploadStatus } from '../src/services/importRecords';
import type { FlightLeg, RosterData, RosterHistoryEntry } from '../src/types/circadian';

const store = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};

const ist = (s: string) => new Date(Date.parse(`${s}:00+05:30`)).toISOString();
const leg = (id: string, o: string, d: string, dep: string, arr: string, extra: Partial<FlightLeg> = {}): FlightLeg => ({
  id, flightNumber: id, origin: o, destination: d, departureTimeUtc: ist(dep), arrivalTimeUtc: ist(arr), reportTimeUtc: new Date(Date.parse(ist(dep)) - 3600000).toISOString(),
  releaseTimeUtc: new Date(Date.parse(ist(arr)) + 1800000).toISOString(), originTzOffset: 5.5, destTzOffset: 5.5, durationMinutes: 60, ...extra,
});
const roster = (flights: FlightLeg[]): RosterData => ({ id: 'r', airline: 'IndiGo', homeBase: 'BLR', homeBaseTzOffset: 5.5, flights, layovers: [], parsedAt: '' });
const october = () => [leg('6E 408', 'BLR', 'PNQ', '2026-10-02T04:12', '2026-10-02T05:43'), leg('6E 508', 'BLR', 'RDP', '2026-10-03T11:14', '2026-10-03T13:40'), leg('6E 941', 'BLR', 'AGR', '2026-10-18T12:40', '2026-10-18T15:10')];
const record = (): ImportRecord => ({
  id: 'import-1', title: 'October roster.jpeg', uploadedAt: '2026-10-05T09:29:00.000Z', source: 'files',
  files: [{ name: 'October roster.jpeg', type: 'image/jpeg', size: 1000, fingerprint: 'abc', stored: true }],
  dates: ['2026-10-02', '2026-10-03', '2026-10-18'], tailDates: [], read: { flights: october(), standby: [], otherDuties: [] },
});

test('an upload whose days are all unchanged is active', () => {
  assert.deepEqual(uploadStatus(record(), roster(october())), { state: 'active', asUploaded: 3, editedByYou: 0, changedSince: 0, total: 3 });
});

test('a day corrected by the person, and a day changed by a newer upload, make it partly in use', () => {
  const now = october();
  now[0] = { ...now[0], departureTimeUtc: ist('2026-10-02T04:30'), correctedByUser: true };
  now[2] = leg('6E 77', 'BLR', 'GOI', '2026-10-18T09:00', '2026-10-18T10:15');
  assert.deepEqual(uploadStatus(record(), roster(now)), { state: 'partly', asUploaded: 1, editedByYou: 1, changedSince: 1, total: 3 });
});

test('an upload all of whose days were replaced is not in use', () => {
  const later = [leg('X1', 'BLR', 'DEL', '2026-10-02T09:00', '2026-10-02T11:40'), leg('X2', 'BLR', 'DEL', '2026-10-03T09:00', '2026-10-03T11:40'), leg('X3', 'BLR', 'DEL', '2026-10-18T09:00', '2026-10-18T11:40')];
  assert.equal(uploadStatus(record(), roster(later)).state, 'replaced');
});

test('records are kept on the device, newest first', () => {
  addImportRecord({ ...record(), id: 'a' });
  addImportRecord({ ...record(), id: 'b' });
  assert.deepEqual(loadImportRecords().map((r) => r.id), ['b', 'a']);
});

test('uploads made before records existed are worked out from history (what each upload changed)', () => {
  const sep = roster([leg('6E 105', 'BLR', 'PNQ', '2026-09-27T18:47', '2026-09-27T20:07')]);
  const both = roster([...sep.flights, ...october()]);
  const entry = (id: string, title: string, ts: string, snap: RosterData, actionType: RosterHistoryEntry['actionType'] = 'upload'): RosterHistoryEntry =>
    ({ id, timestamp: ts, actionType, title, airline: 'IndiGo', homeBase: 'BLR', flightsCount: snap.flights.length, isActive: false, rosterSnapshot: snap });
  const history = [entry('2', 'October.jpeg', '2026-10-05T09:29:00.000Z', both), entry('1', 'September.jpeg', '2026-09-28T10:00:00.000Z', sep)];
  const derived = recordsFromHistory(history, []);
  assert.deepEqual(derived.map((r) => [r.title, r.dates]), [
    ['October.jpeg', ['2026-10-02', '2026-10-03', '2026-10-18']],
    ['September.jpeg', ['2026-09-27']],
  ]);
  assert.equal(derived[0].source, 'history');
  assert.equal(recordsFromHistory(history, [{ ...record(), uploadedAt: '2026-10-05T09:30:00.000Z' }]).length, 1, 'already recorded uploads are not repeated');
});

// ── Your rosters: Re-read and Remove ──

import { cleanSlate, markRemoved, ownedDates, periodOf, visibleRecords, withoutDates } from '../src/services/importRecords';

const sepRecord = (): ImportRecord => ({
  ...record(), id: 'sep', title: 'September.jpeg', uploadedAt: '2026-09-28T10:00:00.000Z',
  dates: ['2026-09-27', '2026-10-01', '2026-10-02'], tailDates: ['2026-10-01', '2026-10-02'],
  read: { flights: [leg('6E 105', 'BLR', 'PNQ', '2026-09-27T18:47', '2026-09-27T20:07'), leg('OLD', 'BLR', 'AMD', '2026-10-02T13:55', '2026-10-02T16:00')], standby: [], otherDuties: [] },
});

test('each roster owns its own dates; a newer roster owns the dates both cover', () => {
  const all = [sepRecord(), record()];
  assert.deepEqual(ownedDates(sepRecord(), all), ['2026-09-27'], 'extra days 1–2 Oct are not September’s own');
  const oct = ownedDates(record(), all);
  assert.equal(oct.length, 17, 'the whole range it covers, 2–18 Oct, blank days included');
  assert.deepEqual([oct[0], oct[oct.length - 1]], ['2026-10-02', '2026-10-18']);
});

test('Re-read is a clean slate for its dates: corrections and added flights on them go, other dates stay', () => {
  const corrected = { ...october()[0], departureTimeUtc: ist('2026-10-02T04:30'), correctedByUser: true };
  const added = { ...leg('EXTRA', 'BLR', 'GOI', '2026-10-03T18:00', '2026-10-03T19:15'), correctedByUser: true };
  const sep = leg('6E 105', 'BLR', 'PNQ', '2026-09-27T18:47', '2026-09-27T20:07');
  const now = roster([sep, corrected, october()[1], added, october()[2]]);
  const after = cleanSlate(now, ownedDates(record(), [record()]), record().read);
  assert.deepEqual(after.flights.map((f) => f.flightNumber), ['6E 105', '6E 408', '6E 508', '6E 941']);
  assert.ok(!after.flights.some((f) => f.correctedByUser), 'no corrections left on October’s dates');
});

test('Remove takes only that roster’s dates out of the plan; the period shrinks to what is left', () => {
  const now = roster([leg('6E 105', 'BLR', 'PNQ', '2026-09-27T18:47', '2026-09-27T20:07'), ...october()]);
  const left = withoutDates(now, ownedDates(record(), [sepRecord(), record()]));
  assert.deepEqual(left.flights.map((f) => f.flightNumber), ['6E 105']);
  assert.deepEqual(periodOf([{ dates: ownedDates(sepRecord(), [sepRecord()]).filter((d) => !sepRecord().tailDates.includes(d)) }]), { periodStart: '2026-09-27', periodEnd: '2026-09-27' });
});

test('a removed roster is hidden, and shows again if Undo brings its days back', () => {
  store.clear();
  const [removed] = markRemoved(record());
  const withDays = roster(october());
  const withoutDays = roster([]);
  assert.equal(visibleRecords([removed], withoutDays).length, 0);
  assert.equal(visibleRecords([removed], withDays).length, 1, 'after Undo the days are back, so is the roster');
});

test('a day marked by hand inside a roster’s range is removed with it', () => {
  const handMarked = { ...roster(october()), otherDuties: [{ id: 'm', kind: 'off' as const, date: '2026-10-10' }] };
  assert.deepEqual(withoutDates(handMarked, ownedDates(record(), [record()])).otherDuties, []);
});
