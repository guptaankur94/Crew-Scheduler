import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateCircadianPlan } from '../src/services/circadianCalculator';
import type { CrewPreferences, FlightLeg, RosterData } from '../src/types/circadian';

/* After an early duty: an earlier, longer night, and at most a short optional nap that ends by 18:00 (NAP-03). */

const prefs: CrewPreferences = {
  airline: 'airline', homeBaseIata: 'DEL', homeBaseTzOffset: 5.5, chronotype: 'intermediate', targetSleepHours: 7.5,
  caffeineCutoffHours: 6, preferredNapDuration: 26, groomingMinutes: 60, cabBufferMinutes: 60, crewRank: 'senior', currency: 'INR',
};
const leg = (id: string, from: string, to: string, depIst: string, arrIst: string): FlightLeg => {
  const dep = Date.parse(`${depIst}:00+05:30`);
  const arr = Date.parse(`${arrIst}:00+05:30`);
  return {
    id, flightNumber: id.toUpperCase(), origin: from, destination: to,
    departureTimeUtc: new Date(dep).toISOString(), arrivalTimeUtc: new Date(arr).toISOString(),
    reportTimeUtc: new Date(dep - 75 * 60000).toISOString(), releaseTimeUtc: new Date(arr + 30 * 60000).toISOString(),
    originTzOffset: 5.5, destTzOffset: 5.5, durationMinutes: Math.round((arr - dep) / 60000),
  };
};
const roster = (flights: FlightLeg[]): RosterData => ({ id: 't', airline: 'T', homeBase: 'DEL', homeBaseTzOffset: 5.5, flights, layovers: [], parsedAt: '2026-10-01T00:00:00.000Z' });
const ist = (e: { startUtc: string }) => new Date(Date.parse(e.startUtc) + 5.5 * 3600000).toISOString().slice(11, 16);
const istEnd = (e: { endUtc: string }) => new Date(Date.parse(e.endUtc) + 5.5 * 3600000).toISOString().slice(11, 16);

test('report 05:00, home 17:00: optional 20-minute nap finished by 18:00, then bed at 21:30 instead of 23:00', () => {
  const plan = generateCircadianPlan(roster([leg('a', 'DEL', 'BOM', '2026-10-10T06:15', '2026-10-10T08:30'), leg('b', 'BOM', 'DEL', '2026-10-10T13:00', '2026-10-10T15:00')]), prefs);
  const nap = plan.events.find((e) => e.type === 'nasa_nap' && !e.id.startsWith('crew-rest-'));
  assert.ok(nap, 'a short nap is offered');
  assert.equal(ist(nap), '17:00');
  assert.equal(istEnd(nap), '17:20', '20 minutes, not an hour');
  assert.equal(nap.priority, 'optional');
  const night = plan.events.find((e) => e.type === 'anchor_sleep' && Date.parse(e.startUtc) > Date.parse(nap.endUtc));
  assert.ok(night);
  assert.equal(ist(night), '21:30', '1.5 h earlier than the usual 23:00');
  assert.equal(istEnd(night), '06:30', 'keeps the usual wake-up, so the night is longer');
  assert.match(night.subtitle, /Early night/);
  assert.equal(night.scientificCitation.ruleId, 'NAP-03');
});

test('home after 18:00 from an early duty: no nap, just the early night', () => {
  const plan = generateCircadianPlan(roster([leg('a', 'DEL', 'BOM', '2026-10-10T06:15', '2026-10-10T08:30'), leg('b', 'BOM', 'DEL', '2026-10-10T15:00', '2026-10-10T17:00')]), prefs);
  assert.ok(!plan.events.some((e) => e.type === 'nasa_nap' && !e.id.startsWith('crew-rest-')), 'no nap after 18:00');
  const night = plan.events.find((e) => e.type === 'anchor_sleep' && ist(e) === '21:30');
  assert.ok(night, 'early night at 21:30');
});

test('an early bedtime never goes before 21:00, even for someone who usually sleeps at 22:00', () => {
  const plan = generateCircadianPlan(roster([leg('a', 'DEL', 'BOM', '2026-10-10T06:15', '2026-10-10T08:30'), leg('b', 'BOM', 'DEL', '2026-10-10T13:00', '2026-10-10T15:00')]), { ...prefs, usualBedtime: '22:00' });
  assert.ok(plan.events.some((e) => e.type === 'anchor_sleep' && ist(e) === '21:00'));
});
