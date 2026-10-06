import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';
import { combineFiles } from '../src/services/rosterDiff';
import { rosterClock, sectorKeys } from '../src/services/rosterKeys';
import { normalizeDutyTimes, dutyChains } from '../src/services/dutyTimes';
import { generateCircadianPlan } from '../src/services/circadianCalculator';
import { computePeriodStats } from '../src/services/periodStats';
import { checkRosterFlights } from '../src/services/rosterChecks';
import { convertPrinted } from '../src/services/rosterTimes';
import type { CrewPreferences, FlightLeg, RosterData } from '../src/types/circadian';

/*
 * GOLDEN ROSTERS: a real crew member's September and October 2026 rosters (names and IDs removed), run through the
 * same steps as an upload of both screenshots together. They pin down numbers she has confirmed (October flying is
 * about 50 h) and rules every plan must keep. If one of these fails, a change has altered real crew results.
 */

const fx = JSON.parse(readFileSync('tests/fixtures/golden-sep-oct-2026.json', 'utf8'));
const clock = rosterClock({ homeBase: fx.homeBase, homeBaseTzOffset: fx.homeBaseTzOffset });
const files = fx.files.map((f: any) => ({ ...f, flights: f.flights.map((l: any) => ({ id: `${l.flightNumber}-${l.departureTimeUtc}`, ...l })) }));
const { content } = combineFiles(files, clock);
const roster: RosterData = {
  id: 'golden', airline: 'IndiGo', homeBase: 'BLR', homeBaseTzOffset: 5.5, layovers: [], parsedAt: '',
  flights: normalizeDutyTimes(content.flights), standbyDuties: content.standby, otherDuties: content.otherDuties,
  periodStart: '2026-09-01', periodEnd: '2026-10-21',
};
const prefs = {
  homeBaseIata: 'BLR', homeBaseTzOffset: 5.5, chronotype: 'intermediate', targetSleepHours: 7.5, caffeineCutoffHours: 6,
  groomingMinutes: 60, cabBufferMinutes: 60, crewRank: 'senior', currency: 'INR',
} as CrewPreferences;
const plan = generateCircadianPlan(roster, prefs);
const ms = Date.parse;

test('golden: monthly totals match what the crew member confirmed', () => {
  // September's screenshot also shows 1–2 October; those days belong to the October roster and count once
  assert.equal(roster.flights.length, 64);
  assert.equal(new Set(sectorKeys(roster.flights, clock)).size, 64, 'no flight counted twice');
  assert.equal(computePeriodStats(plan, { start: '2026-10-01', end: '2026-10-31' }).flyingHours, 49.9);
  assert.equal(computePeriodStats(plan, { start: '2026-09-01', end: '2026-09-30' }).flyingHours, 68);
});

test('golden: check-in on the first flight of each duty, sign-off on the last, nothing in between', () => {
  for (const chain of dutyChains(roster.flights)) {
    chain.forEach((f, i) => {
      if (i > 0) assert.equal(f.reportTimeUtc, f.departureTimeUtc, `${f.flightNumber}: no separate check-in mid-duty`);
      if (i < chain.length - 1) assert.equal(f.releaseTimeUtc, f.arrivalTimeUtc, `${f.flightNumber}: no sign-off mid-duty`);
    });
    const first = chain[0];
    const last = chain[chain.length - 1];
    assert.ok(ms(first.reportTimeUtc) < ms(first.departureTimeUtc), 'check-in before departure');
    assert.ok(ms(last.releaseTimeUtc) >= ms(last.arrivalTimeUtc), 'sign-off after landing');
  }
  // Nothing the reader got that needs fixing (notes worth a second look are allowed)
  for (const list of checkRosterFlights(roster.flights).values()) assert.ok(list.every((i) => i.level !== 'problem'), list.map((i) => i.message).join('; '));
});

test('golden: no planned sleep overlaps a duty, and every duty has a wake-up before leaving', () => {
  const duties = dutyChains(roster.flights).map((c) => [ms(c[0].reportTimeUtc), ms(c[c.length - 1].releaseTimeUtc)]);
  const sleeps = plan.events.filter((e) => e.type === 'anchor_sleep' || e.type === 'recovery_sleep' || e.type === 'nasa_nap');
  for (const s of sleeps) {
    for (const [from, to] of duties) assert.ok(ms(s.endUtc) <= from || ms(s.startUtc) >= to, `${s.title} ${s.startHbtStr}–${s.endHbtStr} overlaps a duty`);
  }
  for (const p of plan.events.filter((e) => e.type === 'pre_flight_prep' && e.prepDetails?.wakeUpUtc)) {
    const d = p.prepDetails!;
    assert.ok(ms(d.wakeUpUtc!) < ms(d.cabPickupUtc!), `${p.dutyDate}: wake before leaving`);
  }
});

test('golden: every caffeine cut-off and exercise note ends when a sleep starts; alcohol stops 12 h before each duty', () => {
  const sleepStarts = new Set(plan.events.filter((e) => e.type === 'anchor_sleep' || e.type === 'recovery_sleep').map((e) => e.startUtc));
  for (const e of plan.events.filter((x) => x.type === 'caffeine_cutoff' || x.type === 'exercise_cutoff')) assert.ok(sleepStarts.has(e.endUtc), `${e.title} ends at a sleep`);
  const alcohol = plan.events.filter((e) => e.type === 'alcohol_cutoff');
  // One before each flying duty and each standby (an airport standby is a duty of its own; none here led to a callout)
  assert.equal(alcohol.length, dutyChains(roster.flights).length + (roster.standbyDuties ?? []).length);
  for (const a of alcohol) assert.equal(ms(a.endUtc) - ms(a.startUtc), 12 * 3600000);
});

test('golden: "No duty" only on days with nothing on the roster', () => {
  const busy = new Set([...roster.flights.map((f) => clock.date(ms(f.departureTimeUtc))), ...(roster.standbyDuties ?? []).map((s) => clock.date(ms(s.startUtc)))]);
  const noDuty = plan.dailySummaries.filter((d) => d.noDuty);
  assert.ok(noDuty.length > 0);
  for (const d of noDuty) assert.ok(!busy.has(d.dateStr), `${d.dateStr} has duties`);
});

test('daylight saving: a London arrival printed in local time uses summer or winter time on the right date', () => {
  const at = (date: string) => {
    const c = convertPrinted({ date, dep: '13:00', arr: '18:00' }, { origin: 'DEL', destination: 'LHR' }, 'local', 'DEL');
    assert.ok(!('error' in c));
    return (c as { arrivalTimeUtc: string }).arrivalTimeUtc.slice(11, 16);
  };
  assert.equal(at('2026-10-24'), '17:00', 'British Summer Time (UTC+1) before 25 October 2026');
  assert.equal(at('2026-10-26'), '18:00', 'GMT (UTC+0) after the clocks go back');
});
