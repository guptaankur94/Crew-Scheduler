import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeRosterMerge, resolveAndMergeFlights } from '../src/services/rosterMerger';
import type { FlightLeg } from '../src/types/circadian';

const leg = (id: string, flightNumber: string, dep: string, arr: string, origin = 'DEL', destination = 'BOM'): FlightLeg => ({
  id,
  flightNumber,
  origin,
  destination,
  departureTimeUtc: dep,
  arrivalTimeUtc: arr,
  reportTimeUtc: dep,
  releaseTimeUtc: arr,
  originTzOffset: 5.5,
  destTzOffset: 5.5,
  durationMinutes: 120,
});

const current = [leg('a', '6E 205', '2026-10-01T01:00:00.000Z', '2026-10-01T03:00:00.000Z')];

test('duplicates are counted, not added twice', () => {
  const result = analyzeRosterMerge(current, [leg('b', '6E205', '2026-10-01T01:30:00.000Z', '2026-10-01T03:30:00.000Z')]);
  assert.equal(result.hasConflicts, false);
  assert.equal(result.identicalCount, 1);
  assert.equal(result.nonConflictingMergedFlights.length, 1);
});

test('new sectors are appended in date order', () => {
  const result = analyzeRosterMerge(current, [leg('b', '6E 900', '2026-09-29T01:00:00.000Z', '2026-09-29T03:00:00.000Z')]);
  assert.equal(result.newSectorsCount, 1);
  assert.deepEqual(result.nonConflictingMergedFlights.map((f) => f.id), ['b', 'a']);
});

test('overlapping different flights are conflicts and each choice resolves correctly', () => {
  const incoming = [leg('b', 'AI 101', '2026-10-01T02:00:00.000Z', '2026-10-01T04:00:00.000Z')];
  const result = analyzeRosterMerge(current, incoming);
  assert.equal(result.hasConflicts, true);
  const key = result.conflicts[0].id;

  assert.deepEqual(resolveAndMergeFlights(current, incoming, { [key]: 'keep_existing' }).map((f) => f.id), ['a']);
  assert.deepEqual(resolveAndMergeFlights(current, incoming, { [key]: 'accept_incoming' }).map((f) => f.id), ['b']);
  assert.deepEqual(resolveAndMergeFlights(current, incoming, { [key]: 'combine_both' }).map((f) => f.id), ['a', 'b']);
});
