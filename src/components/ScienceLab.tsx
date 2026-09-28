import React, { useState } from 'react';
import { BookOpen, ShieldCheck, Zap, Moon, Utensils, SunDim, Award, ExternalLink, X } from 'lucide-react';

interface ScienceLabProps {
  onClose?: () => void;
  initialTopic?: string;
}

export const ScienceLab: React.FC<ScienceLabProps> = ({ onClose, initialTopic }) => {
  const [activeTab, setActiveTab] = useState<'nasa' | 'chrono' | 'icao' | 'light'>('nasa');

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4 sm:p-6 shadow-2xl backdrop-blur-md">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20">
            <BookOpen className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white sm:text-lg">
              Aero-Medical & Circadian Science Hub
            </h3>
            <p className="text-xs text-slate-400">
              The peer-reviewed clinical research and aviation safety manuals powering CrewCircadian
            </p>
          </div>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Navigation Pills */}
      <div className="mt-4 flex flex-wrap gap-2 border-b border-slate-800 pb-3">
        {[
          { id: 'nasa', label: '🚀 NASA Ames Countermeasures', icon: <Zap className="h-3.5 w-3.5" /> },
          { id: 'chrono', label: '🥗 Salk Chrono-Nutrition', icon: <Utensils className="h-3.5 w-3.5" /> },
          { id: 'icao', label: '✈️ ICAO & FAA FRMS (WOCL)', icon: <ShieldCheck className="h-3.5 w-3.5" /> },
          { id: 'light', label: '🕶️ Photobiology & Melatonin', icon: <SunDim className="h-3.5 w-3.5" /> },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
              activeTab === tab.id
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                : 'bg-slate-950 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="mt-5 space-y-6">
        {/* 1. NASA Ames Fatigue Countermeasures */}
        {activeTab === 'nasa' && (
          <div className="space-y-4">
            <div className="rounded-xl border border-blue-900/40 bg-blue-950/20 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-blue-400">
                  NASA Ames Research Center • Cockpit Controlled Rest Program
                </span>
                <span className="rounded bg-blue-500/20 px-2 py-0.5 text-[10px] font-bold text-blue-300">
                  Pioneered by Dr. Mark Rosekind & Dr. David Dinges
                </span>
              </div>
              <h4 className="mt-2 text-sm font-bold text-white">
                The 26-Minute Power Nap Discovery
              </h4>
              <p className="mt-1 text-xs leading-relaxed text-slate-300">
                In NASA's landmark study of long-haul commercial flight crews, a planned 26-minute nap was found to improve physiological alertness by <strong>54%</strong> and cognitive psychomotor vigilance performance by <strong>34%</strong> compared to no-rest crews.
              </p>
            </div>

            {/* Why 26 minutes and not 45? */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                <h5 className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                  <Moon className="h-4 w-4" /> Why Not 45 or 60 Minutes?
                </h5>
                <p className="mt-2 text-xs leading-relaxed text-slate-300">
                  Around minute 30–35, the human brain enters Stage 3/4 Slow-Wave Sleep (Delta waves). If an alarm wakes you from slow-wave sleep, you suffer severe <strong>Sleep Inertia</strong> (cognitive grogginess, disorientation, and slow reflexes lasting 20–45 minutes).
                </p>
                <div className="mt-3 rounded bg-slate-900 p-2 text-[11px] font-mono text-slate-400 border border-slate-800">
                  Rule: Either cap nap at &lt;30 mins OR commit to a full 90-minute sleep cycle.
                </div>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                <h5 className="text-xs font-bold text-indigo-400 flex items-center gap-1.5">
                  <Award className="h-4 w-4" /> Sleep Banking Before Intense Rosters
                </h5>
                <p className="mt-2 text-xs leading-relaxed text-slate-300">
                  Research from the Walter Reed Army Institute of Research proved that sleeping 8.5–9 hours per night for 2–3 days preceding an irregular duty cycle buffers against subsequent acute sleep restriction, reducing cognitive lapses by up to 40%.
                </p>
                <div className="mt-3 rounded bg-slate-900 p-2 text-[11px] font-mono text-slate-400 border border-slate-800">
                  Cabin Crew Tip: Bank extra sleep on days off before early or red-eye rosters.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 2. Chrono-Nutrition & Salk Institute */}
        {activeTab === 'chrono' && (
          <div className="space-y-4">
            <div className="rounded-xl border border-emerald-900/40 bg-emerald-950/20 p-4">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                Salk Institute for Biological Studies • Dr. Satchin Panda Laboratory
              </span>
              <h4 className="mt-2 text-sm font-bold text-white">
                Master Clock vs. Peripheral Metabolic Clocks
              </h4>
              <p className="mt-1 text-xs leading-relaxed text-slate-300">
                While the brain's master clock (SCN) is set by light, the <strong>peripheral clocks in your liver, pancreas, stomach, and gut are set by meal timing</strong>. When cabin crew eat heavy carbohydrate meals in the galley at 03:00 AM, the digestive tract is forced awake while the brain is in deep nocturnal mode, triggering metabolic misalignment.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-3.5">
                <h5 className="text-xs font-bold text-amber-400">Pancreas & Insulin</h5>
                <p className="mt-1.5 text-xs text-slate-300 leading-relaxed">
                  Insulin sensitivity drops dramatically at biological night. The exact same meal eaten at 02:00 AM produces twice the blood glucose spike compared to noon.
                </p>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950 p-3.5">
                <h5 className="text-xs font-bold text-teal-400">Gastric Motility & Pressure</h5>
                <p className="mt-1.5 text-xs text-slate-300 leading-relaxed">
                  Stomach emptying slows by &gt;50% at night. At 8,000 ft cabin altitude, gastrointestinal gas expands by 25% (Boyle's Law), causing sharp bloating and discomfort.
                </p>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950 p-3.5">
                <h5 className="text-xs font-bold text-emerald-400">10-Hour Eating Window</h5>
                <p className="mt-1.5 text-xs text-slate-300 leading-relaxed">
                  Consuming all major calories in an 8–10 hour daytime window stabilizes circadian genes, sustains immune function, and protects cardiovascular health in shift workers.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 3. ICAO & FAA FRMS Regulations */}
        {activeTab === 'icao' && (
          <div className="space-y-4">
            <div className="rounded-xl border border-purple-900/40 bg-purple-950/20 p-4">
              <span className="text-xs font-bold uppercase tracking-wider text-purple-400">
                ICAO Doc 9966 & FAA Part 117 / EASA FTL
              </span>
              <h4 className="mt-2 text-sm font-bold text-white">
                The Window of Circadian Low (WOCL: 02:00 – 05:59)
              </h4>
              <p className="mt-1 text-xs leading-relaxed text-slate-300">
                WOCL is the physiological trough where core body temperature reaches its lowest point and sleep propensity reaches absolute peak. Airline accident statistics demonstrate that human error vulnerability multiplies substantially when duties encroach into this biological window.
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
              <h5 className="text-xs font-bold text-white">The 36-Hour Layover Rule (Home Base Time Pinning)</h5>
              <p className="mt-2 text-xs leading-relaxed text-slate-300">
                The human body adjusts to a new time zone at an average rate of only <strong>1 hour per day</strong>. If an IndiGo or Emirates crew member has a 24–30 hour layover in Singapore, Dubai, or London, attempting to shift to local time creates two back-to-back circadian shocks.
              </p>
              <div className="mt-3 rounded bg-blue-950/30 p-2.5 text-xs text-blue-300 border border-blue-800/40">
                <strong>Our Recommendation:</strong> For any layover under 36 hours, maintain sleep and nutrition pinned as closely as possible to Home Base Time (HBT).
              </div>
            </div>
          </div>
        )}

        {/* 4. Photobiology & Melatonin Management */}
        {activeTab === 'light' && (
          <div className="space-y-4">
            <div className="rounded-xl border border-amber-900/40 bg-amber-950/20 p-4">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                Photobiology & Ocular Light Hygiene
              </span>
              <h4 className="mt-2 text-sm font-bold text-white">
                The Melatonin Shield (Dark Sunglasses Protocol)
              </h4>
              <p className="mt-1 text-xs leading-relaxed text-slate-300">
                Intrinsically photosensitive retinal ganglion cells (ipRGCs) containing melanopsin are ultra-sensitive to blue-sky wavelengths (460–480 nm). If you finish an all-night flight and step out into bright morning sunshine on your way home, sunlight immediately halts pineal melatonin production and delays your biological clock.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                <h5 className="text-xs font-bold text-slate-200">🕶️ Leaving the Airport After Red-Eye</h5>
                <p className="mt-2 text-xs leading-relaxed text-slate-400">
                  Put on dark, wrap-around polarized sunglasses before exiting the terminal. Keep them on throughout your drive/commute until you are safely inside a pitch-black hotel room or bedroom.
                </p>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                <h5 className="text-xs font-bold text-yellow-300">☀️ When Shifting Timezones (Long Layovers)</h5>
                <p className="mt-2 text-xs leading-relaxed text-slate-400">
                  If staying &gt;48 hours at destination, step outside for 20–30 minutes of natural outdoor sunlight between 08:00 and 10:00 local morning time to anchor your new day-phase.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
