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
  dutyMinutes: number;
  standbyMinutes: number;
}

export interface HoursReport {
  rows: HoursRow[];
  totals: { flyingMinutes: number; dutyMinutes: number; standbyMinutes: number };
}

export function hoursReport(plan: CircadianPlan, period: Period): HoursReport {
  const { roster, preferences } = plan;
  const clock = new HomeClock(preferences.homeBaseTzOffset, lookupAirport(roster.homeBase)?.timeZone);
  const inPeriod = (d: string) => d >= period.start && d <= period.end;
  const byDate = new Map<string, HoursRow>();
  const row = (date: string) => {
    let r = byDate.get(date);
    if (!r) byDate.set(date, (r = { date, route: '', flyingMinutes: 0, dutyMinutes: 0, standbyMinutes: 0 }));
    return r;
  };

  for (const f of roster.flights) {
    const date = clock.date(Date.parse(f.departureTimeUtc));
    if (!inPeriod(date) || f.isPositioning) continue;
    row(date).flyingMinutes += f.durationMinutes;
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
  const sum = (k: 'flyingMinutes' | 'dutyMinutes' | 'standbyMinutes') => rows.reduce((s, r) => s + r[k], 0);
  return { rows, totals: { flyingMinutes: sum('flyingMinutes'), dutyMinutes: sum('dutyMinutes'), standbyMinutes: sum('standbyMinutes') } };
}

/** 7:45 style hours and minutes. */
export const hhmm = (minutes: number) => (minutes ? `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}` : '');

/** The report as a CSV file (opens in Excel, Numbers or Google Sheets). */
export function hoursReportCsv(report: HoursReport, label: string): string {
  const q = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const lines = [
    [`CrewCircadian hours report: ${label} (home time)`],
    ['Date', 'Duty', 'Check-in', 'Sign-off', 'Flying (h:mm)', 'Duty (h:mm)', 'Standby (h:mm)'],
    ...report.rows.map((r) => [r.date, r.route, r.checkIn ?? '', r.signOff ?? '', hhmm(r.flyingMinutes), hhmm(r.dutyMinutes), hhmm(r.standbyMinutes)]),
    ['Total', '', '', '', hhmm(report.totals.flyingMinutes), hhmm(report.totals.dutyMinutes), hhmm(report.totals.standbyMinutes)],
    [],
    ['Estimates from your roster as saved in CrewCircadian, including your own updates. Check against your airline\'s records.'],
  ];
  return lines.map((l) => l.map(q).join(',')).join('\n') + '\n';
}
