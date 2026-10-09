import { test } from 'node:test';
import assert from 'node:assert/strict';
import { payFromOwnRates } from '../src/services/payEstimate';

const stats = { flyingHours: 49.9, standbyHours: 21, layoverNights: 2, nightFlights: 5 };

test('pay estimate uses only the rates the person entered, and lists the parts left out', () => {
  assert.equal(payFromOwnRates(stats, {}), null, 'no rates entered: no estimate at all');
  const e = payFromOwnRates(stats, { customBasePay: 40000, customHourlyRate: 600 })!;
  assert.equal(e.total, 40000 + Math.round(49.9 * 600));
  assert.deepEqual(e.missing, ['Standby', 'Layover allowance', 'Night flying allowance']);
  assert.equal(payFromOwnRates(stats, { customStandbyRate: 0 })!.total, 0, 'a rate of zero counts as entered');
});
