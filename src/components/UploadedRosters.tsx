import React, { useState } from 'react';
import { FileImage, FileText, RefreshCw, Trash2 } from 'lucide-react';
import { ImportRecord } from '../services/importRecords';
import { shortRange } from '../services/periodStats';

/**
 * "Your rosters": each uploaded roster with the dates it covers and two actions.
 *   Re-read  a clean slate for that roster's dates: read again (the kept file, or what was read at upload
 *            if the file was not kept); manual corrections on those dates are removed; delays and callouts stay.
 *   Remove   take that roster's days out of the plan and delete its kept file. Undo brings it back.
 */

interface Props {
  rosters: { record: ImportRecord; dates: string[] }[];
  busy?: boolean;
  onReread: (record: ImportRecord) => void;
  onRemove: (record: ImportRecord) => void;
}

const uploaded = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

export const UploadedRosters: React.FC<Props> = ({ rosters, busy, onReread, onRemove }) => {
  const [confirm, setConfirm] = useState<{ id: string; action: 'reread' | 'remove' } | null>(null);
  if (!rosters.length) return null;

  return (
    <section className="space-y-2" aria-label="Your rosters">
      <h3 className="text-sm font-semibold text-white">Your rosters</h3>
      <ul className="divide-y divide-slate-800 rounded-2xl border border-slate-800 bg-slate-900/70" aria-label="Uploaded rosters">
        {rosters.map(({ record: r, dates }) => {
          const range = shortRange(dates[0], dates[dates.length - 1]);
          const kept = r.source !== 'history' && r.files.length > 0 && r.files.every((f) => f.stored);
          const asking = confirm?.id === r.id ? confirm.action : null;
          return (
            <li key={r.id} className="p-4 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 font-semibold text-white">
                    {r.source === 'text' ? <FileText className="h-4 w-4 shrink-0 text-slate-400" /> : <FileImage className="h-4 w-4 shrink-0 text-slate-400" />}
                    {range}
                  </p>
                  <p className="truncate text-xs text-slate-400" title={r.title}>
                    {r.title} · uploaded {uploaded(r.uploadedAt)}
                  </p>
                </div>
                {!asking && (
                  <div className="flex shrink-0 gap-2">
                    <button
                      disabled={busy}
                      onClick={() => setConfirm({ id: r.id, action: 'reread' })}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:border-slate-500 disabled:opacity-40"
                    >
                      <RefreshCw className="h-3.5 w-3.5" /> Re-read
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => setConfirm({ id: r.id, action: 'remove' })}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:border-rose-700 hover:text-rose-200 disabled:opacity-40"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Remove
                    </button>
                  </div>
                )}
              </div>

              {asking && (
                <div className="mt-3 space-y-2 rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-xs text-slate-300">
                  {asking === 'reread' ? (
                    <p>
                      Start again for {range}: {kept ? 'the roster is read again from the file kept on this device' : 'your roster goes back to what was read when you uploaded it (the file was not kept)'}.
                      Your manual corrections on these dates are removed; your delays and callouts stay.
                    </p>
                  ) : (
                    <p>Remove the {range} roster? Its days leave your plan and its kept file is deleted. You can undo this.</p>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setConfirm(null);
                        if (asking === 'reread') onReread(r);
                        else onRemove(r);
                      }}
                      className={`rounded-lg px-3 py-1.5 font-semibold text-white ${asking === 'remove' ? 'bg-rose-700 hover:bg-rose-600' : 'bg-blue-600 hover:bg-blue-500'}`}
                    >
                      {asking === 'reread' ? 'Re-read' : 'Remove'}
                    </button>
                    <button onClick={() => setConfirm(null)} className="px-2 font-semibold text-slate-400 hover:text-white">
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
};
