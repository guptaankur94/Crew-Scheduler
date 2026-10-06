import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { FlightLeg, RosterData } from '../types/circadian';
import { airportLocalToUtc } from '../data/airports';
import { buildManualFlight } from '../services/manualFlight';
import { TimeInput24, isValidTime24 } from './TimeInput24';

/**
 * "Called out": the flight(s) crew control called you out for, on a standby or on a day off.
 * The one form used everywhere a callout can be recorded. Sector times are as printed (local at each airport).
 */

interface Props {
  roster: RosterData;
  /** Home date of the callout. */
  date: string;
  /** Where the first sector leaves from (the standby airport, or home base). */
  base: string;
  onSave: (flights: FlightLeg[]) => void;
  onCancel: () => void;
}

interface SectorDraft {
  flightNumber: string;
  origin: string;
  destination: string;
  dep: string;
  arr: string;
}

const input = 'rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 font-mono text-xs text-slate-100';

export const CalloutForm: React.FC<Props> = ({ roster, date, base, onSave, onCancel }) => {
  const [report, setReport] = useState('');
  const [sectors, setSectors] = useState<SectorDraft[]>([{ flightNumber: '', origin: base, destination: '', dep: '', arr: '' }]);
  const [error, setError] = useState<string | null>(null);

  /** A home-time HH:MM on the callout's day. */
  const homeTime = (hhmm: string): number | null => airportLocalToUtc(date, hhmm, roster.homeBase, roster.homeBaseTzOffset)?.getTime() ?? null;

  const save = () => {
    const flights: FlightLeg[] = [];
    for (const [i, s] of sectors.entries()) {
      // Report time applies to the first sector; later sectors report on arrival of the previous one
      const firstDep = isValidTime24(s.dep) ? homeTime(s.dep) : null;
      const reportMs = i === 0 && report && isValidTime24(report) ? homeTime(report) : null;
      const lead = i === 0 && reportMs !== null && firstDep !== null ? Math.max(0, Math.round((firstDep - reportMs) / 60000)) : 60;
      const built = buildManualFlight({
        id: `callout-${Date.now()}-${i}`,
        flightNumber: s.flightNumber,
        origin: s.origin,
        destination: s.destination,
        dateStr: date,
        depTime: s.dep,
        arrTime: s.arr,
        reportLeadMinutes: lead,
      });
      if ('error' in built) return setError(`Sector ${i + 1}: ${built.error}`);
      flights.push(built.flight);
    }
    onSave(flights);
  };

  return (
    <div className="space-y-2 text-xs text-slate-300">
      <p className="text-slate-400">Enter the flight(s) you were called out for. Times are local at each airport.</p>
      <label className="flex flex-wrap items-center gap-2">
        <span>Report time</span>
        <TimeInput24 value={report} onChange={setReport} className={`${input} w-20`} ariaLabel="Report time (home time)" />
        <span className="text-slate-500">optional; if left empty, 60 min before the first departure</span>
      </label>
      {sectors.map((s, i) => (
        <div key={i} className="flex flex-wrap items-center gap-1.5">
          <span className="w-14 text-slate-500">Sector {i + 1}</span>
          {(
            [
              ['flightNumber', 'Flight', 'w-20'],
              ['origin', 'From', 'w-14'],
              ['destination', 'To', 'w-14'],
            ] as const
          ).map(([field, placeholder, width]) => (
            <input
              key={field}
              value={s[field]}
              onChange={(e) => setSectors(sectors.map((x, j) => (j === i ? { ...x, [field]: e.target.value.toUpperCase() } : x)))}
              placeholder={placeholder}
              aria-label={`Sector ${i + 1} ${placeholder}`}
              className={`${input} ${width}`}
            />
          ))}
          <TimeInput24 value={s.dep} onChange={(v) => setSectors(sectors.map((x, j) => (j === i ? { ...x, dep: v } : x)))} className={`${input} w-20`} ariaLabel={`Sector ${i + 1} departure`} />
          <span>→</span>
          <TimeInput24 value={s.arr} onChange={(v) => setSectors(sectors.map((x, j) => (j === i ? { ...x, arr: v } : x)))} className={`${input} w-20`} ariaLabel={`Sector ${i + 1} arrival`} />
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setSectors([...sectors, { flightNumber: '', origin: sectors[sectors.length - 1].destination, destination: '', dep: '', arr: '' }])}
          className="inline-flex items-center gap-1 text-slate-400 hover:text-white"
        >
          <Plus className="h-3.5 w-3.5" /> Add another sector
        </button>
        <button onClick={save} className="rounded-lg bg-blue-600 px-3 py-1.5 font-semibold text-white hover:bg-blue-500">
          Save callout
        </button>
        <button onClick={onCancel} className="font-semibold text-slate-400 hover:text-white">
          Cancel
        </button>
      </div>
      {error && <p className="text-rose-300">{error}</p>}
    </div>
  );
};
