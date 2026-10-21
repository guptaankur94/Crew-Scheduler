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

/** Buttons on reminders: the wake-up can be snoozed or confirmed; other reminders can come back in 10 minutes. */
export const SNOOZE_MINUTES = 10;
const WAKE_ACTIONS = 'CREW_WAKE';
const LATER_ACTIONS = 'CREW_LATER';
let actionsReady: Promise<void> | null = null;

/** Registers the reminder buttons and what they do (once per app start). Browser: does nothing. */
export function initReminderActions(): Promise<void> {
  if (!isNativeApp()) return Promise.resolve();
  actionsReady ??= (async () => {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    await LocalNotifications.registerActionTypes({
      types: [
        { id: WAKE_ACTIONS, actions: [{ id: 'up', title: "I'm up" }, { id: 'snooze', title: `Snooze ${SNOOZE_MINUTES} min` }] },
        { id: LATER_ACTIONS, actions: [{ id: 'snooze', title: `Remind me in ${SNOOZE_MINUTES} min` }] },
      ],
    });
    await LocalNotifications.addListener('localNotificationActionPerformed', ({ actionId, notification }) => {
      if (actionId !== 'snooze') return; // "I'm up" or a tap simply dismisses it
      void LocalNotifications.schedule({
        notifications: [
          {
            id: (notification.id + 7919) % 2_000_000_000, // a new ID, so the snoozed copy does not replace a planned reminder
            title: notification.title,
            body: notification.body,
            actionTypeId: notification.actionTypeId,
            schedule: { at: new Date(Date.now() + SNOOZE_MINUTES * 60000), allowWhileIdle: true },
          },
        ],
      });
    });
  })().catch((err) => {
    actionsReady = null;
    console.warn('Reminder buttons unavailable', err);
  });
  return actionsReady;
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

  await initReminderActions();
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
      actionTypeId: r.kind === 'wake' ? WAKE_ACTIONS : LATER_ACTIONS,
    })),
  });
}
