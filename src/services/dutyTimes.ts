import { FlightLeg } from '../types/circadian';

/*
 * CHECK-IN AND DEBRIEF BELONG TO THE DUTY, NOT TO EACH SECTOR
 *
 * A roster prints one check-in (report) and one debrief (release) per duty. The check-in belongs to the
 * first sector and the debrief to the last; sectors in between are turnarounds, still on duty, with no
 * check-in or release of their own. Rosters read sector by sector tend to copy the duty's check-in and
 * debrief onto every sector (e.g. a BLR→PNQ that lands at 05:43 "released" at 08:49, the debrief after the
 * PNQ→BLR return), which made sign-off look hours after landing.
 *
 * Each flight also carries its duty's check-in (dutyCheckInUtc): a duty belongs to the day of its check-in, as rosters
 * print it, so a 22:20 check-in for a 00:07 departure is a duty on the 22:20 day, not the next day.
 *
 * Sectors belong to one duty when the next departure is less than SAME_DUTY_GAP_HOURS after the previous
 * landing (crew need at least 10–12 hours of rest between duties, so a shorter gap is a turnaround or a
 * split duty). Applied whenever a roster is read or changed; running it twice changes nothing.
 */

export const SAME_DUTY_GAP_HOURS = 6;
const MIN = 60000;
const HOUR = 3600000;
/** When no debrief is printed, the last sector is released this long after landing (DGCA standard allowance, scheduled services). */
export const DEFAULT_RELEASE_MINUTES = 30;
const DEFAULT_REPORT_MINUTES = 75;
const MAX_BUFFER_HOURS = 6;

/** Sectors grouped into duties, in time order. */
export function dutyChains(flights: FlightLeg[]): FlightLeg[][] {
  const sorted = [...flights].sort((a, b) => Date.parse(a.departureTimeUtc) - Date.parse(b.departureTimeUtc));
  const chains: FlightLeg[][] = [];
  for (const f of sorted) {
    const chain = chains[chains.length - 1];
    const prev = chain?.[chain.length - 1];
    if (prev && Date.parse(f.departureTimeUtc) - Date.parse(prev.arrivalTimeUtc) < SAME_DUTY_GAP_HOURS * HOUR) chain.push(f);
    else chains.push([f]);
  }
  return chains;
}

/** Whether each sector is the first and/or last of its duty. */
export function dutyPositions(flights: FlightLeg[]): Map<string, { first: boolean; last: boolean }> {
  const out = new Map<string, { first: boolean; last: boolean }>();
  for (const chain of dutyChains(flights)) chain.forEach((f, i) => out.set(f.id, { first: i === 0, last: i === chain.length - 1 }));
  return out;
}

/**
 * Puts the check-in on the first sector of each duty and the debrief on the last; sectors in between report
 * at departure and release at arrival (no separate check-in or sign-off). Unchanged flights are returned as
 * the same objects.
 */
export function normalizeDutyTimes(flights: FlightLeg[]): FlightLeg[] {
  const fixed = new Map<string, FlightLeg>();
  for (const chain of dutyChains(flights)) {
    const first = chain[0];
    const last = chain[chain.length - 1];
    const lastArr = Date.parse(last.arrivalTimeUtc);
    // The duty's debrief: the latest release printed on any of its sectors that fits after the last landing
    const releases = chain.map((f) => Date.parse(f.releaseTimeUtc)).filter((r) => r >= lastArr && r <= lastArr + MAX_BUFFER_HOURS * HOUR);
    const release = releases.length ? Math.max(...releases) : lastArr + DEFAULT_RELEASE_MINUTES * MIN;
    const firstDep = Date.parse(first.departureTimeUtc);
    const firstReport = Date.parse(first.reportTimeUtc);
    const report = firstReport <= firstDep && firstDep - firstReport <= MAX_BUFFER_HOURS * HOUR ? firstReport : firstDep - DEFAULT_REPORT_MINUTES * MIN;

    chain.forEach((f, i) => {
      const isFirst = i === 0;
      const isLast = i === chain.length - 1;
      const reportTimeUtc = new Date(isFirst ? report : Date.parse(f.departureTimeUtc)).toISOString();
      const releaseTimeUtc = new Date(isLast ? release : Date.parse(f.arrivalTimeUtc)).toISOString();
      // Every flight in the duty carries the duty's check-in: the duty belongs to that day
      const dutyCheckInUtc = new Date(report).toISOString();
      if (reportTimeUtc === f.reportTimeUtc && releaseTimeUtc === f.releaseTimeUtc && dutyCheckInUtc === f.dutyCheckInUtc) return;
      // Printed times: a sector in the middle has no check-in or debrief of its own
      const printed = f.printed
        ? (({ report: r, release: rel, ...rest }) => ({ ...rest, ...(isFirst && r ? { report: r } : {}), ...(isLast && rel ? { release: rel } : {}) }))(f.printed)
        : undefined;
      fixed.set(f.id, { ...f, reportTimeUtc, releaseTimeUtc, dutyCheckInUtc, ...(printed ? { printed } : {}) });
    });
  }
  return fixed.size ? flights.map((f) => fixed.get(f.id) ?? f) : flights;
}
