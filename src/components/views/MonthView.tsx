import React, { useMemo, useState } from 'react';
import { CircadianEvent, CircadianPlan, CrewPreferences } from '../../types/circadian';
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, ChevronRight as RowArrow, FileSpreadsheet, PencilLine } from 'lucide-react';
import { DayItems, DayPanel } from '../DayPanel';
import { daySignature, Finding, findingsByDate } from '../../services/rosterFindings';
import { TimeConvention } from '../../services/rosterTimes';
import { flightHomeDate, rosterClock } from '../../services/rosterKeys';
import { HoursReportDialog } from '../HoursReportDialog';
import { PayEstimateCard } from '../PayEstimateCard';
import { MonthSummary } from '../MonthSummary';
import { DateNavigator, statusOf } from '../DateNavigator';
import { computePeriodStats, periodContaining, periodLabel, shiftPeriod } from '../../services/periodStats';
import { monthDayRows } from '../../services/monthDays';
import { checkDutyLimits, RuleSetId, rulesStatus } from '../../services/dutyLimits';
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
  /** The roster as published plus the person's recorded changes except delays, for the duty-limit check. */
  limitsRoster: RosterData;
  /** The roster as published, to check and correct. */
  roster: RosterData;
  timeConvention: TimeConvention;
  checkedDays: Record<string, string>;
  onToggleChecked: (date: string, checked: boolean) => void;
  onCorrectDay: (date: string, next: DayItems) => void;
  /** Saves the person's own pay rates (pay estimate). */
  onUpdatePreferences?: (updated: Partial<CrewPreferences>) => void;
  onApplyFix: (fix: NonNullable<Finding['fix']>) => void;
  /** The person's own updates per day, in plain words. */
  updateLines?: Map<string, string[]>;
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
  limitsRoster,
  roster,
  timeConvention,
  checkedDays,
  onToggleChecked,
  onCorrectDay,
  onUpdatePreferences,
  onApplyFix,
  updateLines,
}) => {
  const { dailySummaries, preferences } = plan;
  const todayStr = new Date(Date.now() + preferences.homeBaseTzOffset * 3600000).toISOString().slice(0, 10);

  const period = useMemo(() => periodContaining(month, 1), [month]);
  const stats = useMemo(() => computePeriodStats(plan, period), [plan, period]);
  const rows = useMemo(() => monthDayRows(plan, stats), [plan, stats]);

  // DGCA duty limits over the whole roster (totals need earlier days), shown for this month
  // Which DGCA rules the guide uses: the ones in force, unless the draft preview is on in Settings
  const ruleSet: RuleSetId = plan.preferences.dutyLimitRules ?? 'dgca-cc-iv';
  const rosterDays = dailySummaries.filter((d) => !d.outsideRoster).map((d) => d.dateStr);
  const limits = useMemo(
    () => checkDutyLimits(limitsRoster, ruleSet, rosterDays.length ? { from: rosterDays[0], to: rosterDays[rosterDays.length - 1] } : undefined),
    [limitsRoster, ruleSet, rosterDays[0], rosterDays[rosterDays.length - 1]]
  );
  // Out-of-date rules are not used at all (see rulesStatus)
  const rulesCurrent = rulesStatus(limits.rules).current;
  const monthIssues = rulesCurrent ? limits.issues.filter((i) => i.date >= period.start && i.date <= period.end) : [];

  // "Is my roster right?": doubts per day, edits, and days the person has checked
  const findings = useMemo(
    () => findingsByDate(roster, rulesCurrent ? limits : null, rosterDays.length ? { from: rosterDays[0], to: rosterDays[rosterDays.length - 1] } : undefined),
    [roster, limits, rulesCurrent, rosterDays[0], rosterDays[rosterDays.length - 1]]
  );
  const editedDates = useMemo(() => {
    const clock = rosterClock(roster);
    return new Set(roster.flights.filter((f) => f.correctedByUser || f.userChange === 'added').map((f) => flightHomeDate(f, clock)));
  }, [roster]);
  const isChecked = (date: string) => checkedDays[date] !== undefined && checkedDays[date] === daySignature(roster, date);
  const rosterRows = rows.filter((r) => !r.summary.outsideRoster);
  const counts = {
    days: rosterRows.length,
    toCheck: rosterRows.filter((r) => findings.has(r.dateStr)).length,
    edited: rosterRows.filter((r) => editedDates.has(r.dateStr)).length,
    checked: rosterRows.filter((r) => isChecked(r.dateStr)).length,
  };
  const [filter, setFilter] = useState<'all' | 'check' | 'edited' | 'unchecked'>('all');
  const shownRows = rows.filter((r) =>
    filter === 'check' ? findings.has(r.dateStr) : filter === 'edited' ? editedDates.has(r.dateStr) : filter === 'unchecked' ? !r.summary.outsideRoster && !isChecked(r.dateStr) : true
  );
  const [panelDate, setPanelDate] = useState<string | null>(null);
  const [showHours, setShowHours] = useState(false);

  // The months the plan covers, so the picker stops at its ends
  const firstMonth = `${(dailySummaries[0]?.dateStr ?? todayStr).slice(0, 7)}-01`;
  const lastMonth = `${(dailySummaries[dailySummaries.length - 1]?.dateStr ?? todayStr).slice(0, 7)}-01`;
  const go = (n: number) => onChangeMonth(shiftPeriod(period, n, 1).start);

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
        {rosterDays.length > 0 && (
          <button
            onClick={() => setShowHours(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:border-slate-600 hover:text-white"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            Hours report
          </button>
        )}
      </div>
      {showHours && <HoursReportDialog plan={plan} period={period} label={periodLabel(period)} onClose={() => setShowHours(false)} />}

      {/* What kind of month this is */}
      <MonthSummary stats={stats} hideTitle />

      {/* Pay from the person's own rates, closed by default */}
      {onUpdatePreferences && rosterDays.length > 0 && <PayEstimateCard stats={stats} preferences={plan.preferences} onUpdatePreferences={onUpdatePreferences} />}

      {/* DGCA duty limits: one line; the details are on the days marked ⚠ */}
      {rosterDays.length > 0 && (
        <p
          className={`flex flex-wrap items-center gap-1.5 text-xs ${monthIssues.length ? 'text-amber-200' : 'text-slate-400'}`}
          title={`A guide based on ${limits.rules.name} (${limits.rules.note}; rules last checked ${limits.rules.checkedOn}). Not an official check: your airline's approved scheme can differ.`}
        >
          {monthIssues.length > 0 && <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />}
          {!rulesCurrent
            ? `Duty-limit notes are switched off: the DGCA rules in the app were last checked on ${limits.rules.checkedOn} and are due to be checked again.`
            : monthIssues.length
            ? `${monthIssues.length} duty-limit ${monthIssues.length === 1 ? 'note' : 'notes'} worth a look in ${periodLabel(period)}: see the days marked ⚠`
            : `No duty-limit notes in ${periodLabel(period)} from what your roster shows. This is a guide, not an official check.`}
          {limits.rules.status === 'draft' && <span className="text-slate-500">(draft rules preview)</span>}
        </p>
      )}

      {/* Calendar */}
      <DateNavigator days={dailySummaries} selectedDate="" todayStr={todayStr} onSelect={setPanelDate} month={month} markers={new Set(findings.keys())} />

      {/* Every day of the month */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/70 shadow-sm">
        <div className="space-y-2 border-b border-slate-800 px-4 py-3 sm:px-5">
          <h3 className="text-sm font-semibold text-white">Check your roster</h3>
          {/* What was read this month, at a glance */}
          <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-300">
            <span>{counts.days} days read</span>
            <span className="text-emerald-300">✓ {counts.checked} checked</span>
            <span className={counts.toCheck ? 'text-amber-300' : 'text-slate-400'}>⚠ {counts.toCheck} to check</span>
            <span className="text-slate-400">✎ {counts.edited} edited by you</span>
          </p>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Show days">
            {(
              [
                ['all', 'All'],
                ['check', `⚠ To check (${counts.toCheck})`],
                ['unchecked', `Not checked yet (${counts.days - counts.checked})`],
                ['edited', `✎ Edited (${counts.edited})`],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                aria-pressed={filter === key}
                className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${filter === key ? 'border-blue-500 bg-blue-600/20 text-white' : 'border-slate-700 text-slate-300 hover:border-slate-500'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {shownRows.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-400 sm:px-5">{rows.length === 0 ? 'No days to show for this month.' : 'No days match this filter.'}</p>
        ) : rows.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-400 sm:px-5">No days to show for this month.</p>
        ) : (
          <ul className="max-h-[32rem] divide-y divide-slate-800/70 overflow-y-auto">
            {shownRows.map((row) => {
              const status = statusOf(row.summary);
              const d = new Date(`${row.dateStr}T12:00:00Z`);
              const isToday = row.dateStr === todayStr;
              const kind = row.summary.dutyType;
              return (
                <li key={row.dateStr}>
                  <button
                    onClick={() => setPanelDate(row.dateStr)}
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
                              : row.summary.noDuty
                              ? 'No duty'
                              : OTHER_DAY_LABEL[kind] ?? status.label}
                            {row.code && <span className="text-slate-500">({row.code})</span>}
                          </span>
                        )}
                        {isChecked(row.dateStr) && (
                          <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-300">
                            <CheckCircle2 className="h-3 w-3" /> Checked
                          </span>
                        )}
                        {editedDates.has(row.dateStr) && (
                          <span className="flex items-center gap-1 text-[10px] font-semibold text-slate-400">
                            <PencilLine className="h-3 w-3" /> Edited
                          </span>
                        )}
                        {row.disruption && (
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${DISRUPTION_TAG[row.disruption].className}`}>
                            {DISRUPTION_TAG[row.disruption].label}
                          </span>
                        )}
                      </div>
                      {row.legs.length > 0 && (
                        <p className="break-words font-mono text-xs leading-relaxed text-slate-300">
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
                      {/* Anything doubtful on this day, in plain words */}
                      {(findings.get(row.dateStr) ?? []).slice(0, 2).map((f, k) => (
                        <p key={k} className="flex gap-1.5 text-[11px] leading-snug text-amber-200">
                          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-400" />
                          <span>{f.message}</span>
                        </p>
                      ))}
                      {(findings.get(row.dateStr)?.length ?? 0) > 2 && (
                        <p className="pl-[18px] text-[11px] text-amber-300/80">+ {findings.get(row.dateStr)!.length - 2} more</p>
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
          Times are home time. Flights in brackets are positioning (as passenger). Tap a day to check or correct it, and open it in Days from there.
        </p>
      </section>

      {/* One day: check, correct, tick, or open in the Timeline */}
      {panelDate && (
        <DayPanel
          key={`${panelDate}|${roster.parsedAt}`}
          date={panelDate}
          roster={roster}
          findings={findings.get(panelDate) ?? []}
          convention={timeConvention}
          checked={isChecked(panelDate)}
          onToggleChecked={(c) => onToggleChecked(panelDate, c)}
          onSave={(date, next) => onCorrectDay(date, next)}
          onApplyFix={onApplyFix}
          updates={updateLines?.get(panelDate) ?? []}
          onOpenTimeline={(date) => {
            setPanelDate(null);
            onOpenDay(date);
          }}
          onClose={() => setPanelDate(null)}
        />
      )}
    </div>
  );
};
