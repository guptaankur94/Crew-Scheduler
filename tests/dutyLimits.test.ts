import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkDutyLimits, RULE_SETS, rulesStatus } from '../src/services/dutyLimits';
import type { FlightLeg, RosterData, StandbyDuty } from '../src/types/circadian';

/* Hand-worked cases against DGCA CAR 7-J-I Issue IV (in force) and the Issue V draft. Times in India time. */

let n = 0;
const ist = (s: string) => Date.parse(`${s}:00+05:30`);
/** A sector: report `reportLead` min before departure, release 30 min after arrival. */
const leg = (fn: string, o: string, d: string, depIst: string, minutes: number, reportLead = 60, extra: Partial<FlightLeg> = {}): FlightLeg => {
  const dep = ist(depIst);
  return {
    id: `f${++n}`, flightNumber: fn, origin: o, destination: d,
    departureTimeUtc: new Date(dep).toISOString(), arrivalTimeUtc: new Date(dep + minutes * 60000).toISOString(),
    reportTimeUtc: new Date(dep - reportLead * 60000).toISOString(), releaseTimeUtc: new Date(dep + (minutes + 30) * 60000).toISOString(),
    originTzOffset: 5.5, destTzOffset: 5.5, durationMinutes: minutes, ...extra,
  };
};
const roster = (flights: FlightLeg[], extra: Partial<RosterData> = {}): RosterData => ({ id: 'r', airline: 'IndiGo', homeBase: 'BLR', homeBaseTzOffset: 5.5, flights, layovers: [], parsedAt: '', ...extra });
const titles = (r: RosterData, rules?: Parameters<typeof checkDutyLimits>[1], cov?: { from: string; to: string }) => checkDutyLimits(r, rules, cov).issues.map((i) => `${i.date} ${i.severity} ${i.title}`);
/** Four short sectors in one daytime duty: report 07:00, flying 08:00–18:00 */
const fourSectors = (date: string, lastArr = '17:00') => {
  const end = Number(lastArr.slice(0, 2));
  return [
    leg('6E 1', 'BLR', 'MAA', `${date}T08:00`, 60),
    leg('6E 2', 'MAA', 'BLR', `${date}T10:00`, 60),
    leg('6E 3', 'BLR', 'HYD', `${date}T12:00`, 75),
    leg('6E 4', 'HYD', 'BLR', `${date}T${String(end - 1).padStart(2, '0')}:45`, 75),
  ];
};

test('a normal duty day is within limits', () => {
  assert.deepEqual(titles(roster(fourSectors('2026-10-05'))), []);
});

test('Issue IV 6.1.1: FDP over 12:00 with up to 8 hours flying is over the limit', () => {
  // Report 07:00, last arrival 19:00 + 30 min = FDP 12:30; flight time 7:40
  const long = [leg('6E 1', 'BLR', 'MAA', '2026-10-05T08:00', 60), leg('6E 2', 'MAA', 'BLR', '2026-10-05T10:00', 60), leg('6E 3', 'BLR', 'DEL', '2026-10-05T12:00', 160), leg('6E 4', 'DEL', 'BLR', '2026-10-05T16:00', 180)];
  const [issue] = checkDutyLimits(roster(long)).issues;
  assert.equal(issue.title, 'Flight duty period over the limit');
  assert.match(issue.detail, /12:30.*limit 12:00 for 4 landings and 7:40 flight time/);
  assert.equal(issue.ref, 'Para 6.1.1');
});

test('a 4-hour break inside the duty: over the basic limit but within it as split duty', () => {
  // Report 07:00 → FDP end 21:00 = 14:00; break 09:30 → 13:30 = 4h gives up to 2h more (14:00)
  const split = [leg('6E 1', 'BLR', 'MAA', '2026-10-05T08:00', 60), leg('6E 2', 'MAA', 'BLR', '2026-10-05T14:30', 60), leg('6E 3', 'BLR', 'HYD', '2026-10-05T16:30', 120), leg('6E 4', 'HYD', 'BLR', '2026-10-05T19:30', 60)];
  const [issue] = checkDutyLimits(roster(split)).issues;
  assert.equal(issue.severity, 'check');
  assert.equal(issue.title, 'Long duty: allowed only as split duty');
});

test('night-time (WOCL) reduction: reporting at 03:00 cuts the limit by up to 2 hours', () => {
  // Report 03:00, FDP to 13:30 = 10:30; limit 12:00 − 2:00 = 10:00
  const early = [leg('6E 1', 'BLR', 'MAA', '2026-10-05T04:00', 90), leg('6E 2', 'MAA', 'BLR', '2026-10-05T06:30', 90), leg('6E 3', 'BLR', 'HYD', '2026-10-05T09:00', 90), leg('6E 4', 'HYD', 'BLR', '2026-10-05T11:30', 90)];
  const [issue] = checkDutyLimits(roster(early)).issues;
  assert.match(issue.detail, /10:30.*limit 10:00.*after 2:00 off/);
  // Draft Issue V: a duty touching 00:00–06:00 at home uses the night row (10:00 FDP, at most 2 landings)
  assert.deepEqual(titles(roster(early), 'dgca-cc-v-draft'), ['2026-10-05 over Too many landings']);
});

test('rest before a duty must be at least 12 hours (and at least as long as the previous duty)', () => {
  const r = roster([leg('6E 1', 'BLR', 'DEL', '2026-10-05T18:00', 120), leg('6E 2', 'BLR', 'MAA', '2026-10-06T08:00', 60)]);
  const [issue] = checkDutyLimits(r).issues;
  assert.equal(issue.title, 'Rest before duty too short');
  assert.match(issue.detail, /10:30 rest .* at least 12:00 needed/);
});

test('weekly rest: 36 hours with two local nights at least every 168 hours', () => {
  const daily = (dates: string[]) => dates.flatMap((d) => [leg('6E 1', 'BLR', 'MAA', `${d}T08:00`, 60), leg('6E 2', 'MAA', 'BLR', `${d}T10:00`, 60)]);
  const oct = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => `2026-10-${String(a + i).padStart(2, '0')}`);
  // Off 1–4 Oct, then a duty every day 5–20 Oct: the next weekly rest is overdue from 12 Oct 07:00
  const busy = checkDutyLimits(roster(daily(oct(5, 20))), 'dgca-cc-iv', { from: '2026-10-01', to: '2026-10-20' }).issues;
  assert.deepEqual(busy.map((i) => `${i.date} ${i.title}`), ['2026-10-12 Weekly rest overdue']);
  // Two days off in between (9–10 Oct) restart the 168 hours
  const ok = checkDutyLimits(roster(daily([...oct(5, 8), ...oct(11, 14)])), 'dgca-cc-iv', { from: '2026-10-01', to: '2026-10-15' }).issues;
  assert.deepEqual(ok, []);
});

test('the draft needs 48 hours of weekly rest; a 43.5-hour break with two nights counts only under Issue IV', () => {
  // Off 1–7 Oct; duty 8 Oct until 11:30; off until 07:00 on 10 Oct (43.5 h, two local nights); then a duty every day
  const r = roster([leg('6E 1', 'BLR', 'MAA', '2026-10-08T08:00', 60), leg('6E 2', 'MAA', 'BLR', '2026-10-08T10:00', 60), ...['10', '11', '12', '13', '14', '15', '16', '17', '18'].map((d) => leg('6E 9', 'BLR', 'GOI', `2026-10-${d}T08:00`, 60))]);
  const cov = { from: '2026-10-01', to: '2026-10-18' };
  const weekly = (id: Parameters<typeof checkDutyLimits>[1]) => checkDutyLimits(r, id, cov).issues.filter((i) => i.title === 'Weekly rest overdue').map((i) => i.date);
  assert.deepEqual(weekly('dgca-cc-iv'), ['2026-10-17'], 'IV: counted from the 43.5-hour break (ends 10 Oct 07:00)');
  assert.deepEqual(weekly('dgca-cc-v-draft'), ['2026-10-15'], 'draft: that break is too short, so counted from the days off before 8 Oct');
});

test('consecutive nights (duty during 00:00–05:00 two nights running) are allowed only once in 168 hours', () => {
  const nights = (dates: string[]) => dates.map((d) => leg('6E 77', 'BLR', 'DEL', `${d}T23:30`, 120));
  assert.deepEqual(titles(roster(nights(['2026-10-02', '2026-10-03']))), [], 'once is allowed');
  assert.deepEqual(titles(roster(nights(['2026-10-02', '2026-10-03', '2026-10-05', '2026-10-06']))), ['2026-10-07 over Consecutive night duties']);
});

test('flight time over 40 hours and duty over 65 hours in 7 days', () => {
  const day = (d: string) => [leg('6E 1', 'BLR', 'DEL', `${d}T06:00`, 120), leg('6E 2', 'DEL', 'BLR', `${d}T09:00`, 120), leg('6E 3', 'BLR', 'MAA', `${d}T12:00`, 120)];
  const dates = ['05', '06', '07', '08', '09', '10', '11'].map((d) => `2026-10-${d}`);
  const t = titles(roster(dates.flatMap(day)), 'dgca-cc-iv', { from: '2026-10-05', to: '2026-10-11' });
  assert.deepEqual(t, ['2026-10-11 over Flight time over 7 days', '2026-10-11 over Duty time over 7 days']);
});

test('positioning is not a landing and not flight time', () => {
  // 6 operating sectors + 1 positioning: still within 6 landings
  const legs = [0, 1, 2, 3, 4, 5].map((i) => leg(`6E ${i}`, i % 2 ? 'MAA' : 'BLR', i % 2 ? 'BLR' : 'MAA', `2026-10-05T${String(7 + i * 1.5 | 0).padStart(2, '0')}:${i % 2 ? '30' : '00'}`, 50));
  const pos = leg('6E 99', 'BLR', 'HYD', '2026-10-05T17:00', 60, 60, { isPositioning: true });
  assert.deepEqual(titles(roster([...legs, pos])).filter((x) => /landings/.test(x)), []);
});

test('standby: airport standby over 8 hours, and rest after an unused home standby', () => {
  const sb = (kind: 'home' | 'airport', s: string, e: string): StandbyDuty => ({ id: `s${++n}`, kind, airport: 'BLR', startUtc: new Date(ist(s)).toISOString(), endUtc: new Date(ist(e)).toISOString() });
  assert.deepEqual(titles(roster([], { standbyDuties: [sb('airport', '2026-10-05T05:00', '2026-10-05T14:00')] })), ['2026-10-05 over Standby too long']);
  const r = roster([leg('6E 1', 'BLR', 'DEL', '2026-10-06T04:00', 160)], { standbyDuties: [sb('home', '2026-10-05T12:00', '2026-10-05T20:00')] });
  assert.deepEqual(titles(r), ['2026-10-06 over Rest after standby too short']);
});

test('what is not checked is said plainly', () => {
  const report = checkDutyLimits(roster(fourSectors('2026-10-05')));
  assert.ok(report.notChecked.some((s) => /travel to and from the airport/.test(s)));
  assert.equal(report.rules.status, 'in-force');
});

test('duty-limit rules switch off when their review is more than 30 days overdue', () => {
  const rules = RULE_SETS['dgca-cc-iv'];
  const at = (iso: string) => rulesStatus(rules, Date.parse(`${iso}T12:00:00Z`));
  assert.equal(rules.checkedOn, '2026-10-06');
  assert.equal(at('2027-04-06').current, true, 'review due, still in grace period');
  assert.equal(at('2027-05-05').current, true);
  assert.equal(at('2027-05-07').current, false, 'switched off 30 days after the review was due');
  assert.equal(at('2027-05-07').switchOffOn, '2027-05-06');
});
