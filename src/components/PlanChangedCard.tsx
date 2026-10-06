import React from 'react';
import { BellRing, X } from 'lucide-react';

/**
 * A heads-up on Today after an update: what changes today or tomorrow, in one sentence, so the person can
 * move an alarm if needed. Disappears after a day, or when dismissed.
 */

export interface PlanChangeNotice {
  title: string; // the update that caused it, e.g. 'Delayed: 6E 408 +60 min'
  at: string; // ISO
  sentence: string;
}

/** How long a heads-up stays before it is no longer news. */
export const HEADS_UP_HOURS = 24;

export const PlanChangedCard: React.FC<{ notice: PlanChangeNotice; onDismiss: () => void }> = ({ notice, onDismiss }) => (
  <section className="flex items-start justify-between gap-3 rounded-2xl border border-sky-900/60 bg-sky-950/20 px-4 py-3 text-sm shadow-sm" aria-label="Heads-up">
    <p className="flex gap-2 text-slate-200">
      <BellRing className="mt-0.5 h-4 w-4 shrink-0 text-sky-300" />
      <span>
        <strong className="text-white">Heads-up:</strong> {notice.sentence} <span className="text-xs text-slate-500">(after: {notice.title})</span>
      </span>
    </p>
    <button onClick={onDismiss} aria-label="Dismiss" className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white">
      <X className="h-4 w-4" />
    </button>
  </section>
);
