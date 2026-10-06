import React, { useEffect, useRef } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { FlightLeg } from '../types/circadian';

/**
 * "Cancel this flight": the person's update. The plan leaves the flight out; the roster keeps it as published,
 * so it can be reinstated on Days or with Undo.
 */

interface Props {
  flight: FlightLeg;
  /** Scheduled departure in home time, e.g. "07:15". */
  departureHome: string;
  homeBase: string;
  onConfirm: (flightId: string) => void;
  onClose: () => void;
}

export const CancelFlightDialog: React.FC<Props> = ({ flight, departureHome, homeBase, onConfirm, onClose }) => {
  // Escape closes the dialog
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeRef.current();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cancel-flight-title"
    >
      <div className="relative w-full max-w-lg space-y-5 rounded-3xl border border-slate-800 bg-slate-950 p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-500/20 text-rose-400">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h3 id="cancel-flight-title" className="text-base font-bold text-white">
                Cancel this flight
              </h3>
              <p className="text-xs text-slate-400">Flight cancelled? Your plan will leave it out.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-xl border border-slate-800 bg-slate-900 p-2 text-slate-400 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 text-xs">
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
            <span className="font-mono text-sm font-bold text-white">{flight.flightNumber}</span>
            <span className="ml-2 text-slate-400">
              ({flight.origin} ➔ {flight.destination})
            </span>
            <p className="mt-0.5 text-[10px] text-slate-400">Scheduled departure {departureHome} home time</p>
          </div>

          <div className="space-y-1 rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-[11px] text-slate-300">
            <p className="text-xs font-bold text-white">What happens</p>
            <p>
              Your plan leaves this flight out. You'll be planned as resting{' '}
              {flight.origin === homeBase ? 'at home' : `at ${flight.origin} (outstation)`} until your next duty.
            </p>
            <p className="text-slate-500">Your roster keeps the flight as published, so you can reinstate it on Days or with Undo.</p>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-slate-800 pt-2">
            <button
              onClick={onClose}
              className="rounded-xl border border-slate-800 px-4 py-2 font-semibold text-slate-300 hover:bg-slate-900"
            >
              Keep flight
            </button>
            <button
              onClick={() => onConfirm(flight.id)}
              className="rounded-xl bg-rose-600 px-5 py-2 font-bold text-white transition-colors hover:bg-rose-500"
            >
              Mark as cancelled
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
