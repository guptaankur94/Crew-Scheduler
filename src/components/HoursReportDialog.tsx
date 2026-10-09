import React, { useEffect, useRef, useState } from 'react';
import { Copy, FileSpreadsheet, X } from 'lucide-react';
import { CircadianPlan } from '../types/circadian';
import { hhmm, hoursReport, hoursReportCsv } from '../services/hoursReport';
import { Period } from '../services/periodStats';
import { saveOrShareFile } from '../services/saveFile';

/** The month's hours, day by day, to check pay: save as a spreadsheet file or copy as text. */

interface Props {
  plan: CircadianPlan;
  period: Period;
  label: string; // e.g. "October 2026"
  onClose: () => void;
}

export const HoursReportDialog: React.FC<Props> = ({ plan, period, label, onClose }) => {
  const report = hoursReport(plan, period);
  const [copied, setCopied] = useState(false);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeRef.current();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const asText = () =>
    [
      `Hours, ${label} (home time)`,
      ...report.rows.map((r) => `${r.date}  ${r.route}${r.checkIn ? `  ${r.checkIn}–${r.signOff}` : ''}  flying ${hhmm(r.flyingMinutes) || '0:00'}  duty ${hhmm(r.dutyMinutes) || '0:00'}${r.standbyMinutes ? `  standby ${hhmm(r.standbyMinutes)}` : ''}`),
      `Total: flying ${hhmm(report.totals.flyingMinutes) || '0:00'}, duty ${hhmm(report.totals.dutyMinutes) || '0:00'}, standby ${hhmm(report.totals.standbyMinutes) || '0:00'}`,
    ].join('\n');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="hours-title">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-800 p-4">
          <div>
            <h2 id="hours-title" className="text-base font-bold text-white">
              Hours report · {label}
            </h2>
            <p className="text-xs text-slate-400">From your roster as saved, with your updates. Check it against your airline's records.</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-auto">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-slate-900 text-[10px] uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Duty</th>
                <th className="px-3 py-2">Check-in</th>
                <th className="px-3 py-2">Sign-off</th>
                <th className="px-3 py-2 text-right">Flying</th>
                <th className="px-3 py-2 text-right">Duty</th>
                <th className="px-3 py-2 text-right">Standby</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 font-mono text-slate-200">
              {report.rows.map((r) => (
                <tr key={r.date}>
                  <td className="whitespace-nowrap px-3 py-1.5">{r.date.slice(5)}</td>
                  <td className="px-3 py-1.5 font-sans text-slate-300">{r.route}</td>
                  <td className="px-3 py-1.5">{r.checkIn}</td>
                  <td className="whitespace-nowrap px-3 py-1.5">{r.signOff}</td>
                  <td className="px-3 py-1.5 text-right">{hhmm(r.flyingMinutes)}</td>
                  <td className="px-3 py-1.5 text-right">{hhmm(r.dutyMinutes)}</td>
                  <td className="px-3 py-1.5 text-right">{hhmm(r.standbyMinutes)}</td>
                </tr>
              ))}
              {report.rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center font-sans text-slate-400">
                    No duties on your roster this month.
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot className="border-t border-slate-700 font-mono font-bold text-white">
              <tr>
                <td className="px-3 py-2 font-sans" colSpan={4}>
                  Total
                </td>
                <td className="px-3 py-2 text-right">{hhmm(report.totals.flyingMinutes) || '0:00'}</td>
                <td className="px-3 py-2 text-right">{hhmm(report.totals.dutyMinutes) || '0:00'}</td>
                <td className="px-3 py-2 text-right">{hhmm(report.totals.standbyMinutes) || '0:00'}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-800 p-3">
          <button
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(asText());
                setCopied(true);
              } catch {
                setCopied(false);
              }
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-200 hover:border-slate-500"
          >
            <Copy className="h-3.5 w-3.5" /> {copied ? 'Copied' : 'Copy as text'}
          </button>
          <button
            onClick={() => void saveOrShareFile(`CrewCircadian-hours-${period.start.slice(0, 7)}.csv`, hoursReportCsv(report, label), 'text/csv')}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-500"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" /> Save as spreadsheet
          </button>
        </div>
      </div>
    </div>
  );
};
