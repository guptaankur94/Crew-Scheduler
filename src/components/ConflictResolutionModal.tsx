import React, { useState } from 'react';
import { RosterConflict, ConflictResolutionChoice } from '../services/rosterMerger';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Calendar,
  Plane,
  Clock,
  Layers,
  Sparkles,
  X,
  RefreshCw,
  GitMerge,
} from 'lucide-react';

interface ConflictResolutionModalProps {
  conflicts: RosterConflict[];
  identicalCount: number;
  newSectorsCount: number;
  onResolve: (resolutions: Record<string, ConflictResolutionChoice>) => void;
  onCancel: () => void;
}

export const ConflictResolutionModal: React.FC<ConflictResolutionModalProps> = ({
  conflicts,
  identicalCount,
  newSectorsCount,
  onResolve,
  onCancel,
}) => {
  // Map of conflict.id -> choice
  const [resolutions, setResolutions] = useState<Record<string, ConflictResolutionChoice>>(() => {
    const initial: Record<string, ConflictResolutionChoice> = {};
    conflicts.forEach((c) => {
      // By default in aviation, when a new roster is uploaded, crew usually want the newer revision
      initial[c.id] = 'accept_incoming';
    });
    return initial;
  });

  const handleSelectChoice = (conflictId: string, choice: ConflictResolutionChoice) => {
    setResolutions((prev) => ({
      ...prev,
      [conflictId]: choice,
    }));
  };

  const handleBulkSelect = (choice: ConflictResolutionChoice) => {
    const updated: Record<string, ConflictResolutionChoice> = {};
    conflicts.forEach((c) => {
      updated[c.id] = choice;
    });
    setResolutions(updated);
  };

  const formatFlightTime = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    } catch {
      return isoStr;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 sm:p-6 overflow-y-auto">
      <div className="relative flex flex-col w-full max-w-3xl my-auto rounded-3xl border border-amber-600/50 bg-slate-950 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-amber-600/30 px-6 py-4 bg-gradient-to-r from-amber-950/40 via-slate-900 to-slate-950">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/40 shrink-0">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-white text-base">Roster Schedule Revision Conflict</h3>
                <span className="rounded-full bg-amber-500/20 border border-amber-500/40 px-2 py-0.5 text-[10px] font-bold text-amber-300 font-mono">
                  {conflicts.length} {conflicts.length === 1 ? 'Date Conflicting' : 'Dates Conflicting'}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                The uploaded files overlap with your active timeline but contain different flight assignments.
              </p>
            </div>
          </div>

          <button
            onClick={onCancel}
            className="rounded-xl border border-slate-700 bg-slate-800 p-2 text-slate-400 hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Informational Context Banner */}
        <div className="px-6 py-3 bg-slate-900/80 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-3 text-slate-300">
            <span className="flex items-center gap-1 text-emerald-400 font-medium">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>{identicalCount} identical sectors auto-merged</span>
            </span>
            <span className="text-slate-600">•</span>
            <span className="flex items-center gap-1 text-blue-400 font-medium">
              <Sparkles className="h-3.5 w-3.5" />
              <span>{newSectorsCount} new timeline sectors ready</span>
            </span>
          </div>

          {/* Bulk Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleBulkSelect('accept_incoming')}
              className="px-2.5 py-1 rounded-lg bg-blue-600/30 hover:bg-blue-600/50 text-blue-200 border border-blue-500/40 text-[11px] font-bold transition-colors"
            >
              Accept All New Revisions
            </button>
            <button
              onClick={() => handleBulkSelect('keep_existing')}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-medium transition-colors"
            >
              Keep All Existing
            </button>
          </div>
        </div>

        {/* Scrollable Conflict Cards List */}
        <div className="max-h-[60vh] overflow-y-auto p-6 space-y-5">
          {conflicts.map((conflict, idx) => {
            const currentChoice = resolutions[conflict.id] || 'accept_incoming';

            return (
              <div
                key={conflict.id}
                className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 space-y-3 shadow-sm"
              >
                {/* Date Header */}
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-amber-400" />
                    <span className="font-bold text-white text-xs">
                      Conflict #{idx + 1} — Date: {conflict.dateStr}
                    </span>
                  </div>
                  <span className="text-[11px] text-amber-300/90 font-medium">
                    Schedule Change Detected
                  </span>
                </div>

                {/* Side-by-Side Comparison */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Option 1: Existing Flight in Timeline */}
                  <div
                    onClick={() => handleSelectChoice(conflict.id, 'keep_existing')}
                    className={`relative rounded-xl border p-3 cursor-pointer transition-all ${
                      currentChoice === 'keep_existing'
                        ? 'border-blue-500 bg-blue-950/30 ring-1 ring-blue-500/60'
                        : 'border-slate-800 bg-slate-950/60 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-bold text-slate-400">Current Timeline</span>
                      <input
                        type="radio"
                        checked={currentChoice === 'keep_existing'}
                        onChange={() => handleSelectChoice(conflict.id, 'keep_existing')}
                        className="text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                      />
                    </div>

                    <div className="mt-2 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-white text-sm">
                          {conflict.existingFlight.flightNumber}
                        </span>
                        <span className="text-xs text-slate-300">
                          {conflict.existingFlight.origin} ➔ {conflict.existingFlight.destination}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-mono">
                        <Clock className="h-3 w-3" />
                        <span>
                          {formatFlightTime(conflict.existingFlight.departureTimeUtc)} – {formatFlightTime(conflict.existingFlight.arrivalTimeUtc)}
                        </span>
                        <span className="text-slate-500">({conflict.existingFlight.durationMinutes}m)</span>
                      </div>
                    </div>
                  </div>

                  {/* Option 2: Incoming Uploaded Flight (Revised) */}
                  <div
                    onClick={() => handleSelectChoice(conflict.id, 'accept_incoming')}
                    className={`relative rounded-xl border p-3 cursor-pointer transition-all ${
                      currentChoice === 'accept_incoming'
                        ? 'border-emerald-500 bg-emerald-950/30 ring-1 ring-emerald-500/60'
                        : 'border-slate-800 bg-slate-950/60 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-bold text-emerald-400 flex items-center gap-1">
                        <span>New Incoming Revision</span>
                        <span className="bg-emerald-500/20 text-emerald-300 px-1 rounded text-[9px]">Recommended</span>
                      </span>
                      <input
                        type="radio"
                        checked={currentChoice === 'accept_incoming'}
                        onChange={() => handleSelectChoice(conflict.id, 'accept_incoming')}
                        className="text-emerald-600 focus:ring-emerald-500 h-3.5 w-3.5"
                      />
                    </div>

                    <div className="mt-2 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-white text-sm">
                          {conflict.incomingFlight.flightNumber}
                        </span>
                        <span className="text-xs text-emerald-300">
                          {conflict.incomingFlight.origin} ➔ {conflict.incomingFlight.destination}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-300 font-mono">
                        <Clock className="h-3 w-3 text-emerald-400" />
                        <span>
                          {formatFlightTime(conflict.incomingFlight.departureTimeUtc)} – {formatFlightTime(conflict.incomingFlight.arrivalTimeUtc)}
                        </span>
                        <span className="text-slate-500">({conflict.incomingFlight.durationMinutes}m)</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Third Option: Multi-Sector Day (Combine Both) */}
                <div className="pt-1 flex items-center justify-between text-xs">
                  <button
                    onClick={() => handleSelectChoice(conflict.id, 'combine_both')}
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                      currentChoice === 'combine_both'
                        ? 'bg-amber-600/30 text-amber-200 border border-amber-500/50'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                    }`}
                  >
                    <GitMerge className="h-3 w-3" />
                    <span>Both are flights today (Keep as multi-sector duty)</span>
                  </button>

                  <span className="text-[11px] text-slate-400">
                    Selected:{' '}
                    <strong className="text-white">
                      {currentChoice === 'accept_incoming'
                        ? 'Accept New Revision'
                        : currentChoice === 'keep_existing'
                        ? 'Keep Existing'
                        : 'Keep Both'}
                    </strong>
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-800 px-6 py-4 bg-slate-900/80">
          <div className="text-xs text-slate-400">
            Resolving will merge this into your continuous timeline from January through March.
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              onClick={onCancel}
              className="w-1/2 sm:w-auto px-4 py-2 rounded-xl border border-slate-700 hover:bg-slate-800 text-xs font-semibold text-slate-300 transition-colors"
            >
              Cancel Upload
            </button>
            <button
              onClick={() => onResolve(resolutions)}
              className="w-1/2 sm:w-auto flex items-center justify-center gap-2 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white shadow-md shadow-blue-900/30 transition-all hover:scale-[1.02]"
            >
              <GitMerge className="h-4 w-4" />
              <span>Apply & Merge Continuous Timeline ➔</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
