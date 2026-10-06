import { FlightLeg } from '../types/circadian';
import { lookupAirport } from '../data/airports';

/**
 * Automatic checks on flights read from a roster, so the review screen can point at rows that need a
 * second look before anything is saved. "problem" rows are almost certainly wrong and must be fixed or
 * removed; "check" rows might be fine but are worth confirming.
 */

export interface RosterIssue {
  level: 'problem' | 'check';
  message: string;
}

const MIN = 60_000;
const SAME_DUTY_GAP_MS = 6 * 60 * MIN;
/** Out-and-back flight times further apart than this are worth a second look (winds alone rarely explain more). */
const OUT_AND_BACK_TOLERANCE_MINUTES = 90;
/** A release this long after landing is unusual for cabin crew (the standard allowance is 15–60 min). */
const LATE_RELEASE_MINUTES = 120;

export function checkRosterFlights(flights: FlightLeg[]): Map<string, RosterIssue[]> {
  const issues = new Map<string, RosterIssue[]>();
  const add = (id: string, level: RosterIssue['level'], message: string) => {
    const list = issues.get(id) ?? [];
    list.push({ level, message });
    issues.set(id, list);
  };

  const sorted = [...flights].sort((a, b) => Date.parse(a.departureTimeUtc) - Date.parse(b.departureTimeUtc));

  sorted.forEach((f, i) => {
    const dep = Date.parse(f.departureTimeUtc);
    const arr = Date.parse(f.arrivalTimeUtc);
    const minutes = (arr - dep) / MIN;

    if (!/^[A-Z]{3}$/.test(f.origin) || !/^[A-Z]{3}$/.test(f.destination)) {
      add(f.id, 'problem', 'Airport codes must be 3 letters');
    } else {
      if (f.origin === f.destination) add(f.id, 'check', 'Departs and arrives at the same airport');
      for (const code of [f.origin, f.destination]) {
        if (!lookupAirport(code)) add(f.id, 'problem', `${code} isn't a recognised airport code: correct it or remove this flight`);
      }
    }

    const hasUnknownCode = (issues.get(f.id) ?? []).some((i) => i.message.includes('recognised'));
    if (f.tzUnverified && !hasUnknownCode) {
      add(f.id, 'problem', "An airport's time zone could not be verified: check the airport codes");
    }

    if (!Number.isFinite(dep) || !Number.isFinite(arr)) {
      add(f.id, 'problem', 'Departure or arrival time is missing');
      return;
    }
    if (arr <= dep) add(f.id, 'problem', 'Arrives before it departs');
    else if (minutes > 16 * 60) add(f.id, 'check', `Unusually long flight (${Math.round(minutes / 60)}h)`);
    else if (minutes < 20) add(f.id, 'check', 'Unusually short flight');

    const report = Date.parse(f.reportTimeUtc);
    const release = Date.parse(f.releaseTimeUtc);
    if (Number.isFinite(report) && report > dep) add(f.id, 'problem', 'Report time is after departure');
    if (Number.isFinite(release) && release < arr) add(f.id, 'problem', 'Release time is before arrival');
    else if (Number.isFinite(release) && release - arr > LATE_RELEASE_MINUTES * MIN) {
      add(f.id, 'check', `Released ${Math.round((release - arr) / MIN)} min after landing: check the release (debrief) time`);
    }

    const prev = sorted[i - 1];
    if (prev) {
      const prevArr = Date.parse(prev.arrivalTimeUtc);
      const sameNumber = prev.flightNumber.replace(/\s+/g, '') === f.flightNumber.replace(/\s+/g, '');
      if (sameNumber && Math.abs(Date.parse(prev.departureTimeUtc) - dep) < 90 * MIN) {
        add(f.id, 'problem', `Looks like a duplicate of ${prev.flightNumber}`);
      } else if (dep < prevArr) {
        add(f.id, 'problem', `Overlaps ${prev.flightNumber}`);
      } else if (dep - prevArr < SAME_DUTY_GAP_MS && prev.destination !== f.origin) {
        add(f.id, 'check', `Starts at ${f.origin}, but the previous flight landed at ${prev.destination}`);
      }
    }

    // Out and back to another time zone: the two flight times should be similar. A big difference usually
    // means one airport's times were read in the wrong time zone (e.g. Singapore times taken as India time).
    if (prev && prev.origin === f.destination && prev.destination === f.origin && dep - Date.parse(prev.arrivalTimeUtc) < SAME_DUTY_GAP_MS) {
      const out = (Date.parse(prev.arrivalTimeUtc) - Date.parse(prev.departureTimeUtc)) / MIN;
      const back = minutes;
      const zoneGap = Math.abs(prev.destTzOffset - prev.originTzOffset);
      if (zoneGap >= 1 && Math.abs(out - back) > OUT_AND_BACK_TOLERANCE_MINUTES) {
        const h = (m: number) => `${Math.floor(m / 60)}h${String(Math.round(m % 60)).padStart(2, '0')}`;
        const msg = `${prev.origin}→${prev.destination} takes ${h(out)} but the return takes ${h(back)}: the ${prev.destination} times may be in the wrong time zone (${prev.destination} is ${prev.destTzOffset >= 0 ? '+' : ''}${prev.destTzOffset}h from UTC). Check against your roster.`;
        add(prev.id, 'check', msg);
        add(f.id, 'check', msg);
      }
    }
  });

  return issues;
}

export function hasBlockingProblems(issues: Map<string, RosterIssue[]>): boolean {
  for (const list of issues.values()) if (list.some((i) => i.level === 'problem')) return true;
  return false;
}
