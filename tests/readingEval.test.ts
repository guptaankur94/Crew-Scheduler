import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compareReading, overallAccuracy } from '../src/services/readingEval';

test('reading accuracy: exact, wrong fields, missing and extra flights are told apart', () => {
  const expected = [
    { date: '2026-10-08', flightNumber: '6E 6269', origin: 'BLR', destination: 'MAA', dep: '07:15', arr: '08:15' },
    { date: '2026-10-08', flightNumber: '6E 6815', origin: 'MAA', destination: 'BLR', dep: '08:55', arr: '10:05' },
    { date: '2026-10-09', flightNumber: '6E 904', origin: 'BLR', destination: 'MAA', dep: '10:50', arr: '11:45' },
  ];
  const read = [
    { flightNumber: '6E6269', origin: 'BLR', destination: 'MAA', printed: { date: '2026-10-08', dep: '07:15', arr: '08:15' } },
    { flightNumber: '6E 6815', origin: 'MAA', destination: 'BLR', printed: { date: '2026-10-08', dep: '08:55', arr: '10:50' } },
    { flightNumber: '6E 111', origin: 'BLR', destination: 'DEL', printed: { date: '2026-10-09', dep: '12:00', arr: '14:40' } },
  ];
  const r = compareReading(expected, read);
  assert.equal(r.exact, 1, 'spacing in the flight number does not matter');
  assert.deepEqual(r.wrong, [{ flight: '2026-10-08 6E6815', fields: ['arrives 10:50 (should be 10:05)'] }]);
  assert.deepEqual(r.missing, ['2026-10-09 6E904']);
  assert.deepEqual(r.extra, ['2026-10-09 6E111']);
  assert.equal(Math.round(overallAccuracy([r]) * 100), 33);
});
