import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateCircadianPlan } from '../src/services/circadianCalculator';
import { getNowNext, nextLine, nowLine, plainTitle } from '../src/services/nowNext';
import type { CrewPreferences, FlightLeg } from '../src/types/circadian';

const prefs = {
  homeBaseIata: 'DEL', homeBaseTzOffset: 5.5, targetSleepHours: 7.5, caffeineCutoffHours: 6,
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

const plan = generateCircadianPlan(
  { id: 't', airline: 'T', homeBase: 'DEL', homeBaseTzOffset: 5.5, layovers: [], parsedAt: '', flights: [leg('a', '2026-10-12T05:15', '2026-10-12T07:30')] },
  prefs
);
const ist = (s: string) => Date.parse(`${s}:00+05:30`);

test('while asleep, Now is the sleep and Next is what follows it', () => {
  const r = getNowNext(plan, ist('2026-10-11T22:00'));
  assert.equal(r.now?.type, 'anchor_sleep');
  assert.equal(r.next?.type, 'pre_flight_prep');
  assert.equal(r.nextDuty?.flights.length, 1);
});

test('in the afternoon before an early duty, Next is the last caffeine time', () => {
  const r = getNowNext(plan, ist('2026-10-11T11:00'));
  assert.equal(r.next?.type, 'caffeine_cutoff');
  assert.equal(nextLine(r.next!), 'Last caffeine by 12:30');
});

test('on the flight, Now is the flight, not the overlapping caffeine or meal advice', () => {
  const r = getNowNext(plan, ist('2026-10-12T06:00'));
  assert.equal(r.now?.type, 'flight');
});

test('lines read plainly without emoji', () => {
  const sleep = plan.events.find((e) => e.type === 'anchor_sleep')!;
  assert.match(plainTitle(sleep), /^[A-Z]/);
  const cutoff = plan.events.find((e) => e.type === 'caffeine_cutoff')!;
  assert.equal(nowLine(cutoff), 'No more caffeine before your sleep');
});

test('after the last duty there is no next duty', () => {
  const r = getNowNext(plan, ist('2026-10-12T12:00'));
  assert.equal(r.nextDuty, undefined);
});
