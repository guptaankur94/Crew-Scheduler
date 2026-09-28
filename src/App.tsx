import React, { useState, useMemo, useEffect } from 'react';
import { CircadianEvent, CrewPreferences, RosterData, RosterHistoryEntry, FlightLeg } from './types/circadian';
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
} from './services/rosterHistoryService';
import { analyzeRosterMerge, resolveAndMergeFlights } from './services/rosterMerger';
import { Header } from './components/Header';
import { Sidebar, NavView } from './components/Sidebar';
import { TodayView } from './components/views/TodayView';
import { RosterView } from './components/views/RosterView';
import { SalaryView } from './components/views/SalaryView';
import { UploadView } from './components/views/UploadView';
import { SettingsView } from './components/views/SettingsView';
import { ScienceView } from './components/views/ScienceView';
import { EventDetailModal } from './components/EventDetailModal';
import {
  Clock,
  Calendar,
  DollarSign,
  UploadCloud,
  Sliders,
} from 'lucide-react';

export default function App() {
  const presets = useMemo(() => getPresets(), []);
  
  // Navigation State: 'today' | 'roster' | 'salary' | 'upload' | 'settings' | 'science'
  const [activeView, setActiveView] = useState<NavView>('today');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);

  // Default to 30-day full monthly roster
  const [activePresetId, setActivePresetId] = useState<string>('monthly-30day-roster');
  
  const [roster, setRoster] = useState<RosterData>(() => {
    return presets[0].roster;
  });

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

  const [preferences, setPreferences] = useState<CrewPreferences>({
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
  });

  const [customNudges, setCustomNudges] = useState<Record<string, number>>({});
  const [selectedEvent, setSelectedEvent] = useState<CircadianEvent | null>(null);

  // Generate reactive Circadian Plan whenever roster, preferences, or nudges change
  const plan = useMemo(() => {
    return generateCircadianPlan(roster, preferences, customNudges);
  }, [roster, preferences, customNudges]);

  // Handle Home Base Change
  const handleChangeHomeBase = (iata: string, tzOffset: number) => {
    setPreferences((prev) => ({
      ...prev,
      homeBaseIata: iata,
      homeBaseTzOffset: tzOffset,
    }));
    setRoster((prev) => {
      const updated = {
        ...prev,
        homeBase: iata,
        homeBaseTzOffset: tzOffset,
      };
      // Record manual home base adjustment in history if flights exist
      if (prev.flights.length > 0) {
        const updatedHist = recordRosterAction({
          actionType: 'manual_edit',
          title: `Home Base Changed to ${iata}`,
          description: `Updated crew anchor base to ${iata} (UTC${tzOffset >= 0 ? '+' : ''}${tzOffset})`,
          airline: prev.airline,
          homeBase: iata,
          flightsCount: prev.flights.length,
          dateRange: computeRosterDateRange(prev),
          isActive: true,
          rosterSnapshot: updated,
        });
        setHistory(updatedHist);
      }
      return updated;
    });
  };

  // Handle Preset Change
  const handleSelectPreset = (preset: RosterPreset) => {
    setActivePresetId(preset.id);
    setRoster(preset.roster);
    setPreferences((prev) => ({
      ...prev,
      homeBaseIata: preset.roster.homeBase,
      homeBaseTzOffset: preset.roster.homeBaseTzOffset,
    }));
    setCustomNudges({});

    // Record preset action in audit history
    const updatedHistory = recordRosterAction({
      actionType: 'preset',
      title: preset.name,
      description: preset.description,
      airline: preset.roster.airline,
      homeBase: preset.roster.homeBase,
      flightsCount: preset.roster.flights.length,
      dateRange: computeRosterDateRange(preset.roster),
      isActive: true,
      rosterSnapshot: preset.roster,
    });
    setHistory(updatedHistory);
  };

  // Handle Roster Parsed from Gemini OCR or Text Ingestion
  const handleRosterParsed = (parsedRoster: RosterData, sourceTitle?: string, customDescription?: string) => {
    setRoster(parsedRoster);
    setActivePresetId('custom-upload');
    setPreferences((prev) => ({
      ...prev,
      homeBaseIata: parsedRoster.homeBase,
      homeBaseTzOffset: parsedRoster.homeBaseTzOffset,
    }));
    setCustomNudges({});

    // Record upload action in audit history
    const title = sourceTitle || `Uploaded Roster (${parsedRoster.airline})`;
    const updatedHistory = recordRosterAction({
      actionType: 'upload',
      title,
      description: customDescription || `Extracted ${parsedRoster.flights.length} flight legs via Gemini Aero-OCR`,
      airline: parsedRoster.airline || 'Airline',
      homeBase: parsedRoster.homeBase || 'DEL',
      flightsCount: parsedRoster.flights.length,
      dateRange: computeRosterDateRange(parsedRoster),
      isActive: true,
      rosterSnapshot: parsedRoster,
    });
    setHistory(updatedHistory);
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
    setRoster(clearedRoster);
    setActivePresetId('cleared');
    setCustomNudges({});

    // Record clear action in audit history
    const updatedHistory = recordRosterAction({
      actionType: 'cleared',
      title: 'Active Roster Cleared',
      description: `Cleared ${previousFlightCount} flights (${previousTitle}). Showing baseline circadian rest rhythm.`,
      airline: roster.airline || 'None',
      homeBase: roster.homeBase,
      flightsCount: 0,
      dateRange: 'No flights (Resting)',
      isActive: true,
      rosterSnapshot: clearedRoster,
    });
    setHistory(updatedHistory);
  };

  // Handle Restoring Roster from History Snapshot
  const handleRestoreRoster = (entry: RosterHistoryEntry) => {
    if (!entry.rosterSnapshot) return;
    setRoster(entry.rosterSnapshot);
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

  // Handle Adding a Manual Sector
  const handleAddManualSector = (flight: FlightLeg) => {
    setRoster((prev) => {
      const newFlights = [...prev.flights, flight].sort(
        (a, b) => new Date(a.departureTimeUtc).getTime() - new Date(b.departureTimeUtc).getTime()
      );
      const updatedRoster: RosterData = {
        ...prev,
        flights: newFlights,
        parsedAt: new Date().toISOString(),
      };

      const updatedHistory = recordRosterAction({
        actionType: 'manual_edit',
        title: `Manual Sector Added: ${flight.flightNumber}`,
        description: `${flight.flightNumber} (${flight.origin} ➔ ${flight.destination}) on ${flight.departureTimeUtc.slice(0, 10)}. Total: ${newFlights.length} sectors.`,
        airline: prev.airline,
        homeBase: prev.homeBase,
        flightsCount: newFlights.length,
        dateRange: computeRosterDateRange(updatedRoster),
        isActive: true,
        rosterSnapshot: updatedRoster,
      });
      setHistory(updatedHistory);

      return updatedRoster;
    });
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
      const updatedRoster: RosterData = {
        ...roster,
        flights: mergedFlights,
        parsedAt: new Date().toISOString(),
      };
      setRoster(updatedRoster);

      const updatedHistory = recordRosterAction({
        actionType: 'upload',
        title: `Merged "${title}"`,
        description: `Extended continuous timeline to ${mergedFlights.length} sectors (${mergeAnalysis.identicalCount} overlapping sectors verified, ${mergeAnalysis.newSectorsCount} new sectors added).`,
        airline: roster.airline,
        homeBase: roster.homeBase,
        flightsCount: mergedFlights.length,
        dateRange: computeRosterDateRange(updatedRoster),
        isActive: true,
        rosterSnapshot: updatedRoster,
      });
      setHistory(updatedHistory);
    }
  };

  // Tactical Duty Action 1: Cancel Sector
  const handleCancelSector = (flightId: string, convertToLayover: boolean) => {
    setRoster((prev) => {
      const cancelledFlight = prev.flights.find((f) => f.id === flightId);
      if (!cancelledFlight) return prev;

      const newFlights = prev.flights.filter((f) => f.id !== flightId);
      const newLayovers = [...(prev.layovers || [])];

      if (convertToLayover) {
        const stationIata = cancelledFlight.origin;
        const depMs = new Date(cancelledFlight.departureTimeUtc).getTime();
        newLayovers.push({
          id: `layover-cancelled-${Date.now()}`,
          airport: stationIata,
          city: cancelledFlight.originCity || stationIata,
          tzOffset: cancelledFlight.originTzOffset,
          startUtc: cancelledFlight.departureTimeUtc,
          endUtc: new Date(depMs + 24 * 3600000).toISOString(),
          durationHours: 24,
          strategy: 'transition',
        });
      }

      const updatedRoster: RosterData = {
        ...prev,
        flights: newFlights,
        layovers: newLayovers,
        parsedAt: new Date().toISOString(),
      };

      const updatedHistory = recordRosterAction({
        actionType: 'manual_edit',
        title: `Sector Cancelled: ${cancelledFlight.flightNumber}`,
        description: convertToLayover
          ? `Cancelled ${cancelledFlight.flightNumber} and converted to Station Layover at ${cancelledFlight.origin}. Continuous timeline recalculated.`
          : `Cancelled ${cancelledFlight.flightNumber} (${cancelledFlight.origin} ➔ ${cancelledFlight.destination}). Returned to base rest rhythm.`,
        airline: prev.airline,
        homeBase: prev.homeBase,
        flightsCount: newFlights.length,
        dateRange: computeRosterDateRange(updatedRoster),
        isActive: true,
        rosterSnapshot: updatedRoster,
      });
      setHistory(updatedHistory);

      return updatedRoster;
    });
  };

  // Tactical Duty Action 2: Delay Sector
  const handleDelaySector = (flightId: string, delayMinutes: number) => {
    setRoster((prev) => {
      const flight = prev.flights.find((f) => f.id === flightId);
      if (!flight) return prev;

      const delayMs = delayMinutes * 60000;
      const newDepUtc = new Date(new Date(flight.departureTimeUtc).getTime() + delayMs).toISOString();
      const newArrUtc = new Date(new Date(flight.arrivalTimeUtc).getTime() + delayMs).toISOString();
      const newRepUtc = new Date(new Date(flight.reportTimeUtc).getTime() + delayMs).toISOString();
      const newRelUtc = new Date(new Date(flight.releaseTimeUtc).getTime() + delayMs).toISOString();

      const newFlights = prev.flights.map((f) =>
        f.id === flightId
          ? {
              ...f,
              departureTimeUtc: newDepUtc,
              arrivalTimeUtc: newArrUtc,
              reportTimeUtc: newRepUtc,
              releaseTimeUtc: newRelUtc,
            }
          : f
      );

      const updatedRoster: RosterData = {
        ...prev,
        flights: newFlights,
        parsedAt: new Date().toISOString(),
      };

      const updatedHistory = recordRosterAction({
        actionType: 'manual_edit',
        title: `Delayed Sector: ${flight.flightNumber} (+${delayMinutes}m)`,
        description: `Adjusted departure to ${new Date(newDepUtc).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. Sleep buffers and circadian limits updated.`,
        airline: prev.airline,
        homeBase: prev.homeBase,
        flightsCount: newFlights.length,
        dateRange: computeRosterDateRange(updatedRoster),
        isActive: true,
        rosterSnapshot: updatedRoster,
      });
      setHistory(updatedHistory);

      return updatedRoster;
    });
  };

  // Tactical Duty Action 3: Add Standby Callout Flight
  const handleAddStandbyFlight = (newFlight: FlightLeg) => {
    setRoster((prev) => {
      const newFlights = [...prev.flights, newFlight].sort(
        (a, b) => new Date(a.departureTimeUtc).getTime() - new Date(b.departureTimeUtc).getTime()
      );
      const updatedRoster: RosterData = {
        ...prev,
        flights: newFlights,
        parsedAt: new Date().toISOString(),
      };

      const updatedHistory = recordRosterAction({
        actionType: 'manual_edit',
        title: `Standby Callout: ${newFlight.flightNumber}`,
        description: `Called out for flight ${newFlight.flightNumber} (${newFlight.origin} ➔ ${newFlight.destination}) on ${newFlight.departureTimeUtc.slice(0, 10)}. Flying pay and rest buffers updated.`,
        airline: prev.airline,
        homeBase: prev.homeBase,
        flightsCount: newFlights.length,
        dateRange: computeRosterDateRange(updatedRoster),
        isActive: true,
        rosterSnapshot: updatedRoster,
      });
      setHistory(updatedHistory);

      return updatedRoster;
    });
  };

  // Tactical Duty Action 4: Delete Sector
  const handleDeleteSector = (flightId: string) => {
    setRoster((prev) => {
      const flight = prev.flights.find((f) => f.id === flightId);
      if (!flight) return prev;

      const newFlights = prev.flights.filter((f) => f.id !== flightId);
      const updatedRoster: RosterData = {
        ...prev,
        flights: newFlights,
        parsedAt: new Date().toISOString(),
      };

      const updatedHistory = recordRosterAction({
        actionType: 'manual_edit',
        title: `Sector Removed: ${flight.flightNumber}`,
        description: `Removed ${flight.flightNumber} from continuous schedule. Total: ${newFlights.length} sectors.`,
        airline: prev.airline,
        homeBase: prev.homeBase,
        flightsCount: newFlights.length,
        dateRange: computeRosterDateRange(updatedRoster),
        isActive: true,
        rosterSnapshot: updatedRoster,
      });
      setHistory(updatedHistory);

      return updatedRoster;
    });
  };

  // Handle Nudging Event
  const handleNudgeEvent = (eventId: string, minutes: number) => {
    setCustomNudges((prev) => ({
      ...prev,
      [eventId]: minutes,
    }));
  };

  const viewTitles: Record<NavView, string> = {
    today: "Today's Duty & Runway",
    roster: 'Monthly Roster & Sectors',
    salary: 'Salary & Payslip Studio',
    upload: 'Roster Ingestion Hub',
    settings: 'Buffers & Circadian Preferences',
    science: 'Aero-Medical Science Lab',
  };

  return (
    <div className="min-h-screen bg-slate-950 font-sans text-slate-100 selection:bg-blue-600 selection:text-white flex">
      {/* 1. Left Side Menu Bar (Desktop persistent & Mobile drawer) */}
      <Sidebar
        activeView={activeView}
        onSelectView={(view) => {
          setActiveView(view);
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
              onDelaySector={handleDelaySector}
              onDeleteSector={handleDeleteSector}
              onAddStandbyFlight={handleAddStandbyFlight}
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
              onRestoreRoster={handleRestoreRoster}
              onClearActiveRoster={handleClearActiveRoster}
              onDeleteHistoryItem={handleDeleteHistoryItem}
              onClearAllHistory={handleClearAllHistory}
              onAddManualSector={handleAddManualSector}
              onMergeRosterSnapshot={handleMergeRosterSnapshot}
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
            <p className="font-semibold text-slate-400">
              CrewCircadian • Cabin Crew Rest & Chrono-Nutrition System
            </p>
            <p className="text-[11px] text-slate-500 max-w-2xl mx-auto">
              Clinical rules based on NASA Ames Fatigue Countermeasures, ICAO Doc 9966, and Salk Institute Chrono-Nutrition research.
            </p>
          </div>
        </footer>
      </div>

      {/* 3. Mobile Floating Bottom Navigation Bar (Ultra-convenient thumb reach) */}
      <div className="fixed bottom-0 left-0 right-0 z-30 lg:hidden border-t border-slate-800 bg-slate-950/95 backdrop-blur-md px-2 py-1.5 flex items-center justify-around shadow-2xl">
        {[
          { id: 'today' as NavView, label: 'Today', icon: <Clock className="h-4 w-4" /> },
          { id: 'roster' as NavView, label: 'Roster', icon: <Calendar className="h-4 w-4" /> },
          { id: 'salary' as NavView, label: 'Salary', icon: <DollarSign className="h-4 w-4" /> },
          { id: 'upload' as NavView, label: 'Upload', icon: <UploadCloud className="h-4 w-4" /> },
          { id: 'settings' as NavView, label: 'Buffers', icon: <Sliders className="h-4 w-4" /> },
        ].map((tab) => {
          const isActive = activeView === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveView(tab.id)}
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
