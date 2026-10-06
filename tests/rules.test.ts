import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';
import { CITATIONS, generateCircadianPlan } from '../src/services/circadianCalculator';
import { caffeineCutoffHoursFor } from '../src/services/planEngine';
import { generateIcsFile } from '../src/services/icsExport';
import type { CrewPreferences, FlightLeg, RosterData } from '../src/types/circadian';

const prefs = {
  homeBaseIata: 'DEL', homeBaseTzOffset: 5.5, chronotype: 'intermediate', targetSleepHours: 7.5, caffeineCutoffHours: 6,
  groomingMinutes: 60, cabBufferMinutes: 60, crewRank: 'senior', currency: 'INR',
} as CrewPreferences;

const leg = (id: string, depIst: string, arrIst: string, from = 'DEL', to = 'BOM'): FlightLeg => {
  const dep = Date.parse(`${depIst}:00+05:30`);
  const arr = Date.parse(`${arrIst}:00+05:30`);
  return {
    id, flightNumber: id, origin: from, destination: to,
    departureTimeUtc: new Date(dep).toISOString(), arrivalTimeUtc: new Date(arr).toISOString(),
    reportTimeUtc: new Date(dep - 60 * 60000).toISOString(), releaseTimeUtc: new Date(arr + 30 * 60000).toISOString(),
    originTzOffset: 5.5, destTzOffset: 5.5, durationMinutes: Math.round((arr - dep) / 60000),
  };
};
const roster = (flights: FlightLeg[], extra: Partial<RosterData> = {}): RosterData => ({
  id: 'r', airline: 'T', homeBase: 'DEL', homeBaseTzOffset: 5.5, flights, layovers: [], parsedAt: '', periodStart: '2026-10-01', periodEnd: '2026-10-10', ...extra,
});
const ist = (iso: string) => new Date(Date.parse(iso) + 5.5 * 3600000).toISOString().slice(0, 16).replace('T', ' ');

test('every rule has a unique ID and an evidence grade, and the rule book lists it', () => {
  const book = readFileSync('docs/RULE_BOOK.md', 'utf8');
  const ids = Object.values(CITATIONS).map((c) => c.ruleId);
  assert.equal(new Set(ids).size, ids.length, 'rule IDs are unique');
  for (const c of Object.values(CITATIONS)) {
    assert.match(c.ruleId, /^[A-Z]+-\d{2}$/);
    assert.ok(['strong', 'moderate', 'limited', 'practical', 'regulation'].includes(c.evidence), c.ruleId);
    assert.ok(book.includes(`| ${c.ruleId} |`) && book.includes(c.keyFinding), `${c.ruleId} is in docs/RULE_BOOK.md and up to date (npm run rulebook)`);
  }
});

test('caffeine cut-off follows the usual dose, and is 2 hours earlier before a daytime sleep', () => {
  assert.equal(caffeineCutoffHoursFor({ caffeineDose: 'light', caffeineCutoffHours: 6 }, 23), 6);
  assert.equal(caffeineCutoffHoursFor({ caffeineDose: 'moderate', caffeineCutoffHours: 6 }, 23), 8);
  assert.equal(caffeineCutoffHoursFor({ caffeineDose: 'strong', caffeineCutoffHours: 6 }, 23), 12);
  assert.equal(caffeineCutoffHoursFor({ caffeineDose: 'light', caffeineCutoffHours: 6 }, 9), 8, 'daytime sleep');
  // Saved settings from before the dose choice keep working
  assert.equal(caffeineCutoffHoursFor({ caffeineCutoffHours: 8 }, 23), 8);

  const plan = generateCircadianPlan(roster([leg('A1', '2026-10-03T08:00', '2026-10-03T10:00')]), { ...prefs, caffeineDose: 'strong' });
  const night = plan.events.find((e) => e.type === 'caffeine_cutoff' && ist(e.endUtc).endsWith('23:00'));
  assert.ok(night, 'a cut-off before a 23:00 sleep');
  assert.equal(ist(night!.startUtc).slice(11), '11:00', '12 h before');
});

test('alcohol: none in the 12 hours before check-in, shown on the duty day', () => {
  const plan = generateCircadianPlan(roster([leg('E1', '2026-10-05T07:15', '2026-10-05T09:15')]), prefs);
  const alcohol = plan.events.filter((e) => e.type === 'alcohol_cutoff');
  assert.equal(alcohol.length, 1);
  assert.equal(ist(alcohol[0].endUtc), '2026-10-05 06:15', 'ends at check-in');
  assert.equal(ist(alcohol[0].startUtc), '2026-10-04 18:15', 'starts 12 h before');
  assert.equal(alcohol[0].dutyDate, '2026-10-05');
  assert.match(alcohol[0].title, /18:15 the day before/);
  // In the app, not in the calendar export
  const ics = generateIcsFile(plan);
  assert.ok(!ics.includes('No alcohol') && !ics.includes('hard workouts'));
});

test('hard exercise: finish 4 hours before a night sleep, but no note before sleep after a night duty', () => {
  const plan = generateCircadianPlan(roster([leg('N1', '2026-10-06T01:00', '2026-10-06T03:00', 'DEL', 'BOM'), leg('N2', '2026-10-06T04:00', '2026-10-06T06:00', 'BOM', 'DEL')]), prefs);
  const exercise = plan.events.filter((e) => e.type === 'exercise_cutoff');
  assert.ok(exercise.length > 0);
  for (const e of exercise) {
    assert.equal(Date.parse(e.endUtc) - Date.parse(e.startUtc), 4 * 3600000);
    const sleep = plan.events.find((s) => s.startUtc === e.endUtc && (s.type === 'anchor_sleep' || s.type === 'recovery_sleep'));
    assert.ok(sleep, 'ends when a sleep starts');
    assert.notEqual(sleep!.type, 'recovery_sleep', 'not before sleep after a night duty');
  }
});
