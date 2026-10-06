import React, { useState } from 'react';
import { ChevronDown, ShieldAlert, ShieldCheck } from 'lucide-react';
import { LimitReport, RuleSetId } from '../services/dutyLimits';
import { shortRange } from '../services/periodStats';

/**
 * DGCA duty limits for the month on screen: anything the roster puts over a limit, with the date and the
 * paragraph it comes from. A guide, not a compliance check: an airline's approved scheme can be stricter.
 */

interface Props {
  report: LimitReport;
  monthLabel: string;
  /** Issues in this month only. */
  issues: LimitReport['issues'];
  ruleSet: RuleSetId;
  onRuleSetChange: (id: RuleSetId) => void;
}

export const DutyLimitsCard: React.FC<Props> = ({ report, monthLabel, issues, ruleSet, onRuleSetChange }) => {
  const [showAbout, setShowAbout] = useState(false);
  const over = issues.filter((i) => i.severity === 'over').length;
  const checks = issues.length - over;
  const draft = report.rules.status === 'draft';

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 shadow-sm sm:p-5" aria-label="Duty limits">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
            {issues.length ? <ShieldAlert className="h-4 w-4 text-amber-400" /> : <ShieldCheck className="h-4 w-4 text-emerald-400" />}
            Duty limits
          </h3>
          <p className="text-xs text-slate-400">
            {report.rules.name} · {report.rules.note}
          </p>
        </div>
        <label className="flex items-center gap-2 text-xs text-slate-400">
          <input type="checkbox" checked={ruleSet === 'dgca-cc-v-draft'} onChange={(e) => onRuleSetChange(e.target.checked ? 'dgca-cc-v-draft' : 'dgca-cc-iv')} />
          Preview the draft rules (Issue V)
        </label>
      </div>

      {draft && <p className="mt-2 rounded-lg border border-amber-800/50 bg-amber-950/20 px-3 py-2 text-xs text-amber-200">Draft rules are shown for preview only. They are not in force until DGCA notifies them.</p>}

      <p className={`mt-3 text-sm ${issues.length ? 'text-slate-200' : 'text-emerald-300'}`}>
        {issues.length
          ? [over && `${over} over a limit`, checks && `${checks} to check`].filter(Boolean).join(' · ') + ` in ${monthLabel}`
          : `Nothing over the limits in ${monthLabel}, from what your roster shows.`}
      </p>

      {issues.length > 0 && (
        <ul className="mt-2 space-y-2">
          {issues.map((i, k) => (
            <li key={k} className="flex gap-3 text-xs">
              <span className="w-14 shrink-0 text-slate-400">{shortRange(i.date, i.date)}</span>
              <span className="min-w-0">
                <span className={`font-semibold ${i.severity === 'over' ? 'text-amber-300' : 'text-sky-300'}`}>{i.title}</span>
                <span className="block text-slate-300">{i.detail}</span>
                <span className="block text-slate-500">{i.ref}</span>
              </span>
            </li>
          ))}
        </ul>
      )}

      <button onClick={() => setShowAbout(!showAbout)} aria-expanded={showAbout} className="mt-3 flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-slate-200">
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showAbout ? 'rotate-180' : ''}`} />
        What this checks
      </button>
      {showAbout && (
        <div className="mt-2 space-y-1.5 text-xs leading-relaxed text-slate-400">
          <p>
            Checks your roster as published (plus callouts, cancellations and standby changes you recorded; not delays) against the cabin crew limits in DGCA CAR
            Section 7, Series J, Part I: flight duty period by flight time and landings (with the night-time reduction), rest before each duty, weekly rest,
            consecutive nights, standby, and flight and duty time totals.
          </p>
          <ul className="list-disc space-y-1 pl-4">
            {report.notChecked.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
          <p className="text-slate-500">
            This is a guide based on the published DGCA text, not your airline&apos;s approved FDTL scheme, which can be stricter. If something looks wrong,
            raise it through your airline&apos;s process.
          </p>
        </div>
      )}
    </section>
  );
};
