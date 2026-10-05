import React, { useState, useRef } from 'react';
import { TimeInput24 } from './TimeInput24';
import { RosterData, RosterHistoryEntry, FlightLeg } from '../types/circadian';
import { buildManualFlight } from '../services/manualFlight';
import {
  History,
  Trash2,
  RotateCcw,
  CheckCircle2,
  FileText,
  Upload,
  Sparkles,
  Edit3,
  Calendar,
  Search,
  Filter,
  Eye,
  X,
  AlertTriangle,
  PlusCircle,
  Download,
  Plane,
  Clock,
  Layers,
  Check,
  RefreshCw,
  ArrowRight,
  UploadCloud,
  FileCheck,
  GitMerge,
} from 'lucide-react';

interface RosterHistoryTableProps {
  history: RosterHistoryEntry[];
  currentRoster: RosterData;
  onRestoreRoster: (entry: RosterHistoryEntry) => void;
  onClearActiveRoster: () => void;
  onDeleteHistoryItem: (id: string) => void;
  onClearAllHistory: () => void;
  onAddManualSector?: (flight: FlightLeg) => void;
  onOpenUploadTab?: () => void;
  onUploadFile?: (file: File) => void;
  onUploadFiles?: (files: File[]) => void;
  isParsing?: boolean;
  onViewTimeline?: () => void;
  onMergeRosterSnapshot?: (snapshot: RosterData, title: string) => void;
}

export const RosterHistoryTable: React.FC<RosterHistoryTableProps> = ({
  history,
  currentRoster,
  onRestoreRoster,
  onClearActiveRoster,
  onDeleteHistoryItem,
  onClearAllHistory,
  onAddManualSector,
  onOpenUploadTab,
  onUploadFile,
  onUploadFiles,
  isParsing = false,
  onViewTimeline,
  onMergeRosterSnapshot,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [inspectEntry, setInspectEntry] = useState<RosterHistoryEntry | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showClearLogsConfirm, setShowClearLogsConfirm] = useState(false);
  const [showManualModal, setShowManualModal] = useState(false);
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'info' | 'warning' } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Manual Flight Form State
  const [manualFlightNumber, setManualFlightNumber] = useState('');
  const [manualOrigin, setManualOrigin] = useState(currentRoster.homeBase || 'DEL');
  const [manualDestination, setManualDestination] = useState('BOM');
  const [manualDate, setManualDate] = useState(
    currentRoster.flights[0]?.departureTimeUtc.slice(0, 10) || new Date().toISOString().slice(0, 10)
  );
  const [manualDepTime, setManualDepTime] = useState('06:30');
  const [manualArrTime, setManualArrTime] = useState('08:45');
  const [manualError, setManualError] = useState<string | null>(null);

  // Filter history
  const filteredHistory = history.filter((item) => {
    const matchesSearch =
      item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.airline.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.homeBase.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.description && item.description.toLowerCase().includes(searchTerm.toLowerCase()));

    if (!matchesSearch) return false;
    if (filterType === 'all') return true;
    if (filterType === 'upload') return item.actionType === 'upload';
    if (filterType === 'preset') return item.actionType === 'preset';
    if (filterType === 'manual_edit') return item.actionType === 'manual_edit';
    if (filterType === 'cleared') return item.actionType === 'cleared';
    return true;
  });

  const formatDate = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      return d.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      });
    } catch {
      return isoStr;
    }
  };

  const handleReload = (entry: RosterHistoryEntry) => {
    if (!entry.rosterSnapshot) return;
    onRestoreRoster(entry);
    setFeedback({
      message: `Successfully re-loaded "${entry.title}" (${entry.flightsCount} sectors) into active schedule.`,
      type: 'success',
    });
    setTimeout(() => {
      setFeedback((prev) => (prev?.message.includes(entry.title) ? null : prev));
    }, 6000);
  };

  const handleClearActive = () => {
    onClearActiveRoster();
    setShowClearConfirm(false);
    setFeedback({
      message: 'Active roster cleared. Duty schedule set to Rest / Baseline Circadian rhythm.',
      type: 'info',
    });
    setTimeout(() => setFeedback(null), 6000);
  };

  const handleExportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(history, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute('href', dataStr);
    dlAnchorElem.setAttribute('download', `crew_roster_history_${new Date().toISOString().slice(0, 10)}.json`);
    dlAnchorElem.click();
  };

  const handleCreateManualFlight = (e: React.FormEvent) => {
    e.preventDefault();
    if (!onAddManualSector) return;

    const result = buildManualFlight({
      id: `manual-leg-${Date.now()}`,
      flightNumber: manualFlightNumber,
      origin: manualOrigin,
      destination: manualDestination,
      dateStr: manualDate,
      depTime: manualDepTime,
      arrTime: manualArrTime,
      reportLeadMinutes: 75,
    });

    if ('error' in result) {
      setManualError(result.error);
      return;
    }

    const newFlight = result.flight;
    setManualError(null);
    onAddManualSector(newFlight);
    setShowManualModal(false);
    setManualFlightNumber('');
    setFeedback({
      message: `Manual sector ${newFlight.flightNumber} added to active roster.`,
      type: 'success',
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length > 0) {
      if (onUploadFiles) {
        onUploadFiles(files);
      } else if (onUploadFile) {
        onUploadFile(files[0]);
      }
    }
    // reset input so the same files can be re-selected if needed
    e.target.value = '';
  };

  const getActionBadge = (type: RosterHistoryEntry['actionType']) => {
    switch (type) {
      case 'upload':
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 text-[11px] font-bold text-emerald-400 ring-1 ring-emerald-500/20">
            <Upload className="h-3 w-3" /> Uploaded File
          </span>
        );
      case 'preset':
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-blue-500/10 px-2 py-0.5 text-[11px] font-bold text-blue-400 ring-1 ring-blue-500/20">
            <Sparkles className="h-3 w-3" /> Sample Preset
          </span>
        );
      case 'manual_edit':
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-0.5 text-[11px] font-bold text-amber-400 ring-1 ring-amber-500/20">
            <Edit3 className="h-3 w-3" /> Manual Change
          </span>
        );
      case 'cleared':
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-rose-500/10 px-2 py-0.5 text-[11px] font-bold text-rose-400 ring-1 ring-rose-500/20">
            <Trash2 className="h-3 w-3" /> Cleared
          </span>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Hidden file input for direct upload from history */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*,application/pdf"
        multiple
        className="hidden"
      />

      {/* Optional Feedback Alert Banner */}
      {feedback && (
        <div
          className={`flex items-center justify-between rounded-xl border p-3 text-xs transition-all ${
            feedback.type === 'success'
              ? 'border-emerald-700/60 bg-emerald-950/40 text-emerald-200'
              : feedback.type === 'warning'
              ? 'border-amber-700/60 bg-amber-950/40 text-amber-200'
              : 'border-blue-700/60 bg-blue-950/40 text-blue-200'
          }`}
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            <span className="font-medium">{feedback.message}</span>
          </div>
          <div className="flex items-center gap-2">
            {onViewTimeline && (
              <button
                onClick={onViewTimeline}
                className="rounded-lg bg-emerald-600/30 hover:bg-emerald-600/50 border border-emerald-500/30 px-2.5 py-1 text-[11px] font-bold text-white transition-colors"
              >
                View Timeline ➔
              </button>
            )}
            <button
              onClick={() => setFeedback(null)}
              className="text-slate-400 hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* 1. Header Toolbar with Clear & Re-load Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3.5 rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
        <div>
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-blue-400" />
            <h3 className="text-sm font-bold text-white">Roster Upload & Audit History</h3>
            <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-mono text-slate-300">
              {history.length} records
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Clear current duty schedule, re-load any previously uploaded roster files, or track manual adjustments by date.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Direct File Upload Button */}
          {onUploadFiles || onUploadFile ? (
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isParsing}
              className="flex items-center gap-1.5 rounded-xl border border-emerald-600/40 bg-emerald-600/20 hover:bg-emerald-600/30 px-3 py-1.5 text-xs font-bold text-emerald-300 transition-colors disabled:opacity-50"
              title="Upload PDF or screenshot rosters (multi-file selection enabled)"
            >
              <UploadCloud className="h-3.5 w-3.5" />
              <span>{isParsing ? 'Processing...' : 'Upload Files'}</span>
            </button>
          ) : (
            onOpenUploadTab && (
              <button
                onClick={onOpenUploadTab}
                className="flex items-center gap-1.5 rounded-xl border border-emerald-600/40 bg-emerald-600/20 hover:bg-emerald-600/30 px-3 py-1.5 text-xs font-bold text-emerald-300 transition-colors"
              >
                <UploadCloud className="h-3.5 w-3.5" />
                <span>Upload Files</span>
              </button>
            )
          )}

          {/* Add Manual Sector */}
          {onAddManualSector && (
            <button
              onClick={() => setShowManualModal(true)}
              className="flex items-center gap-1.5 rounded-xl border border-blue-600/40 bg-blue-600/20 px-3 py-1.5 text-xs font-bold text-blue-300 hover:bg-blue-600/30 transition-colors"
            >
              <PlusCircle className="h-3.5 w-3.5" />
              <span>+ Add Sector</span>
            </button>
          )}

          {/* Clear Active Roster Button */}
          {currentRoster.flights.length > 0 ? (
            <button
              onClick={() => setShowClearConfirm(true)}
              className="flex items-center gap-1.5 rounded-xl border border-rose-800/80 bg-rose-950/50 hover:bg-rose-900/70 px-3 py-1.5 text-xs font-bold text-rose-200 transition-colors shadow-sm"
              title="Clear current active duty schedule"
            >
              <Trash2 className="h-3.5 w-3.5 text-rose-400" />
              <span>Clear Active Roster ({currentRoster.flights.length})</span>
            </button>
          ) : (
            <div className="flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-1.5 text-xs text-slate-400">
              <span className="h-2 w-2 rounded-full bg-slate-600" />
              <span>Active: Cleared (Rest)</span>
            </div>
          )}

          {/* Export JSON Audit Log */}
          <button
            onClick={handleExportJson}
            disabled={history.length === 0}
            className="flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800 transition-colors disabled:opacity-40"
            title="Download audit logs as JSON"
          >
            <Download className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Export</span>
          </button>
        </div>
      </div>

      {/* 2. Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by file name, base, airline, or notes..."
            className="w-full rounded-xl border border-slate-800 bg-slate-950 pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-600 focus:border-blue-500 focus:outline-none"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-2 text-slate-500 hover:text-slate-300"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          {[
            { id: 'all', label: 'All Logs' },
            { id: 'upload', label: 'Uploaded Files' },
            { id: 'preset', label: 'Sample Presets' },
            { id: 'manual_edit', label: 'Manual Changes' },
            { id: 'cleared', label: 'Cleared' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterType(tab.id)}
              className={`rounded-lg px-2.5 py-1 font-medium transition-colors shrink-0 ${
                filterType === tab.id
                  ? 'bg-blue-600 text-white font-bold'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800/80'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 3. Data Table */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/80 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                <th className="px-4 py-3">Date & Time Uploaded</th>
                <th className="px-4 py-3">Type / Source</th>
                <th className="px-4 py-3">Roster Title / File Name</th>
                <th className="px-4 py-3">Base & Airline</th>
                <th className="px-4 py-3">Sectors</th>
                <th className="px-4 py-3">Schedule Span</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Re-load / Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredHistory.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                    <History className="h-8 w-8 mx-auto mb-2 text-slate-600 opacity-60" />
                    <p className="font-semibold text-slate-300">No roster history entries match your filter</p>
                    <p className="text-[11px] text-slate-500 mt-1 max-w-sm mx-auto">
                      Uploaded flight rosters, manual schedule edits, and presets will automatically be logged here with date tracking.
                    </p>
                    {onOpenUploadTab && (
                      <button
                        onClick={onOpenUploadTab}
                        className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 px-3.5 py-1.5 text-xs font-bold text-white transition-colors"
                      >
                        <UploadCloud className="h-3.5 w-3.5" />
                        <span>Upload Roster File Now</span>
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                filteredHistory.map((item) => {
                  const isCurrentActive =
                    item.isActive ||
                    (item.rosterSnapshot && item.rosterSnapshot.id === currentRoster.id) ||
                    (currentRoster.flights.length > 0 &&
                      item.flightsCount === currentRoster.flights.length &&
                      item.homeBase === currentRoster.homeBase &&
                      item.actionType !== 'cleared');

                  const hasLoadableData = item.rosterSnapshot && item.rosterSnapshot.flights.length > 0;

                  return (
                    <tr
                      key={item.id}
                      className={`transition-colors ${
                        isCurrentActive && item.actionType !== 'cleared'
                          ? 'bg-blue-950/25 hover:bg-blue-950/35'
                          : 'hover:bg-slate-900/80'
                      }`}
                    >
                      {/* 1. Date & Time */}
                      <td className="px-4 py-3.5 whitespace-nowrap font-mono text-[11px] text-slate-300">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                          <span>{formatDate(item.timestamp)}</span>
                        </div>
                      </td>

                      {/* 2. Type / Source */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {getActionBadge(item.actionType)}
                      </td>

                      {/* 3. Title & Description */}
                      <td className="px-4 py-3.5">
                        <div className="font-bold text-white max-w-[210px] truncate" title={item.title}>
                          {item.title}
                        </div>
                        {item.description && (
                          <div
                            className="text-[10px] text-slate-400 max-w-[230px] truncate"
                            title={item.description}
                          >
                            {item.description}
                          </div>
                        )}
                      </td>

                      {/* 4. Base & Airline */}
                      <td className="px-4 py-3.5 whitespace-nowrap font-mono text-slate-300">
                        <span className="font-bold text-blue-400">{item.homeBase}</span>
                        <span className="text-slate-500 mx-1">•</span>
                        <span className="text-slate-300">{item.airline}</span>
                      </td>

                      {/* 5. Sectors / Flight Count */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span
                          className={`font-mono font-bold ${
                            item.flightsCount > 0 ? 'text-white' : 'text-slate-500'
                          }`}
                        >
                          {item.flightsCount} sectors
                        </span>
                      </td>

                      {/* 6. Date Range */}
                      <td className="px-4 py-3.5 whitespace-nowrap text-slate-400 text-[11px]">
                        {item.dateRange || '—'}
                      </td>

                      {/* 7. Status */}
                      <td className="px-4 py-3.5 whitespace-nowrap text-center">
                        {isCurrentActive && item.actionType !== 'cleared' ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-300">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            ACTIVE
                          </span>
                        ) : item.actionType === 'cleared' ? (
                          <span className="inline-flex items-center rounded-full bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 text-[10px] font-semibold text-rose-400">
                            Cleared
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-500 font-medium">
                            Saved
                          </span>
                        )}
                      </td>

                      {/* 8. Re-load / Actions */}
                      <td className="px-4 py-3.5 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Inspect Snapshot */}
                          {hasLoadableData && (
                            <button
                              onClick={() => setInspectEntry(item)}
                              title="Inspect Flight Legs in this file"
                              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </button>
                          )}

                          {/* RE-LOAD DATA BUTTON: Prominently loads file data into active schedule */}
                          {hasLoadableData && !isCurrentActive ? (
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                onClick={() => handleReload(item)}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 px-2.5 py-1 text-xs font-bold text-white shadow-sm transition-all"
                                title={`Re-load ${item.flightsCount} sectors from "${item.title}" into active roster`}
                              >
                                <RotateCcw className="h-3 w-3" />
                                <span>Re-load</span>
                              </button>

                              {/* MERGE BUTTON: Merges this snapshot into the continuous timeline */}
                              {currentRoster.flights.length > 0 && onMergeRosterSnapshot && (
                                <button
                                  onClick={() => onMergeRosterSnapshot(item.rosterSnapshot!, item.title)}
                                  className="inline-flex items-center gap-1 rounded-lg bg-emerald-950/60 hover:bg-emerald-900 border border-emerald-800/60 px-2 py-1 text-xs font-bold text-emerald-300 transition-colors"
                                  title={`Merge ${item.flightsCount} sectors from "${item.title}" into your continuous timeline`}
                                >
                                  <GitMerge className="h-3 w-3 text-emerald-400" />
                                  <span>+ Merge</span>
                                </button>
                              )}
                            </div>
                          ) : isCurrentActive && item.actionType !== 'cleared' ? (
                            <div className="inline-flex items-center gap-1.5">
                              <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-2 py-1 text-[11px] font-bold text-emerald-300">
                                <Check className="h-3 w-3" />
                                <span>Active</span>
                              </span>
                              <button
                                onClick={() => setShowClearConfirm(true)}
                                className="inline-flex items-center gap-1 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/40 px-2 py-1 text-[11px] font-bold text-rose-300 transition-colors"
                                title="Deactivate this roster from continuous timeline"
                              >
                                <Trash2 className="h-3 w-3" />
                                <span>Deactivate</span>
                              </button>
                            </div>
                          ) : null}

                          {/* Delete Log Item */}
                          <button
                            onClick={() => onDeleteHistoryItem(item.id)}
                            title="Delete log record"
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-rose-950/40 hover:text-rose-400 transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Summary & Clear All Logs */}
        {history.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between border-t border-slate-800/80 bg-slate-950/40 px-4 py-2.5 text-xs text-slate-400 gap-2">
            <div>
              <span>Showing {filteredHistory.length} of {history.length} records</span>
            </div>
            <div className="flex items-center gap-3">
              {currentRoster.flights.length > 0 && (
                <button
                  onClick={() => setShowClearConfirm(true)}
                  className="text-[11px] font-semibold text-rose-400 hover:text-rose-300 transition-colors flex items-center gap-1"
                >
                  <Trash2 className="h-3 w-3" />
                  <span>Clear Active Roster</span>
                </button>
              )}
              <span className="text-slate-600">|</span>
              <button
                onClick={() => setShowClearLogsConfirm(true)}
                className="text-[11px] text-slate-500 hover:text-rose-400 transition-colors"
              >
                Clear Audit Log
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 4. MODAL: Clear Active Roster Confirmation */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-rose-800/80 bg-slate-950 p-5 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-500/20 text-rose-400 ring-1 ring-rose-500/30">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <h4 className="text-base font-bold text-white">Clear Active Roster?</h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  This will remove the current <strong>{currentRoster.flights.length} flights</strong> from your active duty schedule.
                </p>
                <p className="text-xs text-slate-400">
                  A snapshot is saved in your <strong>History Table</strong>, so you can <strong>Re-load</strong> this file anytime with one click.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="rounded-xl border border-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-900 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleClearActive}
                className="flex items-center gap-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 px-4 py-2 text-xs font-bold text-white transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Yes, Clear Active Roster</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. MODAL: Clear All Logs Confirmation */}
      {showClearLogsConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-950 p-5 shadow-2xl space-y-4">
            <h4 className="text-sm font-bold text-white">Clear Audit Log History?</h4>
            <p className="text-xs text-slate-400">
              This will remove all historical upload and change records from this device. Your active roster will remain untouched.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setShowClearLogsConfirm(false)}
                className="rounded-xl border border-slate-800 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-900"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onClearAllHistory();
                  setShowClearLogsConfirm(false);
                }}
                className="rounded-xl bg-rose-600 hover:bg-rose-500 px-3 py-1.5 text-xs font-bold text-white"
              >
                Clear All Logs
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. MODAL: Inspect Roster Snapshot Flights + Direct Re-load */}
      {inspectEntry && inspectEntry.rosterSnapshot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl border border-slate-800 bg-slate-950 shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/90 px-5 py-3.5">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Plane className="h-4 w-4 text-blue-400" />
                  <span>{inspectEntry.title}</span>
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  Uploaded: {formatDate(inspectEntry.timestamp)} • Base {inspectEntry.homeBase} • {inspectEntry.flightsCount} Sectors
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    handleReload(inspectEntry);
                    setInspectEntry(null);
                  }}
                  className="rounded-xl bg-blue-600 hover:bg-blue-500 px-3 py-1.5 text-xs font-bold text-white flex items-center gap-1.5 shadow-sm"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Re-load This File</span>
                </button>
                <button
                  onClick={() => setInspectEntry(null)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Flight Legs List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {inspectEntry.rosterSnapshot.flights.length === 0 ? (
                <p className="text-center py-8 text-xs text-slate-500">No flights recorded in this snapshot.</p>
              ) : (
                inspectEntry.rosterSnapshot.flights.map((fl, idx) => (
                  <div
                    key={fl.id || idx}
                    className="flex items-center justify-between rounded-xl border border-slate-800/80 bg-slate-900/50 p-3 text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-[11px] font-bold text-blue-400 bg-blue-950/60 px-2 py-0.5 rounded border border-blue-900/40">
                        {fl.flightNumber}
                      </span>
                      <div>
                        <div className="font-bold text-white flex items-center gap-1.5">
                          <span>{fl.origin}</span>
                          <span className="text-slate-500">➔</span>
                          <span>{fl.destination}</span>
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {fl.originCity || fl.origin} to {fl.destinationCity || fl.destination}
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="font-mono text-slate-200">
                        {fl.departureTimeUtc.slice(0, 10)}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {Math.floor(fl.durationMinutes / 60)}h {fl.durationMinutes % 60}m flight
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between border-t border-slate-800 bg-slate-900/60 px-5 py-3">
              <span className="text-xs text-slate-400">
                {inspectEntry.rosterSnapshot.flights.length} total flight legs recorded
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setInspectEntry(null)}
                  className="rounded-xl border border-slate-800 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    handleReload(inspectEntry);
                    setInspectEntry(null);
                  }}
                  className="rounded-xl bg-blue-600 hover:bg-blue-500 px-4 py-1.5 text-xs font-bold text-white flex items-center gap-1.5 shadow-sm"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Re-load into Active Schedule</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 7. MODAL: Add Manual Sector */}
      {showManualModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-950 p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Edit3 className="h-4 w-4 text-blue-400" />
                <h4 className="text-sm font-bold text-white">Add Manual Flight Sector</h4>
              </div>
              <button
                onClick={() => setShowManualModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateManualFlight} className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">
                  Flight Number (e.g. 6E 205, EK 512)
                </label>
                <input
                  type="text"
                  required
                  value={manualFlightNumber}
                  onChange={(e) => setManualFlightNumber(e.target.value)}
                  placeholder="e.g. 6E 534"
                  className="w-full rounded-xl border border-slate-800 bg-slate-900 p-2.5 font-mono text-white focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">
                    Origin IATA
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={3}
                    value={manualOrigin}
                    onChange={(e) => setManualOrigin(e.target.value.toUpperCase())}
                    className="w-full rounded-xl border border-slate-800 bg-slate-900 p-2.5 font-mono text-white uppercase focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">
                    Destination IATA
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={3}
                    value={manualDestination}
                    onChange={(e) => setManualDestination(e.target.value.toUpperCase())}
                    className="w-full rounded-xl border border-slate-800 bg-slate-900 p-2.5 font-mono text-white uppercase focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">
                  Flight Date
                </label>
                <input
                  type="date"
                  required
                  value={manualDate}
                  onChange={(e) => setManualDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-800 bg-slate-900 p-2.5 font-mono text-white focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">
                    Departure (24h, local at origin)
                  </label>
                  <TimeInput24 value={manualDepTime} onChange={setManualDepTime} ariaLabel="Departure time, 24-hour" required className="w-full rounded-xl border border-slate-800 bg-slate-900 p-2.5 font-mono text-white focus:border-blue-500 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">
                    Arrival (24h, local at destination)
                  </label>
                  <TimeInput24 value={manualArrTime} onChange={setManualArrTime} ariaLabel="Arrival time, 24-hour" required className="w-full rounded-xl border border-slate-800 bg-slate-900 p-2.5 font-mono text-white focus:border-blue-500 focus:outline-none" />
                </div>
              </div>

              {manualError && (
                <p role="alert" className="rounded-xl border border-rose-800/50 bg-rose-950/30 p-2.5 text-[11px] text-rose-200">
                  {manualError}
                </p>
              )}

              <p className="text-[10px] text-slate-500">
                Reporting time automatically sets 75 min prior to departure; release 30 min after arrival.
              </p>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowManualModal(false)}
                  className="rounded-xl border border-slate-800 px-3.5 py-2 text-slate-300 hover:bg-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-blue-600 hover:bg-blue-500 px-4 py-2 font-bold text-white"
                >
                  Add Sector to Active Roster
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
