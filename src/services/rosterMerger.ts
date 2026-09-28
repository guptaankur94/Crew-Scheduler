import { FlightLeg, RosterData } from '../types/circadian';

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
