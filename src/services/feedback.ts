import { isNativeApp } from './platform';

/*
 * SEND FEEDBACK
 *
 * Opens the phone's share sheet (WhatsApp, Mail, …) with a ready message: what the person writes, plus the app
 * version, which version of the screens is running (live updates), the phone and the screen they were on.
 * Nothing about their roster is included. In a browser the message is copied for pasting anywhere.
 */

declare const __APP_VERSION__: string | undefined;
export const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev';

export interface FeedbackContext {
  screen: string;
  appVersion: string;
  screensVersion?: string;
  platform: string;
  device: string;
}

export function feedbackText(ctx: FeedbackContext): string {
  return [
    'CrewCircadian feedback',
    '',
    'What happened, or what would help? ',
    '',
    '',
    '— For the developer (no roster data) —',
    `App ${ctx.appVersion}${ctx.screensVersion ? ` · screens ${ctx.screensVersion}` : ''} · ${ctx.platform}`,
    `Screen: ${ctx.screen}`,
    `Device: ${ctx.device}`,
  ].join('\n');
}

async function context(screen: string): Promise<FeedbackContext> {
  const cap = (globalThis as { Capacitor?: { getPlatform?: () => string } }).Capacitor;
  let screensVersion: string | undefined;
  if (isNativeApp()) {
    try {
      const { CapacitorUpdater } = await import('@capgo/capacitor-updater');
      screensVersion = (await CapacitorUpdater.current()).bundle.version;
    } catch {
      /* not available */
    }
  }
  return {
    screen,
    appVersion: APP_VERSION,
    screensVersion,
    platform: cap?.getPlatform?.() ?? 'web',
    device: typeof navigator !== 'undefined' ? navigator.userAgent.replace(/\s*\(KHTML[^)]*\)/, '').slice(0, 140) : 'unknown',
  };
}

/** Opens the share sheet with the feedback message (phone), or copies it (browser). Returns what happened. */
export async function sendFeedback(screen: string): Promise<'shared' | 'copied' | 'failed'> {
  const text = feedbackText(await context(screen));
  try {
    if (isNativeApp()) {
      const { Share } = await import('@capacitor/share');
      await Share.share({ title: 'CrewCircadian feedback', text });
      return 'shared';
    }
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch {
    return 'failed';
  }
}
