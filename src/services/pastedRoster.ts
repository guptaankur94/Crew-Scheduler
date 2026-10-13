import { extractJsonFromText } from '../../server/upload';
import { sanitizeParsedRoster, type SanitizedRoster, type SanitizeOptions } from '../../server/rosterSanitizer';

/**
 * "Read with your own AI app": the person gives their own AI app (ChatGPT, Claude, Gemini…) the prompt from
 * rosterPrompt.ts and their screenshots, then pastes the answer here. It goes through the same checks as a
 * server read, then to the same "Check what was read" screen. Nothing is sent anywhere.
 */

/** A pasted answer from an AI app (JSON with a flights list), rather than roster text to send for reading. */
export function looksLikeAiAnswer(text: string): boolean {
  return /"flights"\s*:/.test(text);
}

export type PastedRead = { success: true; data: SanitizedRoster } | { success: false; error: string };

export function readAiAnswer(text: string, options: SanitizeOptions = {}, now: Date = new Date()): PastedRead {
  const parsed = extractJsonFromText(text);
  if (!parsed || typeof parsed !== 'object') {
    return { success: false, error: 'Could not find the data in this answer. Paste the whole reply from your AI app, including the part that starts with {.' };
  }
  const data = sanitizeParsedRoster(parsed, now, options);
  if (!data) {
    return {
      success: false,
      error: 'The answer has no complete flights (each needs a flight number, airports, date and times). Check the screenshots were attached, then ask your AI app again.',
    };
  }
  return { success: true, data };
}
