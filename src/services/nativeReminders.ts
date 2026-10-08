import { isNativeApp } from './platform';
import { Reminder } from './reminders';
import { setWakeAlarms } from './wakeAlarm';

/*
 * Puts planned reminders on the phone (local notifications; nothing leaves the device). Each sync replaces
 * what this app scheduled before, so the phone always matches the current plan. Browser: does nothing.
 * Wake-ups use the app's true alarm where the phone has one (wakeAlarm.ts); everything else, and wake-ups on
 * phones without it, are notifications with sound.
 */

/** Stable numeric ID for a reminder (the phone needs numbers). */
export function reminderNumber(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (Math.imul(31, h) + id.charCodeAt(i)) | 0;
  return Math.abs(h) % 2_000_000_000;
}

/** Asks for permission to show reminders. Returns false if refused or not in the phone app. */
export async function requestReminderPermission(): Promise<boolean> {
  if (!isNativeApp()) return false;
  const { LocalNotifications } = await import('@capacitor/local-notifications');
  const status = await LocalNotifications.requestPermissions();
  return status.display === 'granted';
}

export async function syncReminders(reminders: Reminder[]): Promise<void> {
  if (!isNativeApp()) return;
  // Wake-ups go to the true alarm where the phone has one; if that fails they stay notifications
  const wakes = reminders.filter((r) => r.alarm);
  const alarmsSet = await setWakeAlarms(wakes.map((r) => ({ id: reminderNumber(r.id), atMs: Date.parse(r.atUtc), title: r.title, body: r.body })));
  const asNotifications = alarmsSet ? reminders.filter((r) => !r.alarm) : reminders;

  const { LocalNotifications } = await import('@capacitor/local-notifications');
  const { display } = await LocalNotifications.checkPermissions();
  const pending = await LocalNotifications.getPending();
  if (pending.notifications.length) await LocalNotifications.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
  if (display !== 'granted' || asNotifications.length === 0) return;
  await LocalNotifications.schedule({
    notifications: asNotifications.map((r) => ({
      id: reminderNumber(r.id),
      title: r.title,
      body: r.body,
      schedule: { at: new Date(r.atUtc), allowWhileIdle: true },
    })),
  });
}
