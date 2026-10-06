import { kv } from './kv';

/**
 * Remembers whether the user agreed to send files to Google Gemini for reading.
 * Apple's App Review Guideline 5.1.2(i) requires this consent before personal data goes to a third-party AI.
 */
const CONSENT_KEY = 'crew_ai_consent_v1';

export function getAiConsentDate(): string | null {
  try {
    return kv.getItem(CONSENT_KEY);
  } catch {
    return null;
  }
}

export function hasAiConsent(): boolean {
  return getAiConsentDate() !== null;
}

export function giveAiConsent(now: Date = new Date()): void {
  try {
    kv.setItem(CONSENT_KEY, now.toISOString());
  } catch {
    // Storage unavailable: the user will simply be asked again next time
  }
}

export function withdrawAiConsent(): void {
  try {
    kv.removeItem(CONSENT_KEY);
  } catch {
    // Nothing stored
  }
}
