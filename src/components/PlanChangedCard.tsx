import React from 'react';
import { Sparkles, X } from 'lucide-react';
import { PlanChangeDay } from '../services/planChanges';
import { shortRange } from '../services/periodStats';

/** Shown on Today after an update: what actually moved in the plan. Calm, dismissable, shown until read. */

export interface PlanChangeNotice {
  title: string; // the update that caused it, e.g. 'Delayed: 6E 408 +60 min'
  at: string; // ISO
  days: PlanChangeDay[];
}

const MAX_DAYS = 3;

export const PlanChangedCard: React.FC<{ notice: PlanChangeNotice; onDismiss: () => void }> = ({ notice, onDismiss }) => {
  const shown = notice.days.slice(0, MAX_DAYS);
  const more = notice.days.length - shown.length;
  return (
    <section className="rounded-2xl border border-sky-900/60 bg-sky-950/20 p-4 text-sm shadow-sm" aria-label="Your plan changed">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 font-semibold text-white">
            <Sparkles className="h-4 w-4 text-sky-300" /> Your plan changed
          </p>
          <p className="text-xs text-slate-400">After: {notice.title}</p>
        </div>
        <button onClick={onDismiss} aria-label="Dismiss" className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white">
          <X className="h-4 w-4" />
        </button>
      </div>
      <dl className="mt-2 space-y-1.5">
        {shown.map((d) => (
          <div key={d.date}>
            <dt className="text-xs font-semibold text-slate-200">{shortRange(d.date, d.date)}</dt>
            {d.lines.map((line) => (
              <dd key={line} className="font-mono text-[11px] text-slate-300">
                {line}
              </dd>
            ))}
          </div>
        ))}
      </dl>
      {more > 0 && <p className="mt-1 text-[11px] text-slate-500">…and {more} more {more === 1 ? 'day' : 'days'}. See the Timeline for details.</p>}
    </section>
  );
};
