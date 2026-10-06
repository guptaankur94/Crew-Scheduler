import React, { useCallback, useMemo, useState } from 'react';
import { ChevronDown, RefreshCw } from 'lucide-react';
import { FlightLeg, OtherDuty, RosterData, StandbyDuty } from '../types/circadian';
import { HomeClock } from '../services/planEngine';
import { ApplyChoices, DayDiff, DaySummary, diffRoster, FlightPair, ImportScope, RosterDiff, UploadContent } from '../services/rosterDiff';
import { shortRange } from '../services/periodStats';

/**
 * "What changed?" review before a roster upload is saved over the saved roster.
 * Shows only the days that really change, in plain words and home time. Small differences that look
 * like reading errors are listed separately and keep the saved value by default. Dates the upload does
 * not clearly show are never changed unless the person says so.
 */

export interface WhatChangedResult {
  scopeDates: string[];
  diff: RosterDiff;
  choices: ApplyChoices;
}

interface Props {
  saved: RosterData;
  upload: UploadContent;
  scope: ImportScope;
  clock: HomeClock;
  onDone: (result: WhatChangedResult | null) => void;
}

const SUMMARY_LABEL: Record<DaySummary, { text: string; tone: string }> = {
  new: { text: 'New duty', tone: 'text-blue-300 border-blue-800/60' },
  now_free: { text: 'Now free', tone: 'text-emerald-300 border-emerald-800/60' },
  flight_to_standby: { text: 'Flight → Standby', tone: 'text-purple-300 border-purple-800/60' },
  standby_to_flight: { text: 'Standby → Flight', tone: 'text-purple-300 border-purple-800/60' },
  standby_changed: { text: 'Standby moved', tone: 'text-purple-300 border-purple-800/60' },
  changed: { text: 'Changed', tone: 'text-amber-300 border-amber-800/60' },
};
const CODE_LABEL: Record<string, string> = { off: 'Day off', leave: 'Leave', sick: 'Sick', training: 'Training', other: 'Other' };

const dayTitle = (d: string) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });

export const WhatChangedDialog: React.FC<Props> = ({ saved, upload, scope, clock, onDone }) => {
  const [wholePeriod, setWholePeriod] = useState(false);
  const [freeDates, setFreeDates] = useState<Set<string>>(new Set());
  const [useNewReading, setUseNewReading] = useState<Set<string>>(new Set());
  const [dropUserFlights, setDropUserFlights] = useState<Set<string>>(new Set());
  const [showReading, setShowReading] = useState(false);
  const [showUnchanged, setShowUnchanged] = useState(false);

  const scopeDates = useMemo(
    () => [...new Set([...(wholePeriod && scope.wholePeriod ? scope.wholePeriod : scope.dates), ...freeDates])].sort(),
    [wholePeriod, scope, freeDates]
  );
  const diff = useMemo(() => diffRoster(saved, upload, scopeDates, clock), [saved, upload, scopeDates, clock]);

  const t = (iso: string) => clock.time(Date.parse(iso));
  const flightLine = (f: FlightLeg) => `${f.flightNumber} ${f.origin}→${f.destination} ${t(f.departureTimeUtc)}`;
  const standbyLine = (sb: StandbyDuty) => `${sb.kind === 'home' ? 'Home' : 'Airport'} standby ${t(sb.startUtc)}–${t(sb.endUtc)}`;
  const codeLine = (c: OtherDuty) => `${CODE_LABEL[c.kind] ?? c.kind}${c.code ? ` (${c.code})` : ''}`;
  const toggle = (set: Set<string>, setter: (s: Set<string>) => void, id: string) => {
    const next = new Set(set);
    next.has(id) ? next.delete(id) : next.add(id);
    setter(next);
  };

  const range = scopeDates.length ? shortRange(scopeDates[0], scopeDates[scopeDates.length - 1]) : '';
  const changedCount = diff.days.length;
  const savedFlightsOn = (date: string) => saved.flights.filter((f) => clock.date(Date.parse(f.departureTimeUtc)) === date);
  const nothingToSave = changedCount === 0 && diff.userFlightsNotOnRoster.filter((f) => dropUserFlights.has(f.id)).length === 0 && useNewReading.size === 0;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-3 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="changes-title">
      <div className="flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl">
        {/* Header */}
        <div className="space-y-1 border-b border-slate-800 p-5">
          <div className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-blue-400" />
            <h2 id="changes-title" className="text-base font-semibold text-white">
              What changed?
            </h2>
          </div>
          <p className="text-sm text-slate-300">
            Checked <strong className="text-white">{range}</strong> ·{' '}
            {changedCount === 0 ? 'no days changed' : `${changedCount} ${changedCount === 1 ? 'day' : 'days'} changed`} · {diff.unchangedDates.length} unchanged
          </p>
          <p className="text-xs text-slate-500">Times are home time. Only the dates above are updated; everything else stays as saved.</p>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
          {/* Partial screenshot with a whole-month header */}
          {scope.kind === 'partial_with_header' && scope.wholePeriod && (
            <div className="rounded-xl border border-amber-800/60 bg-amber-950/20 p-3 text-sm">
              <p className="text-slate-200">
                This looks like part of your roster: it shows {shortRange(scope.dates[0], scope.dates[scope.dates.length - 1])}, but its header says{' '}
                {shortRange(scope.wholePeriod[0], scope.wholePeriod[scope.wholePeriod.length - 1])}.
              </p>
              <div className="mt-2 flex flex-col gap-1.5 text-xs">
                <label className="flex items-center gap-2 text-slate-200">
                  <input type="radio" checked={!wholePeriod} onChange={() => setWholePeriod(false)} />
                  Update only {shortRange(scope.dates[0], scope.dates[scope.dates.length - 1])} (recommended)
                </label>
                <label className="flex items-center gap-2 text-slate-300">
                  <input type="radio" checked={wholePeriod} onChange={() => setWholePeriod(true)} />
                  Treat it as the whole of {shortRange(scope.wholePeriod[0], scope.wholePeriod[scope.wholePeriod.length - 1])}
                </label>
              </div>
            </div>
          )}

          {/* Extra days beyond this roster's own period, left as saved */}
          {scope.keptAsSaved.length > 0 && (
            <p className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-xs text-slate-300">
              Kept as saved: {scope.keptAsSaved.map(dayTitle).join(', ')}. This roster only shows {scope.keptAsSaved.length === 1 ? 'that day' : 'those days'} as extra days beyond
              its own period, and your saved roster already covers {scope.keptAsSaved.length === 1 ? 'it' : 'them'}.
            </p>
          )}

          {/* Dates the upload does not clearly show */}
          {scope.unclearDates.length > 0 && (
            <div className="space-y-2 rounded-xl border border-amber-800/60 bg-amber-950/20 p-3 text-sm">
              <p className="text-slate-200">Your saved roster has entries on these days, but this upload shows nothing for them. Are they now free?</p>
              {scope.unclearDates.map((d) => (
                <label key={d} className="flex items-start gap-2 text-xs text-slate-300">
                  <input type="checkbox" className="mt-0.5" checked={freeDates.has(d)} onChange={() => toggle(freeDates, setFreeDates, d)} />
                  <span>
                    <strong className="text-white">{dayTitle(d)}</strong> is now free
                    {savedFlightsOn(d).length > 0 && <span className="text-slate-500"> (saved: {savedFlightsOn(d).map(flightLine).join(', ')})</span>}
                  </span>
                </label>
              ))}
              <p className="text-[11px] text-slate-500">Leave unticked to keep what is saved.</p>
            </div>
          )}

          {/* Changed days */}
          {diff.days.map((day) => (
            <DayCard key={day.date} day={day} flightLine={flightLine} standbyLine={standbyLine} codeLine={codeLine} t={t} />
          ))}
          {changedCount === 0 && scope.unclearDates.length === 0 && (
            <p className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-300">No changes found. Your roster is already up to date.</p>
          )}

          {/* Flights the person added that the new roster does not show */}
          {diff.userFlightsNotOnRoster.length > 0 && (
            <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-sm">
              <p className="text-slate-200">You added these yourself, and the new roster doesn't show them. They are kept unless you tick them.</p>
              {diff.userFlightsNotOnRoster.map((f) => (
                <label key={f.id} className="flex items-center gap-2 text-xs text-slate-300">
                  <input type="checkbox" checked={dropUserFlights.has(f.id)} onChange={() => toggle(dropUserFlights, setDropUserFlights, f.id)} />
                  Remove {dayTitle(clock.date(Date.parse(f.departureTimeUtc)))} · <span className="font-mono">{flightLine(f)}</span>
                </label>
              ))}
            </div>
          )}
          {diff.userFlightsConfirmed.length > 0 && (
            <p className="text-xs text-emerald-300">
              ✓ The new roster now shows {diff.userFlightsConfirmed.length === 1 ? 'the flight' : 'the flights'} you added:{' '}
              {diff.userFlightsConfirmed.map(flightLine).join(', ')}
            </p>
          )}

          {/* Possible reading differences */}
          {diff.readingDifferences.length > 0 && (
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-sm">
              <button onClick={() => setShowReading(!showReading)} className="flex w-full items-center justify-between text-left text-slate-200">
                <span>
                  Possible reading differences ({diff.readingDifferences.length})
                  <span className="block text-xs text-slate-500">Very small differences that may be a reading error. Your saved times are kept.</span>
                </span>
                <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${showReading ? 'rotate-180' : ''}`} />
              </button>
              {showReading && (
                <div className="mt-2 space-y-1.5">
                  {diff.readingDifferences.map((p) => (
                    <ReadingRow key={p.after!.id} pair={p} t={t} checked={useNewReading.has(p.after!.id)} onToggle={() => toggle(useNewReading, setUseNewReading, p.after!.id)} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Unchanged days */}
          {diff.unchangedDates.length > 0 && (
            <div className="text-xs text-slate-400">
              <button onClick={() => setShowUnchanged(!showUnchanged)} className="flex items-center gap-1 hover:text-slate-200">
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showUnchanged ? 'rotate-180' : ''}`} />
                {diff.unchangedDates.length} {diff.unchangedDates.length === 1 ? 'day' : 'days'} unchanged
              </button>
              {showUnchanged && <p className="mt-1 leading-relaxed text-slate-500">{diff.unchangedDates.map(dayTitle).join(' · ')}</p>}
            </div>
          )}
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-slate-800 p-4 sm:flex-row sm:justify-end">
          <button onClick={() => onDone(null)} className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-400 hover:text-white">
            {nothingToSave ? 'Close' : 'Cancel, save nothing'}
          </button>
          {!nothingToSave && (
            <button
              onClick={() => onDone({ scopeDates, diff, choices: { useNewReading, dropUserFlights } })}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"
            >
              Save changes
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const DayCard: React.FC<{
  day: DayDiff;
  flightLine: (f: FlightLeg) => string;
  standbyLine: (sb: StandbyDuty) => string;
  codeLine: (c: OtherDuty) => string;
  t: (iso: string) => string;
}> = ({ day, flightLine, standbyLine, codeLine, t }) => {
  const label = SUMMARY_LABEL[day.summary];
  const Old: React.FC<{ children: React.ReactNode }> = ({ children }) => <p className="font-mono text-xs text-slate-500 line-through">{children}</p>;
  const New: React.FC<{ children: React.ReactNode }> = ({ children }) => <p className="font-mono text-xs text-slate-100">{children}</p>;
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-white">{dayTitle(day.date)}</h3>
        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${label.tone}`}>{label.text}</span>
      </div>
      <div className="space-y-1">
        {day.flights.map((p, i) => (
          <div key={i}>
            {p.before && <Old>{flightLine(p.before)}</Old>}
            {p.after && <New>{p.change === 'added' ? '+ ' : '→ '}{flightLine(p.after)}</New>}
            {p.before && p.after && p.before.reportTimeUtc !== p.after.reportTimeUtc && (
              <p className="text-[11px] text-slate-400">
                Report {t(p.before.reportTimeUtc)} → {t(p.after.reportTimeUtc)}
              </p>
            )}
            {p.change === 'removed' && <p className="text-[11px] text-slate-500">removed</p>}
          </div>
        ))}
        {day.standby.map((p, i) => (
          <div key={`s${i}`}>
            {p.before && <Old>{standbyLine(p.before)}</Old>}
            {p.after && <New>{p.change === 'added' ? '+ ' : '→ '}{standbyLine(p.after)}</New>}
          </div>
        ))}
        {day.codes.map((p, i) => (
          <div key={`c${i}`}>
            {p.before && <Old>{codeLine(p.before)}</Old>}
            {p.after && <New>{p.change === 'added' ? '+ ' : '→ '}{codeLine(p.after)}</New>}
          </div>
        ))}
        {day.summary === 'now_free' && !day.codes.some((c) => c.after) && <p className="text-[11px] text-emerald-300">Day now free</p>}
      </div>
    </section>
  );
};

const ReadingRow: React.FC<{ pair: FlightPair; t: (iso: string) => string; checked: boolean; onToggle: () => void }> = ({ pair, t, checked, onToggle }) => {
  const b = pair.before!;
  const a = pair.after!;
  const parts = [
    b.flightNumber !== a.flightNumber && `flight number ${b.flightNumber} → ${a.flightNumber}`,
    b.departureTimeUtc !== a.departureTimeUtc && `departs ${t(b.departureTimeUtc)} → ${t(a.departureTimeUtc)}`,
    b.arrivalTimeUtc !== a.arrivalTimeUtc && `arrives ${t(b.arrivalTimeUtc)} → ${t(a.arrivalTimeUtc)}`,
    b.reportTimeUtc !== a.reportTimeUtc && `report ${t(b.reportTimeUtc)} → ${t(a.reportTimeUtc)}`,
    b.releaseTimeUtc !== a.releaseTimeUtc && `release ${t(b.releaseTimeUtc)} → ${t(a.releaseTimeUtc)}`,
  ].filter(Boolean);
  return (
    <label className="flex items-start gap-2 text-xs text-slate-300">
      <input type="checkbox" className="mt-0.5" checked={checked} onChange={onToggle} />
      <span>
        <span className="font-mono text-slate-200">
          {b.flightNumber} {b.origin}→{b.destination}
        </span>{' '}
        {parts.join(', ')} <span className="text-slate-500">· use the new reading</span>
      </span>
    </label>
  );
};

/** Opens the "What changed?" review and resolves with the person's choices, or null if they cancel. */
export function useWhatChanged() {
  const [pending, setPending] = useState<(Omit<Props, 'onDone'> & { resolve: (r: WhatChangedResult | null) => void }) | null>(null);
  const reviewChanges = useCallback(
    (saved: RosterData, upload: UploadContent, scope: ImportScope, clock: HomeClock): Promise<WhatChangedResult | null> =>
      new Promise((resolve) => setPending({ saved, upload, scope, clock, resolve })),
    []
  );
  const dialog = pending ? (
    <WhatChangedDialog
      saved={pending.saved}
      upload={pending.upload}
      scope={pending.scope}
      clock={pending.clock}
      onDone={(r) => {
        pending.resolve(r);
        setPending(null);
      }}
    />
  ) : null;
  return { reviewChanges, dialog };
}
