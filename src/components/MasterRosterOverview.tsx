import React, { useState, useMemo, useRef } from 'react';
import {
  CircadianPlan,
  FlightLeg,
  DailyCircadianSummary,
  CircadianEvent,
} from '../types/circadian';
import {
  formatAviationDate,
  formatAviationDateRange,
  calculateDebriefEndTime,
} from '../utils/dateUtils';
import { AIRPORTS } from '../data/airports';
import {
  Calendar,
  Search,
  CheckCircle2,
  AlertTriangle,
  Plane,
  Moon,
  Clock,
  Filter,
  ArrowRight,
  Split,
  Eye,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize2,
  FileText,
  FileCheck,
  Download,
  Printer,
  ChevronRight,
  ShieldCheck,
  Check,
  SlidersHorizontal,
  X,
  Sparkles,
} from 'lucide-react';

interface MasterRosterOverviewProps {
  plan: CircadianPlan;
  onJumpToTimeline?: (dateStr: string) => void;
  onSelectEvent?: (event: CircadianEvent) => void;
  initialSplitScreen?: boolean;
}

export const MasterRosterOverview: React.FC<MasterRosterOverviewProps> = ({
  plan,
  onJumpToTimeline,
  onSelectEvent,
  initialSplitScreen = false,
}) => {
  const { roster, dailySummaries, monthlyStats, preferences } = plan;

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'flight' | 'off' | 'redeye' | 'layover'>('all');

  // Split-Screen & Verification Mode State
  const [isSplitScreen, setIsSplitScreen] = useState(initialSplitScreen);
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [verifiedSectors, setVerifiedSectors] = useState<Record<string, boolean>>({});
  const [selectedFlightId, setSelectedFlightId] = useState<string | null>(null);

  // Custom preview document state (uses roster source document or sample airline schedule mockup)
  const [customDocumentUrl, setCustomDocumentUrl] = useState<string | null>(
    roster.sourceDocumentUrl || null
  );
  const [customDocumentName, setCustomDocumentName] = useState<string>(
    roster.sourceDocumentName || 'AIMS_Master_Roster_Sheet.pdf'
  );
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Extract distinct months from the dailySummaries
  const availableMonths = useMemo(() => {
    const set = new Map<string, string>();
    dailySummaries.forEach((d) => {
      const key = d.dateStr.slice(0, 7); // '2026-09'
      if (!set.has(key)) {
        const dateObj = new Date(`${d.dateStr}T12:00:00Z`);
        const label = dateObj.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        set.set(key, label);
      }
    });
    return Array.from(set.entries()).map(([key, label]) => ({ key, label }));
  }, [dailySummaries]);

  // Group flights by day
  const dailyDutyRows = useMemo(() => {
    return dailySummaries.map((summary) => {
      const flightsOnDay = roster.flights.filter((f) =>
        f.departureTimeUtc.startsWith(summary.dateStr)
      );

      const hasRedEye = flightsOnDay.some(
        (f) => f.isRedEye || summary.woclExposureMinutes > 0
      );

      return {
        summary,
        flights: flightsOnDay,
        hasRedEye,
        isOff: summary.isOffDay || flightsOnDay.length === 0,
      };
    });
  }, [dailySummaries, roster.flights]);

  // Filter rows based on search, month, and status
  const filteredRows = useMemo(() => {
    return dailyDutyRows.filter(({ summary, flights, hasRedEye, isOff }) => {
      // Month filter
      if (selectedMonth !== 'all' && !summary.dateStr.startsWith(selectedMonth)) {
        return false;
      }

      // Status filter
      if (statusFilter === 'flight' && isOff) return false;
      if (statusFilter === 'off' && !isOff) return false;
      if (statusFilter === 'redeye' && !hasRedEye) return false;
      if (statusFilter === 'layover' && !summary.layoverStation) return false;

      // Text Search query (flight numbers, cities, IATAs, dates)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const dateAviation = formatAviationDate(summary.dateStr).toLowerCase();
        const matchesDate =
          summary.dateStr.includes(q) ||
          summary.dayLabel.toLowerCase().includes(q) ||
          dateAviation.includes(q);

        const matchesFlight = flights.some(
          (f) =>
            f.flightNumber.toLowerCase().includes(q) ||
            f.origin.toLowerCase().includes(q) ||
            f.destination.toLowerCase().includes(q) ||
            (f.originCity && f.originCity.toLowerCase().includes(q)) ||
            (f.destinationCity && f.destinationCity.toLowerCase().includes(q))
        );

        const matchesLayover =
          summary.layoverStation &&
          (summary.layoverStation.city.toLowerCase().includes(q) ||
            summary.layoverStation.iata.toLowerCase().includes(q));

        if (!matchesDate && !matchesFlight && !matchesLayover) {
          return false;
        }
      }

      return true;
    });
  }, [dailyDutyRows, selectedMonth, statusFilter, searchQuery]);

  // Total flights count
  const allFlightSectors = useMemo(() => roster.flights, [roster.flights]);

  const verifiedCount = useMemo(() => {
    return Object.values(verifiedSectors).filter(Boolean).length;
  }, [verifiedSectors]);

  const toggleSectorVerified = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setVerifiedSectors((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const verifyAllSectors = () => {
    const allIds: Record<string, boolean> = {};
    allFlightSectors.forEach((f) => {
      allIds[f.id] = true;
    });
    setVerifiedSectors(allIds);
  };

  // Helper for document upload
  const handleUploadCustomDoc = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCustomDocumentName(file.name);
    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setCustomDocumentUrl(url);
    } else {
      // PDF or other
      const reader = new FileReader();
      reader.onload = (ev) => {
        setCustomDocumentUrl(ev.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Format short time in HBT
  const formatTimeHbt = (isoUtc: string) => {
    const d = new Date(isoUtc);
    const target = new Date(d.getTime() + preferences.homeBaseTzOffset * 3600000);
    const hh = target.getUTCHours().toString().padStart(2, '0');
    const mm = target.getUTCMinutes().toString().padStart(2, '0');
    return `${hh}:${mm}`;
  };

  return (
    <div className="space-y-4">
      {/* 1. Header Bar: AIMS / NetLine Operational Title & Mode Controls */}
      <div className="rounded-2xl border border-slate-800 bg-gradient-to-r from-slate-900 via-slate-900/90 to-slate-950 p-4 sm:p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <h2 className="text-base sm:text-lg font-black uppercase tracking-wider text-white flex items-center gap-2">
                <FileText className="h-5 w-5 text-blue-400" />
                Master Roster Sheet (AIMS / NetLine View)
              </h2>
              <span className="rounded bg-blue-950 px-2.5 py-0.5 text-xs font-mono font-bold text-blue-300 border border-blue-800/40">
                Base {roster.homeBase} (UTC+{preferences.homeBaseTzOffset})
              </span>
              {roster.crewName && (
                <span className="text-xs text-slate-400 font-mono hidden sm:inline">
                  • Crew: <strong className="text-slate-200">{roster.crewName}</strong>
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400">
              High-density chronological airline duty schedule. Compare flight numbers, block hours, reporting times, and layover stations directly with company crew tracking.
            </p>
          </div>

          {/* Quick Action Badges & Split-Screen Toggle */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Split Screen Quick Verification Mode Switch */}
            <button
              onClick={() => setIsSplitScreen(!isSplitScreen)}
              className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition-all shadow-sm border ${
                isSplitScreen
                  ? 'border-emerald-500 bg-emerald-600 text-white shadow-emerald-950/50'
                  : 'border-slate-700 bg-slate-800/80 hover:bg-slate-800 text-slate-200 hover:text-white'
              }`}
              title="Toggle Split-Screen to view parsed sheet next to original PDF/screenshot"
            >
              <Split className="h-4 w-4" />
              <span>{isSplitScreen ? 'Exit Split-Screen' : 'Split-Screen Verification'}</span>
            </button>

            {/* Print / Export Roster Sheet */}
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900 hover:bg-slate-800/80 px-3 py-2 text-xs font-semibold text-slate-300 hover:text-white transition-all"
              title="Print high-density roster sheet"
            >
              <Printer className="h-4 w-4 text-slate-400" />
              <span className="hidden sm:inline">Print Sheet</span>
            </button>
          </div>
        </div>

        {/* 2. Monthly Stats Strip (Flight Hours, Sectors, OFF Days, WOCL night legs) */}
        {monthlyStats && (
          <div className="mt-4 pt-4 border-t border-slate-800/80 grid grid-cols-2 sm:grid-cols-5 gap-2.5 font-mono text-left">
            {/* 1. Block Hours */}
            <div className="rounded-xl border border-blue-900/40 bg-blue-950/20 p-2.5">
              <div className="flex items-center justify-between text-[10px] text-blue-300 font-sans font-bold uppercase">
                <span>Flight Hours</span>
                <span className="text-blue-400 font-mono">100h Cap</span>
              </div>
              <p className="text-lg font-black text-white mt-0.5">
                {monthlyStats.totalFlightHours}h
              </p>
              <div className="mt-1 w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-blue-500 h-full rounded-full transition-all"
                  style={{ width: `${Math.min(100, (monthlyStats.totalFlightHours / 100) * 100)}%` }}
                />
              </div>
            </div>

            {/* 2. Total Sectors */}
            <div className="rounded-xl border border-sky-900/40 bg-sky-950/20 p-2.5">
              <span className="text-[10px] text-sky-300 font-sans font-bold uppercase block">
                Total Sectors
              </span>
              <p className="text-lg font-black text-sky-200 mt-0.5">
                {monthlyStats.totalSectors} <span className="text-xs font-normal text-slate-400">Legs</span>
              </p>
              <p className="text-[10px] font-sans text-slate-400 mt-0.5">Active flights scheduled</p>
            </div>

            {/* 3. Rest Days (WKOFF) */}
            <div className="rounded-xl border border-emerald-900/40 bg-emerald-950/20 p-2.5">
              <span className="text-[10px] text-emerald-300 font-sans font-bold uppercase block">
                Rest / OFF Days
              </span>
              <p className="text-lg font-black text-emerald-400 mt-0.5">
                {monthlyStats.offDays} <span className="text-xs font-normal text-slate-400">Days</span>
              </p>
              <p className="text-[10px] font-sans text-emerald-300/80 mt-0.5">DGCA / FAA Compliant</p>
            </div>

            {/* 4. Night / Red-Eye Sectors */}
            <div className="rounded-xl border border-rose-900/40 bg-rose-950/20 p-2.5">
              <span className="text-[10px] text-rose-300 font-sans font-bold uppercase block">
                WOCL Night Legs
              </span>
              <p className="text-lg font-black text-rose-300 mt-0.5">
                {monthlyStats.woclNightFlights} <span className="text-xs font-normal text-slate-400">Sectors</span>
              </p>
              <p className="text-[10px] font-sans text-slate-400 mt-0.5">02:00–06:00 window</p>
            </div>

            {/* 5. Verification Audit Progress */}
            <div className="rounded-xl border border-amber-900/40 bg-amber-950/20 p-2.5 col-span-2 sm:col-span-1">
              <div className="flex items-center justify-between text-[10px] text-amber-300 font-sans font-bold uppercase">
                <span>Audit Check</span>
                <span className="text-amber-400 font-mono">{verifiedCount}/{allFlightSectors.length}</span>
              </div>
              <p className="text-lg font-black text-amber-200 mt-0.5">
                {allFlightSectors.length > 0 ? Math.round((verifiedCount / allFlightSectors.length) * 100) : 100}%
              </p>
              <div className="mt-1 w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-amber-500 h-full rounded-full transition-all"
                  style={{
                    width: `${allFlightSectors.length > 0 ? (verifiedCount / allFlightSectors.length) * 100 : 100}%`,
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3. Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900/70 p-3">
        {/* Search input */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search flight (6E 205), station (BOM), city (Dubai), or date (1-Sep)..."
            className="w-full rounded-xl border border-slate-800 bg-slate-950 pl-9 pr-8 py-2 text-xs text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 no-scrollbar">
          {/* Month selector if multi-month */}
          {availableMonths.length > 1 && (
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-300 font-semibold focus:border-blue-500 focus:outline-none"
            >
              <option value="all">All Months</option>
              {availableMonths.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label}
                </option>
              ))}
            </select>
          )}

          {/* Status filter chips */}
          {[
            { id: 'all', label: 'All Duties' },
            { id: 'flight', label: 'Flights Only' },
            { id: 'off', label: 'Rest (WKOFF)' },
            { id: 'redeye', label: 'WOCL Red-Eye' },
            { id: 'layover', label: 'Layovers' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id as any)}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold shrink-0 transition-all ${
                statusFilter === tab.id
                  ? 'bg-blue-600 text-white shadow-sm ring-1 ring-blue-400'
                  : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 4. Split-Screen Verification View OR Full-Width Sheet */}
      <div className={`grid gap-4 ${isSplitScreen ? 'grid-cols-1 lg:grid-cols-12' : 'grid-cols-1'}`}>
        {/* LEFT PANE (Only in Split-Screen Mode): Original Roster Document / PDF / Screenshot View */}
        {isSplitScreen && (
          <div className="lg:col-span-5 rounded-2xl border border-slate-800 bg-slate-950 flex flex-col overflow-hidden h-[750px] shadow-lg sticky top-20">
            {/* Document Header Controls */}
            <div className="p-3 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 truncate">
                <FileText className="h-4 w-4 text-emerald-400 shrink-0" />
                <span className="text-xs font-bold text-slate-200 truncate">
                  {customDocumentName}
                </span>
              </div>

              {/* Zoom Controls */}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => setZoomLevel((z) => Math.max(50, z - 20))}
                  className="rounded p-1 bg-slate-800 text-slate-300 hover:text-white"
                  title="Zoom Out"
                >
                  <ZoomOut className="h-3.5 w-3.5" />
                </button>
                <span className="text-[10px] font-mono text-slate-400 px-1">{zoomLevel}%</span>
                <button
                  onClick={() => setZoomLevel((z) => Math.min(250, z + 20))}
                  className="rounded p-1 bg-slate-800 text-slate-300 hover:text-white"
                  title="Zoom In"
                >
                  <ZoomIn className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setZoomLevel(100)}
                  className="rounded p-1 bg-slate-800 text-slate-300 hover:text-white"
                  title="Reset Zoom"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded bg-blue-600/80 hover:bg-blue-600 text-white px-2 py-0.5 text-[10px] font-bold ml-1"
                >
                  Upload File
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={handleUploadCustomDoc}
                  className="hidden"
                />
              </div>
            </div>

            {/* Document Render Area (Image / Canvas / PDF preview or Simulated AIMS Portal Snapshot) */}
            <div className="flex-1 overflow-auto p-4 bg-slate-900/40 flex items-start justify-center relative select-none">
              {customDocumentUrl ? (
                customDocumentUrl.startsWith('data:application/pdf') || customDocumentUrl.endsWith('.pdf') ? (
                  <iframe
                    src={customDocumentUrl}
                    title="Uploaded PDF Roster"
                    className="w-full h-full rounded border border-slate-800"
                  />
                ) : (
                  <img
                    src={customDocumentUrl}
                    alt="Roster Screenshot Preview"
                    style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top center' }}
                    className="max-w-none transition-transform duration-150 rounded shadow-md object-contain"
                  />
                )
              ) : (
                /* High-fidelity fallback mockup representing AIMS / Sabre crew schedule sheet */
                <div
                  style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top center' }}
                  className="w-full max-w-md bg-white text-slate-900 rounded-lg p-4 font-mono text-[10px] shadow-2xl space-y-3 leading-tight transition-transform"
                >
                  <div className="border-b border-slate-300 pb-2 flex justify-between items-center text-[11px] font-bold">
                    <span>AIMS CREW SCHEDULE PORTAL</span>
                    <span className="text-blue-700">BASE: {roster.homeBase}</span>
                  </div>
                  <div className="text-[9px] text-slate-600">
                    <p>CREW: {roster.crewName || 'SENIOR CABIN CREW'}</p>
                    <p>PERIOD: {formatAviationDate(dailySummaries[0]?.dateStr || '')} – {formatAviationDate(dailySummaries[dailySummaries.length - 1]?.dateStr || '')}</p>
                  </div>
                  <div className="border-t border-b border-slate-200 py-1 font-bold grid grid-cols-6 text-slate-800 text-[9px]">
                    <span>DATE</span>
                    <span>FLT#</span>
                    <span>DEP</span>
                    <span>ARR</span>
                    <span>STD</span>
                    <span>STA</span>
                  </div>
                  <div className="space-y-1 max-h-[500px] overflow-y-auto">
                    {roster.flights.map((f, i) => (
                      <div
                        key={f.id || i}
                        onClick={() => setSelectedFlightId(f.id)}
                        className={`grid grid-cols-6 py-0.5 px-1 rounded cursor-pointer transition-colors ${
                          selectedFlightId === f.id
                            ? 'bg-blue-100 text-blue-900 font-bold ring-1 ring-blue-400'
                            : verifiedSectors[f.id]
                            ? 'bg-emerald-50 text-emerald-900 line-through opacity-70'
                            : 'hover:bg-slate-100 text-slate-700'
                        }`}
                      >
                        <span>{formatAviationDate(f.departureTimeUtc.slice(0, 10))}</span>
                        <span className="font-bold">{f.flightNumber}</span>
                        <span>{f.origin}</span>
                        <span>{f.destination}</span>
                        <span>{formatTimeHbt(f.departureTimeUtc)}</span>
                        <span>{formatTimeHbt(f.arrivalTimeUtc)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-slate-300 pt-2 text-[9px] text-slate-500 flex justify-between items-center">
                    <span>STATUS: RECOGNISED</span>
                    <span className="text-emerald-700 font-bold">ALL TIMINGS VERIFIED (UTC+{preferences.homeBaseTzOffset})</span>
                  </div>
                </div>
              )}
            </div>

            {/* Split Screen Quick Audit Instructions Footer */}
            <div className="p-2.5 border-t border-slate-800 bg-slate-900 text-slate-400 text-[11px] flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                Tap a row on the right to cross-check & audit.
              </span>
              <button
                onClick={verifyAllSectors}
                className="text-[10px] font-bold text-emerald-400 hover:text-emerald-300 underline"
              >
                Mark All Verified
              </button>
            </div>
          </div>
        )}

        {/* RIGHT PANE (or Full-Width): The High-Density Master Duty Sheet Table */}
        <div className={`${isSplitScreen ? 'lg:col-span-7' : 'col-span-1'} space-y-3`}>
          {filteredRows.length === 0 ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-8 text-center text-slate-400 space-y-2">
              <p className="font-semibold text-white text-sm">No duty records matched your search or filters.</p>
              <p className="text-xs">Try clearing the search query or selecting "All Duties".</p>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('all');
                  setSelectedMonth('all');
                }}
                className="rounded-xl bg-blue-600 hover:bg-blue-500 px-3 py-1.5 font-bold text-white text-xs mt-2"
              >
                Reset All Filters
              </button>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-800 bg-slate-950 overflow-hidden shadow-sm">
              {/* Table Column Headers */}
              <div className="grid grid-cols-12 gap-2 px-4 py-3 bg-slate-900/90 border-b border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                <span className="col-span-2">Date / Day</span>
                <span className="col-span-2">Duty Type</span>
                <span className="col-span-4">Flight / Sectors</span>
                <span className="col-span-2 text-center">Timings (HBT)</span>
                <span className="col-span-2 text-right">Actions</span>
              </div>

              {/* Duty Rows (Top-to-Bottom AIMS Flow - clean page flow in normal view, scrollable in split mode) */}
              <div className={`divide-y divide-slate-800/60 ${isSplitScreen ? 'max-h-[690px] overflow-y-auto scrollbar-thin' : ''}`}>
                {filteredRows.map(({ summary, flights, hasRedEye, isOff }) => {
                  const dateStr = summary.dateStr;
                  const aviationDate = formatAviationDate(dateStr);
                  const weekdayShort = summary.dayLabel.split(',')[0]?.trim() || '';

                  return (
                    <div
                      key={dateStr}
                      className={`grid grid-cols-12 gap-2 px-4 py-3 items-center text-xs transition-colors ${
                        isOff
                          ? 'bg-slate-950/40 hover:bg-emerald-950/10'
                          : hasRedEye
                          ? 'bg-rose-950/10 hover:bg-rose-950/20'
                          : 'bg-slate-900/30 hover:bg-slate-900/80'
                      }`}
                    >
                      {/* 1. Date Column */}
                      <div className="col-span-2 flex flex-col justify-center">
                        <span className="font-mono font-extrabold text-sm text-white">
                          {aviationDate}
                        </span>
                        <span className="text-[10px] text-slate-400 font-semibold uppercase">
                          {weekdayShort}
                        </span>
                      </div>

                      {/* 2. Duty Type Badge */}
                      <div className="col-span-2 flex flex-col justify-center gap-1">
                        {isOff ? (
                          <span className="inline-flex items-center gap-1 rounded bg-emerald-950/80 px-2 py-0.5 text-[10px] font-bold text-emerald-300 border border-emerald-800/40 w-fit">
                            🏖️ WKOFF
                          </span>
                        ) : hasRedEye ? (
                          <span className="inline-flex items-center gap-1 rounded bg-rose-950/80 px-2 py-0.5 text-[10px] font-bold text-rose-300 border border-rose-800/40 w-fit">
                            <Moon className="h-3 w-3 text-rose-400" /> RED-EYE
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded bg-blue-950/80 px-2 py-0.5 text-[10px] font-bold text-blue-300 border border-blue-800/40 w-fit">
                            <Plane className="h-3 w-3 text-blue-400" /> FLIGHT
                          </span>
                        )}

                        {summary.layoverStation && (
                          <span className="text-[10px] font-mono text-indigo-300 font-semibold truncate">
                            🏨 {summary.layoverStation.iata} Layover
                          </span>
                        )}
                      </div>

                      {/* 3. Flight Sectors & Route */}
                      <div className="col-span-4 space-y-1.5">
                        {isOff ? (
                          <span className="text-[11px] text-slate-400 italic">
                            Designated Rest Day • Full Circadian Realignment
                          </span>
                        ) : flights.length === 0 ? (
                          <span className="text-[11px] text-slate-400 italic">
                            Ground Duty / Standby Reserve
                          </span>
                        ) : (
                          flights.map((flight) => {
                            const isVerified = !!verifiedSectors[flight.id];
                            const isSelected = selectedFlightId === flight.id;

                            return (
                              <div
                                key={flight.id}
                                onClick={() => setSelectedFlightId(flight.id)}
                                className={`flex items-center justify-between rounded-lg border px-2.5 py-1 text-xs transition-all cursor-pointer ${
                                  isSelected
                                    ? 'border-blue-500 bg-blue-950/60 ring-1 ring-blue-500'
                                    : isVerified
                                    ? 'border-emerald-800/40 bg-emerald-950/20 text-emerald-300'
                                    : 'border-slate-800 bg-slate-900/60 hover:border-slate-700 text-slate-200'
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-bold text-white text-[11px]">
                                    {flight.flightNumber}
                                  </span>
                                  <span className="text-[11px] text-slate-400 font-semibold">
                                    {flight.origin} ➔ {flight.destination}
                                  </span>
                                </div>

                                <div className="flex items-center gap-2 font-mono text-[10px] text-slate-400">
                                  <span>{Math.floor(flight.durationMinutes / 60)}h {flight.durationMinutes % 60}m</span>
                                  {/* Verification Checkbox */}
                                  <button
                                    onClick={(e) => toggleSectorVerified(flight.id, e)}
                                    className={`rounded p-0.5 transition-colors ${
                                      isVerified
                                        ? 'text-emerald-400 hover:text-emerald-300'
                                        : 'text-slate-600 hover:text-slate-300'
                                    }`}
                                    title={isVerified ? 'Mark unverified' : 'Mark audit verified'}
                                  >
                                    <CheckCircle2 className="h-4 w-4" />
                                  </button>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>

                      {/* 4. Timings (HBT): Report, STD, STA, Debrief */}
                      <div className="col-span-2 text-center font-mono text-[11px]">
                        {summary.prepDetails ? (
                          <div className="space-y-0.5">
                            <span className="text-slate-300 block">
                              Rep: <strong className="text-white">{summary.prepDetails.reportHbt}</strong>
                            </span>
                            <span className="text-slate-400 text-[10px] block">
                              Dep: <strong className="text-sky-300">{summary.prepDetails.departureHbt}</strong>
                            </span>
                            {flights.length > 0 && (
                              <span className="text-indigo-300 text-[9px] block font-semibold">
                                Debrief: <strong className="text-white">{calculateDebriefEndTime(formatTimeHbt(flights[flights.length - 1].arrivalTimeUtc), 30)}</strong>
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-500">--:--</span>
                        )}
                      </div>

                      {/* 5. One-Tap Jump to Timeline & Details */}
                      <div className="col-span-2 text-right">
                        {onJumpToTimeline && (
                          <button
                            onClick={() => onJumpToTimeline(dateStr)}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900 hover:bg-blue-600 hover:border-blue-500 hover:text-white px-2.5 py-1 text-[11px] font-semibold text-slate-300 transition-all shadow-sm"
                            title="Jump to interactive Chrono Timeline for this day"
                          >
                            <span>Timeline</span>
                            <ChevronRight className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
