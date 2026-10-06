import { FlightLeg, OtherDuty, RosterData, RosterHistoryEntry, StandbyDuty } from '../types/circadian';
import { TimeConvention } from './rosterTimes';
import { daySignature } from './rosterFindings';
import { flightHomeDate, rosterClock, standbyHomeDate } from './rosterKeys';
import { normalizeDutyTimes } from './dutyTimes';

/*
 * UPLOADED ROSTERS
 *
 * Each upload is remembered with exactly what it read (as confirmed on the check screen), its dates, and the
 * files it came from. That makes two kinds of "reload" possible without uploading again:
 *   Restore as uploaded  put that roster's days back exactly as read (undoing later corrections), no AI;
 *   Read again           read the kept original files again with today's reader and settings.
 * Uploads made before records existed are worked out from history snapshots (what changed with that upload).
 * Stored on this device only; the original files themselves are in fileStore.
 */

const KEY = 'crew_imports_v1';
const MAX_RECORDS = 30;

export interface ImportRecord {
  id: string;
  title: string;
  uploadedAt: string; // also the `at` of every item's importedFrom
  source: 'files' | 'text' | 'history';
  files: { name: string; type: string; size: number; fingerprint: string | null; stored: boolean }[];
  period?: { start: string; end: string };
  /** Dates this upload decided (its scope when saved). */
  dates: string[];
  /** Extra days shown beyond its own period. */
  tailDates: string[];
  convention?: TimeConvention;
  read: { flights: FlightLeg[]; standby: StandbyDuty[]; otherDuties: OtherDuty[] };
  /** Set when the person removed this roster. It reappears if Undo brings its days back. */
  removedAt?: string;
}

export function loadImportRecords(): ImportRecord[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((r) => r && typeof r.id === 'string' && Array.isArray(r.dates) && r.read && Array.isArray(r.read.flights)) : [];
  } catch {
    return [];
  }
}

function save(records: ImportRecord[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(records.slice(0, MAX_RECORDS)));
  } catch {
    // Storage full: the newest records are kept when there is room again
  }
}

export function addImportRecord(record: ImportRecord): ImportRecord[] {
  const next = [record, ...loadImportRecords().filter((r) => r.id !== record.id)];
  save(next);
  return next;
}

export function removeImportRecord(id: string): ImportRecord[] {
  const next = loadImportRecords().filter((r) => r.id !== id);
  save(next);
  return next;
}

export function clearImportRecords(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing to clear
  }
}

/** The read items as a roster (same home base), for comparing days. */
function readAsRoster(record: ImportRecord, like: RosterData): RosterData {
  return { ...like, flights: normalizeDutyTimes(record.read.flights), standbyDuties: record.read.standby, otherDuties: record.read.otherDuties };
}

export type UploadState = 'active' | 'partly' | 'replaced';

export interface UploadStatus {
  state: UploadState;
  /** Days that are still exactly as this upload read them. */
  asUploaded: number;
  /** Days the person corrected since. */
  editedByYou: number;
  /** Days that now differ for another reason (a newer upload, or a merge). */
  changedSince: number;
  /** Days this upload decided. */
  total: number;
}

/** How an upload relates to the roster today, day by day. */
export function uploadStatus(record: ImportRecord, roster: RosterData): UploadStatus {
  const read = readAsRoster(record, roster);
  const clock = rosterClock(roster);
  const corrected = new Set(roster.flights.filter((f) => f.correctedByUser).map((f) => flightHomeDate(f, clock)));
  let asUploaded = 0;
  let editedByYou = 0;
  let changedSince = 0;
  const dates = record.dates.filter((d) => !record.tailDates.includes(d));
  for (const d of dates) {
    if (daySignature(read, d) === daySignature(roster, d)) asUploaded++;
    else if (corrected.has(d)) editedByYou++;
    else changedSince++;
  }
  const state: UploadState = asUploaded === dates.length ? 'active' : asUploaded === 0 && editedByYou === 0 ? 'replaced' : 'partly';
  return { state, asUploaded, editedByYou, changedSince, total: dates.length };
}

/**
 * Uploads made before records existed, worked out from history: each upload's snapshot compared with the
 * snapshot before it gives the days it changed and what it read for them. Skips uploads already recorded.
 */
export function recordsFromHistory(history: RosterHistoryEntry[], existing: ImportRecord[]): ImportRecord[] {
  const out: ImportRecord[] = [];
  for (let i = 0; i < history.length; i++) {
    const h = history[i];
    if (h.actionType !== 'upload' || !h.rosterSnapshot || /^(Merged|Restored:|Read again:|Re-read:|Removed:)/.test(h.title)) continue;
    if (existing.some((r) => Math.abs(Date.parse(r.uploadedAt) - Date.parse(h.timestamp)) < 5 * 60000)) continue;
    const snap = h.rosterSnapshot;
    const prev = history.slice(i + 1).find((x) => x.rosterSnapshot)?.rosterSnapshot;
    const clock = rosterClock(snap);
    const allDates = new Set<string>([
      ...snap.flights.map((f) => flightHomeDate(f, clock)),
      ...(snap.standbyDuties ?? []).map((s) => standbyHomeDate(s, clock)),
      ...(snap.otherDuties ?? []).map((d) => d.date),
    ]);
    const dates = [...allDates].filter((d) => !prev || daySignature(snap, d) !== daySignature(prev, d)).sort();
    if (!dates.length) continue;
    const inDates = (d: string) => dates.includes(d);
    out.push({
      id: `history-${h.id}`,
      title: h.title,
      uploadedAt: h.timestamp,
      source: 'history',
      files: [],
      dates,
      tailDates: [],
      read: {
        flights: snap.flights.filter((f) => inDates(flightHomeDate(f, clock))),
        standby: (snap.standbyDuties ?? []).filter((s) => inDates(standbyHomeDate(s, clock))),
        otherDuties: (snap.otherDuties ?? []).filter((d) => inDates(d.date)),
      },
    });
  }
  return out;
}

// ─── The "Your rosters" list: Re-read and Remove ───────────────────────────────

/**
 * Every date a roster covers: its printed period, or else from its first to its last day (so a blank day or
 * a day the person marked by hand inside it belongs to it too). Extra days it shows beyond its period are not
 * its own.
 */
export function coveredDates(r: ImportRecord): string[] {
  const own = r.dates.filter((d) => !r.tailDates.includes(d)).sort();
  const from = r.period?.start ?? own[0];
  const to = r.period?.end ?? own[own.length - 1];
  if (!from || !to) return [];
  const out: string[] = [];
  for (let t = Date.parse(`${from}T12:00:00Z`); t <= Date.parse(`${to}T12:00:00Z`); t += 86400000) out.push(new Date(t).toISOString().slice(0, 10));
  return out;
}

/** A roster's own dates (everything it covers), minus dates a newer roster owns. */
export function ownedDates(record: ImportRecord, all: ImportRecord[]): string[] {
  const own = coveredDates;
  const newer = all.filter((r) => r.id !== record.id && !r.removedAt && r.uploadedAt > record.uploadedAt);
  const takenByNewer = new Set(newer.flatMap(own));
  return own(record).filter((d) => !takenByNewer.has(d));
}

/** True when any of the record's dates in the roster are exactly as the record read them. */
function anyDayAsRead(record: ImportRecord, roster: RosterData, dates: string[]): boolean {
  const read = readAsRoster(record, roster);
  return dates.some((d) => daySignature(read, d) !== 'empty' && daySignature(read, d) === daySignature(roster, d));
}

/**
 * The rosters to show: each one that still decides some dates. A removed roster is hidden, unless Undo
 * brought its days back (then it shows again). Most recent roster period first.
 */
export function visibleRecords(all: ImportRecord[], roster: RosterData): { record: ImportRecord; dates: string[] }[] {
  return all
    .map((record) => ({ record, dates: ownedDates(record, all) }))
    .filter(({ record, dates }) => dates.length > 0 && (!record.removedAt || anyDayAsRead(record, roster, dates)))
    .sort((a, b) => (b.dates[0] ?? '').localeCompare(a.dates[0] ?? '') || b.record.uploadedAt.localeCompare(a.record.uploadedAt));
}

export interface DayItemsList {
  flights: FlightLeg[];
  standby: StandbyDuty[];
  otherDuties: OtherDuty[];
}

const onDates = (roster: RosterData, dates: Set<string>) => {
  const clock = rosterClock(roster);
  return {
    flight: (f: FlightLeg) => dates.has(flightHomeDate(f, clock)),
    standby: (s: StandbyDuty) => dates.has(standbyHomeDate(s, clock)),
    other: (o: OtherDuty) => dates.has(o.date),
  };
};

/**
 * Re-read: a clean slate for these dates. Everything saved on them (including the person's corrections and
 * flights they added) is replaced by what the roster says; every other date is untouched. The person's
 * updates (delays, callouts) are kept separately and follow their flights as usual.
 */
export function cleanSlate(roster: RosterData, dates: string[], content: DayItemsList): DayItemsList {
  const on = onDates(roster, new Set(dates));
  return {
    flights: [...roster.flights.filter((f) => !on.flight(f)), ...content.flights.filter(on.flight)].sort((a, b) => a.departureTimeUtc.localeCompare(b.departureTimeUtc)),
    standby: [...(roster.standbyDuties ?? []).filter((s) => !on.standby(s)), ...content.standby.filter(on.standby)].sort((a, b) => a.startUtc.localeCompare(b.startUtc)),
    otherDuties: [...(roster.otherDuties ?? []).filter((o) => !on.other(o)), ...content.otherDuties.filter(on.other)].sort((a, b) => a.date.localeCompare(b.date)),
  };
}

/** Remove: takes everything on these dates out of the plan. */
export function withoutDates(roster: RosterData, dates: string[]): DayItemsList {
  return cleanSlate(roster, dates, { flights: [], standby: [], otherDuties: [] });
}

/** The roster's covered period after some rosters are removed: the span of the remaining rosters' dates. */
export function periodOf(records: { dates: string[] }[]): { periodStart?: string; periodEnd?: string } {
  const all = records.flatMap((r) => r.dates).sort();
  return all.length ? { periodStart: all[0], periodEnd: all[all.length - 1] } : {};
}

/** Marks a record removed (kept so Undo can bring it back). */
export function markRemoved(record: ImportRecord): ImportRecord[] {
  return addImportRecord({ ...record, removedAt: new Date().toISOString() });
}

/** Updates a record after Re-read with the new reading (same upload time, so it keeps its place). */
export function replaceRecordReading(record: ImportRecord, read: DayItemsList, files?: ImportRecord['files']): ImportRecord[] {
  return addImportRecord({ ...record, read, ...(files ? { files } : {}), removedAt: undefined });
}
