import React, { useMemo, useState } from 'react';
import { CircadianEvent, CircadianPlan } from '../../types/circadian';
import { ChevronLeft, ChevronRight, ChevronRight as RowArrow, FileSearch, X } from 'lucide-react';
import { MonthSummary } from '../MonthSummary';
import { DateNavigator, statusOf } from '../DateNavigator';
import { MasterRosterOverview } from '../MasterRosterOverview';
import { computePeriodStats, periodContaining, periodLabel, shiftPeriod } from '../../services/periodStats';
import { monthDayRows } from '../../services/monthDays';
import { checkDutyLimits, RuleSetId } from '../../services/dutyLimits';
import { DutyLimitsCard } from '../DutyLimitsCard';
import { RosterData } from '../../types/circadian';

/**
 * The Month screen: pick a month, read what kind of month it is, see it as a calendar and as a list
 * of days. Tapping a day opens it in the Timeline. The full roster table (with the side-by-side check
 * against the original document) is behind "Check against original".
 */

interface MonthViewProps {
  plan: CircadianPlan;
  /** First day of the month to show (YYYY-MM-01). */
  month: string;
  onChangeMonth: (month: string) => void;
  onOpenDay: (dateStr: string) => void;
  onSelectEvent?: (event: CircadianEvent) => void;
  /** Whether the full roster table is open in place of the month overview. */
  showOriginal: boolean;
  onShowOriginalChange: (show: boolean) => void;
  /** The roster as published plus the person's recorded changes except delays, for the duty-limit check. */
  limitsRoster: RosterData;
}

const DISRUPTION_TAG = {
  overnight: { label: 'Overnight', className: 'border-amber-700/60 text-amber-300' },
  early: { label: 'Early start', className: 'border-amber-700/60 text-amber-300' },
  late: { label: 'Late finish', className: 'border-amber-700/60 text-amber-300' },
} as const;

const OTHER_DAY_LABEL: Record<string, string> = {
  off: 'Day off',
  leave: 'Leave',
  sick: 'Sick',
  training: 'Training',
};

export const MonthView: React.FC<MonthViewProps> = ({
  plan,
  month,
  onChangeMonth,
  onOpenDay,
  onSelectEvent,
  showOriginal,
  onShowOriginalChange: setShowOriginal,
  limitsRoster,
}) => {
  const { dailySummaries, preferences } = plan;
  const todayStr = new Date(Date.now() + preferences.homeBaseTzOffset * 3600000).toISOString().slice(0, 10);

  const period = useMemo(() => periodContaining(month, 1), [month]);
  const stats = useMemo(() => computePeriodStats(plan, period), [plan, period]);
  const rows = useMemo(() => monthDayRows(plan, stats), [plan, stats]);

  // DGCA duty limits over the whole roster (totals need earlier days), shown for this month
  const [ruleSet, setRuleSet] = useState<RuleSetId>(() => {
    try {
      return localStorage.getItem('crew_limits_rules_v1') === 'dgca-cc-v-draft' ? 'dgca-cc-v-draft' : 'dgca-cc-iv';
    } catch {
      return 'dgca-cc-iv';
    }
  });
  const chooseRuleSet = (id: RuleSetId) => {
    setRuleSet(id);
    try {
      localStorage.setItem('crew_limits_rules_v1', id);
    } catch {
      // Not remembered: it simply resets next time
    }
  };
  const rosterDays = dailySummaries.filter((d) => !d.outsideRoster).map((d) => d.dateStr);
  const limits = useMemo(
    () => checkDutyLimits(limitsRoster, ruleSet, rosterDays.length ? { from: rosterDays[0], to: rosterDays[rosterDays.length - 1] } : undefined),
    [limitsRoster, ruleSet, rosterDays[0], rosterDays[rosterDays.length - 1]]
  );
  const monthIssues = limits.issues.filter((i) => i.date >= period.start && i.date <= period.end);
  const issueDates = new Set(monthIssues.map((i) => i.date));

  // The months the plan covers, so the picker stops at its ends
  const firstMonth = `${(dailySummaries[0]?.dateStr ?? todayStr).slice(0, 7)}-01`;
  const lastMonth = `${(dailySummaries[dailySummaries.length - 1]?.dateStr ?? todayStr).slice(0, 7)}-01`;
  const go = (n: number) => onChangeMonth(shiftPeriod(period, n, 1).start);

  if (showOriginal) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => setShowOriginal(false)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:border-slate-600 hover:text-white"
        >
          <X className="h-3.5 w-3.5" />
          Back to {periodLabel(period)}
        </button>
        <MasterRosterOverview plan={plan} onJumpToTimeline={onOpenDay} onSelectEvent={onSelectEvent} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Month picker */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <button
            onClick={() => go(-1)}
            disabled={month <= firstMonth}
            aria-label="Previous month"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white disabled:opacity-25 disabled:hover:bg-transparent"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h2 className="min-w-[11rem] text-center text-lg font-semibold text-white">{periodLabel(period)}</h2>
          <button
            onClick={() => go(1)}
            disabled={month >= lastMonth}
            aria-label="Next month"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white disabled:opacity-25 disabled:hover:bg-transparent"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
        <button
          onClick={() => setShowOriginal(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:border-slate-600 hover:text-white"
        >
          <FileSearch className="h-3.5 w-3.5" />
          Check against original
        </button>
      </div>

      {/* What kind of month this is */}
      <MonthSummary stats={stats} hideTitle />

      {/* DGCA duty limits for this month */}
      {rosterDays.length > 0 && (
        <DutyLimitsCard report={limits} monthLabel={periodLabel(period)} issues={monthIssues} ruleSet={ruleSet} onRuleSetChange={chooseRuleSet} />
      )}

      {/* Calendar */}
      <DateNavigator days={dailySummaries} selectedDate="" todayStr={todayStr} onSelect={onOpenDay} month={month} />

      {/* Every day of the month */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/70 shadow-sm">
        <h3 className="border-b border-slate-800 px-4 py-3 text-sm font-semibold text-white sm:px-5">All days</h3>
        {rows.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-400 sm:px-5">No days to show for this month.</p>
        ) : (
          <ul className="max-h-[32rem] divide-y divide-slate-800/70 overflow-y-auto">
            {rows.map((row) => {
              const status = statusOf(row.summary);
              const d = new Date(`${row.dateStr}T12:00:00Z`);
              const isToday = row.dateStr === todayStr;
              const kind = row.summary.dutyType;
              return (
                <li key={row.dateStr}>
                  <button
                    onClick={() => onOpenDay(row.dateStr)}
                    className={`flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-800/50 sm:px-5 ${isToday ? 'bg-blue-950/30' : ''}`}
                  >
                    {/* Date */}
                    <div className="w-11 shrink-0 text-center">
                      <p className={`text-[10px] font-semibold uppercase ${isToday ? 'text-blue-300' : 'text-slate-500'}`}>
                        {isToday ? 'Today' : d.toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' })}
                      </p>
                      <p className="text-lg font-semibold tabular-nums text-white">{d.getUTCDate()}</p>
                    </div>

                    {/* What the day is */}
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        {status && (
                          <span className={`flex items-center gap-1.5 text-xs font-medium ${status.text}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
                            {row.legs.length > 0
                              ? 'Duty'
                              : row.standby
                              ? 'Standby'
                              : row.summary.outsideRoster
                              ? 'No roster for this day'
                              : OTHER_DAY_LABEL[kind] ?? status.label}
                            {row.code && <span className="text-slate-500">({row.code})</span>}
                          </span>
                        )}
                        {issueDates.has(row.dateStr) && (
                          <span className="rounded-full border border-amber-600/60 bg-amber-950/30 px-2 py-0.5 text-[10px] font-semibold text-amber-200">Check limits</span>
                        )}
                        {row.disruption && (
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${DISRUPTION_TAG[row.disruption].className}`}>
                            {DISRUPTION_TAG[row.disruption].label}
                          </span>
                        )}
                      </div>
                      {row.legs.length > 0 && (
                        <p className="truncate font-mono text-xs text-slate-300">
                          {row.report && <span className="text-slate-400">Report {row.report} · </span>}
                          {row.legs.map((l) => (l.positioning ? `(${l.label})` : l.label)).join('  ')}
                          {row.release && (
                            <span className="text-slate-400">
                              {' '}
                              · Release {row.release}
                              {row.releaseDayOffset > 0 && <sup>+{row.releaseDayOffset}</sup>}
                            </span>
                          )}
                        </p>
                      )}
                      {row.standby && (
                        <p className="font-mono text-xs text-slate-300">
                          {row.standby.kind === 'home' ? 'Home standby' : 'Airport standby'} {row.standby.start}–{row.standby.end}
                        </p>
                      )}
                    </div>

                    <RowArrow className="h-4 w-4 shrink-0 text-slate-600" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <p className="border-t border-slate-800 px-4 py-2.5 text-[11px] text-slate-500 sm:px-5">
          Times are home time. Flights in brackets are positioning (as passenger). Tap a day to open it in the Timeline.
        </p>
      </section>
    </div>
  );
};
