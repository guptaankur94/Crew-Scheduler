import { CircadianPlan, DailyCircadianSummary } from '../types/circadian';
import { lookupAirport } from '../data/airports';
import { HomeClock } from './planEngine';
import { PeriodStats } from './periodStats';

/**
 * One line per day for the Month screen's day list: what the day is, and for duty days the report
 * time, the flights and the release time, all in home time.
 */

export interface MonthDayRow {
  dateStr: string;
  summary: DailyCircadianSummary;
  /** First report time of the day's duty, home time (HH:MM). */
  report?: string;
  /** Last release time of the day's duty, home time (HH:MM). */
  release?: string;
  /** Days after the duty date that the release falls on (1 when released after midnight). */
  releaseDayOffset: number;
  /** Route legs in order, e.g. ['DEL→BOM', 'BOM→DEL']. Positioning legs are marked. */
  legs: { label: string; flightNumber: string; positioning: boolean }[];
  standby?: { start: string; end: string; kind: 'home' | 'airport' };
  disruption?: 'overnight' | 'early' | 'late';
  /** Roster code for a non-flying day, e.g. 'AL' or 'SIM'. */
  code?: string;
}

const DAY_MS = 86400000;
const dayDiff = (from: string, to: string) => Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / DAY_MS);

export function monthDayRows(plan: CircadianPlan, stats: PeriodStats): MonthDayRow[] {
  const { roster, preferences, events, dailySummaries } = plan;
  const clock = new HomeClock(preferences.homeBaseTzOffset, lookupAirport(roster.homeBase)?.timeZone);
  const flightsById = new Map(roster.flights.map((f) => [f.id, f]));
  const codeByDate = new Map((roster.otherDuties ?? []).filter((d) => d.code).map((d) => [d.date, d.code!]));

  return dailySummaries
    .filter((s) => s.dateStr >= stats.start && s.dateStr <= stats.end)
    .map((summary) => {
      const dateStr = summary.dateStr;
      const dayEvents = events.filter((e) => e.dutyDate === dateStr);
      const flightEvents = dayEvents.filter((e) => e.type === 'flight').sort((a, b) => a.startUtc.localeCompare(b.startUtc));
      const legs = flightEvents
        .map((e) => flightsById.get(e.id.replace(/^flight-/, '')))
        .filter((f): f is NonNullable<typeof f> => !!f)
        .map((f) => ({ label: `${f.origin}→${f.destination}`, flightNumber: f.flightNumber, positioning: !!f.isPositioning }));

      const reports = dayEvents.filter((e) => e.id.startsWith('duty-report-')).map((e) => e.startUtc).sort();
      const releases = dayEvents.filter((e) => e.id.startsWith('duty-release-')).map((e) => e.endUtc).sort();
      const releaseMs = releases.length ? Date.parse(releases[releases.length - 1]) : undefined;

      const sb = dayEvents.find((e) => e.type === 'standby');
      const sbDuty = sb ? (roster.standbyDuties ?? []).find((d) => sb.id === `standby-${d.id}`) : undefined;

      return {
        dateStr,
        summary,
        report: reports.length ? clock.time(Date.parse(reports[0])) : undefined,
        release: releaseMs !== undefined ? clock.time(releaseMs) : undefined,
        releaseDayOffset: releaseMs !== undefined ? Math.max(0, dayDiff(dateStr, clock.date(releaseMs))) : 0,
        legs,
        standby: sb ? { start: sb.startHbtStr, end: sb.endHbtStr, kind: sbDuty?.kind ?? 'airport' } : undefined,
        disruption: stats.disruptive.byDate[dateStr],
        code: codeByDate.get(dateStr),
      };
    });
}
