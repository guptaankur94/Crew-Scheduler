import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useAiConsent } from '../AiConsentDialog';
import { useRosterReview } from '../RosterReviewDialog';
import { RosterData, RosterHistoryEntry, FlightLeg, OtherDuty, StandbyDuty } from '../../types/circadian';
import { RosterPreset } from '../../data/rosterPresets';
import { applyImport, combineFiles, describeChanges, diffRoster, hasNoChanges, importScope, rosterClock, RosterUpdateInfo, UploadContent } from '../../services/rosterDiff';
import { useWhatChanged } from '../WhatChangedDialog';
import { TimeConvention } from '../../services/rosterTimes';
import { normalizeDutyTimes } from '../../services/dutyTimes';
import { daySignature } from '../../services/rosterFindings';
import { apiFetch } from '../../services/platform';
import { UploadedRosters } from '../UploadedRosters';
import { FilePreviewModal } from '../FilePreviewModal';
import { determineMimeType, prepareFileForUpload } from '../../services/rosterFiles';
import { fileFingerprint, importedWith, rememberImport } from '../../services/importFingerprints';
import { addImportRecord, cleanSlate, ImportRecord, loadImportRecords, markRemoved, ownedDates, periodOf, recordsFromHistory, replaceRecordReading, visibleRecords, withoutDates } from '../../services/importRecords';
import { deleteStoredFile, getStoredFile, keepFile, textFingerprint } from '../../services/fileStore';
import { shortRange } from '../../services/periodStats';
import {
  Upload,
  Sparkles,
  FileText,
  Image as ImageIcon,
  Check,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Plane,
  RefreshCw,
  Clock,
  Trash2,
  Files,
  X,
  Plus,
  ArrowRight,
  Eye,
  ZoomIn,
  ShieldCheck,
} from 'lucide-react';

interface UploadViewProps {
  currentRoster: RosterData;
  /** Files shared to the app from elsewhere ("Share → CrewCircadian"), to stage here once. */
  incomingFiles?: File[];
  onIncomingFilesTaken?: () => void;
  presets: RosterPreset[];
  activePresetId: string;
  history: RosterHistoryEntry[];
  onSelectPreset: (preset: RosterPreset) => void;
  /** update: for an update of the saved roster, what changed (adjustments on other days are kept). */
  onRosterParsed: (roster: RosterData, sourceTitle?: string, customDescription?: string, update?: RosterUpdateInfo) => void;
  onViewRosterTimeline: () => void;
  onViewMasterSheet?: () => void;
  /** Present when the newest roster change can be undone. */
  onUndoLatest?: () => void;
  /** How the person's rosters print times (Settings), and remembering a choice made on the check screen. */
  timeConvention?: TimeConvention;
  onTimeConventionChosen?: (convention: TimeConvention) => void;
}

/** Combines standby periods, dropping exact repeats (same kind and start). */
function mergeStandby(existing: StandbyDuty[] | undefined, incoming: StandbyDuty[]): StandbyDuty[] {
  const all = [...(existing ?? []), ...incoming];
  const seen = new Set<string>();
  return all
    .filter((sb) => {
      const key = `${sb.kind}-${sb.startUtc}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => Date.parse(a.startUtc) - Date.parse(b.startUtc));
}

/** Combines non-flying days (OFF, leave, sick, training); a newer entry for the same date replaces the older one. */
function mergeOther(existing: OtherDuty[] | undefined, incoming: OtherDuty[]): OtherDuty[] {
  const byDate = new Map<string, OtherDuty>();
  for (const d of [...(existing ?? []), ...incoming]) byDate.set(d.date, d);
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/** Widens a start/end pair to include another file's stated dates (several screenshots of one roster). */
function mergePeriodBounds(current: { start?: string; end?: string }, start?: string, end?: string): { start?: string; end?: string } {
  const valid = (d?: string) => (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : undefined);
  const s = [current.start, valid(start)].filter(Boolean) as string[];
  const e = [current.end, valid(end)].filter(Boolean) as string[];
  return { start: s.sort()[0], end: e.sort()[e.length - 1] };
}

/** The dates the combined roster covers: from the earliest stated start to the latest stated end. */
function mergePeriod(existing: RosterData | undefined, incoming: { start?: string; end?: string }): { periodStart?: string; periodEnd?: string } {
  const starts = [existing?.periodStart, incoming.start].filter(Boolean) as string[];
  const ends = [existing?.periodEnd, incoming.end].filter(Boolean) as string[];
  if (!starts.length || !ends.length) return {};
  return { periodStart: starts.sort()[0], periodEnd: ends.sort()[ends.length - 1] };
}

/** Marks every item of an upload with where it came from, so the app can always say why it believes it. */
function withSource(upload: UploadContent, title: string, at: string = new Date().toISOString()): UploadContent {
  const importedFrom = { title, at };
  return {
    ...upload,
    flights: upload.flights.map((f) => ({ ...f, importedFrom })),
    standby: (upload.standby ?? []).map((sb) => ({ ...sb, importedFrom })),
    otherDuties: (upload.otherDuties ?? []).map((d) => ({ ...d, importedFrom })),
  };
}

export interface FileBatchItem {
  id: string;
  file: File;
  name: string;
  sizeKb: number;
  type: string;
  previewUrl?: string;
  status: 'staged' | 'queued' | 'processing' | 'success' | 'error';
  flightsCount?: number;
  extractedFlights?: FlightLeg[];
  airline?: string;
  homeBase?: string;
  homeBaseTzOffset?: number;
  error?: string;
}

export const UploadView: React.FC<UploadViewProps> = ({
  currentRoster,
  presets,
  activePresetId,
  history,
  onSelectPreset,
  onRosterParsed,
  onViewRosterTimeline,
  onViewMasterSheet,
  incomingFiles,
  onIncomingFilesTaken,
  onUndoLatest,
  timeConvention = 'local',
  onTimeConventionChosen,
}) => {
  // A sample roster is replaced by the first real upload, never mixed with it
  const isViewingSample = presets.some((p) => p.id === activePresetId);
  const { requestConsent, dialog: consentDialog } = useAiConsent();
  const { reviewFlights, dialog: reviewDialog } = useRosterReview();
  const { reviewChanges, dialog: changesDialog } = useWhatChanged();

  /** True when an upload would change nothing in the saved roster (see rosterDiff). */
  const isAlreadyUpToDate = (upload: UploadContent) => {
    const clock = rosterClock(currentRoster);
    const scope = importScope(upload, currentRoster, clock);
    return !scope || hasNoChanges(diffRoster(currentRoster, upload, scope.dates, clock), scope);
  };

  /**
   * Saves an upload over the saved roster: the person sees what changed day by day, then only the dates the
   * upload covers are updated (newer roster wins there), and everything else stays exactly as saved.
   */
  const saveOverSavedRoster = async (
    upload: UploadContent,
    meta: { title: string; airline: string },
    options: { at?: string; keepSources?: boolean; clearUpdates?: boolean } = {}
  ): Promise<{ outcome: 'saved' | 'no_changes' | 'cancelled'; parsedAt?: string; summary?: string; saved?: UploadContent; scopeDates?: string[] }> => {
    // A new upload's items remember where they came from; a restored upload keeps its original source
    if (!options.keepSources) upload = withSource(upload, meta.title, options.at);
    const clock = rosterClock(currentRoster);
    const scope = importScope(upload, currentRoster, clock);
    if (!scope || hasNoChanges(diffRoster(currentRoster, upload, scope.dates, clock), scope)) {
      return { outcome: 'no_changes', parsedAt: currentRoster.parsedAt };
    }
    const review = await reviewChanges(currentRoster, upload, scope, clock);
    if (!review) return { outcome: 'cancelled' };
    const applied = applyImport(currentRoster, upload, review.scopeDates, review.diff, clock, review.choices);
    const changedDates = review.diff.days.map((d) => d.date);
    const parsedAt = new Date().toISOString();
    const roster: RosterData = {
      id: `roster-${Date.now()}`,
      airline: meta.airline,
      homeBase: currentRoster.homeBase,
      homeBaseTzOffset: currentRoster.homeBaseTzOffset,
      flights: applied.flights,
      layovers: currentRoster.layovers || [],
      standbyDuties: applied.standby,
      otherDuties: applied.otherDuties,
      ...mergePeriod(currentRoster, { start: review.scopeDates[0], end: review.scopeDates[review.scopeDates.length - 1] }),
      parsedAt,
    };
    const summary = changedDates.length
      ? `${changedDates.length} ${changedDates.length === 1 ? 'day' : 'days'} changed (${changedDates.map((d) => shortRange(d, d)).join(', ')})`
      : 'Small corrections saved';
    onRosterParsed(roster, meta.title, summary, {
      changedDates,
      changes: describeChanges(review.diff, clock),
      ...(options.clearUpdates ? { clearUpdatesOn: review.scopeDates } : {}),
    });
    return { outcome: 'saved', parsedAt, summary, saved: upload, scopeDates: review.scopeDates };
  };

  // Uploaded rosters: what each upload read (and its kept original files), for restoring or reading again
  const [importRecords, setImportRecords] = useState<ImportRecord[]>(loadImportRecords);
  const recordUpload = async (
    content: UploadContent,
    info: { title: string; at: string; source: 'files' | 'text'; dates: string[]; convention?: TimeConvention; files: { file: Blob; name: string; fingerprint: string | null }[] }
  ) => {
    const files = await Promise.all(
      info.files.map(async (f) => ({ name: f.name, type: f.file.type, size: f.file.size, fingerprint: f.fingerprint, stored: await keepFile(f.fingerprint, f.file, f.name) }))
    );
    setImportRecords(
      addImportRecord({
        id: `import-${info.at}`,
        title: info.title,
        uploadedAt: info.at,
        source: info.source,
        files,
        ...(content.periodStart && content.periodEnd ? { period: { start: content.periodStart, end: content.periodEnd } } : {}),
        dates: info.dates,
        tailDates: content.tailDates ?? [],
        convention: info.convention,
        read: { flights: content.flights, standby: content.standby ?? [], otherDuties: content.otherDuties ?? [] },
      })
    );
  };

  // "Your rosters": uploads made before records existed are worked out from history snapshots
  const allRecords = useMemo(() => [...importRecords, ...recordsFromHistory(history, importRecords)], [importRecords, history]);
  const yourRosters = useMemo(() => visibleRecords(allRecords, currentRoster), [allRecords, currentRoster]);
  const [showPaste, setShowPaste] = useState(false);

  /**
   * Re-read, step 2: a clean slate for the roster's dates with the given reading. Corrections on those dates
   * go; delays and callouts stay (they are kept separately). Saved with history and Undo.
   */
  const applyReread = (record: ImportRecord, content: UploadContent, files?: ImportRecord['files']) => {
    const dates = ownedDates(record, allRecords);
    const range = shortRange(dates[0], dates[dates.length - 1]);
    const tagged = withSource(content, record.title, record.uploadedAt);
    const read = { flights: tagged.flights, standby: tagged.standby ?? [], otherDuties: tagged.otherDuties ?? [] };
    const clock = rosterClock(currentRoster);
    const items = cleanSlate(currentRoster, dates, read);
    const diff = diffRoster(currentRoster, { ...tagged, visibleDates: dates }, dates, clock);
    const changedDates = diff.days.map((d) => d.date);
    onRosterParsed(
      { ...currentRoster, id: `roster-${Date.now()}`, flights: items.flights, standbyDuties: items.standby, otherDuties: items.otherDuties, parsedAt: new Date().toISOString() },
      `Re-read: ${range} roster`,
      changedDates.length ? `${changedDates.length} ${changedDates.length === 1 ? 'day' : 'days'} changed` : 'Nothing changed',
      { changedDates, changes: describeChanges(diff, clock) }
    );
    setImportRecords(replaceRecordReading(record, read, files));
    setSuccessMessage(`Roster updated: re-read ${range} (${changedDates.length ? `${changedDates.length} ${changedDates.length === 1 ? 'day' : 'days'} changed` : 'no changes'}).`);
  };

  /** Re-read, step 1: read the kept file again (with the check screen), or use what was read at upload. */
  const rereadRoster = async (record: ImportRecord) => {
    setParseError(null);
    setSuccessMessage(null);
    const kept = record.source === 'history' ? [] : await Promise.all(record.files.map((f) => (f.fingerprint ? getStoredFile(f.fingerprint) : Promise.resolve(null))));
    if (!kept.length || kept.some((k) => !k)) {
      // The file was not kept: start again from what was read at upload (no AI)
      applyReread(record, { flights: record.read.flights, standby: record.read.standby, otherDuties: record.read.otherDuties });
      return;
    }
    if (record.source === 'text') {
      await handleParseText({ text: await kept[0]!.blob.text(), title: record.title, reread: record });
      return;
    }
    const items: FileBatchItem[] = kept.map((k, i) => ({
      id: `reread-${Date.now()}-${i}`,
      file: new File([k!.blob], k!.name, { type: k!.type }),
      name: k!.name,
      sizeKb: Math.round(k!.size / 1024),
      type: k!.type,
      previewUrl: k!.type.startsWith('image/') ? URL.createObjectURL(k!.blob) : undefined,
      status: 'queued',
    }));
    await startProcessingBatch({ items, title: record.title, reread: record });
  };

  // Entries left over from the person's own edits when no roster remains (e.g. a day marked off by hand
  // outside the last roster's dates): shown plainly with a way to clear them, so a blank slate is possible
  const isSample = presets.some((p) => p.id === activePresetId);
  const leftovers = !isSample && yourRosters.length === 0
    ? [
        ...currentRoster.flights.map((f) => rosterClock(currentRoster).date(Date.parse(f.departureTimeUtc))),
        ...(currentRoster.standbyDuties ?? []).map((sb) => rosterClock(currentRoster).date(Date.parse(sb.startUtc))),
        ...(currentRoster.otherDuties ?? []).map((d) => d.date),
      ].sort()
    : [];
  const clearLeftovers = () => {
    const { periodStart: _s, periodEnd: _e, ...rest } = currentRoster;
    onRosterParsed(
      { ...rest, id: `roster-${Date.now()}`, flights: [], standbyDuties: [], otherDuties: [], parsedAt: new Date().toISOString() },
      'Cleared leftover entries',
      `Cleared ${leftovers.length} leftover ${leftovers.length === 1 ? 'entry' : 'entries'} not part of any roster.`,
      { changedDates: [...new Set(leftovers)], changes: [] }
    );
    setSuccessMessage('Roster updated: leftover entries cleared. Your plan is now a blank slate.');
  };

  /** Remove: the roster's days leave the plan and its kept file is deleted (Undo brings the days back). */
  const removeRoster = async (record: ImportRecord) => {
    setParseError(null);
    const dates = ownedDates(record, allRecords);
    const range = shortRange(dates[0], dates[dates.length - 1]);
    const remaining = yourRosters.filter((r) => r.record.id !== record.id);
    // Removing the last roster leaves a true blank slate: nothing at all is left behind
    const items = remaining.length ? withoutDates(currentRoster, dates) : { flights: [], standby: [], otherDuties: [] };
    const { periodStart, periodEnd, ...rest } = currentRoster;
    void periodStart;
    void periodEnd;
    onRosterParsed(
      { ...rest, id: `roster-${Date.now()}`, flights: items.flights, standbyDuties: items.standby, otherDuties: items.otherDuties, ...periodOf(remaining), parsedAt: new Date().toISOString() },
      `Removed: ${range} roster`,
      `The ${range} roster was removed from your plan.`,
      { changedDates: dates, changes: [{ date: dates[0], label: 'Removed', lines: [`${range} roster removed`] }] }
    );
    setImportRecords(markRemoved(record));
    const stillUsed = new Set(loadImportRecords().filter((r) => !r.removedAt).flatMap((r) => r.files.map((f) => f.fingerprint)));
    for (const f of record.files) if (f.fingerprint && !stillUsed.has(f.fingerprint)) await deleteStoredFile(f.fingerprint);
    setSuccessMessage(`Roster updated: removed ${range}.`);
  };

  // Standby periods read along with the flights in the current import
  const importedStandbyRef = useRef<StandbyDuty[]>([]);
  // Non-flying days and the stated roster dates read in the current import
  const importedOtherRef = useRef<OtherDuty[]>([]);
  const importedPeriodRef = useRef<{ start?: string; end?: string }>({});
  // Dates the documents in the current import actually show (blank and OFF days included)
  const importedVisibleRef = useRef<string[]>([]);
  // Extra days shown beyond a roster's own period: they fill gaps but never replace what is saved
  const importedTailRef = useRef<string[]>([]);
  const uploadContent = (flights: FlightLeg[]): UploadContent => ({
    // Check-in on the first sector of each duty, debrief on the last, so comparisons with the saved roster are like for like
    flights: normalizeDutyTimes(flights),
    standby: importedStandbyRef.current,
    otherDuties: importedOtherRef.current,
    periodStart: importedPeriodRef.current.start,
    periodEnd: importedPeriodRef.current.end,
    visibleDates: importedVisibleRef.current,
    tailDates: importedTailRef.current,
  });
  const hasOwnRoster = currentRoster.flights.length > 0 && !isViewingSample;

  /** What the check screen shows besides the flights: standby, listed days, the dates read, and (when there is a
   * saved roster) the days that read exactly as already saved, so only the changes need checking. */
  const reviewDays = (flights: FlightLeg[]) => {
    const content = uploadContent(flights);
    const standby = content.standby ?? [];
    const otherDuties = content.otherDuties ?? [];
    const read: RosterData = { ...currentRoster, flights: content.flights, standbyDuties: standby, otherDuties };
    const clock = rosterClock(currentRoster);
    const dates = [
      ...new Set([
        ...(content.visibleDates ?? []),
        ...content.flights.map((f) => clock.date(Date.parse(f.departureTimeUtc))),
        ...standby.map((s) => clock.date(Date.parse(s.startUtc))),
        ...otherDuties.map((o) => o.date),
      ]),
    ];
    return {
      standby,
      otherDuties,
      dates: content.visibleDates ?? [],
      unchanged: hasOwnRoster ? dates.filter((d) => daySignature(read, d) === daySignature(currentRoster, d)) : [],
    };
  };

  const [isParsingBatch, setIsParsingBatch] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  // Flights the server refused to guess at; shown so the user can add them by hand
  const [parseWarnings, setParseWarnings] = useState<string[]>([]);
  const [batchSummary, setBatchSummary] = useState<{
    totalUniqueFlights: number;
    filesCount: number;
    breakdown: { fileName: string; count: number }[];
  } | null>(null);

  // Multi-file queue & Staging
  const [fileBatch, setFileBatch] = useState<FileBatchItem[]>([]);
  const [currentProcessingIdx, setCurrentProcessingIdx] = useState<number>(-1);
  const [rawTextInput, setRawTextInput] = useState('');
  
  // Lightbox modal for enlarged preview verification
  const [previewModalIndex, setPreviewModalIndex] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Stage incoming files for user verification BEFORE processing
  const stageIncomingFiles = (incomingFiles: File[]) => {
    if (!incomingFiles || incomingFiles.length === 0) return;

    setParseError(null);
    setSuccessMessage(null);
    setBatchSummary(null);

    const newItems: FileBatchItem[] = incomingFiles.map((file, idx) => ({
      id: `file-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
      file,
      name: file.name,
      sizeKb: Math.round(file.size / 1024),
      type: determineMimeType(file),
      previewUrl: file.type.startsWith('image/') || file.name.match(/\.(png|jpe?g|webp|heic|heif)$/i)
        ? URL.createObjectURL(file)
        : undefined,
      status: 'staged',
    }));

    setFileBatch((prev) => [...prev, ...newItems]);
  };
  // Files shared from another app: staged like files picked here (the person then starts reading them)
  useEffect(() => {
    if (!incomingFiles?.length) return;
    stageIncomingFiles(incomingFiles);
    onIncomingFilesTaken?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incomingFiles]);


  // Remove a single file from the staging queue
  const removeFileFromBatch = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setFileBatch((prev) => {
      const itemToRemove = prev.find((item) => item.id === id);
      if (itemToRemove?.previewUrl) {
        URL.revokeObjectURL(itemToRemove.previewUrl);
      }
      return prev.filter((item) => item.id !== id);
    });

    if (previewModalIndex !== null) {
      setPreviewModalIndex(null);
    }
  };

  // Clear all staged files
  const clearAllStagedFiles = () => {
    fileBatch.forEach((item) => {
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
    });
    setFileBatch([]);
    setParseError(null);
    setSuccessMessage(null);
    setBatchSummary(null);
    setParseWarnings([]);
    setPreviewModalIndex(null);
  };

  // Process all staged files with Gemini AI
  /** Reads the staged files, or the kept files of an earlier upload ("Read again"). */
  const startProcessingBatch = async (again?: { items: FileBatchItem[]; title: string; reread?: ImportRecord }) => {
    const batch = again?.items ?? fileBatch;
    if (batch.length === 0) return;
    if (!(await requestConsent())) return;
    if (again) setFileBatch(again.items);

    setParseError(null);
    setSuccessMessage(null);
    setBatchSummary(null);
    setParseWarnings([]);
    setIsParsingBatch(true);

    const itemsToProcess = [...batch];
    // The same files imported again, with nothing changed since: no need to read them again (unless asked to)
    const fingerprints = await Promise.all(itemsToProcess.map((item) => fileFingerprint(item.file)));
    if (!again && hasOwnRoster && fingerprints.every((h) => h && importedWith(h) === currentRoster.parsedAt)) {
      setIsParsingBatch(false);
      setSuccessMessage('Already imported. No changes: your roster is already up to date.');
      setFileBatch([]);
      return;
    }
    const allExtractedFlights: FlightLeg[] = [];
    importedStandbyRef.current = [];
    importedOtherRef.current = [];
    importedPeriodRef.current = {};
    importedVisibleRef.current = [];
    importedTailRef.current = [];
    // Each file's content kept apart, so overlapping rosters can be decided date by date (see combineFiles)
    const fileContents: UploadContent[] = [];
    // Which clock the times were read in: the roster's own statement wins over the setting
    let batchTimes: { convention: TimeConvention; stated: boolean } = { convention: timeConvention, stated: false };
    const batchWarnings: string[] = [];
    let detectedAirline = !isViewingSample && currentRoster.airline !== 'None' ? currentRoster.airline : 'Airline';
    let detectedHomeBase = currentRoster.homeBase || 'DEL';
    let detectedHomeBaseTzOffset = currentRoster.homeBaseTzOffset || 5.5;
    const breakdown: { fileName: string; count: number }[] = [];

    // Process files one by one sequentially
    for (let i = 0; i < itemsToProcess.length; i++) {
      setCurrentProcessingIdx(i);
      const currentItem = itemsToProcess[i];

      setFileBatch((prev) =>
        prev.map((item) => (item.id === currentItem.id ? { ...item, status: 'processing' } : item))
      );

      try {
        const { base64Data, mimeType: resolvedMime } = await prepareFileForUpload(currentItem.file);

        const response = await apiFetch('/api/roster/parse', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageBase64: base64Data,
            mimeType: resolvedMime,
            timeConvention,
            homeBase: currentRoster.homeBase,
          }),
        });

        const result = await response.json();

        if (result.success && result.data && Array.isArray(result.data.flights) && result.data.flights.length > 0) {
          const flights: FlightLeg[] = result.data.flights;

          if (result.data.airline && result.data.airline !== 'other') {
            detectedAirline = result.data.airline;
          }
          if (result.data.homeBase) {
            detectedHomeBase = result.data.homeBase;
          }
          if (typeof result.data.homeBaseTzOffset === 'number') {
            detectedHomeBaseTzOffset = result.data.homeBaseTzOffset;
          }

          allExtractedFlights.push(...flights);
          if (Array.isArray(result.data.standby)) importedStandbyRef.current.push(...result.data.standby);
          if (Array.isArray(result.data.otherDuties)) importedOtherRef.current.push(...result.data.otherDuties);
          importedPeriodRef.current = mergePeriodBounds(importedPeriodRef.current, result.data.periodStart, result.data.periodEnd);
          if (Array.isArray(result.data.visibleDates)) importedVisibleRef.current.push(...result.data.visibleDates);
          if (result.data.timeConventionStated && !batchTimes.stated) batchTimes = { convention: result.data.timeConvention, stated: true };
          fileContents.push({
            flights,
            standby: Array.isArray(result.data.standby) ? result.data.standby : [],
            otherDuties: Array.isArray(result.data.otherDuties) ? result.data.otherDuties : [],
            periodStart: result.data.periodStart,
            periodEnd: result.data.periodEnd,
            visibleDates: Array.isArray(result.data.visibleDates) ? result.data.visibleDates : [],
          });
          breakdown.push({ fileName: currentItem.name, count: flights.length });
          if (Array.isArray(result.data.warnings) && result.data.warnings.length > 0) {
            const fileWarnings: string[] = result.data.warnings;
            batchWarnings.push(...fileWarnings);
            setParseWarnings((prev) => [...prev, ...fileWarnings]);
          }

          setFileBatch((prev) =>
            prev.map((item) =>
              item.id === currentItem.id
                ? {
                    ...item,
                    status: 'success',
                    flightsCount: flights.length,
                    extractedFlights: flights,
                  }
                : item
            )
          );
        } else {
          const errMsg = result.error || 'No flight legs could be found in this file.';
          setFileBatch((prev) =>
            prev.map((item) =>
              item.id === currentItem.id ? { ...item, status: 'error', error: errMsg } : item
            )
          );
        }
      } catch (err: any) {
        setFileBatch((prev) =>
          prev.map((item) =>
            item.id === currentItem.id ? { ...item, status: 'error', error: err.message || 'Processing failed' } : item
          )
        );
      }
    }

    setIsParsingBatch(false);
    setCurrentProcessingIdx(-1);

    // Several files: each date is decided by the roster whose own period covers it (a newer roster wins), and
    // screenshots of the same roster are merged with each flight, standby or day kept once (by stable key)
    const batchClock = rosterClock(hasOwnRoster ? currentRoster : { homeBase: detectedHomeBase, homeBaseTzOffset: detectedHomeBaseTzOffset });
    const combined = combineFiles(fileContents, batchClock);
    allExtractedFlights.splice(0, allExtractedFlights.length, ...combined.content.flights);
    importedStandbyRef.current = combined.content.standby ?? [];
    importedOtherRef.current = combined.content.otherDuties ?? [];
    importedVisibleRef.current = combined.content.visibleDates ?? [];
    importedTailRef.current = combined.content.tailDates ?? [];
    batchWarnings.push(...combined.warnings);
    if (combined.warnings.length) setParseWarnings((prev) => [...prev, ...combined.warnings]);

    // Nothing new compared with the saved roster: say so, and save nothing
    if (allExtractedFlights.length > 0 && hasOwnRoster && isAlreadyUpToDate(uploadContent(allExtractedFlights))) {
      rememberImport(fingerprints, currentRoster.parsedAt);
      setSuccessMessage('No changes: your roster is already up to date.');
      setFileBatch([]);
      return;
    }

    // If at least one flight was extracted across all files, let the user check them before anything is saved
    if (allExtractedFlights.length > 0) {
      const reviewed = await reviewFlights(
        allExtractedFlights,
        itemsToProcess.map((item) => ({ name: item.name, url: item.type.startsWith('image/') ? item.previewUrl : undefined })),
        batchWarnings,
        {
          ...batchTimes,
          homeBase: hasOwnRoster ? currentRoster.homeBase : detectedHomeBase,
          days: reviewDays(allExtractedFlights),
        }
      );
      if (!reviewed) {
        setParseError('Nothing was saved. Upload again when you are ready.');
        return;
      }
      if (!batchTimes.stated && reviewed.convention !== timeConvention) onTimeConventionChosen?.(reviewed.convention);
      const confirmed = reviewed.flights;
      allExtractedFlights.splice(0, allExtractedFlights.length, ...confirmed);
      if (allExtractedFlights.length === 0) return;
      const at = new Date().toISOString();
      const recordFiles = itemsToProcess.map((item, i) => ({ file: item.file, name: item.name, fingerprint: fingerprints[i] }));
      const title = again?.title ?? (
        itemsToProcess.length === 1
          ? itemsToProcess[0].name
          : `${itemsToProcess.length} Roster Files (${itemsToProcess[0].name}${
              itemsToProcess.length > 1 ? ` +${itemsToProcess.length - 1} more` : ''
            })`);

      const breakdownStr = breakdown.map((b) => `${b.fileName}: ${b.count}`).join(', ');
      const description =
        itemsToProcess.length === 1
          ? `Extracted ${allExtractedFlights.length} flight legs via Gemini Aero-OCR`
          : `Extracted ${allExtractedFlights.length} flight legs from ${itemsToProcess.length} files (${breakdownStr})`;

      // Re-read: a clean slate for that roster's dates with this reading (no "What changed?": the person asked to start again)
      if (again?.reread) {
        const files = await Promise.all(recordFiles.map(async (f) => ({ name: f.name, type: f.file.type, size: f.file.size, fingerprint: f.fingerprint, stored: !!f.fingerprint })));
        applyReread(again.reread, uploadContent(allExtractedFlights), files);
        setFileBatch([]);
        return;
      }

      // A saved roster already exists: show what changed and update only the dates this upload covers
      if (hasOwnRoster) {
        const saved = await saveOverSavedRoster(
          uploadContent(allExtractedFlights),
          { title, airline: detectedAirline },
          { at }
        );
        if (saved.outcome === 'cancelled') {
          setParseError('Nothing was saved. Upload again when you are ready.');
          return;
        }
        rememberImport(fingerprints, saved.parsedAt);
        if (saved.outcome === 'saved' && saved.saved) {
          await recordUpload(saved.saved, { title, at, source: 'files', dates: saved.scopeDates ?? [], convention: reviewed.convention, files: recordFiles });
        }
        setSuccessMessage(saved.outcome === 'no_changes' ? 'No changes: your roster is already up to date.' : `Roster updated: ${saved.summary}.`);
        // Saved: back to a clean upload box, so "Your rosters" is right below
        setFileBatch([]);
        return;
      }

      // Initial clean roster (no previous active flights)
      // Already combined by stable key above; each item remembers which upload it came from
      const tagged = withSource(uploadContent(allExtractedFlights), title, at);
      const initialFlights = tagged.flights;
      importedStandbyRef.current = tagged.standby ?? [];

      const newRoster: RosterData = {
        id: `roster-init-${Date.now()}`,
        airline: detectedAirline,
        homeBase: detectedHomeBase,
        homeBaseTzOffset: detectedHomeBaseTzOffset,
        flights: initialFlights,
        layovers: [],
        standbyDuties: mergeStandby([], importedStandbyRef.current),
        otherDuties: mergeOther([], importedOtherRef.current),
        ...mergePeriod(undefined, importedPeriodRef.current),
        parsedAt: new Date().toISOString(),
      };

      onRosterParsed(newRoster, title, description);
      rememberImport(fingerprints, newRoster.parsedAt);
      await recordUpload(tagged, {
        title,
        at,
        source: 'files',
        dates: importScope(tagged, null, batchClock)?.dates ?? [],
        convention: reviewed.convention,
        files: recordFiles,
      });

      setBatchSummary({
        totalUniqueFlights: initialFlights.length,
        filesCount: itemsToProcess.length,
        breakdown,
      });

      setSuccessMessage(`Roster saved: ${initialFlights.length} ${initialFlights.length === 1 ? 'flight' : 'flights'} read from ${itemsToProcess.length === 1 ? itemsToProcess[0].name : `${itemsToProcess.length} files`}.`);
      setFileBatch([]);
    } else {
      setParseError(
        'Could not extract any valid flight sectors from the uploaded file(s). Please verify that the screenshots or PDFs contain readable flight tables.'
      );
    }
  };

  // Retry an individual file
  const retrySingleFile = async (itemId: string) => {
    const item = fileBatch.find((f) => f.id === itemId);
    if (!item) return;
    if (!(await requestConsent())) return;

    setFileBatch((prev) =>
      prev.map((f) => (f.id === itemId ? { ...f, status: 'processing', error: undefined } : f))
    );

    try {
      const { base64Data, mimeType: resolvedMime } = await prepareFileForUpload(item.file);
      const response = await apiFetch('/api/roster/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: base64Data,
          mimeType: resolvedMime,
          timeConvention,
          homeBase: currentRoster.homeBase,
        }),
      });

      const result = await response.json();
      if (result.success && result.data && Array.isArray(result.data.flights) && result.data.flights.length > 0) {
        setFileBatch((prev) =>
          prev.map((f) =>
            f.id === itemId
              ? { ...f, status: 'success', flightsCount: result.data.flights.length, extractedFlights: result.data.flights }
              : f
          )
        );
      } else {
        setFileBatch((prev) =>
          prev.map((f) =>
            f.id === itemId ? { ...f, status: 'error', error: result.error || 'Extraction failed' } : f
          )
        );
      }
    } catch (err: any) {
      setFileBatch((prev) =>
        prev.map((f) => (f.id === itemId ? { ...f, status: 'error', error: err.message || 'Error' } : f))
      );
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      stageIncomingFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      stageIncomingFiles(Array.from(e.target.files));
    }
    e.target.value = '';
  };

  /** Reads pasted text, or the kept text of an earlier upload ("Read again"). */
  const handleParseText = async (again?: { text: string; title: string; reread?: ImportRecord }) => {
    const text = again?.text ?? rawTextInput;
    if (!text.trim()) return;
    if (!(await requestConsent())) return;
    setIsParsingBatch(true);
    setParseError(null);
    setSuccessMessage(null);
    setBatchSummary(null);
    setParseWarnings([]);

    try {
      const response = await apiFetch('/api/roster/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawText: text, timeConvention, homeBase: currentRoster.homeBase }),
      });

      const result = await response.json();
      if (result.success && result.data) {
        importedStandbyRef.current = Array.isArray(result.data.standby) ? result.data.standby : [];
        importedOtherRef.current = Array.isArray(result.data.otherDuties) ? result.data.otherDuties : [];
        importedPeriodRef.current = mergePeriodBounds({}, result.data.periodStart, result.data.periodEnd);
        importedVisibleRef.current = Array.isArray(result.data.visibleDates) ? result.data.visibleDates : [];
        importedTailRef.current =
          combineFiles(
            [{ flights: result.data.flights || [], standby: importedStandbyRef.current, otherDuties: importedOtherRef.current, periodStart: result.data.periodStart, periodEnd: result.data.periodEnd, visibleDates: importedVisibleRef.current }],
            rosterClock(currentRoster)
          ).content.tailDates ?? [];
        const textWarnings: string[] = Array.isArray(result.data.warnings) ? result.data.warnings : [];
        setParseWarnings(textWarnings);
        if (hasOwnRoster && isAlreadyUpToDate(uploadContent(result.data.flights || []))) {
          setSuccessMessage('No changes: your roster is already up to date.');
          return;
        }
        const reviewed = await reviewFlights(result.data.flights || [], [], textWarnings, {
          convention: result.data.timeConvention ?? timeConvention,
          stated: !!result.data.timeConventionStated,
          homeBase: result.data.homeBase || currentRoster.homeBase,
          days: reviewDays(result.data.flights || []),
        });
        if (reviewed && !result.data.timeConventionStated && reviewed.convention !== timeConvention) onTimeConventionChosen?.(reviewed.convention);
        const confirmed = reviewed?.flights;
        if (!confirmed || confirmed.length === 0) {
          setParseError('Nothing was saved. Paste your roster again when you are ready.');
          return;
        }
        const newFlights: FlightLeg[] = confirmed;
        
        if (again?.reread) {
          applyReread(again.reread, uploadContent(newFlights));
          return;
        }
        const textTitle = again?.title ?? 'Pasted text';
        const at = new Date().toISOString();
        const textFile = { file: new Blob([text], { type: 'text/plain' }), name: 'Pasted text', fingerprint: await textFingerprint(text) };
        if (hasOwnRoster) {
          const saved = await saveOverSavedRoster(
            uploadContent(newFlights),
            { title: textTitle, airline: result.data.airline || currentRoster.airline },
            { at }
          );
          if (saved.outcome === 'cancelled') setParseError('Nothing was saved. Paste your roster again when you are ready.');
          else setSuccessMessage(saved.outcome === 'no_changes' ? 'No changes: your roster is already up to date.' : `Roster updated: ${saved.summary}.`);
          if (saved.outcome === 'saved' && saved.saved) {
            await recordUpload(saved.saved, { title: textTitle, at, source: 'text', dates: saved.scopeDates ?? [], convention: reviewed?.convention, files: [textFile] });
          }
          return;
        }
        const taggedText = withSource(uploadContent(newFlights), textTitle, at);

        const parsed: RosterData = {
          id: `roster-text-${Date.now()}`,
          airline: result.data.airline || 'Airline',
          homeBase: result.data.homeBase || 'DEL',
          homeBaseTzOffset: result.data.homeBaseTzOffset || 5.5,
          flights: taggedText.flights,
          layovers: [],
          standbyDuties: taggedText.standby ?? [],
          otherDuties: taggedText.otherDuties ?? [],
          ...mergePeriod(undefined, importedPeriodRef.current),
          parsedAt: new Date().toISOString(),
        };
        onRosterParsed(parsed, textTitle, `Extracted ${parsed.flights.length} flights from text`);
        await recordUpload(taggedText, {
          title: textTitle,
          at,
          source: 'text',
          dates: importScope(taggedText, null, rosterClock(parsed))?.dates ?? [],
          convention: reviewed?.convention,
          files: [textFile],
        });
        setSuccessMessage(`Parsed ${parsed.flights.length} flights from text!`);
      } else {
        setParseError(result.error || 'Failed to parse text. Please ensure flight numbers and dates are included.');
      }
    } catch (err: any) {
      setParseError(err.message || 'Text parsing error.');
    } finally {
      setIsParsingBatch(false);
    }
  };

  // Whether there are any files staged for verification
  const hasStagedFiles = fileBatch.some((f) => f.status === 'staged');
  const hasProcessedFiles = fileBatch.some((f) => f.status === 'success');

  return (
    <div className="space-y-5">
      {consentDialog}
      {reviewDialog}
      {changesDialog}
      {/* Privacy Notice */}
      <p className="text-[11px] text-slate-500">
        Privacy: files and text you submit here are sent to Google Gemini to be read. Your roster is then stored only in
        this browser. Crop out anything you do not want to share before uploading.
      </p>

      {/* Success Banner */}
      {successMessage && (
        <div className="rounded-2xl border border-emerald-800/60 bg-emerald-950/40 p-4 text-xs space-y-3 text-emerald-200">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
              <span className="font-bold text-white text-sm">{successMessage}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {onUndoLatest && /updated/i.test(successMessage) && (
                <button
                  onClick={() => {
                    onUndoLatest();
                    setSuccessMessage('Undone: your roster is back as it was before this upload.');
                  }}
                  className="rounded-lg border border-emerald-500/50 px-2.5 py-1 font-bold text-emerald-100 text-xs hover:bg-emerald-800/60"
                >
                  Undo
                </button>
              )}
              {onViewMasterSheet && (
                <button
                  onClick={onViewMasterSheet}
                  className="rounded-lg border border-emerald-500/50 bg-emerald-900/60 hover:bg-emerald-800/80 px-3 py-1 font-bold text-emerald-200 text-xs flex items-center gap-1 shadow-sm"
                  title="Check the days in Month against your roster"
                >
                  <FileText className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Check in Month ➔</span>
                </button>
              )}
              <button
                onClick={onViewRosterTimeline}
                className="rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3 py-1 font-bold text-white text-xs flex items-center gap-1 shadow-sm"
              >
                <span>Go to Days</span>
                <ArrowRight className="h-3 w-3" />
              </button>
            </div>
          </div>

          {batchSummary && batchSummary.filesCount > 1 && (
            <div className="border-t border-emerald-800/40 pt-2.5 flex flex-wrap items-center gap-2 text-[11px]">
              <span className="text-emerald-300 font-semibold">Per-File Breakdown:</span>
              {batchSummary.breakdown.map((item, idx) => (
                <span
                  key={idx}
                  className="rounded-lg bg-emerald-900/40 border border-emerald-700/40 px-2 py-0.5 text-emerald-200 font-mono"
                >
                  {item.fileName}: <strong>{item.count} sectors</strong>
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Flights left out because they could not be read reliably */}
      {parseWarnings.length > 0 && (
        <div role="alert" className="rounded-2xl border border-amber-800/60 bg-amber-950/30 p-4 text-xs space-y-2 text-amber-200">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold text-white text-sm">
                {parseWarnings.length} item{parseWarnings.length === 1 ? '' : 's'} need your attention
              </p>
              <p className="text-amber-200/90">
                Nothing was guessed. Check these against your roster and add any missing sector manually from the History tab.
              </p>
            </div>
          </div>
          <ul className="list-disc pl-9 space-y-0.5 font-mono text-[11px] text-amber-100/90">
            {parseWarnings.map((warning, idx) => (
              <li key={idx}>{warning}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Error Alert with Smart Guidance */}
      {parseError && (
        <div className="rounded-2xl border border-rose-800/80 bg-rose-950/40 p-4 text-xs space-y-2 text-rose-200 shadow-sm">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold text-white text-sm">Roster Processing Note</p>
              <p className="text-rose-200/90">{parseError}</p>
            </div>
          </div>
          <div className="border-t border-rose-900/40 pt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-rose-300">
            <div className="flex items-center gap-1.5 text-rose-300/80">
              <span>💡 Tip: Ensure flight numbers (e.g. 6E 205, AI 101, EK 512) and dates or times are visible in the image.</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowPaste(true)}
                className="rounded-lg bg-rose-900/50 hover:bg-rose-900/80 border border-rose-700/50 px-2.5 py-1 text-white font-semibold transition-colors"
              >
                Paste Text Instead
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="rounded-lg bg-rose-700 hover:bg-rose-600 px-2.5 py-1 text-white font-bold transition-colors"
              >
                Try Another Screenshot
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileInputChange}
        accept="image/*,application/pdf"
        multiple
        className="hidden"
      />

      {/* Upload a roster */}
      {(
        <div className="space-y-6">
          {/* Main Dropzone / Multi-File Selector */}
          {fileBatch.length === 0 ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-4">
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-700 bg-slate-950/70 p-8 text-center transition-all hover:border-blue-500 hover:bg-slate-900/80 cursor-pointer group"
              >
                <div className="space-y-3">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600/10 text-blue-400 ring-1 ring-blue-500/20 group-hover:scale-105 transition-transform">
                    <Files className="h-7 w-7" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">
                      Upload your roster: choose or drop screenshots or a PDF
                    </p>
                    <p className="text-xs text-slate-400 mt-1 max-w-lg mx-auto">
                      You can add several files at once, such as two pages of one month. You will check what was read before anything is saved.
                    </p>
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-500 transition-colors">
                    <Plus className="h-3.5 w-3.5" />
                    <span>Select Roster Files</span>
                  </div>
                </div>
              </div>

              {/* Supported Airlines info bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800/80 pt-3 text-[11px] text-slate-400">
                <span className="flex items-center gap-1.5">
                  <Plane className="h-3.5 w-3.5 text-blue-400" />
                  <span>Works with roster screenshots, PDFs and pasted text</span>
                </span>
                <span className="text-slate-500">Supports PNG, JPG, JPEG, WEBP, PDF</span>
              </div>
            </div>
          ) : (
            /* COMPACT ADDER when files are already in staging */
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900/50 p-3.5">
              <div className="flex items-center gap-2.5">
                <span className="flex h-2.5 w-2.5 rounded-full bg-blue-400 animate-pulse" />
                <span className="text-xs font-bold text-white">
                  {fileBatch.length} {fileBatch.length === 1 ? 'file' : 'files'} in staging queue
                </span>
                <span className="text-xs text-slate-400 hidden sm:inline">• Verify your images below, then click Upload</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isParsingBatch}
                  className="flex items-center gap-1.5 rounded-xl border border-blue-600/40 bg-blue-600/20 hover:bg-blue-600/30 px-3 py-1.5 text-xs font-bold text-blue-300 transition-colors disabled:opacity-40"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add More Files</span>
                </button>
                <button
                  onClick={clearAllStagedFiles}
                  disabled={isParsingBatch}
                  className="flex items-center gap-1.5 rounded-xl border border-slate-800 hover:bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-rose-400 transition-colors disabled:opacity-40"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Clear All</span>
                </button>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* THUMBNAIL PREVIEW & VERIFICATION AREA                    */}
          {/* ======================================================== */}
          {fileBatch.length > 0 && (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 space-y-4 shadow-sm">
              {/* Header Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-800 pb-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-blue-400" />
                    <h3 className="text-sm font-bold text-white">
                      Thumbnail Preview & Verification Area
                    </h3>
                    <span className="rounded-full bg-blue-900/60 border border-blue-700/50 px-2 py-0.5 text-[10px] font-mono font-bold text-blue-300">
                      {fileBatch.length} {fileBatch.length === 1 ? 'item' : 'items'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Verify that your screenshots show the correct dates and flight sectors. Tap any image to inspect full size.
                  </p>
                </div>

                {isParsingBatch && (
                  <div className="flex items-center gap-2 text-xs font-bold text-blue-300 bg-blue-950/60 border border-blue-800/60 px-3 py-1.5 rounded-xl">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-400" />
                    <span>
                      Uploading & Parsing {currentProcessingIdx + 1} of {fileBatch.length}...
                    </span>
                  </div>
                )}
              </div>

              {/* Progress Bar */}
              {isParsingBatch && currentProcessingIdx >= 0 && (
                <div className="space-y-1.5 rounded-xl border border-blue-900/50 bg-blue-950/30 p-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-300 font-medium">
                      Extracting file {currentProcessingIdx + 1} of {fileBatch.length}:{' '}
                      <strong className="text-white font-mono">{fileBatch[currentProcessingIdx]?.name}</strong>
                    </span>
                    <span className="text-blue-400 font-mono font-bold">
                      {Math.round(((currentProcessingIdx + 1) / fileBatch.length) * 100)}%
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
                    <div
                      className="h-full bg-blue-500 transition-all duration-300 rounded-full"
                      style={{
                        width: `${((currentProcessingIdx + 1) / fileBatch.length) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Thumbnail Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {fileBatch.map((item, idx) => (
                  <div
                    key={item.id}
                    className={`group relative flex flex-col rounded-2xl border transition-all overflow-hidden ${
                      item.status === 'processing'
                        ? 'border-blue-500 bg-blue-950/20 ring-1 ring-blue-500/50 shadow-md'
                        : item.status === 'success'
                        ? 'border-emerald-800/70 bg-emerald-950/20'
                        : item.status === 'error'
                        ? 'border-rose-800/70 bg-rose-950/20'
                        : 'border-slate-800 bg-slate-950/80 hover:border-slate-700 hover:bg-slate-900/90'
                    }`}
                  >
                    {/* Top Status & Remove Bar */}
                    <div className="absolute top-2.5 left-2.5 right-2.5 z-10 flex items-center justify-between pointer-events-none">
                      <div className="pointer-events-auto">
                        {item.status === 'staged' && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-slate-900/90 backdrop-blur-md px-2 py-0.5 text-[10px] font-bold text-slate-300 ring-1 ring-slate-700/60 shadow-sm">
                            <Clock className="h-3 w-3 text-slate-400" /> Page {idx + 1}
                          </span>
                        )}
                        {item.status === 'processing' && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-blue-950/90 backdrop-blur-md px-2 py-0.5 text-[10px] font-bold text-blue-300 ring-1 ring-blue-500/50 shadow-sm">
                            <Loader2 className="h-3 w-3 animate-spin text-blue-400" /> Extracting...
                          </span>
                        )}
                        {item.status === 'success' && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-950/90 backdrop-blur-md px-2 py-0.5 text-[10px] font-bold text-emerald-300 ring-1 ring-emerald-500/50 shadow-sm">
                            <Check className="h-3 w-3 text-emerald-400" /> {item.flightsCount} sectors
                          </span>
                        )}
                        {item.status === 'error' && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-rose-950/90 backdrop-blur-md px-2 py-0.5 text-[10px] font-bold text-rose-300 ring-1 ring-rose-500/50 shadow-sm">
                            <AlertCircle className="h-3 w-3 text-rose-400" /> Error
                          </span>
                        )}
                      </div>

                      {!isParsingBatch && (
                        <button
                          onClick={(e) => removeFileFromBatch(item.id, e)}
                          title="Remove from batch"
                          className="pointer-events-auto rounded-lg bg-black/60 backdrop-blur-md p-1.5 text-slate-400 hover:text-white hover:bg-rose-600 transition-colors shadow-sm"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Image / Thumbnail Container */}
                    <div
                      onClick={() => setPreviewModalIndex(idx)}
                      className="relative h-44 sm:h-48 w-full bg-slate-950 flex items-center justify-center cursor-pointer overflow-hidden p-2 select-none"
                    >
                      {item.previewUrl ? (
                        <img
                          src={item.previewUrl}
                          alt={item.name}
                          className="h-full w-full object-contain rounded-lg transition-transform duration-200 group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center text-slate-500 space-y-2">
                          {item.type.includes('pdf') ? (
                            <FileText className="h-10 w-10 text-rose-400" />
                          ) : (
                            <ImageIcon className="h-10 w-10 text-blue-400" />
                          )}
                          <span className="text-[11px] font-mono text-slate-400">PDF Document</span>
                        </div>
                      )}

                      <div className="absolute inset-0 bg-blue-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 backdrop-blur-[2px]">
                        <span className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900/90 px-3 py-1.5 text-xs font-bold text-white ring-1 ring-white/20 shadow-lg">
                          <Eye className="h-3.5 w-3.5 text-blue-400" />
                          <span>Click to Enlarge & Verify</span>
                        </span>
                      </div>
                    </div>

                    {/* File Information Footer */}
                    <div className="p-3 border-t border-slate-800/80 bg-slate-950/60 flex items-center justify-between text-xs">
                      <div className="min-w-0 pr-2">
                        <div
                          className="font-bold text-white truncate font-mono text-[11px]"
                          title={item.name}
                        >
                          {item.name}
                        </div>
                        <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5">
                          <span>{item.sizeKb} KB</span>
                          <span>•</span>
                          <span className="uppercase">{item.type.split('/')[1] || 'IMAGE'}</span>
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center gap-1.5">
                        {item.status === 'error' ? (
                          <button
                            onClick={() => retrySingleFile(item.id)}
                            className="inline-flex items-center gap-1 rounded-lg bg-rose-900/60 hover:bg-rose-800 border border-rose-700/60 px-2 py-1 text-[11px] font-semibold text-rose-200 transition-colors"
                          >
                            <RefreshCw className="h-3 w-3" />
                            <span>Retry</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => setPreviewModalIndex(idx)}
                            className="inline-flex items-center gap-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 px-2 py-1 text-[11px] font-semibold text-slate-300 transition-colors"
                            title="Inspect image"
                          >
                            <ZoomIn className="h-3 w-3 text-blue-400" />
                            <span>Verify</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* PRIMARY UPLOAD ACTION BUTTON BAR */}
              {!isParsingBatch && hasStagedFiles && (
                <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl bg-gradient-to-r from-blue-950/80 via-slate-900 to-slate-950 border border-blue-700/50 shadow-lg">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center ring-1 ring-blue-500/30 shrink-0">
                      <Upload className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">
                        {fileBatch.length} {fileBatch.length === 1 ? 'Roster File' : 'Roster Files'} Ready
                      </p>
                      <p className="text-xs text-slate-300 mt-0.5">
                        {currentRoster.flights.length > 0
                          ? `Ready to merge into your saved roster (${currentRoster.flights.length} sectors). A newer roster replaces what is saved on the dates it covers; you will see exactly what changes before anything is saved.`
                          : 'Ready to ingest and extract flight duties, report times, and circadian rest buffers.'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 w-full sm:w-auto shrink-0">
                    <button
                      onClick={clearAllStagedFiles}
                      className="w-1/2 sm:w-auto px-3.5 py-2.5 rounded-xl border border-slate-700 hover:bg-slate-800 text-xs font-semibold text-slate-300 transition-colors text-center"
                    >
                      Reselect
                    </button>
                    {/* BUTTON CLEARLY LABELED AS UPLOAD AS REQUESTED */}
                    <button
                      onClick={() => startProcessingBatch()}
                      className="w-1/2 sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white shadow-md shadow-blue-900/30 transition-all hover:scale-[1.02] text-center"
                    >
                      <Upload className="h-4 w-4" />
                      <span>Upload & Process with AI ➔</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Completed Batch Actions */}
              {!isParsingBatch && hasProcessedFiles && (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-800/40 text-xs">
                  <div className="flex items-center gap-2 text-emerald-300">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    <span>Upload & extraction complete! Integrated into your continuous duty timeline.</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={onViewRosterTimeline}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-colors"
                    >
                      View in Days ➔
                    </button>
                    <button
                      onClick={clearAllStagedFiles}
                      className="px-3 py-1.5 rounded-lg border border-slate-700 hover:bg-slate-800 text-slate-300 font-semibold transition-colors"
                    >
                      Upload Another Roster
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      )}

      {/* Another way to upload: paste the roster as text */}
      {!showPaste && (
        <button onClick={() => setShowPaste(true)} className="text-xs font-semibold text-slate-400 hover:text-white">
          Or paste roster text instead
        </button>
      )}

      {/* Leftovers from the person's own edits, when no roster remains */}
      {leftovers.length > 0 && (
        <p className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-xs text-slate-300">
          {leftovers.length} leftover {leftovers.length === 1 ? 'entry' : 'entries'} from your own edits (
          {[...new Set(leftovers)].map((d) => shortRange(d, d)).join(', ')}), not part of any roster.
          <button onClick={clearLeftovers} className="font-semibold text-blue-300 hover:text-white">
            Clear
          </button>
        </p>
      )}

      {/* Your rosters: Re-read or Remove */}
      <UploadedRosters
        rosters={yourRosters}
        busy={isParsingBatch}
        onReread={rereadRoster}
        onRemove={removeRoster}
        loadOriginal={async (record) => {
          const files = await Promise.all(
            record.files.filter((f) => f.stored && f.fingerprint).map(async (f) => {
              const stored = await getStoredFile(f.fingerprint!);
              return stored ? { name: f.name, url: URL.createObjectURL(stored.blob) } : null;
            })
          );
          return files.filter((f): f is { name: string; url: string } => !!f);
        }}
      />

      {/* One tap from undoing the last change */}
      {history[0] && onUndoLatest && (
        <p className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
          Last change: <span className="text-slate-200">{history[0].title}</span>
          <button onClick={onUndoLatest} className="font-semibold text-blue-300 hover:text-white">
            Undo
          </button>
        </p>
      )}

      {/* Before the first upload: a quiet way to try the app with a sample roster */}
      {!hasOwnRoster && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
          <span>New here? Try a sample roster:</span>
          {presets.map((preset) => {
            const isSelected = activePresetId === preset.id;
            return (
              <button
                key={preset.id}
                onClick={() => onSelectPreset(preset)}
                title={preset.description}
                aria-pressed={isSelected}
                className={`rounded-full border px-3 py-1 font-semibold transition-colors ${
                  isSelected ? 'border-blue-500/70 bg-blue-950/40 text-blue-200' : 'border-slate-700 text-slate-300 hover:border-slate-500 hover:text-white'
                }`}
              >
                {preset.name.split('(')[0].trim()}
              </button>
            );
          })}
        </div>
      )}

      {/* Paste roster text (shown when chosen) */}
      {showPaste && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
              Paste Raw Roster Text
            </label>
            <p className="text-xs text-slate-400 mt-0.5">
              Copy flight lines from your crew portal, SMS, or WhatsApp schedule message. Will merge into your active continuous timeline.
            </p>
          </div>

          <textarea
            value={rawTextInput}
            onChange={(e) => setRawTextInput(e.target.value)}
            placeholder={`Example:\n01 OCT 6E 205 DEL 06:30 BOM 08:45\n01 OCT 6E 206 BOM 09:35 DEL 11:50\n03 OCT 6E 534 DEL 14:00 BLR 16:45`}
            rows={8}
            className="w-full rounded-xl border border-slate-800 bg-slate-950 p-3 font-mono text-xs text-slate-200 placeholder:text-slate-600 focus:border-blue-500 focus:outline-none"
          />

          <button
            onClick={() => handleParseText()}
            disabled={isParsingBatch || !rawTextInput.trim()}
            className="flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 px-4 py-2.5 text-xs font-bold text-white transition-all disabled:opacity-50"
          >
            {isParsingBatch ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            <span>Upload & Parse Text with Gemini</span>
          </button>
        </div>
      )}

      {/* Full-screen preview of a staged file */}
      {previewModalIndex !== null && fileBatch[previewModalIndex] && (
        <FilePreviewModal items={fileBatch} index={previewModalIndex} onIndexChange={setPreviewModalIndex} onRemove={removeFileFromBatch} busy={isParsingBatch} />
      )}

    </div>
  );
};
