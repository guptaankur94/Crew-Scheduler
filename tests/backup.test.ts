import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildBackup, parseBackup } from '../src/services/backup';
import type { CrewPreferences } from '../src/types/circadian';

const prefs = { homeBaseIata: 'DEL', homeBaseTzOffset: 5.5, targetSleepHours: 7.5, caffeineCutoffHours: 6 } as CrewPreferences;

const roster = {
  id: 'r1',
  airline: 'Test',
  homeBase: 'DEL',
  homeBaseTzOffset: 5.5,
  layovers: [],
  parsedAt: '2026-10-01T00:00:00.000Z',
  flights: [
    {
      id: 'f1',
      flightNumber: '6E 1',
      origin: 'DEL',
      destination: 'BOM',
      departureTimeUtc: '2026-10-10T04:00:00.000Z',
      arrivalTimeUtc: '2026-10-10T06:00:00.000Z',
      reportTimeUtc: '2026-10-10T02:45:00.000Z',
      releaseTimeUtc: '2026-10-10T06:30:00.000Z',
      originTzOffset: 5.5,
      destTzOffset: 5.5,
      durationMinutes: 120,
    },
  ],
};

test('a backup round-trips roster, settings and history', () => {
  const text = buildBackup(
    { roster, preferences: { targetSleepHours: 8 }, customNudges: { s: 15 }, activePresetId: 'custom-upload' },
    [{ id: 'h1', timestamp: '2026-10-01T00:00:00.000Z', actionType: 'upload', title: 'Oct', airline: 'Test', homeBase: 'DEL', flightsCount: 1, isActive: true, rosterSnapshot: roster }]
  );
  const result = parseBackup(text, prefs);
  assert.ok(!('error' in result));
  assert.equal(result.state?.roster.flights.length, 1);
  assert.equal(result.state?.preferences.targetSleepHours, 8);
  assert.equal(result.state?.preferences.caffeineCutoffHours, 6);
  assert.deepEqual(result.state?.customNudges, { s: 15 });
  assert.equal(result.history.length, 1);
  assert.equal(result.history[0].rosterSnapshot?.flights.length, 1);
});

test('files that are not backups are refused with a plain message', () => {
  for (const text of ['not json', '{}', JSON.stringify({ app: 'Other', version: 1 })]) {
    const result = parseBackup(text, prefs);
    assert.ok('error' in result);
  }
  const future = parseBackup(JSON.stringify({ app: 'CrewCircadian', version: 99, state: null, history: [] }), prefs);
  assert.match((future as { error: string }).error, /newer version/);
});

test('broken entries inside a backup are dropped, not trusted', () => {
  const text = JSON.stringify({
    app: 'CrewCircadian',
    version: 1,
    state: { roster: { ...roster, flights: [{ id: 'bad' }] } },
    history: [{ id: 'ok', timestamp: 'x', title: 'Fine' }, { nope: true }],
  });
  const result = parseBackup(text, prefs);
  assert.ok(!('error' in result));
  assert.equal(result.state, null);
  assert.equal(result.history.length, 1);
});

test('a password-protected backup opens only with the right password', async () => {
  const { encryptBackup, decryptBackup, isEncryptedBackup } = await import('../src/services/backup');
  const plain = buildBackup({ roster: { flights: [] } }, [], new Date('2026-10-09T00:00:00Z'));
  const locked = await encryptBackup(plain, 'blue sky 42');
  assert.ok(isEncryptedBackup(locked));
  assert.ok(!locked.includes('roster'), 'nothing readable inside');
  assert.equal(await decryptBackup(locked, 'wrong'), null);
  assert.equal(await decryptBackup(locked, 'blue sky 42'), plain);
  assert.equal(isEncryptedBackup(plain), false);
  // A real backup is hundreds of kilobytes
  const big = buildBackup({ roster: { flights: Array.from({ length: 3000 }, (_, i) => ({ id: `f${i}`, flightNumber: `6E ${i}` })) } }, [], new Date());
  assert.ok(big.length > 100_000);
  assert.equal(await decryptBackup(await encryptBackup(big, 'pw123456'), 'pw123456'), big);
});
