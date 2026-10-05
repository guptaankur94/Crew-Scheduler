import React, { useState, useMemo, useEffect, useRef } from 'react';
import { CircadianEvent, CrewPreferences, RosterData, RosterHistoryEntry, FlightLeg, HistoryDayChange, UserUpdate } from './types/circadian';
import {
  addCallout,
  allFlights,
  cancelFlight,
  cancelledFlights,
  reinstateFlight,
  clearStandbyUpdate,
  delayCandidate,
  delayFor,
  effectiveRoster,
  expectedDutyRelease,
  keyOfFlight,
  keyOfStandby,
  migrateLegacyDelays,
  releaseStandby,
  removeCalloutFlight,
  retainUpdates,
  setDelay,
  setStandbyTimes,
  standbyCandidate,
  standbyForFlight,
  standbyUpdate,
} from './services/userUpdates';
import { StandbyCard } from './components/StandbyCard';
import { PlanChangedCard, PlanChangeNotice } from './components/PlanChangedCard';
import { comparePlans } from './services/planChanges';
import { DelayCard } from './components/DelayCard';
import { getPresets, RosterPreset } from './data/rosterPresets';
import { generateCircadianPlan } from './services/circadianCalculator';
import {
  loadRosterHistory,
  saveRosterHistory,
  recordRosterAction,
  deleteRosterHistoryItem,
  clearRosterHistoryLogs,
  createEmptyRoster,
  computeRosterDateRange,
  setActiveHistoryItem,
  undoableEntry,
} from './services/rosterHistoryService';
import { analyzeRosterMerge } from './services/rosterMerger';
import { keepNudgesOutside, RosterUpdateInfo } from './services/rosterDiff';
import { loadAppState, saveAppState } from './services/appStateStorage';
import { Header } from './components/Header';
import { Sidebar, NavView } from './components/Sidebar';
import { TodayView } from './components/views/TodayView';
import { RosterView } from './components/views/RosterView';
import { SalaryView } from './components/views/SalaryView';
import { TodayPreview } from './components/views/TodayPreview';
import { UploadView } from './components/views/UploadView';
import { SettingsView } from './components/views/SettingsView';
import { ScienceView } from './components/views/ScienceView';
import { MonthView } from './components/views/MonthView';
import { EventDetailModal } from './components/EventDetailModal';
import {
  Clock,
  Calendar,
  UploadCloud,
  DollarSign,
  Sliders,
  CalendarDays,
} from 'lucide-react';

const DEFAULT_PREFERENCES: CrewPreferences = {
  airline: 'airline',
  homeBaseIata: 'DEL',
  homeBaseTzOffset: 5.5,
  chronotype: 'intermediate',
  targetSleepHours: 7.5,
  caffeineCutoffHours: 6,
  preferredNapDuration: 26,
  groomingMinutes: 60,
  cabBufferMinutes: 60,
  crewRank: 'senior',
  currency: 'INR',
};

export default function App() {
  const presets = useMemo(() => getPresets(), []);

  // Roster, preferences and adjustments saved from the previous visit (null on first run)
  const savedState = useMemo(() => loadAppState(DEFAULT_PREFERENCES), []);
  // Sample rosters are dated relative to today, so a saved sample is regenerated rather than restored stale
  const savedPreset = savedState ? presets.find((p) => p.id === savedState.activePresetId) : undefined;
  
  // Navigation State: 'today' | 'roster' | 'salary' | 'upload' | 'settings' | 'science'
  const [activeView, setActiveView] = useState<NavView>('today');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);

  // Default to 30-day full monthly roster
  const [activePresetId, setActivePresetId] = useState<string>(savedState?.activePresetId ?? presets[0].id);

  // The roster as the airline published it, and the person's own updates (delays) kept apart from it.
  // Delays saved by earlier versions inside the roster are converted once here.
  const initial = useMemo(
    () => migrateLegacyDelays(savedPreset ? savedPreset.roster : savedState?.roster ?? presets[0].roster, savedState?.userUpdates ?? []),
    []
  );
  const [roster, setRoster] = useState<RosterData>(initial.roster);
  const [userUpdates, setUserUpdates] = useState<UserUpdate[]>(initial.updates);

  // Roster Upload & Audit History State
  const [history, setHistory] = useState<RosterHistoryEntry[]>(() => {
    const loaded = loadRosterHistory();
    if (loaded && loaded.length > 0) return loaded;
    
    // Auto-seed with default loaded preset so history table starts with a valid audit log
    const initialPreset = presets[0];
    const initialEntry: RosterHistoryEntry = {
      id: `hist-default-${Date.now()}`,
      timestamp: new Date().toISOString(),
      actionType: 'preset',
      title: initialPreset.name,
      description: initialPreset.description,
      airline: initialPreset.roster.airline,
      homeBase: initialPreset.roster.homeBase,
      flightsCount: initialPreset.roster.flights.length,
      dateRange: computeRosterDateRange(initialPreset.roster),
      isActive: true,
      rosterSnapshot: initialPreset.roster,
    };
    saveRosterHistory([initialEntry]);
    return [initialEntry];
  });

  const [preferences, setPreferences] = useState<CrewPreferences>(savedState?.preferences ?? DEFAULT_PREFERENCES);

  const [customNudges, setCustomNudges] = useState<Record<string, number>>(
    savedPreset ? {} : savedState?.customNudges ?? {}
  );
  // Date to open when jumping from the Month screen into the timeline
  const [timelineJumpDate, setTimelineJumpDate] = useState<string | undefined>(undefined);
  // Month shown on the Month screen (YYYY-MM-01); starts on the current month
  // Open the Month screen straight on the full roster table (from the upload screen's check button)
  const [monthShowOriginal, setMonthShowOriginal] = useState(false);
  const [monthViewMonth, setMonthViewMonth] = useState<string>(() => `${new Date().toISOString().slice(0, 7)}-01`);
  /** Opens a day in the Timeline. */
  const openDayInTimeline = (dateStr: string) => {
    setTimelineJumpDate(dateStr);
    setActiveView('roster');
  };
  /** Switches screens from the menu or tab bar; the Timeline then opens on today. */
  const navigateTo = (view: NavView) => {
    if (view === 'roster') setTimelineJumpDate(undefined);
    setMonthShowOriginal(false);
    setActiveView(view);
  };
  const [selectedEvent, setSelectedEvent] = useState<CircadianEvent | null>(null);
  // Controlled preview of the redesigned Today screen; classic stays the default until approved
  const [todayVersion, setTodayVersion] = useState<'classic' | 'preview'>(() => {
    try {
      return localStorage.getItem('crew_today_version') === 'preview' ? 'preview' : 'classic';
    } catch {
      return 'classic';
    }
  });
  const chooseTodayVersion = (version: 'classic' | 'preview') => {
    setTodayVersion(version);
    try {
      localStorage.setItem('crew_today_version', version);
    } catch {
      // Not saved: the choice simply resets next time
    }
  };

  // Generate reactive Circadian Plan whenever roster, preferences, or nudges change
  const plan = useMemo(() => {
    // Planned on the roster with the person's updates applied; the saved roster itself is unchanged
    return generateCircadianPlan(effectiveRoster(roster, userUpdates), preferences, customNudges);
  }, [roster, userUpdates, preferences, customNudges]);

  // "Your plan changed": after an update, compare the plan before and after and keep what moved,
  // shown on Today until dismissed (remembered on this device only)
  const planBeforeUpdate = useRef<{ plan: typeof plan; title: string } | null>(null);
  const [planNotice, setPlanNotice] = useState<PlanChangeNotice | null>(() => {
    try {
      const raw = localStorage.getItem('crew_plan_notice_v1');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const showPlanNotice = (notice: PlanChangeNotice | null) => {
    setPlanNotice(notice);
    try {
      if (notice) localStorage.setItem('crew_plan_notice_v1', JSON.stringify(notice));
      else localStorage.removeItem('crew_plan_notice_v1');
    } catch {
      // Not remembered: the notice simply disappears on reload
    }
  };
  useEffect(() => {
    const pending = planBeforeUpdate.current;
    if (!pending) return;
    planBeforeUpdate.current = null;
    const days = comparePlans(pending.plan, plan, Date.now());
    showPlanNotice(days.length ? { title: pending.title, at: new Date().toISOString(), days } : null);
  }, [plan]);

  // Keep the latest roster, preferences and adjustments so a reload restores them
  useEffect(() => {
    saveAppState({ roster, preferences, customNudges, activePresetId, userUpdates });
  }, [roster, preferences, customNudges, activePresetId, userUpdates]);

  // A sample roster that has been edited is the user's own data from then on
  const markEdited = () => {
    setActivePresetId((id) => (presets.some((p) => p.id === id) ? 'custom-edit' : id));
  };

  /**
   * Every change to the saved roster goes through here: it is saved, logged once in history (outside any
   * state updater, so it can never be recorded twice), and the roster from just before is kept with the
   * newest entry so the change can be undone.
   */
  const commitChange = (
    next: { roster?: RosterData; updates?: UserUpdate[] },
    entry: { actionType: RosterHistoryEntry['actionType']; title: string; description?: string; changes?: HistoryDayChange[] },
    options: { undoable?: boolean } = {}
  ) => {
    const nextRoster = next.roster ?? roster;
    let nextUpdates = next.updates ?? userUpdates;
    let description = entry.description;
    // When the roster changes, the person's delays follow their flights; a delay whose flight is gone is dropped
    if (next.roster && !next.updates) {
      const { kept, dropped, confirmed } = retainUpdates(nextRoster, nextUpdates);
      nextUpdates = kept;
      if (dropped.length) {
        description = `${description ?? ''} ${dropped.length === 1 ? 'One of your updates' : `${dropped.length} of your updates`} no longer applies: what it referred to is not on the roster any more.`.trim();
      }
      if (confirmed.length) {
        description = `${description ?? ''} The roster now shows your callout${confirmed.length === 1 ? '' : 's'}, so ${confirmed.length === 1 ? 'it is' : 'they are'} part of the roster.`.trim();
      }
    }
    if (next.roster) setRoster(nextRoster);
    setUserUpdates(nextUpdates);
    planBeforeUpdate.current = { plan, title: entry.title };
    const updatedHistory = recordRosterAction({
      ...entry,
      description,
      airline: nextRoster.airline || 'Airline',
      homeBase: nextRoster.homeBase,
      flightsCount: nextRoster.flights.length,
      dateRange: nextRoster.flights.length ? computeRosterDateRange(nextRoster) : 'No flights (Resting)',
      isActive: true,
      rosterSnapshot: nextRoster,
      updatesSnapshot: nextUpdates,
      ...(options.undoable === false ? {} : { previousSnapshot: roster, previousUpdates: userUpdates }),
    });
    setHistory(updatedHistory);
  };
  const commitRoster = (next: RosterData, entry: Parameters<typeof commitChange>[1], options: { undoable?: boolean } = {}) =>
    commitChange({ roster: next }, entry, options);

  // Handle Home Base Change
  const handleChangeHomeBase = (iata: string, tzOffset: number) => {
    setPreferences((prev) => ({
      ...prev,
      homeBaseIata: iata,
      homeBaseTzOffset: tzOffset,
    }));
    markEdited();
    const updated = { ...roster, homeBase: iata, homeBaseTzOffset: tzOffset };
    // Record manual home base adjustment in history if flights exist
    if (roster.flights.length > 0) {
      commitRoster(updated, {
        actionType: 'manual_edit',
        title: `Home Base Changed to ${iata}`,
        description: `Updated crew anchor base to ${iata} (UTC${tzOffset >= 0 ? '+' : ''}${tzOffset})`,
      });
    } else {
      setRoster(updated);
    }
  };

  // Handle Preset Change
  const handleSelectPreset = (preset: RosterPreset) => {
    setActivePresetId(preset.id);
    setPreferences((prev) => ({
      ...prev,
      homeBaseIata: preset.roster.homeBase,
      homeBaseTzOffset: preset.roster.homeBaseTzOffset,
    }));
    setCustomNudges({});
    commitRoster(preset.roster, { actionType: 'preset', title: preset.name, description: preset.description });
  };

  // Handle Roster Parsed from Gemini OCR or Text Ingestion
  const handleRosterParsed = (parsedRoster: RosterData, sourceTitle?: string, customDescription?: string, update?: RosterUpdateInfo) => {
    setActivePresetId('custom-upload');
    setPreferences((prev) => ({
      ...prev,
      homeBaseIata: parsedRoster.homeBase,
      homeBaseTzOffset: parsedRoster.homeBaseTzOffset,
    }));
    // A new roster starts fresh; an update keeps the person's adjustments away from the changed days
    setCustomNudges((prev) => (update ? keepNudgesOutside(prev, update.changedDates) : {}));

    commitRoster(parsedRoster, {
      actionType: 'upload',
      title: sourceTitle || `Uploaded Roster (${parsedRoster.airline})`,
      description: customDescription || `Read ${parsedRoster.flights.length} flights from your roster`,
      changes: update?.changes,
    });
  };

  // Handle Clearing Active Roster
  const handleClearActiveRoster = () => {
    const previousFlightCount = roster.flights.length;
    const previousTitle = activePresetId.startsWith('monthly')
      ? 'Preset Schedule'
      : activePresetId === 'custom-upload'
      ? 'Uploaded File'
      : 'Active Schedule';

    const clearedRoster = createEmptyRoster(roster.homeBase, roster.homeBaseTzOffset);
    setActivePresetId('cleared');
    setCustomNudges({});
    commitRoster(clearedRoster, {
      actionType: 'cleared',
      title: 'Active Roster Cleared',
      description: `Cleared ${previousFlightCount} flights (${previousTitle}). Showing baseline circadian rest rhythm.`,
    });
  };

  // Handle Restoring Roster from History Snapshot
  const handleRestoreRoster = (entry: RosterHistoryEntry) => {
    if (!entry.rosterSnapshot) return;
    setRoster(entry.rosterSnapshot);
    setUserUpdates((prev) => retainUpdates(entry.rosterSnapshot!, prev).kept);
    setActivePresetId(`restored-${entry.id}`);
    setPreferences((prev) => ({
      ...prev,
      homeBaseIata: entry.rosterSnapshot!.homeBase,
      homeBaseTzOffset: entry.rosterSnapshot!.homeBaseTzOffset,
    }));
    setCustomNudges({});

    const updated = setActiveHistoryItem(entry.id);
    setHistory(updated);
  };

  /** Undo the newest change, while the saved roster is still exactly what that change produced. */
  const undoEntry = undoableEntry(history, roster, userUpdates);
  const handleUndoLatest = () => {
    if (!undoEntry?.previousSnapshot) return;
    const previous = undoEntry.previousSnapshot;
    setPreferences((prev) => ({ ...prev, homeBaseIata: previous.homeBase, homeBaseTzOffset: previous.homeBaseTzOffset }));
    commitChange(
      { roster: previous, updates: undoEntry.previousUpdates ?? retainUpdates(previous, userUpdates).kept },
      {
        actionType: 'undo',
        title: `Undone: ${undoEntry.title}`,
        description: undoEntry.changes?.length
          ? `Put back ${undoEntry.changes.length} ${undoEntry.changes.length === 1 ? 'day' : 'days'} as they were before.`
          : 'Put the roster back as it was before.',
      },
      { undoable: false }
    );
  };

  // Handle Adding a Manual Sector
  const handleAddManualSector = (added: FlightLeg) => {
    markEdited();
    const flight: FlightLeg = { ...added, userChange: 'added' };
    const newFlights = [...roster.flights, flight].sort(
      (a, b) => new Date(a.departureTimeUtc).getTime() - new Date(b.departureTimeUtc).getTime()
    );
    commitRoster(
      { ...roster, flights: newFlights, parsedAt: new Date().toISOString() },
      {
        actionType: 'manual_edit',
        title: `Manual Sector Added: ${flight.flightNumber}`,
        description: `${flight.flightNumber} (${flight.origin} ➔ ${flight.destination}) on ${flight.departureTimeUtc.slice(0, 10)}. Total: ${newFlights.length} sectors.`,
      }
    );
  };

  // Handle Deleting an Individual History Item
  const handleDeleteHistoryItem = (id: string) => {
    const updated = deleteRosterHistoryItem(id);
    setHistory(updated);
  };

  // Handle Clearing All History Logs
  const handleClearAllHistory = () => {
    clearRosterHistoryLogs();
    setHistory([]);
  };

  // Handle Merging Roster Snapshot from History into Continuous Timeline
  const handleMergeRosterSnapshot = (snapshot: RosterData, title: string) => {
    if (!snapshot.flights || snapshot.flights.length === 0) return;

    if (roster.flights.length === 0) {
      handleRestoreRoster({
        id: `restore-${Date.now()}`,
        timestamp: new Date().toISOString(),
        actionType: 'upload',
        title,
        airline: snapshot.airline,
        homeBase: snapshot.homeBase,
        flightsCount: snapshot.flights.length,
        isActive: true,
        rosterSnapshot: snapshot,
      });
      return;
    }

    const mergeAnalysis = analyzeRosterMerge(roster.flights, snapshot.flights);
    if (!mergeAnalysis.hasConflicts) {
      const mergedFlights = mergeAnalysis.nonConflictingMergedFlights;
      markEdited();
      commitRoster(
        { ...roster, flights: mergedFlights, parsedAt: new Date().toISOString() },
        {
          actionType: 'upload',
          title: `Merged "${title}"`,
          description: `Extended continuous timeline to ${mergedFlights.length} sectors (${mergeAnalysis.identicalCount} overlapping sectors verified, ${mergeAnalysis.newSectorsCount} new sectors added).`,
        }
      );
    }
  };

  // Tactical Duty Action 1: Cancel Sector. The person's update: the roster keeps the flight as published,
  // the plan leaves it out, and where you rest follows from your remaining duties (home or outstation).
  const handleCancelSector = (flightId: string) => {
    const cancelledFlight = roster.flights.find((f) => f.id === flightId);
    if (!cancelledFlight) {
      const callout = allFlights(roster, userUpdates).find((f) => f.id === flightId);
      if (callout) commitChange({ updates: removeCalloutFlight(userUpdates, flightId) }, { actionType: 'manual_edit', title: `Callout cancelled: ${callout.flightNumber}` });
      return;
    }
    markEdited();
    commitChange(
      { updates: cancelFlight(roster, userUpdates, flightId) },
      {
        actionType: 'manual_edit',
        title: `Cancelled: ${cancelledFlight.flightNumber}`,
        description: `You marked ${cancelledFlight.flightNumber} (${cancelledFlight.origin} ➔ ${cancelledFlight.destination}) as cancelled. The roster keeps it; your plan leaves it out.`,
      }
    );
  };

  const handleReinstateFlight = (sectorKey: string) => {
    const item = cancelledFlights(roster, userUpdates).find((c) => c.sectorKey === sectorKey);
    commitChange(
      { updates: reinstateFlight(userUpdates, sectorKey) },
      { actionType: 'manual_edit', title: `Reinstated: ${item?.flight.flightNumber ?? 'flight'}`, description: 'The flight is back in your plan as rostered.' }
    );
  };

  /**
   * Delays are the person's update, not a roster change: the rostered times (including report) stay as the
   * airline published them, and the plan uses the delayed departure, arrival and release on top.
   */
  const handleSetDelay = (flightId: string, minutes: number) => {
    const flight = allFlights(roster, userUpdates).find((f) => f.id === flightId);
    if (!flight) return;
    const next = setDelay(roster, userUpdates, flightId, minutes);
    commitChange(
      { updates: next },
      minutes > 0
        ? {
            actionType: 'manual_edit',
            title: `Delayed: ${flight.flightNumber} +${minutes} min`,
            description: `You reported ${flight.flightNumber} ${flight.origin} ➔ ${flight.destination} running ${minutes} min late. Your rostered report time is unchanged.`,
          }
        : { actionType: 'manual_edit', title: `Delay removed: ${flight.flightNumber}`, description: `${flight.flightNumber} is back on its rostered times.` }
    );
  };

  // The standby quick edits apply to: one starting within 24 hours, or in progress
  const todayStandby = standbyCandidate(roster, Date.now());

  // The flight "I'm delayed" applies to: the next one within 24 hours, or the one in progress
  const delayFlight = delayCandidate(roster, userUpdates, Date.now());

  // Tactical Duty Action 2: Delay Sector (adds to any delay already reported)
  const handleDelaySector = (flightId: string, delayMinutes: number) => {
    handleSetDelay(flightId, delayFor(userUpdates, keyOfFlight(roster, flightId, userUpdates)) + delayMinutes);
  };

  // Tactical Duty Action 3: Standby callout. It is the person's update, linked to that day's standby,
  // which then ends at the callout's report time. Without a standby that day it is still kept as a callout.
  const handleAddStandbyFlight = (calledOut: FlightLeg) => {
    markEdited();
    const sb = standbyForFlight(roster, calledOut);
    const key = sb ? keyOfStandby(roster, sb.id) : undefined;
    const existing = key ? standbyUpdate(userUpdates, key) : undefined;
    const flights = existing?.kind === 'callout' ? [...existing.flights, calledOut] : [calledOut];
    commitChange(
      { updates: addCallout(userUpdates, flights, key) },
      {
        actionType: 'manual_edit',
        title: `Called out: ${calledOut.flightNumber}`,
        description: `Called out${sb ? ' from standby' : ''} for ${calledOut.flightNumber} (${calledOut.origin} ➔ ${calledOut.destination}). Your rostered standby is kept; the plan uses the callout.`,
      }
    );
  };

  /** Standby quick edits from Today: times changed, released early (or cancelled), called out, or undo your change. */
  const handleStandbyChange = (
    standbyId: string,
    change: { kind: 'times'; startUtc: string; endUtc: string } | { kind: 'released'; atUtc: string } | { kind: 'callout'; flights: FlightLeg[] } | { kind: 'clear' }
  ) => {
    const key = keyOfStandby(roster, standbyId);
    if (!key) return;
    if (change.kind === 'times') {
      commitChange({ updates: setStandbyTimes(userUpdates, key, change.startUtc, change.endUtc) }, { actionType: 'manual_edit', title: 'Standby times changed', description: 'You changed your standby times. Your rostered standby is kept as published.' });
    } else if (change.kind === 'released') {
      commitChange({ updates: releaseStandby(userUpdates, key, change.atUtc) }, { actionType: 'manual_edit', title: 'Released from standby', description: 'You were released from standby early.' });
    } else if (change.kind === 'callout') {
      markEdited();
      commitChange(
        { updates: addCallout(userUpdates, change.flights, key) },
        { actionType: 'manual_edit', title: `Called out: ${change.flights.map((f) => f.flightNumber).join(', ')}`, description: 'Called out from standby. Your rostered standby is kept; the plan uses the callout.' }
      );
    } else {
      commitChange({ updates: clearStandbyUpdate(userUpdates, key) }, { actionType: 'manual_edit', title: 'Standby back to rostered', description: 'Your change to this standby was removed.' });
    }
  };

  // Tactical Duty Action 4: Delete Sector
  const handleDeleteSector = (flightId: string) => {
    const flight = roster.flights.find((f) => f.id === flightId);
    if (!flight) {
      const callout = allFlights(roster, userUpdates).find((f) => f.id === flightId);
      if (callout) commitChange({ updates: removeCalloutFlight(userUpdates, flightId) }, { actionType: 'manual_edit', title: `Callout removed: ${callout.flightNumber}` });
      return;
    }
    markEdited();
    const newFlights = roster.flights.filter((f) => f.id !== flightId);
    commitRoster(
      { ...roster, flights: newFlights, parsedAt: new Date().toISOString() },
      {
        actionType: 'manual_edit',
        title: `Sector Removed: ${flight.flightNumber}`,
        description: `Removed ${flight.flightNumber} from continuous schedule. Total: ${newFlights.length} sectors.`,
      }
    );
  };

  // Handle Nudging Event
  const handleNudgeEvent = (eventId: string, minutes: number) => {
    setCustomNudges((prev) => ({
      ...prev,
      [eventId]: minutes,
    }));
  };

  const viewTitles: Record<NavView, string> = {
    today: "Today",
    roster: 'Timeline',
    mastersheet: 'Month',
    salary: 'Salary estimate',
    upload: 'Upload roster',
    settings: 'Settings',
    science: 'The science',
  };

  return (
    <div className="min-h-screen bg-slate-950 font-sans text-slate-100 selection:bg-blue-600 selection:text-white flex">
      {/* 1. Left Side Menu Bar (Desktop persistent & Mobile drawer) */}
      <Sidebar
        activeView={activeView}
        onSelectView={(view) => {
          navigateTo(view);
          setIsMobileMenuOpen(false);
        }}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        plan={plan}
        isMobileOpen={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
      />

      {/* 2. Main Content Layout (Padded when sidebar is expanded/collapsed on desktop) */}
      <div
        className={`flex-1 flex flex-col min-w-0 transition-all duration-300 pb-20 lg:pb-8 ${
          isSidebarCollapsed ? 'lg:pl-18' : 'lg:pl-64'
        }`}
      >
        {/* Top Header with Body Clock Mental Anchor */}
        <Header
          plan={plan}
          onChangeHomeBase={handleChangeHomeBase}
          onOpenUploader={() => setActiveView('upload')}
          onOpenScience={() => setActiveView('science')}
          onOpenCustomizer={() => setActiveView('settings')}
          onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
          activeViewTitle={viewTitles[activeView]}
        />

        {/* Main Content Workspace per Active View */}
        <main className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 flex-1">
          {activeView === 'today' && (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-sky-900/60 bg-sky-950/20 px-3 py-2 text-xs text-sky-200">
              <span>
                {todayVersion === 'preview'
                  ? 'You are viewing the new Today (preview).'
                  : 'A redesigned Today screen is available to preview.'}
              </span>
              <button
                onClick={() => chooseTodayVersion(todayVersion === 'preview' ? 'classic' : 'preview')}
                className="rounded-lg border border-sky-700/60 bg-sky-950/60 px-3 py-1 font-bold hover:bg-sky-900/60"
              >
                {todayVersion === 'preview' ? 'Back to classic' : 'Try the new Today (preview)'}
              </button>
            </div>
          )}

          {/* What moved in the plan after the latest update (both Today versions) */}
          {activeView === 'today' && planNotice && (
            <div className="mb-4">
              <PlanChangedCard notice={planNotice} onDismiss={() => showPlanNotice(null)} />
            </div>
          )}

          {/* Quick standby edits for a standby today or in the next 24 hours (both Today versions) */}
          {activeView === 'today' && todayStandby && (
            <div className="mb-4">
              <StandbyCard roster={roster} standby={todayStandby} update={standbyUpdate(userUpdates, keyOfStandby(roster, todayStandby.id))} onChange={handleStandbyChange} />
            </div>
          )}

          {/* One-tap "I'm delayed" for the next flight (both Today versions) */}
          {activeView === 'today' && delayFlight && (
            <div className="mb-4">
              <DelayCard roster={roster} flight={delayFlight} delayMinutes={delayFor(userUpdates, keyOfFlight(roster, delayFlight.id, userUpdates))} expectedReleaseUtc={expectedDutyRelease(roster, userUpdates, delayFlight.id)} onSetDelay={handleSetDelay} />
            </div>
          )}

          {activeView === 'today' && todayVersion === 'preview' && (
            <TodayPreview
              plan={plan}
              onSelectEvent={setSelectedEvent}
              onUpdatePreferences={(updated) => setPreferences((p) => ({ ...p, ...updated }))}
              onOpenScience={() => setActiveView('science')}
              onOpenSettings={() => setActiveView('settings')}
              onOpenTimeline={() => setActiveView('roster')}
              onNavigateToUpload={() => setActiveView('upload')}
            />
          )}

          {activeView === 'today' && todayVersion === 'classic' && (
            <TodayView
              plan={plan}
              onSelectEvent={setSelectedEvent}
              onNudgeEvent={handleNudgeEvent}
              onUpdatePreferences={(updated) => setPreferences((p) => ({ ...p, ...updated }))}
              customNudges={customNudges}
              onOpenScience={() => setActiveView('science')}
              onNavigateToUpload={() => setActiveView('upload')}
            />
          )}

          {activeView === 'roster' && (
            <RosterView
              plan={plan}
              onSelectEvent={setSelectedEvent}
              onNudgeEvent={handleNudgeEvent}
              onUpdatePreferences={(updated) => setPreferences((p) => ({ ...p, ...updated }))}
              customNudges={customNudges}
              onCancelSector={handleCancelSector}
              cancelledFlights={cancelledFlights(roster, userUpdates)}
              onReinstateFlight={handleReinstateFlight}
              onDelaySector={handleDelaySector}
              onDeleteSector={handleDeleteSector}
              onAddStandbyFlight={handleAddStandbyFlight}
              initialDate={timelineJumpDate}
              onOpenMonthSummary={(dateStr) => {
                setMonthViewMonth(`${dateStr.slice(0, 7)}-01`);
                setActiveView('mastersheet');
              }}
            />
          )}

          {activeView === 'mastersheet' && (
            <MonthView
              plan={plan}
              month={monthViewMonth}
              onChangeMonth={setMonthViewMonth}
              showOriginal={monthShowOriginal}
              onShowOriginalChange={setMonthShowOriginal}
              onOpenDay={openDayInTimeline}
              onSelectEvent={setSelectedEvent}
            />
          )}

          {activeView === 'salary' && (
            <SalaryView
              plan={plan}
              onUpdatePreferences={(updated) => setPreferences((p) => ({ ...p, ...updated }))}
            />
          )}

          {activeView === 'upload' && (
            <UploadView
              currentRoster={roster}
              presets={presets}
              activePresetId={activePresetId}
              history={history}
              onSelectPreset={handleSelectPreset}
              onRosterParsed={handleRosterParsed}
              onViewRosterTimeline={() => setActiveView('roster')}
              onViewMasterSheet={() => {
                setMonthShowOriginal(true);
                setActiveView('mastersheet');
              }}
              onRestoreRoster={handleRestoreRoster}
              onClearActiveRoster={handleClearActiveRoster}
              onDeleteHistoryItem={handleDeleteHistoryItem}
              onClearAllHistory={handleClearAllHistory}
              onAddManualSector={handleAddManualSector}
              onMergeRosterSnapshot={handleMergeRosterSnapshot}
              onUndoLatest={undoEntry ? handleUndoLatest : undefined}
            />
          )}

          {activeView === 'settings' && (
            <SettingsView
              preferences={preferences}
              roster={roster}
              onUpdatePreferences={(updated) => setPreferences((p) => ({ ...p, ...updated }))}
              onChangeHomeBase={handleChangeHomeBase}
            />
          )}

          {activeView === 'science' && (
            <ScienceView
              onBackToToday={() => setActiveView('today')}
            />
          )}
        </main>

        {/* Footer */}
        <footer className="mt-auto border-t border-slate-900 bg-slate-950 py-5 text-center text-xs text-slate-500">
          <div className="mx-auto max-w-7xl px-4 space-y-1">
            <p className="font-semibold text-slate-300">
              If you feel fatigued, follow your airline's fatigue procedure, whatever this app shows.
            </p>
            <p className="text-[11px] text-slate-500 max-w-2xl mx-auto">
              CrewCircadian gives general wellness guidance. It is not a medical device, does not assess fitness for duty,
              and is not endorsed by any airline, regulator or research body.
            </p>
          </div>
        </footer>
      </div>

      {/* 3. Mobile Floating Bottom Navigation Bar (Ultra-convenient thumb reach) */}
      <div className="fixed bottom-0 left-0 right-0 z-30 lg:hidden border-t border-slate-800 bg-slate-950/95 backdrop-blur-md px-2 py-1.5 flex items-center justify-around shadow-2xl">
        {[
          { id: 'today' as NavView, label: 'Today', icon: <Clock className="h-4 w-4" /> },
          { id: 'roster' as NavView, label: 'Timeline', icon: <Calendar className="h-4 w-4" /> },
          { id: 'mastersheet' as NavView, label: 'Month', icon: <CalendarDays className="h-4 w-4" /> },
          { id: 'salary' as NavView, label: 'Salary', icon: <DollarSign className="h-4 w-4" /> },
          { id: 'upload' as NavView, label: 'Upload', icon: <UploadCloud className="h-4 w-4" /> },
        ].map((tab) => {
          const isActive = activeView === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => navigateTo(tab.id)}
              className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl text-[10px] font-bold transition-all ${
                isActive
                  ? 'text-blue-400 bg-blue-950/40 border border-blue-800/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className={isActive ? 'text-blue-400' : 'text-slate-500'}>
                {tab.icon}
              </div>
              <span className="mt-0.5">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Event Science Detail Modal */}
      <EventDetailModal
        event={selectedEvent}
        onClose={() => setSelectedEvent(null)}
        onNudge={handleNudgeEvent}
        currentNudge={selectedEvent ? customNudges[selectedEvent.id] || 0 : 0}
      />
    </div>
  );
}
