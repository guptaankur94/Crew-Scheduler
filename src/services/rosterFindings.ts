import { RosterData } from '../types/circadian';
import { checkRosterFlights, RosterIssue } from './rosterChecks';
import { LimitReport } from './dutyLimits';
import { flightHomeDate, rosterClock, standbyHomeDate } from './rosterKeys';

/*
 * "Is my roster right?": everything doubtful about each day, in one place, for the Month screen.
 *   reading     something about the entries looks like a reading mistake (time zone, release, overlaps,
 *               unknown airport), from the same checks as the upload screen
 *   limits      the DGCA duty-limit guide found something on that day
 *   blank       a day inside the roster with nothing on it, when the roster otherwise lists days off,
 *               so a blank day may be a missed entry
 * A finding can carry a one-tap fix (e.g. read an airport's times as its local time).
 */

export interface Finding {
  date: string;
  kind: 'reading' | 'limits' | 'blank';
  level: 'problem' | 'check';
  message: string;
  fix?: RosterIssue['fix'];
}

export function findingsByDate(roster: RosterData, limits: LimitReport | null, coverage?: { from: string; to: string }): Map<string, Finding[]> {
  const clock = rosterClock(roster);
  const out = new Map<string, Finding[]>();
  const add = (f: Finding) => {
    const list = out.get(f.date) ?? [];
    if (!list.some((x) => x.message === f.message)) list.push(f);
    out.set(f.date, list);
  };

  // Reading checks, per flight, on the flight's home date
  const byId = new Map(roster.flights.map((f) => [f.id, f]));
  for (const [id, issues] of checkRosterFlights(roster.flights)) {
    const f = byId.get(id);
    if (!f) continue;
    for (const i of issues) add({ date: flightHomeDate(f, clock), kind: 'reading', level: i.level, message: i.message, fix: i.fix });
  }

  // Duty limits
  for (const i of limits?.issues ?? []) add({ date: i.date, kind: 'limits', level: 'check', message: `${i.title} (${i.ref})` });

  // Blank days inside the roster, when it lists days off explicitly
  if (coverage && (roster.otherDuties ?? []).length > 0) {
    const used = new Set<string>([
      ...roster.flights.map((f) => flightHomeDate(f, clock)),
      ...(roster.standbyDuties ?? []).map((s) => standbyHomeDate(s, clock)),
      ...(roster.otherDuties ?? []).map((d) => d.date),
    ]);
    // A day covered by an overnight duty from the evening before is not blank
    for (const f of roster.flights) used.add(clock.date(Date.parse(f.releaseTimeUtc)));
    for (let d = coverage.from; d <= coverage.to; d = clock.addDays(d, 1)) {
      if (!used.has(d)) add({ date: d, kind: 'blank', level: 'check', message: 'Nothing on the roster for this day: a day off, or a missed entry?' });
    }
  }

  for (const list of out.values()) list.sort((a, b) => (a.level === b.level ? 0 : a.level === 'problem' ? -1 : 1));
  return out;
}

/** A short signature of a day's entries, so a "looks right" tick can be dropped when the day changes. */
export function daySignature(roster: RosterData, date: string): string {
  const clock = rosterClock(roster);
  const parts = [
    ...roster.flights.filter((f) => flightHomeDate(f, clock) === date).map((f) => `${f.flightNumber}|${f.origin}|${f.destination}|${f.departureTimeUtc}|${f.arrivalTimeUtc}|${f.reportTimeUtc}|${f.releaseTimeUtc}|${f.isPositioning ? 'P' : ''}`),
    ...(roster.standbyDuties ?? []).filter((s) => standbyHomeDate(s, clock) === date).map((s) => `SB|${s.kind}|${s.startUtc}|${s.endUtc}`),
    ...(roster.otherDuties ?? []).filter((d) => d.date === date).map((d) => `OD|${d.kind}`),
  ].sort();
  return parts.join(';') || 'empty';
}
