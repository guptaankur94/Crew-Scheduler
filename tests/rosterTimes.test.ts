import { test } from 'node:test';
import assert from 'node:assert/strict';
import { convertPrinted, rereadAsLocal, withConvention } from '../src/services/rosterTimes';
import { sanitizeParsedRoster } from '../server/rosterSanitizer';
import { fromDraft, toDraft } from '../src/components/RosterReviewDialog';
import { checkRosterFlights } from '../src/services/rosterChecks';
import type { FlightLeg } from '../src/types/circadian';

/*
 * Times are read exactly as printed and converted by the app. The real case: a Bangalore–Singapore
 * turnaround printed in each airport's local time (BLR 10:02 → SIN 17:33, SIN 19:48 → BLR 21:51).
 */

const hours = (c: { durationMinutes: number }) => Math.round((c.durationMinutes / 60) * 100) / 100;

test('printed local times: Singapore times are read in Singapore time', () => {
  const out = convertPrinted({ date: '2026-10-04', dep: '10:02', arr: '17:33' }, { origin: 'BLR', destination: 'SIN' }, 'local', 'BLR');
  const back = convertPrinted({ date: '2026-10-04', dep: '19:48', arr: '21:51' }, { origin: 'SIN', destination: 'BLR' }, 'local', 'BLR');
  assert.ok(!('error' in out) && !('error' in back));
  if ('error' in out || 'error' in back) return;
  assert.equal(out.durationMinutes, 301, '5h01');
  assert.equal(back.durationMinutes, 273, '4h33');
  assert.equal(out.departureTimeUtc, '2026-10-04T04:32:00.000Z');
  assert.equal(out.arrivalTimeUtc, '2026-10-04T09:33:00.000Z');
});

test('the same printed times read as home-base time or UTC give the other (stated) meanings', () => {
  const home = convertPrinted({ date: '2026-10-04', dep: '10:02', arr: '17:33' }, { origin: 'BLR', destination: 'SIN' }, 'home', 'BLR');
  const utc = convertPrinted({ date: '2026-10-04', dep: '04:32', arr: '09:33' }, { origin: 'BLR', destination: 'SIN' }, 'utc', 'BLR');
  assert.ok(!('error' in home) && home.durationMinutes === 451, 'all in India time: 7h31');
  assert.ok(!('error' in utc) && utc.departureTimeUtc === '2026-10-04T04:32:00.000Z');
});

test('arrival after midnight rolls to the next day; report and release follow the printed times', () => {
  const c = convertPrinted({ date: '2026-10-11', dep: '22:50', arr: '00:05', report: '21:50', release: '00:35' }, { origin: 'MAA', destination: 'PNQ' }, 'local', 'BLR');
  assert.ok(!('error' in c));
  if ('error' in c) return;
  assert.equal(c.durationMinutes, 75);
  assert.equal(c.reportTimeUtc, '2026-10-11T16:20:00.000Z');
  assert.equal(c.releaseTimeUtc, '2026-10-11T19:05:00.000Z');
});

test('the server reads printed times with the stated clock, or the crew setting when the roster does not say', () => {
  const now = new Date('2026-10-05T00:00:00Z');
  const payload = (timeConvention: string) => ({
    homeBase: 'BLR',
    timeConvention,
    flights: [{ flightNumber: '6E 1457', origin: 'BLR', destination: 'SIN', date: '2026-10-04', depTime: '10:02', arrTime: '17:33', reportTime: '09:05', releaseTime: '' }],
  });
  const local = sanitizeParsedRoster(payload('unknown'), now)!;
  assert.equal(local.timeConvention, 'local');
  assert.equal(local.timeConventionStated, false);
  assert.equal(local.flights[0].durationMinutes, 301);
  assert.deepEqual(local.flights[0].printed, { date: '2026-10-04', dep: '10:02', arr: '17:33', report: '09:05' });
  const stated = sanitizeParsedRoster(payload('home'), now)!;
  assert.equal(stated.timeConventionStated, true);
  assert.equal(stated.flights[0].durationMinutes, 451);
  const setting = sanitizeParsedRoster(payload('unknown'), now, { timeConvention: 'home' })!;
  assert.equal(setting.flights[0].durationMinutes, 451, 'the crew setting applies when the roster is silent');
});

test('changing the clock re-reads the same printed times; the time-zone warning goes away', () => {
  const now = new Date('2026-10-05T00:00:00Z');
  const read = sanitizeParsedRoster({
    homeBase: 'BLR',
    flights: [
      { flightNumber: '6E 1457', origin: 'BLR', destination: 'SIN', date: '2026-10-04', depTime: '10:02', arrTime: '17:33' },
      { flightNumber: '6E 1458', origin: 'SIN', destination: 'BLR', date: '2026-10-04', depTime: '19:48', arrTime: '21:51' },
    ],
  }, now, { timeConvention: 'home' })!;
  const asHome = read.flights.map((f) => fromDraft(toDraft(f, 'home', 'BLR'), 'home', 'BLR')!);
  assert.ok(checkRosterFlights(asHome).size > 0, 'read as India time: flagged');
  const asLocal = read.flights.map((f) => fromDraft(toDraft(f, 'home', 'BLR'), 'local', 'BLR')!);
  assert.deepEqual(asLocal.map((f) => f.durationMinutes), [301, 273]);
  assert.equal(checkRosterFlights(asLocal).size, 0, 'read as local time: nothing to check');
  assert.deepEqual(read.flights.map((f) => withConvention(f, 'local', 'BLR').durationMinutes), [301, 273]);
});

test('a flight saved before printed times were kept can be re-read as local time (the one-tap fix)', () => {
  // As stored on 5 Oct: Singapore times taken as India time
  const saved: FlightLeg = {
    id: 'a', flightNumber: '6E 1457', origin: 'BLR', destination: 'SIN',
    departureTimeUtc: '2026-10-04T04:32:00.000Z', arrivalTimeUtc: '2026-10-04T12:03:00.000Z',
    reportTimeUtc: '2026-10-04T03:35:00.000Z', releaseTimeUtc: '2026-10-04T16:51:00.000Z',
    originTzOffset: 5.5, destTzOffset: 8, durationMinutes: 451,
  };
  const fixed = rereadAsLocal(saved, 'BLR');
  assert.equal(fixed.durationMinutes, 301);
  assert.equal(fixed.arrivalTimeUtc, '2026-10-04T09:33:00.000Z');
  assert.equal(fixed.reportTimeUtc, saved.reportTimeUtc, 'report at Bangalore is unchanged');
});
