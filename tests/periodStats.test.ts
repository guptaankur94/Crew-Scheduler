import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computePeriodStats, defaultPeriod, periodContaining, periodLabel, shiftPeriod } from '../src/services/periodStats';
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

test('calendar months and pay cycles', () => {
  assert.deepEqual(periodContaining('2026-10-15'), { start: '2026-10-01', end: '2026-10-31' });
  assert.deepEqual(periodContaining('2026-02-10'), { start: '2026-02-01', end: '2026-02-28' });
  assert.deepEqual(periodContaining('2026-10-15', 21), { start: '2026-09-21', end: '2026-10-20' });
  assert.deepEqual(periodContaining('2026-10-25', 21), { start: '2026-10-21', end: '2026-11-20' });
  assert.deepEqual(periodContaining('2026-01-05', 21), { start: '2025-12-21', end: '2026-01-20' }, 'across a year boundary');
  assert.deepEqual(shiftPeriod({ start: '2026-12-01', end: '2026-12-31' }, 1), { start: '2027-01-01', end: '2027-01-31' });
  assert.deepEqual(shiftPeriod({ start: '2026-09-21', end: '2026-10-20' }, -1, 21), { start: '2026-08-21', end: '2026-09-20' });
  assert.equal(periodLabel({ start: '2026-10-01', end: '2026-10-31' }), 'October 2026');
  assert.equal(periodLabel({ start: '2026-09-21', end: '2026-10-20' }), '21 Sept – 20 Oct 2026'.replace('Sept', new Date('2026-09-21T12:00:00Z').toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' })));
});

test('a two-month roster is split by month; the totals add up to the whole roster', () => {
  const r = roster([
    leg('s1', 'DEL', 'BOM', '2026-09-10T10:00', '2026-09-10T12:00'),
    leg('s2', 'BOM', 'DEL', '2026-09-10T13:30', '2026-09-10T15:30'),
    leg('o1', 'DEL', 'BLR', '2026-10-05T10:00', '2026-10-05T12:45'),
  ]);
  const plan = generateCircadianPlan(r, prefs);
  const sep = computePeriodStats(plan, { start: '2026-09-01', end: '2026-09-30' });
  const oct = computePeriodStats(plan, { start: '2026-10-01', end: '2026-10-31' });
  assert.equal(sep.sectors, 2);
  assert.equal(sep.flyingHours, 4);
  assert.equal(oct.sectors, 1);
  assert.equal(oct.flyingHours, 2.8);
  assert.equal(sep.flyingHours + oct.flyingHours, plan.monthlyStats.totalFlightHours);
  // Base pay is counted once per period, not once for the whole roster
  assert.equal(sep.salary.baseFixedPay, oct.salary.baseFixedPay);
  assert.equal(oct.salary.periodLabel, 'October 2026');
});

test('a red-eye crossing midnight at month end counts in the month it departs', () => {
  const plan = generateCircadianPlan(roster([leg('re', 'DEL', 'BOM', '2026-10-31T23:30', '2026-11-01T01:45')]), prefs);
  assert.equal(computePeriodStats(plan, { start: '2026-10-01', end: '2026-10-31' }).sectors, 1);
  assert.equal(computePeriodStats(plan, { start: '2026-11-01', end: '2026-11-30' }).sectors, 0);
});

test('a custom range and a pay cycle count only their own days', () => {
  const plan = generateCircadianPlan(
    roster([
      leg('a', 'DEL', 'BOM', '2026-09-19T10:00', '2026-09-19T12:00'),
      leg('b', 'DEL', 'BOM', '2026-09-22T10:00', '2026-09-22T12:00'),
      leg('c', 'DEL', 'BOM', '2026-10-20T10:00', '2026-10-20T12:00'),
      leg('d', 'DEL', 'BOM', '2026-10-21T10:00', '2026-10-21T12:00'),
    ]),
    prefs
  );
  assert.equal(computePeriodStats(plan, periodContaining('2026-10-01', 21)).sectors, 2, 'b and c fall in 21 Sep – 20 Oct');
  assert.equal(computePeriodStats(plan, { start: '2026-09-19', end: '2026-09-22' }).sectors, 2);
});

test('standby and positioning are counted per period', () => {
  const plan = generateCircadianPlan(
    roster([leg('w', 'DEL', 'BOM', '2026-10-05T10:00', '2026-10-05T12:00'), leg('p', 'BOM', 'DEL', '2026-10-05T13:30', '2026-10-05T15:30', { isPositioning: true })], {
      standbyDuties: [
        { id: 's1', kind: 'home', airport: 'DEL', startUtc: '2026-09-30T00:30:00.000Z', endUtc: '2026-09-30T08:30:00.000Z' },
        { id: 's2', kind: 'home', airport: 'DEL', startUtc: '2026-10-07T00:30:00.000Z', endUtc: '2026-10-07T06:30:00.000Z' },
      ],
    }),
    prefs
  );
  const oct = computePeriodStats(plan, { start: '2026-10-01', end: '2026-10-31' });
  assert.equal(oct.flyingHours, 2, 'positioning is not flying time');
  assert.equal(oct.sectors, 1, 'positioning is not a worked sector');
  assert.equal(oct.positioningSectors, 1);
  assert.equal(oct.standbyHours, 6);
  assert.equal(oct.salary.standbyHours, 6);
});

test('default period: the one with today, or the latest one with flights', () => {
  const plan = generateCircadianPlan(roster([leg('s', 'DEL', 'BOM', '2026-09-10T10:00', '2026-09-10T12:00')]), prefs);
  assert.deepEqual(defaultPeriod(plan.dailySummaries, '2026-11-15'), { start: '2026-09-01', end: '2026-09-30' });
  assert.deepEqual(defaultPeriod(plan.dailySummaries, '2026-09-20'), { start: '2026-09-01', end: '2026-09-30' });
});

import { shortRange } from '../src/services/periodStats';

test('coverage dates say exactly which days were counted', () => {
  const plan = generateCircadianPlan(
    roster([leg('a', 'DEL', 'BOM', '2026-10-02T10:00', '2026-10-02T12:00'), leg('b', 'DEL', 'BOM', '2026-10-21T10:00', '2026-10-21T12:00')]),
    prefs
  );
  const oct = computePeriodStats(plan, { start: '2026-10-01', end: '2026-10-31' });
  assert.equal(oct.flightsFrom, '2026-10-02');
  assert.equal(oct.flightsTo, '2026-10-21');
  assert.equal(oct.rosterFrom, '2026-10-02');
  assert.equal(oct.rosterTo, '2026-10-21', 'coverage ends on the last day the roster lists');
  assert.equal(oct.days, 31);
  const oct5 = new Date('2026-10-05T12:00:00Z').toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' });
  assert.equal(shortRange('2026-10-01', '2026-10-21'), `1–21 ${oct5}`);
  assert.equal(shortRange('2026-10-21', '2026-10-21'), `21 ${oct5}`);
});

import { monthNarrative } from '../src/services/periodStats';

const octMonth = { start: '2026-10-01', end: '2026-10-31' };

test('sick, leave and training days are not counted as days off; the longest break is found', () => {
  const plan = generateCircadianPlan(
    roster([leg('a', 'DEL', 'BOM', '2026-10-01T10:00', '2026-10-01T12:00'), leg('b', 'DEL', 'BOM', '2026-10-10T10:00', '2026-10-10T12:00')], {
      periodStart: '2026-10-01',
      periodEnd: '2026-10-10',
      otherDuties: [
        { id: 'o1', kind: 'off', date: '2026-10-02' },
        { id: 's', kind: 'sick', date: '2026-10-05' },
        { id: 'l', kind: 'leave', date: '2026-10-06' },
        { id: 't', kind: 'training', date: '2026-10-07' },
      ],
    }),
    prefs
  );
  const s = computePeriodStats(plan, octMonth);
  assert.equal(s.rosterTo, '2026-10-10', 'stated roster period is used');
  // 1 Oct–10 Oct: duty on 1 and 10; sick 5, leave 6, training 7; off: 2, 3, 4, 8, 9
  assert.equal(s.dutyDays, 2);
  assert.equal(s.sickDays, 1);
  assert.equal(s.leaveDays, 1);
  assert.equal(s.trainingDays, 1);
  assert.equal(s.daysOff, 5);
  assert.deepEqual(s.longestBreak, { days: 3, from: '2026-10-02', to: '2026-10-04' });
});

test('sleep-disrupting duties use the EASA bands, counting each duty once', () => {
  const plan = generateCircadianPlan(
    roster([
      leg('early', 'DEL', 'BOM', '2026-10-02T06:30', '2026-10-02T08:45'), // report 05:15 → early start
      leg('night', 'DEL', 'BOM', '2026-10-04T03:30', '2026-10-04T05:45'), // report 02:15 → overnight (not also early)
      leg('late', 'DEL', 'BOM', '2026-10-06T21:00', '2026-10-06T23:15'), // release 23:45 → late finish
      leg('day', 'DEL', 'BOM', '2026-10-08T10:00', '2026-10-08T12:00'), // not disruptive
      leg('seven', 'DEL', 'BOM', '2026-10-10T08:20', '2026-10-10T10:30'), // report 07:05 → not early
    ]),
    prefs
  );
  const s = computePeriodStats(plan, octMonth);
  assert.deepEqual(
    { total: s.disruptive.total, early: s.disruptive.early, overnight: s.disruptive.overnight, late: s.disruptive.late, of: s.disruptive.ofDuties },
    { total: 3, early: 1, overnight: 1, late: 1, of: 5 }
  );
});

test('time-zone trips, standby days, duty hours and the longest run of duty days', () => {
  const plan = generateCircadianPlan(
    roster(
      [
        leg('d1', 'DEL', 'BOM', '2026-10-01T10:00', '2026-10-01T12:00'),
        leg('d2', 'DEL', 'BOM', '2026-10-02T10:00', '2026-10-02T12:00'),
        leg('d3', 'DEL', 'BOM', '2026-10-03T10:00', '2026-10-03T12:00'),
        { ...leg('lhr', 'DEL', 'LHR', '2026-10-06T02:00', '2026-10-06T11:00'), destTzOffset: 1 },
      ],
      { standbyDuties: [{ id: 's1', kind: 'home', airport: 'DEL', startUtc: '2026-10-09T00:30:00.000Z', endUtc: '2026-10-09T08:30:00.000Z' }] }
    ),
    prefs
  );
  const s = computePeriodStats(plan, octMonth);
  assert.equal(s.timeZoneTrips, 1, 'London is 4.5 hours from Delhi');
  assert.equal(s.standbyDays, 1);
  assert.deepEqual(s.longestRun, { days: 3, from: '2026-10-01', to: '2026-10-03' });
  assert.equal(s.longestDuty?.date, '2026-10-06');
  assert.ok(s.dutyHours > 16);
});

test('the month sentence states counts and dates only', () => {
  const plan = generateCircadianPlan(
    roster([
      leg('e1', 'DEL', 'BOM', '2026-10-02T06:30', '2026-10-02T08:45'),
      leg('e2', 'DEL', 'BOM', '2026-10-04T06:30', '2026-10-04T08:45'),
      leg('e3', 'DEL', 'BOM', '2026-10-06T06:30', '2026-10-06T08:45'),
      leg('n1', 'DEL', 'BOM', '2026-10-08T03:30', '2026-10-08T05:45'),
      leg('d', 'DEL', 'BOM', '2026-10-20T10:00', '2026-10-20T12:00'),
    ]),
    prefs
  );
  const s = computePeriodStats(plan, octMonth);
  assert.match(monthNarrative(s), /^This month has 3 early starts and 1 overnight duty, mostly in the first half\. Your longest break is \d+ days in a row \(/);
  const empty = generateCircadianPlan(roster([leg('x', 'DEL', 'BOM', '2026-09-10T10:00', '2026-09-10T12:00')]), prefs);
  assert.equal(monthNarrative(computePeriodStats(empty, octMonth)), 'No roster for this month yet.');
});
