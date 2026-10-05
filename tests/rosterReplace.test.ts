import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeRosterMerge, rosterClock, splitByCoverage, uploadCoverage } from '../src/services/rosterMerger';
import { computePeriodStats } from '../src/services/periodStats';
import { generateCircadianPlan } from '../src/services/circadianCalculator';
import type { CrewPreferences, FlightLeg, RosterData } from '../src/types/circadian';

/*
 * Regression for a real case: a September roster that also showed 1–2 Oct, then the October roster.
 * Old 1–2 Oct flights were kept next to the new plan, so October showed 59.9h instead of 49.9h.
 * A newer roster must replace what the saved roster has on the dates it covers.
 */

const prefs = {
  homeBaseIata: 'BLR', homeBaseTzOffset: 5.5, chronotype: 'intermediate', targetSleepHours: 7.5, caffeineCutoffHours: 6,
  groomingMinutes: 60, cabBufferMinutes: 60, crewRank: 'senior', currency: 'INR',
} as CrewPreferences;

/** A flight with times in India time (home base BLR). */
const leg = (fn: string, from: string, to: string, depIst: string, minutes: number): FlightLeg => {
  const dep = Date.parse(`${depIst}:00+05:30`);
  const arr = dep + minutes * 60000;
  return {
    id: `${fn}-${depIst}`, flightNumber: fn, origin: from, destination: to,
    departureTimeUtc: new Date(dep).toISOString(), arrivalTimeUtc: new Date(arr).toISOString(),
    reportTimeUtc: new Date(dep - 60 * 60000).toISOString(), releaseTimeUtc: new Date(arr + 30 * 60000).toISOString(),
    originTzOffset: 5.5, destTzOffset: 5.5, durationMinutes: minutes,
  };
};
const roster = (flights: FlightLeg[], extra: Partial<RosterData> = {}): RosterData => ({
  id: 'r', airline: 'IndiGo', homeBase: 'BLR', homeBaseTzOffset: 5.5, flights, layovers: [], parsedAt: '', ...extra,
});
const OCT = { start: '2026-10-01', end: '2026-10-31' };

// September roster: late September plus the first two days of October as planned at the time
const septemberUpload = [
  leg('6E 105', 'BLR', 'PNQ', '2026-09-27T18:47', 80),
  leg('6E 107', 'PNQ', 'BLR', '2026-09-27T20:55', 95),
  leg('6E 408', 'BLR', 'PNQ', '2026-10-01T04:30', 90),
  leg('6E 391', 'PNQ', 'BLR', '2026-10-01T06:40', 110),
  leg('6E 6595', 'BLR', 'AMD', '2026-10-02T13:55', 125),
  leg('6E 863', 'AMD', 'BLR', '2026-10-02T16:55', 140),
];
// October roster: 1 Oct is now free and 2 Oct is re-planned to an early morning pair
const octoberUpload = [
  leg('6E 408', 'BLR', 'PNQ', '2026-10-02T04:12', 91),
  leg('6E 391', 'PNQ', 'BLR', '2026-10-02T06:38', 101),
  leg('6E 508', 'BLR', 'RDP', '2026-10-03T11:14', 146),
  leg('6E 509', 'RDP', 'BLR', '2026-10-03T14:11', 148),
];
const octoberHours = (91 + 101 + 146 + 148) / 60;

const mergeUpload = (saved: RosterData, upload: Parameters<typeof uploadCoverage>[0]) => {
  const clock = rosterClock(saved);
  const coverage = uploadCoverage(upload, clock);
  const { kept, replaced } = splitByCoverage(saved, coverage, clock);
  const flights = analyzeRosterMerge(kept.flights, upload.flights).nonConflictingMergedFlights;
  return { coverage, kept, replaced, roster: roster(flights) };
};

test('with the roster period printed, the newer roster replaces every older entry in it', () => {
  const saved = roster(septemberUpload, { otherDuties: [{ id: 'o', kind: 'off', date: '2026-10-05', code: 'OFF' }] });
  const result = mergeUpload(saved, { flights: octoberUpload, periodStart: '2026-10-01', periodEnd: '2026-10-31' });
  assert.deepEqual(result.coverage, { start: '2026-10-01', end: '2026-10-31', stated: true });
  assert.deepEqual(result.replaced.flights.map((f) => f.flightNumber), ['6E 408', '6E 391', '6E 6595', '6E 863']);
  assert.equal(result.replaced.otherDuties.length, 1, 'an older day off inside the new dates is replaced too');
  assert.deepEqual(result.kept.flights.map((f) => f.flightNumber), ['6E 105', '6E 107'], 'September is untouched');

  const stats = computePeriodStats(generateCircadianPlan(result.roster, prefs), OCT);
  assert.equal(stats.flyingHours, Number(octoberHours.toFixed(1)), 'October counts only the October roster');
  assert.equal(stats.sectors, 4);
});

test('without a printed period, entries from the first to the last day found are replaced', () => {
  const result = mergeUpload(roster(septemberUpload), { flights: octoberUpload });
  assert.deepEqual(result.coverage, { start: '2026-10-02', end: '2026-10-03', stated: false });
  // 2 Oct is re-planned; 1 Oct is before anything in the upload, so it is kept (the person sees the dates in the review)
  assert.deepEqual(result.replaced.flights.map((f) => f.flightNumber), ['6E 6595', '6E 863']);
  const twoOct = result.roster.flights.filter((f) => f.departureTimeUtc.startsWith('2026-10-0') && f.flightNumber !== '6E 508' && f.flightNumber !== '6E 509');
  assert.ok(!twoOct.some((f) => f.flightNumber === '6E 6595'), 'the old 2 Oct afternoon flights are gone');
});

test('the old merge alone would have kept the outdated flights (why the coverage rule exists)', () => {
  const merged = analyzeRosterMerge(septemberUpload, octoberUpload).nonConflictingMergedFlights;
  const stats = computePeriodStats(generateCircadianPlan(roster(merged), prefs), OCT);
  assert.ok(stats.flyingHours > octoberHours + 1, 'flight-by-flight matching keeps re-planned days twice');
});

test('a stated period wider than the items found still covers both', () => {
  const clock = rosterClock(roster([]));
  assert.deepEqual(uploadCoverage({ flights: octoberUpload, periodStart: '2026-10-03', periodEnd: '2026-10-31' }, clock), {
    start: '2026-10-02', end: '2026-10-31', stated: true,
  });
  assert.equal(uploadCoverage({ flights: [] }, clock), null);
});

test('standby on covered dates is replaced; dates use home time, so a late-night flight stays on its home date', () => {
  const saved = roster([leg('6E 1', 'BLR', 'DEL', '2026-09-30T23:30', 160), leg('6E 2', 'BLR', 'DEL', '2026-10-01T02:00', 160)], {
    standbyDuties: [{ id: 's', kind: 'home', airport: 'BLR', startUtc: '2026-10-02T09:00:00.000Z', endUtc: '2026-10-02T16:00:00.000Z' }],
  });
  const clock = rosterClock(saved);
  const { replaced, kept } = splitByCoverage(saved, uploadCoverage({ flights: octoberUpload, periodStart: '2026-10-01', periodEnd: '2026-10-31' }, clock), clock);
  assert.equal(replaced.standby.length, 1);
  assert.deepEqual(kept.flights.map((f) => f.flightNumber), ['6E 1'], '30 Sep 23:30 India time stays');
  assert.deepEqual(replaced.flights.map((f) => f.flightNumber), ['6E 2'], '1 Oct 02:00 India time is replaced, although it is still 30 Sep in UTC');
});
