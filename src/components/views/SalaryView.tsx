import React, { useMemo, useState } from 'react';
import { CircadianPlan, CrewPreferences } from '../../types/circadian';
import { SalarySection } from '../SalarySection';
import { computePeriodStats, Period, periodContaining, shiftPeriod, shortRange } from '../../services/periodStats';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface SalaryViewProps {
  plan: CircadianPlan;
  onUpdatePreferences: (updated: Partial<CrewPreferences>) => void;
}

const DAY_MS = 86400000;
const toMs = (d: string) => Date.parse(`${d}T12:00:00Z`);

/** Moves a date by whole months, keeping the day where the month allows it (31 Jan + 1 → 28 Feb). */
function shiftMonths(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const target = new Date(Date.UTC(y, m - 1 + n, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return target.toISOString().slice(0, 10);
}

/**
 * Salary estimate for a date range the crew member chooses. Quick picks fill the range in;
 * the arrows move it by a month, which suits both calendar months and airline pay cycles.
 */
export const SalaryView: React.FC<SalaryViewProps> = ({ plan, onUpdatePreferences }) => {
  const todayStr = new Date(Date.now() + plan.preferences.homeBaseTzOffset * 3600000).toISOString().slice(0, 10);
  const thisMonth = periodContaining(todayStr);
  const rosterDays = plan.dailySummaries.filter((d) => !d.outsideRoster).map((d) => d.dateStr);
  const wholeRoster: Period | undefined = rosterDays.length ? { start: rosterDays[0], end: rosterDays[rosterDays.length - 1] } : undefined;

  // Start on the same window as the sidebar estimate (this month, or the latest month with flights)
  const [range, setRange] = useState<Period>({
    start: plan.salaryBreakdown.periodStart ?? thisMonth.start,
    end: plan.salaryBreakdown.periodEnd ?? thisMonth.end,
  });
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(range.start) && /^\d{4}-\d{2}-\d{2}$/.test(range.end) && range.start <= range.end;
  const [lastValid, setLastValid] = useState(range);
  if (valid && (lastValid.start !== range.start || lastValid.end !== range.end)) setLastValid(range);

  const stats = useMemo(() => computePeriodStats(plan, valid ? range : lastValid), [plan, range, lastValid, valid]);
  const [showRates, setShowRates] = useState(false);
  const days = Math.round((toMs(stats.end) - toMs(stats.start)) / DAY_MS) + 1;

  const presets: { label: string; period?: Period }[] = [
    { label: 'This month', period: thisMonth },
    { label: 'Last month', period: shiftPeriod(thisMonth, -1) },
    { label: 'Whole roster', period: wholeRoster },
  ];
  const isActive = (p?: Period) => !!p && p.start === range.start && p.end === range.end;

  // The salary card shows the chosen range instead of the default one
  const periodPlan: CircadianPlan = {
    ...plan,
    salaryBreakdown: stats.salary,
    monthlyStats: {
      ...plan.monthlyStats,
      totalFlightHours: stats.flyingHours,
      totalSectors: stats.sectors,
      woclNightFlights: stats.nightFlights,
      standbyHours: stats.standbyHours,
      offDays: stats.daysWithoutFlights,
    },
  };

  const isOneCalendarMonth = stats.start.endsWith('-01') && periodContaining(stats.start).end === stats.end;
  const dateInput =
    'w-[10.5rem] rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 font-mono text-sm text-white focus:border-emerald-500 focus:outline-none';

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 sm:p-5 space-y-3">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Calculate pay for</span>

        {/* Date range */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setRange({ start: shiftMonths(range.start, -1), end: shiftMonths(range.end, -1) })}
            disabled={!valid}
            aria-label="Move back one month"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <label className="flex items-center gap-2 text-xs text-slate-400">
            From
            <input type="date" value={range.start} onChange={(e) => setRange((r) => ({ ...r, start: e.target.value }))} className={dateInput} />
          </label>
          <span className="text-slate-500">→</span>
          <label className="flex items-center gap-2 text-xs text-slate-400">
            To
            <input type="date" value={range.end} onChange={(e) => setRange((r) => ({ ...r, end: e.target.value }))} className={dateInput} />
          </label>
          <button
            onClick={() => setRange({ start: shiftMonths(range.start, 1), end: shiftMonths(range.end, 1) })}
            disabled={!valid}
            aria-label="Move forward one month"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white disabled:opacity-30"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Quick picks */}
        <div className="flex flex-wrap gap-2">
          {presets.map((p) => (
            <button
              key={p.label}
              onClick={() => p.period && setRange(p.period)}
              disabled={!p.period}
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors disabled:opacity-30 ${
                isActive(p.period) ? 'border-emerald-600 bg-emerald-950/50 text-emerald-200' : 'border-slate-700 text-slate-300 hover:border-slate-500'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* What is counted */}
        {valid ? (
          <p className="text-xs text-slate-300">
            <span className="font-semibold text-white">{shortRange(stats.start, stats.end)}</span> · {days} days · {stats.sectors} sectors{stats.positioningSectors > 0 && ` + ${stats.positioningSectors} positioning`} ·{' '}
            {stats.flyingHours}h flying · {stats.standbyHours}h standby · {stats.layoverNights} layover{stats.layoverNights === 1 ? '' : 's'}
            {stats.rosterTo && stats.rosterTo < stats.end && (
              <span className="text-slate-500"> · your roster ends {shortRange(stats.rosterTo, stats.rosterTo)}</span>
            )}
          </p>
        ) : (
          <p className="text-xs text-rose-300">Choose a start date on or before the end date.</p>
        )}
        <p className="text-[11px] text-slate-500">
          Flights count on the day they depart (home time).
          {!isOneCalendarMonth && ' Base pay is shown for one full month, whatever the length of the range.'}
        </p>
      </div>

      {/* No roster for these dates: no estimate (pay rates can still be set) */}
      {stats.rosterDays === 0 && (
        <div className="space-y-2 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-300">
          <p>No roster for these dates, so there is no pay estimate. Upload your roster to see one.</p>
          {!showRates && (
            <button onClick={() => setShowRates(true)} className="text-xs font-semibold text-slate-400 hover:text-white">
              Set your pay rates
            </button>
          )}
        </div>
      )}
      {(stats.rosterDays > 0 || showRates) && <SalarySection plan={periodPlan} onUpdatePreferences={onUpdatePreferences} isModal={false} />}
    </div>
  );
};
