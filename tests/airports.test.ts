import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getAirportTzOffset, airportLocalToUtc, tzOffsetHoursAt, lookupAirport, isKnownAirport } from '../src/data/airports';

test('London offset follows daylight saving', () => {
  assert.equal(getAirportTzOffset('LHR', '2026-07-01T12:00:00Z'), 1);
  assert.equal(getAirportTzOffset('LHR', '2026-01-15T12:00:00Z'), 0);
});

test('New York offset follows daylight saving', () => {
  assert.equal(getAirportTzOffset('JFK', '2026-07-01T12:00:00Z'), -4);
  assert.equal(getAirportTzOffset('JFK', '2026-01-15T12:00:00Z'), -5);
});

test('Sydney (southern hemisphere) is ahead in January', () => {
  assert.equal(getAirportTzOffset('SYD', '2026-01-15T12:00:00Z'), 11);
  assert.equal(getAirportTzOffset('SYD', '2026-07-01T12:00:00Z'), 10);
});

test('India has a fixed half-hour offset', () => {
  assert.equal(getAirportTzOffset('del', '2026-01-15T12:00:00Z'), 5.5);
  assert.equal(tzOffsetHoursAt('Asia/Kolkata', new Date('2026-07-01T12:00:00Z')), 5.5);
});

test('unknown airports return undefined', () => {
  assert.equal(getAirportTzOffset('ZZZ', '2026-01-15T12:00:00Z'), undefined);
});

test('airport-local time converts to UTC', () => {
  assert.equal(airportLocalToUtc('2026-10-01', '06:30', 'DEL', 0)?.toISOString(), '2026-10-01T01:00:00.000Z');
  assert.equal(airportLocalToUtc('2026-01-15', '09:00', 'LHR', 5.5)?.toISOString(), '2026-01-15T09:00:00.000Z');
  assert.equal(airportLocalToUtc('2026-07-15', '09:00', 'LHR', 5.5)?.toISOString(), '2026-07-15T08:00:00.000Z');
});

test('unknown airports never get an assumed time zone', () => {
  assert.equal(airportLocalToUtc('2026-10-01', '06:30', 'ZZZ'), null);
  assert.equal(airportLocalToUtc('2026-10-01', '06:30', 'ZZZ', 5.5)?.toISOString(), '2026-10-01T01:00:00.000Z', 'only with an explicitly supplied offset');
  assert.equal(airportLocalToUtc('not-a-date', '06:30', 'DEL'), null);
  assert.equal(airportLocalToUtc('2026-10-01', '6:30 PM', 'DEL'), null);
  assert.equal(getAirportTzOffset('DEL', 'not-a-date'), undefined);
});

test('the reference list resolves airports beyond the curated 36, with their own time zones', () => {
  assert.deepEqual(lookupAirport('bbi'), { iata: 'BBI', timeZone: 'Asia/Kolkata', city: 'Bhubaneswar', country: 'IN' });
  for (const code of ['IDR', 'GOP', 'DMU', 'GAU', 'CJB', 'VTZ', 'IXB', 'JRG', 'CCJ']) assert.ok(isKnownAirport(code), code);
  assert.equal(lookupAirport('QQQ'), undefined);
  assert.equal(getAirportTzOffset('IDR', '2026-10-01T00:00:00Z'), 5.5);
  assert.equal(getAirportTzOffset('KTM', '2026-10-01T00:00:00Z'), 5.75, 'Kathmandu, a 45-minute offset');
});

test('daylight saving is applied per date at airports outside the curated list', () => {
  assert.equal(getAirportTzOffset('BOS', '2026-01-15T12:00:00Z'), -5);
  assert.equal(getAirportTzOffset('BOS', '2026-07-15T12:00:00Z'), -4);
  assert.equal(getAirportTzOffset('MAN', '2026-01-15T12:00:00Z'), 0);
  assert.equal(getAirportTzOffset('MAN', '2026-07-15T12:00:00Z'), 1);
  assert.equal(getAirportTzOffset('MEL', '2026-01-15T12:00:00Z'), 11);
  assert.equal(getAirportTzOffset('MEL', '2026-07-15T12:00:00Z'), 10);
});
