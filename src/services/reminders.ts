import { CircadianPlan } from '../types/circadian';

/*
 * REMINDERS AND ALARMS
 *
 * What the phone should ring or show, worked out from the plan. Opt-in, few, and tied to roster moments:
 *   wake      the wake-up alarm before each duty (an alarm: it rings even in Silent mode where the phone allows)
 *   leave     ten minutes before leaving home or the hotel
 *   bedtime   thirty minutes before a planned sleep, to wind down
 *   caffeine  when the caffeine cut-off before a sleep starts
 * Never during a planned sleep or nap (only the wake alarm may end one). Rolling: only the next
 * REMINDER_WINDOW_DAYS and at most MAX_SCHEDULED (iPhones keep up to 64 per app), re-planned whenever the plan changes.
 */

export type ReminderKind = 'wake' | 'leave' | 'bedtime' | 'caffeine';

export interface Reminder {
  id: string;
  kind: ReminderKind;
  atUtc: string;
  title: string;
  body: string;
  /** Alarms ring through Silent mode where the phone allows; reminders are ordinary notifications. */
  alarm: boolean;
}

export type ReminderSettings = Partial<Record<ReminderKind, boolean>>;

export const MAX_SCHEDULED = 60;
export const REMINDER_WINDOW_DAYS = 7;
const MIN = 60000;
export const ALARM_NOTE = 'Set a second alarm too: this should not be your only one before a check-in.';

const SLEEP_TYPES = new Set(['anchor_sleep', 'recovery_sleep', 'nasa_nap']);

export function planReminders(plan: CircadianPlan, settings: ReminderSettings, nowMs: number): Reminder[] {
  const out: Reminder[] = [];
  const until = nowMs + REMINDER_WINDOW_DAYS * 24 * 60 * MIN;
  const sleeps = plan.events.filter((e) => SLEEP_TYPES.has(e.type));
  const inSleep = (ms: number) => sleeps.some((s) => ms > Date.parse(s.startUtc) && ms < Date.parse(s.endUtc));
  const add = (r: Reminder) => {
    const at = Date.parse(r.atUtc);
    if (at <= nowMs || at > until) return;
    if (r.kind !== 'wake' && inSleep(at)) return;
    out.push(r);
  };

  for (const e of plan.events) {
    const d = e.prepDetails;
    if (e.type === 'pre_flight_prep' && d?.wakeUpUtc) {
      if (settings.wake) {
        add({ id: `wake-${e.id}`, kind: 'wake', atUtc: d.wakeUpUtc, alarm: true, title: `Wake up: check-in ${d.reportHbt}`, body: `Leave at ${d.cabPickupHbt}. ${ALARM_NOTE}` });
      }
      if (settings.leave && d.cabPickupUtc) {
        add({
          id: `leave-${e.id}`,
          kind: 'leave',
          atUtc: new Date(Date.parse(d.cabPickupUtc) - 10 * MIN).toISOString(),
          alarm: false,
          title: `${d.pickupLabel || 'Leave home'} in 10 minutes`,
          body: `Check-in ${d.reportHbt}.`,
        });
      }
    }
    if (settings.bedtime && (e.type === 'anchor_sleep' || e.type === 'recovery_sleep')) {
      add({ id: `bed-${e.id}`, kind: 'bedtime', atUtc: new Date(Date.parse(e.startUtc) - 30 * MIN).toISOString(), alarm: false, title: `Wind down: sleep at ${e.startHbtStr}`, body: `Dim the lights; wake-up ${e.endHbtStr}.` });
    }
    if (settings.caffeine && e.type === 'caffeine_cutoff') {
      add({ id: `caf-${e.id}`, kind: 'caffeine', atUtc: e.startUtc, alarm: false, title: 'Last caffeine for now', body: `No more coffee, tea or chai before your sleep at ${e.endHbtStr}.` });
    }
  }
  return out.sort((a, b) => a.atUtc.localeCompare(b.atUtc)).slice(0, MAX_SCHEDULED);
}
