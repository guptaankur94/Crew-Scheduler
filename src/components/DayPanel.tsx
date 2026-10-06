import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ArrowRight, CheckCircle2, Plus, Trash2, Wrench, X } from 'lucide-react';
import { FlightLeg, OtherDuty, RosterData, StandbyDuty } from '../types/circadian';
import { Finding } from '../services/rosterFindings';
import { clockIn, convertPrinted, normaliseClock, printedFrom, TIME_CONVENTION_LABEL, TimeConvention } from '../services/rosterTimes';
import { airportLocalToUtc, getAirportTzOffset, isKnownAirport } from '../data/airports';
import { flightHomeDate, rosterClock, standbyHomeDate } from '../services/rosterKeys';
import { flightSource } from '../services/provenance';
import { TimeInput24 } from './TimeInput24';
import { dutyPositions } from '../services/dutyTimes';

/**
 * One day of the roster, to check and correct: what was read (times as printed), anything doubtful with a
 * one-tap fix where possible, editing of flights, standby and the kind of day, a "Looks right" tick, and a
 * way into the Timeline. Edits here are corrections of what the roster says (saved with Undo), not updates
 * such as delays.
 */

export interface DayItems {
  flights: FlightLeg[];
  standby: StandbyDuty[];
  otherDuties: OtherDuty[];
}

interface Props {
  date: string;
  roster: RosterData; // as published
  findings: Finding[];
  convention: TimeConvention;
  checked: boolean;
  onToggleChecked: (checked: boolean) => void;
  onSave: (date: string, next: DayItems) => void;
  onApplyFix: (fix: NonNullable<Finding['fix']>) => void;
  onOpenTimeline: (date: string) => void;
  onClose: () => void;
  /** The person's own updates on this day (delays, callouts, cancellations, standby changes), in plain words. */
  updates?: string[];
}

interface FlightDraft {
  key: string;
  original?: FlightLeg;
  flightNumber: string;
  origin: string;
  destination: string;
  date: string;
  dep: string;
  arr: string;
  report: string;
  release: string;
  positioning: boolean;
}
interface StandbyDraft {
  key: string;
  original?: StandbyDuty;
  kind: 'home' | 'airport';
  start: string;
  end: string;
}

const DAY_KINDS: { value: OtherDuty['kind'] | 'none'; label: string }[] = [
  { value: 'none', label: 'No duty (nothing listed)' },
  { value: 'off', label: 'Day off' },
  { value: 'leave', label: 'Leave' },
  { value: 'sick', label: 'Sick' },
  { value: 'training', label: 'Training' },
  { value: 'other', label: 'Other duty' },
];

const input = 'rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 font-mono text-xs text-white focus:border-blue-500 focus:outline-none';

export const DayPanel: React.FC<Props> = ({ date, roster, findings, convention, checked, onToggleChecked, onSave, onApplyFix, onOpenTimeline, onClose, updates = [] }) => {
  // Keyboard: focus moves into the panel when it opens, Escape closes it, and focus returns where it was
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      opener?.focus?.();
    };
  }, []);
  const clock = rosterClock(roster);
  const homeBase = roster.homeBase;
  const dayFlights = roster.flights.filter((f) => flightHomeDate(f, clock) === date).sort((a, b) => a.departureTimeUtc.localeCompare(b.departureTimeUtc));
  const dayStandby = (roster.standbyDuties ?? []).filter((s) => standbyHomeDate(s, clock) === date);
  const dayOther = (roster.otherDuties ?? []).filter((d) => d.date === date);

  // Check-in belongs to a duty's first sector and debrief to its last (duties can run past midnight)
  const positions = useMemo(() => dutyPositions(roster.flights), [roster.flights]);

  const toDraft = (f: FlightLeg): FlightDraft => {
    const p = f.printed && (f.timeConvention ?? 'local') === convention ? f.printed : printedFrom(f, convention, homeBase);
    return { key: f.id, original: f, flightNumber: f.flightNumber, origin: f.origin, destination: f.destination, date: p.date, dep: p.dep, arr: p.arr, report: p.report ?? '', release: p.release ?? '', positioning: !!f.isPositioning };
  };
  const [flights, setFlights] = useState<FlightDraft[]>(() => dayFlights.map(toDraft));
  const [standby, setStandby] = useState<StandbyDraft[]>(() =>
    dayStandby.map((s) => ({ key: s.id, original: s, kind: s.kind, start: clock.time(Date.parse(s.startUtc)), end: clock.time(Date.parse(s.endUtc)) }))
  );
  const [dayKind, setDayKind] = useState<OtherDuty['kind'] | 'none'>(dayOther[0]?.kind ?? 'none');

  // Turn the drafts back into roster entries (times read in the chosen clock)
  const built = useMemo(() => {
    const errors: string[] = [];
    const outFlights: FlightLeg[] = [];
    flights.forEach((d, i) => {
      const origin = d.origin.trim().toUpperCase();
      const destination = d.destination.trim().toUpperCase();
      if (!/^[A-Z]{3}$/.test(origin) || !/^[A-Z]{3}$/.test(destination) || !isKnownAirport(origin) || !isKnownAirport(destination)) {
        errors.push(`Flight ${i + 1}: enter known 3-letter airport codes.`);
        return;
      }
      const printed = { date: d.date, dep: d.dep, arr: d.arr, ...(normaliseClock(d.report) ? { report: d.report } : {}), ...(normaliseClock(d.release) ? { release: d.release } : {}) };
      const c = convertPrinted(printed, { origin, destination }, convention, homeBase);
      if ('error' in c) {
        errors.push(`Flight ${i + 1}: ${c.error}.`);
        return;
      }
      // A sector in the middle of a duty has no check-in or debrief of its own
      const pos = d.original ? positions.get(d.original.id) : undefined;
      if (pos && !pos.first) c.reportTimeUtc = c.departureTimeUtc;
      if (pos && !pos.last) c.releaseTimeUtc = c.arrivalTimeUtc;
      const base: FlightLeg = d.original ?? { id: `corrected-${Date.now()}-${i}`, flightNumber: '', origin, destination, departureTimeUtc: '', arrivalTimeUtc: '', reportTimeUtc: '', releaseTimeUtc: '', originTzOffset: 0, destTzOffset: 0, durationMinutes: 0 };
      const next: FlightLeg = {
        ...base,
        ...c,
        flightNumber: d.flightNumber.trim().toUpperCase() || 'UNKNOWN',
        origin,
        destination,
        originTzOffset: getAirportTzOffset(origin, new Date(c.departureTimeUtc)) ?? base.originTzOffset,
        destTzOffset: getAirportTzOffset(destination, new Date(c.arrivalTimeUtc)) ?? base.destTzOffset,
        isPositioning: d.positioning || undefined,
        tzUnverified: undefined,
        printed,
        timeConvention: convention,
      };
      const changed =
        !d.original ||
        ['flightNumber', 'origin', 'destination', 'departureTimeUtc', 'arrivalTimeUtc', 'reportTimeUtc', 'releaseTimeUtc'].some((k) => (next as any)[k] !== (d.original as any)[k]) ||
        !!next.isPositioning !== !!d.original.isPositioning;
      outFlights.push(changed ? { ...next, correctedByUser: true } : d.original!);
    });
    const outStandby: StandbyDuty[] = [];
    standby.forEach((s, i) => {
      const airport = s.original?.airport || homeBase;
      const start = normaliseClock(s.start) ? airportLocalToUtc(date, normaliseClock(s.start)!, homeBase) : null;
      let end = normaliseClock(s.end) ? airportLocalToUtc(date, normaliseClock(s.end)!, homeBase) : null;
      if (!start || !end) {
        errors.push(`Standby ${i + 1}: enter start and end times.`);
        return;
      }
      if (end <= start) end = new Date(end.getTime() + 24 * 3600000);
      const next: StandbyDuty = { id: s.original?.id ?? `corrected-sb-${Date.now()}-${i}`, kind: s.kind, airport, startUtc: start.toISOString(), endUtc: end.toISOString() };
      const same = s.original && s.original.kind === next.kind && s.original.startUtc === next.startUtc && s.original.endUtc === next.endUtc;
      outStandby.push(same ? s.original! : next);
    });
    const outOther: OtherDuty[] =
      dayKind === 'none' ? [] : dayOther[0]?.kind === dayKind ? [dayOther[0]] : [{ id: `corrected-od-${date}`, kind: dayKind, date }];
    const unchanged =
      outFlights.length === dayFlights.length &&
      outFlights.every((f, i) => f === dayFlights[i]) &&
      outStandby.length === dayStandby.length &&
      outStandby.every((s, i) => s === dayStandby[i]) &&
      outOther.length === dayOther.length &&
      (outOther[0]?.kind ?? null) === (dayOther[0]?.kind ?? null);
    return { flights: outFlights, standby: outStandby, otherDuties: outOther, errors, unchanged };
  }, [flights, standby, dayKind, convention, homeBase, date, positions]);

  const setFlight = (key: string, patch: Partial<FlightDraft>) => setFlights((list) => list.map((d) => (d.key === key ? { ...d, ...patch } : d)));
  const setSb = (key: string, patch: Partial<StandbyDraft>) => setStandby((list) => list.map((d) => (d.key === key ? { ...d, ...patch } : d)));
  const title = new Date(`${date}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
  const hm = (iso: string, airport: string) => clockIn(Date.parse(iso), airport).time;

  return (
    <div className="fixed inset-0 z-[55] flex items-end justify-end bg-black/60 sm:items-stretch" role="dialog" aria-modal="true" aria-label={`Check ${title}`} onClick={onClose}>
      <div
        ref={panelRef}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[88vh] outline-none w-full flex-col overflow-hidden rounded-t-2xl border border-slate-800 bg-slate-900 shadow-2xl sm:max-h-none sm:w-[30rem] sm:rounded-none sm:rounded-l-2xl"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-800 p-4">
          <div>
            <h2 className="text-base font-semibold text-white">{title}</h2>
            <p className="text-xs text-slate-400">Times as printed · {TIME_CONVENTION_LABEL[convention]}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 text-sm">
          {/* Doubts, with a one-tap fix where there is one */}
          {findings.length > 0 && (
            <ul className="space-y-2">
              {findings.map((f, i) => (
                <li key={i} className="rounded-xl border border-amber-800/50 bg-amber-950/20 p-3 text-xs">
                  <p className="flex gap-2 text-amber-100">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
                    <span>{f.message}</span>
                  </p>
                  {f.fix?.kind === 'reread_local' && (
                    <button
                      onClick={() => onApplyFix(f.fix!)}
                      className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-amber-600/60 px-2.5 py-1 font-semibold text-amber-100 hover:bg-amber-900/40"
                    >
                      <Wrench className="h-3.5 w-3.5" /> Read {f.fix.airport} times as {f.fix.airport} local time
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}

          {/* Flights */}
          <section className="space-y-2">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Flights</h3>
            {flights.length === 0 && <p className="text-xs text-slate-500">No flights on this day.</p>}
            {flights.map((d, i) => {
              const original = d.original;
              const source = original && flightSource(original);
              return (
                <div key={d.key} className="space-y-2 rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <input aria-label={`Flight ${i + 1} number`} value={d.flightNumber} onChange={(e) => setFlight(d.key, { flightNumber: e.target.value.toUpperCase() })} className={`${input} w-20`} />
                    <input aria-label={`Flight ${i + 1} from`} value={d.origin} onChange={(e) => setFlight(d.key, { origin: e.target.value.toUpperCase() })} className={`${input} w-14`} />
                    <span className="text-slate-500">→</span>
                    <input aria-label={`Flight ${i + 1} to`} value={d.destination} onChange={(e) => setFlight(d.key, { destination: e.target.value.toUpperCase() })} className={`${input} w-14`} />
                    <button onClick={() => setFlights((l) => l.filter((x) => x.key !== d.key))} aria-label={`Remove flight ${i + 1}`} className="ml-auto rounded p-1 text-slate-500 hover:text-rose-300">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <label className="flex items-center gap-2 text-[11px] text-slate-400">
                    <span>Departure date</span>
                    <input
                      type="date"
                      aria-label={`Flight ${i + 1} departure date (as printed)`}
                      value={d.date}
                      onChange={(e) => e.target.value && setFlight(d.key, { date: e.target.value })}
                      className={input}
                    />
                    {d.date !== date && <span className="text-amber-300">moves to {d.date}</span>}
                  </label>
                  <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400 sm:grid-cols-4">
                    {(
                      [
                        ['report', 'Report'],
                        ['dep', 'Departs'],
                        ['arr', 'Arrives'],
                        ['release', 'Release'],
                      ] as const
                    ).map(([field, label]) => {
                      const pos = d.original ? positions.get(d.original.id) : undefined;
                      const notOwn = (field === 'report' && pos && !pos.first) || (field === 'release' && pos && !pos.last);
                      return (
                        <label key={field} className="space-y-0.5">
                          <span className="block">{label}</span>
                          {notOwn ? (
                            <span className="block py-1 text-[11px] text-slate-500">{field === 'report' ? 'Turnaround (on duty)' : 'Continues duty'}</span>
                          ) : (
                            <TimeInput24 value={d[field]} onChange={(v) => setFlight(d.key, { [field]: v } as Partial<FlightDraft>)} className={`${input} w-full`} ariaLabel={`Flight ${i + 1} ${label.toLowerCase()} (as printed)`} />
                          )}
                        </label>
                      );
                    })}
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
                    <label className="flex items-center gap-1.5">
                      <input type="checkbox" checked={d.positioning} onChange={(e) => setFlight(d.key, { positioning: e.target.checked })} />
                      Positioning (as passenger)
                    </label>
                    {original && <span className="font-mono text-slate-500">{Math.floor(original.durationMinutes / 60)}h{String(original.durationMinutes % 60).padStart(2, '0')} block · home {hm(original.departureTimeUtc, homeBase)}–{hm(original.arrivalTimeUtc, homeBase)}</span>}
                  </div>
                  {original && !original.printed && (
                    <p className="text-[10px] text-slate-500">Saved before printed times were kept: shown in {convention === 'local' ? "each airport's local time" : convention === 'home' ? 'home-base time' : 'UTC'}, which may differ from your roster if it was read in the wrong clock.</p>
                  )}
                  {source && <p className="text-[10px] text-slate-500">Source: {source}</p>}
                </div>
              );
            })}
            <button
              onClick={() =>
                setFlights((l) => [...l, { key: `new-${Date.now()}`, flightNumber: '', origin: l[l.length - 1]?.destination ?? homeBase, destination: '', date, dep: '', arr: '', report: '', release: '', positioning: false }])
              }
              className="inline-flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-white"
            >
              <Plus className="h-3.5 w-3.5" /> Add a flight the app missed
            </button>
          </section>

          {/* Standby */}
          <section className="space-y-2">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Standby</h3>
            {standby.map((s, i) => (
              <div key={s.key} className="flex flex-wrap items-center gap-2 text-xs">
                <select aria-label={`Standby ${i + 1} kind`} value={s.kind} onChange={(e) => setSb(s.key, { kind: e.target.value as 'home' | 'airport' })} className={input}>
                  <option value="home">Home standby</option>
                  <option value="airport">Airport standby</option>
                </select>
                <TimeInput24 value={s.start} onChange={(v) => setSb(s.key, { start: v })} className={`${input} w-20`} ariaLabel={`Standby ${i + 1} start`} />
                <span className="text-slate-500">–</span>
                <TimeInput24 value={s.end} onChange={(v) => setSb(s.key, { end: v })} className={`${input} w-20`} ariaLabel={`Standby ${i + 1} end`} />
                <button onClick={() => setStandby((l) => l.filter((x) => x.key !== s.key))} aria-label={`Remove standby ${i + 1}`} className="rounded p-1 text-slate-500 hover:text-rose-300">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            <button onClick={() => setStandby((l) => [...l, { key: `new-sb-${Date.now()}`, kind: 'home', start: '', end: '' }])} className="inline-flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-white">
              <Plus className="h-3.5 w-3.5" /> Add standby
            </button>
          </section>

          {/* The person's own updates on this day: shown here, changed on Today or the Timeline */}
          {updates.length > 0 && (
            <section className="space-y-1">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Your updates</h3>
              {updates.map((u) => (
                <p key={u} className="text-xs text-slate-300">
                  {u}
                </p>
              ))}
              <p className="text-[11px] text-slate-500">These are what you reported happened. Change them from Today or the Timeline; the roster above stays as published.</p>
            </section>
          )}

          {/* Kind of day */}
          <label className="block space-y-1 text-xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Also listed on the roster</span>
            <select value={dayKind} onChange={(e) => setDayKind(e.target.value as OtherDuty['kind'] | 'none')} className={`${input} block`}>
              {DAY_KINDS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
          </label>

          {built.errors.length > 0 && (
            <ul className="space-y-1 text-xs text-rose-300">
              {built.errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}
        </div>

        {/* Actions */}
        <div className="space-y-2 border-t border-slate-800 p-4">
          {!built.unchanged && (
            <button
              disabled={built.errors.length > 0}
              onClick={() => onSave(date, { flights: built.flights, standby: built.standby, otherDuties: built.otherDuties })}
              className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-40"
            >
              Save corrections
            </button>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              onClick={() => onToggleChecked(!checked)}
              disabled={!built.unchanged}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold disabled:opacity-40 ${
                checked ? 'border-emerald-600 bg-emerald-950/40 text-emerald-200' : 'border-slate-700 text-slate-200 hover:border-slate-500'
              }`}
              title={built.unchanged ? undefined : 'Save or undo your edits first'}
            >
              <CheckCircle2 className="h-4 w-4" /> {checked ? 'Checked: looks right' : 'Looks right'}
            </button>
            <button onClick={() => onOpenTimeline(date)} className="inline-flex items-center gap-1 text-xs font-semibold text-slate-300 hover:text-white">
              Open in Timeline <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
