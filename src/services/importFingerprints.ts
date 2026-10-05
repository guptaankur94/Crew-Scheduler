/**
 * Recognises a file that was already imported, so the same roster is not sent to the AI again.
 * Each file's SHA-256 fingerprint is remembered with the saved roster version it produced (its parsedAt).
 * A fingerprint only short-circuits while that exact roster version is still the saved one: after any
 * later change (another upload, an edit, an undo) the file is read and compared again as usual.
 * Stored on this device only; fingerprints reveal nothing about the file's contents.
 */

const KEY = 'crew_import_fingerprints_v1';
const MAX_ENTRIES = 200;

export async function fileFingerprint(file: Blob): Promise<string | null> {
  try {
    const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return null;
  }
}

function load(): Record<string, string> {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

/** The saved roster version (parsedAt) this file produced, if it was imported before. */
export function importedWith(fingerprint: string): string | undefined {
  const v = load()[fingerprint];
  return typeof v === 'string' ? v : undefined;
}

/** Remembers that these files produced (or were already reflected in) this saved roster version. */
export function rememberImport(fingerprints: (string | null)[], rosterParsedAt: string | undefined): void {
  if (!rosterParsedAt) return;
  try {
    const all = load();
    for (const h of fingerprints) if (h) all[h] = rosterParsedAt;
    const entries = Object.entries(all).slice(-MAX_ENTRIES);
    localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch {
    // Storage full or blocked: the file is simply read again next time
  }
}
