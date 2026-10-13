import React, { useState } from 'react';
import { ChevronDown, History, Undo2 } from 'lucide-react';
import { RosterHistoryEntry } from '../types/circadian';
import { shortRange } from '../services/periodStats';

/**
 * The last few changes to the saved roster, in plain words, with Undo on the newest one.
 * Roster updates expand to show what changed on each day. The full log stays in the History tab.
 */

interface Props {
  history: RosterHistoryEntry[];
  /** Present when the newest change can be undone. */
  onUndoLatest?: () => void;
  onOpenFullHistory?: () => void;
  limit?: number;
  /** Puts the roster back exactly as it was after an earlier change. */
  onRestore?: (entry: RosterHistoryEntry) => void;
}

const when = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });

const KIND: Record<RosterHistoryEntry['actionType'], string> = {
  upload: 'Roster upload',
  preset: 'Sample roster',
  manual_edit: 'You changed',
  cleared: 'Cleared',
  undo: 'Undo',
};

export const RecentChanges: React.FC<Props> = ({ history, onUndoLatest, onOpenFullHistory, limit = 5, onRestore }) => {
  const [open, setOpen] = useState<string | null>(null);
  const entries = history.slice(0, limit);
  if (!entries.length) return null;

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
          <History className="h-4 w-4 text-slate-400" /> Recent changes
        </h3>
        {onOpenFullHistory && (
          <button onClick={onOpenFullHistory} className="text-xs font-semibold text-slate-400 hover:text-white">
            Full history
          </button>
        )}
      </div>
      <ul className="divide-y divide-slate-800/70">
        {entries.map((e, i) => {
          const days = e.changes ?? [];
          const isOpen = open === e.id;
          return (
            <li key={e.id} className="py-2.5">
              <div className="flex items-start justify-between gap-3">
                <button
                  onClick={() => days.length && setOpen(isOpen ? null : e.id)}
                  className={`min-w-0 flex-1 text-left ${days.length ? 'cursor-pointer' : 'cursor-default'}`}
                  aria-expanded={days.length ? isOpen : undefined}
                >
                  <p className="text-[11px] text-slate-500">
                    {when(e.timestamp)} · {/^Removed:/.test(e.title) ? 'Removed' : /^Re-read:/.test(e.title) ? 'Re-read' : KIND[e.actionType] ?? 'Change'}
                  </p>
                  <p className="truncate text-sm text-slate-200" title={e.title}>
                    {e.title}
                  </p>
                  {days.length > 0 && (
                    <p className="flex items-center gap-1 text-xs text-slate-400">
                      {days.length} {days.length === 1 ? 'day' : 'days'} changed
                      <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    </p>
                  )}
                </button>
                {i > 0 && onRestore && e.rosterSnapshot && (
                  <button onClick={() => onRestore(e)} className="shrink-0 text-[11px] font-semibold text-slate-400 hover:text-white" title="Put the roster back as it was after this change">
                    Restore this point
                  </button>
                )}
                {i === 0 && onUndoLatest && (
                  <button
                    onClick={onUndoLatest}
                    className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-700 px-2.5 py-1 text-xs font-semibold text-slate-200 hover:border-slate-500"
                  >
                    <Undo2 className="h-3.5 w-3.5" /> Undo
                  </button>
                )}
              </div>
              {isOpen && (
                <dl className="mt-2 space-y-1.5 border-l border-slate-800 pl-3">
                  {days.map((d) => (
                    <div key={d.date}>
                      <dt className="text-xs text-slate-300">
                        {shortRange(d.date, d.date)} · <span className="text-slate-400">{d.label}</span>
                      </dt>
                      {d.lines.map((line) => (
                        <dd key={line} className="font-mono text-[11px] text-slate-400">
                          {line}
                        </dd>
                      ))}
                    </div>
                  ))}
                </dl>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
};
