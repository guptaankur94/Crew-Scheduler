import React, { useCallback, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { HomeClock } from '../services/planEngine';
import { RosterItems, UploadCoverage } from '../services/rosterMerger';
import { shortRange } from '../services/periodStats';

/**
 * Shown before saving a new roster upload that covers dates the saved roster already has.
 * The newer roster is the airline's latest plan, so replacing is the recommended choice; the person
 * can still keep the older entries, or cancel and save nothing.
 */

export type ReplaceChoice = 'replace' | 'keep' | 'cancel';

const OTHER_LABEL: Record<string, string> = { off: 'Day off', leave: 'Leave', sick: 'Sick', training: 'Training', other: 'Other' };

interface Props {
  coverage: UploadCoverage;
  replaced: RosterItems;
  clock: HomeClock;
  onChoose: (choice: ReplaceChoice) => void;
}

const ReplaceOlderDialog: React.FC<Props> = ({ coverage, replaced, clock, onChoose }) => {
  // One list of what will be replaced, by date, in home time
  const rows = [
    ...replaced.flights.map((f) => {
      const ms = Date.parse(f.departureTimeUtc);
      return { date: clock.date(ms), sort: ms, text: `${f.flightNumber} ${f.origin}→${f.destination} ${clock.time(ms)}` };
    }),
    ...replaced.standby.map((sb) => {
      const ms = Date.parse(sb.startUtc);
      return {
        date: clock.date(ms),
        sort: ms,
        text: `${sb.kind === 'home' ? 'Home' : 'Airport'} standby ${clock.time(ms)}–${clock.time(Date.parse(sb.endUtc))}`,
      };
    }),
    ...replaced.otherDuties.map((d) => ({ date: d.date, sort: Date.parse(`${d.date}T00:00:00Z`), text: `${OTHER_LABEL[d.kind] ?? d.kind}${d.code ? ` (${d.code})` : ''}` })),
  ].sort((a, b) => a.sort - b.sort);
  const byDate = new Map<string, string[]>();
  for (const r of rows) byDate.set(r.date, [...(byDate.get(r.date) ?? []), r.text]);

  const n = replaced.flights.length;
  const range = shortRange(coverage.start, coverage.end);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4" role="dialog" aria-modal="true" aria-labelledby="replace-title">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl">
        <div className="space-y-2 border-b border-slate-800 p-5">
          <div className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-blue-400" />
            <h2 id="replace-title" className="text-base font-semibold text-white">
              Your new roster replaces {range}
            </h2>
          </div>
          <p className="text-sm text-slate-300">
            {coverage.stated ? 'Your new roster says it covers ' : 'Your new roster has entries from '}
            <strong className="text-white">{range}</strong>. Your saved roster already has entries on those dates
            {n > 0 && (
              <>
                , including <strong className="text-white">{n === 1 ? '1 flight' : `${n} flights`}</strong>
              </>
            )}
            . A newer roster is usually the latest plan, so these are replaced rather than added on top.
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">Will be replaced (home time)</p>
          <dl className="space-y-1.5 text-sm">
            {[...byDate].map(([date, items]) => (
              <div key={date} className="flex gap-3">
                <dt className="w-20 shrink-0 text-slate-400">{shortRange(date, date)}</dt>
                <dd className="font-mono text-xs leading-5 text-slate-200">{items.join(' · ')}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-slate-800 p-4 sm:flex-row sm:justify-end">
          <button onClick={() => onChoose('cancel')} className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-400 hover:text-white">
            Cancel, save nothing
          </button>
          <button
            onClick={() => onChoose('keep')}
            className="rounded-lg border border-slate-700 px-3 py-2 text-sm font-semibold text-slate-200 hover:border-slate-500"
          >
            Keep them as well
          </button>
          <button onClick={() => onChoose('replace')} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500">
            Replace (recommended)
          </button>
        </div>
      </div>
    </div>
  );
};

/** Asks whether a new upload should replace the saved roster's entries on the dates it covers. */
export function useReplaceConfirm() {
  const [pending, setPending] = useState<(Omit<Props, 'onChoose'> & { resolve: (c: ReplaceChoice) => void }) | null>(null);

  const confirmReplace = useCallback(
    (coverage: UploadCoverage, replaced: RosterItems, clock: HomeClock): Promise<ReplaceChoice> =>
      new Promise((resolve) => setPending({ coverage, replaced, clock, resolve })),
    []
  );

  const dialog = pending ? (
    <ReplaceOlderDialog
      coverage={pending.coverage}
      replaced={pending.replaced}
      clock={pending.clock}
      onChoose={(choice) => {
        pending.resolve(choice);
        setPending(null);
      }}
    />
  ) : null;

  return { confirmReplace, dialog };
}
