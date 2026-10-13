import React, { useState } from 'react';
import { Clock } from 'lucide-react';
import { FlightLeg, RosterData } from '../types/circadian';
import { rosterClock } from '../services/rosterKeys';

/**
 * One-tap "I'm delayed" for the next flight (or the one in progress). The delay is the person's update:
 * the rostered report time stays as published, and the plan after the duty moves to the later times.
 */

interface Props {
  roster: RosterData; // as published (rostered times)
  flight: FlightLeg; // rostered flight
  delayMinutes: number;
  /** When the whole duty is now expected to finish (later flights that day included). */
  expectedReleaseUtc?: string;
  onSetDelay: (flightId: string, minutes: number) => void;
}

const QUICK = [30, 60, 120];
const label = (m: number) => (m % 60 === 0 ? `+${m / 60} h` : `+${m} min`);

export const DelayCard: React.FC<Props> = ({ roster, flight, delayMinutes, expectedReleaseUtc, onSetDelay }) => {
  const [choosing, setChoosing] = useState(false);
  const [custom, setCustom] = useState('');
  const clock = rosterClock(roster);
  const t = (iso: string, plus = 0) => clock.time(Date.parse(iso) + plus * 60000);
  const route = `${flight.flightNumber} ${flight.origin}→${flight.destination}`;
  const set = (m: number) => {
    onSetDelay(flight.id, m);
    setChoosing(false);
    setCustom('');
  };
  const customMinutes = Number(custom);
  const customValid = Number.isInteger(customMinutes) && customMinutes > 0 && customMinutes <= 24 * 60;

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-sm shadow-sm" aria-label="Flight delay">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-0.5">
          <p className="flex items-center gap-2 font-semibold text-white">
            <Clock className="h-4 w-4 text-slate-400" />
            {route}
            {delayMinutes > 0 && <span className="rounded-full border border-amber-700/60 px-2 py-0.5 text-[10px] font-semibold text-amber-300">Delayed +{delayMinutes} min (you)</span>}
          </p>
          {delayMinutes > 0 ? (
            <>
              <p className="text-xs text-slate-300">
                Expected departure <strong className="font-mono text-white">{t(flight.departureTimeUtc, delayMinutes)}</strong>{' '}
                <span className="text-slate-500">(rostered {t(flight.departureTimeUtc)})</span> · duty ends around{' '}
                <span className="font-mono">{t(expectedReleaseUtc ?? flight.releaseTimeUtc, expectedReleaseUtc ? 0 : delayMinutes)}</span>
              </p>
              <p className="text-xs text-slate-400">
                Your rostered report time is unchanged: <span className="font-mono">{t(flight.reportTimeUtc)}</span>. If crew control moves it, follow their
                instruction. Your plan after this duty has moved to the later finish.
              </p>
            </>
          ) : (
            <p className="text-xs text-slate-400">
              Departs <span className="font-mono">{t(flight.departureTimeUtc)}</span> · report <span className="font-mono">{t(flight.reportTimeUtc)}</span> (home time)
            </p>
          )}
        </div>
        {!choosing && (
          <div className="flex shrink-0 gap-2">
            {delayMinutes > 0 && (
              <button onClick={() => set(0)} className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-400 hover:text-white">
                Remove delay
              </button>
            )}
            <button
              onClick={() => setChoosing(true)}
              className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:border-slate-500"
            >
              {delayMinutes > 0 ? 'Change' : "I'm delayed"}
            </button>
          </div>
        )}
      </div>

      {choosing && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-800 pt-3">
          <span className="text-xs text-slate-400">How late is the departure?</span>
          {QUICK.map((m) => (
            <button
              key={m}
              onClick={() => set(m)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${m === delayMinutes ? 'border-blue-500 text-white' : 'border-slate-700 text-slate-200 hover:border-slate-500'}`}
            >
              {label(m)}
            </button>
          ))}
          <label className="flex items-center gap-1.5 text-xs text-slate-400">
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={1440}
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              placeholder="min"
              aria-label="Delay in minutes"
              className="w-16 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 font-mono text-slate-100"
            />
            minutes
          </label>
          <button
            onClick={() => customValid && set(customMinutes)}
            disabled={!customValid}
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-40"
          >
            Set
          </button>
          <button onClick={() => setChoosing(false)} className="text-xs font-semibold text-slate-400 hover:text-white">
            Cancel
          </button>
        </div>
      )}
    </section>
  );
};
