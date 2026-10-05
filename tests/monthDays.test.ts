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
