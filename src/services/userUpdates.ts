import { FlightLeg, RosterData, UserUpdate } from '../types/circadian';
import { flightHomeDate, rosterClock, sectorKeys } from './rosterKeys';

/*
 * THE PERSON'S UPDATES, KEPT APART FROM THE ROSTER
 *
 * Roster truth is what the airline published. A delay the person reports is stored separately, attached
 * to the flight's stable key, and applied on top only when planning. So:
 * - the rostered report time never moves because of a delay (the airline has not changed it);
 * - departure, arrival and release move by the delay, and the plan after the duty follows;
 * - re-uploading the same roster finds no changes (the roster was never edited);
 * - a newer roster keeps the delay while that flight is still on it, and drops it if the flight is gone.
 */

const MIN = 60000;
const shift = (iso: string, minutes: number) => new Date(Date.parse(iso) + minutes * MIN).toISOString();

/** The flight's stable key within its roster, for each flight id. */
function keysById(roster: RosterData): Map<string, string> {
  const keys = sectorKeys(roster.flights, rosterClock(roster));
  return new Map(roster.flights.map((f, i) => [f.id, keys[i]]));
}

export function keyOfFlight(roster: RosterData, flightId: string): string | undefined {
  return keysById(roster).get(flightId);
}

/** The delay the person reported for a flight, in minutes (0 if none). */
export function delayFor(updates: UserUpdate[], sectorKey: string | undefined): number {
  if (!sectorKey) return 0;
  return updates.find((u) => u.kind === 'delay' && u.sectorKey === sectorKey)?.minutes ?? 0;
}

/**
 * Sets the delay for a flight. A delay usually carries through the rest of that duty day, so the same
 * delay is applied to the later flights of the same day unless they already have their own.
 * minutes = 0 removes it.
 */
export function setDelay(roster: RosterData, updates: UserUpdate[], flightId: string, minutes: number, now = new Date()): UserUpdate[] {
  const keys = keysById(roster);
  const clock = rosterClock(roster);
  const flight = roster.flights.find((f) => f.id === flightId);
  const key = keys.get(flightId);
  if (!flight || !key) return updates;
  const day = flightHomeDate(flight, clock);
  const laterSameDay = roster.flights.filter(
    (f) => f.id !== flightId && flightHomeDate(f, clock) === day && Date.parse(f.departureTimeUtc) > Date.parse(flight.departureTimeUtc)
  );
  const previous = delayFor(updates, key);
  const affected = [key, ...laterSameDay.map((f) => keys.get(f.id)!).filter((k) => delayFor(updates, k) === previous)];
  const rest = updates.filter((u) => !(u.kind === 'delay' && affected.includes(u.sectorKey)));
  if (minutes <= 0) return rest;
  return [
    ...rest,
    ...affected.map((sectorKey) => ({ id: `delay-${sectorKey}`, kind: 'delay' as const, sectorKey, minutes: Math.round(minutes), createdAt: now.toISOString() })),
  ];
}

/** The roster with the person's updates applied, for planning. The saved roster is not changed. */
export function effectiveRoster(roster: RosterData, updates: UserUpdate[]): RosterData {
  if (!updates.length) return roster;
  const keys = keysById(roster);
  let changed = false;
  const flights = roster.flights.map((f): FlightLeg => {
    const minutes = delayFor(updates, keys.get(f.id));
    if (!minutes) return f;
    changed = true;
    return {
      ...f,
      departureTimeUtc: shift(f.departureTimeUtc, minutes),
      arrivalTimeUtc: shift(f.arrivalTimeUtc, minutes),
      releaseTimeUtc: shift(f.releaseTimeUtc, minutes),
      // reportTimeUtc stays as rostered
      operationalDelay: { minutes, rosteredDepartureUtc: f.departureTimeUtc, rosteredArrivalUtc: f.arrivalTimeUtc, rosteredReleaseUtc: f.releaseTimeUtc },
    };
  });
  return changed ? { ...roster, flights } : roster;
}

/** After the roster changes: updates whose flight is still on it are kept; the others are dropped. */
export function retainUpdates(roster: RosterData, updates: UserUpdate[]): { kept: UserUpdate[]; dropped: UserUpdate[] } {
  const present = new Set(keysById(roster).values());
  const kept = updates.filter((u) => present.has(u.sectorKey));
  return { kept, dropped: updates.filter((u) => !present.has(u.sectorKey)) };
}

/**
 * Delays saved by earlier versions were written into the roster itself (report time included).
 * Puts those flights back to their rostered times and turns the delay into an update. Runs once on load.
 */
export function migrateLegacyDelays(roster: RosterData, updates: UserUpdate[]): { roster: RosterData; updates: UserUpdate[] } {
  const legacy = roster.flights.filter((f) => f.userChange === 'delayed' && typeof f.userDelayMinutes === 'number' && f.userDelayMinutes !== 0);
  if (!legacy.length) return { roster, updates };
  const flights = roster.flights.map((f) => {
    if (!legacy.includes(f)) return f;
    const m = -(f.userDelayMinutes as number);
    const { userChange: _c, userDelayMinutes: _m, ...rest } = f;
    return { ...rest, departureTimeUtc: shift(f.departureTimeUtc, m), arrivalTimeUtc: shift(f.arrivalTimeUtc, m), reportTimeUtc: shift(f.reportTimeUtc, m), releaseTimeUtc: shift(f.releaseTimeUtc, m) };
  });
  const restored = { ...roster, flights };
  const keys = keysById(restored);
  const added: UserUpdate[] = legacy
    .map((f) => ({ key: keys.get(f.id), minutes: f.userDelayMinutes as number }))
    .filter((x): x is { key: string; minutes: number } => !!x.key && !updates.some((u) => u.sectorKey === x.key))
    .map((x) => ({ id: `delay-${x.key}`, kind: 'delay', sectorKey: x.key, minutes: x.minutes, createdAt: new Date().toISOString() }));
  return { roster: restored, updates: [...updates, ...added] };
}

/** The flight to offer "I'm delayed" for: the next one departing within 24 hours, or the one in progress. */
export function delayCandidate(roster: RosterData, updates: UserUpdate[], nowMs: number): FlightLeg | undefined {
  const keys = keysById(roster);
  return [...roster.flights]
    .sort((a, b) => Date.parse(a.departureTimeUtc) - Date.parse(b.departureTimeUtc))
    .find((f) => {
      const delay = delayFor(updates, keys.get(f.id)) * MIN;
      const arr = Date.parse(f.arrivalTimeUtc) + delay;
      const dep = Date.parse(f.departureTimeUtc);
      return arr > nowMs && dep - nowMs <= 24 * 3600000;
    });
}

/** When the day's duty is now expected to finish: the latest release of this flight and the later ones that day, with delays applied. */
export function expectedDutyRelease(roster: RosterData, updates: UserUpdate[], flightId: string): string | undefined {
  const flight = roster.flights.find((f) => f.id === flightId);
  if (!flight) return undefined;
  const clock = rosterClock(roster);
  const day = flightHomeDate(flight, clock);
  return effectiveRoster(roster, updates)
    .flights.filter((f) => flightHomeDate(f, clock) === day && Date.parse(f.departureTimeUtc) >= Date.parse(flight.departureTimeUtc) - 1)
    .map((f) => f.releaseTimeUtc)
    .sort()
    .pop();
}
