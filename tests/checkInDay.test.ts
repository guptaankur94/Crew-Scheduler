import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeDutyTimes } from '../src/services/dutyTimes';
import { flightHomeDate, rosterClock } from '../src/services/rosterKeys';
import { generateCircadianPlan } from '../src/services/circadianCalculator';
import { findingsByDate } from '../src/services/rosterFindings';
import { applyImport, diffRoster, importScope } from '../src/services/rosterDiff';
import type { CrewPreferences, FlightLeg, RosterData } from '../src/types/circadian';

/*
 * A DUTY BELONGS TO ITS CHECK-IN DAY, as rosters print it. Real case (1 Oct 2026, IndiGo, times in BLR):
 * check-in 22:20 in Dubai, 6E 1486 DXB→BLR departs 00:07 +1, lands 03:56 +1, debrief 04:56 +1. The roster lists it
 * under "01 Thu"; the app had shown 1 Oct as "No duty" and put the duty on 2 Oct.
 */

const ist = (s: string) => new Date(Date.parse(`${s}:00+05:30`)).toISOString();
const flight = (id: string, from: string, to: string, report: string, dep: string, arr: string, release: string): FlightLeg => ({
  id, flightNumber: id, origin: from, destination: to,
  reportTimeUtc: ist(report), departureTimeUtc: ist(dep), arrivalTimeUtc: ist(arr), releaseTimeUtc: ist(release),
  originTzOffset: 4, destTzOffset: 5.5, durationMinutes: Math.round((Date.parse(ist(arr)) - Date.parse(ist(dep))) / 60000),
});
const roster = (flights: FlightLeg[], extra: Partial<RosterData> = {}): RosterData => ({
  id: 'r', airline: 'IndiGo', homeBase: 'BLR', homeBaseTzOffset: 5.5, layovers: [], parsedAt: '', flights: normalizeDutyTimes(flights), ...extra,
});
const prefs = { homeBaseIata: 'BLR', homeBaseTzOffset: 5.5, chronotype: 'intermediate', targetSleepHours: 7.5, caffeineCutoffHours: 6, groomingMinutes: 60, cabBufferMinutes: 60 } as CrewPreferences;
const dxb = () => flight('6E 1486', 'DXB', 'BLR', '2026-10-01T22:20', '2026-10-02T00:07', '2026-10-02T03:56', '2026-10-02T04:56');
const clock = rosterClock({ homeBase: 'BLR', homeBaseTzOffset: 5.5 });

test('a 22:20 check-in for a 00:07 departure is a duty on the check-in day', () => {
  const r = roster([dxb()], { periodStart: '2026-10-01', periodEnd: '2026-10-03', otherDuties: [{ id: 'o', kind: 'off', date: '2026-10-03' }] });
  assert.equal(flightHomeDate(r.flights[0], clock), '2026-10-01');
  const plan = generateCircadianPlan(r, prefs);
  const day1 = plan.dailySummaries.find((d) => d.dateStr === '2026-10-01')!;
  assert.equal(day1.dutyType, 'flight');
  assert.notEqual(day1.noDuty, true);
  // Not flagged as a blank day; 2 Oct (the same duty ends that morning) is not blank either
  const blanks = [...findingsByDate(r, null, { from: '2026-10-01', to: '2026-10-03' }).entries()].filter(([, l]) => l.some((f) => f.kind === 'blank')).map(([d]) => d);
  assert.deepEqual(blanks, []);
});

test('across months: a duty checking in late on 30 Sep stays when the October roster (which does not show it) is uploaded', () => {
  const lastSep = flight('6E 1999', 'DXB', 'BLR', '2026-09-30T22:20', '2026-10-01T00:07', '2026-10-01T03:56', '2026-10-01T04:56');
  const saved = roster([lastSep], { periodStart: '2026-09-01', periodEnd: '2026-09-30' });
  const oct = normalizeDutyTimes([flight('6E 836', 'BLR', 'DEL', '2026-10-03T04:05', '2026-10-03T04:56', '2026-10-03T07:35', '2026-10-03T08:05')]);
  const days = Array.from({ length: 21 }, (_, i) => `2026-10-${String(i + 1).padStart(2, '0')}`);
  const upload = { flights: oct, standby: [], otherDuties: [], periodStart: '2026-10-01', periodEnd: '2026-10-31', visibleDates: days };
  const scope = importScope(upload, saved, clock)!;
  const applied = applyImport(saved, upload, scope.dates, diffRoster(saved, upload, scope.dates, clock), clock);
  assert.deepEqual(applied.flights.map((f) => f.flightNumber).sort(), ['6E 1999', '6E 836'], 'September\'s last duty is kept');
});
