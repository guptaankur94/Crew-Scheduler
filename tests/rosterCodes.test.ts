import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dayKindForCode, standbyKindForCode } from '../src/services/rosterCodes';
import { sanitizeParsedRoster } from '../server/rosterSanitizer';

test('known roster codes always mean the same kind of day, whatever the spacing or case', () => {
  assert.equal(dayKindForCode('OFF'), 'off');
  assert.equal(dayKindForCode(' d/o '), 'off');
  assert.equal(dayKindForCode('WKOFF'), 'off');
  assert.equal(dayKindForCode('AL'), 'leave');
  assert.equal(dayKindForCode('SCK'), 'sick');
  assert.equal(dayKindForCode('SIM'), 'training');
  assert.equal(dayKindForCode('XYZ'), undefined);
  assert.equal(standbyKindForCode('ASBY'), 'airport');
  assert.equal(standbyKindForCode('sby'), 'home');
});

test('IndiGo codes: Golden Day Off, home standby, domestic and international airport standby', () => {
  assert.equal(dayKindForCode('OFG'), 'off');
  assert.equal(standbyKindForCode('SBYP'), 'home');
  assert.equal(standbyKindForCode('ASBD'), 'airport');
  assert.equal(standbyKindForCode('ASBI'), 'airport');
});

test('the code dictionary overrides the reader when they disagree; unknown codes keep the reader choice', () => {
  const now = new Date('2026-10-06T12:00:00Z');
  const r = sanitizeParsedRoster(
    {
      homeBase: 'BLR',
      flights: [],
      standby: [{ type: 'home', code: 'ASBY', airport: 'BLR', date: '2026-10-08', startTime: '06:00', endTime: '12:00' }],
      otherDuties: [
        { type: 'other', date: '2026-10-09', code: 'AL' },
        { type: 'leave', date: '2026-10-10', code: 'SIM' },
        { type: 'off', date: '2026-10-11', code: 'XYZ' },
      ],
    },
    now
  );
  assert.ok(r);
  assert.deepEqual(r!.otherDuties.map((d) => d.kind), ['leave', 'training', 'off']);
  assert.equal(r!.standby[0].kind, 'airport');
});
