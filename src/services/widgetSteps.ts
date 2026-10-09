import { registerPlugin } from '@capacitor/core';
import { CircadianPlan } from '../types/circadian';
import { rosterClock } from './rosterKeys';
import { isNativeApp } from './platform';

/*
 * The next steps for the Android home-screen widget: wake-up, leave home, check-in, sleep and naps, in home time.
 * The widget shows the first whose time has not passed, so it stays right while the app is closed.
 */

export interface WidgetStep {
  atMs: number;
  time: string; // HH:MM home time
  label: string;
  detail: string;
}

const MAX_STEPS = 24;

export function widgetSteps(plan: CircadianPlan, nowMs: number): WidgetStep[] {
  const clock = rosterClock(plan.roster);
  const steps: WidgetStep[] = [];
  const add = (atMs: number, label: string, detail: string) => atMs > nowMs && steps.push({ atMs, time: clock.time(atMs), label, detail });
  for (const e of plan.events) {
    const d = e.prepDetails;
    if (e.type === 'pre_flight_prep' && d?.wakeUpUtc) {
      add(Date.parse(d.wakeUpUtc), 'Wake up', `Check-in ${d.reportHbt} · leave ${d.cabPickupHbt}`);
      if (d.cabPickupUtc) add(Date.parse(d.cabPickupUtc), d.pickupLabel || 'Leave home', `Check-in ${d.reportHbt}`);
      add(Date.parse(e.endUtc), 'Check-in', d.departureHbt ? `Departs ${d.departureHbt}` : '');
    }
    if (e.type === 'anchor_sleep' || e.type === 'recovery_sleep') add(Date.parse(e.startUtc), 'Sleep', `Until ${e.endHbtStr} · dark, cool room`);
    if (e.type === 'nasa_nap') add(Date.parse(e.startUtc), 'Nap', `${e.startHbtStr}–${e.endHbtStr}`);
    if (e.type === 'standby') add(Date.parse(e.startUtc), e.title.replace(/^[^\p{L}]+/u, ''), `Until ${e.endHbtStr}`);
  }
  return steps.sort((a, b) => a.atMs - b.atMs).slice(0, MAX_STEPS);
}

const widget = registerPlugin<{ setSteps(o: { steps: WidgetStep[] }): Promise<void> }>('NextStepWidget');

/** Gives the widget the plan's next steps (Android app only; does nothing elsewhere). */
export async function updateWidget(plan: CircadianPlan, nowMs: number): Promise<void> {
  if (!isNativeApp()) return;
  try {
    await widget.setSteps({ steps: widgetSteps(plan, nowMs) });
  } catch {
    // No widget support on this phone (iPhone, for now)
  }
}
