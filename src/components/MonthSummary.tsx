import React, { useState } from 'react';
import { coverageNote, flightRangeNote, monthNarrative, PeriodStats, shortRange, hoursMinutes } from '../services/periodStats';
import { ChevronDown } from 'lucide-react';

/**
 * Monthly roster summary: "What kind of month is this going to be for me?"
 * Leads with one factual sentence, then flying hours and days off, then the duties that disrupt sleep,
 * duty days and standby. Everything else is behind "See details".
 */

interface MonthSummaryProps {
  stats: PeriodStats;
  /** Hide the month title when the screen already shows it (e.g. next to a month picker). */
  hideTitle?: boolean;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Layovers in a line: international ones named, as they matter most for domestic-heavy crew. */
function layoverLine(l: PeriodStats['layovers']): string {
  if (l.total === 0) return 'No layovers';
  const names = (stations: string[]) => (stations.length ? ` (${stations.join(', ')})` : '');
  const unverified = l.unverified ? `, ${l.unverified} not verified` : '';
  if (l.international === l.total) return `${plural(l.total, 'layover')}, all international${names(l.internationalStations)}`;
  if (l.domestic === l.total) return `${plural(l.total, 'layover')}, all domestic${names(l.domesticStations)}`;
  const parts = [
    l.international && `${l.international} international${names(l.internationalStations)}`,
    l.domestic && `${l.domestic} domestic${names(l.domesticStations)}`,
  ].filter(Boolean);
  return `${plural(l.total, 'layover')}: ${parts.join(', ')}${unverified}`;
}

/** A line under a tile's number. Muted lines give context (what was counted) rather than a figure. */
type Line = string | { text: string; muted: true } | false | 0 | undefined;
const muted = (text: string): Line => ({ text, muted: true });

/**
 * One summary tile. Under the number, every fact is its own bulleted line (the bullet hangs, so a wrapped
 * line stays aligned with its text); " · " only splits a breakdown of the tile's own number
 * (e.g. "2 early · 3 overnight"). Context lines (what was counted) come last, dimmer and without a bullet,
 * so they read as a footnote rather than another figure.
 */
const Tile: React.FC<{ title: string; value: React.ReactNode; lines?: Line[]; large?: boolean; className?: string }> = ({
  title,
  value,
  lines = [],
  large,
  className = '',
}) => {
  const shown = lines.filter(Boolean) as (string | { text: string; muted: true })[];
  const facts = shown.filter((l): l is string => typeof l === 'string');
  const context = shown.filter((l): l is { text: string; muted: true } => typeof l !== 'string');
  return (
    <div className={`rounded-xl border border-slate-800 bg-slate-950/60 p-3.5 ${className}`}>
      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{title}</span>
      <p className={`mt-1 font-bold text-white ${large ? 'text-2xl' : 'text-lg'}`}>{value}</p>
      {facts.length > 0 && (
        <ul className="mt-1.5 space-y-1 text-xs leading-snug text-slate-300">
          {facts.map((line) => (
            <li key={line} className="flex gap-2">
              <span aria-hidden className="mt-[0.35rem] h-1 w-1 shrink-0 rounded-full bg-slate-500" />
              <span>{line}</span>
            </li>
          ))}
        </ul>
      )}
      {context.map((line) => (
        <p key={line.text} className="mt-2 text-[11px] leading-snug text-slate-500">
          {line.text}
        </p>
      ))}
    </div>
  );
};

export const MonthSummary: React.FC<MonthSummaryProps> = ({ stats, hideTitle }) => {
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
        {!hideTitle && <h3 className="mb-1 text-base font-semibold text-white">{stats.label}</h3>}
        <p className="text-sm leading-relaxed text-slate-200">{monthNarrative(stats)}</p>
        <p className="mt-1 text-xs text-slate-500">{coverageNote(stats)}</p>
      </div>

      {hasRoster && (
        <>
          {/* Top row: flying hours and days off */}
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <Tile
              large
              title="Flying hours"
              value={hoursMinutes(stats.flyingMinutes)}
              lines={[
                stats.flown && `${hoursMinutes(stats.flown.actualMinutes)} flown (actual times) · ${hoursMinutes(stats.flown.otherMinutes)} still scheduled`,
                `Total duty hours ${hoursMinutes(stats.dutyMinutes)} (check-in to sign-off)`,
                muted(`Hours:minutes · ${flightRangeNote(stats)}`),
              ]}
            />
            <Tile
              large
              title="Days off"
              value={plural(stats.daysOff, 'day')}
              lines={[
                stats.longestBreak.days >= 2
                  ? `Longest break ${stats.longestBreak.days} days (${shortRange(stats.longestBreak.from!, stats.longestBreak.to!)})`
                  : stats.daysOff > 0
                  ? 'Single days only'
                  : 'None on your roster',
                stats.daysOff > 0 && `${stats.weekendDaysOff} on a weekend`,
                stats.noDutyDays > 0 && `${stats.noDutyDays} of them no duty (blank on your roster)`,
                notCounted.length > 0 && muted(`Not counted: ${notCounted.join(', ')}`),
              ]}
            />
          </div>

          {/* Second row: duties that disrupt sleep, duty days, standby (and time zones when relevant) */}
          {/* On phones the duty-days tile, which has the most to say, takes the full width */}
          <div className={`grid grid-flow-row-dense grid-cols-2 gap-2.5 ${stats.timeZoneTrips > 0 ? 'sm:grid-cols-4' : 'sm:grid-cols-3'}`}>
            <Tile
              title="Duties that disrupt sleep"
              value={
                <>
                  {d.total} <span className="text-base font-medium text-slate-400">of {plural(d.ofDuties, 'duty', 'duties')}</span>
                </>
              }
              lines={[breakdown.length ? breakdown.join(' · ') : 'None cut into normal night sleep']}
            />
            <Tile
              className="col-span-2 sm:col-span-1"
              title="Duty days"
              value={
                <>
                  {plural(stats.dutyDays, 'day')}{' '}
                  <span className="text-base font-medium text-slate-400">· {plural(stats.sectors, 'sector')}</span>
                </>
              }
              lines={[
                layoverLine(stats.layovers),
                stats.longestRun.days >= 2 &&
                  `Longest run ${stats.longestRun.days} days (${shortRange(stats.longestRun.from!, stats.longestRun.to!)})`,
                stats.positioningSectors > 0 && muted(`Plus ${stats.positioningSectors} positioning (as passenger)`),
              ]}
            />
            <Tile
              title="Standby"
              value={stats.standbyDays ? plural(stats.standbyDays, 'day') : 'None'}
              lines={
                stats.standbyDays
                  ? [
                      [
                        stats.standbyDaysByKind.home && `${stats.standbyDaysByKind.home} home`,
                        stats.standbyDaysByKind.airport && `${stats.standbyDaysByKind.airport} airport`,
                      ]
                        .filter(Boolean)
                        .join(' · '),
                      `${hoursMinutes(stats.standbyMinutes)} in total`,
                    ]
                  : ['No standby this month']
              }
            />
            {stats.timeZoneTrips > 0 && (
              <Tile title="Time zones" value={plural(stats.timeZoneTrips, 'trip')} lines={[muted('3+ hours from home time')]} />
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
                    ['Duty hours (check-in to sign-off)', hoursMinutes(stats.dutyMinutes)],
                    [
                      'Longest duty',
                      stats.longestDuty ? `${hoursMinutes(stats.longestDuty.minutes)} (${shortRange(stats.longestDuty.date, stats.longestDuty.date)})` : '—',
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
