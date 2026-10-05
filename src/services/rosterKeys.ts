import { CrewPreferences, FlightLeg, OtherDuty, RosterData, StandbyDuty } from '../types/circadian';
import { lookupAirport } from '../data/airports';
import { HomeClock } from './planEngine';

/**
 * Stable identity for roster items, built from what the item IS, never from where it sat in a file.
 * An imported roster is a version of an evolving schedule: the same rostered flight keeps the same key
 * across uploads, so the app can tell "this flight changed" from "this is a new flight".
 *
 *   sector   home departure date · flight number · origin · destination   e.g. 2026-10-02|6E408|BLR|PNQ
 *   standby  home start date · standby · kind                              e.g. 2026-10-03|standby|home
 *   day code date · kind                                                   e.g. 2026-10-05|off
 *
 * Times are deliberately not part of a key: they are what changes. A key that truly occurs twice on a
 * day gets "#2", "#3" in time order. Keys are computed, not stored, so saved rosters need no migration.
 */

export function rosterClock(roster: Pick<RosterData, 'homeBase' | 'homeBaseTzOffset'>): HomeClock {
  return new HomeClock(roster.homeBaseTzOffset, lookupAirport(roster.homeBase)?.timeZone);
}

/** "6e 0408" and "6E408" are the same flight number; leading zeros after the airline code are ignored. */
export function normalizeFlightNumber(fn: string): string {
  const compact = fn.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const m = compact.match(/^([A-Z0-9]{2})(\d+)([A-Z]?)$/);
  return m ? `${m[1]}${String(Number(m[2]))}${m[3]}` : compact;
}

export const flightHomeDate = (f: FlightLeg, clock: HomeClock) => clock.date(Date.parse(f.departureTimeUtc));
export const standbyHomeDate = (sb: StandbyDuty, clock: HomeClock) => clock.date(Date.parse(sb.startUtc));

const baseSectorKey = (f: FlightLeg, clock: HomeClock) =>
  `${flightHomeDate(f, clock)}|${normalizeFlightNumber(f.flightNumber)}|${f.origin.toUpperCase()}|${f.destination.toUpperCase()}`;

/** Keys for a list of flights, in the list's order. Repeats of the same key on a day are numbered by time. */
export function sectorKeys(flights: FlightLeg[], clock: HomeClock): string[] {
  const order = flights.map((f, i) => ({ i, key: baseSectorKey(f, clock), t: Date.parse(f.departureTimeUtc) }));
  const seen = new Map<string, number>();
  const out: string[] = new Array(flights.length);
  for (const o of [...order].sort((a, b) => a.t - b.t)) {
    const n = (seen.get(o.key) ?? 0) + 1;
    seen.set(o.key, n);
    out[o.i] = n === 1 ? o.key : `${o.key}#${n}`;
  }
  return out;
}

/** The key of one flight within its roster (accounts for a repeat on the same day). */
export function sectorKeyIn(flight: FlightLeg, roster: RosterData): string {
  const clock = rosterClock(roster);
  const idx = roster.flights.findIndex((f) => f.id === flight.id);
  return idx >= 0 ? sectorKeys(roster.flights, clock)[idx] : baseSectorKey(flight, clock);
}

export function standbyKeys(standby: StandbyDuty[], clock: HomeClock): string[] {
  const order = standby.map((sb, i) => ({ i, key: `${standbyHomeDate(sb, clock)}|standby|${sb.kind}`, t: Date.parse(sb.startUtc) }));
  const seen = new Map<string, number>();
  const out: string[] = new Array(standby.length);
  for (const o of [...order].sort((a, b) => a.t - b.t)) {
    const n = (seen.get(o.key) ?? 0) + 1;
    seen.set(o.key, n);
    out[o.i] = n === 1 ? o.key : `${o.key}#${n}`;
  }
  return out;
}

export const otherDutyKey = (d: OtherDuty) => `${d.date}|${d.kind}`;

/**
 * In-flight rest choice for a flight. Saved under the flight's stable key so it survives re-uploads;
 * choices saved before keys existed (under the flight's id) are still read.
 */
export function bunkChoice(prefs: CrewPreferences, key: string, legacyId?: string): 'shift1' | 'shift2' | undefined {
  const a = prefs.bunkShiftAssignments;
  return a?.[key] ?? (legacyId ? a?.[legacyId] : undefined);
}

/** The in-flight rest choice for a flight event on screen (event ids are "flight-<flight id>"). */
export function bunkChoiceForEvent(prefs: CrewPreferences, eventId: string, roster: RosterData): 'shift1' | 'shift2' | undefined {
  const legId = eventId.replace(/^flight-/, '');
  return bunkChoice(prefs, sectorKeyForEvent(eventId, roster) ?? legId, legId);
}

/** The stable key for a flight event on screen (event ids are "flight-<flight id>"). */
export function sectorKeyForEvent(eventId: string, roster: RosterData): string | undefined {
  const legId = eventId.replace(/^flight-/, '');
  const leg = roster.flights.find((f) => f.id === legId || f.id === eventId);
  return leg ? sectorKeyIn(leg, roster) : undefined;
}
