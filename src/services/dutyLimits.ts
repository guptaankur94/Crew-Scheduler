import { FlightLeg, OtherDuty, RosterData, StandbyDuty } from '../types/circadian';
import { Duty, groupDuties, HomeClock } from './planEngine';
import { rosterClock } from './rosterKeys';

/*
 * DGCA CABIN CREW DUTY LIMITS: A GUIDE, NOT A COMPLIANCE CHECK
 *
 * Checks a roster against the prescriptive limits in DGCA CAR Section 7, Series J, Part I
 * ("Flight Duty Time and Flight Time Limitations – Cabin Crew"):
 *   - Issue IV, effective 1 November 2018 (in force), and
 *   - Issue V, DGCA draft of October 2025 (date and effective date blank in the draft), for preview only.
 * Numbers are taken from the text of each document (paragraph numbers in `ref`), not from summaries.
 *
 * What it can and cannot know:
 * - It sees the roster's scheduled times, so it checks the plan, not what actually happened (delays the
 *   person reported are left out; the CAR's allowances for unforeseen circumstances are not modelled).
 * - Night windows use home-base time (the CAR's rule for duties within 3 time zones).
 * - Rest is measured from release to report. The CAR does not count travel to and from the airport as
 *   rest, so real rest is shorter; small margins are therefore worth a look.
 * - Totals over 7, 28, 90 or 365 days only use the days on the roster; a window reaching back before
 *   the roster starts is reported only if it is already over the limit.
 * - An airline's approved FDTL scheme can be stricter than the CAR.
 */

export type RuleSetId = 'dgca-cc-iv' | 'dgca-cc-v-draft';

interface FdpRow {
  /** Highest flight time this row covers, in minutes (Infinity for the last row). */
  maxFlightMin: number;
  /** Maximum FDP in minutes, given the number of landings, or null if that many landings are not allowed. */
  fdpFor: (landings: number) => number | null;
  ref: string;
  /** Split duty (a break of 3–10 hours) may extend this row. */
  splitDuty: boolean;
  /** The night-time (WOCL) reduction applies to this row. */
  woclReduction: boolean;
}

export interface RuleSet {
  id: RuleSetId;
  name: string;
  status: 'in-force' | 'draft';
  note: string;
  fdpRows: FdpRow[];
  /** Draft V only: duties touching 00:00–06:00 within the acclimatised zone use this row instead (Para 6.1.4). */
  nightRow?: FdpRow;
  woclHours: [number, number];
  /** "Night duty" window used for consecutive nights and (draft) night rules. */
  nightWindowHours: [number, number];
  flightTimeLimits: { days: number; hours: number; ref: string }[];
  dutyLimits: { days: number; hours: number; ref: string }[];
  minRest: { base: number; tz3: number; tz7: number; ref: string };
  weeklyRest: { hours: number; afterManyNightsHours?: number; ref: string };
  consecutiveNightsRef: string;
  standby: { maxHours: number; airportMaxHours: number; restAfterHome: number; restAfterAirport: number; ref: string };
}

const H = 60;
const MIN = 60000;
const HOUR = 3600000;

export const RULE_SETS: Record<RuleSetId, RuleSet> = {
  'dgca-cc-iv': {
    id: 'dgca-cc-iv',
    name: 'DGCA CAR 7-J-I Issue IV',
    status: 'in-force',
    note: 'In force since 1 November 2018',
    fdpRows: [
      { maxFlightMin: 8 * H, fdpFor: (l) => (l <= 6 ? 12 * H : null), ref: 'Para 6.1.1', splitDuty: true, woclReduction: true },
      { maxFlightMin: 11 * H, fdpFor: (l) => (l <= 3 ? 15 * H : null), ref: 'Para 6.1.2', splitDuty: false, woclReduction: true },
      { maxFlightMin: 16 * H, fdpFor: (l) => (l <= 1 ? 18 * H : null), ref: 'Para 6.1.3', splitDuty: false, woclReduction: true },
      { maxFlightMin: Infinity, fdpFor: (l) => (l <= 1 ? 22 * H : null), ref: 'Para 6.1.4 (ULR, needs DGCA approval)', splitDuty: false, woclReduction: true },
    ],
    woclHours: [2, 6],
    nightWindowHours: [0, 5],
    flightTimeLimits: [
      { days: 7, hours: 40, ref: 'Para 6.2' },
      { days: 28, hours: 115, ref: 'Para 6.2' },
      { days: 90, hours: 300, ref: 'Para 6.2' },
      { days: 365, hours: 1000, ref: 'Para 6.2' },
    ],
    dutyLimits: [
      { days: 7, hours: 65, ref: 'Para 6.3' },
      { days: 28, hours: 210, ref: 'Para 6.3' },
    ],
    minRest: { base: 12, tz3: 14, tz7: 36, ref: 'Para 7.1' },
    weeklyRest: { hours: 36, ref: 'Para 7.4' },
    consecutiveNightsRef: 'Para 10.1',
    standby: { maxHours: 12, airportMaxHours: 8, restAfterHome: 8, restAfterAirport: 12, ref: 'Para 8.2' },
  },
  'dgca-cc-v-draft': {
    id: 'dgca-cc-v-draft',
    name: 'DGCA CAR 7-J-I Issue V (draft)',
    status: 'draft',
    note: 'DGCA draft of October 2025; not in force until DGCA notifies it',
    fdpRows: [
      {
        maxFlightMin: 8 * H,
        fdpFor: (l) => (l <= 3 ? 12.5 * H : l === 4 ? 12 * H : l === 5 ? 11.5 * H : l === 6 ? 11 * H : null),
        ref: 'Para 6.1.1',
        splitDuty: true,
        woclReduction: false,
      },
      { maxFlightMin: 9 * H, fdpFor: (l) => (l <= 2 ? 14 * H : null), ref: 'Para 6.1.2', splitDuty: false, woclReduction: false },
      { maxFlightMin: 10 * H, fdpFor: (l) => (l <= 1 ? 15 * H : null), ref: 'Para 6.1.3', splitDuty: false, woclReduction: true },
    ],
    nightRow: { maxFlightMin: 8 * H, fdpFor: (l) => (l <= 2 ? 10 * H : null), ref: 'Para 6.1.4', splitDuty: false, woclReduction: false },
    woclHours: [2, 6],
    nightWindowHours: [0, 6],
    flightTimeLimits: [
      { days: 7, hours: 35, ref: 'Para 8.1' },
      { days: 14, hours: 65, ref: 'Para 8.2' },
      { days: 28, hours: 100, ref: 'Para 8.3' },
      { days: 90, hours: 300, ref: 'Para 8.4' },
      { days: 365, hours: 1000, ref: 'Para 8.5' },
    ],
    dutyLimits: [
      { days: 7, hours: 60, ref: 'Para 8.1' },
      { days: 14, hours: 100, ref: 'Para 8.2' },
      { days: 28, hours: 190, ref: 'Para 8.3' },
      { days: 90, hours: 600, ref: 'Para 8.4' },
      { days: 365, hours: 1800, ref: 'Para 8.5' },
    ],
    minRest: { base: 12, tz3: 18, tz7: 36, ref: 'Para 9.1' },
    weeklyRest: { hours: 48, afterManyNightsHours: 60, ref: 'Para 9.4' },
    consecutiveNightsRef: 'Para 12.1',
    standby: { maxHours: 12, airportMaxHours: 8, restAfterHome: 8, restAfterAirport: 12, ref: 'Para 10.2' },
  },
};

export interface LimitIssue {
  date: string; // home date the issue belongs to
  /** 'over': the roster as published exceeds the limit. 'check': worth confirming (e.g. OK only as split duty). */
  severity: 'over' | 'check';
  title: string;
  detail: string;
  ref: string;
}

export interface LimitReport {
  rules: RuleSet;
  issues: LimitIssue[];
  /** Things the check could not assess, in plain words. */
  notChecked: string[];
}

const fmt = (minutes: number) => `${Math.floor(minutes / 60)}:${String(Math.round(minutes % 60)).padStart(2, '0')}`;
const SCHEDULED_POST_FLIGHT_MIN = 30; // FDP ends at chocks on + 30 min for scheduled air transport (CAR definitions)

interface FdpInfo {
  duty: Duty;
  startMs: number;
  fdpEndMs: number;
  dutyEndMs: number;
  flightMin: number;
  landings: number;
  maxTzDiff: number;
}

/** Minutes of [start, end) that fall inside the daily home-time window [fromHour, toHour). */
function overlapWithDaily(start: number, end: number, fromHour: number, toHour: number, clock: HomeClock): { minutes: number; first?: [number, number] } {
  let total = 0;
  let first: [number, number] | undefined;
  for (let d = clock.addDays(clock.date(start), -1); d <= clock.date(end); d = clock.addDays(d, 1)) {
    const s = Math.max(start, clock.at(d, fromHour));
    const e = Math.min(end, clock.at(d, toHour));
    if (e > s) {
      total += (e - s) / MIN;
      first ??= [s, e];
    }
  }
  return { minutes: total, first };
}

/** True when the rest [start, end] contains an 8-hour local night (any 8 hours between 22:00 and 08:00). */
function localNightsIn(start: number, end: number, clock: HomeClock): number {
  let nights = 0;
  for (let d = clock.addDays(clock.date(start), -1); d <= clock.date(end); d = clock.addDays(d, 1)) {
    const windowStart = clock.at(d, 22);
    const windowEnd = clock.at(clock.addDays(d, 1), 8);
    if (Math.max(start, windowStart) + 8 * HOUR <= Math.min(end, windowEnd)) nights++;
  }
  return nights;
}

export function checkDutyLimits(
  roster: RosterData,
  ruleSetId: RuleSetId = 'dgca-cc-iv',
  coverage?: { from: string; to: string }
): LimitReport {
  const rules = RULE_SETS[ruleSetId];
  const clock = rosterClock(roster);
  const issues: LimitIssue[] = [];
  const notChecked = [
    'Augmented crew, ULR and extensions for unforeseen circumstances are not checked.',
    'Rest is measured from release to report; travel to and from the airport does not count as rest, so check small margins.',
  ];
  const homeOffsetAt = (ms: number) => clock.offsetAt(ms);
  const standby = roster.standbyDuties ?? [];
  const duties = groupDuties(roster.flights, roster.homeBase, standby);

  // ── Flight duty periods (Para 6.1 / 7.1) ──
  const fdps: FdpInfo[] = [];
  for (const duty of duties) {
    const operating = duty.flights.filter((f) => !f.isPositioning);
    if (!operating.length) continue;
    const lastOp = operating.reduce((a, b) => (Date.parse(a.arrivalTimeUtc) > Date.parse(b.arrivalTimeUtc) ? a : b));
    const fdpEndMs = Date.parse(lastOp.arrivalTimeUtc) + SCHEDULED_POST_FLIGHT_MIN * MIN;
    const releases = duty.flights.map((f) => Math.max(Date.parse(f.releaseTimeUtc), Date.parse(f.arrivalTimeUtc) + SCHEDULED_POST_FLIGHT_MIN * MIN));
    const maxTzDiff = Math.max(...duty.flights.flatMap((f) => [f.originTzOffset, f.destTzOffset]).map((o) => Math.abs(o - homeOffsetAt(duty.startMs))));
    fdps.push({
      duty,
      startMs: duty.startMs,
      fdpEndMs,
      dutyEndMs: Math.max(duty.endMs, ...releases),
      flightMin: operating.reduce((s, f) => s + f.durationMinutes, 0),
      landings: operating.length,
      maxTzDiff,
    });
  }

  for (const fdp of fdps) {
    const date = clock.date(fdp.startMs);
    const fdpMin = (fdp.fdpEndMs - fdp.startMs) / MIN;
    const night = overlapWithDaily(fdp.startMs, fdp.fdpEndMs, rules.nightWindowHours[0], rules.nightWindowHours[1], clock).minutes > 0;
    const row = rules.nightRow && night && fdp.maxTzDiff <= 3 && fdp.flightMin <= rules.nightRow.maxFlightMin ? rules.nightRow : rules.fdpRows.find((r) => fdp.flightMin <= r.maxFlightMin);
    if (!row) {
      issues.push({ date, severity: 'check', title: 'Long flying day', detail: `Flight time ${fmt(fdp.flightMin)} is beyond the basic limits; augmented crew rules apply, which this check does not cover.`, ref: rules.name });
      continue;
    }
    let limit = row.fdpFor(fdp.landings);
    if (limit === null) {
      issues.push({ date, severity: 'over', title: 'Too many landings', detail: `${fdp.landings} landings with ${fmt(fdp.flightMin)} flight time is more than this row allows.`, ref: row.ref });
      continue;
    }
    // Night-time (WOCL) reduction: starting in it costs the overlap (up to 2h); ending in or spanning it costs half
    let reduction = 0;
    if (row.woclReduction) {
      const [ws, we] = rules.woclHours;
      const ov = overlapWithDaily(fdp.startMs, fdp.fdpEndMs, ws, we, clock);
      const startHour = clock.hour(fdp.startMs);
      if (ov.minutes > 0) reduction = startHour >= ws && startHour < we ? Math.min(ov.minutes, 120) : ov.minutes / 2;
    }
    // Home or hotel standby of 6 hours or more before this duty: the FDP is reduced by half the standby time
    const homeStandby = standby.find((sb) => sb.kind === 'home' && Math.abs(Date.parse(sb.endUtc) - fdp.startMs) <= 5 * MIN);
    if (homeStandby) {
      const sbMin = (Date.parse(homeStandby.endUtc) - Date.parse(homeStandby.startUtc)) / MIN;
      if (sbMin >= 6 * 60) reduction += sbMin / 2;
    }
    limit -= reduction;
    if (fdpMin <= limit) continue;

    // Over: would a 3–10 hour break inside the duty make it acceptable as split duty?
    const sorted = [...fdp.duty.flights].sort((a, b) => Date.parse(a.departureTimeUtc) - Date.parse(b.departureTimeUtc));
    let bestBreak = 0;
    for (let i = 1; i < sorted.length; i++) {
      const brk = (Date.parse(sorted[i].reportTimeUtc) - Date.parse(sorted[i - 1].releaseTimeUtc)) / MIN;
      if (brk >= 180 && brk <= 600) bestBreak = Math.max(bestBreak, brk);
    }
    const splitOk = row.splitDuty && bestBreak > 0 && fdpMin <= limit + bestBreak / 2 && !(rules.id === 'dgca-cc-v-draft' && night);
    const why = [
      `Flight duty period ${fmt(fdpMin)} (report ${clock.time(fdp.startMs)} to ${clock.time(fdp.fdpEndMs)})`,
      `limit ${fmt(limit)} for ${fdp.landings} ${fdp.landings === 1 ? 'landing' : 'landings'} and ${fmt(fdp.flightMin)} flight time`,
      reduction > 0 ? `after ${fmt(reduction)} off for night-time or standby` : '',
    ].filter(Boolean);
    issues.push(
      splitOk
        ? { date, severity: 'check', title: 'Long duty: OK only as split duty', detail: `${why.join(', ')}. Within limits only if the ${fmt(bestBreak)} break is planned as split duty.`, ref: `${row.ref}, split duty` }
        : { date, severity: 'over', title: 'Flight duty period over the limit', detail: `${why.join(', ')}.`, ref: row.ref }
    );
  }

  // ── Rest before each flight duty (Para 7.1 / 9.1), and after standby (Para 8.2.5 / 10.2.5) ──
  type Block = { startMs: number; endMs: number; kind: 'fdp' | 'duty' | 'home_standby' | 'airport_standby'; tz: number };
  const blocks: Block[] = [
    ...fdps.map((f) => ({ startMs: f.startMs, endMs: f.dutyEndMs, kind: 'fdp' as const, tz: f.maxTzDiff })),
    ...duties.filter((d) => !d.flights.some((f) => !f.isPositioning)).map((d) => ({ startMs: d.startMs, endMs: d.endMs, kind: d.airportStandby ? ('airport_standby' as const) : ('duty' as const), tz: 0 })),
    ...standby.filter((sb) => sb.kind === 'home').map((sb) => ({ startMs: Date.parse(sb.startUtc), endMs: Date.parse(sb.endUtc), kind: 'home_standby' as const, tz: 0 })),
  ].sort((a, b) => a.startMs - b.startMs);

  for (let i = 1; i < blocks.length; i++) {
    const prev = blocks[i - 1];
    const cur = blocks[i];
    const restMin = (cur.startMs - prev.endMs) / MIN;
    const date = clock.date(cur.startMs);
    if (restMin <= 0) continue; // a callout ending a standby, or overlapping entries
    if (cur.kind === 'fdp' && (prev.kind === 'fdp' || prev.kind === 'duty')) {
      const prevMin = (prev.endMs - prev.startMs) / MIN;
      const base = prev.tz >= 7 ? rules.minRest.tz7 : prev.tz >= 3 ? rules.minRest.tz3 : rules.minRest.base;
      const required = Math.max(prevMin, base * 60);
      if (restMin < required) {
        issues.push({ date, severity: 'over', title: 'Rest before duty too short', detail: `${fmt(restMin)} rest (release ${clock.time(prev.endMs)} to report ${clock.time(cur.startMs)}); at least ${fmt(required)} needed.`, ref: rules.minRest.ref });
      }
      if (prevMin > 18 * 60 && localNightsIn(prev.endMs, cur.startMs, clock) === 0) {
        issues.push({ date, severity: 'over', title: 'Rest without a local night', detail: `The previous duty was over 18 hours, so the rest must include a local night.`, ref: rules.id === 'dgca-cc-iv' ? 'Para 7.2' : 'Para 9.2' });
      }
    }
    if ((prev.kind === 'home_standby' || prev.kind === 'airport_standby') && cur.kind === 'fdp') {
      const required = prev.kind === 'home_standby' ? rules.standby.restAfterHome : rules.standby.restAfterAirport;
      if (restMin < required * 60) {
        issues.push({ date, severity: 'over', title: 'Rest after standby too short', detail: `${fmt(restMin)} after standby ended; at least ${required}:00 needed when the standby did not lead to a duty.`, ref: rules.standby.ref });
      }
    }
  }

  // ── Standby length (Para 8.2.1 / 10.2.1) ──
  for (const sb of standby) {
    const hours = (Date.parse(sb.endUtc) - Date.parse(sb.startUtc)) / HOUR;
    const max = sb.kind === 'airport' ? rules.standby.airportMaxHours : rules.standby.maxHours;
    if (hours > max + 1 / 60) {
      issues.push({ date: clock.date(Date.parse(sb.startUtc)), severity: 'over', title: 'Standby too long', detail: `${sb.kind === 'airport' ? 'Airport' : 'Home'} standby of ${fmt(hours * 60)}; the limit is ${max}:00.`, ref: rules.standby.ref });
    }
  }

  // ── Totals over 7 / 14 / 28 / 90 / 365 days (Para 6.2–6.3 / 8) ──
  const coveredFrom = coverage?.from ?? (fdps.length ? clock.date(Math.min(...blocks.map((b) => b.startMs))) : undefined);
  const coveredTo = coverage?.to ?? (fdps.length ? clock.date(Math.max(...blocks.map((b) => b.endMs))) : undefined);
  if (coveredFrom && coveredTo) {
    const flightIntervals = roster.flights.filter((f) => !f.isPositioning).map((f) => [Date.parse(f.departureTimeUtc), Date.parse(f.arrivalTimeUtc)] as const);
    // Duty: duty periods in full; standby that did not lead to a duty counts 100% at the airport, 25% at home
    const dutyIntervals: { s: number; e: number; weight: number }[] = [
      ...fdps.map((f) => ({ s: f.startMs, e: f.dutyEndMs, weight: 1 })),
      ...duties.filter((d) => !d.flights.some((f) => !f.isPositioning)).map((d) => ({ s: d.startMs, e: d.endMs, weight: 1 })),
      ...standby
        .filter((sb) => sb.kind === 'home' && !fdps.some((f) => Math.abs(f.startMs - Date.parse(sb.endUtc)) <= 5 * MIN))
        .map((sb) => ({ s: Date.parse(sb.startUtc), e: Date.parse(sb.endUtc), weight: 0.25 })),
    ];
    const sumIn = (from: number, to: number, list: { s: number; e: number; weight: number }[]) =>
      list.reduce((acc, x) => acc + Math.max(0, Math.min(x.e, to) - Math.max(x.s, from)) * x.weight, 0) / HOUR;
    const check = (limits: RuleSet['flightTimeLimits'], list: { s: number; e: number; weight: number }[], what: 'Flight time' | 'Duty time') => {
      for (const lim of limits) {
        let worst: { end: string; hours: number; complete: boolean } | null = null;
        for (let end = coveredFrom; end <= coveredTo; end = clock.addDays(end, 1)) {
          const start = clock.addDays(end, -(lim.days - 1));
          const hours = sumIn(clock.at(start, 0), clock.at(clock.addDays(end, 1), 0), list);
          if (hours > lim.hours && (!worst || hours > worst.hours)) worst = { end, hours, complete: start >= coveredFrom };
        }
        if (worst) {
          issues.push({
            date: worst.end,
            severity: 'over',
            title: `${what} over ${lim.days} days`,
            detail: `${fmt(worst.hours * 60)} in the ${lim.days} days to ${worst.end}; the limit is ${lim.hours}:00.${worst.complete ? '' : ' (Counting only the days on your roster.)'}`,
            ref: lim.ref,
          });
        }
      }
    };
    check(rules.flightTimeLimits, flightIntervals.map(([s, e]) => ({ s, e, weight: 1 })), 'Flight time');
    check(rules.dutyLimits, dutyIntervals, 'Duty time');

    // ── Weekly rest (Para 7.4 / 9.4) ──
    const trainingDays = (roster.otherDuties ?? []).filter((d: OtherDuty) => d.kind === 'training' || d.kind === 'other');
    const busy = [
      ...blocks.map((b) => ({ s: b.startMs, e: b.endMs })),
      // Training and other duties have no times on the roster: treat the whole day as not rest
      ...trainingDays.map((d) => ({ s: clock.at(d.date, 0), e: clock.at(clock.addDays(d.date, 1), 0) })),
    ].sort((a, b) => a.s - b.s);
    const windowStart = clock.at(coveredFrom, 0);
    const windowEnd = clock.at(clock.addDays(coveredTo, 1), 0);
    const rests: { s: number; e: number; knownStart: boolean }[] = [];
    let cursor = windowStart;
    let knownStart = false;
    for (const b of busy) {
      if (b.s > cursor) rests.push({ s: cursor, e: b.s, knownStart });
      cursor = Math.max(cursor, b.e);
      knownStart = true;
    }
    if (windowEnd > cursor) rests.push({ s: cursor, e: windowEnd, knownStart });
    const nightDutiesBefore = (ms: number) =>
      fdps.filter((f) => f.startMs < ms && f.startMs >= ms - 168 * HOUR && overlapWithDaily(f.startMs, f.fdpEndMs, rules.nightWindowHours[0], rules.nightWindowHours[1], clock).minutes > 0).length;
    const qualifies = (r: { s: number; e: number }) => {
      const needed = rules.weeklyRest.afterManyNightsHours && nightDutiesBefore(r.s) > 3 ? rules.weeklyRest.afterManyNightsHours : rules.weeklyRest.hours;
      return r.e - r.s >= needed * HOUR && localNightsIn(r.s, r.e, clock) >= 2;
    };
    const weekly = rests.filter(qualifies);
    for (let i = 0; i < weekly.length; i++) {
      const due = weekly[i].e + 168 * HOUR;
      const next = weekly[i + 1];
      if (due <= windowEnd && (!next || next.s > due)) {
        const involvesTraining = trainingDays.some((d) => clock.at(d.date, 0) < (next?.s ?? windowEnd) && clock.at(d.date, 0) >= weekly[i].e);
        issues.push({
          date: clock.date(due),
          severity: involvesTraining ? 'check' : 'over',
          title: 'Weekly rest overdue',
          detail: `No continuous ${rules.weeklyRest.hours}-hour rest with two local nights within 168 hours of the one ending ${clock.date(weekly[i].e)} ${clock.time(weekly[i].e)}.${involvesTraining ? ' Training days have no times on the roster and were counted as whole days of duty.' : ''}`,
          ref: rules.weeklyRest.ref,
        });
      }
    }
    if (trainingDays.length) notChecked.push('Training and other non-flying duties have no times on the roster, so they are treated as whole days of duty for weekly rest.');
  }

  // ── Consecutive nights (Para 10.1 / 12.1): duty touching 00:00–05:00 (draft: 06:00) two nights running, at most once in 168 hours ──
  const nightDates = new Set<string>();
  for (const f of fdps) {
    for (let d = clock.date(f.startMs); d <= clock.date(f.fdpEndMs); d = clock.addDays(d, 1)) {
      const s = Math.max(f.startMs, clock.at(d, rules.nightWindowHours[0]));
      const e = Math.min(f.fdpEndMs, clock.at(d, rules.nightWindowHours[1]));
      if (e > s) nightDates.add(d);
    }
  }
  const pairs = [...nightDates].sort().filter((d) => nightDates.has(clock.addDays(d, -1)));
  for (let i = 1; i < pairs.length; i++) {
    if (clock.at(pairs[i], 0) - clock.at(pairs[i - 1], 0) < 168 * HOUR) {
      issues.push({
        date: pairs[i],
        severity: 'over',
        title: 'Consecutive night duties',
        detail: `Duty during ${String(rules.nightWindowHours[0]).padStart(2, '0')}:00–${String(rules.nightWindowHours[1]).padStart(2, '0')}:00 on two nights in a row, more than once within 168 hours (also on the nights before ${pairs[i - 1]}).`,
        ref: rules.consecutiveNightsRef,
      });
    }
  }

  if (fdps.some((f) => f.maxTzDiff > 3)) notChecked.push('Trips more than 3 hours from home time: night windows are taken in home time, and rest on return is not checked.');
  issues.sort((a, b) => a.date.localeCompare(b.date) || (a.severity === b.severity ? 0 : a.severity === 'over' ? -1 : 1));
  return { rules, issues, notChecked };
}

export type { FlightLeg, StandbyDuty };
