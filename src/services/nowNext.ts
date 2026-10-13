import { CircadianEvent, CircadianPlan, EventType } from '../types/circadian';

/**
 * Picks what the Today screen shows: the one thing that matters now, the next thing to do, and the
 * next duty. Everything else stays one tap away.
 */

/** When several things overlap, the one the crew member most needs to act on wins. */
const NOW_PRIORITY: Partial<Record<EventType, number>> = {
  anchor_sleep: 1,
  recovery_sleep: 1,
  nasa_nap: 1,
  flight: 2,
  duty_ground: 3,
  standby: 3,
  pre_flight_prep: 4,
  melatonin_shield: 5,
  fasting_window: 6,
  light_exposure: 7,
  caffeine_allowed: 8,
  caffeine_cutoff: 9,
  eating_window: 10,
};

/** Things worth announcing as "next". Meal windows and duty sub-steps are left to the day view. */
const NEXT_TYPES: EventType[] = [
  'anchor_sleep',
  'recovery_sleep',
  'nasa_nap',
  'pre_flight_prep',
  'standby',
  'melatonin_shield',
  'light_exposure',
  'caffeine_cutoff',
  'fasting_window',
];

export interface NextDuty {
  prep?: CircadianEvent;
  flights: CircadianEvent[];
}

export interface NowNext {
  now?: CircadianEvent;
  next?: CircadianEvent;
  nextDuty?: NextDuty;
}

const startOf = (e: CircadianEvent) => Date.parse(e.startUtc);
const endOf = (e: CircadianEvent) => Date.parse(e.endUtc);

export function getNowNext(plan: CircadianPlan, nowMs: number): NowNext {
  const events = plan.events;

  const active = events
    .filter((e) => NOW_PRIORITY[e.type] !== undefined && startOf(e) <= nowMs && endOf(e) > nowMs)
    .sort((a, b) => NOW_PRIORITY[a.type]! - NOW_PRIORITY[b.type]! || startOf(a) - startOf(b));
  const now = active[0];

  // While asleep or on duty, "next" is what follows the current block
  const after = now && NOW_PRIORITY[now.type]! <= 4 ? endOf(now) : nowMs;
  const next = events
    .filter((e) => NEXT_TYPES.includes(e.type) && startOf(e) >= after && e.id !== now?.id)
    .sort((a, b) => startOf(a) - startOf(b))[0];

  const upcomingPrep = events
    .filter((e) => e.type === 'pre_flight_prep' && endOf(e) > nowMs)
    .sort((a, b) => startOf(a) - startOf(b))[0];
  let nextDuty: NextDuty | undefined;
  if (upcomingPrep) {
    const flights = events
      .filter((e) => e.type === 'flight' && e.dutyDate === upcomingPrep.dutyDate && startOf(e) >= startOf(upcomingPrep))
      .sort((a, b) => startOf(a) - startOf(b));
    nextDuty = { prep: upcomingPrep, flights };
  } else {
    const flight = events.filter((e) => e.type === 'flight' && endOf(e) > nowMs).sort((a, b) => startOf(a) - startOf(b))[0];
    if (flight) nextDuty = { flights: [flight] };
  }

  return { now, next, nextDuty };
}

/** Event title without its leading emoji, for calm display. */
export function plainTitle(e: CircadianEvent): string {
  return e.title.replace(/^[^\p{L}\p{N}]+/u, '').trim();
}

/** A short instruction for an event shown as "Next". */
export function nextLine(e: CircadianEvent): string {
  if (e.type === 'caffeine_cutoff') return `Last caffeine by ${e.startHbtStr}`;
  return plainTitle(e);
}

/** A short instruction for an event shown as "Now". */
export function nowLine(e: CircadianEvent): string {
  if (e.type === 'caffeine_cutoff') return 'No more caffeine before your sleep';
  if (e.type === 'eating_window') return 'A good time for your main meals';
  if (e.type === 'caffeine_allowed') return 'A good time for coffee or tea, if you want it';
  return plainTitle(e);
}

/** True when the local time at the event's location differs from home time. */
export function hasLocalTime(e: CircadianEvent): boolean {
  return e.startLocalStr !== e.startHbtStr;
}
