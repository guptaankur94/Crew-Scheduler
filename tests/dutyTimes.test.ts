import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dutyPositions, normalizeDutyTimes } from '../src/services/dutyTimes';
import type { FlightLeg } from '../src/types/circadian';

/* Real days from a friend's October roster: the duty's check-in and debrief had been copied onto every sector. */

const ist = (s: string) => new Date(Date.parse(`${s}:00+05:30`)).toISOString();
const sector = (id: string, o: string, d: string, date: string, rep: string, dep: string, arr: string, rel: string, arrDate = date): FlightLeg => ({
  id, flightNumber: id, origin: o, destination: d,
  reportTimeUtc: ist(`${date}T${rep}`), departureTimeUtc: ist(`${date}T${dep}`), arrivalTimeUtc: ist(`${arrDate}T${arr}`), releaseTimeUtc: ist(`${arrDate}T${rel}`),
  originTzOffset: 5.5, destTzOffset: 5.5, durationMinutes: 0,
});
const hm = (iso: string) => new Date(Date.parse(iso) + 5.5 * 3600000).toISOString().slice(11, 16);

test('2 Oct: BLR→PNQ→BLR — check-in on the first sector, debrief (08:49) only after the last', () => {
  const read = [
    sector('6E408', 'BLR', 'PNQ', '2026-10-02', '03:45', '04:12', '05:43', '08:49'),
    sector('6E391', 'PNQ', 'BLR', '2026-10-02', '03:45', '06:38', '08:19', '08:49'),
  ];
  const [out, back] = normalizeDutyTimes(read);
  assert.deepEqual([hm(out.reportTimeUtc), hm(out.releaseTimeUtc)], ['03:45', '05:43'], 'no release of its own: the duty continues');
  assert.deepEqual([hm(back.reportTimeUtc), hm(back.releaseTimeUtc)], ['06:38', '08:49'], 'no check-in of its own; debrief 30 min after landing');
});

test('9 Oct: four sectors — only the first has a check-in and only the last a debrief', () => {
  const read = [
    sector('5394', 'MAA', 'COK', '2026-10-09', '07:00', '08:00', '09:10', '09:40'),
    sector('6535a', 'COK', 'BLR', '2026-10-09', '07:00', '09:40', '10:55', '16:55'),
    sector('6535b', 'BLR', 'BBI', '2026-10-09', '07:00', '11:40', '13:45', '16:55'),
    sector('6536', 'BBI', 'BLR', '2026-10-09', '13:00', '14:15', '16:25', '16:55'),
  ];
  const out = normalizeDutyTimes(read);
  assert.deepEqual(out.map((f) => `${hm(f.reportTimeUtc)}-${hm(f.releaseTimeUtc)}`), ['07:00-09:10', '09:40-10:55', '11:40-13:45', '14:15-16:55']);
  assert.deepEqual([...dutyPositions(read).values()], [{ first: true, last: false }, { first: false, last: false }, { first: false, last: false }, { first: false, last: true }]);
});

test('a debrief copied from the last sector is found even if the last sector only has the default', () => {
  const read = [sector('a', 'BLR', 'PNQ', '2026-10-02', '03:45', '04:12', '05:43', '08:49'), sector('b', 'PNQ', 'BLR', '2026-10-02', '06:00', '06:38', '08:19', '08:49')];
  read[1] = { ...read[1], releaseTimeUtc: ist('2026-10-02T08:49') };
  assert.equal(hm(normalizeDutyTimes(read)[1].releaseTimeUtc), '08:49');
});

test('separate duties stay separate; a single-sector duty keeps its own times; running twice changes nothing', () => {
  const read = [
    sector('m', 'BLR', 'MAA', '2026-10-08', '07:15', '08:15', '09:15', '09:45'),
    sector('e', 'BLR', 'DEL', '2026-10-08', '17:00', '18:00', '20:40', '21:10'), // 8h45 after landing: a new duty
  ];
  const once = normalizeDutyTimes(read);
  // Times are already right; the only addition is each flight's duty check-in
  assert.deepEqual(once.map((f) => [f.reportTimeUtc, f.releaseTimeUtc]), read.map((f) => [f.reportTimeUtc, f.releaseTimeUtc]));
  assert.deepEqual(once.map((f) => f.dutyCheckInUtc), [read[0].reportTimeUtc, read[1].reportTimeUtc]);
  assert.equal(normalizeDutyTimes(once), once, 'running it again changes nothing: the same array back');
  const messy = normalizeDutyTimes([sector('a', 'BLR', 'PNQ', '2026-10-02', '03:45', '04:12', '05:43', '08:49'), sector('b', 'PNQ', 'BLR', '2026-10-02', '03:45', '06:38', '08:19', '08:49')]);
  assert.equal(normalizeDutyTimes(messy), messy, 'idempotent');
});

test('printed check-in and debrief are kept only on the first and last sector', () => {
  const read = [
    { ...sector('a', 'BLR', 'PNQ', '2026-10-02', '03:45', '04:12', '05:43', '08:49'), printed: { date: '2026-10-02', dep: '04:12', arr: '05:43', report: '03:45', release: '08:49' } },
    { ...sector('b', 'PNQ', 'BLR', '2026-10-02', '03:45', '06:38', '08:19', '08:49'), printed: { date: '2026-10-02', dep: '06:38', arr: '08:19', report: '03:45', release: '08:49' } },
  ];
  const [a, b] = normalizeDutyTimes(read);
  assert.deepEqual(a.printed, { date: '2026-10-02', dep: '04:12', arr: '05:43', report: '03:45' });
  assert.deepEqual(b.printed, { date: '2026-10-02', dep: '06:38', arr: '08:19', release: '08:49' });
});
