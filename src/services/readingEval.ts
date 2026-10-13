/*
 * READING ACCURACY
 *
 * Compares what the roster reader returned with a crew member's confirmed roster ("expected"), flight by flight,
 * using the times exactly as printed. Used by `npm run eval:reading` on real, anonymised rosters.
 */

export interface ExpectedFlight {
  date: string; // YYYY-MM-DD as printed
  flightNumber: string;
  origin: string;
  destination: string;
  dep: string; // HH:MM as printed
  arr: string;
}

export interface ReadFlight {
  flightNumber: string;
  origin: string;
  destination: string;
  printed?: { date: string; dep: string; arr: string };
}

export interface CaseResult {
  expected: number;
  read: number;
  exact: number; // flight number, route, date and both times all right
  missing: string[]; // expected but not read
  extra: string[]; // read but not on the roster
  wrong: { flight: string; fields: string[] }[]; // read, but with some fields wrong
}

const fn = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^([A-Z0-9]{2})0+(?=\d)/, '$1');
const key = (date: string, flightNumber: string) => `${date} ${fn(flightNumber)}`;

export function compareReading(expected: ExpectedFlight[], read: ReadFlight[]): CaseResult {
  const byKey = new Map(read.map((r) => [key(r.printed?.date ?? '', r.flightNumber), r]));
  const used = new Set<string>();
  const result: CaseResult = { expected: expected.length, read: read.length, exact: 0, missing: [], extra: [], wrong: [] };
  for (const e of expected) {
    const k = key(e.date, e.flightNumber);
    const r = byKey.get(k);
    if (!r) {
      result.missing.push(k);
      continue;
    }
    used.add(k);
    const fields: string[] = [];
    if (r.origin.toUpperCase() !== e.origin.toUpperCase()) fields.push(`from ${r.origin} (should be ${e.origin})`);
    if (r.destination.toUpperCase() !== e.destination.toUpperCase()) fields.push(`to ${r.destination} (should be ${e.destination})`);
    if (r.printed?.dep !== e.dep) fields.push(`departs ${r.printed?.dep ?? '?'} (should be ${e.dep})`);
    if (r.printed?.arr !== e.arr) fields.push(`arrives ${r.printed?.arr ?? '?'} (should be ${e.arr})`);
    if (fields.length) result.wrong.push({ flight: k, fields });
    else result.exact++;
  }
  for (const r of read) {
    const k = key(r.printed?.date ?? '', r.flightNumber);
    if (!used.has(k)) result.extra.push(k);
  }
  return result;
}

/** Share of expected flights read exactly right, across all cases. */
export function overallAccuracy(results: CaseResult[]): number {
  const expected = results.reduce((s, r) => s + r.expected, 0);
  return expected ? results.reduce((s, r) => s + r.exact, 0) / expected : 0;
}
