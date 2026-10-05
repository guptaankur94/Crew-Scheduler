import { FlightLeg, OtherDuty, RosterData, StandbyDuty } from '../types/circadian';
import { lookupAirport } from '../data/airports';
import { HomeClock } from './planEngine';

export interface RosterConflict {
  id: string;
  dateStr: string; // YYYY-MM-DD
  existingFlight: FlightLeg;
  incomingFlight: FlightLeg;
  reason: string;
}

export interface MergeAnalysisResult {
  hasConflicts: boolean;
  conflicts: RosterConflict[];
  identicalCount: number;
  newSectorsCount: number;
  nonConflictingMergedFlights: FlightLeg[];
  allIncomingFlights: FlightLeg[];
}

/**
 * Normalizes flight numbers for comparison (e.g. "6E 205" -> "6E205")
 */
export function normalizeFlightNumber(fn: string): string {
  return fn.toUpperCase().replace(/\s+/g, '');
}

/**
 * Checks whether two flights represent the exact same flight duty sector
 */
export function isSameSector(f1: FlightLeg, f2: FlightLeg): boolean {
  const norm1 = normalizeFlightNumber(f1.flightNumber);
  const norm2 = normalizeFlightNumber(f2.flightNumber);
  
  if (norm1 !== norm2) return false;
  if (f1.origin !== f2.origin || f1.destination !== f2.destination) return false;
  
  // Compare departure time within a 90-minute tolerance
  const t1 = new Date(f1.departureTimeUtc).getTime();
  const t2 = new Date(f2.departureTimeUtc).getTime();
  return Math.abs(t1 - t2) <= 90 * 60 * 1000;
}

/**
 * Checks if two flights are scheduled at the same time on the same date but are different flights (Conflict)
 */
export function isConflictingDuty(existing: FlightLeg, incoming: FlightLeg): boolean {
  // If they are the identical sector, it's a duplicate, not a conflict
  if (isSameSector(existing, incoming)) return false;

  const date1 = existing.departureTimeUtc.slice(0, 10);
  const date2 = incoming.departureTimeUtc.slice(0, 10);
  if (date1 !== date2) return false;

  const dep1 = new Date(existing.departureTimeUtc).getTime();
  const arr1 = new Date(existing.arrivalTimeUtc).getTime();
  const dep2 = new Date(incoming.departureTimeUtc).getTime();
  const arr2 = new Date(incoming.arrivalTimeUtc).getTime();

  // If their flight windows overlap directly
  const overlaps = dep1 < arr2 && dep2 < arr1;
  if (overlaps) return true;

  // Or if same flight number but different routes or different timings on same date
  const norm1 = normalizeFlightNumber(existing.flightNumber);
  const norm2 = normalizeFlightNumber(incoming.flightNumber);
  if (norm1 === norm2 && (existing.origin !== incoming.origin || existing.destination !== incoming.destination)) {
    return true;
  }

  return false;
}

/**
 * Analyzes an incoming roster against the currently active continuous roster.
 * Segregates identical flights, novel non-conflicting flights, and true conflicts.
 */
export function analyzeRosterMerge(
  currentFlights: FlightLeg[],
  incomingFlights: FlightLeg[]
): MergeAnalysisResult {
  const conflicts: RosterConflict[] = [];
  let identicalCount = 0;
  const nonConflictingIncoming: FlightLeg[] = [];

  // Group current flights by date for fast lookup
  const currentByDate = new Map<string, FlightLeg[]>();
  for (const f of currentFlights) {
    const d = f.departureTimeUtc.slice(0, 10);
    if (!currentByDate.has(d)) currentByDate.set(d, []);
    currentByDate.get(d)!.push(f);
  }

  for (const incoming of incomingFlights) {
    const incDate = incoming.departureTimeUtc.slice(0, 10);
    const existingOnDate = currentByDate.get(incDate) || [];

    // Check if identical to an existing flight
    const duplicate = existingOnDate.find((curr) => isSameSector(curr, incoming));
    if (duplicate) {
      identicalCount++;
      continue;
    }

    // Check if conflicting with any existing flight on that date
    const conflictFound = existingOnDate.find((curr) => isConflictingDuty(curr, incoming));
    if (conflictFound) {
      conflicts.push({
        id: `conflict-${incDate}-${incoming.flightNumber}-${conflictFound.flightNumber}`,
        dateStr: incDate,
        existingFlight: conflictFound,
        incomingFlight: incoming,
        reason: `Schedule Revision on ${incDate}: Currently scheduled for ${conflictFound.flightNumber} (${conflictFound.origin}➔${conflictFound.destination}), but incoming roster shows ${incoming.flightNumber} (${incoming.origin}➔${incoming.destination}).`,
      });
    } else {
      nonConflictingIncoming.push(incoming);
    }
  }

  // Merge current flights + non-conflicting incoming flights
  const nonConflictingMerged = [...currentFlights, ...nonConflictingIncoming].sort(
    (a, b) => new Date(a.departureTimeUtc).getTime() - new Date(b.departureTimeUtc).getTime()
  );

  return {
    hasConflicts: conflicts.length > 0,
    conflicts,
    identicalCount,
    newSectorsCount: nonConflictingIncoming.length,
    nonConflictingMergedFlights: nonConflictingMerged,
    allIncomingFlights: incomingFlights,
  };
}

export type ConflictResolutionChoice = 'keep_existing' | 'accept_incoming' | 'combine_both';

/**
 * Resolves conflicts and produces the final merged flight roster list
 */
export function resolveAndMergeFlights(
  currentFlights: FlightLeg[],
  incomingFlights: FlightLeg[],
  resolutions: Record<string, ConflictResolutionChoice>
): FlightLeg[] {
  const mergedMap = new Map<string, FlightLeg>();

  // Add all current flights initially
  for (const f of currentFlights) {
    mergedMap.set(f.id, f);
  }

  for (const inc of incomingFlights) {
    const incDate = inc.departureTimeUtc.slice(0, 10);
    const existingOnDate = currentFlights.filter(
      (curr) => curr.departureTimeUtc.slice(0, 10) === incDate
    );

    // If identical, skip
    if (existingOnDate.some((curr) => isSameSector(curr, inc))) {
      continue;
    }

    // Find if there's a conflict
    const conflictFound = existingOnDate.find((curr) => isConflictingDuty(curr, inc));
    if (conflictFound) {
      const conflictKey = `conflict-${incDate}-${inc.flightNumber}-${conflictFound.flightNumber}`;
      const choice = resolutions[conflictKey] || 'accept_incoming'; // Default to accepting revised roster

      if (choice === 'accept_incoming') {
        // Remove existing and add incoming
        mergedMap.delete(conflictFound.id);
        mergedMap.set(inc.id, inc);
      } else if (choice === 'keep_existing') {
        // Keep existing, discard incoming
        // no-op
      } else if (choice === 'combine_both') {
        // Keep both
        mergedMap.set(inc.id, inc);
      }
    } else {
      // Novel non-conflicting sector
      mergedMap.set(inc.id, inc);
    }
  }

  // Convert to array and sort chronologically
  return Array.from(mergedMap.values()).sort(
    (a, b) => new Date(a.departureTimeUtc).getTime() - new Date(b.departureTimeUtc).getTime()
  );
}

/*
 * NEWER ROSTER WINS FOR THE DAYS IT COVERS
 *
 * A newer roster upload is the airline's latest plan for its dates. Anything the saved roster has on those
 * dates (flights, standby, days off) is replaced, not combined. Matching flight by flight is not enough:
 * when a day is re-planned the new flights usually don't overlap the old ones in time, and a day that
 * became free has no new flight at all, so the old flights would silently stay and inflate the totals.
 * (This happened with a September roster that showed 1–2 Oct and a later October roster: October showed
 * 59.9h instead of 49.9h.) The person always sees what will be replaced before anything is saved.
 */

/** The home-base dates an upload covers. `stated` is true when the dates come from the roster itself. */
export interface UploadCoverage {
  start: string; // YYYY-MM-DD, inclusive
  end: string;
  stated: boolean;
}

export interface UploadContent {
  flights: FlightLeg[];
  standby?: StandbyDuty[];
  otherDuties?: OtherDuty[];
  periodStart?: string;
  periodEnd?: string;
}

export interface RosterItems {
  flights: FlightLeg[];
  standby: StandbyDuty[];
  otherDuties: OtherDuty[];
}

const isDate = (d?: string): d is string => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d);

export function rosterClock(roster: Pick<RosterData, 'homeBase' | 'homeBaseTzOffset'>): HomeClock {
  return new HomeClock(roster.homeBaseTzOffset, lookupAirport(roster.homeBase)?.timeZone);
}

/**
 * The dates a new upload covers: from the earlier of the roster's stated start and its first item, to the
 * later of its stated end and its last item. Without stated dates, the first to the last item found.
 */
export function uploadCoverage(upload: UploadContent, clock: HomeClock): UploadCoverage | null {
  const dates = [
    ...upload.flights.map((f) => clock.date(Date.parse(f.departureTimeUtc))),
    ...(upload.standby ?? []).map((sb) => clock.date(Date.parse(sb.startUtc))),
    ...(upload.otherDuties ?? []).map((d) => d.date),
  ]
    .filter(isDate)
    .sort();
  const stated = isDate(upload.periodStart) && isDate(upload.periodEnd) && upload.periodStart <= upload.periodEnd;
  const starts = [dates[0], stated ? upload.periodStart : undefined].filter(isDate).sort();
  const ends = [dates[dates.length - 1], stated ? upload.periodEnd : undefined].filter(isDate).sort();
  if (!starts.length || !ends.length) return null;
  return { start: starts[0], end: ends[ends.length - 1], stated };
}

/** Splits the saved roster into what stays and what the new upload replaces (items dated within its coverage). */
export function splitByCoverage(roster: RosterData, coverage: UploadCoverage | null, clock: HomeClock): { kept: RosterItems; replaced: RosterItems } {
  const inside = (date: string) => !!coverage && date >= coverage.start && date <= coverage.end;
  const kept: RosterItems = { flights: [], standby: [], otherDuties: [] };
  const replaced: RosterItems = { flights: [], standby: [], otherDuties: [] };
  for (const f of roster.flights) (inside(clock.date(Date.parse(f.departureTimeUtc))) ? replaced : kept).flights.push(f);
  for (const sb of roster.standbyDuties ?? []) (inside(clock.date(Date.parse(sb.startUtc))) ? replaced : kept).standby.push(sb);
  for (const d of roster.otherDuties ?? []) (inside(d.date) ? replaced : kept).otherDuties.push(d);
  return { kept, replaced };
}

/** True when the saved roster has anything that a new upload would replace. */
export const hasReplacedItems = (r: RosterItems) => r.flights.length + r.standby.length + r.otherDuties.length > 0;
