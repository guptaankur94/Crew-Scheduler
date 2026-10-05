import { FlightLeg, HistoryDayChange, OtherDuty, RosterData, StandbyDuty } from '../types/circadian';
import { HomeClock } from './planEngine';
import { flightHomeDate, normalizeFlightNumber, rosterClock, sectorKeys, standbyHomeDate, standbyKeys } from './rosterKeys';

/*
 * IMPORT RECONCILIATION
 *
 * An uploaded roster is a new version of the schedule for the dates it shows. This module decides
 * 1. SCOPE   which dates the upload may change (conservative: only dates it visibly covers),
 * 2. DIFF    what changed on each of those dates, matching items by stable key (see rosterKeys),
 * 3. APPLY   the new saved roster: newer roster wins on in-scope dates, everything else untouched.
 *
 * Guarantees:
 * - Re-uploading the same roster finds no changes, so nothing is saved and nothing is duplicated.
 * - Dates the upload does not show are never changed without the person saying so.
 * - A tiny difference that looks like a reading error (≤5 min, or one character in a flight number)
 *   keeps the saved value unless the person chooses the new one.
 * - Flights the person added themselves are never dropped silently.
 *
 * Duties, the plan and all totals are worked out from the saved items, so they never need reconciling.
 */

export interface UploadContent {
  flights: FlightLeg[];
  standby?: StandbyDuty[];
  otherDuties?: OtherDuty[];
  periodStart?: string;
  periodEnd?: string;
  /** Dates with their own row or cell in the document, from the reader. */
  visibleDates?: string[];
}

const DAY_MS = 86400000;
const isDate = (d?: string): d is string => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d);
const toMs = (d: string) => Date.parse(`${d}T12:00:00Z`);
function datesBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let t = toMs(from); t <= toMs(to); t += DAY_MS) out.push(new Date(t).toISOString().slice(0, 10));
  return out;
}

// ─── 1. SCOPE ──────────────────────────────────────────────────────────────────

/**
 * full                 the upload shows (nearly) all of its printed period
 * partial              the upload shows some dates and prints no period
 * partial_with_header  the printed period is much wider than the dates actually shown
 * items_only           the reader gave no list of shown dates (pasted text, older replies)
 */
export type ScopeKind = 'full' | 'partial' | 'partial_with_header' | 'items_only';

export interface ImportScope {
  kind: ScopeKind;
  /** Dates this upload updates by default, sorted. */
  dates: string[];
  /** For partial_with_header: the whole printed period, offered as an alternative. */
  wholePeriod?: string[];
  /**
   * Dates the saved roster has entries on, inside the upload's range, where the upload shows nothing and
   * there is no list of shown dates to tell whether the day is now free. Asked, never assumed.
   */
  unclearDates: string[];
}

/** A printed period is treated as fully shown when at least this share of its dates are visible. */
export const FULL_ROSTER_SHARE = 0.9;

export function importScope(upload: UploadContent, saved: RosterData | null, clock: HomeClock): ImportScope | null {
  const itemDates = new Set<string>([
    ...upload.flights.map((f) => flightHomeDate(f, clock)),
    ...(upload.standby ?? []).map((sb) => standbyHomeDate(sb, clock)),
    ...(upload.otherDuties ?? []).map((d) => d.date).filter(isDate),
  ]);
  const visible = (upload.visibleDates ?? []).filter(isDate);
  const stated = isDate(upload.periodStart) && isDate(upload.periodEnd) && upload.periodStart <= upload.periodEnd;
  const statedDates = stated ? datesBetween(upload.periodStart!, upload.periodEnd!) : [];

  if (visible.length > 0) {
    const shown = [...new Set([...visible, ...itemDates])].sort();
    if (stated) {
      const statedSet = new Set(statedDates);
      const share = shown.filter((d) => statedSet.has(d)).length / statedDates.length;
      if (share >= FULL_ROSTER_SHARE) return { kind: 'full', dates: [...new Set([...statedDates, ...shown])].sort(), unclearDates: [] };
      return { kind: 'partial_with_header', dates: shown, wholePeriod: [...new Set([...statedDates, ...shown])].sort(), unclearDates: [] };
    }
    return { kind: 'partial', dates: shown, unclearDates: [] };
  }

  const dates = [...itemDates].sort();
  if (!dates.length) return null;
  // Without a list of shown dates, a saved entry on a date the upload says nothing about is unclear
  const from = [dates[0], stated ? upload.periodStart! : undefined].filter(isDate).sort()[0];
  const to = [dates[dates.length - 1], stated ? upload.periodEnd! : undefined].filter(isDate).sort().pop()!;
  const savedDates = saved ? savedItemDates(saved, clock) : new Set<string>();
  const unclearDates = [...savedDates].filter((d) => d >= from && d <= to && !itemDates.has(d)).sort();
  return { kind: 'items_only', dates, unclearDates };
}

function savedItemDates(roster: RosterData, clock: HomeClock): Set<string> {
  return new Set([
    ...roster.flights.map((f) => flightHomeDate(f, clock)),
    ...(roster.standbyDuties ?? []).map((sb) => standbyHomeDate(sb, clock)),
    ...(roster.otherDuties ?? []).map((d) => d.date),
  ]);
}

// ─── 2. DIFF ───────────────────────────────────────────────────────────────────

export type FlightChange = 'added' | 'removed' | 'times' | 'number' | 'route';
export interface FlightPair {
  change: FlightChange;
  before?: FlightLeg;
  after?: FlightLeg;
}
export interface StandbyPair {
  change: 'added' | 'removed' | 'times';
  before?: StandbyDuty;
  after?: StandbyDuty;
}
export interface CodePair {
  change: 'added' | 'removed' | 'kind';
  before?: OtherDuty;
  after?: OtherDuty;
}

/** One plain label per changed day, for the review screen. */
export type DaySummary = 'new' | 'now_free' | 'flight_to_standby' | 'standby_to_flight' | 'standby_changed' | 'changed';

export interface DayDiff {
  date: string;
  summary: DaySummary;
  flights: FlightPair[];
  standby: StandbyPair[];
  codes: CodePair[];
}

export interface RosterDiff {
  /** Days with real changes, in date order. */
  days: DayDiff[];
  /** Matched flights that differ only like a reading error; the saved value is kept unless chosen. */
  readingDifferences: FlightPair[];
  /** Flights the person added themselves that the new roster does not show (kept unless they say otherwise). */
  userFlightsNotOnRoster: FlightLeg[];
  /** Flights the person added that the new roster now shows too. */
  userFlightsConfirmed: FlightLeg[];
  /** In-scope dates with no change at all. */
  unchangedDates: string[];
}

/** Times compared to the minute: departure, arrival, report, release. */
const timesOf = (f: FlightLeg) => [f.departureTimeUtc, f.arrivalTimeUtc, f.reportTimeUtc, f.releaseTimeUtc].map((t) => Math.round(Date.parse(t) / 60000));
/** Largest time difference in minutes, or null when positioning differs (a real change). */
function maxTimeShift(a: FlightLeg, b: FlightLeg): number | null {
  if (!!a.isPositioning !== !!b.isPositioning) return null;
  const ta = timesOf(a);
  const tb = timesOf(b);
  return Math.max(...ta.map((t, i) => Math.abs(t - tb[i])));
}
/** Up to this many minutes on every time, with nothing else different, looks like a reading difference. */
export const READING_TOLERANCE_MINUTES = 5;

function oneCharApart(a: string, b: string): boolean {
  if (a === b || Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  while (i < a.length && a[i] === b[i]) i++;
  const restA = a.slice(i);
  const restB = b.slice(i);
  return restA.slice(1) === restB.slice(1) || restA.slice(1) === restB || restA === restB.slice(1);
}

interface DayItems {
  flights: { f: FlightLeg; key: string }[];
  standby: { sb: StandbyDuty; key: string }[];
  codes: OtherDuty[];
}

function byDate(items: { flights: FlightLeg[]; standby: StandbyDuty[]; codes: OtherDuty[] }, clock: HomeClock): Map<string, DayItems> {
  const map = new Map<string, DayItems>();
  const day = (d: string) => {
    if (!map.has(d)) map.set(d, { flights: [], standby: [], codes: [] });
    return map.get(d)!;
  };
  const fk = sectorKeys(items.flights, clock);
  items.flights.forEach((f, i) => day(flightHomeDate(f, clock)).flights.push({ f, key: fk[i] }));
  const sk = standbyKeys(items.standby, clock);
  items.standby.forEach((sb, i) => day(standbyHomeDate(sb, clock)).standby.push({ sb, key: sk[i] }));
  items.codes.forEach((c) => day(c.date).codes.push(c));
  return map;
}

/** Pairs a day's saved and new flights: same key, then same route close in time, then same number and origin. */
function matchFlights(before: DayItems['flights'], after: DayItems['flights']): FlightPair[] {
  const pairs: FlightPair[] = [];
  const leftB = [...before];
  const leftA = [...after];
  const take = (cond: (b: FlightLeg, a: FlightLeg) => boolean, change: (b: FlightLeg, a: FlightLeg) => FlightChange) => {
    for (const a of [...leftA]) {
      const candidates = leftB.filter((b) => cond(b.f, a.f));
      if (!candidates.length) continue;
      // Closest departure wins when several fit (e.g. two BLR→PNQ the same day)
      const b = candidates.sort((x, y) => Math.abs(Date.parse(x.f.departureTimeUtc) - Date.parse(a.f.departureTimeUtc)) - Math.abs(Date.parse(y.f.departureTimeUtc) - Date.parse(a.f.departureTimeUtc)))[0];
      leftB.splice(leftB.indexOf(b), 1);
      leftA.splice(leftA.indexOf(a), 1);
      pairs.push({ change: change(b.f, a.f), before: b.f, after: a.f });
    }
  };
  const keyOf = new Map([...before, ...after].map((x) => [x.f, x.key]));
  take((b, a) => keyOf.get(b) === keyOf.get(a), () => 'times');
  take(
    (b, a) => b.origin === a.origin && b.destination === a.destination && Math.abs(Date.parse(b.departureTimeUtc) - Date.parse(a.departureTimeUtc)) <= 90 * 60000,
    () => 'number'
  );
  take((b, a) => normalizeFlightNumber(b.flightNumber) === normalizeFlightNumber(a.flightNumber) && b.origin === a.origin, () => 'route');
  for (const b of leftB) pairs.push({ change: 'removed', before: b.f });
  for (const a of leftA) pairs.push({ change: 'added', after: a.f });
  return pairs;
}

export function diffRoster(saved: RosterData, upload: UploadContent, scopeDates: string[], clock: HomeClock): RosterDiff {
  const scope = new Set(scopeDates);
  const savedDays = byDate({ flights: saved.flights, standby: saved.standbyDuties ?? [], codes: saved.otherDuties ?? [] }, clock);
  const newDays = byDate({ flights: upload.flights, standby: upload.standby ?? [], codes: upload.otherDuties ?? [] }, clock);
  const result: RosterDiff = { days: [], readingDifferences: [], userFlightsNotOnRoster: [], userFlightsConfirmed: [], unchangedDates: [] };

  for (const date of [...scope].sort()) {
    const b = savedDays.get(date) ?? { flights: [], standby: [], codes: [] };
    const a = newDays.get(date) ?? { flights: [], standby: [], codes: [] };

    const flights: FlightPair[] = [];
    for (const p of matchFlights(b.flights, a.flights)) {
      const ownFlight = p.before?.userChange === 'added' || p.before?.userChange === 'callout';
      if (ownFlight && p.change === 'removed') {
        result.userFlightsNotOnRoster.push(p.before!);
        continue;
      }
      if (ownFlight && p.after) result.userFlightsConfirmed.push(p.before!);
      if (p.before && p.after) {
        const shift = maxTimeShift(p.before, p.after);
        const sameNumber = normalizeFlightNumber(p.before.flightNumber) === normalizeFlightNumber(p.after.flightNumber);
        if (p.change === 'times' && shift === 0) continue; // unchanged
        const looksLikeReading =
          shift !== null &&
          shift <= READING_TOLERANCE_MINUTES &&
          (sameNumber || oneCharApart(normalizeFlightNumber(p.before.flightNumber), normalizeFlightNumber(p.after.flightNumber))) &&
          (p.change === 'times' || p.change === 'number');
        if (looksLikeReading && !p.before.userChange) {
          result.readingDifferences.push(p);
          continue;
        }
      }
      flights.push(p);
    }

    const standby: StandbyPair[] = [];
    const leftB = [...b.standby];
    for (const x of a.standby) {
      const i = leftB.findIndex((y) => y.key === x.key);
      if (i < 0) {
        standby.push({ change: 'added', after: x.sb });
        continue;
      }
      const y = leftB.splice(i, 1)[0];
      if (y.sb.startUtc !== x.sb.startUtc || y.sb.endUtc !== x.sb.endUtc || y.sb.airport !== x.sb.airport) standby.push({ change: 'times', before: y.sb, after: x.sb });
    }
    for (const y of leftB) standby.push({ change: 'removed', before: y.sb });

    const codes: CodePair[] = [];
    const bc = b.codes[0];
    const ac = a.codes[0];
    if (bc && !ac) codes.push({ change: 'removed', before: bc });
    else if (!bc && ac) codes.push({ change: 'added', after: ac });
    else if (bc && ac && bc.kind !== ac.kind) codes.push({ change: 'kind', before: bc, after: ac });

    if (!flights.length && !standby.length && !codes.length) {
      result.unchangedDates.push(date);
      continue;
    }
    result.days.push({ date, summary: summarise(b, a, flights, standby), flights, standby, codes });
  }
  return result;
}

function summarise(b: DayItems, a: DayItems, flights: FlightPair[], standby: StandbyPair[]): DaySummary {
  const hadDuty = b.flights.length + b.standby.length > 0;
  const hasDuty = a.flights.length + a.standby.length > 0;
  if (!hadDuty && hasDuty) return 'new';
  if (hadDuty && !hasDuty) return 'now_free';
  if (b.flights.length && !a.flights.length && a.standby.length) return 'flight_to_standby';
  if (!b.flights.length && b.standby.length && a.flights.length) return 'standby_to_flight';
  if (!flights.length && standby.length) return 'standby_changed';
  return 'changed';
}

/** True when saving would change nothing (the roster is already up to date). */
export const hasNoChanges = (diff: RosterDiff, scope: ImportScope) =>
  diff.days.length === 0 && diff.userFlightsNotOnRoster.length === 0 && scope.unclearDates.length === 0;

// ─── 3. APPLY ──────────────────────────────────────────────────────────────────

export interface ApplyChoices {
  /** Reading differences where the person chose the new reading (by the new flight's id). Default: keep saved. */
  useNewReading?: Set<string>;
  /** Flights the person added that are not on the new roster and should be removed (by id). Default: keep. */
  dropUserFlights?: Set<string>;
}

export interface AppliedItems {
  flights: FlightLeg[];
  standby: StandbyDuty[];
  otherDuties: OtherDuty[];
}

/** The saved items after an upload: in-scope dates take the upload's items; everything else is untouched. */
export function applyImport(saved: RosterData, upload: UploadContent, scopeDates: string[], diff: RosterDiff, clock: HomeClock, choices: ApplyChoices = {}): AppliedItems {
  const scope = new Set(scopeDates);
  const inScope = (d: string) => scope.has(d);

  // Reading differences: keep the saved flight unless the new reading was chosen
  const keepSaved = new Map<string, FlightLeg>();
  for (const p of diff.readingDifferences) if (p.before && p.after && !choices.useNewReading?.has(p.after.id)) keepSaved.set(p.after.id, p.before);
  const keptUserFlights = diff.userFlightsNotOnRoster.filter((f) => !choices.dropUserFlights?.has(f.id));

  const flights = [
    ...saved.flights.filter((f) => !inScope(flightHomeDate(f, clock))),
    ...upload.flights.filter((f) => inScope(flightHomeDate(f, clock))).map((f) => keepSaved.get(f.id) ?? f),
    ...keptUserFlights,
  ].sort((x, y) => Date.parse(x.departureTimeUtc) - Date.parse(y.departureTimeUtc));
  const standby = [
    ...(saved.standbyDuties ?? []).filter((sb) => !inScope(standbyHomeDate(sb, clock))),
    ...(upload.standby ?? []).filter((sb) => inScope(standbyHomeDate(sb, clock))),
  ].sort((x, y) => Date.parse(x.startUtc) - Date.parse(y.startUtc));
  const otherDuties = [...(saved.otherDuties ?? []).filter((d) => !inScope(d.date)), ...(upload.otherDuties ?? []).filter((d) => inScope(d.date))].sort((x, y) =>
    x.date.localeCompare(y.date)
  );
  return { flights, standby, otherDuties };
}

// ─── Combining several screenshots of one upload ───────────────────────────────

/**
 * Several screenshots often overlap. The same flight (same key) is kept once; if two screenshots
 * disagree on its times, the later screenshot is used and a warning names the flight so it can be checked.
 */
export function combineScreenshots(flights: FlightLeg[], standby: StandbyDuty[], otherDuties: OtherDuty[], clock: HomeClock) {
  const warnings: string[] = [];
  const fk = sectorKeys(flights, clock).map((k) => k.split('#')[0]);
  const flightByKey = new Map<string, FlightLeg>();
  flights.forEach((f, i) => {
    const prev = flightByKey.get(fk[i]);
    if (prev) {
      const shift = maxTimeShift(prev, f);
      if (shift === null || shift > READING_TOLERANCE_MINUTES) {
        warnings.push(`Two screenshots disagree on ${f.flightNumber} ${f.origin}→${f.destination} on ${flightHomeDate(f, clock)}. The later one is used; please check it.`);
        flightByKey.set(fk[i], f);
      }
      return;
    }
    flightByKey.set(fk[i], f);
  });
  const sk = standbyKeys(standby, clock).map((k) => k.split('#')[0]);
  const standbyByKey = new Map<string, StandbyDuty>();
  standby.forEach((sb, i) => standbyByKey.set(sk[i], sb));
  const codeByDate = new Map<string, OtherDuty>();
  for (const d of otherDuties) codeByDate.set(d.date, d);
  return {
    flights: [...flightByKey.values()].sort((a, b) => Date.parse(a.departureTimeUtc) - Date.parse(b.departureTimeUtc)),
    standby: [...standbyByKey.values()].sort((a, b) => Date.parse(a.startUtc) - Date.parse(b.startUtc)),
    otherDuties: [...codeByDate.values()].sort((a, b) => a.date.localeCompare(b.date)),
    warnings,
  };
}

export { rosterClock };

// ─── Keeping the person's own adjustments ──────────────────────────────────────

/**
 * Sleep and nap adjustments are saved under the block's planned start ("sleep-2026-10-02T17:30", UTC).
 * After a roster update, adjustments near a changed day are dropped (the rest period around it is
 * re-planned), and every other adjustment is kept. A change reaches the rest periods before and after
 * the changed duty, so a margin of two days before and one day after is cleared (UTC vs home date included).
 */
export function keepNudgesOutside(nudges: Record<string, number>, changedDates: string[]): Record<string, number> {
  if (!changedDates.length) return { ...nudges };
  const blocked = new Set<string>();
  for (const d of changedDates) for (let k = -2; k <= 1; k++) blocked.add(new Date(toMs(d) + k * DAY_MS).toISOString().slice(0, 10));
  const out: Record<string, number> = {};
  for (const [key, minutes] of Object.entries(nudges)) {
    const date = key.match(/(\d{4}-\d{2}-\d{2})T/)?.[1];
    if (date && blocked.has(date)) continue;
    out[key] = minutes;
  }
  return out;
}

// ─── Plain-words record for history ────────────────────────────────────────────

export const DAY_SUMMARY_LABEL: Record<DaySummary, string> = {
  new: 'New duty',
  now_free: 'Now free',
  flight_to_standby: 'Flight → Standby',
  standby_to_flight: 'Standby → Flight',
  standby_changed: 'Standby moved',
  changed: 'Changed',
};
const CODE_WORDS: Record<string, string> = { off: 'Day off', leave: 'Leave', sick: 'Sick', training: 'Training', other: 'Other' };

/** Each changed day in plain words (home time), for the change history. */
export function describeChanges(diff: RosterDiff, clock: HomeClock): HistoryDayChange[] {
  const t = (iso: string) => clock.time(Date.parse(iso));
  const fl = (f: FlightLeg) => `${f.flightNumber} ${f.origin}→${f.destination} ${t(f.departureTimeUtc)}`;
  const sbl = (sb: StandbyDuty) => `${sb.kind === 'home' ? 'Home' : 'Airport'} standby ${t(sb.startUtc)}–${t(sb.endUtc)}`;
  const code = (c: OtherDuty) => `${CODE_WORDS[c.kind] ?? c.kind}${c.code ? ` (${c.code})` : ''}`;
  const pair = <T,>(change: string, before: T | undefined, after: T | undefined, f: (x: T) => string) =>
    change === 'added' ? `${f(after!)} added` : change === 'removed' ? `${f(before!)} removed` : `${f(before!)} → ${f(after!)}`;
  return diff.days.map((day) => ({
    date: day.date,
    label: DAY_SUMMARY_LABEL[day.summary],
    lines: [
      ...day.flights.map((p) => pair(p.change, p.before, p.after, fl)),
      ...day.standby.map((p) => pair(p.change, p.before, p.after, sbl)),
      ...day.codes.map((p) => pair(p.change, p.before, p.after, code)),
    ],
  }));
}

/** What App needs to know about a roster update (rather than a brand-new roster). */
export interface RosterUpdateInfo {
  changedDates: string[];
  changes: HistoryDayChange[];
}
