import { getAirportTzOffset } from '../data/airports';
import { CircadianEvent, CrewPreferences, EventType, FlightLeg, PrepDetails, RosterData, ScientificCitation, StandbyDuty } from '../types/circadian';

/**
 * Plan engine: treats the roster as one continuous timeline.
 *
 * Flights are grouped into duties. Between two duties there is a rest gap that starts once the crew
 * member could realistically be in bed (release + travel + wind-down) and ends when they must wake
 * to get ready for the next report. Sleep, naps, caffeine, meals and light advice are only ever
 * placed inside those gaps, so the plan cannot tell anyone to sleep through a flight or set a home
 * alarm while they are abroad.
 *
 * Body-clock advice uses home-base time throughout. On short layovers the evidence favours staying
 * on home time; adapting to local time on longer trips is planned for a later phase.
 */

const MIN = 60_000;
const HOUR = 60 * MIN;

/** Flights whose report time is less than this after the previous release belong to the same duty. */
export const DUTY_SPLIT_GAP_HOURS = 6;
/** Hotel transfer at an outstation, each way. FAA cabin-crew survey: door to hotel averaged 49 minutes. */
export const HOTEL_TRANSFER_MINUTES = 45;
/** Time between arriving home or at the hotel and lights out. */
export const WIND_DOWN_MINUTES = 30;
/** Nap before a night duty, finished when getting ready starts so grogginess passes before driving or duty. */
export const PRE_NIGHT_DUTY_NAP_MINUTES = 90;
/** Nap after an early duty. */
export const POST_EARLY_DUTY_NAP_MINUTES = 60;
/** Longest first sleep after a night duty, so the following night's sleep still works. */
export const RECOVERY_SLEEP_MAX_HOURS = 5;
/** Usual home-time bedtime used on nights with no duty pressure. */
export const DEFAULT_BEDTIME_HOUR = 23;
/** Flight sectors at least this long may have in-flight crew rest. */
export const CREW_REST_SECTOR_MINUTES = 7 * 60;
/** Shortest sector on which a chosen bunk-rest shift is used. */
export const BUNK_CHOICE_SECTOR_MINUTES = 5 * 60;
/** A crew-rest nap ends at least this long before landing so grogginess has passed. */
export const CREW_REST_LANDING_BUFFER_MINUTES = 60;
/** Chronotype nudges the usual bedtime. The questionnaire is approximate, so the shift is kept small. */
export const CHRONOTYPE_BEDTIME_SHIFT_HOURS = { lark: -0.75, intermediate: 0, owl: 0.75 } as const;
/** After a short night the next night's sleep starts earlier by up to this much. */
export const SHORT_SLEEP_CATCH_UP_MAX_HOURS = 1;
/** A logged night's sleep only influences the plan for this long. */
export const SLEEP_LOG_VALID_HOURS = 48;

/** The usual home-time bedtime for this person. */
export function usualBedtimeHour(preferences: CrewPreferences): number {
  return DEFAULT_BEDTIME_HOUR + (CHRONOTYPE_BEDTIME_SHIFT_HOURS[preferences.chronotype] ?? 0);
}

/** How much earlier tonight's sleep should start after a logged short night (0 if none applies). */
export function shortSleepCatchUpMs(preferences: CrewPreferences, nowMs: number): { amountMs: number; loggedAtMs: number } | null {
  const hours = preferences.actualLastSleepHours;
  const loggedAt = preferences.actualLastSleepLoggedAt ? Date.parse(preferences.actualLastSleepLoggedAt) : NaN;
  if (hours === undefined || !Number.isFinite(loggedAt)) return null;
  if (nowMs - loggedAt > SLEEP_LOG_VALID_HOURS * HOUR || nowMs < loggedAt - HOUR) return null;
  const deficit = preferences.targetSleepHours - hours;
  if (deficit < 0.5) return null;
  return { amountMs: Math.min(deficit, SHORT_SLEEP_CATCH_UP_MAX_HOURS) * HOUR, loggedAtMs: loggedAt };
}

export interface Duty {
  index: number;
  flights: FlightLeg[]; // empty for an airport standby with no callout
  airportStandby?: StandbyDuty;
  startMs: number; // first report
  endMs: number; // last release
  startAirport: string;
  endAirport: string;
  awayAtStart: boolean;
  awayAtEnd: boolean;
  endLocalOffset: number;
}

export interface PlanCitations {
  anchor_sleep: ScientificCitation;
  recovery_sleep: ScientificCitation;
  nasa_nap_26: ScientificCitation;
  pre_duty_90_nap: ScientificCitation;
  chrono_nutrition_window: ScientificCitation;
  gut_rest_night: ScientificCitation;
  caffeine_cutoff: ScientificCitation;
  melatonin_shield: ScientificCitation;
  daylight: ScientificCitation;
  prep: ScientificCitation;
}

interface Block {
  startMs: number;
  endMs: number;
}

interface SleepBlock extends Block {
  catchUp?: boolean;
  kind: 'night' | 'before_duty' | 'recovery' | 'nap_before_night' | 'nap_after_early';
  id: string;
  windowStart: number;
  windowEnd: number;
}

/**
 * Home-base clock helpers. With an IANA time zone (e.g. 'Europe/London') every conversion uses the
 * offset in force at that instant, so daylight-saving changes are handled; without one, the fixed
 * offset is used.
 */
export class HomeClock {
  private readonly formatter?: Intl.DateTimeFormat;

  constructor(private readonly offsetHours: number, timeZone?: string) {
    if (timeZone) {
      try {
        this.formatter = new Intl.DateTimeFormat('en-US', {
          timeZone,
          hourCycle: 'h23',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        });
      } catch {
        this.formatter = undefined;
      }
    }
  }

  /** UTC offset in hours at an instant. */
  offsetAt(ms: number): number {
    if (!this.formatter) return this.offsetHours;
    const parts = this.formatter.formatToParts(new Date(ms));
    const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
    const wall = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
    return Math.round((wall - Math.floor(ms / 1000) * 1000) / MIN) / 60;
  }

  private wall(ms: number): Date {
    return new Date(ms + this.offsetAt(ms) * HOUR);
  }

  /** Hour of day (0–24, fractional) at home base. */
  hour(ms: number): number {
    const d = this.wall(ms);
    return d.getUTCHours() + d.getUTCMinutes() / 60;
  }

  /** YYYY-MM-DD at home base. */
  date(ms: number): string {
    return this.wall(ms).toISOString().slice(0, 10);
  }

  /** UTC instant of a home-base wall-clock time on a home-base date. */
  at(date: string, hour: number): number {
    const naive = Date.parse(`${date}T00:00:00Z`) + hour * HOUR;
    // Guess with the offset near that time, then refine once so times near a clock change settle
    let offset = this.offsetAt(naive - this.offsetHours * HOUR);
    offset = this.offsetAt(naive - offset * HOUR);
    return naive - offset * HOUR;
  }

  addDays(date: string, days: number): string {
    return new Date(Date.parse(`${date}T00:00:00Z`) + days * 24 * HOUR).toISOString().slice(0, 10);
  }

  time(ms: number): string {
    const d = this.wall(ms);
    return `${d.getUTCHours().toString().padStart(2, '0')}:${d.getUTCMinutes().toString().padStart(2, '0')}`;
  }
}

function timeAt(ms: number, offsetHours: number): string {
  const d = new Date(ms + offsetHours * HOUR);
  return `${d.getUTCHours().toString().padStart(2, '0')}:${d.getUTCMinutes().toString().padStart(2, '0')}`;
}

/** Groups flights into duties: a new duty starts when the gap since the last release is long. */
export function groupDuties(flights: FlightLeg[], homeBase: string, standby: StandbyDuty[] = []): Duty[] {
  const sorted = [...flights].sort((a, b) => Date.parse(a.reportTimeUtc) - Date.parse(b.reportTimeUtc));
  const duties: Duty[] = [];

  for (const flight of sorted) {
    const report = Date.parse(flight.reportTimeUtc);
    const release = Date.parse(flight.releaseTimeUtc);
    const current = duties[duties.length - 1];

    if (current && report - current.endMs < DUTY_SPLIT_GAP_HOURS * HOUR) {
      current.flights.push(flight);
      current.endMs = Math.max(current.endMs, release);
      current.endAirport = flight.destination;
      current.awayAtEnd = flight.destination !== homeBase;
      current.endLocalOffset = flight.destTzOffset;
    } else {
      duties.push({
        index: duties.length,
        flights: [flight],
        startMs: report,
        endMs: release,
        startAirport: flight.origin,
        endAirport: flight.destination,
        awayAtStart: flight.origin !== homeBase,
        awayAtEnd: flight.destination !== homeBase,
        endLocalOffset: flight.destTzOffset,
      });
    }
  }
  // Airport standby is time at work: it becomes a duty, merged with any flight it overlaps (a callout)
  for (const sb of standby) {
    if (sb.kind !== 'airport') continue;
    const start = Date.parse(sb.startUtc);
    const end = Date.parse(sb.endUtc);
    const overlapping = duties.find((d) => d.startMs < end && d.endMs > start);
    if (overlapping) {
      overlapping.startMs = Math.min(overlapping.startMs, start);
      overlapping.endMs = Math.max(overlapping.endMs, end);
      continue;
    }
    const localOffset = getAirportTzOffset(sb.airport, new Date(end));
    const away = sb.airport !== homeBase && localOffset !== undefined;
    duties.push({
      index: 0,
      flights: [],
      airportStandby: sb,
      startMs: start,
      endMs: end,
      startAirport: sb.airport,
      endAirport: sb.airport,
      awayAtStart: away,
      awayAtEnd: away,
      endLocalOffset: localOffset ?? 0, // only read when `away`, i.e. when the offset is verified
    });
  }
  duties.sort((x, y) => x.startMs - y.startMs);
  duties.forEach((d, i) => (d.index = i));
  return duties;
}

export type DutyCategory = NonNullable<PrepDetails['dutyCategory']>;

/** Category from the report time in home-base time. */
export function dutyCategory(reportMs: number, clock: HomeClock): DutyCategory {
  const h = clock.hour(reportMs);
  if (h >= 3.5 && h < 8.5) return 'early_morning';
  if (h >= 8.5 && h < 15.5) return 'daytime';
  if (h >= 15.5 && h < 20) return 'evening';
  return 'redeye';
}

/** Parts of [start, end] that fall inside the home-time window [fromHour, toHour) on any day. */
function intersectDaily(start: number, end: number, fromHour: number, toHour: number, clock: HomeClock): Block[] {
  const parts: Block[] = [];
  let date = clock.addDays(clock.date(start), -1);
  const lastDate = clock.addDays(clock.date(end), 1);
  while (date <= lastDate) {
    const s = Math.max(start, clock.at(date, fromHour));
    const e = Math.min(end, clock.at(date, toHour));
    if (e > s) parts.push({ startMs: s, endMs: e });
    date = clock.addDays(date, 1);
  }
  return parts;
}

/** Removes the parts of a block covered by any of the given blocks. */
function subtract(block: Block, cut: Block[]): Block[] {
  let pieces: Block[] = [block];
  for (const c of cut) {
    const next: Block[] = [];
    for (const p of pieces) {
      if (c.endMs <= p.startMs || c.startMs >= p.endMs) {
        next.push(p);
        continue;
      }
      if (c.startMs > p.startMs) next.push({ startMs: p.startMs, endMs: c.startMs });
      if (c.endMs < p.endMs) next.push({ startMs: c.endMs, endMs: p.endMs });
    }
    pieces = next;
  }
  return pieces;
}

/** True if a flight overlaps the home-time body-clock night (02:00–06:00). */
export function flightInBodyNight(flight: FlightLeg, clock: HomeClock): boolean {
  return intersectDaily(Date.parse(flight.departureTimeUtc), Date.parse(flight.arrivalTimeUtc), 2, 6, clock).length > 0;
}

export interface PlanRange {
  dates: string[];
  startMs: number;
  endMs: number;
  /** Days the roster itself covers; other days get the usual home-time rhythm only. */
  rosterDates: Set<string>;
}

/** Days ahead of today that always get a plan, even when the roster does not cover them. */
export const USUAL_RHYTHM_DAYS_AHEAD = 7;

/** Calendar days (home time) the plan covers, plus the instant range advice is generated for. */
export function planRange(duties: Duty[], roster: RosterData, clock: HomeClock, now: Date): PlanRange {
  const today = clock.date(now.getTime());
  const lastUsualDay = clock.addDays(today, USUAL_RHYTHM_DAYS_AHEAD - 1);
  if (duties.length === 0) {
    const dates = Array.from({ length: USUAL_RHYTHM_DAYS_AHEAD }, (_, i) => clock.addDays(today, i));
    return { dates, startMs: clock.at(today, 0), endMs: clock.at(clock.addDays(today, USUAL_RHYTHM_DAYS_AHEAD), 12), rosterDates: new Set() };
  }
  const rosterFirst = clock.date(duties[0].startMs);
  let rosterLast = clock.addDays(clock.date(duties[duties.length - 1].endMs), 1);
  if (roster.totalDays && roster.totalDays > 0) {
    const fromTotal = clock.addDays(rosterFirst, roster.totalDays - 1);
    if (fromTotal > rosterLast) rosterLast = fromTotal;
  }
  const rosterDates = new Set<string>();
  for (let d = rosterFirst; d <= rosterLast; d = clock.addDays(d, 1)) rosterDates.add(d);

  // The plan also covers today and the week ahead, so the days before a roster starts and after it
  // ends still get the usual home-time rhythm (no duties, just sleep, caffeine, meals and daylight)
  const firstDate = today < rosterFirst ? today : rosterFirst;
  const lastDate = lastUsualDay > rosterLast ? lastUsualDay : rosterLast;
  const dates: string[] = [];
  for (let d = firstDate; d <= lastDate; d = clock.addDays(d, 1)) dates.push(d);
  // Start the evening before the first day so the sleep leading into it is planned too
  return {
    dates,
    startMs: clock.at(clock.addDays(firstDate, -1), 12),
    endMs: clock.at(clock.addDays(lastDate, 1), 12),
    rosterDates,
  };
}

interface Gap {
  start: number; // could be in bed
  end: number; // must wake (next duty) or end of plan
  prev?: Duty;
  next?: Duty;
}

function travelMinutes(away: boolean, preferences: CrewPreferences): number {
  return away ? HOTEL_TRANSFER_MINUTES : preferences.cabBufferMinutes || 60;
}

function wakeTimeFor(duty: Duty, preferences: CrewPreferences): number {
  return duty.startMs - (travelMinutes(duty.awayAtStart, preferences) + (preferences.groomingMinutes || 60)) * MIN;
}

function restGaps(duties: Duty[], range: PlanRange, preferences: CrewPreferences): Gap[] {
  const gaps: Gap[] = [];
  for (let i = -1; i < duties.length; i++) {
    const prev = duties[i];
    const next = duties[i + 1];
    const start = prev
      ? prev.endMs + (travelMinutes(prev.awayAtEnd, preferences) + WIND_DOWN_MINUTES) * MIN
      : range.startMs;
    const end = next ? wakeTimeFor(next, preferences) : range.endMs;
    gaps.push({ start, end, prev, next });
  }
  return gaps;
}

function clip(block: Block, start: number, end: number): Block | null {
  const s = Math.max(block.startMs, start);
  const e = Math.min(block.endMs, end);
  return e > s ? { startMs: s, endMs: e } : null;
}

/** Plans the sleeps and naps inside one rest gap. Results never leave [gap.start, gap.end]. */
function planGapSleeps(gap: Gap, preferences: CrewPreferences, clock: HomeClock): SleepBlock[] {
  const out: SleepBlock[] = [];
  if (gap.end - gap.start < 30 * MIN) return out;

  const targetMs = preferences.targetSleepHours * HOUR;
  const nextCategory = gap.next ? dutyCategory(gap.next.startMs, clock) : undefined;
  const prevCategory = gap.prev ? dutyCategory(gap.prev.startMs, clock) : undefined;
  const add = (kind: SleepBlock['kind'], startMs: number, endMs: number) => {
    const b = clip({ startMs, endMs }, gap.start, gap.end);
    if (!b) return;
    const isNap = kind === 'nap_before_night' || kind === 'nap_after_early';
    if (b.endMs - b.startMs < (isNap ? 20 : 60) * MIN) return;
    out.push({ ...b, kind, id: `${isNap ? 'nap' : 'sleep'}-${new Date(startMs).toISOString().slice(0, 16)}`, windowStart: gap.start, windowEnd: gap.end });
  };

  // After a night duty (reported in the evening or overnight): sleep as soon as possible
  let cursor = gap.start;
  const afterNightDuty = gap.prev !== undefined && prevCategory === 'redeye';
  if (afterNightDuty) {
    const startHour = clock.hour(gap.start);
    // Back in the small hours: a full sleep. Back in the morning or early afternoon: a capped
    // daytime sleep, so the following night's sleep still works.
    const len =
      startHour >= 4 && startHour < 16
        ? RECOVERY_SLEEP_MAX_HOURS * HOUR
        : startHour >= 16 && startHour < 21
        ? 0
        : targetMs;
    if (len > 0) {
      const end = Math.min(gap.start + len, gap.end);
      add('recovery', gap.start, end);
      cursor = end;
    }
  }

  // The last sleep before the next duty, anchored to the wake-up time
  let lastSleep: Block | null = null;
  if (gap.next && nextCategory === 'early_morning') {
    lastSleep = { startMs: gap.end - targetMs, endMs: gap.end };
  } else if (gap.next && nextCategory === 'redeye') {
    const napStart = gap.end - PRE_NIGHT_DUTY_NAP_MINUTES * MIN;
    if (napStart >= cursor) add('nap_before_night', napStart, gap.end);
  }

  // Regular home-time nights in between
  let date = clock.date(cursor - 12 * HOUR);
  while (true) {
    const nightStart = clock.at(date, usualBedtimeHour(preferences));
    if (nightStart >= gap.end) break;
    const night = { startMs: nightStart, endMs: nightStart + targetMs };
    const clashesWithLast = lastSleep && night.endMs > lastSleep.startMs - 2 * HOUR;
    if (!clashesWithLast && night.endMs > cursor) {
      add('night', Math.max(night.startMs, cursor), night.endMs);
    }
    date = clock.addDays(date, 1);
  }

  if (lastSleep) {
    add('before_duty', Math.max(lastSleep.startMs, cursor), lastSleep.endMs);
  }

  // Nap after an early duty, if it leaves a clear run-up to the next main sleep
  if (gap.prev && prevCategory === 'early_morning' && clock.hour(gap.start) < 16) {
    const napEnd = gap.start + POST_EARLY_DUTY_NAP_MINUTES * MIN;
    const nextMain = out.filter((b) => b.kind !== 'nap_before_night' && b.startMs >= gap.start).sort((a, b) => a.startMs - b.startMs)[0];
    if (!nextMain || nextMain.startMs - napEnd >= 3 * HOUR) add('nap_after_early', gap.start, napEnd);
  }

  // Never overlap within a gap: keep the earlier block and trim or drop later ones
  out.sort((a, b) => a.startMs - b.startMs);
  const cleaned: SleepBlock[] = [];
  for (const b of out) {
    const last = cleaned[cleaned.length - 1];
    if (last && b.startMs < last.endMs) {
      if (b.endMs <= last.endMs) continue;
      b.startMs = last.endMs;
      if (b.endMs - b.startMs < 20 * MIN) continue;
    }
    cleaned.push(b);
  }
  return cleaned;
}

export interface PlanOutput {
  events: CircadianEvent[];
  prepByDate: Map<string, PrepDetails>;
}

export interface PlanInput {
  /** The current time, for time-limited inputs such as a logged night's sleep. */
  now?: number;
  roster: RosterData;
  preferences: CrewPreferences;
  customNudges: Record<string, number>;
  duties: Duty[];
  range: PlanRange;
  clock: HomeClock;
  citations: PlanCitations;
}

const SLEEP_TEXT: Record<SleepBlock['kind'], { type: EventType; title: (h: string) => string; subtitle: string; priority: CircadianEvent['priority'] }> = {
  night: {
    type: 'anchor_sleep',
    title: (h) => `🛏️ Night sleep (about ${h}h)`,
    subtitle: 'On home time',
    priority: 'recommended',
  },
  before_duty: {
    type: 'anchor_sleep',
    title: (h) => `🛏️ Sleep before duty (about ${h}h)`,
    subtitle: 'Earlier bedtime so you can wake in time to get ready',
    priority: 'critical',
  },
  recovery: {
    type: 'recovery_sleep',
    title: (h) => `🛏️ Sleep after the duty (about ${h}h)`,
    subtitle: 'Dark, cool room (about 18–20 °C), eye mask and earplugs',
    priority: 'critical',
  },
  nap_before_night: {
    type: 'nasa_nap',
    title: () => '💤 Nap before the night duty',
    subtitle: 'Finish when it is time to get ready, so grogginess passes before you leave',
    priority: 'recommended',
  },
  nap_after_early: {
    type: 'nasa_nap',
    title: () => '💤 Nap after an early duty',
    subtitle: 'Early starts usually cut sleep short; a nap helps you catch up',
    priority: 'optional',
  },
};

export function buildPlanEvents(input: PlanInput): PlanOutput {
  const { roster, preferences, customNudges, duties, range, clock, citations } = input;
  const hbtOffset = preferences.homeBaseTzOffset;
  const events: CircadianEvent[] = [];
  const prepByDate = new Map<string, PrepDetails>();

  const dutyBlocks: Block[] = duties.map((d) => ({ startMs: d.startMs, endMs: d.endMs }));

  /** Where the crew member is at an instant, for local-time labels. */
  const localOffsetAt = (ms: number): number => {
    let away: Duty | undefined;
    for (const d of duties) if (d.endMs <= ms) away = d.awayAtEnd ? d : undefined;
    return away ? away.endLocalOffset : clock.offsetAt(ms);
  };
  const isAwayAt = (ms: number): boolean => {
    let away = false;
    for (const d of duties) if (d.endMs <= ms) away = d.awayAtEnd;
    return away;
  };

  const make = (
    id: string,
    type: EventType,
    title: string,
    subtitle: string,
    startMs: number,
    endMs: number,
    citation: ScientificCitation,
    priority: CircadianEvent['priority'],
    color: string,
    icon: string,
    dutyDate: string,
    extra: Partial<CircadianEvent> = {}
  ): CircadianEvent => {
    const local = localOffsetAt(startMs);
    return {
      id,
      dutyDate,
      type,
      title,
      subtitle,
      startUtc: new Date(startMs).toISOString(),
      endUtc: new Date(endMs).toISOString(),
      durationMinutes: Math.round((endMs - startMs) / MIN),
      startLocalStr: timeAt(startMs, local),
      endLocalStr: timeAt(endMs, local),
      startHbtStr: clock.time(startMs),
      endHbtStr: clock.time(endMs),
      scientificCitation: citation,
      priority,
      color,
      icon,
      ...extra,
    };
  };

  // 1. Sleeps and naps, gap by gap, then user nudges kept inside the same gap
  const gaps = restGaps(duties, range, preferences);
  const sleeps: SleepBlock[] = [];
  for (const gap of gaps) {
    for (const s of planGapSleeps(gap, preferences, clock)) {
      const nudge = customNudges[s.id] || 0;
      if (nudge !== 0) {
        const len = s.endMs - s.startMs;
        const start = Math.min(Math.max(s.startMs + nudge * MIN, s.windowStart), s.windowEnd - len);
        s.startMs = Math.max(start, s.windowStart);
        s.endMs = Math.min(s.startMs + len, s.windowEnd);
      }
      sleeps.push(s);
    }
  }
  sleeps.sort((a, b) => a.startMs - b.startMs);

  // After a logged short night, start the next night's sleep earlier (inside its rest gap)
  const catchUp = shortSleepCatchUpMs(preferences, input.now ?? Date.now());
  if (catchUp) {
    const index = sleeps.findIndex(
      (s) => s.kind === 'night' && s.startMs > catchUp.loggedAtMs && s.startMs < catchUp.loggedAtMs + SLEEP_LOG_VALID_HOURS * HOUR
    );
    if (index >= 0) {
      const s = sleeps[index];
      const previousEnd = index > 0 ? sleeps[index - 1].endMs : -Infinity;
      s.startMs = Math.max(s.startMs - catchUp.amountMs, s.windowStart, previousEnd);
      s.catchUp = true;
    }
  }

  // Nudges can push neighbouring sleeps in the same gap together; trim rather than overlap
  for (let i = 1; i < sleeps.length; i++) {
    if (sleeps[i].startMs < sleeps[i - 1].endMs) sleeps[i].startMs = sleeps[i - 1].endMs;
  }
  const validSleeps = sleeps.filter((s) => s.endMs - s.startMs >= 20 * MIN);

  for (const s of validSleeps) {
    const text = SLEEP_TEXT[s.kind];
    const hours = ((s.endMs - s.startMs) / HOUR).toFixed(1);
    const citation =
      s.kind === 'recovery'
        ? citations.recovery_sleep
        : s.kind === 'nap_before_night'
        ? citations.pre_duty_90_nap
        : s.kind === 'nap_after_early'
        ? citations.nasa_nap_26
        : citations.anchor_sleep;
    const subtitle = s.catchUp ? 'A little earlier tonight, because you logged a short sleep last night' : text.subtitle;
    events.push(
      make(s.id, text.type, text.title(hours), subtitle, s.startMs, s.endMs, citation, text.priority, '#8b5cf6', 'moon', clock.date(s.endMs), {
        userAdjustable: true,
      })
    );
  }

  const mainSleeps = validSleeps.filter((s) => s.kind === 'night' || s.kind === 'before_duty' || s.kind === 'recovery');

  // 2. Caffeine: stop a set time before each main sleep (never before the previous sleep ended)
  const cutoffHours = preferences.caffeineCutoffHours || 6;
  const cutoffStartBySleep = new Map<string, number>();
  mainSleeps.forEach((s, i) => {
    const prevEnd = i > 0 ? mainSleeps[i - 1].endMs : -Infinity;
    const start = Math.max(s.startMs - cutoffHours * HOUR, prevEnd);
    cutoffStartBySleep.set(s.id, start);
    if (s.startMs - start < 30 * MIN) return;
    events.push(
      make(
        `caffeine-cutoff-${s.id}`,
        'caffeine_cutoff',
        `🚫 No more caffeine (${cutoffHours}h before sleep)`,
        `Stop coffee, tea and energy drinks by ${clock.time(start)} to protect your sleep at ${clock.time(s.startMs)}`,
        start,
        s.startMs,
        citations.caffeine_cutoff,
        'recommended',
        '#b91c1c',
        'x-circle',
        clock.date(start)
      )
    );
  });

  // 3. Each duty: getting ready, caffeine early in the duty, sunglasses on the way to sleep
  for (const duty of duties) {
    const date = clock.date(duty.startMs);
    const category = dutyCategory(duty.startMs, clock);
    const grooming = preferences.groomingMinutes || 60;
    const travel = travelMinutes(duty.awayAtStart, preferences);
    const wakeMs = wakeTimeFor(duty, preferences);
    const pickupMs = duty.startMs - travel * MIN;
    const firstFlight = duty.flights[0] as FlightLeg | undefined;
    const lastFlight = duty.flights[duty.flights.length - 1] as FlightLeg | undefined;
    const dutyKey = firstFlight?.id ?? `standby-${new Date(duty.startMs).toISOString().slice(0, 16)}`;
    const standbyNote = duty.airportStandby && !firstFlight ? ' (airport standby)' : '';

    const sleepBefore = [...mainSleeps].reverse().find((s) => s.endMs <= wakeMs + MIN);
    const napBefore = validSleeps.find((s) => s.kind === 'nap_before_night' && Math.abs(s.endMs - wakeMs) < MIN);
    const bedtimeMs = napBefore?.startMs ?? sleepBefore?.startMs;
    const cutoffMs = sleepBefore ? cutoffStartBySleep.get(sleepBefore.id) : undefined;

    const pickupWord = duty.awayAtStart ? 'Hotel pickup' : 'Leave home';
    const explanation =
      category === 'early_morning'
        ? `Early report: aim to be in bed by ${bedtimeMs ? clock.time(bedtimeMs) : 'early evening'} so you can wake at ${clock.time(wakeMs)}. Falling asleep early is hard, so wind down with dim light.`
        : category === 'redeye'
        ? `Night duty: nap before you get ready, have caffeine early in the duty, and sleep soon after you are released.`
        : `Sleep normally the night before, then start getting ready at ${clock.time(wakeMs)}.`;

    const prep: PrepDetails = {
      wakeUpHbt: clock.time(wakeMs),
      cabPickupHbt: clock.time(pickupMs),
      reportHbt: clock.time(duty.startMs),
      departureHbt: firstFlight ? clock.time(Date.parse(firstFlight.departureTimeUtc)) : clock.time(duty.startMs),
      groomingMinutes: grooming,
      cabBufferMinutes: travel,
      targetBedtimeHbt: bedtimeMs !== undefined ? clock.time(bedtimeMs) : undefined,
      targetBedtimeDateStr: bedtimeMs !== undefined ? clock.date(bedtimeMs) : undefined,
      caffeineCutoffHbt: cutoffMs !== undefined && Number.isFinite(cutoffMs) ? clock.time(cutoffMs) : undefined,
      wakeUpUtc: new Date(wakeMs).toISOString(),
      cabPickupUtc: new Date(pickupMs).toISOString(),
      targetBedtimeUtc: bedtimeMs !== undefined ? new Date(bedtimeMs).toISOString() : undefined,
      dutyCategory: category,
      step1Label: category === 'redeye' ? 'Step 1: Wake from your nap & get ready' : 'Step 1: Wake-up alarm',
      step1Description: duty.awayAtStart ? 'Get ready at the hotel: uniform, documents and bag' : 'Shower, uniform, documents and flight bag',
      bedtimeExplanation: explanation,
      debriefMinutes: lastFlight ? Math.round((Date.parse(lastFlight.releaseTimeUtc) - Date.parse(lastFlight.arrivalTimeUtc)) / MIN) : 0,
      debriefStartHbt: clock.time(lastFlight ? Date.parse(lastFlight.arrivalTimeUtc) : duty.endMs),
      debriefEndHbt: clock.time(duty.endMs),
      isAwayFromBase: duty.awayAtStart,
      pickupLabel: pickupWord,
    };
    if (!prepByDate.has(date)) prepByDate.set(date, prep);

    events.push(
      make(
        `prep-routine-${dutyKey}`,
        'pre_flight_prep',
        `⏰ ${clock.time(wakeMs)} wake-up ➔ ${pickupWord} ${clock.time(pickupMs)}${standbyNote}`,
        `${grooming} min to get ready, ${travel} min to travel, report at ${clock.time(duty.startMs)} (${duty.startAirport})`,
        wakeMs,
        duty.startMs,
        citations.prep,
        'critical',
        '#0284c7',
        'clock',
        date,
        { prepDetails: prep }
      )
    );

    // Caffeine early in the duty, ending before the cutoff for the next sleep
    const nextMain = mainSleeps.find((s) => s.startMs >= duty.endMs);
    const nextCutoff = nextMain ? cutoffStartBySleep.get(nextMain.id) ?? Infinity : Infinity;
    const cafEnd = Math.min(duty.startMs + 3 * HOUR, duty.endMs, nextCutoff);
    if (cafEnd - duty.startMs >= 30 * MIN) {
      events.push(
        make(
          `caffeine-ok-${dutyKey}`,
          'caffeine_allowed',
          '☕ Good time for caffeine',
          'Have coffee or tea early in the duty rather than near its end',
          duty.startMs,
          cafEnd,
          citations.caffeine_cutoff,
          'optional',
          '#a16207',
          'coffee',
          date
        )
      );
    }

    // Sunglasses on the way to bed after a duty ending in the morning, if it is likely daylight there
    const releaseLocalHour = (((duty.endMs + duty.endLocalOffset * HOUR) / HOUR) % 24 + 24) % 24;
    const firstSleepAfter = validSleeps.find((s) => s.startMs >= duty.endMs);
    if (firstSleepAfter && firstSleepAfter.kind === 'recovery' && releaseLocalHour >= 5 && releaseLocalHour < 19) {
      events.push(
        make(
          `sunglasses-${dutyKey}`,
          'melatonin_shield',
          '🕶️ Wear dark sunglasses on the way to bed',
          'Bright daylight now makes it harder to sleep when you get in',
          duty.endMs,
          firstSleepAfter.startMs,
          citations.melatonin_shield,
          'recommended',
          '#475569',
          'glasses',
          clock.date(duty.endMs)
        )
      );
    }
  }

  // 4. Meals: in each waking stretch between main sleeps; keep food light in the body-clock night
  const awakeStretches: Block[] = [];
  for (let i = 0; i < mainSleeps.length - 1; i++) {
    awakeStretches.push({ startMs: mainSleeps[i].endMs, endMs: mainSleeps[i + 1].startMs });
  }
  for (const awake of awakeStretches) {
    if (awake.endMs - awake.startMs < 4 * HOUR) continue;
    const window = { startMs: awake.startMs + 30 * MIN, endMs: awake.endMs - 2 * HOUR };
    if (window.endMs <= window.startMs) continue;
    // Naps inside the stretch are cut out so meal guidance never sits on top of a sleep
    const napsInside = validSleeps.filter((n) => n.startMs < window.endMs && n.endMs > window.startMs);
    const night = intersectDaily(window.startMs, window.endMs, 0, 6, clock).flatMap((p) => subtract(p, napsInside));
    for (const part of subtract(window, [...night, ...napsInside])) {
      const end = Math.min(part.endMs, part.startMs + 12 * HOUR);
      if (end - part.startMs < HOUR) continue;
      events.push(
        make(
          `meals-${new Date(part.startMs).toISOString().slice(0, 16)}`,
          'eating_window',
          '🥗 Meal window',
          'A gentle guide for your main meals, not a strict rule',
          part.startMs,
          end,
          citations.chrono_nutrition_window,
          'optional',
          '#10b981',
          'utensils',
          clock.date(part.startMs)
        )
      );
    }
    for (const part of night) {
      if (part.endMs - part.startMs < 30 * MIN) continue;
      events.push(
        make(
          `light-food-${new Date(part.startMs).toISOString().slice(0, 16)}`,
          'fasting_window',
          '🍵 Keep food light overnight',
          'Have your main meal before; a small snack if you get hungry. Keep drinking water.',
          part.startMs,
          part.endMs,
          citations.gut_rest_night,
          'recommended',
          '#0d9488',
          'utensils',
          clock.date(part.startMs)
        )
      );
    }
  }

  // 5. Morning daylight at home on days that start with a normal night's sleep
  for (const s of mainSleeps) {
    if (s.kind === 'recovery') continue;
    const endHour = clock.hour(s.endMs);
    if (endHour < 5 || endHour >= 11 || isAwayAt(s.endMs)) continue;
    const lightStart = s.endMs + 30 * MIN;
    const lightEnd = lightStart + 30 * MIN;
    if (dutyBlocks.some((d) => d.startMs < lightEnd && d.endMs > lightStart)) continue;
    if (duties.some((d) => wakeTimeFor(d, preferences) < lightEnd && d.startMs > lightStart)) continue;
    events.push(
      make(
        `daylight-${s.id}`,
        'light_exposure',
        '☀️ Morning daylight',
        'Some time in daylight this morning helps keep your body clock steady',
        lightStart,
        lightEnd,
        citations.daylight,
        'optional',
        '#f59e0b',
        'sun',
        clock.date(lightStart)
      )
    );
  }

  // 6. Optional nap during in-flight crew rest: in the chosen half of the flight, ending well before landing
  for (const duty of duties) {
    for (const flight of duty.flights) {
      const shift = preferences.bunkShiftAssignments?.[flight.id];
      const eligible = shift ? flight.durationMinutes >= BUNK_CHOICE_SECTOR_MINUTES : flight.durationMinutes >= CREW_REST_SECTOR_MINUTES;
      if (!eligible) continue;
      const dep = Date.parse(flight.departureTimeUtc);
      const arr = Date.parse(flight.arrivalTimeUtc);
      const fraction = shift === 'shift1' ? 1 / 3 : shift === 'shift2' ? 2 / 3 : 1 / 2;
      const latestEnd = arr - CREW_REST_LANDING_BUFFER_MINUTES * MIN;
      const napEnd = Math.min(dep + (arr - dep) * fraction + 10 * MIN, latestEnd);
      const napStart = napEnd - 20 * MIN;
      if (napStart <= dep) continue;
      const which = shift === 'shift1' ? ' (first rest period)' : shift === 'shift2' ? ' (second rest period)' : '';
      events.push(
        make(
          `crew-rest-${flight.id}`,
          'nasa_nap',
          `⚡ Short nap in crew rest${which}`,
          'Aim for 10–20 minutes and allow time to wake up properly before duties',
          napStart,
          napEnd,
          citations.nasa_nap_26,
          'optional',
          '#6366f1',
          'moon',
          clock.date(duty.startMs)
        )
      );
    }
  }

  // 7. Standby periods from the roster
  for (const sb of roster.standbyDuties ?? []) {
    const start = Date.parse(sb.startUtc);
    const end = Date.parse(sb.endUtc);
    const atAirport = sb.kind === 'airport';
    events.push(
      make(
        `standby-${sb.id}`,
        'standby',
        atAirport ? `🧳 Airport standby (${sb.airport})` : `📱 Home standby (${sb.airport})`,
        atAirport
          ? 'You are on duty at the airport and may be called to fly. Your sleep is planned around it.'
          : 'Keep your phone on and your bag ready. Sleep as planned; a callout will change the plan.',
        start,
        end,
        citations.prep,
        atAirport ? 'critical' : 'recommended',
        '#a855f7',
        'phone',
        clock.date(start)
      )
    );
  }

  events.sort((a, b) => Date.parse(a.startUtc) - Date.parse(b.startUtc));
  return { events, prepByDate };
}
