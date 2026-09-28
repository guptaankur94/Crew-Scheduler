import React from 'react';
import { Chronotype, CrewPreferences, RosterData } from '../types/circadian';
import { X, Sliders, Moon, Coffee, Clock, Sun, AlertCircle, Sparkles } from 'lucide-react';

interface CustomizerModalProps {
  preferences: CrewPreferences;
  onUpdatePreferences: (updated: Partial<CrewPreferences>) => void;
  roster: RosterData;
  onSimulateDelay?: (flightId: string, delayMinutes: number) => void;
  onClose: () => void;
}

export const CustomizerModal: React.FC<CustomizerModalProps> = ({
  preferences,
  onUpdatePreferences,
  roster,
  onSimulateDelay,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="relative max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-2xl sm:p-6">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400 ring-1 ring-indigo-500/20">
            <Sliders className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white sm:text-lg">
              Circadian Schedule Customizer
            </h3>
            <p className="text-xs text-slate-400">
              Tailor sleep targets, biological chronotype, and caffeine metabolism
            </p>
          </div>
        </div>

        <div className="mt-5 space-y-5 text-xs">
          {/* 1. Chronotype Selection */}
          <div className="space-y-2">
            <label className="font-bold uppercase tracking-wider text-slate-300">
              Personal Chronotype (Circadian Phase)
            </label>
            <p className="text-[11px] text-slate-400">
              Your natural biological inclination for waking and sleeping shifts anchor sleep windows accordingly.
            </p>

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              {[
                {
                  id: 'lark',
                  title: '🌅 Morning Lark',
                  desc: 'Peak energy at 07:00. Sleep shifted 45m earlier. Great for early check-ins.',
                },
                {
                  id: 'intermediate',
                  title: '🌤️ Intermediate',
                  desc: 'Balanced diurnal rhythm. Standard clinical sleep windows.',
                },
                {
                  id: 'owl',
                  title: '🦉 Night Owl',
                  desc: 'Alert in late evenings. Naturally resilient on red-eye turnarounds.',
                },
              ].map((c) => {
                const isSelected = preferences.chronotype === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => onUpdatePreferences({ chronotype: c.id as Chronotype })}
                    className={`rounded-xl border p-3 text-left transition-all ${
                      isSelected
                        ? 'border-indigo-500 bg-indigo-950/40 ring-1 ring-indigo-500'
                        : 'border-slate-800 bg-slate-950/50 hover:border-slate-700'
                    }`}
                  >
                    <h4 className="font-bold text-white">{c.title}</h4>
                    <p className="mt-1 text-[11px] leading-relaxed text-slate-400">{c.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Target Core Sleep Hours */}
          <div className="space-y-2 border-t border-slate-800 pt-4">
            <div className="flex items-center justify-between">
              <label className="font-bold uppercase tracking-wider text-slate-300">
                Target Core Sleep Duration
              </label>
              <span className="font-mono font-bold text-indigo-400 text-sm">
                {preferences.targetSleepHours} Hours
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Recommended by NASA & ICAO: 7.5 to 8.5 hours for flight crews on active multi-sector rotations.
            </p>

            <div className="flex items-center gap-2">
              {[6.5, 7.0, 7.5, 8.0, 8.5].map((hrs) => (
                <button
                  key={hrs}
                  onClick={() => onUpdatePreferences({ targetSleepHours: hrs })}
                  className={`flex-1 rounded-lg py-2 font-mono font-semibold transition-all ${
                    preferences.targetSleepHours === hrs
                      ? 'bg-indigo-600 text-white shadow'
                      : 'bg-slate-950 border border-slate-800 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  {hrs}h
                </button>
              ))}
            </div>
          </div>

          {/* 3. Pre-Flight Departure Routine Buffers */}
          <div className="space-y-3 border-t border-slate-800 pt-4">
            <div className="flex items-center justify-between">
              <label className="font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-sky-400" /> Pre-Flight Departure Buffers
              </label>
              <span className="text-[11px] text-slate-400">Total buffer: {preferences.groomingMinutes + preferences.cabBufferMinutes}m before check-in</span>
            </div>
            <p className="text-[11px] text-slate-400">
              Customize your grooming and cab transit time from reporting time to automatically compute your exact wake-up alarm and cab arrival.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-300 font-bold">1. Grooming & Prep Time</span>
                  <span className="font-mono font-bold text-sky-400">{preferences.groomingMinutes} min</span>
                </div>
                <p className="text-[10px] text-slate-400">Time needed from wake-up to walking out the door (shower, uniform, makeup, coffee).</p>
                <div className="flex items-center gap-1.5 pt-1">
                  {[30, 45, 60, 75, 90].map((m) => (
                    <button
                      key={m}
                      onClick={() => onUpdatePreferences({ groomingMinutes: m })}
                      className={`flex-1 rounded py-1 font-mono text-[11px] font-semibold transition-colors ${
                        preferences.groomingMinutes === m
                          ? 'bg-sky-600 text-white'
                          : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {m}m
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-300 font-bold">2. Cab Transit to Base</span>
                  <span className="font-mono font-bold text-amber-400">{preferences.cabBufferMinutes} min</span>
                </div>
                <p className="text-[10px] text-slate-400">Time from airline cab pickup at your door until reporting at the airport briefing room.</p>
                <div className="flex items-center gap-1.5 pt-1">
                  {[30, 45, 60, 75, 90].map((m) => (
                    <button
                      key={m}
                      onClick={() => onUpdatePreferences({ cabBufferMinutes: m })}
                      className={`flex-1 rounded py-1 font-mono text-[11px] font-semibold transition-colors ${
                        preferences.cabBufferMinutes === m
                          ? 'bg-amber-600 text-white'
                          : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {m}m
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* 4. Caffeine Cutoff Sensitivity */}
          <div className="space-y-2 border-t border-slate-800 pt-4">
            <label className="font-bold uppercase tracking-wider text-slate-300">
              Caffeine Clearance Buffer
            </label>
            <p className="text-[11px] text-slate-400">
              Hours prior to sleep when all coffee, cola, and black tea must stop.
            </p>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => onUpdatePreferences({ caffeineCutoffHours: 6 })}
                className={`rounded-xl border p-3 text-left transition-all ${
                  preferences.caffeineCutoffHours === 6
                    ? 'border-indigo-500 bg-indigo-950/40 ring-1 ring-indigo-500'
                    : 'border-slate-800 bg-slate-950/50 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold text-white">
                  <Coffee className="h-4 w-4 text-amber-400" /> Standard Buffer (6 Hours)
                </div>
                <p className="mt-1 text-[11px] text-slate-400">Average adult caffeine hepatic half-life clearance.</p>
              </button>

              <button
                onClick={() => onUpdatePreferences({ caffeineCutoffHours: 8 })}
                className={`rounded-xl border p-3 text-left transition-all ${
                  preferences.caffeineCutoffHours === 8
                    ? 'border-indigo-500 bg-indigo-950/40 ring-1 ring-indigo-500'
                    : 'border-slate-800 bg-slate-950/50 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold text-white">
                  <Coffee className="h-4 w-4 text-red-400" /> Sensitive Buffer (8 Hours)
                </div>
                <p className="mt-1 text-[11px] text-slate-400">Slow caffeine metabolizer or easily fragmented sleep.</p>
              </button>
            </div>
          </div>

          {/* 5. Remuneration & Crew Seniority Settings */}
          <div className="space-y-3 border-t border-slate-800 pt-4">
            <label className="font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-emerald-400" /> Compensation & Rank Settings
            </label>
            <p className="text-[11px] text-slate-400">
              Select your seniority rank or input custom contractual hourly rates to accurately estimate your upcoming monthly payout.
            </p>

            <div className="grid grid-cols-3 gap-2.5">
              {[
                { rank: 'junior', label: 'Junior Crew', desc: 'Base + standard flying allowance' },
                { rank: 'senior', label: 'Senior Crew', desc: 'Standard line FA with night bonus' },
                { rank: 'lead', label: 'Lead / IFM', desc: 'In-flight manager senior rate' },
              ].map((item) => (
                <button
                  key={item.rank}
                  onClick={() => onUpdatePreferences({ crewRank: item.rank as any })}
                  className={`rounded-xl border p-2.5 text-left transition-all ${
                    preferences.crewRank === item.rank
                      ? 'border-emerald-500 bg-emerald-950/40 ring-1 ring-emerald-500'
                      : 'border-slate-800 bg-slate-950/50 hover:border-slate-700'
                  }`}
                >
                  <p className="font-bold text-white text-xs">{item.label}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{item.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* 4. Operational Delay Simulation */}
          {onSimulateDelay && roster.flights.length > 0 && (
            <div className="space-y-2 border-t border-slate-800 pt-4">
              <label className="font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-amber-400" /> Simulate Flight Delay
              </label>
              <p className="text-[11px] text-slate-400">
                Airlines often face ground delays. See how your rest windows dynamically adjust:
              </p>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => onSimulateDelay(roster.flights[0].id, 60)}
                  className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs font-semibold text-amber-300 hover:bg-slate-800 transition-colors"
                >
                  +1h Delay on Leg 1 ({roster.flights[0].flightNumber})
                </button>
                <button
                  onClick={() => onSimulateDelay(roster.flights[0].id, 120)}
                  className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs font-semibold text-amber-300 hover:bg-slate-800 transition-colors"
                >
                  +2h Delay
                </button>
                <button
                  onClick={() => onSimulateDelay(roster.flights[0].id, 0)}
                  className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs font-semibold text-slate-400 hover:bg-slate-800 transition-colors"
                >
                  Reset Delays
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-end border-t border-slate-800 pt-4">
          <button
            onClick={onClose}
            className="rounded-xl bg-indigo-600 px-5 py-2 text-xs font-semibold text-white shadow-md shadow-indigo-600/20 hover:bg-indigo-500 transition-all"
          >
            Apply & Recalculate Schedule
          </button>
        </div>
      </div>
    </div>
  );
};
