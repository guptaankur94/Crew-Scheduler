import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateCircadianPlan } from '../src/services/circadianCalculator';
import { planReminders, MAX_SCHEDULED, ALARM_NOTE } from '../src/services/reminders';
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
    reportTimeUtc: new Date(dep - 60 * 60000).toISOString(), releaseTimeUtc: new Date(arr + 30 * 60000).toISOString(),
    originTzOffset: 5.5, destTzOffset: 5.5, durationMinutes: Math.round((arr - dep) / 60000),
  };
};
const roster: RosterData = {
  id: 'r', airline: 'T', homeBase: 'DEL', homeBaseTzOffset: 5.5, layovers: [], parsedAt: '', periodStart: '2026-10-01', periodEnd: '2026-10-10',
  flights: [leg('E1', '2026-10-05T07:15', '2026-10-05T09:15'), leg('E2', '2026-10-07T06:00', '2026-10-07T08:00')],
};
const plan = generateCircadianPlan(roster, prefs);
const now = Date.parse('2026-10-03T12:00:00+05:30');
const ist = (iso: string) => new Date(Date.parse(iso) + 5.5 * 3600000).toISOString().slice(0, 16).replace('T', ' ');

test('reminders are opt-in: nothing is scheduled until a kind is switched on', () => {
  assert.equal(planReminders(plan, {}, now).length, 0);
});

test('a wake alarm before each duty, at the planned wake-up, reminding that it should not be the only alarm', () => {
  const wakes = planReminders(plan, { wake: true }, now);
  assert.equal(wakes.length, 2);
  assert.equal(ist(wakes[0].atUtc), '2026-10-05 04:15', 'check-in 06:15 − travel 60 − getting ready 60');
  assert.ok(wakes.every((w) => w.alarm && w.body.includes(ALARM_NOTE)));
});

test('reminders never fall inside a planned sleep, and stay within the next week in time order', () => {
  const all = planReminders(plan, { wake: true, leave: true, bedtime: true, caffeine: true }, now);
  const sleeps = plan.events.filter((e) => ['anchor_sleep', 'recovery_sleep', 'nasa_nap'].includes(e.type));
  for (const r of all.filter((x) => x.kind !== 'wake')) {
    const at = Date.parse(r.atUtc);
    assert.ok(!sleeps.some((s) => at > Date.parse(s.startUtc) && at < Date.parse(s.endUtc)), `${r.title} at ${ist(r.atUtc)} is inside a sleep`);
  }
  assert.ok(all.every((r) => Date.parse(r.atUtc) > now && Date.parse(r.atUtc) <= now + 7 * 86400000));
  assert.deepEqual(all.map((r) => r.atUtc), [...all.map((r) => r.atUtc)].sort());
  assert.ok(all.length <= MAX_SCHEDULED);
  assert.ok(all.some((r) => r.kind === 'leave' && ist(r.atUtc) === '2026-10-05 05:05'), 'leave reminder 10 min before 05:15');
});

test('each reminder gets a stable phone ID, the same every time it is planned', async () => {
  const { reminderNumber } = await import('../src/services/nativeReminders');
  const ids = planReminders(plan, { wake: true, leave: true, bedtime: true, caffeine: true }, now).map((r) => reminderNumber(r.id));
  assert.equal(new Set(ids).size, ids.length, 'no two reminders share an ID');
  assert.equal(reminderNumber('wake-x'), reminderNumber('wake-x'));
  assert.ok(ids.every((n) => Number.isInteger(n) && n >= 0 && n < 2 ** 31));
});
