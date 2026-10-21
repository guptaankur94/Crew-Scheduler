import React, { lazy, Suspense, useState, useMemo, useEffect, useRef } from 'react';
import { CircadianEvent, CrewPreferences, RosterData, RosterHistoryEntry, FlightLeg, HistoryDayChange, UserUpdate } from './types/circadian';
import {
  addCallout,
  allFlights,
  cancelFlight,
  cancelledFlights,
  reinstateFlight,
  clearStandbyUpdate,
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
  standbyForFlight,
  standbyUpdate,
  updateLinesByDate,
  dropUpdatesOn,
} from './services/userUpdates';
import { StandbyCard } from './components/StandbyCard';
import { DayItems } from './components/DayPanel';
import { daySignature } from './services/rosterFindings';
import { flightHomeDate, rosterClock, standbyHomeDate } from './services/rosterKeys';
import { rereadAsLocal } from './services/rosterTimes';
import { normalizeDutyTimes } from './services/dutyTimes';
import { HEADS_UP_HOURS, PlanChangedCard, PlanChangeNotice } from './components/PlanChangedCard';
import { planHeadsUp } from './services/planChanges';
import { DelayCard } from './components/DelayCard';
import { getPresets, RosterPreset } from './data/rosterPresets';
import { generateCircadianPlan } from './services/circadianCalculator';
import {
  loadRosterHistory,
  recordRosterAction,
  computeRosterDateRange,
  setActiveHistoryItem,
  createEmptyRoster,
  undoableEntry,
} from './services/rosterHistoryService';
import { kv } from './services/kv';
import { keepNudgesOutside, RosterUpdateInfo } from './services/rosterDiff';
import { loadAppState, saveAppState } from './services/appStateStorage';
import { Header } from './components/Header';
import { Sidebar, NavView } from './components/Sidebar';
import { Onboarding } from './components/Onboarding';
import { planReminders } from './services/reminders';
import { syncReminders } from './services/nativeReminders';
import { listenForSharedRosters } from './services/sharedRosters';
import { updateWidget } from './services/widgetSteps';
import { syncCalendar } from './services/calendarSync';
import { TodayPreview } from './components/views/TodayPreview';

// Screens other than Today load when first opened, so the app starts with less code
const RosterView = lazy(() => import('./components/views/RosterView').then((m) => ({ default: m.RosterView })));
const MonthView = lazy(() => import('./components/views/MonthView').then((m) => ({ default: m.MonthView })));
const UploadView = lazy(() => import('./components/views/UploadView').then((m) => ({ default: m.UploadView })));
const SettingsView = lazy(() => import('./components/views/SettingsView').then((m) => ({ default: m.SettingsView })));
const ScienceView = lazy(() => import('./components/views/ScienceView').then((m) => ({ default: m.ScienceView })));
import { EventDetailModal } from './components/EventDetailModal';
import {
  Clock,
  Calendar,
  UploadCloud,
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
  
  // Navigation State: 'today' | 'roster' (Days) | 'mastersheet' (Month) | 'upload' (Rosters) | 'settings' | 'science'
  // Today now lives at the top of the Duty screen ('roster'), so 'today' opens it
  const [activeView, setActiveViewRaw] = useState<NavView>('roster');
  const setActiveView = (view: NavView) => setActiveViewRaw(view === 'today' ? 'roster' : view);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);

  // With no saved data (first visit, or after "Delete all my data") the app starts as a blank slate;
  // sample rosters are offered on the Rosters page, never loaded without asking
  const [activePresetId, setActivePresetId] = useState<string>(savedState?.activePresetId ?? 'cleared');

  // The roster as the airline published it, and the person's own updates (delays) kept apart from it.
  // Delays saved by earlier versions inside the roster are converted once here.
  // Saved rosters from earlier versions are repaired once: check-in only on the first sector of a duty and
  // debrief only on the last (they had been copied onto every sector)
  const initial = useMemo(() => {
    const startRoster = savedPreset ? savedPreset.roster : savedState?.roster ?? createEmptyRoster(DEFAULT_PREFERENCES.homeBaseIata, DEFAULT_PREFERENCES.homeBaseTzOffset);
    const migrated = migrateLegacyDelays(startRoster, savedState?.userUpdates ?? []);
    const flights = normalizeDutyTimes(migrated.roster.flights);
    // Only changed check-in or debrief times count as a repair; adding each flight's duty check-in (which day the
    // duty belongs to) happens quietly
    const old = migrated.roster.flights;
    const repaired = flights.filter((f, i) => f.reportTimeUtc !== old[i].reportTimeUtc || f.releaseTimeUtc !== old[i].releaseTimeUtc).length;
    return { ...migrated, roster: flights === old ? migrated.roster : { ...migrated.roster, flights }, repaired };
  }, []);
  const [roster, setRoster] = useState<RosterData>(initial.roster);
  const [userUpdates, setUserUpdates] = useState<UserUpdate[]>(initial.updates);
  // Record the one-time repair in history once (a ref guards against React running effects twice in development)
  const repairLogged = useRef(false);
  useEffect(() => {
    // Only the person's own saved roster (not a sample) gets the note
    if (!initial.repaired || repairLogged.current || !savedState || savedPreset || presets.some((p) => p.id === savedState.activePresetId)) return;
    repairLogged.current = true;
    setHistory(
      recordRosterAction({
        actionType: 'manual_edit',
        title: 'Fixed check-in and debrief times',
        description: `${initial.repaired} sectors in the middle of a duty had the duty's check-in or debrief copied onto them. Check-in now belongs to the first sector of each duty and debrief to the last.`,
        airline: initial.roster.airline || 'Airline',
        homeBase: initial.roster.homeBase,
        flightsCount: initial.roster.flights.length,
        dateRange: computeRosterDateRange(initial.roster),
        isActive: true,
        rosterSnapshot: initial.roster,
      })
    );
  }, []);

  // Days checked on the Month screen (a tick is kept only while the day's entries stay the same)
  const [checkedDays, setCheckedDays] = useState<Record<string, string>>(savedState?.checkedDays ?? {});

  // Roster Upload & Audit History State
  const [history, setHistory] = useState<RosterHistoryEntry[]>(() => {
    const loaded = loadRosterHistory();
    if (loaded && loaded.length > 0) return loaded;
    
    // A fresh start has no history: nothing has happened yet
    return [];
  });

  // A first visit (or after "Delete all my data") starts with the welcome steps
  const [preferences, setPreferences] = useState<CrewPreferences>(savedState?.preferences ?? { ...DEFAULT_PREFERENCES, onboarding: 'pending' });

  const [customNudges, setCustomNudges] = useState<Record<string, number>>(
    savedPreset ? {} : savedState?.customNudges ?? {}
  );
  // Date to open when jumping from the Month screen into the timeline
  const [timelineJumpDate, setTimelineJumpDate] = useState<string | undefined>(undefined);
  // Month shown on the Month screen (YYYY-MM-01); starts on the current month
  // Open the Month screen straight on the full roster table (from the upload screen's check button)
  const [monthViewMonth, setMonthViewMonth] = useState<string>(() => `${new Date().toISOString().slice(0, 7)}-01`);
  /** Opens a day in the Timeline. */
  const openDayInTimeline = (dateStr: string) => {
    setTimelineJumpDate(dateStr);
    setActiveView('roster');
  };
  /** Switches screens from the menu or tab bar; the Timeline then opens on today. */
  const navigateTo = (view: NavView) => {
    if (view === 'roster' || view === 'today') setTimelineJumpDate(undefined);
    setActiveView(view);
  };
  const [selectedEvent, setSelectedEvent] = useState<CircadianEvent | null>(null);
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
      const raw = kv.getItem('crew_plan_notice_v1');
      const saved = raw ? JSON.parse(raw) : null;
      // Only a current heads-up (one sentence, under a day old) is shown
      return saved && typeof saved.sentence === 'string' && Date.now() - Date.parse(saved.at) < HEADS_UP_HOURS * 3600000 ? saved : null;
    } catch {
      return null;
    }
  });
  const showPlanNotice = (notice: PlanChangeNotice | null) => {
    setPlanNotice(notice);
    try {
      if (notice) kv.setItem('crew_plan_notice_v1', JSON.stringify(notice));
      else kv.removeItem('crew_plan_notice_v1');
    } catch {
      // Not remembered: the notice simply disappears on reload
    }
  };
  useEffect(() => {
    const pending = planBeforeUpdate.current;
    if (!pending) return;
    planBeforeUpdate.current = null;
    const sentence = planHeadsUp(pending.plan, plan, Date.now());
    showPlanNotice(sentence ? { title: pending.title, at: new Date().toISOString(), sentence } : null);
  }, [plan]);

  // Keep the latest roster, preferences and adjustments so a reload restores them
  useEffect(() => {
    saveAppState({ roster, preferences, customNudges, activePresetId, userUpdates, checkedDays });
  }, [roster, preferences, customNudges, activePresetId, userUpdates, checkedDays]);

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
    // Every saved roster keeps check-in on the first sector of a duty and debrief on the last (see dutyTimes)
    const nextRoster = next.roster ? { ...next.roster, flights: normalizeDutyTimes(next.roster.flights) } : roster;
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
  /** Leaves the sample: a blank slate until the person uploads their own roster. */
  const handleRemoveSample = () => {
    setActivePresetId('cleared');
    setCustomNudges({});
    commitRoster(createEmptyRoster(roster.homeBase, roster.homeBaseTzOffset), { actionType: 'cleared', title: 'Sample roster removed' }, { undoable: true });
  };

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

    // Restoring an upload with "also clear my updates": the person's updates on those dates go too
    const updates = update?.clearUpdatesOn ? dropUpdatesOn(parsedRoster, retainUpdates(parsedRoster, userUpdates).kept, update.clearUpdatesOn) : undefined;
    commitChange({ roster: parsedRoster, ...(updates ? { updates } : {}) }, {
      actionType: 'upload',
      title: sourceTitle || `Uploaded Roster (${parsedRoster.airline})`,
      description: customDescription || `Read ${parsedRoster.flights.length} flights from your roster`,
      changes: update?.changes,
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

  // Duty-limit check: the roster as published plus recorded callouts, cancellations and standby changes (not delays)
  const limitsRoster = useMemo(() => effectiveRoster(roster, userUpdates.filter((u) => u.kind !== 'delay')), [roster, userUpdates]);

  // Called out on a day with no standby (the standby card handles callouts from a standby). It is the person's
  // update; if the day does have a standby after all, the callout is linked to it.
  const handleCallout = (flights: FlightLeg[]) => {
    if (!flights.length) return;
    markEdited();
    const sb = standbyForFlight(roster, flights[0]);
    const key = sb ? keyOfStandby(roster, sb.id) : undefined;
    commitChange(
      { updates: addCallout(userUpdates, flights, key) },
      {
        actionType: 'manual_edit',
        title: `Called out: ${flights.map((f) => f.flightNumber).join(', ')}`,
        description: `Called out${sb ? ' from standby' : ''} for ${flights.map((f) => `${f.flightNumber} (${f.origin} ➔ ${f.destination})`).join(', ')}. The plan uses the callout.`,
      }
    );
  };

  /** Standby edits from the Timeline: times changed, released early (or cancelled), called out, or undo your change. */
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

  /**
   * Month screen corrections: the person fixes what the app read for one day (flights, standby, kind of day).
   * A correction changes the roster itself (it was a reading mistake), is marked as corrected by the person,
   * and is saved with history and Undo like any other change.
   */
  const handleCorrectDay = (date: string, next: DayItems) => {
    const clock = rosterClock(roster);
    const onDay = (d: string) => d === date;
    const before = {
      flights: roster.flights.filter((f) => onDay(flightHomeDate(f, clock))),
      standby: (roster.standbyDuties ?? []).filter((s) => onDay(standbyHomeDate(s, clock))),
    };
    const lines = [
      ...before.flights.filter((f) => !next.flights.includes(f)).map((f) => `${f.flightNumber} ${f.origin}→${f.destination} ${clock.time(Date.parse(f.departureTimeUtc))} removed`),
      ...next.flights.filter((f) => !before.flights.includes(f)).map((f) => `${f.flightNumber} ${f.origin}→${f.destination} ${clock.time(Date.parse(f.departureTimeUtc))}`),
      ...(next.standby.length !== before.standby.length || next.standby.some((s) => !before.standby.includes(s)) ? ['Standby corrected'] : []),
    ];
    markEdited();
    commitRoster(
      {
        ...roster,
        flights: [...roster.flights.filter((f) => !onDay(flightHomeDate(f, clock))), ...next.flights].sort((a, b) => a.departureTimeUtc.localeCompare(b.departureTimeUtc)),
        standbyDuties: [...(roster.standbyDuties ?? []).filter((s) => !onDay(standbyHomeDate(s, clock))), ...next.standby].sort((a, b) => a.startUtc.localeCompare(b.startUtc)),
        otherDuties: [...(roster.otherDuties ?? []).filter((d) => d.date !== date), ...next.otherDuties].sort((a, b) => a.date.localeCompare(b.date)),
        parsedAt: new Date().toISOString(),
      },
      { actionType: 'manual_edit', title: `Corrected ${new Date(`${date}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })}`, description: 'You corrected what the app read for this day.', changes: [{ date, label: 'Corrected by you', lines: lines.length ? lines : ['Day corrected'] }] }
    );
  };

  /** One-tap fix from the Month screen: read an airport's times as its local time (e.g. Singapore). */
  const handleApplyFix = (fix: { kind: 'reread_local'; airport: string; flightIds: string[] }) => {
    const ids = new Set(fix.flightIds);
    const flights = roster.flights.map((f) => (ids.has(f.id) ? { ...rereadAsLocal(f, roster.homeBase), correctedByUser: true } : f));
    markEdited();
    commitRoster(
      { ...roster, flights, parsedAt: new Date().toISOString() },
      { actionType: 'manual_edit', title: `Read ${fix.airport} times as local time`, description: `${fix.flightIds.length} flight times at ${fix.airport} were re-read in ${fix.airport} local time.` }
    );
  };

  const handleToggleChecked = (date: string, checked: boolean) => {
    setCheckedDays((prev) => {
      const next = { ...prev };
      if (checked) next[date] = daySignature(roster, date);
      else delete next[date];
      return next;
    });
  };

  // Handle Nudging Event
  const handleNudgeEvent = (eventId: string, minutes: number) => {
    setCustomNudges((prev) => ({
      ...prev,
      [eventId]: minutes,
    }));
  };

  // Phone app: keep the phone's reminders and the home-screen widget in step with the plan (re-planned whenever the plan or choices change)
  useEffect(() => {
    const timer = setTimeout(() => {
      void syncReminders(planReminders(plan, preferences.reminders ?? {}, Date.now())).catch(() => {});
      void updateWidget(plan, Date.now());
      void syncCalendar(plan, !!preferences.calendarSync);
    }, 1500);
    return () => clearTimeout(timer);
  }, [plan, preferences.reminders, preferences.calendarSync]);

  // Roster files shared from another app open on the Rosters page
  const [sharedFiles, setSharedFiles] = useState<File[] | undefined>(undefined);
  useEffect(() => {
    let stop: (() => void) | undefined;
    void listenForSharedRosters((files) => {
      setSharedFiles(files);
      setActiveView('upload');
    }).then((s) => (stop = s));
    return () => stop?.();
  }, []);

  const viewTitles: Record<NavView, string> = {
    today: "Today",
    roster: 'Days',
    mastersheet: 'Month',
    upload: 'Rosters',
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
        className={`flex-1 flex flex-col min-w-0 transition-all duration-300 pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-8 ${
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

        {preferences.onboarding === 'pending' && (
          <Onboarding
            preferences={preferences}
            onUpdatePreferences={(updated) => setPreferences((p) => ({ ...p, ...updated }))}
            onChangeHomeBase={handleChangeHomeBase}
            onFinish={(next) => navigateTo(next)}
          />
        )}

        {/* Main Content Workspace per Active View */}
        <main className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 flex-1">
          <Suspense fallback={<p className="py-10 text-center text-sm text-slate-500">Loading…</p>}>
          {/* A sample roster is never mistaken for the person's own */}
          {presets.some((p) => p.id === activePresetId) && (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-xs text-slate-300">
              <span>You're viewing a sample roster, not your own.</span>
              <span className="flex gap-3">
                <button onClick={() => navigateTo('upload')} className="font-semibold text-blue-300 hover:text-white">
                  Upload yours
                </button>
                <button onClick={handleRemoveSample} className="font-semibold text-slate-400 hover:text-white">
                  Remove sample
                </button>
              </span>
            </div>
          )}
          {/* What moved in the plan after the latest update */}
          {activeView === 'roster' && planNotice && Date.now() - Date.parse(planNotice.at) < HEADS_UP_HOURS * 3600000 && (
            <div className="mb-4">
              <PlanChangedCard notice={planNotice} onDismiss={() => showPlanNotice(null)} />
            </div>
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
              onDeleteSector={handleDeleteSector}
              onCallout={handleCallout}
              onOpenSettings={() => setActiveView('settings')}
              renderStandbyEdit={(dateStr, standbyEvents) => {
                const clock = rosterClock(roster);
                return (roster.standbyDuties ?? [])
                  .filter((s) => standbyHomeDate(s, clock) === dateStr)
                  .map((s) => {
                    const event = standbyEvents.find((e) => e.id === `standby-${s.id}`);
                    return (
                      <StandbyCard
                        key={s.id}
                        roster={roster}
                        standby={s}
                        update={standbyUpdate(userUpdates, keyOfStandby(roster, s.id))}
                        onChange={handleStandbyChange}
                        advice={event?.subtitle}
                        onWhy={event ? () => setSelectedEvent(event) : undefined}
                      />
                    );
                  });
              }}
              renderDelayEdit={(flightId) => {
                const flight = allFlights(roster, userUpdates).find((f) => f.id === flightId);
                return flight ? (
                  <DelayCard roster={roster} flight={flight} delayMinutes={delayFor(userUpdates, keyOfFlight(roster, flight.id, userUpdates))} expectedReleaseUtc={expectedDutyRelease(roster, userUpdates, flight.id)} onSetDelay={handleSetDelay} />
                ) : null;
              }}
              initialDate={timelineJumpDate}
              renderToday={(openDate) => (
                <TodayPreview
                  asHeader
                  plan={plan}
                  onSelectEvent={setSelectedEvent}
                  onUpdatePreferences={(updated) => setPreferences((p) => ({ ...p, ...updated }))}
                  onOpenScience={() => setActiveView('science')}
                  onOpenSettings={() => setActiveView('settings')}
                  onOpenTimeline={() => undefined}
                  onOpenDate={openDate}
                  onNavigateToUpload={() => setActiveView('upload')}
                />
              )}
              onOpenMonthSummary={(dateStr) => {
                setMonthViewMonth(`${dateStr.slice(0, 7)}-01`);
                setActiveView('mastersheet');
              }}
            />
          )}

          {activeView === 'mastersheet' && (
            <MonthView
              plan={plan}
              onUpdatePreferences={(updated) => setPreferences((p) => ({ ...p, ...updated }))}
              month={monthViewMonth}
              onChangeMonth={setMonthViewMonth}
              limitsRoster={limitsRoster}
              roster={roster}
              timeConvention={preferences.rosterTimeConvention ?? 'local'}
              checkedDays={checkedDays}
              onToggleChecked={handleToggleChecked}
              onCorrectDay={handleCorrectDay}
              onApplyFix={handleApplyFix}
              updateLines={updateLinesByDate(roster, userUpdates)}
              onOpenDay={openDayInTimeline}
              onSelectEvent={setSelectedEvent}
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
              onViewMasterSheet={() => navigateTo('mastersheet')}
              incomingFiles={sharedFiles}
              onIncomingFilesTaken={() => setSharedFiles(undefined)}
              onUndoLatest={undoEntry ? handleUndoLatest : undefined}
              timeConvention={preferences.rosterTimeConvention ?? 'local'}
              onTimeConventionChosen={(c) => setPreferences((p) => ({ ...p, rosterTimeConvention: c }))}
            />
          )}

          {activeView === 'settings' && (
            <SettingsView
              preferences={preferences}
              roster={roster}
              onUpdatePreferences={(updated) => setPreferences((p) => ({ ...p, ...updated }))}
              onChangeHomeBase={handleChangeHomeBase}
              history={history}
              onUndoLatest={undoEntry ? handleUndoLatest : undefined}
              onRestoreHistoryEntry={handleRestoreRoster}
              plan={plan}
            />
          )}

          {activeView === 'science' && (
            <ScienceView
              onBackToToday={() => setActiveView('today')}
            />
          )}
          </Suspense>
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
      <div className="fixed bottom-0 left-0 right-0 z-30 lg:hidden border-t border-slate-800 bg-slate-950/95 backdrop-blur-md px-2 pt-1.5 pb-[calc(0.375rem+env(safe-area-inset-bottom))] flex items-center justify-around shadow-2xl">
        {[
          { id: 'roster' as NavView, label: 'Duty', icon: <Clock className="h-4 w-4" /> },
          { id: 'mastersheet' as NavView, label: 'Month', icon: <CalendarDays className="h-4 w-4" /> },
          { id: 'upload' as NavView, label: 'Rosters', icon: <UploadCloud className="h-4 w-4" /> },
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
