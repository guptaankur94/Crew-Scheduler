import React, { useState } from 'react';
import {
  CircadianEvent,
  CircadianPlan,
  CrewPreferences,
  CrewRank,
  SalaryCurrency,
} from '../types/circadian';
import {
  Plane,
  Moon,
  Utensils,
  Coffee,
  XCircle,
  AlertTriangle,
  Plus,
  Minus,
  HelpCircle,
  Calendar,
  Layers,
  Sparkles,
  Sun,
  Shield,
  Clock,
  Car,
  Bell,
  ChevronUp,
  Briefcase,
  Luggage,
  Copy,
  Check,
  ArrowRight,
  Info,
  Trash2,
  Hotel,
  GitMerge,
  FileText,
  DollarSign,
  Bed,
} from 'lucide-react';
import { TacticalDutyModal, TacticalModalType } from './TacticalDutyModal';
import { SalarySection } from './SalarySection';
import { StandbyNotice } from './StandbyNotice';
import { DateNavigator } from './DateNavigator';
import { FlightLeg } from '../types/circadian';
import {
  formatAviationDate,
  calculateDebriefEndTime,
  getPriorDayDateStr,
} from '../utils/dateUtils';

interface TimelineViewProps {
  plan: CircadianPlan;
  onSelectEvent: (event: CircadianEvent) => void;
  onNudgeEvent: (eventId: string, minutes: number) => void;
  onUpdatePreferences?: (updated: Partial<CrewPreferences>) => void;
  customNudges: Record<string, number>;
  onCancelSector?: (flightId: string, convertToLayover: boolean) => void;
  onDelaySector?: (flightId: string, delayMinutes: number) => void;
  onDeleteSector?: (flightId: string) => void;
  onAddStandbyFlight?: (flight: FlightLeg) => void;
  onSwitchToMasterSheet?: () => void;
  initialDate?: string;
}

export const TimelineView: React.FC<TimelineViewProps> = ({
  plan,
  onSelectEvent,
  onNudgeEvent,
  onUpdatePreferences,
  customNudges,
  onCancelSector,
  onDelaySector,
  onDeleteSector,
  onAddStandbyFlight,
  onSwitchToMasterSheet,
  initialDate,
}) => {
  const { events, dailySummaries, preferences, monthlyStats } = plan;

  // Selected Week filter: 'all' | 'w1' | 'w2' | 'w3' | 'w4' | 'w5'
  const [copiedTimers, setCopiedTimers] = useState<boolean>(false);

  // Debrief duration state per flight (default 30 mins)
  const [debriefMinutesByFlight, setDebriefMinutesByFlight] = useState<Record<string, number>>({});

  const [showSalaryStudio, setShowSalaryStudio] = useState<boolean>(false);
  const [tacticalModal, setTacticalModal] = useState<{
    isOpen: boolean;
    type: TacticalModalType;
    flight?: FlightLeg;
  } | null>(null);

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

  // Helper to find matching FlightLeg from a flight CircadianEvent
  const getFlightLeg = (flightEvent: CircadianEvent): FlightLeg | undefined => {
    const cleanId = flightEvent.id.replace(/^flight-/, '');
    return plan.roster.flights.find((f) => f.id === cleanId || f.id === flightEvent.id);
  };

  const handleOpenTactical = (type: TacticalModalType, flightEvent?: CircadianEvent) => {
    const leg = flightEvent ? getFlightLeg(flightEvent) : undefined;
    setTacticalModal({ isOpen: true, type, flight: leg });
  };

  // Filter events for the chosen day (using dutyDate link to ensure pre-duty sleep & prep are always paired)
  const dayEvents = events.filter((e) => {
    if (selectedDate === 'all') return true;
    return e.dutyDate === selectedDate || (!e.dutyDate && e.startUtc.startsWith(selectedDate));
  });

  // Separate into daily tracks
  const flightEvents = dayEvents.filter((e) => e.type === 'flight' || e.type === 'duty_ground');
  const actualFlights = dayEvents.filter((e) => e.type === 'flight');
  const prepEvents = dayEvents.filter((e) => e.type === 'pre_flight_prep');
  const sleepEvents = dayEvents.filter((e) => e.type.includes('sleep') || e.type === 'nasa_nap');
  const nutritionEvents = dayEvents.filter((e) => e.type.includes('eating') || e.type.includes('fasting'));
  const caffeineEvents = dayEvents.filter((e) => e.type.includes('caffeine'));
  const alertEvents = dayEvents.filter((e) => e.type === 'wocl_risk' || e.type === 'melatonin_shield');
  const lightEvents = dayEvents.filter((e) => e.type === 'light_exposure');

  const isOffDay = activeDaySummary?.isOffDay;
  const prepDetails = activeDaySummary?.prepDetails;

  const handleCopyPrepTimers = () => {
    if (!prepDetails) return;
    const text = `✈️ Pre-Flight Routine (${activeDaySummary.dayLabel}):\n⏰ Wake-Up Alarm: ${prepDetails.wakeUpHbt}\n🚖 ${prepDetails.pickupLabel || 'Leave home'}: ${prepDetails.cabPickupHbt}\n🏢 Base Check-In: ${prepDetails.reportHbt}\n🛫 Flight Departure: ${prepDetails.departureHbt}\n🛌 Bedtime the night before: ${prepDetails.targetBedtimeHbt || '--:--'}`;
    navigator.clipboard.writeText(text);
    setCopiedTimers(true);
    setTimeout(() => setCopiedTimers(false), 2500);
  };

  return (
    <div className="space-y-4">
      {/* Layer 1: Month at a glance (plain counts taken from the roster) */}
      {monthlyStats && (
        <div className="rounded-2xl border border-slate-800 bg-gradient-to-r from-slate-900/95 via-slate-900/80 to-slate-950 p-4 sm:p-5 shadow-sm space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
              This roster at a glance
            </span>
            {onSwitchToMasterSheet && (
              <button
                onClick={onSwitchToMasterSheet}
                className="flex items-center gap-2 rounded-xl border border-blue-800/60 bg-blue-950/40 hover:bg-blue-900/50 hover:border-blue-700 px-3.5 py-2 text-xs font-bold text-blue-300 transition-all shadow-sm self-start"
              >
                <FileText className="h-4 w-4 text-blue-400" />
                <span>Full roster sheet</span>
              </button>
            )}

      {showSalaryStudio && onUpdatePreferences && (
        <SalarySection plan={plan} onUpdatePreferences={onUpdatePreferences} onClose={() => setShowSalaryStudio(false)} />
      )}
            {onUpdatePreferences && (
              <button
                onClick={() => setShowSalaryStudio(!showSalaryStudio)}
                className="flex items-center gap-2 rounded-xl border border-emerald-800/60 bg-emerald-950/40 hover:bg-emerald-900/50 px-3.5 py-2 text-xs font-bold text-emerald-300 transition-all shadow-sm self-start"
              >
                <DollarSign className="h-4 w-4 text-emerald-400" />
                <span>
                  {showSalaryStudio
                    ? 'Close salary estimate'
                    : `Salary estimate (~${plan.salaryBreakdown.currencySymbol}${plan.salaryBreakdown.totalEarnings.toLocaleString()})`}
                </span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-left font-mono">
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
              <span className="text-[9px] uppercase tracking-wider text-slate-400 font-sans font-bold">Flying hours</span>
              <p className="text-base font-extrabold text-white mt-1">{monthlyStats.totalFlightHours}h</p>
              <p className="text-[9px] text-slate-400 font-sans mt-1">Departure to arrival</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
              <span className="text-[9px] uppercase tracking-wider text-slate-400 font-sans font-bold">Flights</span>
              <p className="text-base font-extrabold text-white mt-1">{monthlyStats.totalSectors}</p>
              <p className="text-[9px] text-slate-400 font-sans mt-1">Sectors on this roster</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
              <span className="text-[9px] uppercase tracking-wider text-slate-400 font-sans font-bold">Days without flights</span>
              <p className="text-base font-extrabold text-white mt-1">{monthlyStats.offDays}</p>
              <p className="text-[9px] text-slate-400 font-sans mt-1">Includes days off and standby</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
              <span className="text-[9px] uppercase tracking-wider text-slate-400 font-sans font-bold">Night flights</span>
              <p className="text-base font-extrabold text-white mt-1">{monthlyStats.woclNightFlights}</p>
              <p className="text-[9px] text-slate-400 font-sans mt-1">Flights through your body-clock night</p>
            </div>
          </div>
        </div>
      )}

      {/* Layer 2: Calendar-style day navigator (week strip or month grid) */}
      <DateNavigator
        days={dailySummaries}
        selectedDate={selectedDate}
        todayStr={new Date(Date.now() + preferences.homeBaseTzOffset * 3600000).toISOString().slice(0, 10)}
        onSelect={setSelectedDate}
      />

      {/* Standby periods on the selected day */}
      <StandbyNotice events={events.filter((e) => e.dutyDate === selectedDate)} onSelectEvent={onSelectEvent} />

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

      {/* Layer 4: Pre-Flight Morning Routine Runway (Wake-Up Alarm ➔ Cab Pickup ➔ Base Reporting ➔ Wheels Up) */}
      {!isOffDay && prepDetails && (
        <div className="rounded-2xl border border-sky-900/50 bg-gradient-to-r from-sky-950/40 via-slate-900/90 to-slate-950 p-4 sm:p-5 shadow-md space-y-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-sky-900/30 pb-3 gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-500/10 text-sky-400 ring-1 ring-sky-500/20">
                  <Clock className="h-4 w-4" />
                </div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-sky-300">
                  Pre-Flight Departure Runway (Wake-Up ➔ Cab Pickup ➔ Reporting)
                </h4>
              </div>
              <p className="text-[11px] text-slate-300">
                Reporting at <strong className="text-white font-mono">{prepDetails.reportHbt}</strong>. With your <strong className="text-amber-300 font-mono">{preferences.cabBufferMinutes}m cab transit</strong> and <strong className="text-sky-300 font-mono">{preferences.groomingMinutes}m grooming</strong>, your cab pickup is at <strong className="text-amber-300 font-mono">{prepDetails.cabPickupHbt}</strong> and alarm is at <strong className="text-sky-300 font-mono">{prepDetails.wakeUpHbt}</strong>.
              </p>
            </div>

            {/* Quick Duration Controls and Copy Button */}
            <div className="flex flex-wrap items-center gap-2">
              {onUpdatePreferences && (
                <div className="flex items-center gap-2 text-xs">
                  {/* Grooming */}
                  <div className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-1">
                    <span className="text-[10px] text-slate-400 font-semibold">Grooming:</span>
                    <button
                      onClick={() => onUpdatePreferences({ groomingMinutes: Math.max(30, preferences.groomingMinutes - 15) })}
                      className="text-slate-400 hover:text-white px-1 bg-slate-900 rounded"
                      title="15m less grooming"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="font-mono font-bold text-sky-300 text-xs">{preferences.groomingMinutes}m</span>
                    <button
                      onClick={() => onUpdatePreferences({ groomingMinutes: Math.min(120, preferences.groomingMinutes + 15) })}
                      className="text-slate-400 hover:text-white px-1 bg-slate-900 rounded"
                      title="15m more grooming"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>

                  {/* Cab Buffer */}
                  <div className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-1">
                    <span className="text-[10px] text-slate-400 font-semibold">Cab Transit:</span>
                    <button
                      onClick={() => onUpdatePreferences({ cabBufferMinutes: Math.max(30, preferences.cabBufferMinutes - 15) })}
                      className="text-slate-400 hover:text-white px-1 bg-slate-900 rounded"
                      title="15m less cab transit"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="font-mono font-bold text-amber-300 text-xs">{preferences.cabBufferMinutes}m</span>
                    <button
                      onClick={() => onUpdatePreferences({ cabBufferMinutes: Math.min(120, preferences.cabBufferMinutes + 15) })}
                      className="text-slate-400 hover:text-white px-1 bg-slate-900 rounded"
                      title="15m more cab transit"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              )}

              {/* Copy Timers Button */}
              <button
                onClick={handleCopyPrepTimers}
                className="flex items-center gap-1.5 rounded-lg border border-sky-800/60 bg-sky-950/60 hover:bg-sky-900/60 px-3 py-1.5 text-xs font-semibold text-sky-200 transition-colors shadow-sm"
              >
                {copiedTimers ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5 text-sky-300" />}
                <span>{copiedTimers ? 'Copied to Clipboard!' : 'Copy Alarm Times'}</span>
              </button>
            </div>
          </div>

          {/* Step-by-Step Runway Visual with Flow Connectors */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 relative">
            {/* Step 1: Wake-Up or Prep Alarm */}
            <div className="flex flex-col justify-between rounded-xl border border-sky-800/60 bg-slate-950 p-3.5 relative shadow-sm">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1 text-[11px] font-bold text-sky-400 uppercase">
                  <Bell className="h-3.5 w-3.5 text-sky-400" /> {prepDetails.step1Label || 'Step 1: Prep Alarm'}
                </span>
                <span className="text-[10px] font-mono text-sky-300 bg-sky-950/60 px-1.5 py-0.5 rounded border border-sky-800/50">
                  {preferences.groomingMinutes}m prep
                </span>
              </div>
              <div className="my-2.5">
                <p className="text-2xl font-black font-mono text-white">
                  {prepDetails.wakeUpHbt} <span className="text-xs font-normal text-slate-400">HBT</span>
                </p>
                <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                  {prepDetails.step1Description || 'Shower, uniform inspection, flight bag check & briefing review'}
                </p>
              </div>
              <div className="pt-2 border-t border-slate-900 text-[10px] text-sky-400/80 font-medium flex items-center justify-between">
                <span>Alarm Ready</span>
                <ArrowRight className="h-3.5 w-3.5 hidden lg:inline text-slate-600" />
              </div>
            </div>

            {/* Step 2: Cab Pickup */}
            <div className="flex flex-col justify-between rounded-xl border border-amber-800/60 bg-slate-950 p-3.5 relative shadow-sm">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1 text-[11px] font-bold text-amber-400 uppercase">
                  <Car className="h-3.5 w-3.5 text-amber-400" /> Step 2: {prepDetails.pickupLabel || 'Leave home'}
                </span>
                <span className="text-[10px] font-mono text-amber-300 bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-800/50">
                  {prepDetails.cabBufferMinutes}m travel
                </span>
              </div>
              <div className="my-2.5">
                <p className="text-2xl font-black font-mono text-amber-300">
                  {prepDetails.cabPickupHbt} <span className="text-xs font-normal text-slate-400">HBT</span>
                </p>
                <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                  {prepDetails.isAwayFromBase ? 'Hotel transport to the airport' : 'Travel from home to the airport'}
                </p>
              </div>
              <div className="pt-2 border-t border-slate-900 text-[10px] text-amber-400/80 font-medium flex items-center justify-between">
                <span>Transit Buffer</span>
                <ArrowRight className="h-3.5 w-3.5 hidden lg:inline text-slate-600" />
              </div>
            </div>

            {/* Step 3: Base Reporting / Briefing */}
            <div className="flex flex-col justify-between rounded-xl border border-blue-800/60 bg-slate-950 p-3.5 relative shadow-sm">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1 text-[11px] font-bold text-blue-400 uppercase">
                  <Briefcase className="h-3.5 w-3.5 text-blue-400" /> Step 3: Base Reporting
                </span>
                <span className="text-[10px] font-mono text-blue-300 bg-blue-950/60 px-1.5 py-0.5 rounded border border-blue-800/50">
                  60m to STD
                </span>
              </div>
              <div className="my-2.5">
                <p className="text-2xl font-black font-mono text-blue-300">
                  {prepDetails.reportHbt} <span className="text-xs font-normal text-slate-400">HBT</span>
                </p>
                <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                  Security gate, breathalyzer BA test, documents & safety crew briefing
                </p>
              </div>
              <div className="pt-2 border-t border-slate-900 text-[10px] text-blue-400/80 font-medium flex items-center justify-between">
                <span>Duty Check-In</span>
                <ArrowRight className="h-3.5 w-3.5 hidden lg:inline text-slate-600" />
              </div>
            </div>

            {/* Step 4: Scheduled Departure */}
            <div className="flex flex-col justify-between rounded-xl border border-slate-700 bg-slate-950 p-3.5 relative shadow-sm">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1 text-[11px] font-bold text-slate-300 uppercase">
                  <Plane className="h-3.5 w-3.5 text-blue-400" /> Step 4: Wheels Up
                </span>
                <span className="text-[10px] font-mono text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                  Take-off
                </span>
              </div>
              <div className="my-2.5">
                <p className="text-2xl font-black font-mono text-white">
                  {prepDetails.departureHbt} <span className="text-xs font-normal text-slate-400">HBT</span>
                </p>
                <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                  Passenger boarding completed, door arming & scheduled pushback
                </p>
              </div>
              <div className="pt-2 border-t border-slate-900 text-[10px] text-slate-400 font-medium">
                Flight En Route
              </div>
            </div>
          </div>

          {/* Reverse Bedtime & Caffeine Guidance Bar */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            {prepDetails.targetBedtimeHbt ? (
              (() => {
                const priorDateStr = getPriorDayDateStr(activeDaySummary?.dateStr || '');
                const priorDateAviation = formatAviationDate(priorDateStr);
                const priorWeekday = new Date(`${priorDateStr}T12:00:00Z`).toLocaleDateString('en-US', {
                  weekday: 'short',
                  timeZone: 'UTC',
                });
                const dutyAviation = formatAviationDate(activeDaySummary?.dateStr || '');
                const dutyWeekday = activeDaySummary ? activeDaySummary.dayLabel.split(',')[0]?.trim() : '';

                return (
                  <div className="rounded-xl border border-purple-800/60 bg-purple-950/30 p-3 flex items-start gap-2.5 text-xs shadow-sm">
                    <Moon className="h-4 w-4 text-purple-400 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <strong className="text-purple-300 font-bold">Prior-Day Sleep Bedtime:</strong>
                        <span className="rounded bg-purple-900/60 border border-purple-700/50 px-1.5 py-0.2 text-[9px] font-mono font-bold text-purple-200">
                          {priorWeekday}, {priorDateAviation} • {prepDetails.targetBedtimeHbt} HBT
                        </span>
                      </div>
                      <p className="text-slate-300 text-[11px] leading-snug">
                        To wake up refreshed at <strong className="text-white font-mono">{prepDetails.wakeUpHbt} HBT</strong> for duty on <span className="text-sky-300 font-bold">{dutyAviation} ({dutyWeekday})</span>, lights out by <strong className="text-purple-200 font-mono bg-purple-950 px-1.5 py-0.5 rounded border border-purple-800/60">{prepDetails.targetBedtimeHbt} HBT</strong> the evening before (<span className="text-amber-300 font-semibold">{priorDateAviation}</span>) for your {preferences.targetSleepHours}h target.
                      </p>
                    </div>
                  </div>
                );
              })()
            ) : prepDetails.bedtimeExplanation ? (
              <div className="rounded-xl border border-purple-900/30 bg-purple-950/15 p-3 flex items-center gap-2.5 text-xs">
                <Moon className="h-4 w-4 text-purple-400 shrink-0" />
                <div>
                  <strong className="text-purple-300 font-semibold">Circadian Sleep Schedule: </strong>
                  <span className="text-slate-300">{prepDetails.bedtimeExplanation}</span>
                </div>
              </div>
            ) : null}

            {prepDetails.caffeineCutoffHbt && (
              <div className="rounded-xl border border-amber-900/30 bg-amber-950/15 p-3 flex items-center gap-2.5 text-xs">
                <Coffee className="h-4 w-4 text-amber-400 shrink-0" />
                <div>
                  <strong className="text-amber-300 font-semibold">Prior Day Caffeine Cutoff: </strong>
                  <span className="text-slate-300">
                    Cease all coffee, chai, and energy drinks by <strong className="text-white font-mono">{prepDetails.caffeineCutoffHbt}</strong> to clear adenosine receptors for deep sleep.
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Station Layover Hub (Shown when day ends at an outstation) */}
      {activeDaySummary?.layoverStation && (
        <div className="rounded-2xl border border-indigo-900/50 bg-gradient-to-r from-indigo-950/40 via-slate-900 to-slate-950 p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-indigo-400" />
              <h4 className="font-bold text-sm text-indigo-200">
                🏨 Station Layover Hub: {activeDaySummary.layoverStation.city} ({activeDaySummary.layoverStation.iata})
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
              <span className="text-[9px] uppercase font-bold text-slate-400 block">Hotel Blackout</span>
              <span className="font-bold text-emerald-400 text-xs">{activeDaySummary.layoverStation.hotelBlackoutRating}</span>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-1.5 text-center">
              <span className="text-[9px] uppercase font-bold text-slate-400 block">Room Climate</span>
              <span className="font-bold text-sky-300 text-xs">About 18–20 °C</span>
            </div>
          </div>
        </div>
      )}

      {/* Layer 5: The 4 Clean Biological Pillars for Selected Day */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Pillar 1: Flight Duties & Sectors (or Rest Day Card) */}
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800/60 pb-2">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400">
                <Plane className="h-3.5 w-3.5" />
              </div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                1. Flight Duty & Sectors
              </h3>
            </div>
            <span className="text-[11px] font-mono text-slate-400">
              {isOffDay ? 'Rest Day' : `${flightEvents.filter((e) => e.type === 'flight').length} Sector(s)`}
            </span>
          </div>

          <div className="space-y-2.5">
            {isOffDay ? (
              <div className="rounded-xl border border-emerald-900/40 bg-emerald-950/20 p-4 text-xs space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-emerald-300">
                  <span className="text-base">🏖️</span>
                  <span>Designated Rest & Sleep Banking Day (WKOFF)</span>
                </div>
                <p className="text-slate-300 leading-relaxed text-[11px]">
                  No flights or airport duties scheduled. Essential for restoring neurobehavioral vigilance and repaying sleep debt accumulated from previous flight rotations.
                </p>
                <div className="rounded bg-slate-950/50 p-2 text-[10px] text-emerald-400 font-mono mt-2 border border-emerald-900/30">
                  Clinical Rule: Keep home base sleep and meal schedule consistent today to prevent circadian drift.
                </div>

                {/* Standby Callout Button on Rest / Standby Day */}
                <div className="pt-2 flex items-center justify-between border-t border-emerald-900/40 mt-2">
                  <span className="text-[10px] text-slate-400">Got called out on standby or rest?</span>
                  <button
                    onClick={() => handleOpenTactical('standby_callout')}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[11px] font-bold transition-all shadow-sm"
                  >
                    <Plus className="h-3 w-3" />
                    <span>+ Standby Callout: Add Flight</span>
                  </button>
                </div>
              </div>
            ) : actualFlights.length === 0 ? (
              <p className="py-4 text-center text-xs text-slate-500">No flight sectors scheduled today.</p>
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
                      badgeText: `1ST SECTOR • OUTBOUND (${totalSectors === 1 ? 'Single Leg' : `Leg 1 of ${totalSectors}`})`,
                      timeColor: 'text-sky-300',
                      accentText: 'text-sky-400',
                    }
                  : isSecond
                  ? {
                      border: 'border-emerald-700/70 border-l-4 border-l-emerald-400 hover:border-emerald-500',
                      bg: 'bg-gradient-to-r from-emerald-950/40 via-slate-950 to-slate-950',
                      badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
                      badgeText: `2ND SECTOR • RETURN (Leg 2 of ${totalSectors})`,
                      timeColor: 'text-emerald-300',
                      accentText: 'text-emerald-400',
                    }
                  : {
                      border: 'border-amber-700/70 border-l-4 border-l-amber-400 hover:border-amber-500',
                      bg: 'bg-gradient-to-r from-amber-950/40 via-slate-950 to-slate-950',
                      badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
                      badgeText: `${sectorNum}RD SECTOR (Leg ${sectorNum} of ${totalSectors})`,
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
                            {flight.startHbtStr} – {flight.endHbtStr} <span className="text-[9px] font-normal text-slate-500">HBT</span>
                          </p>
                          <p className="text-[10px] text-slate-400">
                            Local: {flight.startLocalStr} – {flight.endLocalStr}
                          </p>
                        </div>
                      </div>
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
                                    [flight.id]: 'shift1',
                                  },
                                });
                              }}
                              className={`rounded px-2.5 py-1 text-[10px] font-bold transition-all ${
                                (preferences.bunkShiftAssignments?.[flight.id] || 'shift1') === 'shift1'
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
                                    [flight.id]: 'shift2',
                                  },
                                });
                              }}
                              className={`rounded px-2.5 py-1 text-[10px] font-bold transition-all ${
                                preferences.bunkShiftAssignments?.[flight.id] === 'shift2'
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
                            onClick={() => handleOpenTactical('delay_sector', flight)}
                            className="px-2 py-0.5 rounded-md bg-slate-900 hover:bg-slate-800 text-sky-300 border border-slate-800 hover:border-sky-500/40 text-[10px] font-semibold transition-colors flex items-center gap-1"
                            title="Add flight delay (+30m, +1h) and recalculate circadian buffers"
                          >
                            <Clock className="h-2.5 w-2.5" />
                            <span>Delay</span>
                          </button>
                          <button
                            onClick={() => handleOpenTactical('cancel_sector', flight)}
                            className="px-2 py-0.5 rounded-md bg-slate-900 hover:bg-rose-950/60 text-rose-300 border border-slate-800 hover:border-rose-500/40 text-[10px] font-semibold transition-colors flex items-center gap-1"
                            title="Cancel sector or convert to hotel layover"
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

                      {/* Smart Debrief & Duty Release Marker (Understated mental picture footer) */}
                      <div className="mt-2.5 pt-2 border-t border-slate-900/80 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                        <div className="flex items-center gap-1.5 font-mono">
                          <span className="text-slate-500 text-[10px]">Debrief & Duty Release:</span>
                          <strong className="text-indigo-300 font-bold">
                            {calculateDebriefEndTime(flight.endHbtStr, debriefMinutesByFlight[flight.id] || 30)} HBT
                          </strong>
                          <span className="text-slate-600 text-[10px]">•</span>
                          <span className="text-slate-400 text-[10px]">
                            Touchdown {flight.endHbtStr} + {debriefMinutesByFlight[flight.id] || 30}m buffer
                          </span>
                        </div>

                        {/* Subtle Debrief Buffer Switcher */}
                        <div className="flex items-center gap-1">
                          <span className="text-[9px] text-slate-500 font-mono">Debrief:</span>
                          {[15, 30, 45].map((mins) => (
                            <button
                              key={mins}
                              onClick={() => setDebriefMinutesByFlight((prev) => ({ ...prev, [flight.id]: mins }))}
                              className={`px-1.5 py-0.5 rounded text-[9px] font-mono transition-colors ${
                                (debriefMinutesByFlight[flight.id] || 30) === mins
                                  ? 'bg-indigo-950 text-indigo-300 border border-indigo-800/60 font-bold'
                                  : 'text-slate-500 hover:text-slate-300'
                              }`}
                              title={`${mins}m debrief buffer`}
                            >
                              {mins}m
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Ground Turnaround & Transit Card between consecutive sectors */}
                    {idx < actualFlights.length - 1 && (
                      <div className="my-1.5 flex items-center justify-between rounded-xl border border-dashed border-amber-800/60 bg-amber-950/20 px-3.5 py-2 text-xs">
                        <div className="flex items-center gap-2">
                          <Clock className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                          <div>
                            <span className="font-bold text-amber-300 text-[11px]">
                              Ground Turnaround Bridge: Sector 1 ➔ Sector 2
                            </span>
                            <p className="text-[10px] text-slate-400">
                              Transit, security check, cabin restocking & boarding at {actualFlights[idx].subtitle.split('to')[1]?.split('•')[0]?.trim() || 'transit hub'}
                            </p>
                          </div>
                        </div>
                        <span className="rounded bg-amber-950/80 border border-amber-700/50 px-2 py-0.5 font-mono text-[10px] font-black text-amber-300 shrink-0 ml-2">
                          Turnaround
                        </span>
                      </div>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </div>
        </div>

        {/* Pillar 2: Recommended Sleep & Naps */}
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800/60 pb-2">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-500/10 text-purple-400">
                <Moon className="h-3.5 w-3.5" />
              </div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                2. Recommended Sleep & Naps
              </h3>
            </div>
            <span className="text-[11px] text-purple-300 font-semibold">
              Sleep & naps
            </span>
          </div>

          <div className="space-y-2.5">
            {sleepEvents.length === 0 ? (
              <p className="py-4 text-center text-xs text-slate-500">Standard nocturnal sleep.</p>
            ) : (
              sleepEvents.map((event) => {
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
                              🌙 Prior-Day Bedtime ({startWeekday}, {startDateAviation})
                            </span>
                          ) : crossesMidnight ? (
                            <span className="inline-flex items-center gap-1 rounded bg-purple-900/60 border border-purple-700/50 px-1.5 py-0.5 text-[9px] font-mono font-bold text-purple-300">
                              🌙 Crosses Midnight
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded bg-blue-900/40 border border-blue-700/40 px-1.5 py-0.5 text-[9px] font-mono font-bold text-blue-300">
                              ☀️ Daytime Rest
                            </span>
                          )}
                          {event.type === 'anchor_sleep' && prepDetails && (
                            <span className="inline-flex items-center gap-1 rounded bg-purple-900/40 border border-purple-700/50 px-1.5 py-0.5 text-[9px] font-mono font-bold text-purple-300">
                              ✓ In Sync with Runway
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">{event.subtitle}</p>

                        {/* Explicit calendar breakdown subtext for total clarity */}
                        <div className="rounded-lg bg-slate-950/70 border border-purple-900/30 p-2 text-[10px] space-y-1 mt-1.5">
                          <div className="flex items-center justify-between text-slate-300 font-mono">
                            <span className="text-purple-300 font-bold flex items-center gap-1">
                              🛌 Lights Out (Bedtime):
                            </span>
                            <span className="text-white font-extrabold">
                              {startWeekday}, {startDateAviation} • {event.startHbtStr} HBT{' '}
                              {isPriorDayBedtime && <span className="text-amber-400 font-sans font-bold">(Evening Before)</span>}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-slate-300 font-mono border-t border-slate-900 pt-1">
                            <span className="text-sky-300 font-bold flex items-center gap-1">
                              ⏰ Wake-Up Alarm:
                            </span>
                            <span className="text-white font-extrabold">
                              {endWeekday}, {endDateAviation} • {event.endHbtStr} HBT{' '}
                              <span className="text-sky-400 font-sans font-bold">({endWeekday === startWeekday ? 'Today' : 'Duty Morning'})</span>
                            </span>
                          </div>
                          {isPriorDayBedtime && (
                            <p className="text-[10px] text-amber-300/90 pt-1 border-t border-slate-900 font-sans">
                              💡 <strong>Operational Strategy:</strong> Sleep commences the evening before (<strong>{startWeekday}, {startDateAviation}</strong> at {event.startHbtStr} HBT) so that your {Math.floor(event.durationMinutes / 60)}h rest finishes in time for today's {currentDutyWeekday} ({currentDutyAviation}) wake-up at {event.endHbtStr}.
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="text-left sm:text-right shrink-0 pt-1 sm:pt-0 border-t sm:border-t-0 border-purple-900/20">
                        <span className="font-mono text-xs font-black text-purple-200 block">
                          {event.startHbtStr} – {event.endHbtStr}
                        </span>
                        <p className="text-[9px] text-slate-400 font-mono">
                          {Math.floor(event.durationMinutes / 60)}h {event.durationMinutes % 60}m Rest
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
              })
            )}
          </div>
        </div>

        {/* Pillar 3: Meals */}
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800/60 pb-2">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
                <Utensils className="h-3.5 w-3.5" />
              </div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                3. Chrono-Nutrition (Eating Window)
              </h3>
            </div>
            <span className="text-[11px] text-emerald-300 font-semibold">
              Meals
            </span>
          </div>

          <div className="space-y-2.5">
            {nutritionEvents.length === 0 ? (
              <p className="py-4 text-center text-xs text-slate-500">Standard daytime meal schedule.</p>
            ) : (
              nutritionEvents.map((event) => (
                <div
                  key={event.id}
                  className="rounded-xl border border-emerald-900/30 bg-emerald-950/15 p-3 text-xs space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-bold text-white">{event.title}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">{event.subtitle}</p>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="font-mono text-xs font-extrabold text-emerald-200">
                        {event.startHbtStr} – {event.endHbtStr}
                      </span>
                      <p className="text-[10px] text-slate-500">Home Time</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-emerald-900/20 pt-2 text-[11px]">
                    <button
                      onClick={() => onSelectEvent(event)}
                      className="flex items-center gap-1 text-slate-400 hover:text-emerald-300 transition-colors"
                    >
                      <HelpCircle className="h-3 w-3 text-emerald-400" />
                      <span className="underline decoration-slate-700 underline-offset-2">
                        Why this timing?
                      </span>
                    </button>
                    <span className="text-[10px] text-emerald-400/80 font-medium">
                      {event.type === 'eating_window' ? 'Meals' : 'Light food'}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Pillar 4: Caffeine Window & Clearance Cutoff */}
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800/60 pb-2">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400">
                <Coffee className="h-3.5 w-3.5" />
              </div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                4. Caffeine & Clearance Cutoff
              </h3>
            </div>
            <span className="text-[11px] text-amber-300 font-semibold">
              6h Clearance Rule
            </span>
          </div>

          <div className="space-y-2.5">
            {caffeineEvents.length === 0 ? (
              <p className="py-4 text-center text-xs text-slate-500">Standard caffeine rules apply.</p>
            ) : (
              caffeineEvents.map((event) => {
                const isCutoff = event.type === 'caffeine_cutoff';
                return (
                  <div
                    key={event.id}
                    className={`rounded-xl border p-3 text-xs space-y-2 ${
                      isCutoff
                        ? 'border-red-900/40 bg-red-950/20'
                        : 'border-amber-900/30 bg-amber-950/15'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-bold text-white flex items-center gap-1.5">
                          {isCutoff ? (
                            <XCircle className="h-3.5 w-3.5 text-red-400" />
                          ) : (
                            <Coffee className="h-3.5 w-3.5 text-amber-400" />
                          )}
                          <span>{event.title}</span>
                        </p>
                        <p className="text-[11px] text-slate-400 mt-0.5">{event.subtitle}</p>
                      </div>

                      <div className="text-right shrink-0">
                        <span className={`font-mono text-xs font-extrabold ${isCutoff ? 'text-red-300' : 'text-amber-200'}`}>
                          {event.startHbtStr} – {event.endHbtStr}
                        </span>
                        <p className="text-[10px] text-slate-500">Home Time</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between border-t border-slate-800/60 pt-2 text-[11px]">
                      <button
                        onClick={() => onSelectEvent(event)}
                        className="flex items-center gap-1 text-slate-400 hover:text-slate-200 transition-colors"
                      >
                        <HelpCircle className="h-3 w-3 text-slate-400" />
                        <span className="underline decoration-slate-700 underline-offset-2">
                          Why this timing?
                        </span>
                      </button>
                      <span className={`text-[10px] font-semibold ${isCutoff ? 'text-red-400' : 'text-amber-400'}`}>
                        {isCutoff ? 'Zero Caffeine Zone' : 'Safe Consumption'}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Layer 6: Morning Light / Sunlight Reset card on Off Day or Layover */}
      {lightEvents.length > 0 && (
        <div className="rounded-xl border border-amber-900/30 bg-amber-950/20 p-3.5 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Sun className="h-4 w-4 text-amber-400 shrink-0" />
            <div>
              <strong className="text-amber-200">Morning Phototherapy Tip: </strong>
              <span className="text-slate-300">Some time in daylight this morning helps keep your body clock on home time.</span>
            </div>
          </div>
          <button
            onClick={() => onSelectEvent(lightEvents[0])}
            className="text-[11px] font-semibold text-amber-300 underline underline-offset-2 shrink-0 ml-3"
          >
            Study Details
          </button>
        </div>
      )}

      {/* Special WOCL Alert if applicable */}
      {alertEvents.length > 0 && (
        <div className="rounded-xl border border-rose-900/30 bg-rose-950/20 p-3.5 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
            <div>
              <strong className="text-rose-200">Night duty: </strong>
              <span className="text-slate-300">This duty runs through your body-clock night (roughly 02:00–06:00 home time), when alertness is usually lowest. A nap before the duty helps.</span>
            </div>
          </div>
          <button
            onClick={() => onSelectEvent(alertEvents[0])}
            className="text-[11px] font-semibold text-rose-300 underline underline-offset-2 shrink-0 ml-3"
          >
            WOCL Protocol
          </button>
        </div>
      )}
      {/* Tactical Duty Action Modal (Real-Time Flight Modifications) */}
      {tacticalModal && tacticalModal.isOpen && (
        <TacticalDutyModal
          type={tacticalModal.type}
          flight={tacticalModal.flight}
          defaultDate={activeDaySummary?.dateStr}
          homeBase={preferences.homeBaseIata}
          onAddStandbyFlight={(newFlight) => {
            if (onAddStandbyFlight) onAddStandbyFlight(newFlight);
            setTacticalModal(null);
          }}
          onCancelSector={(flightId, convertToLayover) => {
            if (onCancelSector) onCancelSector(flightId, convertToLayover);
            setTacticalModal(null);
          }}
          onDelaySector={(flightId, delayMinutes) => {
            if (onDelaySector) onDelaySector(flightId, delayMinutes);
            setTacticalModal(null);
          }}
          onClose={() => setTacticalModal(null)}
        />
      )}
    </div>
  );
};
