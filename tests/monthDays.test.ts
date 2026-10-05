import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computePeriodStats, coverageNote, flightRangeNote } from '../src/services/periodStats';
import { monthDayRows } from '../src/services/monthDays';
import { generateCircadianPlan } from '../src/services/circadianCalculator';
import type { CrewPreferences, FlightLeg, RosterData } from '../src/types/circadian';

const prefs = {
  homeBaseIata: 'DEL', homeBaseTzOffset: 5.5, chronotype: 'intermediate', targetSleepHours: 7.5, caffeineCutoffHours: 6,
  groomingMinutes: 60, cabBufferMinutes: 60, crewRank: 'senior', currency: 'INR',
} as CrewPreferences;

const leg = (id: string, from: string, to: string, depIst: string, arrIst: string, extra: Partial<FlightLeg> = {}): FlightLeg => {
  const dep = Date.parse(`${depIst}:00+05:30`);
  const arr = Date.parse(`${arrIst}:00+05:30`);
  return {
    id, flightNumber: id, origin: from, destination: to,
    departureTimeUtc: new Date(dep).toISOString(), arrivalTimeUtc: new Date(arr).toISOString(),
    reportTimeUtc: new Date(dep - 75 * 60000).toISOString(), releaseTimeUtc: new Date(arr + 30 * 60000).toISOString(),
    originTzOffset: 5.5, destTzOffset: 5.5, durationMinutes: Math.round((arr - dep) / 60000), ...extra,
  };
};
const roster = (flights: FlightLeg[], extra: Partial<RosterData> = {}): RosterData => ({
  id: 'r', airline: 'T', homeBase: 'DEL', homeBaseTzOffset: 5.5, flights, layovers: [], parsedAt: '', ...extra,
});
const OCT = { start: '2026-10-01', end: '2026-10-31' };

test('day rows show report, route, release (next day marked) and the disruption tag in home time', () => {
  const r = roster(
    [
      leg('A1', 'DEL', 'BOM', '2026-10-10T06:30', '2026-10-10T08:45'),
      leg('A2', 'BOM', 'DEL', '2026-10-10T09:45', '2026-10-10T12:00', { isPositioning: true }),
      leg('B1', 'DEL', 'BLR', '2026-10-12T22:00', '2026-10-13T00:45'),
    ],
    {
      standbyDuties: [{ id: 'sb1', kind: 'home', airport: 'DEL', startUtc: '2026-10-15T00:30:00.000Z', endUtc: '2026-10-15T08:30:00.000Z' }],
      otherDuties: [{ id: 'o1', kind: 'leave', date: '2026-10-20', code: 'AL' }],
      periodStart: '2026-10-01',
      periodEnd: '2026-10-31',
    }
  );
  const plan = generateCircadianPlan(r, prefs);
  const stats = computePeriodStats(plan, OCT);
  const rows = monthDayRows(plan, stats);
  assert.equal(rows.length, 31);
  const byDate = new Map(rows.map((row) => [row.dateStr, row]));

  const early = byDate.get('2026-10-10')!;
  assert.equal(early.report, '05:15');
  assert.equal(early.release, '12:30');
  assert.equal(early.releaseDayOffset, 0);
  assert.deepEqual(early.legs.map((l) => [l.label, l.positioning]), [['DEL→BOM', false], ['BOM→DEL', true]]);
  assert.equal(early.disruption, 'early');

  const late = byDate.get('2026-10-12')!;
  assert.equal(late.release, '01:15');
  assert.equal(late.releaseDayOffset, 1);
  assert.equal(late.disruption, 'late');

  const sb = byDate.get('2026-10-15')!;
  assert.deepEqual(sb.standby, { start: '06:00', end: '14:00', kind: 'home' });
  assert.equal(sb.legs.length, 0);

  assert.equal(byDate.get('2026-10-20')!.code, 'AL');
  assert.equal(byDate.get('2026-10-21')!.legs.length, 0);
});

test('summary notes say which days and flights the figures come from', () => {
  const plan = generateCircadianPlan(roster([leg('A1', 'DEL', 'BOM', '2026-10-10T10:00', '2026-10-10T12:00')], { periodStart: '2026-10-01', periodEnd: '2026-10-31' }), prefs);
  const stats = computePeriodStats(plan, OCT);
  assert.equal(coverageNote(stats), 'Covers the full month from your roster');
  assert.match(flightRangeNote(stats), /^Flights departing 10 Oct/);
  const empty = computePeriodStats(plan, { start: '2027-03-01', end: '2027-03-31' });
  assert.equal(coverageNote(empty), 'No roster for this month');
  assert.equal(flightRangeNote(empty), 'No flights this month');
});

test('layovers are split into international and domestic by country; unknown airports are not guessed', () => {
  const r = roster([
    leg('D1', 'DEL', 'BOM', '2026-10-03T10:00', '2026-10-03T12:00'),
    leg('D2', 'BOM', 'DEL', '2026-10-04T10:00', '2026-10-04T12:00'),
    leg('I1', 'DEL', 'SIN', '2026-10-06T10:00', '2026-10-06T16:00', { destTzOffset: 8 }),
    leg('I2', 'SIN', 'DEL', '2026-10-07T18:00', '2026-10-07T21:30', { originTzOffset: 8 }),
    leg('U1', 'DEL', 'ZZZ', '2026-10-10T10:00', '2026-10-10T12:00'),
    leg('U2', 'ZZZ', 'DEL', '2026-10-11T10:00', '2026-10-11T12:00'),
  ], {
    standbyDuties: [
      { id: 'h1', kind: 'home', airport: 'DEL', startUtc: '2026-10-15T00:30:00.000Z', endUtc: '2026-10-15T08:30:00.000Z' },
      { id: 'a1', kind: 'airport', airport: 'DEL', startUtc: '2026-10-16T00:30:00.000Z', endUtc: '2026-10-16T04:30:00.000Z' },
    ],
  });
  const stats = computePeriodStats(generateCircadianPlan(r, prefs), OCT);
  assert.deepEqual(
    { ...stats.layovers },
    { total: 3, international: 1, domestic: 1, unverified: 1, internationalStations: ['SIN'], domesticStations: ['BOM'] }
  );
  assert.deepEqual(stats.standbyDaysByKind, { home: 1, airport: 1 });
  assert.equal(stats.standbyDays, 2);
});

test('a layover at an airport from the larger database is still domestic (country codes, not names)', () => {
  const r = roster([leg('R1', 'DEL', 'RDP', '2026-10-03T10:00', '2026-10-03T12:00'), leg('R2', 'RDP', 'DEL', '2026-10-04T10:00', '2026-10-04T12:00')]);
  const stats = computePeriodStats(generateCircadianPlan(r, prefs), OCT);
  assert.equal(stats.layovers.domestic, 1);
  assert.equal(stats.layovers.international, 0);
});
