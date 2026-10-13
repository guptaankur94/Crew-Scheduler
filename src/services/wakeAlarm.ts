import { registerPlugin } from '@capacitor/core';
import { isNativeApp } from './platform';

/*
 * The app's own native alarm (Android: AlarmManager alarm clock that rings on the alarm volume and repeats until
 * dismissed; iPhone: AlarmKit on iOS 26 and later). Where it is not available, the wake-up stays an ordinary
 * notification (see nativeReminders.ts).
 */

export interface WakeAlarm {
  id: number;
  atMs: number;
  title: string;
  body: string;
}

interface WakeAlarmPlugin {
  status(): Promise<{ available: boolean; allowed: boolean }>;
  requestPermission(): Promise<{ available: boolean; allowed: boolean }>;
  schedule(options: { alarms: WakeAlarm[] }): Promise<void>;
  cancelAll(): Promise<void>;
}

const plugin = registerPlugin<WakeAlarmPlugin>('WakeAlarm');

/** Whether true alarms can ring on this phone, and whether the person has allowed them. */
export async function wakeAlarmStatus(): Promise<{ available: boolean; allowed: boolean }> {
  if (!isNativeApp()) return { available: false, allowed: false };
  try {
    return await plugin.status();
  } catch {
    return { available: false, allowed: false }; // e.g. an older iPhone without AlarmKit
  }
}

export async function requestWakeAlarmPermission(): Promise<boolean> {
  if (!isNativeApp()) return false;
  try {
    return (await plugin.requestPermission()).allowed;
  } catch {
    return false;
  }
}

/** Replaces all scheduled wake-up alarms. Returns false if they could not be set (the caller falls back). */
export async function setWakeAlarms(alarms: WakeAlarm[]): Promise<boolean> {
  const { available, allowed } = await wakeAlarmStatus();
  if (!available || !allowed) return false;
  try {
    if (alarms.length) await plugin.schedule({ alarms });
    else await plugin.cancelAll();
    return true;
  } catch {
    return false;
  }
}
