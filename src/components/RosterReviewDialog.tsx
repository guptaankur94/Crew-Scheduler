import React, { useCallback, useMemo, useState } from 'react';
import { FlightLeg } from '../types/circadian';
import { getAirportTzOffset, isKnownAirport } from '../data/airports';
import { convertPrinted, normaliseClock, printedFrom, TIME_CONVENTION_LABEL, TimeConvention } from '../services/rosterTimes';
import { checkRosterFlights, hasBlockingProblems, RosterIssue } from '../services/rosterChecks';
import { AlertTriangle, CheckCircle2, Trash2, X } from 'lucide-react';
import { TimeInput24 } from './TimeInput24';

const MIN = 60_000;

export interface ReviewPreview {
  name: string;
  url?: string; // image preview; PDFs have none
}

export interface Draft {
  key: string;
  original: FlightLeg;
  flightNumber: string;
  origin: string;
  destination: string;
  date: string; // local date of departure at the origin
  dep: string; // HH:mm local at origin
  arr: string; // HH:mm local at destination
}

/**
 * A row as the person sees it: times as printed on the roster, in the clock the roster uses (by default each
 * airport's local time). Changing the clock setting re-reads the same printed times.
 */
export function toDraft(f: FlightLeg, convention: TimeConvention = 'local', homeBase = ''): Draft {
  const p = f.printed && (f.timeConvention ?? 'local') === convention ? f.printed : printedFrom(f, convention, homeBase || f.origin);
  return { key: f.id, original: f, flightNumber: f.flightNumber, origin: f.origin, destination: f.destination, date: p.date, dep: p.dep, arr: p.arr };
}

/** Turns an edited row back into a flight, keeping the roster's report and release buffers. */
export function fromDraft(d: Draft, convention: TimeConvention = 'local', homeBase = ''): FlightLeg | null {
  const origin = d.origin.trim().toUpperCase();
  const destination = d.destination.trim().toUpperCase();
  if (!d.dep || !d.arr || !normaliseClock(d.dep) || !normaliseClock(d.arr)) return null;
  // An unknown airport only keeps the offset it arrived with (already flagged as unverified); a newly typed
  // unknown code gets no time zone at all, so the row cannot be saved until it is corrected
  const o = d.original;
  const c = convertPrinted({ date: d.date, dep: d.dep, arr: d.arr }, { origin, destination }, convention, homeBase || origin, {
    origin: origin === o.origin ? o.originTzOffset : undefined,
    destination: destination === o.destination ? o.destTzOffset : undefined,
  });
  if ('error' in c) return null;
  const dep = Date.parse(c.departureTimeUtc);
  const arr = Date.parse(c.arrivalTimeUtc);
  const reportLead = Date.parse(o.departureTimeUtc) - Date.parse(o.reportTimeUtc);
  const releaseLag = Date.parse(o.releaseTimeUtc) - Date.parse(o.arrivalTimeUtc);
  const flight: FlightLeg = {
    ...o,
    flightNumber: d.flightNumber.trim().toUpperCase() || o.flightNumber,
    origin,
    destination,
    departureTimeUtc: c.departureTimeUtc,
    arrivalTimeUtc: c.arrivalTimeUtc,
    reportTimeUtc: new Date(dep - reportLead).toISOString(),
    releaseTimeUtc: new Date(arr + releaseLag).toISOString(),
    originTzOffset: getAirportTzOffset(origin, new Date(dep)) ?? o.originTzOffset,
    destTzOffset: getAirportTzOffset(destination, new Date(arr)) ?? o.destTzOffset,
    durationMinutes: c.durationMinutes,
    tzUnverified: !isKnownAirport(origin) || !isKnownAirport(destination) ? true : undefined,
    timeConvention: convention,
  };
  return { ...flight, printed: printedFrom(flight, convention, homeBase || origin) };
}

interface RosterReviewDialogProps {
  flights: FlightLeg[];
  previews: ReviewPreview[];
  serverWarnings: string[];
  onConfirm: (flights: FlightLeg[], convention: TimeConvention) => void;
  onCancel: () => void;
  /** The clock the roster's times are in (as stated by the roster, or the person's setting). */
  convention: TimeConvention;
  /** True when the roster itself says which clock it uses. */
  conventionStated?: boolean;
  homeBase: string;
}

const inputClass =
  'block rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 font-mono text-xs text-white focus:border-blue-500 focus:outline-none';

const RosterReviewDialog: React.FC<RosterReviewDialogProps> = ({ flights, previews, serverWarnings, onConfirm, onCancel, convention: initialConvention, conventionStated, homeBase }) => {
  // The rows hold times as printed; the clock setting decides how they are read, so changing it re-reads them
  const [convention, setConvention] = useState<TimeConvention>(initialConvention);
  const [drafts, setDrafts] = useState<Draft[]>(() =>
    [...flights].sort((a, b) => Date.parse(a.departureTimeUtc) - Date.parse(b.departureTimeUtc)).map((f) => toDraft(f, initialConvention, homeBase))
  );

  const built = useMemo(() => drafts.map((d) => ({ draft: d, flight: fromDraft(d, convention, homeBase) })), [drafts, convention, homeBase]);
  const issues = useMemo(() => {
    const valid = built.filter((b) => b.flight).map((b) => b.flight!) as FlightLeg[];
    const map = checkRosterFlights(valid);
    for (const b of built) {
      if (!b.flight) map.set(b.draft.key, [{ level: 'problem', message: 'Enter a valid date and times' }]);
    }
    return map;
  }, [built]);

  const problems = [...issues.values()].filter((l) => l.some((i) => i.level === 'problem')).length;
  const checks = [...issues.values()].filter((l) => l.every((i) => i.level === 'check')).length;
  const blocked = hasBlockingProblems(issues) || drafts.length === 0;

  const update = (key: string, field: keyof Omit<Draft, 'key' | 'original'>, value: string) =>
    setDrafts((prev) => prev.map((d) => (d.key === key ? { ...d, [field]: value } : d)));
  const remove = (key: string) => setDrafts((prev) => prev.filter((d) => d.key !== key));

  return (
    <div className="fixed inset-0 z-[60] flex items-stretch justify-center bg-black/80 p-2 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="review-title">
      <div className="flex w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-800 p-4">
          <div>
            <h2 id="review-title" className="text-lg font-bold text-white">
              Check your roster before saving
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              We read {drafts.length} flight{drafts.length === 1 ? '' : 's'}. Compare them with your roster and fix anything
              that is wrong. Times are shown exactly as printed.
            </p>
            <label className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-300">
              <span>Times on this roster are in</span>
              <select
                value={convention}
                onChange={(e) => setConvention(e.target.value as TimeConvention)}
                aria-label="Which clock the roster's times are in"
                className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-white"
              >
                {(Object.keys(TIME_CONVENTION_LABEL) as TimeConvention[]).map((c) => (
                  <option key={c} value={c}>
                    {TIME_CONVENTION_LABEL[c]}
                  </option>
                ))}
              </select>
              <span className="text-slate-500">{conventionStated ? '(as stated on the roster)' : '(your setting; e.g. a Singapore arrival in Singapore time)'}</span>
            </label>
            <p className="mt-1 text-xs">
              {problems > 0 && <span className="mr-3 text-rose-300">{problems} need fixing</span>}
              {checks > 0 && <span className="mr-3 text-amber-300">{checks} worth a second look</span>}
              {problems === 0 && checks === 0 && drafts.length > 0 && <span className="text-emerald-300">No problems found</span>}
            </p>
          </div>
          <button onClick={onCancel} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid flex-1 grid-cols-1 gap-4 overflow-y-auto p-4 lg:grid-cols-5">
          {/* Original document */}
          {previews.length > 0 && (
            <div className="space-y-2 lg:col-span-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Your original</p>
              {previews.map((p, i) =>
                p.url ? (
                  <img key={i} src={p.url} alt={p.name} className="w-full rounded-xl border border-slate-800 bg-white object-contain" />
                ) : (
                  <p key={i} className="rounded-xl border border-slate-800 bg-slate-950 p-3 text-xs text-slate-400">
                    {p.name} (open it separately to compare)
                  </p>
                )
              )}
            </div>
          )}

          {/* Flights */}
          <div className={`space-y-2 ${previews.length > 0 ? 'lg:col-span-3' : 'lg:col-span-5'}`}>
            {serverWarnings.length > 0 && (
              <div className="rounded-xl border border-amber-800/60 bg-amber-950/30 p-3 text-xs text-amber-200">
                <p className="font-bold">Some lines could not be read and were left out:</p>
                <ul className="mt-1 list-disc space-y-0.5 pl-5">
                  {serverWarnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
                <p className="mt-1">You can add missing flights later from Roster &amp; History → Add flight.</p>
              </div>
            )}

            {drafts.map((d) => {
              const rowIssues: RosterIssue[] = issues.get(d.key) ?? [];
              const isProblem = rowIssues.some((i) => i.level === 'problem');
              const isCheck = !isProblem && rowIssues.length > 0;
              return (
                <div
                  key={d.key}
                  className={`rounded-xl border p-3 ${
                    isProblem ? 'border-rose-700/70 bg-rose-950/20' : isCheck ? 'border-amber-700/60 bg-amber-950/10' : 'border-slate-800 bg-slate-950/60'
                  }`}
                >
                  <div className="flex flex-wrap items-end gap-2">
                    <label className="text-[10px] text-slate-400">
                      Flight
                      <input className={`${inputClass} w-28`} value={d.flightNumber} onChange={(e) => update(d.key, 'flightNumber', e.target.value)} />
                    </label>
                    <label className="text-[10px] text-slate-400">
                      From
                      <input className={`${inputClass} w-[4.5rem] uppercase`} maxLength={3} value={d.origin} onChange={(e) => update(d.key, 'origin', e.target.value.toUpperCase())} />
                    </label>
                    <label className="text-[10px] text-slate-400">
                      To
                      <input className={`${inputClass} w-[4.5rem] uppercase`} maxLength={3} value={d.destination} onChange={(e) => update(d.key, 'destination', e.target.value.toUpperCase())} />
                    </label>
                    <label className="text-[10px] text-slate-400">
                      Date
                      <input type="date" className={`${inputClass} w-[10.5rem]`} value={d.date} onChange={(e) => update(d.key, 'date', e.target.value)} />
                    </label>
                    <label className="text-[10px] text-slate-400">
                      Departs (24h, as printed)
                      <TimeInput24 className={inputClass} ariaLabel="Departure time, 24-hour, as printed" value={d.dep} onChange={(v) => update(d.key, 'dep', v)} />
                    </label>
                    <label className="text-[10px] text-slate-400">
                      Arrives (24h, as printed)
                      <TimeInput24 className={inputClass} ariaLabel="Arrival time, 24-hour, as printed" value={d.arr} onChange={(v) => update(d.key, 'arr', v)} />
                    </label>
                    <button
                      onClick={() => remove(d.key)}
                      className="ml-auto flex items-center justify-center gap-1 rounded-lg border border-slate-700 px-2 py-1.5 text-xs text-slate-300 hover:border-rose-700 hover:text-rose-300"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Remove
                    </button>
                  </div>
                  {rowIssues.length > 0 && (
                    <ul className="mt-2 space-y-0.5 text-[11px]">
                      {rowIssues.map((i, n) => (
                        <li key={n} className={`flex items-center gap-1.5 ${i.level === 'problem' ? 'text-rose-300' : 'text-amber-300'}`}>
                          <AlertTriangle className="h-3 w-3 shrink-0" /> {i.message}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-col gap-2 border-t border-slate-800 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[11px] text-slate-500">
            {blocked && drafts.length > 0 ? 'Fix or remove the rows marked in red to save.' : 'Nothing is saved until you press Save.'}
          </p>
          <div className="flex gap-2">
            <button onClick={onCancel} className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-800">
              Don't save
            </button>
            <button
              onClick={() => onConfirm(built.map((b) => b.flight!).filter(Boolean), convention)}
              disabled={blocked}
              className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <CheckCircle2 className="h-4 w-4" /> Save {drafts.length} flight{drafts.length === 1 ? '' : 's'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Shows the review screen and resolves with the confirmed flights, or null if the user chose not to save.
 * Render `dialog` somewhere in the component.
 */
/** How the roster's times should be read in the review. */
export interface ReviewTimes {
  convention: TimeConvention;
  stated?: boolean;
  homeBase: string;
}

export function useRosterReview() {
  const [pending, setPending] = useState<{
    flights: FlightLeg[];
    previews: ReviewPreview[];
    warnings: string[];
    times: ReviewTimes;
    resolve: (result: { flights: FlightLeg[]; convention: TimeConvention } | null) => void;
  } | null>(null);

  const reviewFlights = useCallback(
    (flights: FlightLeg[], previews: ReviewPreview[], warnings: string[] = [], times: ReviewTimes = { convention: 'local', homeBase: '' }): Promise<{ flights: FlightLeg[]; convention: TimeConvention } | null> =>
      new Promise((resolve) => setPending({ flights, previews, warnings, times, resolve })),
    []
  );

  const dialog = pending ? (
    <RosterReviewDialog
      flights={pending.flights}
      previews={pending.previews}
      serverWarnings={pending.warnings}
      convention={pending.times.convention}
      conventionStated={pending.times.stated}
      homeBase={pending.times.homeBase}
      onConfirm={(flights, convention) => {
        pending.resolve({ flights, convention });
        setPending(null);
      }}
      onCancel={() => {
        pending.resolve(null);
        setPending(null);
      }}
    />
  ) : null;

  return { reviewFlights, dialog };
}
