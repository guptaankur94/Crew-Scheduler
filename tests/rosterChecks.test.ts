import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkRosterFlights, hasBlockingProblems } from '../src/services/rosterChecks';
import type { FlightLeg } from '../src/types/circadian';

const f = (id: string, from: string, to: string, dep: string, arr: string, extra: Partial<FlightLeg> = {}): FlightLeg => ({
  id,
  flightNumber: id.toUpperCase(),
  origin: from,
  destination: to,
  departureTimeUtc: dep,
  arrivalTimeUtc: arr,
  reportTimeUtc: new Date(Date.parse(dep) - 75 * 60000).toISOString(),
  releaseTimeUtc: new Date(Date.parse(arr) + 30 * 60000).toISOString(),
  originTzOffset: 5.5,
  destTzOffset: 5.5,
  durationMinutes: 120,
  ...extra,
});

test('a clean two-sector day has no issues', () => {
  const issues = checkRosterFlights([
    f('a', 'DEL', 'BOM', '2026-10-10T04:00:00Z', '2026-10-10T06:00:00Z'),
    f('b', 'BOM', 'DEL', '2026-10-10T07:00:00Z', '2026-10-10T09:00:00Z'),
  ]);
  assert.equal(issues.size, 0);
});

test('impossible rows are problems that block saving', () => {
  const issues = checkRosterFlights([
    f('back', 'DEL', 'BOM', '2026-10-10T06:00:00Z', '2026-10-10T05:00:00Z'),
    f('bad', 'DELHI', 'BOM', '2026-10-11T06:00:00Z', '2026-10-11T08:00:00Z'),
    f('x1', 'DEL', 'BOM', '2026-10-12T04:00:00Z', '2026-10-12T06:00:00Z'),
    f('x2', 'BOM', 'BLR', '2026-10-12T05:30:00Z', '2026-10-12T07:00:00Z'),
  ]);
  assert.match(issues.get('back')![0].message, /Arrives before it departs/);
  assert.match(issues.get('bad')![0].message, /3 letters/);
  assert.match(issues.get('x2')![0].message, /Overlaps X1/);
  assert.equal(hasBlockingProblems(issues), true);
});

test('suspicious rows are checks that do not block saving', () => {
  const issues = checkRosterFlights([
    f('a', 'DEL', 'BOM', '2026-10-10T04:00:00Z', '2026-10-10T06:00:00Z'),
    f('b', 'HYD', 'DEL', '2026-10-10T08:00:00Z', '2026-10-10T10:00:00Z'),
    f('c', 'DEL', 'ZZZ', '2026-10-11T04:00:00Z', '2026-10-11T06:00:00Z'),
  ]);
  assert.match(issues.get('b')![0].message, /previous flight landed at BOM/);
  assert.match(issues.get('c')![0].message, /ZZZ is not in the app's airport list/);
  assert.equal(hasBlockingProblems(issues), false);
});

test('duplicates are caught', () => {
  const issues = checkRosterFlights([
    f('6e1', 'DEL', 'BOM', '2026-10-10T04:00:00Z', '2026-10-10T06:00:00Z'),
    { ...f('dup', 'DEL', 'BOM', '2026-10-10T04:30:00Z', '2026-10-10T06:30:00Z'), flightNumber: '6E 1' },
  ]);
  assert.match(issues.get('dup')![0].message, /duplicate/);
});

import { fromDraft, toDraft } from '../src/components/RosterReviewDialog';

test('review screen: an untouched row comes back exactly as read', () => {
  const original = f('6e1', 'DEL', 'DXB', '2026-10-10T18:00:00.000Z', '2026-10-10T21:30:00.000Z', { destTzOffset: 4 });
  const back = fromDraft(toDraft(original))!;
  assert.equal(back.departureTimeUtc, original.departureTimeUtc);
  assert.equal(back.arrivalTimeUtc, original.arrivalTimeUtc);
  assert.equal(back.reportTimeUtc, original.reportTimeUtc);
  assert.equal(back.releaseTimeUtc, original.releaseTimeUtc);
});

test('review screen: editing local times recomputes UTC, keeps report/release buffers, and rolls past midnight', () => {
  const original = f('6e1', 'DEL', 'BOM', '2026-10-10T04:00:00.000Z', '2026-10-10T06:00:00.000Z');
  const edited = fromDraft({ ...toDraft(original), dep: '23:30', arr: '01:45' })!;
  assert.equal(edited.departureTimeUtc, '2026-10-10T18:00:00.000Z'); // 23:30 IST
  assert.equal(edited.arrivalTimeUtc, '2026-10-10T20:15:00.000Z'); // 01:45 IST next day
  assert.equal(edited.durationMinutes, 135);
  assert.equal(Date.parse(edited.departureTimeUtc) - Date.parse(edited.reportTimeUtc), 75 * 60000);
  assert.equal(fromDraft({ ...toDraft(original), dep: '' }), null);
});
