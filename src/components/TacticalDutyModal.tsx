import React, { useState } from 'react';
import { FlightLeg } from '../types/circadian';
import { getAirportTzOffset } from '../data/airports';
import { buildManualFlight } from '../services/manualFlight';
import {
  Plane,
  X,
  PlusCircle,
  AlertTriangle,
  Hotel,
  Clock,
  Trash2,
  Calendar,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';

export type TacticalModalType = 'standby_callout' | 'cancel_sector' | 'delay_sector';

interface TacticalDutyModalProps {
  type: TacticalModalType;
  flight?: FlightLeg;
  defaultDate?: string;
  homeBase?: string;
  onAddStandbyFlight: (newFlight: FlightLeg) => void;
  onCancelSector: (flightId: string, convertToLayover: boolean) => void;
  onDelaySector: (flightId: string, delayMinutes: number) => void;
  onClose: () => void;
}

export const TacticalDutyModal: React.FC<TacticalDutyModalProps> = ({
  type,
  flight,
  defaultDate = new Date().toISOString().slice(0, 10),
  homeBase = 'DEL',
  onAddStandbyFlight,
  onCancelSector,
  onDelaySector,
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
  
  // Delay form state
  const [delayMinutes, setDelayMinutes] = useState(60);

  // Cancel form state
  const [convertToLayover, setConvertToLayover] = useState(true);

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
      fallbackTzOffset: getAirportTzOffset(homeBase, new Date()) ?? 5.5,
    });

    if ('error' in result) {
      setFormError(result.error);
      return;
    }

    onAddStandbyFlight(result.flight);
    onClose();
  };

  const handleDelaySubmit = () => {
    if (!flight) return;
    onDelaySector(flight.id, delayMinutes);
    onClose();
  };

  const handleCancelSubmit = () => {
    if (!flight) return;
    onCancelSector(flight.id, convertToLayover);
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
            {type === 'delay_sector' && (
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/20 text-sky-400">
                <Clock className="h-5 w-5" />
              </div>
            )}
            <div>
              <h3 className="font-bold text-white text-base">
                {type === 'standby_callout' && 'Standby Callout: Add Flight Duty'}
                {type === 'cancel_sector' && 'Tactical Duty Modification: Cancel Sector'}
                {type === 'delay_sector' && `Flight Delay Adjustment: ${flight?.flightNumber}`}
              </h3>
              <p className="text-xs text-slate-400">
                {type === 'standby_callout' && 'Crew dispatch called you out for a flight. Add it to update sleep & pay.'}
                {type === 'cancel_sector' && 'Sector got cancelled or crew timed out? Convert to layover or return.'}
                {type === 'delay_sector' && 'Recalculate rest and fatigue limits based on new departure time.'}
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
                  Departure Time (Local at Origin)
                </label>
                <input
                  type="time"
                  value={depTime}
                  onChange={(e) => setDepTime(e.target.value)}
                  required
                  className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-white font-mono focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1">
                  Arrival Time (Local at Destination)
                </label>
                <input
                  type="time"
                  value={arrTime}
                  onChange={(e) => setArrTime(e.target.value)}
                  required
                  className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-white font-mono focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            {formError && (
              <div role="alert" className="rounded-xl bg-rose-950/30 border border-rose-800/50 p-3 text-[11px] text-rose-200">
                {formError}
              </div>
            )}

            <div className="rounded-xl bg-amber-950/20 border border-amber-800/40 p-3 text-[11px] text-amber-200">
              💡 <strong>Instant Recalculation:</strong> Adding this sector will convert standby hours into flying hours, recalculate your salary breakdown, and schedule immediate pre-flight wake-up alarms.
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

            <div className="space-y-2">
              <label className="font-bold text-slate-200 block">Where are you resting?</label>
              
              <div
                onClick={() => setConvertToLayover(true)}
                className={`p-3 rounded-xl border cursor-pointer transition-all ${
                  convertToLayover
                    ? 'border-indigo-500 bg-indigo-950/30 ring-1 ring-indigo-500'
                    : 'border-slate-800 bg-slate-900/60'
                }`}
              >
                <div className="flex items-center gap-2 font-bold text-white">
                  <Hotel className="h-4 w-4 text-indigo-400" />
                  <span>Convert to Hotel Layover at {flight.origin}</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Flight got cancelled at the outstation. Automatically triggers hotel blackout guidance, local recovery sleep, and station rest per diem.
                </p>
              </div>

              <div
                onClick={() => setConvertToLayover(false)}
                className={`p-3 rounded-xl border cursor-pointer transition-all ${
                  !convertToLayover
                    ? 'border-blue-500 bg-blue-950/30 ring-1 ring-blue-500'
                    : 'border-slate-800 bg-slate-900/60'
                }`}
              >
                <div className="flex items-center gap-2 font-bold text-white">
                  <Trash2 className="h-4 w-4 text-rose-400" />
                  <span>Just Remove Sector (Resting at Base)</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Flight was dropped in advance; return to baseline home rest schedule.
                </p>
              </div>
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
                <span>Confirm Tactical Change</span>
              </button>
            </div>
          </div>
        )}

        {/* DELAY SECTOR FORM */}
        {type === 'delay_sector' && flight && (
          <div className="space-y-4 text-xs">
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
              <span className="font-mono font-bold text-white text-sm">{flight.flightNumber}</span>
              <span className="text-slate-400 ml-2">({flight.origin} ➔ {flight.destination})</span>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-2">
                Select Delay Duration:
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[30, 60, 90, 120].map((mins) => (
                  <button
                    key={mins}
                    onClick={() => setDelayMinutes(mins)}
                    className={`py-2 rounded-xl font-mono text-xs font-bold border transition-all ${
                      delayMinutes === mins
                        ? 'border-sky-500 bg-sky-600 text-white shadow-sm'
                        : 'border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    +{mins}m
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-slate-800 hover:bg-slate-900 text-slate-300 font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleDelaySubmit}
                className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold transition-colors"
              >
                <Clock className="h-4 w-4" />
                <span>Apply +{delayMinutes}m Delay</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
