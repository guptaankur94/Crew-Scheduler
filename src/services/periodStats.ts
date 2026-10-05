import { CrewPreferences, DailyCircadianSummary, RosterData, SalaryBreakdown } from '../types/circadian';
import { lookupAirport } from '../data/airports';
import { flightInBodyNight, groupDuties, HomeClock, overlapsHomeWindow } from './planEngine';
import { calculateSalaryBreakdown } from './salary';

/**
 * Totals and salary for a chosen window of days: a calendar month, an airline pay cycle (for example
 * the 21st to the 20th), or any custom range. Days are home-base dates; a flight belongs to the
 * period of the day it departs, so a flight crossing midnight at the end of a period is counted once.
 */

export interface Period {
  start: string; // YYYY-MM-DD, inclusive
  end: string; // YYYY-MM-DD, inclusive
}

export interface PeriodStats extends Period {
  label: string;
  /** Number of calendar days in the window. */
  days: number;
  /** First and last days in the window that the roster covers (undefined if none). */
  rosterFrom?: string;
  rosterTo?: string;
  /** Departure dates of the first and last flight counted (undefined if none). */
  flightsFrom?: string;
  flightsTo?: string;
  flyingHours: number;
  sectors: number;
  nightFlights: number;
  daysWithoutFlights: number;
  rosterDays: number;
  standbyHours: number;
  layoverNights: number;
  salary: SalaryBreakdown;

  // "What kind of month is this?" figures
  /** Days the roster gives as free: no flights, standby, leave, sick or training. */
  daysOff: number;
  /** Longest run of consecutive days off inside the window. */
  longestBreak: { days: number; from?: string; to?: string };
  leaveDays: number;
  sickDays: number;
  trainingDays: number;
  /** Days with a flying duty (by the day the duty starts). */
  dutyDays: number;
  /** Flying duties that cut into normal night sleep, each counted once (EASA ORO.FTL.105 bands, home time). */
  disruptive: {
    total: number;
    early: number;
    overnight: number;
    late: number;
    ofDuties: number;
    dates: string[];
    /** The disruption type of the duty starting on each date, for tagging days in lists. */
    byDate: Record<string, 'overnight' | 'early' | 'late'>;
  };
  standbyDays: number;
  /** Duties that take you to an airport 3 or more hours from home time. */
  timeZoneTrips: number;
  // Drill-down
  dutyHours: number;
  longestDuty?: { hours: number; date: string };
  longestRun: { days: number; from?: string; to?: string };
  weekendDaysOff: number;
}

/**
 * Disruptive-schedule bands from EASA ORO.FTL.105 (checked against the UK CAA text), applied in home time:
 * overnight = duty touching 02:00–04:59; early start = report 05:00–06:59; late finish = release 23:00–01:59.
 * A duty is counted once, in that order.
 */
export const DISRUPTION_BANDS = {
  overnight: { from: 2, to: 5 },
  earlyStart: { from: 5, to: 7 },
  lateFinish: { from: 23, to: 2 },
} as const;

/** Longest run of consecutive dates (sorted, unique) and where it falls. */
function longestRunOf(dates: string[]): { days: number; from?: string; to?: string } {
  let best = { days: 0 } as { days: number; from?: string; to?: string };
  let runStart = '';
  let prev = '';
  let length = 0;
  for (const d of dates) {
    length = prev && addDays(prev, 1) === d ? length + 1 : 1;
    if (length === 1) runStart = d;
    if (length > best.days) best = { days: length, from: runStart, to: d };
    prev = d;
  }
  return best;
}

const DAY_MS = 86400000;
const toMs = (d: string) => Date.parse(`${d}T12:00:00Z`);
const toStr = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const addDays = (d: string, n: number) => toStr(toMs(d) + n * DAY_MS);

/** A pay cycle start day is 1–28, so it exists in every month. 1 means calendar months. */
export function clampStartDay(day: number | undefined): number {
  return Math.min(28, Math.max(1, Math.round(day ?? 1)));
}

/** The pay period (or calendar month, when startDay is 1) that contains a date. */
export function periodContaining(dateStr: string, startDay = 1): Period {
  const sd = clampStartDay(startDay);
  const [y, m, d] = dateStr.split('-').map(Number);
  // Months are counted from year 0 so stepping across a year boundary is simple
  let monthIndex = y * 12 + (m - 1);
  if (d < sd) monthIndex -= 1;
  const start = monthStartFor(monthIndex, sd);
  const end = addDays(monthStartFor(monthIndex + 1, sd), -1);
  return { start, end };
}

function monthStartFor(monthIndex: number, day: number): string {
  const y = Math.floor(monthIndex / 12);
  const m = (monthIndex % 12) + 1;
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** The period n steps before (negative) or after (positive) the given one. */
export function shiftPeriod(period: Period, n: number, startDay = 1): Period {
  const [y, m] = period.start.split('-').map(Number);
  const monthIndex = y * 12 + (m - 1) + n;
  const sd = clampStartDay(startDay);
  return { start: monthStartFor(monthIndex, sd), end: addDays(monthStartFor(monthIndex + 1, sd), -1) };
}

const fmt = (d: string, opts: Intl.DateTimeFormatOptions) => new Date(toMs(d)).toLocaleDateString('en-GB', { ...opts, timeZone: 'UTC' });

export function periodLabel(period: Period): string {
  const isCalendarMonth =
    period.start.endsWith('-01') && addDays(period.end, 1).endsWith('-01') && period.start.slice(0, 7) === period.end.slice(0, 7);
  if (isCalendarMonth) return fmt(period.start, { month: 'long', year: 'numeric' });
  const sameYear = period.start.slice(0, 4) === period.end.slice(0, 4);
  return `${fmt(period.start, { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) })} – ${fmt(period.end, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })}`;
}

export interface PeriodInput {
  roster: RosterData;
  preferences: CrewPreferences;
  dailySummaries: DailyCircadianSummary[];
}

export function computePeriodStats(input: PeriodInput, period: Period): PeriodStats {
  const { roster, preferences, dailySummaries } = input;
  const clock = new HomeClock(preferences.homeBaseTzOffset, lookupAirport(roster.homeBase)?.timeZone);
  const inPeriod = (dateStr: string) => dateStr >= period.start && dateStr <= period.end;

  const flights = roster.flights.filter((f) => inPeriod(clock.date(Date.parse(f.departureTimeUtc))));
  const flyingMinutes = flights.filter((f) => !f.isPositioning).reduce((sum, f) => sum + f.durationMinutes, 0);
  const nightFlights = flights.filter((f) => flightInBodyNight(f, clock)).length;

  const rosterDays = dailySummaries.filter((d) => inPeriod(d.dateStr) && !d.outsideRoster);
  const daysWithoutFlights = rosterDays.filter((d) => d.dutyType !== 'flight').length;

  const standbyHours = (roster.standbyDuties ?? [])
    .filter((sb) => inPeriod(clock.date(Date.parse(sb.startUtc))))
    .reduce((sum, sb) => sum + (Date.parse(sb.endUtc) - Date.parse(sb.startUtc)) / 3600000, 0);

  // A layover night belongs to the period of the day the duty ending away from base finishes
  const duties = groupDuties(roster.flights, roster.homeBase, roster.standbyDuties ?? []);
  const layoverNights = duties.filter((d, i) => {
    if (!d.awayAtEnd || !inPeriod(clock.date(d.endMs))) return false;
    const next = duties[i + 1];
    return !next || (next.awayAtStart && next.startAirport === d.endAirport);
  }).length;

  const roundedStandby = Number(standbyHours.toFixed(1));
  const label = periodLabel(period);
  const salary = calculateSalaryBreakdown(roster, preferences, flyingMinutes, nightFlights, layoverNights, roundedStandby);

  const flightDates = flights.map((f) => clock.date(Date.parse(f.departureTimeUtc))).sort();

  // Days off and other non-flying days on the roster
  const offDates = rosterDays.filter((d) => d.dutyType === 'off').map((d) => d.dateStr).sort();
  const countType = (t: DailyCircadianSummary['dutyType']) => rosterDays.filter((d) => d.dutyType === t).length;
  const weekendDaysOff = offDates.filter((d) => [0, 6].includes(new Date(toMs(d)).getUTCDay())).length;

  // Flying duties starting in the window, classified for sleep disruption
  const flyingDuties = duties.filter((d) => d.flights.length > 0 && inPeriod(clock.date(d.startMs)));
  const disruptive = {
    total: 0,
    early: 0,
    overnight: 0,
    late: 0,
    ofDuties: flyingDuties.length,
    dates: [] as string[],
    byDate: {} as Record<string, 'overnight' | 'early' | 'late'>,
  };
  for (const d of flyingDuties) {
    const startHour = clock.hour(d.startMs);
    const endHour = clock.hour(d.endMs);
    let kind: 'overnight' | 'early' | 'late' | null = null;
    if (overlapsHomeWindow(d.startMs, d.endMs, DISRUPTION_BANDS.overnight.from, DISRUPTION_BANDS.overnight.to, clock)) kind = 'overnight';
    else if (startHour >= DISRUPTION_BANDS.earlyStart.from && startHour < DISRUPTION_BANDS.earlyStart.to) kind = 'early';
    else if (endHour >= DISRUPTION_BANDS.lateFinish.from || endHour < DISRUPTION_BANDS.lateFinish.to) kind = 'late';
    if (kind) {
      disruptive[kind] += 1;
      disruptive.total += 1;
      disruptive.dates.push(clock.date(d.startMs));
      if (!disruptive.byDate[clock.date(d.startMs)]) disruptive.byDate[clock.date(d.startMs)] = kind;
    }
  }

  // Trips to airports 3+ hours away from home time (jet lag), counted per duty
  const timeZoneTrips = flyingDuties.filter((d) =>
    d.flights.some((f) => Math.abs(f.destTzOffset - clock.offsetAt(Date.parse(f.arrivalTimeUtc))) >= 3)
  ).length;

  const dutyMinutes = flyingDuties.map((d) => ({ minutes: (d.endMs - d.startMs) / 60000, date: clock.date(d.startMs) }));
  const longest = dutyMinutes.sort((a, b) => b.minutes - a.minutes)[0];
  const dutyDates = rosterDays.filter((d) => d.dutyType === 'flight').map((d) => d.dateStr).sort();
  const standbyDays = new Set(
    (roster.standbyDuties ?? []).map((sb) => clock.date(Date.parse(sb.startUtc))).filter(inPeriod)
  ).size;
  const rosterDates = rosterDays.map((d) => d.dateStr).sort();

  return {
    ...period,
    label,
    days: Math.round((toMs(period.end) - toMs(period.start)) / DAY_MS) + 1,
    rosterFrom: rosterDates[0],
    rosterTo: rosterDates[rosterDates.length - 1],
    flightsFrom: flightDates[0],
    flightsTo: flightDates[flightDates.length - 1],
    flyingHours: Number((flyingMinutes / 60).toFixed(1)),
    sectors: flights.length,
    nightFlights,
    daysWithoutFlights,
    rosterDays: rosterDays.length,
    standbyHours: roundedStandby,
    layoverNights,
    salary: { ...salary, periodStart: period.start, periodEnd: period.end, periodLabel: label },
    daysOff: offDates.length,
    longestBreak: longestRunOf(offDates),
    leaveDays: countType('leave'),
    sickDays: countType('sick'),
    trainingDays: countType('training'),
    dutyDays: dutyDates.length,
    disruptive,
    standbyDays,
    timeZoneTrips,
    dutyHours: Number((dutyMinutes.reduce((sum, d) => sum + d.minutes, 0) / 60).toFixed(1)),
    longestDuty: longest ? { hours: Number((longest.minutes / 60).toFixed(1)), date: longest.date } : undefined,
    longestRun: longestRunOf(dutyDates),
    weekendDaysOff,
  };
}

/**
 * The period to show by default: the one containing today if the roster covers any of it,
 * otherwise the most recent period that has flights.
 */
export function defaultPeriod(dailySummaries: DailyCircadianSummary[], todayStr: string, startDay = 1): Period {
  const current = periodContaining(todayStr, startDay);
  const covered = dailySummaries.filter((d) => !d.outsideRoster && d.dutyType === 'flight');
  if (covered.some((d) => d.dateStr >= current.start && d.dateStr <= current.end) || covered.length === 0) return current;
  const before = covered.filter((d) => d.dateStr < current.start);
  const pick = before.length ? before[before.length - 1] : covered[0];
  return periodContaining(pick.dateStr, startDay);
}

/** Short day-month range, e.g. "1–22 Oct" or "28 Sep – 3 Oct". */
export function shortRange(from: string, to: string): string {
  const day = (d: string) => Number(d.slice(8));
  const month = (d: string) => fmt(d, { month: 'short' });
  if (from === to) return `${day(from)} ${month(from)}`;
  if (from.slice(0, 7) === to.slice(0, 7)) return `${day(from)}–${day(to)} ${month(to)}`;
  return `${day(from)} ${month(from)} – ${day(to)} ${month(to)}`;
}

/**
 * One factual sentence on what the month holds for sleep and recovery. Built from fixed rules only:
 * it names counts and dates, never scores or judgements.
 */
export function monthNarrative(stats: PeriodStats): string {
  if (stats.rosterDays === 0) return 'No roster for this month yet.';
  const parts: string[] = [];

  if (stats.dutyDays === 0) {
    parts.push('No flying duties on your roster this month.');
  } else if (stats.disruptive.total === 0) {
    parts.push('None of your duties cut into normal night sleep.');
  } else {
    const items = [
      stats.disruptive.early && `${stats.disruptive.early} early start${stats.disruptive.early === 1 ? '' : 's'}`,
      stats.disruptive.overnight && `${stats.disruptive.overnight} overnight dut${stats.disruptive.overnight === 1 ? 'y' : 'ies'}`,
      stats.disruptive.late && `${stats.disruptive.late} late finish${stats.disruptive.late === 1 ? '' : 'es'}`,
    ].filter(Boolean) as string[];
    const list = items.length > 1 ? `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}` : items[0];
    // Mention clustering only when it is clear: at least 3 such duties and most of them in one half
    const midpoint = addDays(stats.start, Math.floor((stats.days - 1) / 2));
    const firstHalf = stats.disruptive.dates.filter((d) => d <= midpoint).length;
    const share = firstHalf / stats.disruptive.total;
    const cluster =
      stats.disruptive.total >= 3 && share >= 0.7 ? ', mostly in the first half' : stats.disruptive.total >= 3 && share <= 0.3 ? ', mostly in the second half' : '';
    parts.push(`This month has ${list}${cluster}.`);
  }

  if (stats.longestBreak.days >= 2) {
    parts.push(`Your longest break is ${stats.longestBreak.days} days in a row (${shortRange(stats.longestBreak.from!, stats.longestBreak.to!)}).`);
  } else if (stats.daysOff > 0) {
    parts.push('Your days off are single days, so protect your sleep on each one.');
  } else if (stats.dutyDays > 0) {
    parts.push('There are no days off on your roster this month.');
  }
  return parts.join(' ');
}

/** Which days of the window the figures come from, in plain words. */
export function coverageNote(stats: PeriodStats): string {
  const from = stats.rosterFrom;
  const to = stats.rosterTo;
  if (!from || !to) return 'No roster for this month';
  const range = shortRange(from, to);
  const startsLate = from > stats.start;
  const endsEarly = to < stats.end;
  if (!startsLate && !endsEarly) return 'Covers the full month from your roster';
  if (startsLate && endsEarly) return `Covers ${range}, the dates on your roster`;
  return endsEarly ? `Covers ${range}, where your roster ends` : `Covers ${range}, from when your roster starts`;
}

/** The departure dates the flying-hours figure is built from. */
export function flightRangeNote(stats: PeriodStats): string {
  return stats.flightsFrom ? `Flights departing ${shortRange(stats.flightsFrom, stats.flightsTo!)}` : 'No flights this month';
}
