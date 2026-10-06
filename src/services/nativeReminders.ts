import { isNativeApp } from './platform';
import { Reminder } from './reminders';

/*
 * Puts planned reminders on the phone (local notifications; nothing leaves the device). Each sync replaces
 * what this app scheduled before, so the phone always matches the current plan. Browser: does nothing.
 * Note: these are notifications with sound. Alarms that ring through Silent mode need a native alarm module
 * (iOS AlarmKit, Android exact alarms), planned for when the phone app is built.
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
  const { LocalNotifications } = await import('@capacitor/local-notifications');
  const { display } = await LocalNotifications.checkPermissions();
  const pending = await LocalNotifications.getPending();
  if (pending.notifications.length) await LocalNotifications.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
  if (display !== 'granted' || reminders.length === 0) return;
  await LocalNotifications.schedule({
    notifications: reminders.map((r) => ({
      id: reminderNumber(r.id),
      title: r.title,
      body: r.body,
      schedule: { at: new Date(r.atUtc), allowWhileIdle: true },
    })),
  });
}
