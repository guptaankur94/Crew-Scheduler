import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calendarEntries, entriesSignature, CALENDAR_DAYS } from '../src/services/calendarSync';
import { generateCircadianPlan } from '../src/services/circadianCalculator';
import { getPresets } from '../src/data/rosterPresets';

/* "Keep my phone calendar updated": what goes into the CrewCircadian calendar. */

const preset = getPresets()[0];
const plan = generateCircadianPlan(preset.roster, {
  airline: 'airline', homeBaseIata: preset.roster.homeBase, homeBaseTzOffset: preset.roster.homeBaseTzOffset, chronotype: 'intermediate',
  targetSleepHours: 7.5, caffeineCutoffHours: 6, preferredNapDuration: 26, groomingMinutes: 60, cabBufferMinutes: 60, crewRank: 'senior', currency: 'INR',
});
const now = Date.parse(plan.roster.flights[0].departureTimeUtc) - 2 * 24 * 3600000;

test('the calendar gets duties, getting ready, standby and sleep only, within the next 30 days', () => {
  const entries = calendarEntries(plan, now);
  assert.ok(entries.length > 0);
  const kinds = new Set(entries.map((e) => plan.events.find((p) => p.id === e.key)!.type));
  for (const k of kinds) assert.ok(['flight', 'pre_flight_prep', 'standby', 'anchor_sleep', 'recovery_sleep', 'nasa_nap'].includes(k), k);
  assert.ok(kinds.has('flight') && kinds.has('anchor_sleep'));
  assert.ok(entries.every((e) => e.endMs > e.startMs && e.startMs < now + CALENDAR_DAYS * 24 * 3600000));
  assert.ok(!entries.some((e) => e.key.startsWith('crew-rest-')), 'in-flight crew-rest naps stay in the app');
});

test('the same plan gives the same signature (no rewrite); a change gives a new one', () => {
  const a = calendarEntries(plan, now);
  assert.equal(entriesSignature(a), entriesSignature(calendarEntries(plan, now)));
  assert.notEqual(entriesSignature(a), entriesSignature(a.slice(1)));
});
