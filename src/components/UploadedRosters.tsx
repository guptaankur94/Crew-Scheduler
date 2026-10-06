import React, { useEffect, useState } from 'react';
import { Eye, FileImage, FileText, RefreshCw, Trash2 } from 'lucide-react';
import { ImportRecord } from '../services/importRecords';
import { shortRange } from '../services/periodStats';

/**
 * "Your rosters": each uploaded roster with the dates it covers and two actions.
 *   Re-read  a clean slate for that roster's dates: read again (the kept file, or what was read at upload
 *            if the file was not kept); manual corrections on those dates are removed; delays and callouts stay.
 *   Remove   take that roster's days out of the plan and delete its kept file. Undo brings it back.
 *   View original  open the file kept on this device, to compare it with what the app shows.
 */

interface Props {
  rosters: { record: ImportRecord; dates: string[] }[];
  busy?: boolean;
  onReread: (record: ImportRecord) => void;
  onRemove: (record: ImportRecord) => void;
  /** The kept original files of a roster, as links that open them. */
  loadOriginal?: (record: ImportRecord) => Promise<{ name: string; url: string }[]>;
}

const uploaded = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

export const UploadedRosters: React.FC<Props> = ({ rosters, busy, onReread, onRemove, loadOriginal }) => {
  const [confirm, setConfirm] = useState<{ id: string; action: 'reread' | 'remove' } | null>(null);
  const [originals, setOriginals] = useState<{ id: string; files: { name: string; url: string }[] } | null>(null);
  // Links to kept files are released when closed or when this page is left
  useEffect(() => () => originals?.files.forEach((f) => URL.revokeObjectURL(f.url)), [originals]);
  const toggleOriginal = async (record: ImportRecord) => {
    if (originals?.id === record.id) return setOriginals(null);
    if (loadOriginal) setOriginals({ id: record.id, files: await loadOriginal(record) });
  };
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
                  <div className="flex shrink-0 flex-wrap gap-2">
                    {kept && loadOriginal && (
                      <button
                        onClick={() => toggleOriginal(r)}
                        aria-expanded={originals?.id === r.id}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:border-slate-500"
                      >
                        <Eye className="h-3.5 w-3.5" /> View original
                      </button>
                    )}
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

              {originals?.id === r.id && (
                <div className="mt-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-xs">
                  {originals.files.length ? (
                    <ul className="space-y-1">
                      {originals.files.map((f) => (
                        <li key={f.url}>
                          <a href={f.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-blue-300 underline underline-offset-2 hover:text-white">
                            {f.name}
                          </a>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-slate-400">The original file is no longer on this device.</p>
                  )}
                </div>
              )}

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
