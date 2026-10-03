import { FlightLeg } from '../types/circadian';
import { AIRPORTS } from '../data/airports';

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
        if (!AIRPORTS[code]) add(f.id, 'check', `${code} is not in the app's airport list: check its local times`);
      }
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
  });

  return issues;
}

export function hasBlockingProblems(issues: Map<string, RosterIssue[]>): boolean {
  for (const list of issues.values()) if (list.some((i) => i.level === 'problem')) return true;
  return false;
}
