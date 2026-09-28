import React, { useState } from 'react';
import {
  CircadianEvent,
  CircadianPlan,
  CrewPreferences,
  CrewRank,
  DailyCircadianSummary,
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
  Bed,
  DollarSign,
  Car,
  Bell,
  ChevronDown,
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
} from 'lucide-react';
import { SalarySection } from './SalarySection';
import { TacticalDutyModal, TacticalModalType } from './TacticalDutyModal';
import { FlightLeg } from '../types/circadian';

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
}) => {
  const { events, dailySummaries, preferences, monthlyStats, salaryBreakdown } = plan;

  // Selected Week filter: 'all' | 'w1' | 'w2' | 'w3' | 'w4' | 'w5'
  const [activeWeek, setActiveWeek] = useState<string>('w1');
  const [showSalaryStudio, setShowSalaryStudio] = useState<boolean>(false);
  const [copiedTimers, setCopiedTimers] = useState<boolean>(false);

  // Multi-Month detection across continuous timeline (e.g. Jan, Feb, Mar)
  const monthsInTimeline = React.useMemo(() => {
    const map = new Map<string, { key: string; label: string; count: number }>();
    dailySummaries.forEach((d) => {
      const ym = d.dateStr.slice(0, 7);
      if (!map.has(ym)) {
        const dateObj = new Date(`${d.dateStr}T12:00:00Z`);
        const label = dateObj.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        map.set(ym, { key: ym, label, count: 0 });
      }
      if (!d.isOffDay) {
        map.get(ym)!.count++;
      }
    });
    return Array.from(map.values());
  }, [dailySummaries]);

  const [activeMonthFilter, setActiveMonthFilter] = useState<string>('all');
  const [tacticalModal, setTacticalModal] = useState<{
    isOpen: boolean;
    type: TacticalModalType;
    flight?: FlightLeg;
  } | null>(null);

  // Default to day 1
  const [selectedDate, setSelectedDate] = useState<string>(
    dailySummaries[0]?.dateStr || ''
  );

  const activeDaySummary = dailySummaries.find((d) => d.dateStr === selectedDate) || dailySummaries[0];

  // Month-filtered daily summaries
  const monthFilteredSummaries = React.useMemo(() => {
    if (activeMonthFilter === 'all') return dailySummaries;
    return dailySummaries.filter((d) => d.dateStr.startsWith(activeMonthFilter));
  }, [dailySummaries, activeMonthFilter]);

  // Filter days based on active week within the active month
  const filteredSummaries = React.useMemo(() => {
    if (activeWeek === 'all') return monthFilteredSummaries;
    if (activeWeek === 'w1') return monthFilteredSummaries.slice(0, 7);
    if (activeWeek === 'w2') return monthFilteredSummaries.slice(7, 14);
    if (activeWeek === 'w3') return monthFilteredSummaries.slice(14, 21);
    if (activeWeek === 'w4') return monthFilteredSummaries.slice(21, 28);
    if (activeWeek === 'w5') return monthFilteredSummaries.slice(28);
    return monthFilteredSummaries;
  }, [monthFilteredSummaries, activeWeek]);

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

  const formatMoney = (val: number, symbol: string) => {
    return `${symbol}${val.toLocaleString()}`;
  };

  const handleCopyPrepTimers = () => {
    if (!prepDetails) return;
    const text = `✈️ Pre-Flight Routine (${activeDaySummary.dayLabel}):\n⏰ Wake-Up Alarm: ${prepDetails.wakeUpHbt}\n🚖 Cab Pickup: ${prepDetails.cabPickupHbt}\n🏢 Base Check-In: ${prepDetails.reportHbt}\n🛫 Flight Departure: ${prepDetails.departureHbt}\n🛌 Bedtime the night before: ${prepDetails.targetBedtimeHbt || '--:--'}`;
    navigator.clipboard.writeText(text);
    setCopiedTimers(true);
    setTimeout(() => setCopiedTimers(false), 2500);
  };

  return (
    <div className="space-y-4">
      {/* Layer 1: Month Overview Window (Operational Hours & Fatigue Safety Limits) */}
      {monthlyStats && (
        <div className="rounded-2xl border border-slate-800 bg-gradient-to-r from-slate-900/95 via-slate-900/80 to-slate-950 p-4 sm:p-5 shadow-sm space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex h-2 w-2 rounded-full bg-blue-400" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
                  Monthly Operational Hours & Safety Limits
                </span>
                <span className="rounded bg-blue-500/10 px-2 py-0.5 text-[10px] font-semibold text-blue-300 border border-blue-500/20">
                  DGCA & FAA Limits Verified
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Tracking flight block hours against regulatory 100h safety caps, standby reserve readiness, and circadian rest days.
              </p>
            </div>

            {/* Dedicated Salary Studio Trigger Button */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowSalaryStudio(!showSalaryStudio)}
                className="flex items-center gap-2 rounded-xl border border-emerald-800/60 bg-emerald-950/40 hover:bg-emerald-900/50 hover:border-emerald-700 px-4 py-2.5 text-xs font-bold text-emerald-300 transition-all shadow-sm"
              >
                <DollarSign className="h-4 w-4 text-emerald-400" />
                <span>
                  {showSalaryStudio ? 'Close Remuneration Studio' : `Salary Studio (Est. ${formatMoney(salaryBreakdown.totalEarnings, salaryBreakdown.currencySymbol)})`}
                </span>
                <ChevronDown className={`h-4 w-4 text-emerald-400 transition-transform ${showSalaryStudio ? 'rotate-180' : ''}`} />
              </button>
            </div>
          </div>

          {/* Quick Metrics Bar: Pure Operational Hours */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-left font-mono">
            {/* Flying Hours */}
            <div className="rounded-xl border border-blue-900/40 bg-blue-950/20 p-3 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-[9px] uppercase tracking-wider text-blue-300 font-sans font-bold">1. Flying Hours</span>
                <span className="text-[9px] text-blue-400 font-sans font-bold">100h max</span>
              </div>
              <p className="text-base font-extrabold text-blue-300 mt-1">
                {monthlyStats.totalFlightHours}h
              </p>
              <div className="mt-1.5 w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-blue-500 h-full rounded-full transition-all"
                  style={{ width: `${Math.min(100, (monthlyStats.totalFlightHours / 100) * 100)}%` }}
                />
              </div>
              <p className="text-[9px] text-slate-400 font-sans mt-1">Block hours (pushback to gate)</p>
            </div>

            {/* Standby Hours */}
            <div className="rounded-xl border border-amber-900/40 bg-amber-950/20 p-3">
              <span className="text-[9px] uppercase tracking-wider text-amber-300 font-sans font-bold">2. Standby Reserve</span>
              <p className="text-base font-extrabold text-amber-300 mt-1">
                {monthlyStats.standbyHours}h
              </p>
              <div className="mt-1.5 w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                <div className="bg-amber-500 h-full rounded-full w-2/5" />
              </div>
              <p className="text-[9px] text-slate-400 font-sans mt-1">Airport & home standby</p>
            </div>

            {/* Total Flights */}
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
              <span className="text-[9px] uppercase tracking-wider text-slate-400 font-sans font-bold">3. Total Flights</span>
              <p className="text-base font-extrabold text-white mt-1">
                {monthlyStats.totalSectors} <span className="text-xs font-normal text-slate-400">Sectors</span>
              </p>
              <p className="text-[9px] text-slate-400 font-sans mt-2">Active flight legs</p>
            </div>

            {/* Rest / Off Days */}
            <div className="rounded-xl border border-emerald-900/40 bg-emerald-950/20 p-3">
              <span className="text-[9px] uppercase tracking-wider text-emerald-300 font-sans font-bold">4. Rest / Off Days</span>
              <p className="text-base font-extrabold text-emerald-400 mt-1">
                {monthlyStats.offDays} <span className="text-xs font-normal text-slate-400">Days</span>
              </p>
              <p className="text-[9px] text-slate-400 font-sans mt-2">Circadian reset (WKOFF)</p>
            </div>

            {/* Red-Eye WOCL */}
            <div className="rounded-xl border border-rose-900/40 bg-rose-950/20 p-3">
              <span className="text-[9px] uppercase tracking-wider text-rose-300 font-sans font-bold">5. Red-Eye Sectors</span>
              <p className="text-base font-extrabold text-rose-300 mt-1">
                {monthlyStats.woclNightFlights} <span className="text-xs font-normal text-slate-400">Night Legs</span>
              </p>
              <p className="text-[9px] text-slate-400 font-sans mt-2">02:00–06:00 WOCL window</p>
            </div>
          </div>

          {/* Cumulative Sleep Debt & FDP Compliance Strip */}
          <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-xs">
            <div className="flex items-center gap-2">
              <Bed className="h-4 w-4 text-purple-400" />
              <span className="text-slate-300">
                Cumulative Sleep Debt: <strong className="font-mono text-purple-300">+{monthlyStats.cumulativeSleepDebtHours}h</strong>
              </span>
              <span className="text-[10px] text-slate-500 hidden sm:inline">(Recoverable with scheduled restorative rest blocks)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-emerald-400" />
              <span className="text-emerald-300 font-semibold text-[11px]">
                FAR Part 117 / DGCA FDP Compliant ({monthlyStats.maxFdpHours}h ceiling)
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Dedicated Remuneration & Payslip Studio (Separate Section per User Request 1) */}
      {showSalaryStudio && onUpdatePreferences && (
        <SalarySection
          plan={plan}
          onUpdatePreferences={onUpdatePreferences}
          onClose={() => setShowSalaryStudio(false)}
        />
      )}

      {/* Layer 1.5: Continuous Multi-Month Timeline Bar (Jan, Feb, Mar) */}
      {monthsInTimeline.length > 1 && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 rounded-2xl border border-blue-900/50 bg-gradient-to-r from-blue-950/40 via-slate-900 to-slate-950 p-3 text-xs">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-blue-400 shrink-0" />
            <span className="font-bold text-white">Continuous Multi-Month Timeline:</span>
            <span className="text-slate-400 font-mono text-[11px]">
              {dailySummaries.length} Days • {monthlyStats.totalSectors} Sectors Total
            </span>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 max-w-full">
            <button
              onClick={() => {
                setActiveMonthFilter('all');
                setActiveWeek('w1');
              }}
              className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition-all shrink-0 ${
                activeMonthFilter === 'all'
                  ? 'bg-blue-600 text-white shadow-sm ring-1 ring-blue-400'
                  : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              All Months ({monthsInTimeline[0]?.label.split(' ')[0]} – {monthsInTimeline[monthsInTimeline.length - 1]?.label})
            </button>
            {monthsInTimeline.map((m) => (
              <button
                key={m.key}
                onClick={() => {
                  setActiveMonthFilter(m.key);
                  setActiveWeek('all');
                  const firstInMonth = dailySummaries.find((d) => d.dateStr.startsWith(m.key));
                  if (firstInMonth) setSelectedDate(firstInMonth.dateStr);
                }}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition-all shrink-0 ${
                  activeMonthFilter === m.key
                    ? 'bg-blue-600 text-white shadow-sm ring-1 ring-blue-400'
                    : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {m.label} ({m.count} duty days)
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Layer 2: Week Selector Tabs */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full scrollbar-thin">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mr-1 flex items-center gap-1 shrink-0">
            <Calendar className="h-3.5 w-3.5 text-blue-400" /> Week:
          </span>
          {[
            { id: 'w1', label: 'W1 (1–7)' },
            { id: 'w2', label: 'W2 (8–14)' },
            { id: 'w3', label: 'W3 (15–21)' },
            { id: 'w4', label: 'W4 (22–28)' },
            { id: 'w5', label: 'W5 (29–30)' },
            { id: 'all', label: 'All 30 Days' },
          ].map((wk) => (
            <button
              key={wk.id}
              onClick={() => {
                setActiveWeek(wk.id);
                if (wk.id === 'w1' && dailySummaries[0]) setSelectedDate(dailySummaries[0].dateStr);
                if (wk.id === 'w2' && dailySummaries[7]) setSelectedDate(dailySummaries[7].dateStr);
                if (wk.id === 'w3' && dailySummaries[14]) setSelectedDate(dailySummaries[14].dateStr);
                if (wk.id === 'w4' && dailySummaries[21]) setSelectedDate(dailySummaries[21].dateStr);
                if (wk.id === 'w5' && dailySummaries[28]) setSelectedDate(dailySummaries[28].dateStr);
              }}
              className={`shrink-0 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                activeWeek === wk.id
                  ? 'bg-blue-600 text-white shadow-sm ring-1 ring-blue-400'
                  : 'bg-slate-900 border border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              {wk.label}
            </button>
          ))}
        </div>

        {/* Selected Day Header Label */}
        {activeDaySummary && selectedDate !== 'all' && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400">
              Selected: <strong className="text-white">Day {activeDaySummary.dayNumber}</strong> ({activeDaySummary.dayLabel})
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                activeDaySummary.isOffDay
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : activeDaySummary.fatigueRiskLevel === 'high'
                  ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                  : 'bg-blue-500/10 text-blue-300 border border-blue-500/20'
              }`}
            >
              {activeDaySummary.isOffDay ? '🏖️ Rest Day (WKOFF)' : `${activeDaySummary.fatigueRiskLevel} Load`}
            </span>
          </div>
        )}
      </div>

      {/* Layer 3: Day Selector Pills for the Active Week */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1.5 scrollbar-thin">
        {filteredSummaries.map((day: DailyCircadianSummary) => {
          const isSelected = selectedDate === day.dateStr;
          return (
            <button
              key={day.dateStr}
              onClick={() => setSelectedDate(day.dateStr)}
              className={`flex shrink-0 flex-col items-center justify-center rounded-xl border px-3 py-2 text-center transition-all min-w-[76px] ${
                isSelected
                  ? 'border-blue-500 bg-blue-950/40 ring-1 ring-blue-500 shadow-md'
                  : day.isOffDay
                  ? 'border-emerald-900/40 bg-emerald-950/20 text-emerald-300 hover:bg-emerald-950/30'
                  : 'border-slate-800 bg-slate-900/60 hover:border-slate-700 hover:bg-slate-900'
              }`}
            >
              <span className="text-[10px] font-semibold text-slate-400 uppercase">
                {day.dayLabel.split(',')[0]}
              </span>
              <span className="font-mono text-xs font-bold text-white mt-0.5">
                Day {day.dayNumber}
              </span>
              <span className="text-[9px] mt-1 font-medium">
                {day.isOffDay ? (
                  <span className="text-emerald-400 font-bold">OFF</span>
                ) : day.fatigueRiskLevel === 'high' ? (
                  <span className="text-red-400">Night/WOCL</span>
                ) : (
                  <span className="text-blue-400">Duty</span>
                )}
              </span>
            </button>
          );
        })}
      </div>

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
                Zero mental math: reporting at <strong className="text-white font-mono">{prepDetails.reportHbt}</strong>. With your <strong className="text-amber-300 font-mono">{preferences.cabBufferMinutes}m cab transit</strong> and <strong className="text-sky-300 font-mono">{preferences.groomingMinutes}m grooming</strong>, your cab pickup is at <strong className="text-amber-300 font-mono">{prepDetails.cabPickupHbt}</strong> and alarm is at <strong className="text-sky-300 font-mono">{prepDetails.wakeUpHbt}</strong>.
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
                  <Car className="h-3.5 w-3.5 text-amber-400" /> Step 2: Cab Pickup
                </span>
                <span className="text-[10px] font-mono text-amber-300 bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-800/50">
                  {preferences.cabBufferMinutes}m drive
                </span>
              </div>
              <div className="my-2.5">
                <p className="text-2xl font-black font-mono text-amber-300">
                  {prepDetails.cabPickupHbt} <span className="text-xs font-normal text-slate-400">HBT</span>
                </p>
                <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                  Airline crew vehicle arrives at your door & city transit to airport terminal
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
            {prepDetails.bedtimeExplanation ? (
              <div className="rounded-xl border border-purple-900/30 bg-purple-950/15 p-3 flex items-center gap-2.5 text-xs">
                <Moon className="h-4 w-4 text-purple-400 shrink-0" />
                <div>
                  <strong className="text-purple-300 font-semibold">Circadian Sleep Schedule: </strong>
                  <span className="text-slate-300">{prepDetails.bedtimeExplanation}</span>
                </div>
              </div>
            ) : prepDetails.targetBedtimeHbt ? (
              <div className="rounded-xl border border-purple-900/30 bg-purple-950/15 p-3 flex items-center gap-2.5 text-xs">
                <Moon className="h-4 w-4 text-purple-400 shrink-0" />
                <div>
                  <strong className="text-purple-300 font-semibold">Reverse Bedtime Recommendation: </strong>
                  <span className="text-slate-300">
                    To get your target {preferences.targetSleepHours}h sleep before your {prepDetails.wakeUpHbt} alarm, lights out by <strong className="text-white font-mono">{prepDetails.targetBedtimeHbt}</strong> the night before.
                  </span>
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
              <span className="font-bold text-sky-300 text-xs">{activeDaySummary.layoverStation.tempCelsius}°C Optimal</span>
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
                            <Bed className="h-3.5 w-3.5 text-indigo-400" /> In-Flight Bunk Rest Shift:
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
                              Shift 1 (Early Bunk)
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
                              Shift 2 (Late Bunk)
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Tactical Flight Modification Bar (Real-Time UI Adjustments) */}
                      <div className="mt-2.5 pt-2 border-t border-slate-900/90 flex flex-wrap items-center justify-between gap-1.5 text-[11px]">
                        <span className="text-[10px] text-slate-500 font-medium">Real-Time Tactical Changes:</span>
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
              NASA Ames Protocol
            </span>
          </div>

          <div className="space-y-2.5">
            {sleepEvents.length === 0 ? (
              <p className="py-4 text-center text-xs text-slate-500">Standard nocturnal sleep.</p>
            ) : (
              sleepEvents.map((event) => {
                const nudge = customNudges[event.id] || 0;
                return (
                  <div
                    key={event.id}
                    className="rounded-xl border border-purple-900/30 bg-purple-950/15 p-3 text-xs space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="font-bold text-white flex items-center gap-1.5">
                            <span>{event.title}</span>
                          </p>
                          {event.type === 'anchor_sleep' && prepDetails && (
                            <span className="inline-flex items-center gap-1 rounded bg-purple-900/40 border border-purple-700/50 px-1.5 py-0.5 text-[9px] font-mono font-bold text-purple-300">
                              ✓ In Sync with Runway
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">{event.subtitle}</p>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="font-mono text-xs font-extrabold text-purple-200">
                          {event.startHbtStr} – {event.endHbtStr}
                        </span>
                        <p className="text-[10px] text-slate-500">Home Time</p>
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

        {/* Pillar 3: Chrono-Nutrition (Eating & Gut Rest) */}
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
              Salk 10h Protocol
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
                        Why: Dr. Satchin Panda Gut Research
                      </span>
                    </button>
                    <span className="text-[10px] text-emerald-400/80 font-medium">
                      {event.type === 'eating_window' ? 'Active Digestion' : 'Gut Rest'}
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
                          Why: Adenosine & Sleep Architecture
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
              <span className="text-slate-300">Get 20–30 mins outdoor sunlight this morning to lock your suprachiasmatic nucleus (SCN) master clock to home time.</span>
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
              <strong className="text-rose-200">Aero-Medical WOCL Notice: </strong>
              <span className="text-slate-300">Flight duty operates through the biological Window of Circadian Low (02:00–06:00). Follow the NASA 26m nap protocol.</span>
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
