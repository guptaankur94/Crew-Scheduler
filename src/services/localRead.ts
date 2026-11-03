import { sanitizeParsedRoster, type SanitizeOptions } from '../../server/rosterSanitizer';
import type { PastedRead } from './pastedRoster';
import { extractPdfText } from './pdfText';
import { readScheduleReport } from './scheduleReport';

/**
 * Roster files the app can read itself, on the device, without the AI reader: today the IndiGo Personal Crew
 * Schedule Report PDF. Nothing is sent anywhere, so no AI consent is needed and it works offline and without a
 * server. Returns null for any other file, which then goes to the AI reader as before.
 */
export async function readOnDevice(file: Blob & { name?: string }, options: SanitizeOptions = {}, now: Date = new Date()): Promise<PastedRead | null> {
  const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name ?? '');
  if (!isPdf) return null;
  const items = await extractPdfText(await file.arrayBuffer());
  const report = items && readScheduleReport(items);
  if (!report) return null;
  const data = sanitizeParsedRoster(report.raw, now, options);
  if (!data) {
    return { success: false, error: 'This IndiGo schedule report has no flights or standby to read.' };
  }
  return { success: true, data: { ...data, warnings: [...report.warnings, ...data.warnings] } };
}
