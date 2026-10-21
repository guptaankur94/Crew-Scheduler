import { test } from 'node:test';
import assert from 'node:assert/strict';
import { currentDutyActivity, SHOW_BEFORE_WAKE_HOURS } from '../src/services/liveActivity';
import { generateCircadianPlan } from '../src/services/circadianCalculator';
import type { CrewPreferences, FlightLeg, RosterData } from '../src/types/circadian';

const prefs: CrewPreferences = {
  airline: 'airline', homeBaseIata: 'DEL', homeBaseTzOffset: 5.5, chronotype: 'intermediate', targetSleepHours: 7.5,
  caffeineCutoffHours: 6, preferredNapDuration: 26, groomingMinutes: 60, cabBufferMinutes: 60, crewRank: 'senior', currency: 'INR',
};
const leg = (id: string, from: string, to: string, depIst: string, arrIst: string): FlightLeg => {
  const dep = Date.parse(`${depIst}:00+05:30`);
  const arr = Date.parse(`${arrIst}:00+05:30`);
  return { id, flightNumber: `6E ${id}`, origin: from, destination: to, departureTimeUtc: new Date(dep).toISOString(), arrivalTimeUtc: new Date(arr).toISOString(), reportTimeUtc: new Date(dep - 60 * 60000).toISOString(), releaseTimeUtc: new Date(arr + 30 * 60000).toISOString(), originTzOffset: 5.5, destTzOffset: 5.5, durationMinutes: Math.round((arr - dep) / 60000) };
};
const roster: RosterData = { id: 't', airline: 'T', homeBase: 'DEL', homeBaseTzOffset: 5.5, flights: [leg('101', 'DEL', 'BOM', '2026-10-10T07:00', '2026-10-10T09:00'), leg('102', 'BOM', 'DEL', '2026-10-10T10:00', '2026-10-10T12:00')], layovers: [], parsedAt: '' };
const plan = generateCircadianPlan(roster, prefs);
const ist = (s: string) => Date.parse(`${s}:00+05:30`);

test('the Live Activity shows from 3 h before wake-up to sign-off, counting down to the next step', () => {
  // Check-in 06:00, leave 05:00, wake 04:00, sign-off 12:30
  assert.equal(currentDutyActivity(plan, ist('2026-10-10T00:30')), null, 'too early');
  const early = currentDutyActivity(plan, ist(`2026-10-10T0${4 - SHOW_BEFORE_WAKE_HOURS}:30`))!;
  assert.deepEqual(early.steps.map((s) => `${s.label} ${s.time}`), ['Wake up 04:00', 'Leave home 05:00', 'Check-in 06:00', 'Departs 07:00', 'Sign-off 12:30']);
  assert.equal(early.headline, 'Wake up');
  const later = currentDutyActivity(plan, ist('2026-10-10T05:20'))!;
  assert.equal(later.headline, 'Check-in');
  assert.equal(later.targetMs, ist('2026-10-10T06:00'));
  assert.match(later.title, /6E 101.*\+ 1/);
  assert.equal(currentDutyActivity(plan, ist('2026-10-10T12:45')), null, 'ended after sign-off');
});
