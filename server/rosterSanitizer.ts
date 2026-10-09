import { getAirportTzOffset, lookupAirport } from '../src/data/airports';
import type { FlightLeg, OtherDuty, StandbyDuty, TimeKind } from '../src/types/circadian';
import { convertPrinted, normaliseClock, PrintedTimes, TimeConvention } from '../src/services/rosterTimes';
import { normalizeDutyTimes } from '../src/services/dutyTimes';
import { dayKindForCode, standbyKindForCode } from '../src/services/rosterCodes';

export interface SanitizedRoster {
  airline: string;
  homeBase: string;
  homeBaseTzOffset: number;
  flights: FlightLeg[];
  notes: string;
  warnings: string[];
  standby: StandbyDuty[];
  /** Non-flying days the roster lists (OFF, leave, sick, training), so days off are counted honestly. */
  otherDuties: OtherDuty[];
  /** The dates the roster says it covers, e.g. "01/10/2026 - 21/10/2026", when shown. */
  periodStart?: string;
  periodEnd?: string;
  /** Every date that has its own row or cell in the document (including blank and OFF days). */
  visibleDates?: string[];
  /** Which clock the printed times were read in, and whether the roster itself says so. */
  timeConvention: TimeConvention;
  timeConventionStated: boolean;
}

export interface SanitizeOptions {
  /** The crew member's setting, used when the roster does not say which clock its times are in. */
  timeConvention?: TimeConvention;
  /** The saved home base, used for "home-base time" when the roster does not name one. */
  homeBase?: string;
}

const CONVENTIONS: TimeConvention[] = ['local', 'home', 'utc'];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const OTHER_KINDS: OtherDuty['kind'][] = ['off', 'leave', 'sick', 'training', 'other'];

/** A printed time with its roster marker: "A0007" → 00:07, actual; "E0335" → 03:35, estimated; "0205+1" → 02:05. */
export function readMarkedTime(value: unknown): { clock: string | null; kind?: TimeKind } {
  if (typeof value !== 'string') return { clock: null };
  const m = value.trim().match(/^([AaEeSs])?\s*([0-9]{1,2}[:.h]?[0-9]{2})\s*(?:\+\s*\d)?$/);
  if (!m) return { clock: normaliseClock(value) };
  const letter = m[1]?.toUpperCase();
  return { clock: normaliseClock(m[2]), kind: letter === 'A' ? 'actual' : letter === 'E' ? 'estimated' : letter === 'S' ? 'scheduled' : undefined };
}
const kindOf = (v: unknown): TimeKind | undefined => (v === 'actual' || v === 'estimated' || v === 'scheduled' ? v : undefined);

/** Days the roster lists without flying: one entry per day and kind, with sensible dates only. */
function sanitizeOtherDuties(raw: unknown, now: Date, stamp: number): OtherDuty[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: OtherDuty[] = [];
  raw.forEach((d: any, i: number) => {
    if (!d || typeof d !== 'object' || typeof d.date !== 'string' || !DATE_RE.test(d.date)) return;
    const day = Date.parse(`${d.date}T12:00:00Z`);
    if (!Number.isFinite(day) || Math.abs(day - now.getTime()) > 2 * 365 * 24 * 3600000) return;
    // A known printed code decides the kind (the same code always means the same thing); otherwise the reader's choice
    const code = typeof d.code === 'string' && d.code.trim() ? d.code.trim().slice(0, 12) : undefined;
    const kind: OtherDuty['kind'] = dayKindForCode(code) ?? (OTHER_KINDS.includes(d.type) ? d.type : 'other');
    const key = `${kind}-${d.date}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({
      id: `other-${stamp}-${i}`,
      kind,
      date: d.date,
      code,
    });
  });
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

const IATA_RE = /^[A-Z]{3}$/;
const MAX_SECTOR_MINUTES = 20 * 60;
const MAX_REPORT_LEAD_MINUTES = 6 * 60;
const MAX_RELEASE_LAG_MINUTES = 6 * 60;
const DEFAULT_REPORT_LEAD_MINUTES = 75;
const DEFAULT_RELEASE_LAG_MINUTES = 30;
const PLAUSIBLE_WINDOW_MS = 2 * 365 * 24 * 3600000;

const parseInstant = (value: unknown): Date | null => {
  if (typeof value !== 'string' || !value.trim()) return null;
  const ms = Date.parse(value);
  return isNaN(ms) ? null : new Date(ms);
};

const isPlausibleOffset = (value: unknown): value is number =>
  typeof value === 'number' && isFinite(value) && value >= -12 && value <= 14;

const cleanCode = (value: unknown): string =>
  typeof value === 'string' ? value.trim().toUpperCase() : '';

/**
 * Validates the flight list a model returned and converts it into FlightLegs.
 * A leg whose airports or times cannot be trusted is dropped and reported in `warnings`;
 * nothing is invented to fill a gap, because a wrong sector produces a wrong rest plan.
 * Returns null when the payload holds no usable flights.
 */
export function sanitizeParsedRoster(parsed: any, now: Date = new Date(), options: SanitizeOptions = {}): SanitizedRoster | null {
  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.flights)) return null;

  const warnings: string[] = [];
  const flights: FlightLeg[] = [];
  const declaredHomeBase = cleanCode(parsed.homeBase);
  const batchStamp = now.getTime();
  // Which clock the printed times are in: as the roster states it, otherwise the crew member's setting
  const timeConventionStated = CONVENTIONS.includes(parsed.timeConvention);
  const timeConvention: TimeConvention = timeConventionStated ? parsed.timeConvention : options.timeConvention ?? 'local';
  const homeBaseForTimes = lookupAirport(declaredHomeBase) ? declaredHomeBase : cleanCode(options.homeBase) || declaredHomeBase;

  parsed.flights.forEach((fl: any, i: number) => {
    if (!fl || typeof fl !== 'object') return;

    const rawNumber = typeof fl.flightNumber === 'string' ? fl.flightNumber.trim().toUpperCase() : '';
    const flightNumber = rawNumber || 'UNKNOWN';
    const origin = cleanCode(fl.origin);
    const destination = cleanCode(fl.destination);
    const label = `${flightNumber} (${origin || '?'}→${destination || '?'})`;
    const skip = (reason: string) => warnings.push(`Skipped ${label}: ${reason}.`);

    if (!IATA_RE.test(origin) || !IATA_RE.test(destination)) {
      return skip('an airport code could not be read');
    }

    // Times as printed (preferred): converted here with the airport reference list and the time convention.
    // Older replies with ready-made UTC times are still accepted.
    // A time may carry the roster's marker: "A0007" (actual, flown), "E0335" (estimated); "+1" means the next day
    const depRead = readMarkedTime(fl.depTime);
    const arrRead = readMarkedTime(fl.arrTime);
    // "+1" applied to the arrival but not the departure (e.g. listed under 01: departs 00:07 +1, lands 03:56 +1) would
    // make a flight of over 24 hours, which none is: the departure is on the arrival's day too
    if (typeof fl.date === 'string' && DATE_RE.test(fl.date) && typeof fl.arrDate === 'string' && DATE_RE.test(fl.arrDate) && fl.arrDate > fl.date && depRead.clock && arrRead.clock && arrRead.clock >= depRead.clock) {
      fl = { ...fl, date: fl.arrDate };
    }
    const timeKinds = {
      dep: kindOf(fl.depKind) ?? depRead.kind,
      arr: kindOf(fl.arrKind) ?? arrRead.kind,
    };
    const printed: PrintedTimes | null =
      typeof fl.date === 'string' && depRead.clock && arrRead.clock
        ? {
            date: fl.date,
            dep: depRead.clock,
            arr: arrRead.clock,
            ...(typeof fl.arrDate === 'string' && DATE_RE.test(fl.arrDate) ? { arrDate: fl.arrDate } : {}),
            ...(normaliseClock(fl.reportTime) ? { report: normaliseClock(fl.reportTime)! } : {}),
            ...(normaliseClock(fl.releaseTime) ? { release: normaliseClock(fl.releaseTime)! } : {}),
          }
        : null;
    let converted: ReturnType<typeof convertPrinted> | null = null;
    if (printed) {
      converted = convertPrinted(printed, { origin, destination }, timeConvention, homeBaseForTimes, {
        origin: isPlausibleOffset(fl.originTzOffset) ? fl.originTzOffset : undefined,
        destination: isPlausibleOffset(fl.destTzOffset) ? fl.destTzOffset : undefined,
      });
      if ('error' in converted) return skip(converted.error);
    }
    const dep = converted && !('error' in converted) ? new Date(converted.departureTimeUtc) : parseInstant(fl.departureTimeUtc);
    const arr = converted && !('error' in converted) ? new Date(converted.arrivalTimeUtc) : parseInstant(fl.arrivalTimeUtc);
    if (!dep || !arr) return skip('the departure or arrival time could not be read');

    const durationMinutes = Math.round((arr.getTime() - dep.getTime()) / 60000);
    if (durationMinutes <= 0) return skip('arrival is not after departure');
    if (durationMinutes > MAX_SECTOR_MINUTES) return skip('the flight would be longer than 20 hours');
    if (Math.abs(dep.getTime() - now.getTime()) > PLAUSIBLE_WINDOW_MS) {
      return skip(`the date ${dep.toISOString().slice(0, 10)} is more than two years from today`);
    }

    if (!rawNumber) warnings.push(`A flight ${origin}→${destination} on ${dep.toISOString().slice(0, 10)} has no readable flight number.`);

    const report = converted && !('error' in converted) ? new Date(converted.reportTimeUtc) : parseInstant(fl.reportTimeUtc);
    const reportLead = report ? (dep.getTime() - report.getTime()) / 60000 : -1;
    const reportTime =
      report && reportLead >= 0 && reportLead <= MAX_REPORT_LEAD_MINUTES
        ? report
        : new Date(dep.getTime() - DEFAULT_REPORT_LEAD_MINUTES * 60000);

    const release = converted && !('error' in converted) ? new Date(converted.releaseTimeUtc) : parseInstant(fl.releaseTimeUtc);
    const releaseLag = release ? (release.getTime() - arr.getTime()) / 60000 : -1;
    const releaseTime =
      release && releaseLag >= 0 && releaseLag <= MAX_RELEASE_LAG_MINUTES
        ? release
        : new Date(arr.getTime() + DEFAULT_RELEASE_LAG_MINUTES * 60000);

    // Verified airports always use the reference time zone on that date. For an unknown airport the AI's
    // offset is kept only so the review screen can show the row, and the flight is marked unverified,
    // which blocks saving until the user corrects the airport code.
    const tzUnverified = !lookupAirport(origin) || !lookupAirport(destination);
    const originTzOffset =
      getAirportTzOffset(origin, dep) ?? (isPlausibleOffset(fl.originTzOffset) ? fl.originTzOffset : undefined);
    const destTzOffset =
      getAirportTzOffset(destination, arr) ?? (isPlausibleOffset(fl.destTzOffset) ? fl.destTzOffset : undefined);
    if (originTzOffset === undefined || destTzOffset === undefined) {
      return skip('the time zone of an airport is unknown');
    }

    flights.push({
      id: `flight-${batchStamp}-${i}`,
      flightNumber,
      origin,
      originCity: lookupAirport(origin)?.city || origin,
      destination,
      destinationCity:
        lookupAirport(destination)?.city || destination,
      departureTimeUtc: dep.toISOString(),
      arrivalTimeUtc: arr.toISOString(),
      reportTimeUtc: reportTime.toISOString(),
      releaseTimeUtc: releaseTime.toISOString(),
      originTzOffset,
      destTzOffset,
      aircraftType: typeof fl.aircraftType === 'string' && fl.aircraftType.trim() ? fl.aircraftType.trim() : undefined,
      durationMinutes,
      isPositioning: fl.isPositioning === true ? true : undefined,
      tzUnverified: tzUnverified ? true : undefined,
      ...(printed ? { printed, timeConvention } : {}),
      ...(timeKinds.dep || timeKinds.arr ? { timeKinds } : {}),
    });
  });

  // Standby periods: kept only when their times make sense
  const standby: StandbyDuty[] = [];
  (Array.isArray(parsed.standby) ? parsed.standby : []).forEach((sb: any, i: number) => {
    if (!sb || typeof sb !== 'object') return;
    // Standby as printed (date, start, end) in the same clock as the flights, or ready-made UTC times
    const sbAirport = cleanCode(sb.airport) || homeBaseForTimes;
    const sbZone = timeConvention === 'utc' ? null : timeConvention === 'home' ? homeBaseForTimes : sbAirport;
    const sbAt = (date: unknown, time: unknown): Date | null => {
      const t = normaliseClock(time);
      if (typeof date !== 'string' || !DATE_RE.test(date) || !t) return null;
      if (!sbZone) return parseInstant(`${date}T${t}:00Z`);
      const offset = getAirportTzOffset(sbZone, new Date(`${date}T${t}:00Z`));
      return offset === undefined ? null : new Date(Date.parse(`${date}T${t}:00Z`) - offset * 3600000);
    };
    let start = sb.date ? sbAt(sb.date, sb.startTime) : parseInstant(sb.startTimeUtc);
    let end = sb.date ? sbAt(sb.endDate ?? sb.date, sb.endTime) : parseInstant(sb.endTimeUtc);
    if (start && end && sb.date && !sb.endDate && end <= start) end = new Date(end.getTime() + 24 * 3600000);
    if (!start || !end || end <= start || end.getTime() - start.getTime() > 24 * 3600000) {
      warnings.push('Skipped a standby period: its start or end time could not be read.');
      return;
    }
    if (Math.abs(start.getTime() - now.getTime()) > PLAUSIBLE_WINDOW_MS) return;
    const airport = cleanCode(sb.airport) || declaredHomeBase;
    if (airport && !lookupAirport(airport)) {
      warnings.push(`Skipped a standby period at ${airport}: not a recognised airport code.`);
      return;
    }
    standby.push({
      id: `standby-${batchStamp}-${i}`,
      // A known printed code decides home or airport standby; otherwise the reader's choice
      kind: standbyKindForCode(typeof sb.code === 'string' ? sb.code : undefined) ?? (sb.type === 'airport' ? 'airport' : 'home'),
      airport: IATA_RE.test(airport) ? airport : '',
      startUtc: start.toISOString(),
      endUtc: end.toISOString(),
    });
  });

  const otherDuties = sanitizeOtherDuties(parsed.otherDuties, now, batchStamp);
  const periodStart = typeof parsed.rosterPeriod?.start === 'string' && DATE_RE.test(parsed.rosterPeriod.start) ? parsed.rosterPeriod.start : undefined;
  const periodEndRaw = typeof parsed.rosterPeriod?.end === 'string' && DATE_RE.test(parsed.rosterPeriod.end) ? parsed.rosterPeriod.end : undefined;
  const periodEnd = periodStart && periodEndRaw && periodEndRaw >= periodStart ? periodEndRaw : undefined;
  const period = periodStart && periodEnd ? { periodStart, periodEnd } : {};
  // Dates shown in the document: sensible dates only, at most a few months' worth
  const visibleDates = Array.isArray(parsed.visibleDates)
    ? [...new Set((parsed.visibleDates as unknown[]).filter((d): d is string => typeof d === 'string' && DATE_RE.test(d)))]
        .filter((d) => Math.abs(Date.parse(`${d}T12:00:00Z`) - now.getTime()) <= 2 * 365 * 24 * 3600000)
        .sort()
        .slice(0, 400)
    : [];
  if (visibleDates.length) Object.assign(period, { visibleDates });

  // Check-in belongs to the first sector of each duty and debrief to the last (rosters print one of each per duty)
  flights.splice(0, flights.length, ...normalizeDutyTimes(flights));

  if (flights.length === 0 && standby.length === 0) return null;
  if (flights.length === 0) {
    const homeBase = IATA_RE.test(declaredHomeBase) ? declaredHomeBase : standby[0].airport;
    return {
      airline: typeof parsed.airline === 'string' && parsed.airline.trim() ? parsed.airline.trim() : 'Airline',
      homeBase,
      homeBaseTzOffset: getAirportTzOffset(homeBase, standby[0].startUtc) ?? (isPlausibleOffset(parsed.homeBaseTzOffset) ? parsed.homeBaseTzOffset : 0),
      flights,
      notes: 'Only standby duties were found.',
      warnings,
      standby,
      otherDuties,
      ...period,
      timeConvention,
      timeConventionStated,
    };
  }

  flights.sort((a, b) => Date.parse(a.departureTimeUtc) - Date.parse(b.departureTimeUtc));

  const first = flights[0];
  const homeBase = IATA_RE.test(declaredHomeBase) ? declaredHomeBase : first.origin;
  const homeBaseTzOffset =
    getAirportTzOffset(homeBase, first.departureTimeUtc) ??
    (isPlausibleOffset(parsed.homeBaseTzOffset) ? parsed.homeBaseTzOffset : first.originTzOffset);

  for (const flight of flights) {
    const depUtcHours = new Date(flight.departureTimeUtc).getUTCHours() + new Date(flight.departureTimeUtc).getUTCMinutes() / 60;
    const depHomeHour = (((depUtcHours + homeBaseTzOffset) % 24) + 24) % 24;
    flight.isRedEye = depHomeHour >= 22 || depHomeHour < 6;
  }

  const skipped = warnings.filter((w) => w.startsWith('Skipped')).length;
  const text = (value: unknown, fallback: string) =>
    typeof value === 'string' && value.trim() ? value.trim() : fallback;

  return {
    airline: text(parsed.airline, 'Airline'),
    homeBase,
    homeBaseTzOffset,
    flights,
    notes: text(
      parsed.notes,
      `Parsed ${flights.length} flight legs from document${skipped ? `; ${skipped} could not be read and were left out` : ''}.`
    ),
    warnings,
    standby: standby.map((sb) => ({ ...sb, airport: sb.airport || homeBase })),
    otherDuties,
    ...period,
    timeConvention,
    timeConventionStated,
  };
}
