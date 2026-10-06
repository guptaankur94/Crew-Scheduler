import React, { useState } from 'react';
import { TimeInput24 } from './TimeInput24';
import { FlightLeg } from '../types/circadian';
import { buildManualFlight } from '../services/manualFlight';
import {
  Plane,
  X,
  PlusCircle,
  AlertTriangle,
} from 'lucide-react';

export type TacticalModalType = 'standby_callout' | 'cancel_sector';

interface TacticalDutyModalProps {
  type: TacticalModalType;
  flight?: FlightLeg;
  defaultDate?: string;
  homeBase?: string;
  onAddStandbyFlight: (newFlight: FlightLeg) => void;
  onCancelSector: (flightId: string) => void;
  onClose: () => void;
}

export const TacticalDutyModal: React.FC<TacticalDutyModalProps> = ({
  type,
  flight,
  defaultDate = new Date().toISOString().slice(0, 10),
  homeBase = 'DEL',
  onAddStandbyFlight,
  onCancelSector,
  onClose,
}) => {
  // Standby Callout form state
  const [flightNumber, setFlightNumber] = useState('6E 215');
  const [origin, setOrigin] = useState(flight?.destination || homeBase);
  const [destination, setDestination] = useState(homeBase === 'DEL' ? 'BOM' : 'DEL');
  const [date, setDate] = useState(defaultDate);
  const [depTime, setDepTime] = useState('14:30');
  const [arrTime, setArrTime] = useState('16:45');
  const [formError, setFormError] = useState<string | null>(null);
  


  const handleStandbySubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const result = buildManualFlight({
      id: `standby-callout-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      flightNumber,
      origin,
      destination,
      dateStr: date,
      depTime,
      arrTime,
      reportLeadMinutes: 60,
    });

    if ('error' in result) {
      setFormError(result.error);
      return;
    }

    onAddStandbyFlight(result.flight);
    onClose();
  };

  const handleCancelSubmit = () => {
    if (!flight) return;
    onCancelSector(flight.id);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-lg rounded-3xl border border-slate-800 bg-slate-950 p-6 shadow-2xl space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            {type === 'standby_callout' && (
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400">
                <Plane className="h-5 w-5" />
              </div>
            )}
            {type === 'cancel_sector' && (
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-500/20 text-rose-400">
                <AlertTriangle className="h-5 w-5" />
              </div>
            )}
            <div>
              <h3 className="font-bold text-white text-base">
                {type === 'standby_callout' && 'Add a callout flight'}
                {type === 'cancel_sector' && 'Cancel this flight'}
              </h3>
              <p className="text-xs text-slate-400">
                {type === 'standby_callout' && 'Crew control called you out for a flight. Add it to update your sleep plan and pay.'}
                {type === 'cancel_sector' && 'Flight cancelled? Your plan will leave it out.'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-xl border border-slate-800 bg-slate-900 p-2 text-slate-400 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* STANDBY CALLOUT FORM */}
        {type === 'standby_callout' && (
          <form onSubmit={handleStandbySubmit} className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1">
                  Flight Number
                </label>
                <input
                  type="text"
                  value={flightNumber}
                  onChange={(e) => setFlightNumber(e.target.value)}
                  placeholder="e.g. 6E 215"
                  required
                  className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-white font-mono focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1">
                  Duty Date
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-white font-mono focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1">
                  Origin Airport (IATA)
                </label>
                <input
                  type="text"
                  value={origin}
                  onChange={(e) => setOrigin(e.target.value.toUpperCase())}
                  maxLength={3}
                  required
                  className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-white font-mono uppercase focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1">
                  Destination (IATA)
                </label>
                <input
                  type="text"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value.toUpperCase())}
                  maxLength={3}
                  required
                  className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-white font-mono uppercase focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1">
                  Departure Time (24h, local at origin)
                </label>
                <TimeInput24 value={depTime} onChange={setDepTime} ariaLabel="Departure time, 24-hour" required className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-white font-mono focus:border-blue-500 focus:outline-none" />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1">
                  Arrival Time (24h, local at destination)
                </label>
                <TimeInput24 value={arrTime} onChange={setArrTime} ariaLabel="Arrival time, 24-hour" required className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-white font-mono focus:border-blue-500 focus:outline-none" />
              </div>
            </div>

            {formError && (
              <div role="alert" className="rounded-xl bg-rose-950/30 border border-rose-800/50 p-3 text-[11px] text-rose-200">
                {formError}
              </div>
            )}

            <div className="rounded-xl bg-amber-950/20 border border-amber-800/40 p-3 text-[11px] text-amber-200">
              Adding this flight updates your sleep, caffeine and wake-up plan for the day.
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-slate-800 hover:bg-slate-900 text-slate-300 font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition-colors"
              >
                <PlusCircle className="h-4 w-4" />
                <span>Add Flight to Schedule</span>
              </button>
            </div>
          </form>
        )}

        {/* CANCEL SECTOR FORM */}
        {type === 'cancel_sector' && flight && (
          <div className="space-y-4 text-xs">
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-3 flex items-center justify-between">
              <div>
                <span className="font-mono font-bold text-white text-sm">{flight.flightNumber}</span>
                <span className="text-slate-400 ml-2">({flight.origin} ➔ {flight.destination})</span>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Scheduled departure: {new Date(flight.departureTimeUtc).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              <span className="bg-rose-500/20 text-rose-300 border border-rose-500/40 px-2 py-0.5 rounded text-[10px] font-bold">
                Cancelling
              </span>
            </div>

            {/* What cancelling does: the plan leaves the flight out; where you rest follows from your other duties */}
            <div className="space-y-1 rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-[11px] text-slate-300">
              <p className="text-xs font-bold text-white">What happens</p>
              <p>
                Your plan leaves this flight out. You'll be planned as resting{' '}
                {flight.origin === homeBase ? 'at home' : `at ${flight.origin} (outstation)`} until your next duty.
              </p>
              <p className="text-slate-500">Your roster keeps the flight as published, so you can reinstate it on the Timeline or with Undo.</p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-slate-800 hover:bg-slate-900 text-slate-300 font-semibold"
              >
                Keep Flight
              </button>
              <button
                onClick={handleCancelSubmit}
                className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold transition-colors"
              >
                <span>Mark as cancelled</span>
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
