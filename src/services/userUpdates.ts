import { FlightLeg, RosterData, StandbyDuty, UserUpdate } from '../types/circadian';
import { flightHomeDate, rosterClock, sectorKeys, standbyHomeDate, standbyKeys } from './rosterKeys';
import { DUTY_SPLIT_GAP_HOURS } from './planEngine';

/*
 * THE PERSON'S UPDATES, KEPT APART FROM THE ROSTER
 *
 * Roster truth is what the airline published. What the person reports happened (a delay, a standby moved,
 * released early or cancelled, a callout) is stored separately, attached to stable keys, and applied on top
 * only when planning. So:
 * - the rostered report time never moves because of a delay (the airline has not changed it);
 * - re-uploading the same roster finds no changes (the roster was never edited);
 * - a newer roster keeps an update while what it refers to is still on the roster, and a callout is
 *   "confirmed" (and retired) once the roster itself shows the callout flights.
 */

const MIN = 60000;
const shift = (iso: string, minutes: number) => new Date(Date.parse(iso) + minutes * MIN).toISOString();
const now = () => new Date().toISOString();

type Delay = Extract<UserUpdate, { kind: 'delay' }>;
type Callout = Extract<UserUpdate, { kind: 'callout' }>;
type Cancelled = Extract<UserUpdate, { kind: 'cancelled' }>;
type StandbyUpdate = Extract<UserUpdate, { standbyKey?: string }> & { standbyKey: string };
const isDelay = (u: UserUpdate): u is Delay => u.kind === 'delay';
const isCallout = (u: UserUpdate): u is Callout => u.kind === 'callout';
const isCancelled = (u: UserUpdate): u is Cancelled => u.kind === 'cancelled';
const isStandbyUpdate = (u: UserUpdate): u is StandbyUpdate => 'standbyKey' in u && typeof u.standbyKey === 'string';

// ─── Keys ──────────────────────────────────────────────────────────────────────

/** The roster's flights plus any callout flights the person added, which can be delayed like any other. */
function withCalloutFlights(roster: RosterData, updates: UserUpdate[]): RosterData {
  const extra = updates.filter(isCallout).flatMap((u) => u.flights);
  return extra.length ? { ...roster, flights: [...roster.flights, ...extra] } : roster;
}

/**
 * The flights after this one in the same duty: each following sector that reports less than
 * DUTY_SPLIT_GAP_HOURS after the previous one is released (the planner's own duty rule), so a duty that
 * runs past midnight is still one duty.
 */
function laterInSameDuty(flights: FlightLeg[], flight: FlightLeg): FlightLeg[] {
  const sorted = [...flights].sort((a, b) => Date.parse(a.departureTimeUtc) - Date.parse(b.departureTimeUtc));
  const out: FlightLeg[] = [];
  let prev = flight;
  for (const f of sorted.slice(sorted.indexOf(flight) + 1)) {
    if (Date.parse(f.reportTimeUtc) - Date.parse(prev.releaseTimeUtc) >= DUTY_SPLIT_GAP_HOURS * 3600000) break;
    out.push(f);
    prev = f;
  }
  return out;
}

function keysById(roster: RosterData): Map<string, string> {
  const keys = sectorKeys(roster.flights, rosterClock(roster));
  return new Map(roster.flights.map((f, i) => [f.id, keys[i]]));
}

function standbyKeysById(roster: RosterData): Map<string, string> {
  const list = roster.standbyDuties ?? [];
  const keys = standbyKeys(list, rosterClock(roster));
  return new Map(list.map((sb, i) => [sb.id, keys[i]]));
}

export function keyOfFlight(roster: RosterData, flightId: string, updates: UserUpdate[] = []): string | undefined {
  return keysById(withCalloutFlights(roster, updates)).get(flightId);
}

export function keyOfStandby(roster: RosterData, standbyId: string): string | undefined {
  return standbyKeysById(roster).get(standbyId);
}

// ─── Delays ────────────────────────────────────────────────────────────────────

/** The delay the person reported for a flight, in minutes (0 if none). */
export function delayFor(updates: UserUpdate[], sectorKey: string | undefined): number {
  if (!sectorKey) return 0;
  return updates.filter(isDelay).find((u) => u.sectorKey === sectorKey)?.minutes ?? 0;
}

/**
 * Sets the delay for a flight. A delay usually carries through the rest of that duty day, so the same
 * delay is applied to the later flights of the same day unless they already have their own.
 * minutes = 0 removes it.
 */
export function setDelay(roster: RosterData, updates: UserUpdate[], flightId: string, minutes: number): UserUpdate[] {
  const all = withCalloutFlights(roster, updates);
  const keys = keysById(all);
  const flight = all.flights.find((f) => f.id === flightId);
  const key = keys.get(flightId);
  if (!flight || !key) return updates;
  const previous = delayFor(updates, key);
  const affected = [key, ...laterInSameDuty(all.flights, flight).map((f) => keys.get(f.id)!).filter((k) => delayFor(updates, k) === previous)];
  const rest = updates.filter((u) => !(isDelay(u) && affected.includes(u.sectorKey)));
  if (minutes <= 0) return rest;
  return [...rest, ...affected.map((sectorKey) => ({ id: `delay-${sectorKey}`, kind: 'delay' as const, sectorKey, minutes: Math.round(minutes), createdAt: now() }))];
}

// ─── Standby ───────────────────────────────────────────────────────────────────

/** The update the person made to a standby, if any (times changed, released, or called out). */
export function standbyUpdate(updates: UserUpdate[], standbyKey: string | undefined): UserUpdate | undefined {
  if (!standbyKey) return undefined;
  return updates.find((u) => isStandbyUpdate(u) && u.standbyKey === standbyKey);
}

/** Replaces whatever the person had recorded for this standby (one update per standby). */
function replaceStandbyUpdate(updates: UserUpdate[], standbyKey: string, next?: UserUpdate): UserUpdate[] {
  const rest = updates.filter((u) => !isStandbyUpdate(u) || u.standbyKey !== standbyKey);
  return next ? [...rest, next] : rest;
}

export function setStandbyTimes(updates: UserUpdate[], standbyKey: string, startUtc: string, endUtc: string): UserUpdate[] {
  return replaceStandbyUpdate(updates, standbyKey, { id: `sbt-${standbyKey}`, kind: 'standby_times', standbyKey, startUtc, endUtc, createdAt: now() });
}

export function releaseStandby(updates: UserUpdate[], standbyKey: string, atUtc: string): UserUpdate[] {
  return replaceStandbyUpdate(updates, standbyKey, { id: `sbr-${standbyKey}`, kind: 'standby_released', standbyKey, atUtc, createdAt: now() });
}

/** Called out from a standby (or, without one, an ad hoc duty) to one or more flights. */
export function addCallout(updates: UserUpdate[], flights: FlightLeg[], standbyKey?: string): UserUpdate[] {
  const tagged = flights.map((f) => ({ ...f, userChange: 'callout' as const }));
  const callout: Callout = { id: `callout-${standbyKey ?? tagged[0]?.id}`, kind: 'callout', ...(standbyKey ? { standbyKey } : {}), flights: tagged, createdAt: now() };
  return standbyKey ? replaceStandbyUpdate(updates, standbyKey, callout) : [...updates, callout];
}

export function clearStandbyUpdate(updates: UserUpdate[], standbyKey: string): UserUpdate[] {
  return replaceStandbyUpdate(updates, standbyKey);
}

// ─── Applying updates ──────────────────────────────────────────────────────────

/** The roster with the person's updates applied, for planning. The saved roster is not changed. */
export function effectiveRoster(roster: RosterData, updates: UserUpdate[]): RosterData {
  if (!updates.length) return roster;
  const sbKeys = standbyKeysById(roster);

  // 1. Standby: moved, released (or cancelled), or ended by a callout's first report
  const standby: StandbyDuty[] = [];
  for (const sb of roster.standbyDuties ?? []) {
    const u = standbyUpdate(updates, sbKeys.get(sb.id));
    let { startUtc, endUtc } = sb;
    if (u?.kind === 'standby_times') ({ startUtc, endUtc } = u);
    if (u?.kind === 'standby_released' && Date.parse(u.atUtc) < Date.parse(endUtc)) endUtc = u.atUtc;
    if (u?.kind === 'callout' && u.flights.length) {
      const firstReport = Math.min(...u.flights.map((f) => Date.parse(f.reportTimeUtc)));
      if (firstReport < Date.parse(endUtc)) endUtc = new Date(firstReport).toISOString();
    }
    if (Date.parse(endUtc) > Date.parse(startUtc)) standby.push(u ? { ...sb, startUtc, endUtc } : sb);
  }

  // 2. Flights: the roster's, plus callout flights, with delays applied
  const all = withCalloutFlights(roster, updates);
  const keys = keysById(all);
  const cancelled = new Set(updates.filter(isCancelled).map((u) => u.sectorKey));
  const flights = all.flights
    .filter((f) => !cancelled.has(keys.get(f.id)!))
    .map((f): FlightLeg => {
      const minutes = delayFor(updates, keys.get(f.id));
      if (!minutes) return f;
      return {
        ...f,
        departureTimeUtc: shift(f.departureTimeUtc, minutes),
        arrivalTimeUtc: shift(f.arrivalTimeUtc, minutes),
        releaseTimeUtc: shift(f.releaseTimeUtc, minutes),
        // reportTimeUtc stays as rostered
        operationalDelay: { minutes, rosteredDepartureUtc: f.departureTimeUtc, rosteredArrivalUtc: f.arrivalTimeUtc, rosteredReleaseUtc: f.releaseTimeUtc },
      };
    })
    .sort((a, b) => Date.parse(a.departureTimeUtc) - Date.parse(b.departureTimeUtc));

  return { ...roster, flights, standbyDuties: standby };
}

/**
 * After the roster changes:
 * - a delay is kept while its flight is still on the roster (callout flights count);
 * - a standby change is kept while that standby is still on the roster;
 * - a callout is confirmed and retired once the roster itself shows all its flights; otherwise it is kept,
 *   because the person said it happened.
 */
export function retainUpdates(roster: RosterData, updates: UserUpdate[]): { kept: UserUpdate[]; dropped: UserUpdate[]; confirmed: UserUpdate[] } {
  const rosterFlightKeys = new Set(keysById(roster).values());
  const rosterStandbyKeys = new Set(standbyKeysById(roster).values());
  const kept: UserUpdate[] = [];
  const dropped: UserUpdate[] = [];
  const confirmed: UserUpdate[] = [];
  const clock = rosterClock(roster);
  // Keys of callout flights that stay in force, so their delays are kept too
  const calloutKeys = new Set<string>();
  for (const u of updates.filter(isCallout)) {
    const keys = sectorKeys(u.flights, clock);
    if (keys.length && keys.every((k) => rosterFlightKeys.has(k))) confirmed.push(u);
    else {
      kept.push(u);
      keys.forEach((k) => calloutKeys.add(k));
    }
  }
  for (const u of updates) {
    if (isCallout(u)) continue;
    const present =
      isDelay(u) || isCancelled(u) ? rosterFlightKeys.has(u.sectorKey) || calloutKeys.has(u.sectorKey) : isStandbyUpdate(u) && rosterStandbyKeys.has(u.standbyKey);
    (present ? kept : dropped).push(u);
  }
  return { kept, dropped, confirmed };
}

/**
 * Delays (and callouts) saved by earlier versions were written into the roster itself. Puts delayed
 * flights back to their rostered times and turns the delay into an update; moves callout flights that sit
 * on a standby day into a callout update. Runs once on load.
 */
export function migrateLegacyDelays(roster: RosterData, updates: UserUpdate[]): { roster: RosterData; updates: UserUpdate[] } {
  let current = roster;
  let next = updates;

  const legacyDelays = current.flights.filter((f) => f.userChange === 'delayed' && typeof f.userDelayMinutes === 'number' && f.userDelayMinutes !== 0);
  if (legacyDelays.length) {
    const flights = current.flights.map((f) => {
      if (!legacyDelays.includes(f)) return f;
      const m = -(f.userDelayMinutes as number);
      const { userChange: _c, userDelayMinutes: _m, ...rest } = f;
      return { ...rest, departureTimeUtc: shift(f.departureTimeUtc, m), arrivalTimeUtc: shift(f.arrivalTimeUtc, m), reportTimeUtc: shift(f.reportTimeUtc, m), releaseTimeUtc: shift(f.releaseTimeUtc, m) };
    });
    current = { ...current, flights };
    const keys = keysById(current);
    for (const f of legacyDelays) {
      const key = keys.get(f.id);
      if (key && !delayFor(next, key)) next = [...next, { id: `delay-${key}`, kind: 'delay', sectorKey: key, minutes: f.userDelayMinutes as number, createdAt: now() }];
    }
  }

  const clock = rosterClock(current);
  const sbKeys = standbyKeysById(current);
  const legacyCallouts = current.flights.filter((f) => f.userChange === 'callout');
  for (const f of legacyCallouts) {
    const sb = (current.standbyDuties ?? []).find((s) => standbyHomeDate(s, clock) === flightHomeDate(f, clock));
    const key = sb && sbKeys.get(sb.id);
    if (!key || standbyUpdate(next, key)) continue;
    current = { ...current, flights: current.flights.filter((x) => x.id !== f.id) };
    const sameDay = legacyCallouts.filter((x) => flightHomeDate(x, clock) === flightHomeDate(f, clock) && current.flights.includes(x));
    current = { ...current, flights: current.flights.filter((x) => !sameDay.includes(x)) };
    next = addCallout(next, [f, ...sameDay], key);
  }
  return current === roster && next === updates ? { roster, updates } : { roster: current, updates: next };
}

// ─── What Today offers ─────────────────────────────────────────────────────────

/** The flight to offer "I'm delayed" for: the next one departing within 24 hours, or the one in progress. */
export function delayCandidate(roster: RosterData, updates: UserUpdate[], nowMs: number): FlightLeg | undefined {
  const all = withCalloutFlights(roster, updates);
  const keys = keysById(all);
  const cancelled = new Set(updates.filter(isCancelled).map((u) => u.sectorKey));
  return [...all.flights]
    .sort((a, b) => Date.parse(a.departureTimeUtc) - Date.parse(b.departureTimeUtc))
    .find((f) => {
      if (cancelled.has(keys.get(f.id)!)) return false;
      const delay = delayFor(updates, keys.get(f.id)) * MIN;
      const arr = Date.parse(f.arrivalTimeUtc) + delay;
      const dep = Date.parse(f.departureTimeUtc);
      return arr > nowMs && dep - nowMs <= 24 * 3600000;
    });
}

/** The rostered standby to offer quick edits for: one starting within 24 hours, or in progress. */
export function standbyCandidate(roster: RosterData, nowMs: number): StandbyDuty | undefined {
  return [...(roster.standbyDuties ?? [])]
    .sort((a, b) => Date.parse(a.startUtc) - Date.parse(b.startUtc))
    .find((sb) => Date.parse(sb.endUtc) > nowMs && Date.parse(sb.startUtc) - nowMs <= 24 * 3600000);
}

/** When this duty is now expected to finish: the latest release of this flight and the rest of its duty, with delays applied. */
export function expectedDutyRelease(roster: RosterData, updates: UserUpdate[], flightId: string): string | undefined {
  const eff = effectiveRoster(roster, updates);
  const flight = eff.flights.find((f) => f.id === flightId);
  if (!flight) return undefined;
  return [flight, ...laterInSameDuty(eff.flights, flight)].map((f) => f.releaseTimeUtc).sort().pop();
}

/** All flights including callout flights the person added (for finding a flight by id). */
export function allFlights(roster: RosterData, updates: UserUpdate[]): FlightLeg[] {
  return withCalloutFlights(roster, updates).flights;
}

/** Removes one callout flight (cancelled or deleted); a callout with no flights left is removed. */
export function removeCalloutFlight(updates: UserUpdate[], flightId: string): UserUpdate[] {
  return updates.flatMap((u) => {
    if (!isCallout(u) || !u.flights.some((f) => f.id === flightId)) return [u];
    const flights = u.flights.filter((f) => f.id !== flightId);
    return flights.length ? [{ ...u, flights }] : [];
  });
}

/** The rostered standby on the same home day as a flight, preferring one that overlaps it. */
export function standbyForFlight(roster: RosterData, flight: FlightLeg): StandbyDuty | undefined {
  const clock = rosterClock(roster);
  const day = flightHomeDate(flight, clock);
  const sameDay = (roster.standbyDuties ?? []).filter((sb) => standbyHomeDate(sb, clock) === day);
  const dep = Date.parse(flight.reportTimeUtc);
  return sameDay.find((sb) => Date.parse(sb.startUtc) <= dep && dep < Date.parse(sb.endUtc)) ?? sameDay[0];
}

// ─── Cancelled flights ─────────────────────────────────────────────────────────

/**
 * Marks a rostered flight as not operated. The roster keeps it (so a re-upload still matches and it can be
 * reinstated); the plan leaves it out, so you rest wherever the remaining duties leave you, at home or at
 * the outstation. Any delay reported for it no longer matters and is removed.
 */
export function cancelFlight(roster: RosterData, updates: UserUpdate[], flightId: string): UserUpdate[] {
  const key = keysById(roster).get(flightId);
  if (!key) return updates;
  const rest = updates.filter((u) => !((isDelay(u) || isCancelled(u)) && u.sectorKey === key));
  return [...rest, { id: `cancelled-${key}`, kind: 'cancelled', sectorKey: key, createdAt: now() }];
}

export function reinstateFlight(updates: UserUpdate[], sectorKey: string): UserUpdate[] {
  return updates.filter((u) => !(isCancelled(u) && u.sectorKey === sectorKey));
}

/** Rostered flights the person marked as cancelled, with their keys (for showing and reinstating them). */
export function cancelledFlights(roster: RosterData, updates: UserUpdate[]): { flight: FlightLeg; sectorKey: string }[] {
  const cancelled = new Set(updates.filter(isCancelled).map((u) => u.sectorKey));
  if (!cancelled.size) return [];
  const keys = keysById(roster);
  return roster.flights.filter((f) => cancelled.has(keys.get(f.id)!)).map((f) => ({ flight: f, sectorKey: keys.get(f.id)! }));
}

/** The person's updates per home date, in plain words (for the Month screen's day panel). */
export function updateLinesByDate(roster: RosterData, updates: UserUpdate[]): Map<string, string[]> {
  const clock = rosterClock(roster);
  const out = new Map<string, string[]>();
  const add = (date: string, line: string) => out.set(date, [...(out.get(date) ?? []), line]);
  const route = (key: string) => {
    const [, fn, o, d] = key.split('#')[0].split('|');
    return `${fn} ${o}→${d}`;
  };
  for (const u of updates) {
    if (u.kind === 'delay') add(u.sectorKey.slice(0, 10), `Delayed +${u.minutes} min: ${route(u.sectorKey)}`);
    else if (u.kind === 'cancelled') add(u.sectorKey.slice(0, 10), `Cancelled: ${route(u.sectorKey)}`);
    else if (u.kind === 'standby_times') add(u.standbyKey.slice(0, 10), `Standby moved to ${clock.time(Date.parse(u.startUtc))}–${clock.time(Date.parse(u.endUtc))}`);
    else if (u.kind === 'standby_released') add(u.standbyKey.slice(0, 10), `Released from standby at ${clock.time(Date.parse(u.atUtc))}`);
    else if (u.kind === 'callout') {
      const date = u.standbyKey?.slice(0, 10) ?? (u.flights[0] ? flightHomeDate(u.flights[0], clock) : '');
      if (date) add(date, `Called out: ${u.flights.map((f) => `${f.flightNumber} ${f.origin}→${f.destination} ${clock.time(Date.parse(f.departureTimeUtc))}`).join(', ')}`);
    }
  }
  return out;
}

/** Removes the person's updates on the given home dates (when restoring an upload with "also clear my updates"). */
export function dropUpdatesOn(roster: RosterData, updates: UserUpdate[], dates: string[]): UserUpdate[] {
  const set = new Set(dates);
  const clock = rosterClock(roster);
  return updates.filter((u) => {
    const date =
      u.kind === 'delay' || u.kind === 'cancelled'
        ? u.sectorKey.slice(0, 10)
        : u.kind === 'callout'
        ? u.standbyKey?.slice(0, 10) ?? (u.flights[0] ? flightHomeDate(u.flights[0], clock) : '')
        : u.standbyKey.slice(0, 10);
    return !set.has(date);
  });
}
