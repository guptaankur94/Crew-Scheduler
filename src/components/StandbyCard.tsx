import React, { useState } from 'react';
import { Plus, ShieldCheck } from 'lucide-react';
import { FlightLeg, RosterData, StandbyDuty, UserUpdate } from '../types/circadian';
import { rosterClock } from '../services/rosterKeys';
import { airportLocalToUtc } from '../data/airports';
import { buildManualFlight } from '../services/manualFlight';
import { TimeInput24, isValidTime24 } from './TimeInput24';

/**
 * Quick edits for a standby today or in the next 24 hours: called out, released early (or cancelled),
 * or times changed. Each is the person's update; the rostered standby stays as published, and
 * "Back to rostered" removes the change.
 */

export type StandbyChange =
  | { kind: 'times'; startUtc: string; endUtc: string }
  | { kind: 'released'; atUtc: string }
  | { kind: 'callout'; flights: FlightLeg[] }
  | { kind: 'clear' };

interface Props {
  roster: RosterData; // as published
  standby: StandbyDuty; // rostered standby
  update?: UserUpdate;
  onChange: (standbyId: string, change: StandbyChange) => void;
}

type Mode = 'none' | 'callout' | 'released' | 'times';
interface SectorDraft {
  flightNumber: string;
  origin: string;
  destination: string;
  dep: string;
  arr: string;
}

export const StandbyCard: React.FC<Props> = ({ roster, standby, update, onChange }) => {
  const clock = rosterClock(roster);
  const t = (iso: string) => clock.time(Date.parse(iso));
  const date = clock.date(Date.parse(standby.startUtc));
  const base = standby.airport || roster.homeBase;
  const [mode, setMode] = useState<Mode>('none');
  const [error, setError] = useState<string | null>(null);
  const [releasedAt, setReleasedAt] = useState(clock.time(Date.now()));
  const [start, setStart] = useState(t(standby.startUtc));
  const [end, setEnd] = useState(t(standby.endUtc));
  const [report, setReport] = useState('');
  const [sectors, setSectors] = useState<SectorDraft[]>([{ flightNumber: '', origin: base, destination: '', dep: '', arr: '' }]);

  /** A home-time HH:MM on the standby's day (or the next day when it falls before `after`). */
  const homeTime = (hhmm: string, after?: number): number | null => {
    const d = airportLocalToUtc(date, hhmm, roster.homeBase, roster.homeBaseTzOffset);
    if (!d) return null;
    let ms = d.getTime();
    if (after !== undefined && ms <= after) ms += 24 * 3600000;
    return ms;
  };
  const close = () => {
    setMode('none');
    setError(null);
  };

  const saveReleased = (cancelled: boolean) => {
    if (cancelled) return onChange(standby.id, { kind: 'released', atUtc: standby.startUtc }), close();
    const at = isValidTime24(releasedAt) ? homeTime(releasedAt, Date.parse(standby.startUtc) - 1) : null;
    if (at === null) return setError('Enter the time you were released, e.g. 09:30.');
    onChange(standby.id, { kind: 'released', atUtc: new Date(at).toISOString() });
    close();
  };

  const saveTimes = () => {
    const s = isValidTime24(start) ? homeTime(start) : null;
    const e = s !== null && isValidTime24(end) ? homeTime(end, s) : null;
    if (s === null || e === null) return setError('Enter the new start and end, e.g. 09:00 and 17:00.');
    onChange(standby.id, { kind: 'times', startUtc: new Date(s).toISOString(), endUtc: new Date(e).toISOString() });
    close();
  };

  const saveCallout = () => {
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
    onChange(standby.id, { kind: 'callout', flights });
    close();
  };

  const status = (() => {
    if (!update || update.kind === 'delay' || update.kind === 'cancelled') return null;
    if (update.kind === 'standby_times') return `Moved to ${t(update.startUtc)}–${t(update.endUtc)} (you)`;
    if (update.kind === 'standby_released')
      return Date.parse(update.atUtc) <= Date.parse(standby.startUtc) ? 'Cancelled (you)' : `Released at ${t(update.atUtc)} (you)`;
    return `Called out: ${update.flights.map((f) => `${f.flightNumber} ${f.origin}→${f.destination} ${t(f.departureTimeUtc)}`).join(', ')} (you)`;
  })();

  const input = 'rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 font-mono text-xs text-slate-100';
  const button = 'rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:border-slate-500';

  return (
    <section className="rounded-2xl border border-purple-800/50 bg-purple-950/10 p-4 text-sm shadow-sm" aria-label="Standby">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-0.5">
          <p className="flex items-center gap-2 font-semibold text-white">
            <ShieldCheck className="h-4 w-4 text-purple-300" />
            {standby.kind === 'home' ? 'Home standby' : 'Airport standby'} {t(standby.startUtc)}–{t(standby.endUtc)}
            <span className="text-xs font-normal text-slate-500">rostered</span>
          </p>
          {status && <p className="text-xs text-amber-300">{status}</p>}
          {status && <p className="text-[11px] text-slate-500">Your plan uses this. The rostered standby stays as published.</p>}
        </div>
        {mode === 'none' && (
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setMode('callout')} className={button}>
              Called out
            </button>
            <button onClick={() => setMode('released')} className={button}>
              Released early
            </button>
            <button onClick={() => setMode('times')} className={button}>
              Times changed
            </button>
            {status && (
              <button onClick={() => onChange(standby.id, { kind: 'clear' })} className="px-2 text-xs font-semibold text-slate-400 hover:text-white">
                Back to rostered
              </button>
            )}
          </div>
        )}
      </div>

      {mode !== 'none' && (
        <div className="mt-3 space-y-3 border-t border-slate-800 pt-3 text-xs text-slate-300">
          {mode === 'released' && (
            <div className="flex flex-wrap items-center gap-2">
              <span>Released at</span>
              <TimeInput24 value={releasedAt} onChange={setReleasedAt} className={`${input} w-20`} ariaLabel="Released at (home time)" />
              <button onClick={() => saveReleased(false)} className="rounded-lg bg-blue-600 px-3 py-1.5 font-semibold text-white hover:bg-blue-500">
                Save
              </button>
              <span className="text-slate-500">or</span>
              <button onClick={() => saveReleased(true)} className={button}>
                Standby was cancelled
              </button>
            </div>
          )}

          {mode === 'times' && (
            <div className="flex flex-wrap items-center gap-2">
              <span>New times</span>
              <TimeInput24 value={start} onChange={setStart} className={`${input} w-20`} ariaLabel="New standby start (home time)" />
              <span>–</span>
              <TimeInput24 value={end} onChange={setEnd} className={`${input} w-20`} ariaLabel="New standby end (home time)" />
              <button onClick={saveTimes} className="rounded-lg bg-blue-600 px-3 py-1.5 font-semibold text-white hover:bg-blue-500">
                Save
              </button>
            </div>
          )}

          {mode === 'callout' && (
            <div className="space-y-2">
              <p className="text-slate-400">Enter the flight(s) you were called out for. Times are local at each airport.</p>
              <label className="flex items-center gap-2">
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
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setSectors([...sectors, { flightNumber: '', origin: sectors[sectors.length - 1].destination, destination: '', dep: '', arr: '' }])}
                  className="inline-flex items-center gap-1 text-slate-400 hover:text-white"
                >
                  <Plus className="h-3.5 w-3.5" /> Add another sector
                </button>
                <button onClick={saveCallout} className="rounded-lg bg-blue-600 px-3 py-1.5 font-semibold text-white hover:bg-blue-500">
                  Save callout
                </button>
              </div>
            </div>
          )}

          {error && <p className="text-rose-300">{error}</p>}
          <button onClick={close} className="font-semibold text-slate-400 hover:text-white">
            Cancel
          </button>
        </div>
      )}
    </section>
  );
};
