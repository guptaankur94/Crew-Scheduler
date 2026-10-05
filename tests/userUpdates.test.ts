import { test } from 'node:test';
import assert from 'node:assert/strict';
import { delayCandidate, delayFor, effectiveRoster, keyOfFlight, migrateLegacyDelays, retainUpdates, setDelay } from '../src/services/userUpdates';
import { diffRoster, hasNoChanges, importScope } from '../src/services/rosterDiff';
import { rosterClock } from '../src/services/rosterKeys';
import { generateCircadianPlan } from '../src/services/circadianCalculator';
import { flightSource } from '../src/services/provenance';
import type { CrewPreferences, FlightLeg, RosterData, UserUpdate } from '../src/types/circadian';

/*
 * The person's updates (delays) are kept apart from the roster: the roster stays as the airline
 * published it, the rostered report time never moves, and the plan uses the later times on top.
 */

const prefs = {
  homeBaseIata: 'BLR', homeBaseTzOffset: 5.5, chronotype: 'intermediate', targetSleepHours: 7.5, caffeineCutoffHours: 6,
  groomingMinutes: 60, cabBufferMinutes: 60, crewRank: 'senior', currency: 'INR',
} as CrewPreferences;
let n = 0;
const leg = (fn: string, from: string, to: string, depIst: string, minutes: number, extra: Partial<FlightLeg> = {}): FlightLeg => {
  const dep = Date.parse(`${depIst}:00+05:30`);
  return {
    id: `f${++n}`, flightNumber: fn, origin: from, destination: to,
    departureTimeUtc: new Date(dep).toISOString(), arrivalTimeUtc: new Date(dep + minutes * 60000).toISOString(),
    reportTimeUtc: new Date(dep - 60 * 60000).toISOString(), releaseTimeUtc: new Date(dep + (minutes + 30) * 60000).toISOString(),
    originTzOffset: 5.5, destTzOffset: 5.5, durationMinutes: minutes, ...extra,
  };
};
const roster = (flights: FlightLeg[]): RosterData => ({ id: 'r', airline: 'IndiGo', homeBase: 'BLR', homeBaseTzOffset: 5.5, flights, layovers: [], parsedAt: '' });
const day = () => roster([leg('6E 408', 'BLR', 'PNQ', '2026-10-02T17:40', 90), leg('6E 391', 'PNQ', 'BLR', '2026-10-02T20:00', 100), leg('6E 9', 'BLR', 'MAA', '2026-10-03T08:00', 60)]);
const minutesBetween = (a: string, b: string) => (Date.parse(b) - Date.parse(a)) / 60000;

test('a delay moves departure, arrival and release; the rostered report time and the saved roster do not change', () => {
  const r = day();
  const before = JSON.stringify(r);
  const updates = setDelay(r, [], r.flights[0].id, 45);
  const eff = effectiveRoster(r, updates);
  const [first, second, nextDay] = eff.flights;
  assert.equal(first.reportTimeUtc, r.flights[0].reportTimeUtc, 'report stays as rostered');
  assert.equal(minutesBetween(r.flights[0].departureTimeUtc, first.departureTimeUtc), 45);
  assert.equal(minutesBetween(r.flights[0].releaseTimeUtc, first.releaseTimeUtc), 45);
  assert.equal(first.operationalDelay?.rosteredDepartureUtc, r.flights[0].departureTimeUtc);
  assert.equal(second.operationalDelay?.minutes, 45, 'the delay carries through the rest of the day');
  assert.equal(nextDay.operationalDelay, undefined, 'not into the next day');
  assert.equal(JSON.stringify(r), before, 'saved roster untouched');
  assert.match(flightSource(first)!, /delayed \+45 min \(you\)$/);
});

test('the plan uses the delay: the duty ends later and the wake-up before it does not move', () => {
  const r = day();
  const plain = generateCircadianPlan(r, prefs);
  const delayed = generateCircadianPlan(effectiveRoster(r, setDelay(r, [], r.flights[0].id, 60)), prefs);
  const prep = (p: typeof plain) => p.dailySummaries.find((d) => d.dateStr === '2026-10-02')!.prepDetails!;
  assert.equal(prep(delayed).reportHbt, prep(plain).reportHbt);
  assert.equal(prep(delayed).wakeUpHbt, prep(plain).wakeUpHbt);
  const release = (p: typeof plain) => p.events.filter((e) => e.id.startsWith('duty-release-')).map((e) => e.endUtc).sort().find((t) => t.startsWith('2026-10-02'));
  assert.equal(minutesBetween(release(plain)!, release(delayed)!), 60);
});

test('changing or removing a delay; a later flight with its own delay keeps it', () => {
  const r = day();
  let u = setDelay(r, [], r.flights[1].id, 20); // second flight delayed on its own
  u = setDelay(r, u, r.flights[0].id, 45);
  assert.equal(delayFor(u, keyOfFlight(r, r.flights[0].id)), 45);
  assert.equal(delayFor(u, keyOfFlight(r, r.flights[1].id)), 20, 'its own delay is kept');
  u = setDelay(r, u, r.flights[0].id, 0);
  assert.equal(delayFor(u, keyOfFlight(r, r.flights[0].id)), 0);
});

test('re-uploading the same roster with a delay in place finds no changes (the roster was never edited)', () => {
  const r = day();
  setDelay(r, [], r.flights[0].id, 45);
  const upload = { flights: day().flights, visibleDates: ['2026-10-02', '2026-10-03'] };
  const clock = rosterClock(r);
  const scope = importScope(upload, r, clock)!;
  assert.equal(hasNoChanges(diffRoster(r, upload, scope.dates, clock), scope), true);
});

test('a newer roster keeps a delay while its flight is still there, and drops it when the flight is gone', () => {
  const r = day();
  const u = setDelay(r, [], r.flights[2].id, 30);
  assert.equal(retainUpdates(roster([leg('6E 9', 'BLR', 'MAA', '2026-10-03T08:10', 60)]), u).kept.length, 1, 'same flight, new time: kept');
  assert.equal(retainUpdates(roster([leg('6E 77', 'BLR', 'GOI', '2026-10-03T08:00', 60)]), u).dropped.length, 1);
});

test('delays saved by earlier versions inside the roster are put back to rostered times and become updates', () => {
  const rostered = leg('6E 408', 'BLR', 'PNQ', '2026-10-02T17:40', 90);
  const shifted = (iso: string) => new Date(Date.parse(iso) + 45 * 60000).toISOString();
  const legacy = { ...rostered, departureTimeUtc: shifted(rostered.departureTimeUtc), arrivalTimeUtc: shifted(rostered.arrivalTimeUtc), reportTimeUtc: shifted(rostered.reportTimeUtc), releaseTimeUtc: shifted(rostered.releaseTimeUtc), userChange: 'delayed' as const, userDelayMinutes: 45 };
  const { roster: fixed, updates } = migrateLegacyDelays(roster([legacy]), []);
  assert.equal(fixed.flights[0].reportTimeUtc, rostered.reportTimeUtc);
  assert.equal(fixed.flights[0].userChange, undefined);
  assert.equal(updates.length, 1);
  assert.equal(updates[0].minutes, 45);
  assert.deepEqual(migrateLegacyDelays(fixed, updates), { roster: fixed, updates }, 'runs once');
});

test('"I\'m delayed" is offered for the next flight within 24 hours, or the one in progress', () => {
  const r = day();
  const at = (ist: string) => Date.parse(`${ist}:00+05:30`);
  assert.equal(delayCandidate(r, [], at('2026-10-02T10:00'))?.flightNumber, '6E 408');
  assert.equal(delayCandidate(r, [], at('2026-10-02T18:30'))?.flightNumber, '6E 408', 'in progress');
  const u: UserUpdate[] = setDelay(r, [], r.flights[0].id, 60);
  assert.equal(delayCandidate(r, u, at('2026-10-02T19:30'))?.flightNumber, '6E 408', 'still in the air because of the delay');
  assert.equal(delayCandidate(r, [], at('2026-09-30T10:00')), undefined, 'nothing within 24 hours');
});
