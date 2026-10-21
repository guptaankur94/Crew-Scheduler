import { CircadianEvent, CircadianPlan } from '../types/circadian';
import { kv } from './kv';
import { isNativeApp } from './platform';

/*
 * KEEP MY PHONE CALENDAR UPDATED
 *
 * Opt-in. The app writes duties, getting ready, standby and planned sleep for the next CALENDAR_DAYS into its
 * own "CrewCircadian" calendar on the phone, and rewrites them whenever the plan changes. Only events this app
 * created are ever touched. Turning it off deletes that calendar. Nothing leaves the device (the phone's own
 * calendar account may sync it, as with any calendar). The browser keeps the one-time calendar file
 * (icsExport.ts).
 */

export const CALENDAR_DAYS = 30;
const CALENDAR_TITLE = 'CrewCircadian';
const CALENDAR_COLOR = '#3B82F6';
const STATE_KEY = 'crew_calendar_sync_v1';
const DAY = 24 * 3600000;

interface SyncState {
  calendarId: string;
  eventIds: string[];
  signature: string;
}

export interface CalendarEntry {
  key: string;
  title: string;
  startMs: number;
  endMs: number;
  notes: string;
}

const SYNCED_TYPES = new Set(['flight', 'pre_flight_prep', 'standby', 'anchor_sleep', 'recovery_sleep', 'nasa_nap']);

/** What goes into the phone calendar: duties, getting ready, standby and planned sleep, from yesterday to CALENDAR_DAYS ahead. */
export function calendarEntries(plan: CircadianPlan, nowMs: number): CalendarEntry[] {
  const from = nowMs - DAY;
  const to = nowMs + CALENDAR_DAYS * DAY;
  return plan.events
    .filter((e: CircadianEvent) => SYNCED_TYPES.has(e.type) && !e.id.startsWith('crew-rest-'))
    .map((e) => ({
      key: e.id,
      title: e.title,
      startMs: Date.parse(e.startUtc),
      endMs: Date.parse(e.endUtc),
      notes: `${e.subtitle}\n\nFrom CrewCircadian (home time ${e.startHbtStr}–${e.endHbtStr}).`,
    }))
    .filter((e) => e.endMs > from && e.startMs < to && e.endMs > e.startMs)
    .sort((a, b) => a.startMs - b.startMs);
}

/** A short fingerprint of the entries, so an unchanged plan does not rewrite the calendar. */
export function entriesSignature(entries: CalendarEntry[]): string {
  let h = 0;
  const text = entries.map((e) => `${e.key}|${e.title}|${e.startMs}|${e.endMs}|${e.notes}`).join('\n');
  for (let i = 0; i < text.length; i++) h = (Math.imul(31, h) + text.charCodeAt(i)) | 0;
  return `${entries.length}:${h >>> 0}`;
}

function loadState(): SyncState | null {
  try {
    const raw = kv.getItem(STATE_KEY);
    return raw ? (JSON.parse(raw) as SyncState) : null;
  } catch {
    return null;
  }
}

const saveState = (state: SyncState | null) => (state ? kv.setItem(STATE_KEY, JSON.stringify(state)) : kv.removeItem(STATE_KEY));

/** Asks for calendar access (when the person switches the option on). Returns false if refused or not in the phone app. */
export async function requestCalendarAccess(): Promise<boolean> {
  if (!isNativeApp()) return false;
  const { CapacitorCalendar } = await import('@ebarooni/capacitor-calendar');
  const { result } = await CapacitorCalendar.requestFullCalendarAccess();
  return result === 'granted';
}

async function hasAccess(): Promise<boolean> {
  const { CapacitorCalendar, CalendarPermissionScope } = await import('@ebarooni/capacitor-calendar');
  const [read, write] = await Promise.all([
    CapacitorCalendar.checkPermission({ scope: CalendarPermissionScope.READ_CALENDAR }),
    CapacitorCalendar.checkPermission({ scope: CalendarPermissionScope.WRITE_CALENDAR }),
  ]);
  return read.result === 'granted' && write.result === 'granted';
}

let running: Promise<void> | null = null;

/** Brings the phone calendar in line with the plan (or removes it when switched off). Browser: does nothing. */
export function syncCalendar(plan: CircadianPlan, enabled: boolean, nowMs: number = Date.now()): Promise<void> {
  if (!isNativeApp()) return Promise.resolve();
  // One sync at a time; a newer plan simply runs after the current one
  const next = (running ?? Promise.resolve()).then(() => runSync(plan, enabled, nowMs)).catch((err) => console.warn('Calendar sync skipped', err));
  running = next;
  return next;
}

async function runSync(plan: CircadianPlan, enabled: boolean, nowMs: number): Promise<void> {
  const { CapacitorCalendar } = await import('@ebarooni/capacitor-calendar');
  const state = loadState();

  if (!enabled) {
    if (state && (await hasAccess())) await CapacitorCalendar.deleteCalendar({ id: state.calendarId }).catch(() => {});
    if (state) saveState(null);
    return;
  }
  if (!(await hasAccess())) return;

  const entries = calendarEntries(plan, nowMs);
  const signature = entriesSignature(entries);

  // Our calendar may have been deleted in the Calendar app: make a new one if so
  const { result: calendars } = await CapacitorCalendar.listCalendars();
  let calendarId = state && calendars.some((c) => c.id === state.calendarId) ? state.calendarId : null;
  if (calendarId && state?.signature === signature) return;
  if (!calendarId) {
    // Android needs an account for a calendar kept on the phone only; iPhone ignores these two
    calendarId = (await CapacitorCalendar.createCalendar({ title: CALENDAR_TITLE, color: CALENDAR_COLOR, accountName: CALENDAR_TITLE, ownerAccount: CALENDAR_TITLE })).id;
  } else if (state?.eventIds.length) {
    await CapacitorCalendar.deleteEventsById({ ids: state.eventIds, commit: false }).catch(() => {});
  }

  const eventIds: string[] = [];
  for (const e of entries) {
    const { id } = await CapacitorCalendar.createEvent({
      calendarId,
      title: e.title,
      startDate: e.startMs,
      endDate: e.endMs,
      description: e.notes,
      commit: false,
    });
    if (id) eventIds.push(id);
  }
  await CapacitorCalendar.commit().catch(() => {}); // iOS saves the batch; Android has nothing to commit
  saveState({ calendarId, eventIds, signature });
}
