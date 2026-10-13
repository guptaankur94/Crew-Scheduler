import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeParsedRoster } from '../server/rosterSanitizer';

const NOW = new Date('2026-09-30T00:00:00Z');
const good = {
  flightNumber: '6e 205',
  origin: 'del',
  destination: 'bom',
  departureTimeUtc: '2026-10-01T01:00:00Z',
  arrivalTimeUtc: '2026-10-01T03:15:00Z',
};

test('keeps a valid flight and normalises it', () => {
  const roster = sanitizeParsedRoster({ airline: 'IndiGo', homeBase: 'DEL', flights: [good] }, NOW);
  assert.ok(roster);
  assert.equal(roster.flights.length, 1);
  const f = roster.flights[0];
  assert.equal(f.flightNumber, '6E 205');
  assert.equal(f.origin, 'DEL');
  assert.equal(f.departureTimeUtc, '2026-10-01T01:00:00.000Z');
  assert.equal(f.durationMinutes, 135);
  assert.equal(f.reportTimeUtc, '2026-09-30T23:45:00.000Z');
  assert.equal(f.releaseTimeUtc, '2026-10-01T03:45:00.000Z');
  assert.equal(f.originTzOffset, 5.5);
  assert.equal(f.aircraftType, undefined);
  assert.deepEqual(roster.warnings, []);
});

test('never invents data: unreadable legs are dropped and reported', () => {
  const roster = sanitizeParsedRoster(
    {
      flights: [
        good,
        { ...good, flightNumber: 'AI 1', departureTimeUtc: '' },
        { ...good, flightNumber: 'AI 2', destination: '' },
        { ...good, flightNumber: 'AI 3', arrivalTimeUtc: '2026-10-01T00:00:00Z' },
        { ...good, flightNumber: 'AI 4', arrivalTimeUtc: '2026-10-03T00:00:00Z' },
        { ...good, flightNumber: 'AI 5', departureTimeUtc: '2019-10-01T01:00:00Z', arrivalTimeUtc: '2019-10-01T03:00:00Z' },
        null,
      ],
    },
    NOW
  );
  assert.ok(roster);
  assert.deepEqual(roster.flights.map((f) => f.flightNumber), ['6E 205']);
  assert.equal(roster.warnings.length, 5);
  assert.ok(roster.warnings.every((w) => w.startsWith('Skipped AI ')));
});

test('returns null when no flight is usable', () => {
  assert.equal(sanitizeParsedRoster({ flights: [{ ...good, origin: '' }] }, NOW), null);
  assert.equal(sanitizeParsedRoster({ flights: [] }, NOW), null);
  assert.equal(sanitizeParsedRoster(null, NOW), null);
  assert.equal(sanitizeParsedRoster({ flights: 'nope' }, NOW), null);
});

test('home base falls back to the first origin, never a hardcoded city', () => {
  const roster = sanitizeParsedRoster({ flights: [{ ...good, origin: 'DXB', destination: 'DOH' }] }, NOW);
  assert.ok(roster);
  assert.equal(roster.homeBase, 'DXB');
  assert.equal(roster.homeBaseTzOffset, 4);
});

test('known airports override the model offset; unknown ones need a plausible value', () => {
  const overridden = sanitizeParsedRoster({ flights: [{ ...good, originTzOffset: -3, destTzOffset: 9 }] }, NOW);
  assert.equal(overridden?.flights[0].originTzOffset, 5.5);
  assert.equal(overridden?.flights[0].destTzOffset, 5.5);

  const unknownOk = sanitizeParsedRoster({ flights: [{ ...good, destination: 'ZZZ', destTzOffset: 2 }] }, NOW);
  assert.equal(unknownOk?.flights[0].destTzOffset, 2);
  assert.equal(unknownOk?.flights[0].tzUnverified, true, 'kept only for review, flagged as unverified');

  assert.equal(sanitizeParsedRoster({ flights: [{ ...good, destination: 'ZZZ' }] }, NOW), null);
  assert.equal(sanitizeParsedRoster({ flights: [{ ...good, destination: 'ZZZ', destTzOffset: 99 }] }, NOW), null);
});

test('implausible report and release times fall back to the standard buffers', () => {
  const roster = sanitizeParsedRoster(
    { flights: [{ ...good, reportTimeUtc: '2026-10-01T02:00:00Z', releaseTimeUtc: '2026-10-05T00:00:00Z' }] },
    NOW
  );
  assert.equal(roster?.flights[0].reportTimeUtc, '2026-09-30T23:45:00.000Z');
  assert.equal(roster?.flights[0].releaseTimeUtc, '2026-10-01T03:45:00.000Z');
});

test('red-eye is computed from home-base time and flights are sorted', () => {
  const roster = sanitizeParsedRoster(
    {
      homeBase: 'DEL',
      flights: [
        { ...good, isRedEye: true },
        // 19:00Z = 00:30 in Delhi
        { ...good, flightNumber: '6E 1', departureTimeUtc: '2026-09-30T19:00:00Z', arrivalTimeUtc: '2026-09-30T21:00:00Z', isRedEye: false },
      ],
    },
    NOW
  );
  assert.deepEqual(roster?.flights.map((f) => [f.flightNumber, f.isRedEye]), [['6E 1', true], ['6E 205', false]]);
});

test('a missing flight number is kept but flagged', () => {
  const roster = sanitizeParsedRoster({ flights: [{ ...good, flightNumber: '' }] }, NOW);
  assert.equal(roster?.flights[0].flightNumber, 'UNKNOWN');
  assert.equal(roster?.warnings.length, 1);
});

test('standby periods are kept, bad ones dropped with a warning; positioning is flagged', () => {
  const roster = sanitizeParsedRoster(
    {
      homeBase: 'DEL',
      flights: [{ ...good, isPositioning: true }],
      standby: [
        { type: 'airport', airport: 'DEL', startTimeUtc: '2026-10-02T00:30:00Z', endTimeUtc: '2026-10-02T06:30:00Z' },
        { type: 'home', startTimeUtc: '2026-10-03T00:30:00Z', endTimeUtc: '2026-10-03T12:30:00Z' },
        { type: 'home', startTimeUtc: 'nonsense', endTimeUtc: '2026-10-04T12:30:00Z' },
        { type: 'home', startTimeUtc: '2026-10-05T12:30:00Z', endTimeUtc: '2026-10-05T10:00:00Z' },
      ],
    },
    NOW
  );
  assert.ok(roster);
  assert.equal(roster.flights[0].isPositioning, true);
  assert.equal(roster.standby.length, 2);
  assert.equal(roster.standby[0].kind, 'airport');
  assert.equal(roster.standby[1].kind, 'home');
  assert.equal(roster.standby[1].airport, 'DEL', 'missing airport falls back to home base');
  assert.equal(roster.warnings.filter((w) => w.includes('standby')).length, 2);
});

test('a roster with only standby is still accepted', () => {
  const roster = sanitizeParsedRoster(
    { homeBase: 'DEL', flights: [], standby: [{ type: 'home', startTimeUtc: '2026-10-03T00:30:00Z', endTimeUtc: '2026-10-03T12:30:00Z' }] },
    NOW
  );
  assert.equal(roster?.standby.length, 1);
  assert.equal(roster?.flights.length, 0);
});

test('verified airports outside the curated list use the reference time zone and city, not the AI', () => {
  const roster = sanitizeParsedRoster(
    { flights: [{ ...good, destination: 'IDR', destTzOffset: 3, destinationCity: 'Wrong City' }] },
    NOW
  );
  assert.equal(roster?.flights[0].destTzOffset, 5.5);
  assert.equal(roster?.flights[0].destinationCity, 'Indore');
  assert.equal(roster?.flights[0].tzUnverified, undefined);
});

test('standby at an unknown airport is skipped with a warning, never given an assumed zone', () => {
  const roster = sanitizeParsedRoster(
    { homeBase: 'DEL', flights: [good], standby: [{ type: 'airport', airport: 'QQQ', startTimeUtc: '2026-10-02T00:30:00Z', endTimeUtc: '2026-10-02T06:30:00Z' }] },
    NOW
  );
  assert.equal(roster?.standby.length, 0);
  assert.ok(roster?.warnings.some((w) => w.includes('QQQ')));
});

test('non-flying days and the stated roster period are kept; bad entries are dropped', () => {
  const roster = sanitizeParsedRoster(
    {
      flights: [good],
      otherDuties: [
        { type: 'off', date: '2026-10-02', code: 'OFF' },
        { type: 'sick', date: '2026-10-05', code: 'SCK' },
        { type: 'training', date: '2026-10-06', code: 'SIM' },
        { type: 'holiday-ish', date: '2026-10-07' },
        { type: 'off', date: 'not a date' },
        { type: 'off', date: '2026-10-02' },
      ],
      rosterPeriod: { start: '2026-10-01', end: '2026-10-21' },
    },
    NOW
  );
  assert.deepEqual(roster?.otherDuties.map((d) => [d.kind, d.date]), [
    ['off', '2026-10-02'],
    ['sick', '2026-10-05'],
    ['training', '2026-10-06'],
    ['other', '2026-10-07'],
  ]);
  assert.equal(roster?.periodStart, '2026-10-01');
  assert.equal(roster?.periodEnd, '2026-10-21');
  const reversed = sanitizeParsedRoster({ flights: [good], rosterPeriod: { start: '2026-10-21', end: '2026-10-01' } }, NOW);
  assert.equal(reversed?.periodStart, undefined);
});
