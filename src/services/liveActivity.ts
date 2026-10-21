import { registerPlugin } from '@capacitor/core';
import { CircadianPlan } from '../types/circadian';
import { rosterClock } from './rosterKeys';
import { isNativeApp } from './platform';
import type { WidgetStep } from './widgetSteps';

/*
 * The duty-day Live Activity (iPhone lock screen and Dynamic Island): from SHOW_BEFORE_WAKE_HOURS before the
 * wake-up until sign-off, the duty's steps (wake up, leave home, check-in, departs, sign-off) with a countdown to
 * the next one. Updated whenever the app is opened or the plan changes; ended outside a duty.
 */

export const SHOW_BEFORE_WAKE_HOURS = 3;
const HOUR = 3600000;
const MIN = 60000;

export interface DutyActivity {
  title: string;
  steps: WidgetStep[];
  headline: string;
  targetMs: number;
  endMs: number;
}

/** The duty to show now (or null): the one whose window [wake-up − 3 h, sign-off] contains now. */
export function currentDutyActivity(plan: CircadianPlan, nowMs: number): DutyActivity | null {
  const clock = rosterClock(plan.roster);
  for (const prep of plan.events.filter((e) => e.type === 'pre_flight_prep' && e.prepDetails?.wakeUpUtc)) {
    const d = prep.prepDetails!;
    const wakeMs = Date.parse(d.wakeUpUtc!);
    const flights = plan.events.filter((e) => e.type === 'flight' && e.dutyDate === prep.dutyDate).sort((a, b) => a.startUtc.localeCompare(b.startUtc));
    const lastLeg = flights.length ? plan.roster.flights.find((f) => `flight-${f.id}` === flights[flights.length - 1].id || f.id === flights[flights.length - 1].id) : undefined;
    const signOffMs = lastLeg ? Date.parse(lastLeg.releaseTimeUtc) : flights.length ? Date.parse(flights[flights.length - 1].endUtc) + 30 * MIN : Date.parse(prep.endUtc) + 8 * HOUR;
    if (nowMs < wakeMs - SHOW_BEFORE_WAKE_HOURS * HOUR || nowMs > signOffMs) continue;

    const step = (atMs: number, label: string, detail = ''): WidgetStep => ({ atMs, time: clock.time(atMs), label, detail });
    const steps: WidgetStep[] = [step(wakeMs, 'Wake up')];
    if (d.cabPickupUtc) steps.push(step(Date.parse(d.cabPickupUtc), d.pickupLabel || 'Leave home'));
    steps.push(step(Date.parse(prep.endUtc), 'Check-in'));
    if (flights[0]) steps.push(step(Date.parse(flights[0].startUtc), 'Departs'));
    steps.push(step(signOffMs, 'Sign-off'));

    const next = steps.find((s) => s.atMs > nowMs) ?? steps[steps.length - 1];
    const route = flights.length ? `${flights[0].title.split(':')[0]}${flights.length > 1 ? ` + ${flights.length - 1}` : ''}` : 'Airport standby';
    return { title: `${route} · ${clock.date(wakeMs)}`, steps, headline: next.label, targetMs: next.atMs, endMs: signOffMs };
  }
  return null;
}

const plugin = registerPlugin<{
  showDuty(o: { title: string; steps: WidgetStep[]; headline: string; targetMs: number; endMs: number }): Promise<{ shown: boolean }>;
  endDuty(): Promise<void>;
}>('NextStepWidget');

/** Shows, updates or ends the duty's Live Activity (iPhone app only). */
export async function syncLiveActivity(plan: CircadianPlan, nowMs: number): Promise<void> {
  const cap = (globalThis as { Capacitor?: { getPlatform?: () => string } }).Capacitor;
  if (!isNativeApp() || cap?.getPlatform?.() !== 'ios') return;
  try {
    const duty = currentDutyActivity(plan, nowMs);
    if (duty) await plugin.showDuty(duty);
    else await plugin.endDuty();
  } catch {
    // Live Activities switched off, or an older iPhone
  }
}
