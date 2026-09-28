import React from 'react';
import { Chronotype, CrewPreferences, CrewRank, RosterData, SalaryCurrency } from '../../types/circadian';
import { AIRPORTS } from '../../data/airports';
import {
  Sliders,
  Moon,
  Coffee,
  Clock,
  Car,
  Bell,
  Sun,
  MapPin,
  DollarSign,
  UserCheck,
  Shield,
  Zap,
} from 'lucide-react';

interface SettingsViewProps {
  preferences: CrewPreferences;
  roster: RosterData;
  onUpdatePreferences: (updated: Partial<CrewPreferences>) => void;
  onChangeHomeBase: (iata: string, tzOffset: number) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  preferences,
  roster,
  onUpdatePreferences,
  onChangeHomeBase,
}) => {
  const quickBases = [
    { iata: 'DEL', name: 'Delhi', tzOffset: 5.5 },
    { iata: 'BOM', name: 'Mumbai', tzOffset: 5.5 },
    { iata: 'BLR', name: 'Bengaluru', tzOffset: 5.5 },
    { iata: 'HYD', name: 'Hyderabad', tzOffset: 5.5 },
    { iata: 'CCU', name: 'Kolkata', tzOffset: 5.5 },
    { iata: 'DXB', name: 'Dubai', tzOffset: 4 },
    { iata: 'DOH', name: 'Doha', tzOffset: 3 },
    { iata: 'SIN', name: 'Singapore', tzOffset: 8 },
    { iata: 'LHR', name: 'London Heathrow', tzOffset: 1 },
  ];

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header Banner */}
      <div className="rounded-2xl border border-slate-800 bg-gradient-to-r from-slate-900/90 via-slate-900/60 to-slate-950 p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600/10 text-blue-400 ring-1 ring-blue-500/20">
            <Sliders className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">
              Pre-Flight Buffers & Circadian Preferences
            </h2>
            <p className="text-xs text-slate-400">
              Customize morning grooming, cab travel times, core sleep targets, and home base anchors.
            </p>
          </div>
        </div>
      </div>

      {/* 1. Pre-Flight Morning Departure Buffers */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
          <Clock className="h-4 w-4 text-sky-400" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
            1. Pre-Flight Departure Buffers (Runway Engine)
          </h3>
        </div>
        <p className="text-xs text-slate-400">
          Determines your exact wake-up alarm and cab arrival time before your duty report time.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Grooming Time */}
          <div className="rounded-xl border border-sky-900/40 bg-sky-950/20 p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm text-sky-200 flex items-center gap-1.5">
                <Bell className="h-4 w-4 text-sky-400" /> Grooming & Prep Duration
              </span>
              <span className="font-mono font-bold text-white text-base">
                {preferences.groomingMinutes} min
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Time from your wake-up alarm to stepping into your cab (shower, uniform, makeup, flight bag).
            </p>
            <input
              type="range"
              min="30"
              max="120"
              step="15"
              value={preferences.groomingMinutes}
              onChange={(e) => onUpdatePreferences({ groomingMinutes: parseInt(e.target.value) })}
              className="w-full accent-sky-400 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>30m (Quick)</span>
              <span>60m (Standard)</span>
              <span>120m (Leisurely)</span>
            </div>
          </div>

          {/* Cab Transit Buffer */}
          <div className="rounded-xl border border-amber-900/40 bg-amber-950/20 p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm text-amber-200 flex items-center gap-1.5">
                <Car className="h-4 w-4 text-amber-400" /> Cab Commute Buffer
              </span>
              <span className="font-mono font-bold text-white text-base">
                {preferences.cabBufferMinutes} min
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              City traffic buffer from your door to airport crew briefing center before reporting time.
            </p>
            <input
              type="range"
              min="30"
              max="120"
              step="15"
              value={preferences.cabBufferMinutes}
              onChange={(e) => onUpdatePreferences({ cabBufferMinutes: parseInt(e.target.value) })}
              className="w-full accent-amber-400 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>30m (Airport Close)</span>
              <span>60m (Average Traffic)</span>
              <span>120m (Peak Rush Hour)</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Circadian Rhythm & Sleep Biology */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
          <Moon className="h-4 w-4 text-purple-400" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
            2. Circadian Biology & Sleep Science
          </h3>
        </div>

        {/* Chronotype Selection */}
        <div className="space-y-2">
          <label className="font-bold uppercase tracking-wider text-slate-300 text-xs">
            Personal Chronotype (Biological Clock Inclination)
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              {
                id: 'lark' as Chronotype,
                title: '🌅 Morning Lark',
                desc: 'Alert early. Sleep shifted 45m earlier. Great for early check-ins.',
              },
              {
                id: 'intermediate' as Chronotype,
                title: '🌤️ Intermediate',
                desc: 'Balanced diurnal rhythm. Standard clinical sleep windows.',
              },
              {
                id: 'owl' as Chronotype,
                title: '🦉 Night Owl',
                desc: 'Alert in late evenings. Naturally resilient on red-eye turnarounds.',
              },
            ].map((c) => {
              const isSelected = preferences.chronotype === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => onUpdatePreferences({ chronotype: c.id })}
                  className={`rounded-xl border p-3 text-left transition-all ${
                    isSelected
                      ? 'border-purple-500 bg-purple-950/30 ring-1 ring-purple-500 shadow-sm'
                      : 'border-slate-800 bg-slate-950/60 hover:border-slate-700'
                  }`}
                >
                  <p className="font-bold text-white text-xs">{c.title}</p>
                  <p className="text-[11px] text-slate-400 mt-1 leading-snug">{c.desc}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Target Sleep Hours & Caffeine Clearance */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          {/* Target Sleep Duration */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs uppercase text-slate-300">Target Core Sleep</span>
              <span className="font-mono font-bold text-purple-300 text-sm">
                {preferences.targetSleepHours} Hours
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Hours of restorative nocturnal sleep required to clear homeostatic sleep pressure.
            </p>
            <input
              type="range"
              min="6.0"
              max="9.0"
              step="0.5"
              value={preferences.targetSleepHours}
              onChange={(e) => onUpdatePreferences({ targetSleepHours: parseFloat(e.target.value) })}
              className="w-full accent-purple-400 cursor-pointer"
            />
          </div>

          {/* Caffeine Clearance Buffer */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs uppercase text-slate-300">Caffeine Clearance Buffer</span>
              <span className="font-mono font-bold text-amber-300 text-sm">
                {preferences.caffeineCutoffHours} Hours Pre-Sleep
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Caffeine half-life clearance buffer to prevent disruption of Stage 3 slow-wave sleep.
            </p>
            <div className="flex gap-2 pt-1">
              {[6, 8].map((hrs) => (
                <button
                  key={hrs}
                  onClick={() => onUpdatePreferences({ caffeineCutoffHours: hrs })}
                  className={`flex-1 rounded-lg py-1.5 text-xs font-bold transition-all ${
                    preferences.caffeineCutoffHours === hrs
                      ? 'bg-amber-600 text-white shadow-sm'
                      : 'border border-slate-800 bg-slate-900 text-slate-400 hover:text-white'
                  }`}
                >
                  {hrs} Hours (Clearance)
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Wearable Sleep Sync Override (Apple Health / Oura / Garmin) */}
        <div className="rounded-xl border border-indigo-900/50 bg-indigo-950/20 p-4 space-y-3 pt-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-indigo-900/30 pb-2">
            <div>
              <span className="font-bold text-xs uppercase tracking-wider text-indigo-300 flex items-center gap-1.5">
                <Zap className="h-4 w-4 text-indigo-400" /> Wearable Sleep Sync Override (Biometric Calibration)
              </span>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Adjusts the SAFTE alertness curve based on actual recorded sleep rather than scheduled plan.
              </p>
            </div>
            <span className="rounded bg-indigo-900/40 border border-indigo-700/50 px-2 py-0.5 text-[9px] font-mono text-indigo-300 self-start sm:self-center">
              Apple Health • Oura • Garmin
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <div className="flex justify-between text-slate-300 mb-1">
                <span>Last Night Actual Sleep:</span>
                <span className="font-mono font-bold text-white">
                  {preferences.actualLastSleepHours !== undefined ? `${preferences.actualLastSleepHours} hrs` : `${preferences.targetSleepHours} hrs (Default)`}
                </span>
              </div>
              <input
                type="range"
                min="4.0"
                max="10.0"
                step="0.5"
                value={preferences.actualLastSleepHours ?? preferences.targetSleepHours}
                onChange={(e) => onUpdatePreferences({ actualLastSleepHours: parseFloat(e.target.value) })}
                className="w-full accent-indigo-400 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-slate-300 mb-1">
                <span>Wearable Sleep Efficiency:</span>
                <span className="font-mono font-bold text-white">
                  {preferences.actualSleepEfficiency ?? 85}%
                </span>
              </div>
              <input
                type="range"
                min="60"
                max="100"
                step="1"
                value={preferences.actualSleepEfficiency ?? 85}
                onChange={(e) => onUpdatePreferences({ actualSleepEfficiency: parseInt(e.target.value) })}
                className="w-full accent-indigo-400 cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Melatonin Phase Response Curve (PRC) Protocol */}
        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3.5 flex items-center justify-between text-xs">
          <div>
            <span className="font-bold text-white block">
              Low-Dose Melatonin Timer (0.5mg–3mg Phase Response Curve)
            </span>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Calculates precise pre-sleep administration window for rapid eastward/westward circadian clock shifts.
            </p>
          </div>
          <button
            onClick={() => onUpdatePreferences({ useMelatoninProtocol: !preferences.useMelatoninProtocol })}
            className={`rounded-xl px-3 py-1.5 font-bold transition-all ${
              preferences.useMelatoninProtocol
                ? 'bg-purple-600 text-white shadow-sm'
                : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            {preferences.useMelatoninProtocol ? 'Active ✓' : 'Enable'}
          </button>
        </div>
      </div>

      {/* 3. Home Base Airport & Position Rank */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
          <MapPin className="h-4 w-4 text-emerald-400" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
            3. Home Base Anchor & Position Rank
          </h3>
        </div>

        {/* Quick Base Airport Switcher */}
        <div className="space-y-2">
          <label className="font-bold uppercase tracking-wider text-slate-300 text-xs">
            Select Your Permanent Home Base Airport
          </label>
          <div className="grid grid-cols-3 sm:grid-cols-9 gap-2">
            {quickBases.map((b) => {
              const isCurrent = roster.homeBase === b.iata;
              return (
                <button
                  key={b.iata}
                  onClick={() => onChangeHomeBase(b.iata, b.tzOffset)}
                  className={`rounded-xl border p-2 text-center transition-all ${
                    isCurrent
                      ? 'border-emerald-500 bg-emerald-950/40 text-emerald-300 font-bold ring-1 ring-emerald-500'
                      : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:text-white hover:border-slate-700'
                  }`}
                >
                  <span className="font-mono text-xs block font-bold">{b.iata}</span>
                  <span className="text-[9px] text-slate-500 block truncate">{b.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Seniority Rank & Currency */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          {/* Rank */}
          <div className="space-y-1.5">
            <label className="font-bold uppercase tracking-wider text-slate-300 text-xs">
              Crew Position / Seniority
            </label>
            <div className="flex gap-2">
              {[
                { id: 'junior' as CrewRank, label: 'Junior Crew' },
                { id: 'senior' as CrewRank, label: 'Senior Crew' },
                { id: 'lead' as CrewRank, label: 'Inflight Lead' },
              ].map((r) => (
                <button
                  key={r.id}
                  onClick={() => onUpdatePreferences({ crewRank: r.id })}
                  className={`flex-1 rounded-xl py-2 text-xs font-bold transition-all ${
                    preferences.crewRank === r.id
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'border border-slate-800 bg-slate-950 text-slate-400 hover:text-white'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {/* Currency */}
          <div className="space-y-1.5">
            <label className="font-bold uppercase tracking-wider text-slate-300 text-xs">
              Salary Calculation Currency
            </label>
            <div className="flex gap-2">
              {[
                { id: 'INR' as SalaryCurrency, label: '₹ INR' },
                { id: 'AED' as SalaryCurrency, label: 'AED' },
                { id: 'USD' as SalaryCurrency, label: '$ USD' },
              ].map((curr) => (
                <button
                  key={curr.id}
                  onClick={() => onUpdatePreferences({ currency: curr.id })}
                  className={`flex-1 rounded-xl py-2 text-xs font-bold transition-all ${
                    preferences.currency === curr.id
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'border border-slate-800 bg-slate-950 text-slate-400 hover:text-white'
                  }`}
                >
                  {curr.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
