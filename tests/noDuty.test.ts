import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateCircadianPlan } from '../src/services/circadianCalculator';
import { computePeriodStats } from '../src/services/periodStats';
import { statusOf } from '../src/components/DateNavigator';
import type { CrewPreferences, FlightLeg, RosterData } from '../src/types/circadian';

const prefs = {
  homeBaseIata: 'DEL', homeBaseTzOffset: 5.5, chronotype: 'intermediate', targetSleepHours: 7.5, caffeineCutoffHours: 6,
  groomingMinutes: 60, cabBufferMinutes: 60, crewRank: 'senior', currency: 'INR',
} as CrewPreferences;

const leg = (id: string, depIst: string, arrIst: string): FlightLeg => {
  const dep = Date.parse(`${depIst}:00+05:30`);
  const arr = Date.parse(`${arrIst}:00+05:30`);
  return {
    id, flightNumber: id, origin: 'DEL', destination: 'BOM',
    departureTimeUtc: new Date(dep).toISOString(), arrivalTimeUtc: new Date(arr).toISOString(),
    reportTimeUtc: new Date(dep - 75 * 60000).toISOString(), releaseTimeUtc: new Date(arr + 30 * 60000).toISOString(),
    originTzOffset: 5.5, destTzOffset: 5.5, durationMinutes: Math.round((arr - dep) / 60000),
  };
};

test('a blank day inside the roster is "No duty"; a listed OFF stays a day off; a day an overnight duty ends on is neither', () => {
  const roster: RosterData = {
    id: 'r', airline: 'T', homeBase: 'DEL', homeBaseTzOffset: 5.5, layovers: [], parsedAt: '',
    flights: [leg('A1', '2026-10-02T08:00', '2026-10-02T10:00'), leg('N1', '2026-10-05T23:30', '2026-10-06T02:00')],
    otherDuties: [{ id: 'o1', kind: 'off', date: '2026-10-03', code: 'OFF' }],
    periodStart: '2026-10-01',
    periodEnd: '2026-10-07',
  };
  const plan = generateCircadianPlan(roster, prefs);
  const day = (d: string) => plan.dailySummaries.find((s) => s.dateStr === d)!;

  assert.equal(day('2026-10-03').noDuty, false, 'listed OFF');
  assert.equal(statusOf(day('2026-10-03'))?.label, 'Off');
  assert.equal(day('2026-10-04').noDuty, true, 'blank day');
  assert.equal(statusOf(day('2026-10-04'))?.label, 'No duty');
  assert.notEqual(day('2026-10-06').noDuty, true, 'overnight duty ends on this day');
  assert.equal(day('2026-10-02').noDuty, false, 'duty day');

  // Still counted with days off, and counted separately
  const stats = computePeriodStats(plan, { start: '2026-10-01', end: '2026-10-07' });
  assert.ok(stats.daysOff >= 2);
  assert.equal(stats.noDutyDays, plan.dailySummaries.filter((s) => s.dateStr <= '2026-10-07' && s.noDuty).length);
});
