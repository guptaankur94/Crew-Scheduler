import { test } from 'node:test';
import assert from 'node:assert/strict';
import { comparePlans } from '../src/services/planChanges';
import { effectiveRoster, setDelay } from '../src/services/userUpdates';
import { generateCircadianPlan } from '../src/services/circadianCalculator';
import type { CrewPreferences, FlightLeg, RosterData } from '../src/types/circadian';

const prefs = {
  homeBaseIata: 'BLR', homeBaseTzOffset: 5.5, chronotype: 'intermediate', targetSleepHours: 7.5, caffeineCutoffHours: 6,
  groomingMinutes: 60, cabBufferMinutes: 60, crewRank: 'senior', currency: 'INR',
} as CrewPreferences;
let n = 0;
const leg = (fn: string, from: string, to: string, depIst: string, minutes: number, reportLead = 60): FlightLeg => {
  const dep = Date.parse(`${depIst}:00+05:30`);
  return {
    id: `f${++n}`, flightNumber: fn, origin: from, destination: to,
    departureTimeUtc: new Date(dep).toISOString(), arrivalTimeUtc: new Date(dep + minutes * 60000).toISOString(),
    reportTimeUtc: new Date(dep - reportLead * 60000).toISOString(), releaseTimeUtc: new Date(dep + (minutes + 30) * 60000).toISOString(),
    originTzOffset: 5.5, destTzOffset: 5.5, durationMinutes: minutes,
  };
};
const roster = (flights: FlightLeg[]): RosterData => ({ id: 'r', airline: 'IndiGo', homeBase: 'BLR', homeBaseTzOffset: 5.5, flights, layovers: [], parsedAt: '' });
const plan = (r: RosterData) => generateCircadianPlan(r, prefs);
const NOW = Date.parse('2026-10-01T06:00:00+05:30');

test('nothing meaningful changed: no notice', () => {
  const r = roster([leg('6E 1', 'BLR', 'DEL', '2026-10-03T10:00', 160)]);
  assert.deepEqual(comparePlans(plan(r), plan(r), NOW), []);
});

test('a late-night delay moves the sleep after the duty', () => {
  const r = roster([leg('6E 408', 'BLR', 'PNQ', '2026-10-03T22:00', 90), leg('6E 391', 'PNQ', 'BLR', '2026-10-04T00:10', 100)]);
  const delayed = effectiveRoster(r, setDelay(r, [], r.flights[0].id, 90));
  const days = comparePlans(plan(r), plan(delayed), NOW);
  assert.ok(days.length > 0);
  assert.ok(days.some((d) => d.lines.some((l) => l.startsWith('Sleep '))), JSON.stringify(days));
});

test('an earlier report moves the wake-up alarm; a day duty becoming overnight is named', () => {
  const day = roster([leg('6E 1', 'BLR', 'DEL', '2026-10-03T10:00', 160)]);
  const early = roster([leg('6E 1', 'BLR', 'DEL', '2026-10-03T06:00', 160)]);
  const lines = comparePlans(plan(day), plan(early), NOW).flatMap((d) => d.lines);
  assert.ok(lines.some((l) => /^Wake-up alarm \d\d:\d\d → \d\d:\d\d$/.test(l)), lines.join(' | '));
  const night = roster([leg('6E 1', 'BLR', 'DEL', '2026-10-03T02:30', 160)]);
  const nightLines = comparePlans(plan(day), plan(night), NOW).flatMap((d) => d.lines);
  assert.ok(nightLines.some((l) => /^Now an overnight duty \(was /.test(l)), nightLines.join(' | '));
});

test('past days are not mentioned', () => {
  const r = roster([leg('6E 1', 'BLR', 'DEL', '2026-10-03T10:00', 160)]);
  const moved = roster([leg('6E 1', 'BLR', 'DEL', '2026-10-03T05:00', 160)]);
  assert.deepEqual(comparePlans(plan(r), plan(moved), Date.parse('2026-10-05T00:00:00+05:30')), []);
});
