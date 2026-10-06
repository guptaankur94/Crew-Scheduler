import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateCircadianPlan } from '../src/services/circadianCalculator';
import { computePeriodStats, periodContaining } from '../src/services/periodStats';
import type { CrewPreferences, RosterData } from '../src/types/circadian';

const prefs = { homeBaseIata: 'BLR', homeBaseTzOffset: 5.5, chronotype: 'intermediate', targetSleepHours: 7.5, caffeineCutoffHours: 6, groomingMinutes: 60, cabBufferMinutes: 60, crewRank: 'senior', currency: 'INR' } as CrewPreferences;
const empty: RosterData = { id: 'r', airline: 'IndiGo', homeBase: 'BLR', homeBaseTzOffset: 5.5, flights: [], layovers: [], parsedAt: '' };

test('with every roster removed, no day is a roster day: no days off, no totals (a blank slate)', () => {
  const plan = generateCircadianPlan(empty, prefs);
  assert.ok(plan.dailySummaries.length > 0, 'the usual rhythm is still planned');
  assert.ok(plan.dailySummaries.every((d) => d.outsideRoster), 'every day is "No roster"');
  const today = plan.dailySummaries[0].dateStr;
  const stats = computePeriodStats(plan, periodContaining(today));
  assert.equal(stats.rosterDays, 0);
  assert.equal(stats.daysOff, 0);
});

test('a roster with only days off and leave still counts those days as roster days', () => {
  const today = new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 10);
  const plan = generateCircadianPlan({ ...empty, otherDuties: [{ id: 'o', kind: 'off', date: today }, { id: 'l', kind: 'leave', date: today }] }, prefs);
  const day = plan.dailySummaries.find((d) => d.dateStr === today)!;
  assert.equal(day.outsideRoster, false);
});

test('the person’s usual bedtime and wake-up set the normal-night sleep (also after midnight)', () => {
  const night = (p: CrewPreferences) => generateCircadianPlan(empty, p).events.find((e) => e.type === 'anchor_sleep')!;
  const early = night({ ...prefs, usualBedtime: '22:00', usualWakeTime: '05:30', targetSleepHours: 7.5 });
  assert.deepEqual([early.startHbtStr, early.endHbtStr], ['22:00', '05:30']);
  const late = night({ ...prefs, usualBedtime: '00:30', usualWakeTime: '08:00', targetSleepHours: 7.5 });
  assert.deepEqual([late.startHbtStr, late.endHbtStr], ['00:30', '08:00']);
  const fallback = night(prefs);
  assert.deepEqual([fallback.startHbtStr, fallback.endHbtStr], ['23:00', '06:30'], 'without a set bedtime: the usual default');
});
