import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getAirportTzOffset, airportLocalToUtc, tzOffsetHoursAt } from '../src/data/airports';

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

test('unknown airports use the fallback offset and bad input returns null', () => {
  assert.equal(airportLocalToUtc('2026-10-01', '06:30', 'ZZZ', 5.5)?.toISOString(), '2026-10-01T01:00:00.000Z');
  assert.equal(airportLocalToUtc('not-a-date', '06:30', 'DEL', 5.5), null);
});
