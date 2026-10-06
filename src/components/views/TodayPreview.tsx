import React, { useEffect, useMemo, useState } from 'react';
import { CircadianEvent, CircadianPlan, CrewPreferences } from '../../types/circadian';
import { getNowNext, hasLocalTime, nextLine, nowLine, plainTitle } from '../../services/nowNext';
import { StandbyNotice } from '../StandbyNotice';
import { TodayGlance } from '../TodayGlance';
import { bunkChoiceForEvent, sectorKeyForEvent } from '../../services/rosterKeys';
import { formatAviationDate } from '../../utils/dateUtils';
import {
  ArrowRight,
  Bed,
  Bell,
  Briefcase,
  Car,
  Check,
  ChevronRight,
  Clock,
  Copy,
  Info,
  Moon,
  Plane,
  Sun,
} from 'lucide-react';

/**
 * Today (preview): "What do I need to do now?"
 * A quick-glance execution screen for the current moment. It reads the same plan as the classic
 * Today screen and changes nothing in it; the day picker, editing tools and full pillars live on the Timeline.
 */

interface TodayPreviewProps {
  plan: CircadianPlan;
  onSelectEvent: (event: CircadianEvent) => void;
  onUpdatePreferences: (updated: Partial<CrewPreferences>) => void;
  onOpenScience: () => void;
  onOpenSettings: () => void;
  onOpenTimeline: () => void;
  onNavigateToUpload?: () => void;
}

const HOUR = 3600000;
/** The runway is shown when getting ready for the next duty starts within this window. */
const RUNWAY_WINDOW_HOURS = 24;
/** Items shown before "Show all", to keep the screen glanceable. */
const GLANCE_ITEMS = 6;

/** Things worth listing for the rest of today (duty sub-steps and warnings are covered elsewhere). */
const TODAY_TYPES = new Set([
  'anchor_sleep',
  'recovery_sleep',
  'nasa_nap',
  'caffeine_allowed',
  'caffeine_cutoff',
  'eating_window',
  'fasting_window',
  'light_exposure',
  'melatonin_shield',
  'alcohol_cutoff',
]);

const TYPE_ICON: Record<string, React.ReactNode> = {
  anchor_sleep: <Moon className="h-4 w-4 text-purple-400" />,
  recovery_sleep: <Moon className="h-4 w-4 text-purple-400" />,
  nasa_nap: <Bed className="h-4 w-4 text-indigo-400" />,
  caffeine_allowed: <span className="text-sm leading-none">☕</span>,
  caffeine_cutoff: <span className="text-sm leading-none">🚫</span>,
  eating_window: <span className="text-sm leading-none">🥗</span>,
  fasting_window: <span className="text-sm leading-none">🍵</span>,
  light_exposure: <Sun className="h-4 w-4 text-amber-400" />,
  melatonin_shield: <span className="text-sm leading-none">🕶️</span>,
  alcohol_cutoff: <span className="text-sm leading-none">🚫</span>,
};

function untilText(ms: number): string {
  const minutes = Math.max(0, Math.round(ms / 60000));
  if (minutes < 60) return `in ${minutes} min`;
  const h = Math.floor(minutes / 60);
  if (h >= 48) return `in ${Math.round(h / 24)} days`;
  const m = minutes % 60;
  return m ? `in ${h}h ${m}m` : `in ${h}h`;
}

function weekdayDate(dateStr: string): string {
  const weekday = new Date(`${dateStr}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' });
  return `${weekday} ${formatAviationDate(dateStr)}`;
}

export const TodayPreview: React.FC<TodayPreviewProps> = ({
  plan,
  onSelectEvent,
  onUpdatePreferences,
  onOpenScience,
  onOpenSettings,
  onOpenTimeline,
  onNavigateToUpload,
}) => {
  const { events, dailySummaries, preferences, roster } = plan;
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [copied, setCopied] = useState(false);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  const offset = preferences.homeBaseTzOffset;
  const todayStr = new Date(nowMs + offset * HOUR).toISOString().slice(0, 10);
  const endOfTodayMs = Date.parse(`${todayStr}T00:00:00Z`) - offset * HOUR + 24 * HOUR;
  const today = dailySummaries.find((d) => d.dateStr === todayStr);
  const { now, next, nextDuty } = getNowNext(plan, nowMs);

  // The next duty: its getting-ready step, the flights in it, and when it ends
  const prep = nextDuty?.prep;
  const dutyFlights = nextDuty?.flights ?? [];
  const dutyEndMs = dutyFlights.length
    ? Math.max(...dutyFlights.map((f) => Date.parse(f.endUtc)))
    : prep
    ? Date.parse(prep.endUtc)
    : undefined;
  const runwayStartsIn = prep ? Date.parse(prep.startUtc) - nowMs : undefined;
  const showRunway = !!prep?.prepDetails && runwayStartsIn !== undefined && runwayStartsIn <= RUNWAY_WINDOW_HOURS * HOUR;
  // The report airport is the one named at the end of the getting-ready step, e.g. "report at 05:30 (DEL)"
  const reportAirport = prep?.subtitle.match(/\((\w{3})\)\s*$/)?.[1];
  const dutyInProgress = !!prep && Date.parse(prep.startUtc) <= nowMs && (dutyEndMs ?? 0) > nowMs;

  // Rest of today, in time order, from now until midnight home time
  const restOfToday = useMemo(
    () =>
      events
        .filter(
          (e) =>
            TODAY_TYPES.has(e.type) &&
            Date.parse(e.endUtc) > nowMs &&
            Date.parse(e.startUtc) < endOfTodayMs &&
            !e.id.startsWith('crew-rest-') &&
            // Already shown in the Now → Next card
            e.id !== now?.id &&
            e.id !== next?.id
        )
        .sort((a, b) => Date.parse(a.startUtc) - Date.parse(b.startUtc)),
    [events, nowMs, endOfTodayMs, now?.id, next?.id]
  );
  const visibleItems = showAll ? restOfToday : restOfToday.slice(0, GLANCE_ITEMS);

  const handleCopy = () => {
    const p = prep?.prepDetails;
    if (!p) return;
    const lines = [
      `✈️ Duty ${weekdayDate(prep!.dutyDate!)} (home time)`,
      p.targetBedtimeHbt ? `🛌 Bed by: ${p.targetBedtimeHbt}${p.targetBedtimeDateStr ? ` (${weekdayDate(p.targetBedtimeDateStr)})` : ''}` : null,
      `⏰ Wake up: ${p.wakeUpHbt}`,
      `🚖 ${p.pickupLabel || 'Leave home'}: ${p.cabPickupHbt}`,
      `🏢 Report: ${p.reportHbt}`,
      `🛫 Wheels up: ${p.departureHbt}`,
    ].filter(Boolean);
    navigator.clipboard.writeText(lines.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const outlook = today?.outlook;

  // Where today sits relative to the roster: before it starts, inside it, or after it ends
  const homeDate = (ms: number) => new Date(ms + offset * HOUR).toISOString().slice(0, 10);
  const hasRoster = roster.flights.length > 0;
  const firstDutyDate = hasRoster ? homeDate(Math.min(...roster.flights.map((f) => Date.parse(f.reportTimeUtc)))) : undefined;
  const lastDutyDate = hasRoster ? homeDate(Math.max(...roster.flights.map((f) => Date.parse(f.releaseTimeUtc)))) : undefined;
  const rosterEnded = !!lastDutyDate && lastDutyDate < todayStr;
  const rosterNotStarted = !!firstDutyDate && firstDutyDate > todayStr;
  const usualRhythmToday = !!today?.outsideRoster;
  const phase = plan.currentStatus.biologicalPhase;

  return (
    <div className="space-y-4 sm:space-y-5 max-w-4xl">
      {/* Cleared roster */}
      {roster.flights.length === 0 && (
        <div className="rounded-2xl border border-amber-900/50 bg-amber-950/20 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-200">
          <p>
            <strong className="text-white">No flights on your roster.</strong> Showing your usual home-time rest rhythm for{' '}
            {roster.homeBase}.
          </p>
          {onNavigateToUpload && (
            <button
              onClick={onNavigateToUpload}
              className="self-start sm:self-center rounded-xl bg-amber-600 hover:bg-amber-500 px-3 py-1.5 font-bold text-white shrink-0"
            >
              Upload roster ➔
            </button>
          )}
        </div>
      )}

      {/* 1. Now → Next (one card) */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 sm:p-5 shadow-lg">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[1.2fr_1fr] md:items-stretch">
          {/* Now */}
          <button
            onClick={() => now && onSelectEvent(now)}
            disabled={!now}
            className="text-left rounded-xl p-1 -m-1 hover:bg-slate-800/40 disabled:hover:bg-transparent transition-colors"
          >
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Now · {formatAviationDate(todayStr)}</span>
            <h2 className="mt-1 text-lg sm:text-xl font-bold text-white leading-snug">{now ? nowLine(now) : 'Free time'}</h2>
            <p className="mt-0.5 text-xs text-slate-400">
              {now ? (
                <>
                  Until <span className="font-mono text-slate-200">{now.endHbtStr}</span>
                  {hasLocalTime(now) && <span className="text-slate-500"> ({now.endLocalStr} local)</span>}
                </>
              ) : (
                'Nothing planned right now.'
              )}
            </p>
            {now && <p className="mt-2 text-sm text-slate-300 leading-relaxed">{now.subtitle}</p>}
          </button>

          {/* Next */}
          <div className="flex flex-col rounded-xl border border-slate-800 bg-slate-950/60 p-3.5">
            {next ? (
              <button onClick={() => onSelectEvent(next)} className="text-left">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Next · <span className="font-mono">{next.startHbtStr}</span> · {untilText(Date.parse(next.startUtc) - nowMs)}
                </span>
                <p className="mt-1 text-sm font-bold text-white">{nextLine(next)}</p>
                <p className="mt-0.5 text-xs text-slate-400 line-clamp-2">{next.subtitle}</p>
              </button>
            ) : (
              <p className="text-xs text-slate-400">Nothing else planned.</p>
            )}
            <div className="mt-auto pt-3 flex items-center justify-between text-[11px] text-slate-500">
              <span className="flex items-center gap-1.5">
                {phase === 'night_nadir' ? <Moon className="h-3.5 w-3.5 text-purple-400" /> : phase === 'day' ? <Sun className="h-3.5 w-3.5 text-amber-400" /> : <Clock className="h-3.5 w-3.5 text-sky-400" />}
                {phase === 'night_nadir' ? 'Body-clock night' : phase === 'day' ? 'Body-clock day' : 'Body-clock transition'}
              </span>
              <button onClick={onOpenScience} className="flex items-center gap-1 hover:text-slate-300">
                <Info className="h-3.5 w-3.5" /> Why?
              </button>
            </div>
          </div>
        </div>

        {/* Today's note, only when there is something to watch */}
        {outlook && outlook.level !== 'steady' && (
          <div
            className={`mt-4 rounded-xl border p-3 text-xs ${
              outlook.level === 'harder' ? 'border-amber-800/60 bg-amber-950/20' : 'border-sky-900/60 bg-sky-950/20'
            }`}
          >
            <p className="font-bold text-white">{outlook.headline}</p>
            <p className="mt-0.5 text-slate-300">
              Because of {outlook.reasons.join(' and ')}. {outlook.tip}
            </p>
          </div>
        )}
      </section>

      {/* Today in one line: the kind of day, check-in and sign-off */}
      <TodayGlance plan={plan} todayStr={todayStr} nowMs={nowMs} />

      {/* Standby, only when there is some today */}
      <StandbyNotice events={events.filter((e) => e.dutyDate === todayStr)} onSelectEvent={onSelectEvent} roster={roster} />

      {/* 2. Next duty: full runway within 24 hours, otherwise a one-line heads-up */}
      {showRunway && prep?.prepDetails ? (
        <section className="rounded-2xl border border-sky-800/80 bg-gradient-to-b from-sky-950/40 via-slate-900 to-slate-950 p-4 sm:p-5 shadow-sm space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-sky-900/50 pb-3">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className={`flex h-2 w-2 rounded-full ${dutyInProgress ? 'bg-emerald-400' : 'bg-sky-400'}`} />
                <h3 className="text-sm font-bold uppercase tracking-wider text-sky-200">
                  {dutyInProgress ? 'Duty in progress' : `Next duty · ${weekdayDate(prep.dutyDate!)}`}
                </h3>
              </div>
              <p className="text-xs text-slate-400">
                {prep.prepDetails.targetBedtimeHbt && !dutyInProgress ? (
                  <>
                    Bed by <strong className="font-mono text-purple-200">{prep.prepDetails.targetBedtimeHbt}</strong>
                    {prep.prepDetails.targetBedtimeDateStr ? ` (${weekdayDate(prep.prepDetails.targetBedtimeDateStr)})` : ''} ·{' '}
                  </>
                ) : null}
                Worked back from your report time · home time ({roster.homeBase})
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={onOpenSettings} className="text-[11px] text-slate-400 underline underline-offset-2 hover:text-slate-200">
                Change getting-ready and travel times
              </button>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 rounded-lg border border-sky-700/60 bg-sky-950/60 hover:bg-sky-900/60 px-3 py-1.5 text-xs font-bold text-sky-200 transition-all shadow-sm"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5 text-sky-300" />}
                <span>{copied ? 'Copied' : 'Copy Alarm Times'}</span>
              </button>
            </div>
          </div>

          {/* Wake → Leave → Report → Wheels up */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              {
                icon: <Bell className="h-3.5 w-3.5 text-sky-400" />,
                label: 'Wake up',
                time: prep.prepDetails.wakeUpHbt,
                note: `${prep.prepDetails.groomingMinutes} min to get ready`,
                color: 'text-white',
                border: 'border-sky-800/60',
              },
              {
                icon: <Car className="h-3.5 w-3.5 text-amber-400" />,
                label: prep.prepDetails.pickupLabel || 'Leave home',
                time: prep.prepDetails.cabPickupHbt,
                note: `${prep.prepDetails.cabBufferMinutes} min ${prep.prepDetails.isAwayFromBase ? 'hotel transport' : 'travel'}`,
                color: 'text-amber-300',
                border: 'border-amber-800/60',
              },
              {
                icon: <Briefcase className="h-3.5 w-3.5 text-blue-400" />,
                label: 'Report',
                time: prep.prepDetails.reportHbt,
                note: reportAirport ? `Check-in at ${reportAirport}` : 'Check-in',
                color: 'text-blue-300',
                border: 'border-blue-800/60',
              },
              {
                icon: <Plane className="h-3.5 w-3.5 text-blue-400" />,
                label: 'Wheels up',
                time: prep.prepDetails.departureHbt,
                note: dutyFlights.length ? `${dutyFlights.length} flight${dutyFlights.length > 1 ? 's' : ''}` : 'Standby',
                color: 'text-white',
                border: 'border-slate-700',
              },
            ].map((step, i) => (
              <div key={step.label} className={`relative rounded-xl border ${step.border} bg-slate-950 p-3.5`}>
                <span className="flex items-center gap-1 text-[11px] font-bold uppercase text-slate-300">
                  {step.icon} {step.label}
                </span>
                <p className={`mt-2 text-2xl font-black font-mono ${step.color}`}>{step.time}</p>
                <p className="mt-1 text-[11px] text-slate-400">{step.note}</p>
                {i < 3 && <ArrowRight className="absolute right-2 top-1/2 hidden h-3.5 w-3.5 -translate-y-1/2 text-slate-700 lg:block" />}
              </div>
            ))}
          </div>

          {/* The duty's flights, with crew-rest choice on long sectors */}
          {dutyFlights.length > 0 && (
            <div className="space-y-2">
              {dutyFlights.map((f) => (
                <div key={f.id} className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
                  <button onClick={() => onSelectEvent(f)} className="flex w-full items-center justify-between gap-3 text-left">
                    <span className="text-sm font-semibold text-white">{plainTitle(f)}</span>
                    <span className="font-mono text-xs text-slate-300">
                      {f.startHbtStr}–{f.endHbtStr}
                      {hasLocalTime(f) && <span className="text-slate-500"> · local {f.startLocalStr}–{f.endLocalStr}</span>}
                    </span>
                  </button>
                  {f.durationMinutes >= 300 && (
                    <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-slate-900 pt-2">
                      <span className="flex items-center gap-1.5 text-[11px] font-bold text-indigo-300">
                        <Bed className="h-3.5 w-3.5 text-indigo-400" /> Crew rest:
                      </span>
                      {(['shift1', 'shift2'] as const).map((shift) => {
                        const flightKey = sectorKeyForEvent(f.id, roster) ?? f.id.replace(/^flight-/, '');
                        const selected = (bunkChoiceForEvent(preferences, f.id, roster) || 'shift1') === shift;
                        return (
                          <button
                            key={shift}
                            onClick={() =>
                              onUpdatePreferences({
                                bunkShiftAssignments: { ...(preferences.bunkShiftAssignments || {}), [flightKey]: shift },
                              })
                            }
                            className={`rounded px-2.5 py-1 text-[10px] font-bold transition-all ${
                              selected ? 'bg-indigo-600 text-white ring-1 ring-indigo-400' : 'border border-slate-800 bg-slate-900 text-slate-400 hover:text-white'
                            }`}
                          >
                            {shift === 'shift1' ? 'First rest period' : 'Second rest period'}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      ) : prep ? (
        <button
          onClick={onOpenTimeline}
          className="flex w-full items-center justify-between rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-left hover:border-slate-700"
        >
          <span className="text-sm text-slate-300">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
              {rosterNotStarted ? 'Your roster starts' : 'Next duty'} · {untilText(Date.parse(prep.startUtc) - nowMs)}
            </span>
            <span className="text-white font-semibold">{weekdayDate(prep.dutyDate!)}</span> · report{' '}
            <span className="font-mono">{prep.prepDetails?.reportHbt}</span>
            {dutyFlights[0] && <> · {plainTitle(dutyFlights[0])}</>}
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-slate-600" />
        </button>
      ) : (
        hasRoster && (
          <div className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm">
              <p className="font-semibold text-white">
                {rosterEnded
                  ? `Your roster ended on ${weekdayDate(lastDutyDate!)}.`
                  : 'No more duties on this roster after today.'}
              </p>
              <p className="mt-0.5 text-xs text-slate-400">
                Upload your next roster to see your plan. Until then, below is your usual home-time rhythm.
              </p>
            </div>
            {onNavigateToUpload && (
              <button
                onClick={onNavigateToUpload}
                className="shrink-0 self-start rounded-xl bg-sky-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-sky-500 sm:self-center"
              >
                Upload roster
              </button>
            )}
          </div>
        )
      )}

      {/* 3. Rest of today: one list in time order */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
            {usualRhythmToday ? 'Your usual rhythm today' : showRunway ? 'Also today' : 'What matters today'}
          </h3>
          <span className="text-[11px] text-slate-500">
            {usualRhythmToday ? 'No roster for today · ' : ''}Home time ({roster.homeBase})
          </span>
        </div>
        {restOfToday.length === 0 ? (
          <p className="mt-2 px-1 text-sm text-slate-400">Nothing else planned for today beyond Now and Next.</p>
        ) : (
          <ul className="mt-2 divide-y divide-slate-800/70">
            {visibleItems.map((e) => {
              const active = Date.parse(e.startUtc) <= nowMs && Date.parse(e.endUtc) > nowMs;
              return (
                <li key={e.id}>
                  <button
                    onClick={() => onSelectEvent(e)}
                    className={`flex w-full items-start gap-3 rounded-lg px-1 py-2.5 text-left hover:bg-slate-800/40 ${active ? 'bg-slate-800/30' : ''}`}
                  >
                    <span className="mt-0.5 w-5 shrink-0 text-center">{TYPE_ICON[e.type]}</span>
                    <span className="w-24 shrink-0 font-mono text-xs text-slate-300 pt-0.5">
                      {e.type === 'caffeine_cutoff' ? e.startHbtStr : `${e.startHbtStr}–${e.endHbtStr}`}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm text-white">
                        {e.type === 'caffeine_cutoff' ? nextLine(e) : plainTitle(e)}
                        {active && <span className="ml-2 text-[10px] font-bold uppercase text-emerald-400">Now</span>}
                      </span>
                      <span className="block text-xs text-slate-400 line-clamp-1">{e.subtitle}</span>
                    </span>
                    <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-slate-600" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {restOfToday.length > GLANCE_ITEMS && (
          <button onClick={() => setShowAll(!showAll)} className="mt-2 px-1 text-xs font-semibold text-sky-300 hover:text-sky-200">
            {showAll ? 'Show less' : `Show all ${restOfToday.length}`}
          </button>
        )}
      </section>

      <button onClick={onOpenTimeline} className="px-1 text-xs text-slate-400 underline underline-offset-2 hover:text-slate-200">
        See other days, change flights and more on the Timeline
      </button>
    </div>
  );
};
