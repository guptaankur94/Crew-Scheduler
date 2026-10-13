import React, { useState } from 'react';
import { bunkChoiceForEvent, sectorKeyForEvent } from '../services/rosterKeys';
import {
  CircadianEvent,
  CircadianPlan,
  CrewPreferences,
} from '../types/circadian';
import {
  Plane,
  Moon,
  AlertTriangle,
  Plus,
  Minus,
  HelpCircle,
  Calendar,
  Clock,
  ArrowRight,
  Trash2,
  Bed,
} from 'lucide-react';
import { CancelFlightDialog } from './CancelFlightDialog';
import { DayNotes, MealsAndCaffeine } from './DayGuidance';
import { StandbyNotice } from './StandbyNotice';
import { CalloutForm } from './CalloutForm';
import { flightSource } from '../services/provenance';
import { dutyPositions } from '../services/dutyTimes';
import { HOTEL_TRANSFER_MINUTES } from '../services/planEngine';

import { rosterClock } from '../services/rosterKeys';
import { DateNavigator } from './DateNavigator';
import { FlightLeg } from '../types/circadian';
import {
  formatAviationDate,
} from '../utils/dateUtils';

export interface TimelineViewProps {
  plan: CircadianPlan;
  onSelectEvent: (event: CircadianEvent) => void;
  onNudgeEvent: (eventId: string, minutes: number) => void;
  onUpdatePreferences?: (updated: Partial<CrewPreferences>) => void;
  customNudges: Record<string, number>;
  onCancelSector?: (flightId: string) => void;
  /** Rostered flights the person marked as cancelled, so they can be reinstated. */
  cancelledFlights?: { flight: FlightLeg; sectorKey: string }[];
  onReinstateFlight?: (sectorKey: string) => void;
  onDeleteSector?: (flightId: string) => void;
  /** Called out on a day without a standby: the flight(s) are the person's update. */
  onCallout?: (flights: FlightLeg[]) => void;
  /** Edits for the rostered standby on this day (times, released early, callout, back to rostered). */
  renderStandbyEdit?: (dateStr: string, standbyEvents: CircadianEvent[]) => React.ReactNode;
  /** Set, change or remove the delay of this flight. */
  renderDelayEdit?: (flightId: string) => React.ReactNode;
  /** Opens Settings (getting-ready and travel times). */
  onOpenSettings?: () => void;
  initialDate?: string;
  /** Opens the Month screen on the month containing this date. */
  onOpenMonthSummary?: (dateStr: string) => void;
  /** What to do now, shown above the steps when today is selected; it can open another day. */
  renderToday?: (openDate: (dateStr: string) => void) => React.ReactNode;
}

export const TimelineView: React.FC<TimelineViewProps> = ({
  plan,
  onSelectEvent,
  onNudgeEvent,
  onUpdatePreferences,
  customNudges,
  onCancelSector,
  cancelledFlights = [],
  onReinstateFlight,
  onDeleteSector,
  onCallout,
  renderStandbyEdit,
  renderDelayEdit,
  onOpenSettings,
  initialDate,
  onOpenMonthSummary,
  renderToday,
}) => {
  const { events, dailySummaries, preferences } = plan;

  // Selected Week filter: 'all' | 'w1' | 'w2' | 'w3' | 'w4' | 'w5'

  // Flights that end a duty (they carry the sign-off)
  const dutyEnds = React.useMemo(() => new Set([...dutyPositions(plan.roster.flights)].filter(([, p]) => p.last).map(([id]) => id)), [plan.roster.flights]);

  // The flight whose delay editor is open, and the day whose callout form is open
  const [delayOpenFor, setDelayOpenFor] = useState<string | null>(null);
  const [calloutOpenFor, setCalloutOpenFor] = useState<string | null>(null);

  // The flight being cancelled (with its home-time departure)
  const [cancelling, setCancelling] = useState<{ flight: FlightLeg; departureHome: string } | null>(null);

  // Default to initialDate or day 1
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    if (initialDate) return initialDate;
    const todayHome = new Date(Date.now() + preferences.homeBaseTzOffset * 3600000).toISOString().slice(0, 10);
    return dailySummaries.some((d) => d.dateStr === todayHome) ? todayHome : dailySummaries[0]?.dateStr || '';
  });

  React.useEffect(() => {
    if (initialDate) {
      setSelectedDate(initialDate);
    }
  }, [initialDate]);

  const activeDaySummary = dailySummaries.find((d) => d.dateStr === selectedDate) || dailySummaries[0];

  const todayStr = new Date(Date.now() + preferences.homeBaseTzOffset * 3600000).toISOString().slice(0, 10);
  const todayInPlan = dailySummaries.some((d) => d.dateStr === todayStr);
  const selectedMonthName = selectedDate
    ? new Date(`${selectedDate}T12:00:00Z`).toLocaleDateString('en-GB', { month: 'long', timeZone: 'UTC' })
    : '';

  const openDate = (dateStr: string) => {
    setSelectedDate(dateStr);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const [copied, setCopied] = useState(false);
  const copyTimes = () => {
    const p = prepDetails;
    if (!p) return;
    const lines = [
      `✈️ Duty ${activeDaySummary?.dayLabel ?? selectedDate} (home time)`,
      `⏰ Wake up: ${p.wakeUpHbt}`,
      `🚖 ${p.pickupLabel || 'Leave home'}: ${p.cabPickupHbt}`,
      `🏢 Check-in: ${p.reportHbt}`,
      `🛫 Departs: ${p.departureHbt}`,
    ];
    navigator.clipboard?.writeText(lines.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const backToToday = () => {
    setSelectedDate(todayStr);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Helper to find matching FlightLeg from a flight CircadianEvent
  const getFlightLeg = (flightEvent: CircadianEvent): FlightLeg | undefined => {
    const cleanId = flightEvent.id.replace(/^flight-/, '');
    return plan.roster.flights.find((f) => f.id === cleanId || f.id === flightEvent.id);
  };


  // Filter events for the chosen day (using dutyDate link to ensure pre-duty sleep & prep are always paired)
  const dayEvents = events.filter((e) => {
    if (selectedDate === 'all') return true;
    return e.dutyDate === selectedDate || (!e.dutyDate && e.startUtc.startsWith(selectedDate));
  });

  // Separate into daily tracks
  const actualFlights = dayEvents.filter((e) => e.type === 'flight');
  const sleepEvents = dayEvents.filter((e) => e.type.includes('sleep') || e.type === 'nasa_nap');
  const nutritionEvents = dayEvents.filter((e) => e.type.includes('eating') || e.type.includes('fasting'));
  const caffeineEvents = dayEvents.filter((e) => e.type.includes('caffeine'));
  const alertEvents = dayEvents.filter((e) => e.type === 'wocl_risk' || e.type === 'melatonin_shield');
  const lightEvents = dayEvents.filter((e) => e.type === 'light_exposure');
  const goodToKnow = dayEvents.filter((e) => e.type === 'alcohol_cutoff' || e.type === 'exercise_cutoff').sort((a, b) => a.startUtc.localeCompare(b.startUtc));

  const isOffDay = activeDaySummary?.isOffDay;
  const prepDetails = activeDaySummary?.prepDetails;

  // Sleep cards: the same card wherever a sleep appears in the day
  const renderSleep = (event: CircadianEvent, wakeNote?: string) => {
                const nudge = customNudges[event.id] || 0;

                // Precision calendar date resolution for bedtime vs wake-up in Home Base Time
                const startDateObj = new Date(new Date(event.startUtc).getTime() + preferences.homeBaseTzOffset * 3600000);
                const endDateObj = new Date(new Date(event.endUtc).getTime() + preferences.homeBaseTzOffset * 3600000);
                const startDateAviation = formatAviationDate(startDateObj);
                const endDateAviation = formatAviationDate(endDateObj);
                const startWeekday = startDateObj.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
                const endWeekday = endDateObj.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
                const currentDutyAviation = formatAviationDate(selectedDate);
                const currentDutyWeekday = activeDaySummary ? activeDaySummary.dayLabel.split(',')[0]?.trim() : '';

                // Is bedtime on the prior calendar day before today's wake-up?
                const isPriorDayBedtime = startDateAviation !== currentDutyAviation;
                const crossesMidnight = startDateAviation !== endDateAviation;

                return (
                  <div
                    key={event.id}
                    className="rounded-xl border border-purple-900/30 bg-purple-950/15 p-3 text-xs space-y-2.5 shadow-sm"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="font-bold text-white flex items-center gap-1.5">
                            <span>{event.title}</span>
                          </p>
                          {isPriorDayBedtime ? (
                            <span className="inline-flex items-center gap-1 rounded bg-amber-500/20 border border-amber-500/40 px-1.5 py-0.5 text-[9px] font-mono font-bold text-amber-300">
                              🌙 Bed the evening before ({startWeekday}, {startDateAviation})
                            </span>
                          ) : crossesMidnight ? (
                            <span className="inline-flex items-center gap-1 rounded bg-purple-900/60 border border-purple-700/50 px-1.5 py-0.5 text-[9px] font-mono font-bold text-purple-300">
                              🌙 Past midnight
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded bg-blue-900/40 border border-blue-700/40 px-1.5 py-0.5 text-[9px] font-mono font-bold text-blue-300">
                              ☀️ Daytime sleep
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">{event.subtitle}</p>

                        {/* Explicit calendar breakdown subtext for total clarity */}
                        <div className="rounded-lg bg-slate-950/70 border border-purple-900/30 p-2 text-[10px] space-y-1 mt-1.5">
                          <div className="flex items-center justify-between text-slate-300 font-mono">
                            <span className="text-purple-300 font-bold flex items-center gap-1">
                              🛌 Bedtime:
                            </span>
                            <span className="text-white font-extrabold">
                              {startWeekday}, {startDateAviation} • {event.startHbtStr}{' '}
                              {isPriorDayBedtime && <span className="text-amber-400 font-sans font-bold">(evening before)</span>}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-slate-300 font-mono border-t border-slate-900 pt-1">
                            <span className="text-sky-300 font-bold flex items-center gap-1">
                              ⏰ Wake-up:
                            </span>
                            <span className="text-white font-extrabold">
                              {endWeekday}, {endDateAviation} • {event.endHbtStr}{' '}
                              <span className="text-sky-400 font-sans font-bold">({wakeNote ?? (endDateAviation !== currentDutyAviation ? 'evening before' : endWeekday === startWeekday ? 'Today' : actualFlights.length ? 'Duty morning' : 'This morning')})</span>
                            </span>
                          </div>
                          {isPriorDayBedtime && endDateAviation === currentDutyAviation && (
                            <p className="text-[10px] text-amber-300/90 pt-1 border-t border-slate-900 font-sans">
                              💡 <strong>Why the evening before:</strong> Sleep starts the evening before (<strong>{startWeekday}, {startDateAviation}</strong> at {event.startHbtStr}) so that your {Math.round(event.durationMinutes / 30) / 2}h sleep finishes in time for today's {currentDutyWeekday} ({currentDutyAviation}) wake-up at {event.endHbtStr}.
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="text-left sm:text-right shrink-0 pt-1 sm:pt-0 border-t sm:border-t-0 border-purple-900/20">
                        <span className="font-mono text-xs font-black text-purple-200 block">
                          {event.startHbtStr} – {event.endHbtStr}
                        </span>
                        <p className="text-[9px] text-slate-400 font-mono">
                          {Math.floor(event.durationMinutes / 60)}h {event.durationMinutes % 60}m
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between border-t border-purple-900/20 pt-2 text-[11px]">
                      <button
                        onClick={() => onSelectEvent(event)}
                        className="flex items-center gap-1 text-slate-400 hover:text-purple-300 transition-colors"
                      >
                        <HelpCircle className="h-3 w-3 text-purple-400" />
                        <span className="underline decoration-slate-700 underline-offset-2">
                          Why: {event.scientificCitation.organization}
                        </span>
                      </button>

                      {event.userAdjustable && (
                        <div className="flex items-center gap-1 rounded bg-slate-900 border border-slate-800 px-1 py-0.5">
                          <button
                            onClick={() => onNudgeEvent(event.id, nudge - 30)}
                            className="p-0.5 text-slate-400 hover:text-white"
                            title="Shift 30m earlier"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="px-1 font-mono text-[10px] text-indigo-300 font-bold">
                            {nudge !== 0 ? `${nudge > 0 ? '+' : ''}${nudge}m` : 'Nudge'}
                          </span>
                          <button
                            onClick={() => onNudgeEvent(event.id, nudge + 30)}
                            className="p-0.5 text-slate-400 hover:text-white"
                            title="Shift 30m later"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
  };

  // When the day's duty starts, which sleeps come before it, after it, and tonight
  const clock = rosterClock(plan.roster);
  const homeDateOf = (iso: string) => new Date(Date.parse(iso) + preferences.homeBaseTzOffset * 3600000).toISOString().slice(0, 10);
  const firstReportMs = actualFlights.length
    ? Math.min(...actualFlights.map((f) => Date.parse(getFlightLeg(f)?.reportTimeUtc ?? f.startUtc)))
    : undefined;
  const isCrewRest = (e: CircadianEvent) => e.id.startsWith('crew-rest-');
  const crewRestNaps = sleepEvents.filter(isCrewRest);
  // Before a duty: this day's sleeps that end by check-in, plus the previous evening's (e.g. the nap before a duty that checks in after midnight)
  const isSleepEvent = (e: CircadianEvent) => (e.type.includes('sleep') || e.type === 'nasa_nap') && !isCrewRest(e);
  const sleepsBefore =
    firstReportMs !== undefined
      ? events
          .filter((e) => isSleepEvent(e) && Date.parse(e.endUtc) <= firstReportMs && (sleepEvents.includes(e) || Date.parse(e.endUtc) >= firstReportMs - 14 * 3600000))
          .sort((a, b) => a.startUtc.localeCompare(b.startUtc))
      : sleepEvents.filter((e) => isSleepEvent(e) && e.type !== 'nasa_nap');
  const sleepsAfter = sleepEvents.filter((e) => !isCrewRest(e) && !sleepsBefore.includes(e));
  const tonight = events
    .filter((e) => (e.type.includes('sleep') || e.type === 'nasa_nap') && !!e.dutyDate && e.dutyDate > selectedDate && homeDateOf(e.startUtc) === selectedDate)
    .sort((a, b) => a.startUtc.localeCompare(b.startUtc));

  // Debrief and the journey home or to the hotel, once per duty that ends on this day
  const debriefs = actualFlights
    .map(getFlightLeg)
    .filter((l): l is FlightLeg => !!l && dutyEnds.has(l.id))
    .map((l) => {
      const away = l.destination !== plan.roster.homeBase;
      const travelMinutes = away ? HOTEL_TRANSFER_MINUTES : preferences.cabBufferMinutes || 60;
      const releaseMs = Date.parse(l.releaseTimeUtc);
      return { id: l.id, airport: l.destination, away, travelMinutes, landingMs: Date.parse(l.arrivalTimeUtc), releaseMs, arriveMs: releaseMs + travelMinutes * 60000, fromRoster: !!l.printed?.release };
    });

  // What tomorrow asks of tonight
  const tomorrowStr = new Date(Date.parse(`${selectedDate}T12:00:00Z`) + 86400000).toISOString().slice(0, 10);
  const tomorrow = dailySummaries.find((d) => d.dateStr === tomorrowStr);
  const tomorrowStandby = events.find((e) => e.dutyDate === tomorrowStr && e.type === 'standby');
  const tomorrowNote = selectedDate
    ? tomorrow?.prepDetails && !tomorrow.isOffDay
      ? `Tomorrow: wake ${tomorrow.prepDetails.wakeUpHbt}, check-in ${tomorrow.prepDetails.reportHbt}`
      : tomorrowStandby
      ? `Tomorrow: standby from ${tomorrowStandby.startHbtStr}`
      : tomorrow?.isOffDay
      ? `Tomorrow: ${tomorrow.noDuty ? 'no duty' : 'day off'}`
      : null
    : null;


  return (
    <div className="space-y-4">
      {/* Week strip to pick a day (the month overview lives on the Month screen) */}
      <DateNavigator days={dailySummaries} selectedDate={selectedDate} todayStr={todayStr} onSelect={setSelectedDate} allowMonthView={false} />
      {onOpenMonthSummary && selectedDate && (
        <div className="-mt-2 flex justify-end">
          <button
            onClick={() => onOpenMonthSummary(selectedDate)}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-slate-400 hover:text-white"
          >
            See {selectedMonthName} summary <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Today: what to do now */}
      {renderToday && selectedDate === todayStr && renderToday(openDate)}

      {/* Nudge back to today after looking at another day */}
      {todayInPlan && selectedDate !== todayStr && (
        <button
          onClick={backToToday}
          className="fixed bottom-20 left-1/2 z-30 -translate-x-1/2 inline-flex items-center gap-1.5 rounded-full border border-blue-400/40 bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-black/40 hover:bg-blue-500 lg:bottom-6 lg:left-auto lg:right-8 lg:translate-x-0"
        >
          <Calendar className="h-4 w-4" />
          Back to today
        </button>
      )}

      {/* Standby periods on the selected day */}
      {renderStandbyEdit ? (
        <div className="space-y-3 empty:hidden">{renderStandbyEdit(selectedDate, events.filter((e) => e.dutyDate === selectedDate && e.type === 'standby'))}</div>
      ) : (
        <StandbyNotice events={events.filter((e) => e.dutyDate === selectedDate)} onSelectEvent={onSelectEvent} roster={plan.roster} />
      )}

      {/* Flights the person marked as cancelled on this day: kept in the roster, left out of the plan */}
      {cancelledFlights
        .filter((c) => rosterClock(plan.roster).date(Date.parse(c.flight.departureTimeUtc)) === selectedDate)
        .map((c) => (
          <div key={c.sectorKey} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-3 text-xs">
            <span className="text-slate-300">
              <span className="font-mono text-slate-500 line-through">
                {c.flight.flightNumber} {c.flight.origin}→{c.flight.destination} {rosterClock(plan.roster).time(Date.parse(c.flight.departureTimeUtc))}
              </span>{' '}
              Cancelled (you) · left out of your plan
            </span>
            {onReinstateFlight && (
              <button onClick={() => onReinstateFlight(c.sectorKey)} className="rounded-lg border border-slate-700 px-2.5 py-1 font-semibold text-slate-200 hover:border-slate-500">
                Reinstate
              </button>
            )}
          </div>
        ))}

      {/* The selected day's outlook in words, when there is something to watch */}
      {activeDaySummary?.outlook && activeDaySummary.outlook.level !== 'steady' && (
        <div
          className={`rounded-2xl border p-4 text-xs ${
            activeDaySummary.outlook.level === 'harder' ? 'border-amber-800/60 bg-amber-950/20' : 'border-sky-900/60 bg-sky-950/20'
          }`}
        >
          <p className="font-bold text-white text-sm">{activeDaySummary.outlook.headline}</p>
          <p className="mt-1 text-slate-300">Because of {activeDaySummary.outlook.reasons.join(' and ')}.</p>
          <p className="mt-1 text-slate-300">{activeDaySummary.outlook.tip}</p>
        </div>
      )}

      {/* Station Layover Hub (Shown when day ends at an outstation) */}
      {activeDaySummary?.layoverStation && (
        <div className="rounded-2xl border border-indigo-900/50 bg-gradient-to-r from-indigo-950/40 via-slate-900 to-slate-950 p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-indigo-400" />
              <h4 className="font-bold text-sm text-indigo-200">
                🏨 Layover: {activeDaySummary.layoverStation.city} ({activeDaySummary.layoverStation.iata})
              </h4>
              <span className="rounded bg-indigo-950 px-2 py-0.5 text-[10px] font-mono text-indigo-300 border border-indigo-800/40">
                {activeDaySummary.layoverStation.timeZoneDiffStr}
              </span>
            </div>
            <p className="text-slate-300 text-[11px]">
              {activeDaySummary.layoverStation.diningTip}
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-1.5 text-center">
              <span className="text-[9px] uppercase font-bold text-slate-400 block">Hotel room</span>
              <span className="font-bold text-emerald-400 text-xs">{activeDaySummary.layoverStation.hotelBlackoutRating}</span>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-1.5 text-center">
              <span className="text-[9px] uppercase font-bold text-slate-400 block">Room temperature</span>
              <span className="font-bold text-sky-300 text-xs">About 18–20 °C</span>
            </div>
          </div>
        </div>
      )}

      {/* The day in order: sleep and wake-up, getting ready, flights, debrief and travel, after duty, meals and free time, tonight */}
      <ol className="space-y-3">
        {(() => {
          let n = 0;
          const step = (title: string, icon: React.ReactNode, children: React.ReactNode, meta?: React.ReactNode) => (
            <li className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4 space-y-3">
              <div className="flex items-center justify-between gap-2 border-b border-slate-800/60 pb-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-800 text-[11px] font-bold text-slate-300">{++n}</span>
                  <span className="text-slate-400">{icon}</span>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">{title}</h3>
                </div>
                {meta && <span className="text-[11px] font-mono text-slate-400">{meta}</span>}
              </div>
              {children}
            </li>
          );
          return (
            <>
              {step(
                firstReportMs !== undefined ? 'Sleep before duty and wake-up' : "Last night's sleep",
                <Moon className="h-3.5 w-3.5" />,
                <div className="space-y-2.5">
                  {!isOffDay && prepDetails && !prepDetails.targetBedtimeHbt && prepDetails.bedtimeExplanation && (
                    <p className="text-[11px] text-slate-300">{prepDetails.bedtimeExplanation}</p>
                  )}
                  {sleepsBefore.length === 0 ? <p className="py-2 text-xs text-slate-500">Your usual night sleep.</p> : sleepsBefore.map((e) => renderSleep(e))}
                </div>
              )}

              {!isOffDay && prepDetails && step(
                'Getting ready',
                <Clock className="h-3.5 w-3.5" />,
                <div className="text-xs">
                  <p className="flex flex-wrap gap-x-5 gap-y-1 font-mono text-sm font-bold text-white">
                    <span>
                      <span className="font-sans text-xs font-normal text-slate-400">Wake</span> {prepDetails.wakeUpHbt}
                    </span>
                    <span>
                      <span className="font-sans text-xs font-normal text-slate-400">{prepDetails.pickupLabel || 'Leave home'}</span> {prepDetails.cabPickupHbt}
                    </span>
                    <span>
                      <span className="font-sans text-xs font-normal text-slate-400">Check-in</span> {prepDetails.reportHbt}
                    </span>
                    {actualFlights.length > 0 && (
                      <span>
                        <span className="font-sans text-xs font-normal text-slate-400">Departs</span> {prepDetails.departureHbt}
                      </span>
                    )}
                  </p>
                  <p className="mt-1 flex flex-wrap items-center gap-x-3 text-[11px] text-slate-400">
                    <span>
                      {prepDetails.groomingMinutes} min to get ready · {prepDetails.cabBufferMinutes} min {prepDetails.isAwayFromBase ? 'hotel transport' : 'travel'} · home time
                    </span>
                    {onOpenSettings && (
                      <button onClick={onOpenSettings} className="font-semibold underline underline-offset-2 hover:text-white">
                        Change in Settings
                      </button>
                    )}
                    <button onClick={copyTimes} className="font-semibold text-sky-300 underline underline-offset-2 hover:text-white">
                      {copied ? 'Copied' : 'Copy times'}
                    </button>
                  </p>
                </div>
              )}

              {(activeDaySummary?.outsideRoster || isOffDay || actualFlights.length > 0) && step(
                isOffDay || activeDaySummary?.outsideRoster ? 'Today' : 'Flights',
                <Plane className="h-3.5 w-3.5" />,
                <>
          <div className="space-y-2.5">
              {activeDaySummary?.outsideRoster ? (
                // Not on any roster (e.g. before a roster starts, or after every roster was removed): no duty claims
                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-xs text-slate-300">
                  <p className="font-bold text-white">No roster for this day</p>
                  <p className="mt-1 leading-relaxed text-slate-400">Your usual home-time sleep, meals and caffeine are shown. Upload your roster to see duties for this day.</p>
                </div>
              ) : isOffDay ? (
                <div className="rounded-xl border border-emerald-900/40 bg-emerald-950/20 p-4 text-xs space-y-1.5">
                  <div className="flex items-center gap-2 font-bold text-emerald-300">
                    <span className="text-base">🏖️</span>
                    <span>{activeDaySummary?.noDuty ? 'No duty' : 'Day off'}</span>
                  </div>
                  <p className="text-slate-300 leading-relaxed text-[11px]">
                    {activeDaySummary?.noDuty
                      ? 'Nothing is listed on your roster for this day, so the plan treats it as a free day. If you are not sure, check with crew control.'
                      : 'No flights or duties today. A good day to catch up on any sleep you missed during your last duties.'}
                  </p>
                  <div className="rounded bg-slate-950/50 p-2 text-[10px] text-emerald-400 font-mono mt-2 border border-emerald-900/30">
                    Tip: keep to your usual home-time sleep and meals today, so your body clock stays steady.
                  </div>
  
                  {/* Standby Callout Button on Rest / Standby Day */}
                  {onCallout && (
                    <div className="pt-2 border-t border-emerald-900/40 mt-2 space-y-2">
                      {calloutOpenFor === selectedDate ? (
                        <CalloutForm
                          roster={plan.roster}
                          date={selectedDate}
                          base={plan.roster.homeBase}
                          onSave={(flights) => {
                            onCallout(flights);
                            setCalloutOpenFor(null);
                          }}
                          onCancel={() => setCalloutOpenFor(null)}
                        />
                      ) : (
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-slate-400">Called out today?</span>
                          <button
                            onClick={() => setCalloutOpenFor(selectedDate)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[11px] font-bold transition-all shadow-sm"
                          >
                            <Plus className="h-3 w-3" />
                            <span>Add a callout flight</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                actualFlights.map((flight, idx) => {
                  const sectorNum = idx + 1;
                  const totalSectors = actualFlights.length;
                  const isFirst = sectorNum === 1;
                  const isSecond = sectorNum === 2;
                  const isRedEye = flight.type === 'flight' && (flight.color === '#ef4444' || flight.subtitle.toLowerCase().includes('red-eye'));
  
                  // Color themes & styling per sector for high-impact visual distinction
                  const theme = isFirst
                    ? {
                        border: 'border-sky-700/70 border-l-4 border-l-sky-400 hover:border-sky-500',
                        bg: 'bg-gradient-to-r from-sky-950/40 via-slate-950 to-slate-950',
                        badge: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
                        badgeText: totalSectors === 1 ? 'Flight' : `Flight 1 of ${totalSectors}`,
                        timeColor: 'text-sky-300',
                        accentText: 'text-sky-400',
                      }
                    : isSecond
                    ? {
                        border: 'border-emerald-700/70 border-l-4 border-l-emerald-400 hover:border-emerald-500',
                        bg: 'bg-gradient-to-r from-emerald-950/40 via-slate-950 to-slate-950',
                        badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
                        badgeText: `Flight 2 of ${totalSectors}`,
                        timeColor: 'text-emerald-300',
                        accentText: 'text-emerald-400',
                      }
                    : {
                        border: 'border-amber-700/70 border-l-4 border-l-amber-400 hover:border-amber-500',
                        bg: 'bg-gradient-to-r from-amber-950/40 via-slate-950 to-slate-950',
                        badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
                        badgeText: `Flight ${sectorNum} of ${totalSectors}`,
                        timeColor: 'text-amber-300',
                        accentText: 'text-amber-400',
                      };
  
                  return (
                    <React.Fragment key={flight.id}>
                      {/* Distinct Sector Box */}
                      <div
                        className={`rounded-xl border ${theme.border} ${theme.bg} p-3.5 text-xs space-y-2.5 transition-all shadow-sm`}
                      >
                        {/* Top Header: Sector Badge, Flight Number & Duration */}
                        <div className="flex flex-wrap items-center justify-between gap-1.5">
                          <div className="flex items-center gap-2">
                            <span className={`rounded-md px-2 py-0.5 text-[10px] font-black uppercase tracking-wider border ${theme.badge}`}>
                              {theme.badgeText}
                            </span>
                            <span className="font-mono font-bold text-white text-xs bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                              {flight.title.split(':')[0] || 'Flight'}
                            </span>
                            {isRedEye && (
                              <span className="rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 px-1.5 py-0.5 text-[9px] font-bold">
                                🌙 Red-Eye
                              </span>
                            )}
                          </div>
  
                          <span className="font-mono text-[11px] text-slate-400 font-semibold">
                            {flight.subtitle.split('•')[1]?.trim() || `${Math.floor(flight.durationMinutes / 60)}h ${flight.durationMinutes % 60}m`}
                          </span>
                        </div>
  
                        {/* Route & Aircraft */}
                        <div className="flex items-center justify-between border-t border-slate-900 pt-2">
                          <div>
                            <p className="font-extrabold text-sm text-white flex items-center gap-1.5">
                              <span>{flight.title.split(':')[1]?.trim() || flight.title}</span>
                            </p>
                            <p className="text-[10px] text-slate-400 mt-0.5">{flight.subtitle.split('•')[0]?.trim()}</p>
                          </div>
  
                          {/* Timetable: Home Time vs Local */}
                          <div className="text-right font-mono">
                            <p className={`text-xs font-black ${theme.timeColor}`}>
                              {flight.startHbtStr} – {flight.endHbtStr} <span className="text-[9px] font-normal text-slate-500">home</span>
                            </p>
                            <p className="text-[10px] text-slate-400">
                              Local: {flight.startLocalStr} – {flight.endLocalStr}
                            </p>
                          </div>
                        </div>
                        {/* Why the app believes this flight exists */}
                        {(() => {
                          const leg = getFlightLeg(flight);
                          const source = leg && flightSource(leg);
                          return source ? <p className="text-[10px] text-slate-500">Source: {source}</p> : null;
                        })()}
                        {/* Long-Haul In-Flight Bunk Shift Rest Selector (>= 5h sectors) */}
                        {flight.durationMinutes >= 300 && onUpdatePreferences && (
                          <div className="mt-2 pt-2 border-t border-slate-900 flex flex-wrap items-center justify-between gap-2">
                            <span className="text-[11px] font-bold text-indigo-300 flex items-center gap-1.5">
                              <Bed className="h-3.5 w-3.5 text-indigo-400" /> Crew rest:
                            </span>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => {
                                  onUpdatePreferences({
                                    bunkShiftAssignments: {
                                      ...(preferences.bunkShiftAssignments || {}),
                                      [sectorKeyForEvent(flight.id, plan.roster) ?? flight.id]: 'shift1',
                                    },
                                  });
                                }}
                                className={`rounded px-2.5 py-1 text-[10px] font-bold transition-all ${
                                  (bunkChoiceForEvent(preferences, flight.id, plan.roster) || 'shift1') === 'shift1'
                                    ? 'bg-indigo-600 text-white shadow-sm ring-1 ring-indigo-400'
                                    : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
                                }`}
                              >
                                First rest period
                              </button>
                              <button
                                onClick={() => {
                                  onUpdatePreferences({
                                    bunkShiftAssignments: {
                                      ...(preferences.bunkShiftAssignments || {}),
                                      [sectorKeyForEvent(flight.id, plan.roster) ?? flight.id]: 'shift2',
                                    },
                                  });
                                }}
                                className={`rounded px-2.5 py-1 text-[10px] font-bold transition-all ${
                                  bunkChoiceForEvent(preferences, flight.id, plan.roster) === 'shift2'
                                    ? 'bg-indigo-600 text-white shadow-sm ring-1 ring-indigo-400'
                                    : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
                                }`}
                              >
                                Second rest period
                              </button>
                            </div>
                          </div>
                        )}
  
  
                        {/* Tactical Flight Modification Bar (Real-Time UI Adjustments) */}
                        <div className="mt-2.5 pt-2 border-t border-slate-900/90 flex flex-wrap items-center justify-between gap-1.5 text-[11px]">
                          <span className="text-[10px] text-slate-500 font-medium">Change this flight:</span>
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => {
                                const leg = getFlightLeg(flight);
                                if (leg) setDelayOpenFor(delayOpenFor === leg.id ? null : leg.id);
                              }}
                              className="px-2 py-0.5 rounded-md bg-slate-900 hover:bg-slate-800 text-sky-300 border border-slate-800 hover:border-sky-500/40 text-[10px] font-semibold transition-colors flex items-center gap-1"
                              title="Set, change or remove a delay for this flight"
                            >
                              <Clock className="h-2.5 w-2.5" />
                              <span>Delay</span>
                            </button>
                            <button
                              onClick={() => {
                                const leg = getFlightLeg(flight);
                                if (leg) setCancelling({ flight: leg, departureHome: flight.startHbtStr });
                              }}
                              className="px-2 py-0.5 rounded-md bg-slate-900 hover:bg-rose-950/60 text-rose-300 border border-slate-800 hover:border-rose-500/40 text-[10px] font-semibold transition-colors flex items-center gap-1"
                              title="Mark this flight as cancelled"
                            >
                              <AlertTriangle className="h-2.5 w-2.5 text-rose-400" />
                              <span>Cancel / Layover</span>
                            </button>
                            {onDeleteSector && (
                              <button
                                onClick={() => {
                                  const leg = getFlightLeg(flight);
                                  if (leg) onDeleteSector(leg.id);
                                }}
                                className="p-1 rounded-md bg-slate-900 hover:bg-rose-900/50 text-slate-500 hover:text-rose-300 transition-colors"
                                title="Delete sector"
                              >
                                <Trash2 className="h-2.5 w-2.5" />
                              </button>
                            )}
                          </div>
                        </div>
  
                        {/* Set, change or remove this flight's delay */}
                        {renderDelayEdit && delayOpenFor && getFlightLeg(flight)?.id === delayOpenFor && <div className="mt-2">{renderDelayEdit(delayOpenFor)}</div>}
  
                      </div>
  
                      {/* Turnaround between flights */}
                      {idx < actualFlights.length - 1 && (
                        <div className="my-1.5 flex items-center justify-between rounded-xl border border-dashed border-amber-800/60 bg-amber-950/20 px-3.5 py-2 text-xs">
                          <div className="flex items-center gap-2">
                            <Clock className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                            <div>
                              <span className="font-bold text-amber-300 text-[11px]">
                                Turnaround in {actualFlights[idx].subtitle.split('to')[1]?.split('•')[0]?.trim() || 'the next airport'}
                              </span>
                              <p className="text-[10px] text-slate-400">Still on duty between flight {idx + 1} and flight {idx + 2}</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </div>
  
                  {crewRestNaps.map((e) => renderSleep(e))}
                </>,
                activeDaySummary?.outsideRoster ? 'No roster' : isOffDay ? (activeDaySummary?.noDuty ? 'No duty' : 'Day off') : `${actualFlights.length} ${actualFlights.length === 1 ? 'flight' : 'flights'}`
              )}

              {debriefs.length > 0 && step(
                'Debrief and travel',
                <ArrowRight className="h-3.5 w-3.5" />,
                <div className="space-y-2 text-xs">
                  {debriefs.map((d) => (
                    <div key={d.id} className="space-y-1">
                      <p className="flex flex-wrap gap-x-5 gap-y-1 font-mono text-sm font-bold text-white">
                        <span>
                          <span className="font-sans text-xs font-normal text-slate-400">Landing</span> {clock.time(d.landingMs)}
                        </span>
                        <span>
                          <span className="font-sans text-xs font-normal text-slate-400">Sign-off</span> {clock.time(d.releaseMs)}
                        </span>
                        <span>
                          <span className="font-sans text-xs font-normal text-slate-400">{d.away ? 'At the hotel' : 'Home'}</span> about {clock.time(d.arriveMs)}
                        </span>
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {d.fromRoster ? 'Debrief from your roster' : 'Debrief estimated: landing + 30 min (not printed on your roster)'} · {d.travelMinutes} min{' '}
                        {d.away ? `to the hotel in ${d.airport}` : 'to get home'} · home time
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {sleepsAfter.length > 0 && step(
                firstReportMs !== undefined ? 'After duty: rest' : 'Rest during the day',
                <Bed className="h-3.5 w-3.5" />,
                <div className="space-y-2.5">{sleepsAfter.map((e) => renderSleep(e, 'Today'))}</div>
              )}

              {step(
                'Meals, caffeine and free time',
                <Calendar className="h-3.5 w-3.5" />,
                <div className="space-y-3">
                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                    <MealsAndCaffeine nutritionEvents={nutritionEvents} caffeineEvents={caffeineEvents} prepDetails={prepDetails} isOffDay={isOffDay} selectedDate={selectedDate} onSelectEvent={onSelectEvent} />
                  </div>
                  <DayNotes goodToKnow={goodToKnow} lightEvents={lightEvents} alertEvents={alertEvents} onSelectEvent={onSelectEvent} />
                </div>
              )}

              {(tonight.length > 0 || tomorrowNote) && step(
                'Tonight',
                <Moon className="h-3.5 w-3.5" />,
                <div className="space-y-2.5">
                  {tomorrowNote && <p className="text-xs font-semibold text-slate-200">{tomorrowNote}</p>}
                  {tonight.map((e) => renderSleep(e, 'Tomorrow'))}
                </div>
              )}
            </>
          );
        })()}
      </ol>

      {/* Cancel a flight (the person's update) */}
      {cancelling && (
        <CancelFlightDialog
          flight={cancelling.flight}
          departureHome={cancelling.departureHome}
          homeBase={plan.roster.homeBase}
          onConfirm={(flightId) => {
            onCancelSector?.(flightId);
            setCancelling(null);
          }}
          onClose={() => setCancelling(null)}
        />
      )}
    </div>
  );
};
