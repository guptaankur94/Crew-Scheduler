import React from 'react';
import { CircadianEvent } from '../types/circadian';
import { X, Award, Lightbulb, Clock, Plus, Minus, CheckCircle2 } from 'lucide-react';

interface EventDetailModalProps {
  event: CircadianEvent | null;
  onClose: () => void;
  onNudge: (eventId: string, minutes: number) => void;
  currentNudge: number;
}

export const EventDetailModal: React.FC<EventDetailModalProps> = ({
  event,
  onClose,
  onNudge,
  currentNudge,
}) => {
  if (!event) return null;

  const { scientificCitation } = event;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-2xl sm:p-6">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header */}
        <div className="space-y-1 pr-8">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-blue-500/10 px-2.5 py-0.5 text-xs font-semibold text-blue-400 border border-blue-500/20">
              {scientificCitation.organization} Study
            </span>
            {event.priority === 'critical' && (
              <span className="rounded-full bg-red-500/10 px-2.5 py-0.5 text-xs font-semibold text-red-400 border border-red-500/20">
                Critical Safety Window
              </span>
            )}
          </div>
          <h3 className="text-base font-bold text-white sm:text-lg">{event.title}</h3>
          <p className="text-xs text-slate-400">{event.subtitle}</p>
        </div>

        {/* Timings */}
        <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl border border-slate-800 bg-slate-950 p-3 text-xs font-mono">
          <div>
            <span className="text-[10px] uppercase text-slate-400">Home Base Time</span>
            <p className="text-sm font-bold text-white">{event.startHbtStr} – {event.endHbtStr}</p>
          </div>
          <div>
            <span className="text-[10px] uppercase text-slate-400">Local Airport Time</span>
            <p className="text-sm font-bold text-slate-300">{event.startLocalStr} – {event.endLocalStr}</p>
          </div>
        </div>

        {/* Research Study Details */}
        <div className="mt-4 space-y-3">
          <div className="rounded-xl border border-slate-800/80 bg-slate-950/60 p-3.5">
            <h4 className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
              <Award className="h-4 w-4" /> {scientificCitation.studyTitle}
            </h4>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-200">
              {scientificCitation.keyFinding}
            </p>
          </div>

          <div className="space-y-1 text-xs text-slate-300">
            <strong className="text-slate-400 uppercase tracking-wider text-[10px]">
              The Biological Mechanism:
            </strong>
            <p className="leading-relaxed text-slate-300">{scientificCitation.explanation}</p>
          </div>

          {/* Actionable Crew Tip */}
          <div className="flex items-start gap-2 rounded-xl border border-amber-900/30 bg-amber-950/20 p-3 text-xs text-amber-200">
            <Lightbulb className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
            <div>
              <strong className="text-amber-300">Cabin Crew Action: </strong>
              <span>{scientificCitation.actionableTip}</span>
            </div>
          </div>
        </div>

        {/* Customization Nudge */}
        {event.userAdjustable && (
          <div className="mt-5 flex items-center justify-between border-t border-slate-800 pt-4 text-xs">
            <div>
              <span className="font-semibold text-white">Adjust for Personal Schedule</span>
              <p className="text-[11px] text-slate-400">Shift window earlier or later</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onNudge(event.id, currentNudge - 30)}
                className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700"
              >
                <Minus className="h-3 w-3" /> 30m
              </button>
              <span className="font-mono font-bold text-indigo-300">
                {currentNudge !== 0 ? `${currentNudge > 0 ? '+' : ''}${currentNudge}m` : 'Default'}
              </span>
              <button
                onClick={() => onNudge(event.id, currentNudge + 30)}
                className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700"
              >
                <Plus className="h-3 w-3" /> 30m
              </button>
            </div>
          </div>
        )}

        {/* Bottom Done */}
        <div className="mt-5 flex justify-end">
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-blue-600/20 hover:bg-blue-500"
          >
            <CheckCircle2 className="h-4 w-4" /> Got it, continue
          </button>
        </div>
      </div>
    </div>
  );
};
