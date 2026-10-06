import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyImport, combineScreenshots, diffRoster, hasNoChanges, importScope, keepNudgesOutside, UploadContent } from '../src/services/rosterDiff';
import { normalizeFlightNumber, rosterClock, sectorKeys } from '../src/services/rosterKeys';
import { computePeriodStats } from '../src/services/periodStats';
import { generateCircadianPlan } from '../src/services/circadianCalculator';
import type { CrewPreferences, FlightLeg, RosterData, StandbyDuty } from '../src/types/circadian';

/*
 * Import reconciliation: scope, day-by-day changes and applying them.
 * Includes the real case that started this: a September roster showing 1–2 Oct, then the October roster;
 * October must count only the October roster.
 */

const prefs = {
  homeBaseIata: 'BLR', homeBaseTzOffset: 5.5, chronotype: 'intermediate', targetSleepHours: 7.5, caffeineCutoffHours: 6,
  groomingMinutes: 60, cabBufferMinutes: 60, crewRank: 'senior', currency: 'INR',
} as CrewPreferences;

let n = 0;
/** A flight with times in India time. Each call gets a fresh id, like a new upload would. */
const leg = (fn: string, from: string, to: string, depIst: string, minutes: number, extra: Partial<FlightLeg> = {}): FlightLeg => {
  const dep = Date.parse(`${depIst}:00+05:30`);
  const arr = dep + minutes * 60000;
  return {
    id: `f${++n}`, flightNumber: fn, origin: from, destination: to,
    departureTimeUtc: new Date(dep).toISOString(), arrivalTimeUtc: new Date(arr).toISOString(),
    reportTimeUtc: new Date(dep - 60 * 60000).toISOString(), releaseTimeUtc: new Date(arr + 30 * 60000).toISOString(),
    originTzOffset: 5.5, destTzOffset: 5.5, durationMinutes: minutes, ...extra,
  };
};
const sb = (kind: 'home' | 'airport', startIst: string, hours: number): StandbyDuty => {
  const s = Date.parse(`${startIst}:00+05:30`);
  return { id: `s${++n}`, kind, airport: 'BLR', startUtc: new Date(s).toISOString(), endUtc: new Date(s + hours * 3600000).toISOString() };
};
const roster = (flights: FlightLeg[], extra: Partial<RosterData> = {}): RosterData => ({
  id: 'r', airline: 'IndiGo', homeBase: 'BLR', homeBaseTzOffset: 5.5, flights, layovers: [], parsedAt: '', ...extra,
});
const clock = rosterClock(roster([]));
const octDates = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => `2026-10-${String(from + i).padStart(2, '0')}`);

/** Scope, diff and apply in one go, with the default choices. */
function importOver(saved: RosterData, upload: UploadContent) {
  const scope = importScope(upload, saved, clock)!;
  const diff = diffRoster(saved, upload, scope.dates, clock);
  const applied = applyImport(saved, upload, scope.dates, diff, clock);
  return { scope, diff, roster: roster(applied.flights, { standbyDuties: applied.standby, otherDuties: applied.otherDuties }) };
}

// The September roster as saved: late September plus 1–2 Oct as planned at the time
const september = () => [
  leg('6E 105', 'BLR', 'PNQ', '2026-09-27T18:47', 80),
  leg('6E 107', 'PNQ', 'BLR', '2026-09-27T20:55', 95),
  leg('6E 408', 'BLR', 'PNQ', '2026-10-01T04:30', 90),
  leg('6E 391', 'PNQ', 'BLR', '2026-10-01T06:40', 110),
  leg('6E 6595', 'BLR', 'AMD', '2026-10-02T13:55', 125),
  leg('6E 863', 'AMD', 'BLR', '2026-10-02T16:55', 140),
];
// The October roster: 1 Oct free, 2 Oct re-planned, 3 Oct new
const october = () => [
  leg('6E 408', 'BLR', 'PNQ', '2026-10-02T04:12', 91),
  leg('6E 391', 'PNQ', 'BLR', '2026-10-02T06:38', 101),
  leg('6E 508', 'BLR', 'RDP', '2026-10-03T11:14', 146),
  leg('6E 509', 'RDP', 'BLR', '2026-10-03T14:11', 148),
];
const octoberHours = Number(((91 + 101 + 146 + 148) / 60).toFixed(1));

// ── Identity ──

test('keys: same flight number however it is written; home-time date; repeats numbered by time', () => {
  assert.equal(normalizeFlightNumber('6e 0408'), '6E408');
  assert.equal(normalizeFlightNumber('6E-408'), '6E408');
  const late = leg('6E 1', 'BLR', 'DEL', '2026-10-01T02:00', 160); // still 30 Sep in UTC
  assert.deepEqual(sectorKeys([late], clock), ['2026-10-01|6E1|BLR|DEL']);
  const twice = [leg('6E 5', 'BLR', 'MAA', '2026-10-04T18:00', 60), leg('6E 5', 'BLR', 'MAA', '2026-10-04T08:00', 60)];
  assert.deepEqual(sectorKeys(twice, clock), ['2026-10-04|6E5|BLR|MAA#2', '2026-10-04|6E5|BLR|MAA']);
});

// ── The original bug ──

test('full October roster over a September roster that showed 1–2 Oct: October counts only October', () => {
  const saved = roster(september());
  const { scope, diff, roster: after } = importOver(saved, { flights: october(), periodStart: '2026-10-01', periodEnd: '2026-10-31', visibleDates: octDates(1, 31) });
  assert.equal(scope.kind, 'full');
  assert.deepEqual(diff.days.map((d) => [d.date, d.summary]), [['2026-10-01', 'now_free'], ['2026-10-02', 'changed'], ['2026-10-03', 'new']]);
  assert.deepEqual(after.flights.filter((f) => f.departureTimeUtc < '2026-09-30').map((f) => f.flightNumber), ['6E 105', '6E 107'], 'September untouched');
  const stats = computePeriodStats(generateCircadianPlan(after, prefs), { start: '2026-10-01', end: '2026-10-31' });
  assert.equal(stats.flyingHours, octoberHours);
  assert.equal(stats.sectors, 4);
});

// ── Idempotency ──

test('the same roster uploaded again (new file, new ids) finds no changes; applying it duplicates nothing', () => {
  const upload: UploadContent = { flights: october(), periodStart: '2026-10-01', periodEnd: '2026-10-31', visibleDates: octDates(1, 31) };
  const once = importOver(roster(september()), upload).roster;
  const again: UploadContent = { ...upload, flights: october() }; // a different file: same content, new ids
  const scope = importScope(again, once, clock)!;
  const diff = diffRoster(once, again, scope.dates, clock);
  assert.equal(hasNoChanges(diff, scope), true);
  assert.equal(applyImport(once, again, scope.dates, diff, clock).flights.length, once.flights.length);
});

test('a time that differs by a few minutes looks like a reading difference: saved time kept unless chosen', () => {
  const saved = roster([leg('6E 408', 'BLR', 'PNQ', '2026-10-02T04:12', 91)]);
  const reread = { flights: [leg('6E 4O8', 'BLR', 'PNQ', '2026-10-02T04:14', 91)], visibleDates: ['2026-10-02'] };
  const scope = importScope(reread, saved, clock)!;
  const diff = diffRoster(saved, reread, scope.dates, clock);
  assert.equal(diff.days.length, 0);
  assert.equal(diff.readingDifferences.length, 1);
  assert.equal(hasNoChanges(diff, scope), true, 'nothing real changed');
  assert.equal(applyImport(saved, reread, scope.dates, diff, clock).flights[0].flightNumber, '6E 408', 'default keeps the saved reading');
  const chosen = applyImport(saved, reread, scope.dates, diff, clock, { useNewReading: new Set([reread.flights[0].id]) });
  assert.equal(chosen.flights[0].flightNumber, '6E 4O8');
});

test('several screenshots of one upload: overlapping entries kept once; a disagreement is flagged', () => {
  const a = leg('6E 408', 'BLR', 'PNQ', '2026-10-02T04:12', 91);
  const same = leg('6E408', 'BLR', 'PNQ', '2026-10-02T04:13', 91);
  const other = leg('6E 391', 'PNQ', 'BLR', '2026-10-02T06:38', 101);
  const ok = combineScreenshots([a, other, same], [], [], clock);
  assert.equal(ok.flights.length, 2);
  assert.equal(ok.warnings.length, 0);
  const clash = combineScreenshots([a, leg('6E 408', 'BLR', 'PNQ', '2026-10-02T06:00', 91)], [], [], clock);
  assert.equal(clash.flights.length, 1);
  assert.match(clash.warnings[0], /disagree on 6E 408/);
});

// ── Matching: the same flight that changed vs a new flight ──

test('changed time, changed flight number and changed route are recognised as the same flight', () => {
  const saved = roster([
    leg('6E 100', 'BLR', 'DEL', '2026-10-05T08:00', 160),
    leg('6E 200', 'BLR', 'HYD', '2026-10-06T08:00', 70),
    leg('6E 300', 'BLR', 'GOI', '2026-10-07T08:00', 70),
  ]);
  const upload = {
    flights: [
      leg('6E 100', 'BLR', 'DEL', '2026-10-05T04:30', 160), // report 08:00 → 04:30 style change
      leg('6E 250', 'BLR', 'HYD', '2026-10-06T08:30', 70), // re-numbered, 30 min later
      leg('6E 300', 'BLR', 'COK', '2026-10-07T08:00', 70), // new destination
    ],
    visibleDates: octDates(5, 7),
  };
  const { diff } = importOver(saved, upload);
  assert.deepEqual(diff.days.map((d) => d.flights.map((p) => p.change)), [['times'], ['number'], ['route']]);
});

// ── Scope ──

test('a partial screenshot with a whole-month header only changes the dates it shows', () => {
  const saved = roster([leg('6E 9', 'BLR', 'MAA', '2026-10-05T08:00', 60), leg('6E 20', 'BLR', 'DEL', '2026-10-20T08:00', 160)]);
  const upload = { flights: [leg('6E 11', 'BLR', 'MAA', '2026-10-05T09:00', 60)], periodStart: '2026-10-01', periodEnd: '2026-10-31', visibleDates: octDates(2, 8) };
  const { scope, roster: after } = importOver(saved, upload);
  assert.equal(scope.kind, 'partial_with_header');
  assert.deepEqual(scope.dates, octDates(2, 8));
  assert.equal(scope.wholePeriod!.length, 31);
  assert.ok(after.flights.some((f) => f.flightNumber === '6E 20'), '20 Oct is not in the screenshot, so it is untouched');
});

test('without a list of shown dates, a saved day the upload says nothing about is asked about, and kept by default', () => {
  const { scope, roster: after } = importOver(roster(september()), { flights: october(), periodStart: '2026-10-01', periodEnd: '2026-10-31' });
  assert.equal(scope.kind, 'items_only');
  assert.deepEqual(scope.unclearDates, ['2026-10-01']);
  assert.ok(after.flights.some((f) => f.departureTimeUtc.startsWith('2026-09-30T23') || f.departureTimeUtc.startsWith('2026-10-01')), '1 Oct kept until the person says it is free');
  // Saying 1 Oct is free clears it
  const saved = roster(september());
  const upload = { flights: october() };
  const s = importScope(upload, saved, clock)!;
  const dates = [...s.dates, '2026-10-01'].sort();
  const freed = applyImport(saved, upload, dates, diffRoster(saved, upload, dates, clock), clock);
  assert.ok(!freed.flights.some((f) => clock.date(Date.parse(f.departureTimeUtc)) === '2026-10-01'));
});

// ── Standby ──

test('standby: times moved, flight → standby, standby → flight', () => {
  const saved = roster([leg('6E 408', 'BLR', 'PNQ', '2026-10-04T06:00', 90)], {
    standbyDuties: [sb('home', '2026-10-03T05:00', 8), sb('home', '2026-10-05T05:00', 8)],
  });
  const upload = {
    flights: [leg('6E 77', 'BLR', 'DEL', '2026-10-05T10:00', 160)],
    standby: [sb('home', '2026-10-03T09:00', 8), sb('airport', '2026-10-04T05:00', 6)],
    visibleDates: octDates(3, 5),
  };
  const { diff } = importOver(saved, upload);
  assert.deepEqual(diff.days.map((d) => [d.date, d.summary]), [
    ['2026-10-03', 'standby_changed'],
    ['2026-10-04', 'flight_to_standby'],
    ['2026-10-05', 'standby_to_flight'],
  ]);
});

// ── The person's own entries ──

test('a callout you added is kept if the new roster does not show it, and confirmed when it does', () => {
  const callout = leg('6E 123', 'BLR', 'DEL', '2026-10-07T09:00', 160, { userChange: 'callout' });
  const saved = roster([callout], { standbyDuties: [sb('home', '2026-10-07T05:00', 8)] });
  const without = importOver(saved, { flights: [leg('6E 9', 'BLR', 'MAA', '2026-10-08T08:00', 60)], standby: [sb('home', '2026-10-07T05:00', 8)], visibleDates: octDates(7, 8) });
  assert.deepEqual(without.diff.userFlightsNotOnRoster.map((f) => f.flightNumber), ['6E 123']);
  assert.ok(without.roster.flights.some((f) => f.flightNumber === '6E 123'), 'kept by default');
  const withIt = importOver(saved, { flights: [leg('6E 123', 'BLR', 'DEL', '2026-10-07T09:00', 160)], visibleDates: ['2026-10-07'] });
  assert.equal(withIt.diff.userFlightsConfirmed.length, 1);
  assert.equal(withIt.roster.flights.filter((f) => f.flightNumber === '6E 123').length, 1, 'no duplicate');
});

test('sleep adjustments are kept away from changed days', () => {
  const kept = keepNudgesOutside({ 'sleep-2026-10-01T17:30': 30, 'sleep-2026-10-10T17:30': -15, 'nap-2026-10-03T08:00': 20 }, ['2026-10-02']);
  assert.deepEqual(kept, { 'sleep-2026-10-10T17:30': -15 });
});

test('an in-flight rest choice is saved by stable key, so it still applies after the roster is re-uploaded', () => {
  const longHaul = () => leg('6E 1457', 'BLR', 'LHR', '2026-10-10T02:00', 600, { destTzOffset: 1 });
  const key = sectorKeys([longHaul()], clock)[0];
  const napStart = (r: RosterData, p: CrewPreferences) =>
    generateCircadianPlan(r, p).events.find((e) => e.id.startsWith('crew-rest-'))?.startUtc;
  const withChoice = { ...prefs, bunkShiftAssignments: { [key]: 'shift2' as const } };
  const first = napStart(roster([longHaul()]), withChoice);
  const reuploaded = napStart(roster([longHaul()]), withChoice); // new flight id, same key
  assert.ok(first, 'a rest nap is planned on the long flight');
  assert.equal(reuploaded, first);
  assert.notEqual(napStart(roster([longHaul()]), { ...prefs, bunkShiftAssignments: { [key]: 'shift1' } }), first, 'the choice changes the plan');
});

// ── Two rosters in one upload, or an older roster uploaded again ──

import { combineFiles } from '../src/services/rosterDiff';

const sepFile = (): UploadContent => ({ flights: september(), periodStart: '2026-09-01', periodEnd: '2026-09-30', visibleDates: [...Array.from({ length: 30 }, (_, i) => `2026-09-${String(i + 1).padStart(2, '0')}`), '2026-10-01', '2026-10-02'] });
const octFile = (): UploadContent => ({ flights: october(), periodStart: '2026-10-01', periodEnd: '2026-10-31', visibleDates: octDates(1, 31) });
const octStats = (r: RosterData) => computePeriodStats(generateCircadianPlan(r, prefs), { start: '2026-10-01', end: '2026-10-31' });

test('September and October uploaded together: each date comes from the roster whose own period covers it, in any order', () => {
  for (const files of [[sepFile(), octFile()], [octFile(), sepFile()]]) {
    const { content } = combineFiles(files, clock);
    assert.deepEqual(content.tailDates, [], '1–2 Oct are October’s own dates');
    const after = importOver(roster([]), content).roster;
    assert.equal(octStats(after).flyingHours, octoberHours);
    assert.ok(after.flights.some((f) => f.flightNumber === '6E 105'), 'September kept');
  }
});

test('an older roster uploaded again never overwrites the newer roster’s dates (its extra days only fill gaps)', () => {
  const afterOct = { ...importOver(roster(september()), octFile()).roster, periodStart: '2026-09-01', periodEnd: '2026-10-31' };
  const { content } = combineFiles([sepFile()], clock);
  assert.deepEqual(content.tailDates, ['2026-10-01', '2026-10-02']);
  const scope = importScope(content, afterOct, clock)!;
  assert.deepEqual(scope.keptAsSaved, ['2026-10-01', '2026-10-02']);
  const again = importOver(afterOct, content).roster;
  assert.equal(octStats(again).flyingHours, octoberHours);
  // With nothing saved for those dates yet, the extra days do fill in
  assert.ok(importOver(roster([]), content).roster.flights.some((f) => clock.date(Date.parse(f.departureTimeUtc)) === '2026-10-02'));
});

test('two rosters without printed periods: the one starting later decides the dates both show', () => {
  const noPeriod = (f: UploadContent): UploadContent => ({ flights: f.flights, visibleDates: f.visibleDates });
  const { content } = combineFiles([noPeriod(sepFile()), noPeriod(octFile())], clock);
  assert.equal(octStats(importOver(roster([]), content).roster).flyingHours, octoberHours);
});
