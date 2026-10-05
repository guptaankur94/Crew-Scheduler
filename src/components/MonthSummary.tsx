import React, { useState } from 'react';
import { monthNarrative, PeriodStats, shortRange } from '../services/periodStats';
import { ChevronDown } from 'lucide-react';

/**
 * Monthly roster summary: "What kind of month is this going to be for me?"
 * Leads with one factual sentence, then recovery (days off) against what takes from it
 * (sleep-disrupting duties), then the familiar workload numbers. Everything else is behind "See details".
 */

interface MonthSummaryProps {
  stats: PeriodStats;
  coverageNote: string;
  flightRangeNote: string;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

const Tile: React.FC<{ title: string; value: React.ReactNode; note?: React.ReactNode; large?: boolean }> = ({ title, value, note, large }) => (
  <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3.5">
    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{title}</span>
    <p className={`mt-1 font-bold text-white ${large ? 'text-2xl' : 'text-lg'}`}>{value}</p>
    {note && <div className="mt-1 text-xs text-slate-400">{note}</div>}
  </div>
);

export const MonthSummary: React.FC<MonthSummaryProps> = ({ stats, coverageNote, flightRangeNote }) => {
  const [showDetails, setShowDetails] = useState(false);
  const hasRoster = stats.rosterDays > 0;
  const notCounted = [
    stats.sickDays && plural(stats.sickDays, 'sick day'),
    stats.leaveDays && plural(stats.leaveDays, 'leave day'),
    stats.trainingDays && plural(stats.trainingDays, 'training day'),
  ].filter(Boolean) as string[];
  const d = stats.disruptive;
  const breakdown = [
    d.early && `${d.early} early`,
    d.overnight && `${d.overnight} overnight`,
    d.late && `${d.late} late`,
  ].filter(Boolean) as string[];

  return (
    <section className="rounded-2xl border border-slate-800 bg-gradient-to-r from-slate-900/95 via-slate-900/80 to-slate-950 p-4 sm:p-5 shadow-sm space-y-4">
      {/* What this month means */}
      <div>
        <h3 className="text-base font-semibold text-white">{stats.label}</h3>
        <p className="mt-1 text-sm leading-relaxed text-slate-200">{monthNarrative(stats)}</p>
        <p className="mt-1 text-xs text-slate-500">{coverageNote}</p>
      </div>

      {hasRoster && (
        <>
          {/* Recovery against what takes from it */}
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <Tile
              large
              title="Days off"
              value={plural(stats.daysOff, 'day')}
              note={
                <>
                  {stats.longestBreak.days >= 2
                    ? `Longest break ${stats.longestBreak.days} days in a row (${shortRange(stats.longestBreak.from!, stats.longestBreak.to!)})`
                    : stats.daysOff > 0
                    ? 'Single days only'
                    : 'None on your roster'}
                  {notCounted.length > 0 && <span className="block text-slate-500">Not counted: {notCounted.join(', ')}</span>}
                </>
              }
            />
            <Tile
              large
              title="Duties that disrupt sleep"
              value={
                <>
                  {d.total} <span className="text-base font-medium text-slate-400">of {plural(d.ofDuties, 'duty', 'duties')}</span>
                </>
              }
              note={breakdown.length ? breakdown.join(' · ') : 'None cut into normal night sleep'}
            />
          </div>

          {/* Workload and pay */}
          <div className={`grid grid-cols-2 gap-2.5 ${stats.timeZoneTrips > 0 ? 'sm:grid-cols-4' : 'sm:grid-cols-3'}`}>
            <Tile title="Duty days" value={stats.dutyDays} note={plural(stats.sectors, 'flight')} />
            <Tile title="Flying hours" value={`${stats.flyingHours}h`} note={flightRangeNote} />
            <Tile title="Standby" value={plural(stats.standbyDays, 'day')} note={`${stats.standbyHours}h`} />
            {stats.timeZoneTrips > 0 && (
              <Tile title="Time zones" value={plural(stats.timeZoneTrips, 'trip')} note="3+ hours from home time" />
            )}
          </div>

          {/* Details */}
          <div>
            <button
              onClick={() => setShowDetails(!showDetails)}
              aria-expanded={showDetails}
              className="flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-slate-200"
            >
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showDetails ? 'rotate-180' : ''}`} />
              {showDetails ? 'Hide details' : 'See details'}
            </button>
            {showDetails && (
              <div className="mt-3 space-y-3 text-xs">
                <dl className="grid grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-2">
                  {[
                    ['Duty hours (report to release)', `${stats.dutyHours}h`],
                    [
                      'Longest duty',
                      stats.longestDuty ? `${stats.longestDuty.hours}h (${shortRange(stats.longestDuty.date, stats.longestDuty.date)})` : '—',
                    ],
                    [
                      'Longest run of duty days',
                      stats.longestRun.days ? `${plural(stats.longestRun.days, 'day')} (${shortRange(stats.longestRun.from!, stats.longestRun.to!)})` : '—',
                    ],
                    ['Nights away from home', `${stats.layoverNights}`],
                    ['Weekend days off (Sat/Sun)', `${stats.weekendDaysOff}`],
                    ['Training days', `${stats.trainingDays}`],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-3 border-b border-slate-800/70 py-1">
                      <dt className="text-slate-400">{k}</dt>
                      <dd className="font-mono text-slate-200">{v}</dd>
                    </div>
                  ))}
                </dl>
                <p className="leading-relaxed text-slate-500">
                  <strong className="text-slate-400">How duties that disrupt sleep are counted:</strong> each flying duty counts
                  once, in home time: <em>overnight</em> if any part falls between 02:00 and 04:59, otherwise an{' '}
                  <em>early start</em> if you report between 05:00 and 06:59, otherwise a <em>late finish</em> if you are
                  released between 23:00 and 01:59. These bands follow the European aviation rules on disruptive schedules
                  (EASA ORO.FTL.105). Days off exclude sick, leave and training days.
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
};
