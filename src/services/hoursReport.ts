import { CircadianPlan } from '../types/circadian';
import { lookupAirport } from '../data/airports';
import { groupDuties, HomeClock } from './planEngine';
import { Period } from './periodStats';

/*
 * MONTHLY HOURS REPORT
 *
 * Day by day: route, check-in, sign-off, flying (block) hours, duty hours (check-in to sign-off) and standby
 * hours, for checking pay. Worked out exactly as the Month summary's totals, so the two always agree:
 * flights count on the day they depart (home time), positioning is duty but not flying, a duty counts on the day
 * it starts.
 */

export interface HoursRow {
  date: string;
  route: string;
  checkIn?: string;
  signOff?: string;
  flyingMinutes: number;
  /** Of the flying minutes: flights already flown (both times printed as actual). */
  flownMinutes: number;
  dutyMinutes: number;
  standbyMinutes: number;
  /** How the day's flight times were printed: all actual (flown), some estimated, or scheduled. */
  times: 'actual' | 'estimated' | 'scheduled' | '';
}

export interface HoursReport {
  rows: HoursRow[];
  totals: { flyingMinutes: number; flownMinutes: number; dutyMinutes: number; standbyMinutes: number };
  /** True when the roster marks any times as actual, so flown and scheduled can be told apart. */
  hasActuals: boolean;
}

export function hoursReport(plan: CircadianPlan, period: Period): HoursReport {
  const { roster, preferences } = plan;
  const clock = new HomeClock(preferences.homeBaseTzOffset, lookupAirport(roster.homeBase)?.timeZone);
  const inPeriod = (d: string) => d >= period.start && d <= period.end;
  const byDate = new Map<string, HoursRow>();
  const row = (date: string) => {
    let r = byDate.get(date);
    if (!r) byDate.set(date, (r = { date, route: '', flyingMinutes: 0, flownMinutes: 0, dutyMinutes: 0, standbyMinutes: 0, times: '' }));
    return r;
  };

  for (const f of roster.flights) {
    const date = clock.date(Date.parse(f.departureTimeUtc));
    if (!inPeriod(date) || f.isPositioning) continue;
    const r = row(date);
    r.flyingMinutes += f.durationMinutes;
    const flown = f.timeKinds?.dep === 'actual' && f.timeKinds?.arr === 'actual';
    if (flown) r.flownMinutes += f.durationMinutes;
    const kind = flown ? 'actual' : f.timeKinds?.dep === 'estimated' || f.timeKinds?.arr === 'estimated' ? 'estimated' : 'scheduled';
    // A day with any estimated time reads 'estimated'; otherwise 'actual' only when every flight was flown
    r.times = r.times === 'estimated' || kind === 'estimated' ? 'estimated' : r.times === 'scheduled' || kind === 'scheduled' ? 'scheduled' : 'actual';
  }
  for (const d of groupDuties(roster.flights, roster.homeBase, roster.standbyDuties ?? [])) {
    const date = clock.date(d.startMs);
    if (!d.flights.length || !inPeriod(date)) continue;
    const r = row(date);
    r.dutyMinutes += Math.round((d.endMs - d.startMs) / 60000);
    r.checkIn ??= clock.time(d.startMs);
    r.signOff = clock.time(d.endMs) + (clock.date(d.endMs) !== date ? ' (+1)' : '');
    const stops = [d.flights[0].origin, ...d.flights.map((f) => f.destination)];
    r.route = [r.route, d.flights.map((f) => (f.isPositioning ? `(${f.flightNumber})` : f.flightNumber)).join(' ') + ' ' + stops.join('-')].filter(Boolean).join('; ');
  }
  for (const sb of roster.standbyDuties ?? []) {
    const date = clock.date(Date.parse(sb.startUtc));
    if (!inPeriod(date)) continue;
    const r = row(date);
    r.standbyMinutes += Math.round((Date.parse(sb.endUtc) - Date.parse(sb.startUtc)) / 60000);
    if (!r.route) r.route = sb.kind === 'airport' ? 'Airport standby' : 'Home standby';
  }

  const rows = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  const sum = (k: 'flyingMinutes' | 'flownMinutes' | 'dutyMinutes' | 'standbyMinutes') => rows.reduce((s, r) => s + r[k], 0);
  const hasActuals = roster.flights.some((f) => f.timeKinds?.dep === 'actual' || f.timeKinds?.arr === 'actual');
  return { rows, totals: { flyingMinutes: sum('flyingMinutes'), flownMinutes: sum('flownMinutes'), dutyMinutes: sum('dutyMinutes'), standbyMinutes: sum('standbyMinutes') }, hasActuals };
}

/** 7:45 style hours and minutes. */
export const hhmm = (minutes: number) => (minutes ? `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}` : '');

/** The report as a CSV file (opens in Excel, Numbers or Google Sheets). */
export function hoursReportCsv(report: HoursReport, label: string): string {
  const q = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const lines = [
    [`CrewCircadian hours report: ${label} (home time)`],
    ['Date', 'Duty', 'Check-in', 'Sign-off', 'Flying (h:mm)', 'Times', 'Duty (h:mm)', 'Standby (h:mm)'],
    ...report.rows.map((r) => [r.date, r.route, r.checkIn ?? '', r.signOff ?? '', hhmm(r.flyingMinutes), r.flyingMinutes ? r.times : '', hhmm(r.dutyMinutes), hhmm(r.standbyMinutes)]),
    ['Total', '', '', '', hhmm(report.totals.flyingMinutes), '', hhmm(report.totals.dutyMinutes), hhmm(report.totals.standbyMinutes)],
    ...(report.hasActuals ? [['Flown (actual times)', '', '', '', hhmm(report.totals.flownMinutes)], ['Still scheduled or estimated', '', '', '', hhmm(report.totals.flyingMinutes - report.totals.flownMinutes)]] : []),
    [],
    ['Estimates from your roster as saved in CrewCircadian, including your own updates. Check against your airline\'s records.'],
  ];
  return lines.map((l) => l.map(q).join(',')).join('\n') + '\n';
}
