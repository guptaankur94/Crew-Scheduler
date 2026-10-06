import { FlightLeg } from '../types/circadian';
import { airportLocalToUtc, getAirportTzOffset } from '../data/airports';

/*
 * TIMES AS PRINTED ON THE ROSTER
 *
 * Rosters print clock times without saying which clock, and airlines differ: many (e.g. IndiGo) print each
 * time in the local time of that airport, so a Singapore arrival is in Singapore time; others print
 * everything in home-base time or in UTC. The reader copies times exactly as printed, and this module
 * turns them into exact instants using the airport reference list and the convention the crew member
 * chose (or that the roster states). Nothing is guessed: the same printed times and convention always
 * give the same result, and the printed times are kept so they can be re-read if the convention changes.
 */

export type TimeConvention = 'local' | 'home' | 'utc';

export const TIME_CONVENTION_LABEL: Record<TimeConvention, string> = {
  local: "Each airport's local time",
  home: 'All in home-base time',
  utc: 'All in UTC',
};

/** Times exactly as printed (HH:MM), with the departure date as printed. */
export interface PrintedTimes {
  date: string; // YYYY-MM-DD, the departure date as printed
  dep: string;
  arr: string;
  arrDate?: string; // when the roster prints the arrival date
  report?: string;
  release?: string;
}

const MIN = 60000;
const DAY = 24 * 3600000;
const DEFAULT_REPORT_LEAD_MINUTES = 75;
const DEFAULT_RELEASE_LAG_MINUTES = 30;

export function normaliseClock(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const m = value.trim().match(/^(\d{1,2})[:.h]?(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h < 24 && min < 60 ? `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}` : null;
}

/** The airport whose clock a printed time is in, for this convention ('UTC' for UTC). */
const zoneFor = (convention: TimeConvention, airport: string, homeBase: string) => (convention === 'utc' ? 'UTC' : convention === 'home' ? homeBase : airport);

function toInstant(date: string, time: string, zone: string, knownOffset?: number): number | null {
  if (zone === 'UTC') {
    const ms = Date.parse(`${date}T${time}:00Z`);
    return isNaN(ms) ? null : ms;
  }
  return airportLocalToUtc(date, time, zone, knownOffset)?.getTime() ?? null;
}

/** The date (YYYY-MM-DD) on the clock of `zone` at an instant. */
function dateIn(ms: number, zone: string, knownOffset?: number): string {
  const offset = zone === 'UTC' ? 0 : getAirportTzOffset(zone, new Date(ms)) ?? knownOffset ?? 0;
  return new Date(ms + offset * 3600000).toISOString().slice(0, 10);
}

/** The clock time (HH:MM) and date on the clock of `zone` at an instant. */
export function clockIn(ms: number, zone: string, knownOffset?: number): { date: string; time: string } {
  const offset = zone === 'UTC' ? 0 : getAirportTzOffset(zone, new Date(ms)) ?? knownOffset ?? 0;
  const iso = new Date(ms + offset * 3600000).toISOString();
  return { date: iso.slice(0, 10), time: iso.slice(11, 16) };
}

export interface ConvertedTimes {
  departureTimeUtc: string;
  arrivalTimeUtc: string;
  reportTimeUtc: string;
  releaseTimeUtc: string;
  durationMinutes: number;
}

/**
 * Turns printed times into instants. Arrival (and release) roll forward a day at a time until they follow
 * departure (and arrival); report rolls back a day if it would come after departure. Missing report and
 * release use the usual buffers (75 min before departure, 30 min after arrival).
 * `known` offsets are used only for airports missing from the reference list.
 */
export function convertPrinted(
  p: PrintedTimes,
  route: { origin: string; destination: string },
  convention: TimeConvention,
  homeBase: string,
  known: { origin?: number; destination?: number } = {}
): ConvertedTimes | { error: string } {
  const depT = normaliseClock(p.dep);
  const arrT = normaliseClock(p.arr);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(p.date) || !depT || !arrT) return { error: 'the date, departure or arrival time could not be read' };
  const depZone = zoneFor(convention, route.origin, homeBase);
  const arrZone = zoneFor(convention, route.destination, homeBase);
  const depKnown = convention === 'local' ? known.origin : undefined;
  const arrKnown = convention === 'local' ? known.destination : undefined;

  const dep = toInstant(p.date, depT, depZone, depKnown);
  let arr = toInstant(p.arrDate && /^\d{4}-\d{2}-\d{2}$/.test(p.arrDate) ? p.arrDate : p.date, arrT, arrZone, arrKnown);
  if (dep === null || arr === null) return { error: 'an airport time zone is unknown' };
  for (let i = 0; i < 2 && arr <= dep; i++) arr += DAY;
  if (arr <= dep) return { error: 'arrival is not after departure' };

  const reportT = normaliseClock(p.report);
  let report = reportT ? toInstant(dateIn(dep, depZone, depKnown), reportT, depZone, depKnown) : null;
  if (report !== null && report > dep) report -= DAY;
  if (report === null || dep - report > 6 * 3600000) report = dep - DEFAULT_REPORT_LEAD_MINUTES * MIN;

  const releaseT = normaliseClock(p.release);
  let release = releaseT ? toInstant(dateIn(arr, arrZone, arrKnown), releaseT, arrZone, arrKnown) : null;
  if (release !== null && release < arr) release += DAY;
  if (release === null || release - arr > 6 * 3600000) release = arr + DEFAULT_RELEASE_LAG_MINUTES * MIN;

  return {
    departureTimeUtc: new Date(dep).toISOString(),
    arrivalTimeUtc: new Date(arr).toISOString(),
    reportTimeUtc: new Date(report).toISOString(),
    releaseTimeUtc: new Date(release).toISOString(),
    durationMinutes: Math.round((arr - dep) / MIN),
  };
}

/** The flight's times written out as they would be printed under a convention (for flights saved without printed times). */
export function printedFrom(f: FlightLeg, convention: TimeConvention, homeBase: string): PrintedTimes {
  const depZone = zoneFor(convention, f.origin, homeBase);
  const arrZone = zoneFor(convention, f.destination, homeBase);
  const dep = clockIn(Date.parse(f.departureTimeUtc), depZone, f.originTzOffset);
  const arr = clockIn(Date.parse(f.arrivalTimeUtc), arrZone, f.destTzOffset);
  return {
    date: dep.date,
    dep: dep.time,
    arr: arr.time,
    arrDate: arr.date,
    report: clockIn(Date.parse(f.reportTimeUtc), depZone, f.originTzOffset).time,
    release: clockIn(Date.parse(f.releaseTimeUtc), arrZone, f.destTzOffset).time,
  };
}

/** Re-reads a flight's printed times under another convention, keeping everything else about it. */
export function withConvention(f: FlightLeg, convention: TimeConvention, homeBase: string): FlightLeg {
  if (!f.printed) return f;
  const c = convertPrinted(f.printed, f, convention, homeBase, { origin: f.originTzOffset, destination: f.destTzOffset });
  if ('error' in c) return f;
  return {
    ...f,
    ...c,
    originTzOffset: getAirportTzOffset(f.origin, new Date(c.departureTimeUtc)) ?? f.originTzOffset,
    destTzOffset: getAirportTzOffset(f.destination, new Date(c.arrivalTimeUtc)) ?? f.destTzOffset,
    timeConvention: convention,
  };
}

/**
 * Fixes a flight saved before printed times were kept, when it was read in home-base time but the roster
 * prints each airport's local time (e.g. Singapore times taken as India time): recovers the printed times
 * as home-base clock times and reads them again as local time at each airport.
 */
export function rereadAsLocal(f: FlightLeg, homeBase: string): FlightLeg {
  const printed = f.printed ?? printedFrom(f, 'home', homeBase);
  return withConvention({ ...f, printed }, 'local', homeBase);
}
