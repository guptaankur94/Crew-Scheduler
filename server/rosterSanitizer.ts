import { AIRPORTS, getAirportTzOffset } from '../src/data/airports';
import type { FlightLeg, StandbyDuty } from '../src/types/circadian';

export interface SanitizedRoster {
  airline: string;
  crewName: string;
  homeBase: string;
  homeBaseTzOffset: number;
  flights: FlightLeg[];
  notes: string;
  warnings: string[];
  standby: StandbyDuty[];
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
export function sanitizeParsedRoster(parsed: any, now: Date = new Date()): SanitizedRoster | null {
  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.flights)) return null;

  const warnings: string[] = [];
  const flights: FlightLeg[] = [];
  const declaredHomeBase = cleanCode(parsed.homeBase);
  const batchStamp = now.getTime();

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

    const dep = parseInstant(fl.departureTimeUtc);
    const arr = parseInstant(fl.arrivalTimeUtc);
    if (!dep || !arr) return skip('the departure or arrival time could not be read');

    const durationMinutes = Math.round((arr.getTime() - dep.getTime()) / 60000);
    if (durationMinutes <= 0) return skip('arrival is not after departure');
    if (durationMinutes > MAX_SECTOR_MINUTES) return skip('the flight would be longer than 20 hours');
    if (Math.abs(dep.getTime() - now.getTime()) > PLAUSIBLE_WINDOW_MS) {
      return skip(`the date ${dep.toISOString().slice(0, 10)} is more than two years from today`);
    }

    if (!rawNumber) warnings.push(`A flight ${origin}→${destination} on ${dep.toISOString().slice(0, 10)} has no readable flight number.`);

    const report = parseInstant(fl.reportTimeUtc);
    const reportLead = report ? (dep.getTime() - report.getTime()) / 60000 : -1;
    const reportTime =
      report && reportLead >= 0 && reportLead <= MAX_REPORT_LEAD_MINUTES
        ? report
        : new Date(dep.getTime() - DEFAULT_REPORT_LEAD_MINUTES * 60000);

    const release = parseInstant(fl.releaseTimeUtc);
    const releaseLag = release ? (release.getTime() - arr.getTime()) / 60000 : -1;
    const releaseTime =
      release && releaseLag >= 0 && releaseLag <= MAX_RELEASE_LAG_MINUTES
        ? release
        : new Date(arr.getTime() + DEFAULT_RELEASE_LAG_MINUTES * 60000);

    // Known airports use the real (daylight-saving-aware) offset; otherwise trust a plausible model value
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
      originCity: (typeof fl.originCity === 'string' && fl.originCity.trim()) || AIRPORTS[origin]?.city || origin,
      destination,
      destinationCity:
        (typeof fl.destinationCity === 'string' && fl.destinationCity.trim()) || AIRPORTS[destination]?.city || destination,
      departureTimeUtc: dep.toISOString(),
      arrivalTimeUtc: arr.toISOString(),
      reportTimeUtc: reportTime.toISOString(),
      releaseTimeUtc: releaseTime.toISOString(),
      originTzOffset,
      destTzOffset,
      aircraftType: typeof fl.aircraftType === 'string' && fl.aircraftType.trim() ? fl.aircraftType.trim() : undefined,
      durationMinutes,
      isPositioning: fl.isPositioning === true ? true : undefined,
    });
  });

  // Standby periods: kept only when their times make sense
  const standby: StandbyDuty[] = [];
  (Array.isArray(parsed.standby) ? parsed.standby : []).forEach((sb: any, i: number) => {
    if (!sb || typeof sb !== 'object') return;
    const start = parseInstant(sb.startTimeUtc);
    const end = parseInstant(sb.endTimeUtc);
    if (!start || !end || end <= start || end.getTime() - start.getTime() > 24 * 3600000) {
      warnings.push('Skipped a standby period: its start or end time could not be read.');
      return;
    }
    if (Math.abs(start.getTime() - now.getTime()) > PLAUSIBLE_WINDOW_MS) return;
    const airport = cleanCode(sb.airport);
    standby.push({
      id: `standby-${batchStamp}-${i}`,
      kind: sb.type === 'airport' ? 'airport' : 'home',
      airport: IATA_RE.test(airport) ? airport : declaredHomeBase || '',
      startUtc: start.toISOString(),
      endUtc: end.toISOString(),
    });
  });

  if (flights.length === 0 && standby.length === 0) return null;
  if (flights.length === 0) {
    const homeBase = IATA_RE.test(declaredHomeBase) ? declaredHomeBase : standby[0].airport;
    return {
      airline: typeof parsed.airline === 'string' && parsed.airline.trim() ? parsed.airline.trim() : 'Airline',
      crewName: typeof parsed.crewName === 'string' && parsed.crewName.trim() ? parsed.crewName.trim() : 'Cabin Crew',
      homeBase,
      homeBaseTzOffset: getAirportTzOffset(homeBase, standby[0].startUtc) ?? (isPlausibleOffset(parsed.homeBaseTzOffset) ? parsed.homeBaseTzOffset : 0),
      flights,
      notes: 'Only standby duties were found.',
      warnings,
      standby,
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
    crewName: text(parsed.crewName, 'Cabin Crew'),
    homeBase,
    homeBaseTzOffset,
    flights,
    notes: text(
      parsed.notes,
      `Parsed ${flights.length} flight legs from document${skipped ? `; ${skipped} could not be read and were left out` : ''}.`
    ),
    warnings,
    standby: standby.map((sb) => ({ ...sb, airport: sb.airport || homeBase })),
  };
}

export interface SanitizedPayslip {
  airline?: string;
  rankTitle?: string;
  currency: string;
  baseFixedPay?: number;
  flyingHourlyRate?: number;
  standbyHourlyRate?: number;
  layoverPerDiem?: number;
  nightAllowanceRate?: number;
  notes?: string;
}

/**
 * Keeps only non-negative finite pay figures from a model's payslip reading.
 * Returns null when no pay figure at all was extracted.
 */
export function sanitizeParsedPayslip(parsed: any): SanitizedPayslip | null {
  if (!parsed || typeof parsed !== 'object') return null;

  const amount = (value: unknown): number | undefined =>
    typeof value === 'number' && isFinite(value) && value >= 0 ? value : undefined;
  const text = (value: unknown): string | undefined =>
    typeof value === 'string' && value.trim() ? value.trim() : undefined;

  const result: SanitizedPayslip = {
    airline: text(parsed.airline),
    rankTitle: text(parsed.rankTitle),
    currency: (text(parsed.currency) || '').toUpperCase(),
    baseFixedPay: amount(parsed.baseFixedPay),
    flyingHourlyRate: amount(parsed.flyingHourlyRate),
    standbyHourlyRate: amount(parsed.standbyHourlyRate),
    layoverPerDiem: amount(parsed.layoverPerDiem),
    nightAllowanceRate: amount(parsed.nightAllowanceRate),
    notes: text(parsed.notes),
  };

  const hasAnyFigure = [
    result.baseFixedPay,
    result.flyingHourlyRate,
    result.standbyHourlyRate,
    result.layoverPerDiem,
    result.nightAllowanceRate,
  ].some((v) => v !== undefined && v > 0);

  return hasAnyFigure ? result : null;
}
