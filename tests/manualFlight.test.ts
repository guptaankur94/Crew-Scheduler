import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildManualFlight } from '../src/services/manualFlight';

const base = {
  id: 'x',
  flightNumber: '6e 205',
  origin: 'del',
  destination: 'bom',
  dateStr: '2026-10-01',
  depTime: '06:30',
  arrTime: '08:45',
  reportLeadMinutes: 75,
};

test('builds a domestic sector from local times', () => {
  const result = buildManualFlight(base);
  assert.ok('flight' in result);
  const f = result.flight;
  assert.equal(f.flightNumber, '6E 205');
  assert.equal(f.departureTimeUtc, '2026-10-01T01:00:00.000Z');
  assert.equal(f.arrivalTimeUtc, '2026-10-01T03:15:00.000Z');
  assert.equal(f.durationMinutes, 135);
  assert.equal(f.reportTimeUtc, '2026-09-30T23:45:00.000Z');
  assert.equal(f.releaseTimeUtc, '2026-10-01T03:45:00.000Z');
});

test('an arrival after midnight rolls to the next day', () => {
  const result = buildManualFlight({ ...base, depTime: '23:30', arrTime: '01:45' });
  assert.ok('flight' in result);
  assert.equal(result.flight.durationMinutes, 135);
  assert.equal(result.flight.arrivalTimeUtc, '2026-10-01T20:15:00.000Z');
});

test('uses each airport\'s own time zone on international sectors', () => {
  // DEL 10:00 (+5.5) -> DXB 12:00 (+4): 04:30Z to 08:00Z
  const result = buildManualFlight({ ...base, destination: 'DXB', depTime: '10:00', arrTime: '12:00' });
  assert.ok('flight' in result);
  assert.equal(result.flight.durationMinutes, 210);
  assert.equal(result.flight.destTzOffset, 4);
});

test('rejects bad airport codes, missing numbers and impossible durations', () => {
  assert.ok('error' in buildManualFlight({ ...base, origin: 'DELHI' }));
  assert.ok('error' in buildManualFlight({ ...base, flightNumber: '  ' }));
  assert.ok('error' in buildManualFlight({ ...base, depTime: '' }));
  // DEL 06:30 -> DEL 04:30 next day = 22h, longer than any real sector
  assert.ok('error' in buildManualFlight({ ...base, destination: 'DEL', arrTime: '04:30' }));
});

test('manual entry refuses unknown airports and accepts any verified one', () => {
  const unknown = buildManualFlight({ ...base, destination: 'QQQ' });
  assert.ok('error' in unknown && /QQQ isn't a recognised airport code/.test(unknown.error));
  const indore = buildManualFlight({ ...base, destination: 'IDR' });
  assert.ok('flight' in indore);
  assert.equal(indore.flight.destinationCity, 'Indore');
});
