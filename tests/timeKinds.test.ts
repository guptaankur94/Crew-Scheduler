import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readMarkedTime, sanitizeParsedRoster } from '../server/rosterSanitizer';
import { generateCircadianPlan } from '../src/services/circadianCalculator';
import { computePeriodStats, hoursMinutes } from '../src/services/periodStats';
import { hoursReport } from '../src/services/hoursReport';
import type { CrewPreferences } from '../src/types/circadian';

test('roster time markers: A = actual (flown), E = estimated, +1 = next day', () => {
  assert.deepEqual(readMarkedTime('A0007'), { clock: '00:07', kind: 'actual' });
  assert.deepEqual(readMarkedTime('E0335'), { clock: '03:35', kind: 'estimated' });
  assert.deepEqual(readMarkedTime('0205+1'), { clock: '02:05', kind: undefined });
  assert.deepEqual(readMarkedTime('A0356+1'), { clock: '03:56', kind: 'actual' });
  assert.equal(readMarkedTime('07:15').clock, '07:15');
});

test('hours are shown as hours:minutes, the airline way', () => {
  assert.equal(hoursMinutes(2790), '46:30');
  assert.equal(hoursMinutes(2773), '46:13');
  assert.equal(hoursMinutes(65), '1:05');
});

test('flown (actual) and still-scheduled flying are told apart, from the roster markers', () => {
  const now = new Date('2026-10-07T18:00:00Z');
  const parsed = sanitizeParsedRoster(
    {
      homeBase: 'BLR',
      timeConvention: 'home',
      timeConventionStated: true,
      flights: [
        { flightNumber: '6E 836', origin: 'BLR', destination: 'DEL', date: '2026-10-03', depTime: 'A0456', arrTime: 'A0735', reportTime: '0405', releaseTime: '0805' },
        { flightNumber: '6E 839', origin: 'BLR', destination: 'DEL', date: '2026-10-08', depTime: '0100', arrTime: '0335', arrKind: 'estimated', reportTime: '0000', releaseTime: '0405' },
        { flightNumber: '6E 810', origin: 'DEL', destination: 'BLR', date: '2026-10-09', depTime: '0705', arrTime: '1000', reportTime: '0605', releaseTime: '1030' },
      ],
    },
    now
  )!;
  assert.equal(parsed.flights.length, 3, 'a marked time no longer drops the flight');
  assert.deepEqual(parsed.flights[0].timeKinds, { dep: 'actual', arr: 'actual' });
  assert.deepEqual(parsed.flights[1].timeKinds, { dep: undefined, arr: 'estimated' });
  const roster = { id: 'r', airline: 'IndiGo', homeBase: 'BLR', homeBaseTzOffset: 5.5, layovers: [], parsedAt: '', flights: parsed.flights, periodStart: '2026-10-01', periodEnd: '2026-10-21' };
  const plan = generateCircadianPlan(roster, { homeBaseIata: 'BLR', homeBaseTzOffset: 5.5, targetSleepHours: 7.5, caffeineCutoffHours: 6, groomingMinutes: 60, cabBufferMinutes: 60 } as CrewPreferences);
  const oct = { start: '2026-10-01', end: '2026-10-31' };
  const stats = computePeriodStats(plan, oct);
  assert.equal(stats.flyingMinutes, 159 + 155 + 175);
  assert.deepEqual(stats.flown, { actualMinutes: 159, otherMinutes: 330 });
  const report = hoursReport(plan, oct);
  assert.equal(report.totals.flownMinutes, 159);
  assert.deepEqual(report.rows.map((r) => r.times), ['actual', 'estimated', 'scheduled']);
});

test('"+1" on the arrival but not the departure (date left on the listed day) is corrected, not dropped', () => {
  const parsed = sanitizeParsedRoster(
    {
      homeBase: 'BLR',
      timeConvention: 'home',
      timeConventionStated: true,
      // Listed under 01: check-in 22:20, departs A0007+1, lands A0356+1. The reader kept date 01 but set arrDate 02.
      flights: [{ flightNumber: '6E 1486', origin: 'DXB', destination: 'BLR', date: '2026-10-01', depTime: '00:07', arrTime: '03:56', arrDate: '2026-10-02', reportTime: '22:20', releaseTime: '04:56', depKind: 'actual', arrKind: 'actual' }],
    },
    new Date('2026-10-07T18:00:00Z')
  )!;
  assert.equal(parsed.flights.length, 1);
  const f = parsed.flights[0];
  assert.equal(f.durationMinutes, 229, '3h49, not 27h49');
  assert.equal(f.departureTimeUtc, new Date('2026-10-02T00:07:00+05:30').toISOString());
  assert.equal(f.reportTimeUtc, new Date('2026-10-01T22:20:00+05:30').toISOString(), 'check-in the evening before');
});
