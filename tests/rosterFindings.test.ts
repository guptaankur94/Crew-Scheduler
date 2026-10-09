import { test } from 'node:test';
import assert from 'node:assert/strict';
import { daySignature, findingsByDate } from '../src/services/rosterFindings';
import { checkDutyLimits } from '../src/services/dutyLimits';
import { rereadAsLocal } from '../src/services/rosterTimes';
import type { FlightLeg, RosterData } from '../src/types/circadian';

/* The Month screen's doubts per day, built from the real cases seen on a friend's roster. */

const sinPair = (): FlightLeg[] => [
  // Singapore times taken as India time when saved (7h31 out, 2h03 back)
  { id: 'out', flightNumber: '6E 1457', origin: 'BLR', destination: 'SIN', departureTimeUtc: '2026-10-04T04:32:00.000Z', arrivalTimeUtc: '2026-10-04T12:03:00.000Z', reportTimeUtc: '2026-10-04T03:35:00.000Z', releaseTimeUtc: '2026-10-04T12:33:00.000Z', originTzOffset: 5.5, destTzOffset: 8, durationMinutes: 451 },
  { id: 'back', flightNumber: '6E 1458', origin: 'SIN', destination: 'BLR', departureTimeUtc: '2026-10-04T14:18:00.000Z', arrivalTimeUtc: '2026-10-04T16:21:00.000Z', reportTimeUtc: '2026-10-04T13:18:00.000Z', releaseTimeUtc: '2026-10-04T16:51:00.000Z', originTzOffset: 8, destTzOffset: 5.5, durationMinutes: 123 },
];
const lateRelease = (): FlightLeg => ({ id: 'late', flightNumber: '6E 2187', origin: 'BBI', destination: 'DEL', departureTimeUtc: '2026-10-07T19:21:00.000Z', arrivalTimeUtc: '2026-10-07T21:53:00.000Z', reportTimeUtc: '2026-10-07T18:21:00.000Z', releaseTimeUtc: '2026-10-08T02:23:00.000Z', originTzOffset: 5.5, destTzOffset: 5.5, durationMinutes: 152 });
const roster = (flights: FlightLeg[], extra: Partial<RosterData> = {}): RosterData => ({ id: 'r', airline: 'IndiGo', homeBase: 'BLR', homeBaseTzOffset: 5.5, flights, layovers: [], parsedAt: '', ...extra });

test('a Singapore turnaround read in the wrong clock is flagged on its day, with a one-tap fix that clears it', () => {
  const r = roster(sinPair());
  const day = findingsByDate(r, null).get('2026-10-04')!;
  assert.equal(day.length, 1, 'one message for the pair, not one per flight');
  assert.match(day[0].message, /SIN times may be in the wrong time zone/);
  assert.deepEqual(day[0].fix, { kind: 'reread_local', airport: 'SIN', flightIds: ['out', 'back'] });
  const fixed = roster(r.flights.map((f) => rereadAsLocal(f, 'BLR')));
  assert.equal(findingsByDate(fixed, null).size, 0);
});

test('a release long after landing is flagged on the duty\'s day: its check-in day (23:51 on 7 Oct, departing 00:51 on 8 Oct)', () => {
  const day = findingsByDate(roster([lateRelease()]), null).get('2026-10-07');
  assert.match(day![0].message, /Released 270 min after landing/);
});

test('blank days are flagged only when the roster lists days off (so a blank day may be a missed entry)', () => {
  const flights = [lateRelease()];
  const cov = { from: '2026-10-06', to: '2026-10-09' };
  assert.equal([...findingsByDate(roster(flights), null, cov).values()].flat().filter((f) => f.kind === 'blank').length, 0, 'no OFF days listed: no noise');
  const listed = roster(flights, { otherDuties: [{ id: 'o', kind: 'off', date: '2026-10-06' }] });
  const blanks = [...findingsByDate(listed, null, cov).entries()].filter(([, l]) => l.some((f) => f.kind === 'blank')).map(([d]) => d);
  assert.deepEqual(blanks, ['2026-10-09'], '6 Oct off, 7 Oct duty (checks in 23:51), 8 Oct the same duty ends after midnight');
});

test('duty-limit findings appear on their day', () => {
  const dep = (d: string, h: string, min: number, id: string): FlightLeg => {
    const t = Date.parse(`${d}T${h}:00+05:30`);
    return { id, flightNumber: '6E 1', origin: 'BLR', destination: 'DEL', departureTimeUtc: new Date(t).toISOString(), arrivalTimeUtc: new Date(t + min * 60000).toISOString(), reportTimeUtc: new Date(t - 3600000).toISOString(), releaseTimeUtc: new Date(t + (min + 30) * 60000).toISOString(), originTzOffset: 5.5, destTzOffset: 5.5, durationMinutes: min };
  };
  const r = roster([dep('2026-10-05', '18:00', 120, 'a'), dep('2026-10-06', '08:00', 60, 'b')]);
  const day = findingsByDate(r, checkDutyLimits(r)).get('2026-10-06')!;
  assert.match(day[0].message, /Rest before duty too short \(Para 7\.1\)/);
});

test('a "looks right" tick is tied to the day as it was; any change to that day clears it', () => {
  const r = roster(sinPair());
  const sig = daySignature(r, '2026-10-04');
  assert.equal(daySignature(roster(sinPair()), '2026-10-04'), sig, 'same entries, same signature');
  const edited = roster(r.flights.map((f) => rereadAsLocal(f, 'BLR')));
  assert.notEqual(daySignature(edited, '2026-10-04'), sig);
  assert.equal(daySignature(r, '2026-10-05'), 'empty');
});
