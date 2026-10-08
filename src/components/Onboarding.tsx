import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, Compass } from 'lucide-react';
import { CrewPreferences } from '../types/circadian';
import { getAirportTzOffset, lookupAirport } from '../data/airports';
import { CAFFEINE_CHOICES, UsualSleep } from './SleepSettings';
import { CAFFEINE_HOURS } from '../services/planEngine';

/**
 * First-run set-up: five short steps, each one a setting the plan actually uses. Everything can be changed
 * later in Settings. Shown on a first visit and after "Delete all my data", never to someone with saved data.
 */

interface Props {
  preferences: CrewPreferences;
  onUpdatePreferences: (updated: Partial<CrewPreferences>) => void;
  onChangeHomeBase: (iata: string, tzOffset: number) => void;
  /** Finished: go to Rosters to upload, or straight to Today. */
  onFinish: (next: 'upload' | 'today') => void;
}

const BASES = ['DEL', 'BOM', 'BLR', 'HYD', 'MAA', 'CCU', 'AMD', 'PNQ', 'COK', 'GOI', 'DXB', 'AUH', 'DOH'];
const MINUTES = [30, 45, 60, 75, 90, 120];
const STEPS = 5;

const choice = (on: boolean) =>
  `rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${on ? 'bg-blue-600 text-white' : 'border border-slate-700 bg-slate-900 text-slate-300 hover:text-white'}`;

export const Onboarding: React.FC<Props> = ({ preferences, onUpdatePreferences, onChangeHomeBase, onFinish }) => {
  const [step, setStep] = useState(0);
  const [other, setOther] = useState('');
  const otherAirport = other.length === 3 ? lookupAirport(other) : undefined;
  const setBase = (iata: string) => onChangeHomeBase(iata, getAirportTzOffset(iata, new Date()) ?? 5.5);
  const dose = preferences.caffeineDose ?? 'light';

  const body = [
    <div key="welcome" className="space-y-3">
      <h2 className="text-2xl font-bold text-white">Rest that fits your roster</h2>
      <p className="text-slate-300">
        Upload your roster and check it once. CrewCircadian then shows when to sleep, nap, have caffeine and eat around every duty, with the reason
        for each suggestion.
      </p>
      <ul className="space-y-1.5 text-sm text-slate-300">
        <li>• Times from your roster (wake-up, leave home, check-in) are exact.</li>
        <li>• Body-clock advice is a guide; everyone is a little different.</li>
        <li>• Your roster and plan stay on this device. A roster image is sent to Google Gemini only to be read, and only if you allow it.</li>
      </ul>
      <p className="rounded-lg border border-amber-800/60 bg-amber-950/30 p-3 text-sm text-amber-100">
        If you feel fatigued, follow your airline's fatigue procedure, whatever this app shows. CrewCircadian is a wellness guide, not a medical
        device, and does not assess fitness for duty.
      </p>
    </div>,

    <div key="base" className="space-y-3">
      <h2 className="text-xl font-bold text-white">Where are you based?</h2>
      <p className="text-sm text-slate-400">Your plan runs on your home base's time.</p>
      <div className="flex flex-wrap gap-2">
        {BASES.map((b) => (
          <button key={b} onClick={() => setBase(b)} aria-pressed={preferences.homeBaseIata === b} className={choice(preferences.homeBaseIata === b)}>
            {b}
          </button>
        ))}
      </div>
      <label className="flex flex-wrap items-center gap-2 text-sm text-slate-300">
        Another airport code
        <input
          value={other}
          maxLength={3}
          onChange={(e) => {
            const v = e.target.value.toUpperCase().replace(/[^A-Z]/g, '');
            setOther(v);
            if (v.length === 3 && lookupAirport(v)) setBase(v);
          }}
          placeholder="e.g. JAI"
          aria-label="Home base airport code"
          className="w-24 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 font-mono uppercase text-white"
        />
        {other.length === 3 && <span className={otherAirport ? 'text-emerald-300' : 'text-rose-300'}>{otherAirport ? otherAirport.city : 'Not found'}</span>}
      </label>
      <p className="text-sm text-slate-300">
        Home base: <strong className="text-white">{lookupAirport(preferences.homeBaseIata)?.city ?? preferences.homeBaseIata}</strong> ({preferences.homeBaseIata})
      </p>
    </div>,

    <div key="work" className="space-y-4">
      <h2 className="text-xl font-bold text-white">Getting to work</h2>
      <p className="text-sm text-slate-400">Used to work out your wake-up and leave-home times from each check-in.</p>
      {(
        [
          ['groomingMinutes', 'Time to get ready (wake-up to leaving home)'],
          ['cabBufferMinutes', 'Travel to the airport, including traffic'],
        ] as const
      ).map(([key, label]) => (
        <div key={key} className="space-y-2">
          <p className="text-sm font-semibold text-slate-200">{label}</p>
          <div className="flex flex-wrap gap-2">
            {MINUTES.map((m) => (
              <button key={m} onClick={() => onUpdatePreferences({ [key]: m })} aria-pressed={preferences[key] === m} className={choice(preferences[key] === m)}>
                {m} min
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>,

    <div key="sleep" className="space-y-3">
      <h2 className="text-xl font-bold text-white">Your sleep and caffeine</h2>
      <UsualSleep preferences={preferences} onUpdatePreferences={onUpdatePreferences} />
      <div className="space-y-2">
        <p className="text-sm font-semibold text-slate-200">How much caffeine do you usually have?</p>
        <div className="grid gap-2">
          {CAFFEINE_CHOICES.map((c) => (
            <button
              key={c.dose}
              onClick={() => onUpdatePreferences({ caffeineDose: c.dose, caffeineCutoffHours: CAFFEINE_HOURS[c.dose] })}
              aria-pressed={dose === c.dose}
              className={`${choice(dose === c.dose)} flex justify-between text-left`}
            >
              <span>{c.label}</span>
              <span className="font-mono text-xs">stop {CAFFEINE_HOURS[c.dose]} h before sleep</span>
            </button>
          ))}
        </div>
      </div>
    </div>,

    <div key="done" className="space-y-3">
      <h2 className="text-xl font-bold text-white">Now add your roster</h2>
      <p className="text-slate-300">
        Upload a screenshot or PDF of your roster, or paste its text. You'll check what was read, day by day, before anything is saved.
      </p>
      <p className="text-sm text-slate-400">You can change any of these answers later in Settings.</p>
    </div>,
  ];

  const finish = (next: 'upload' | 'today') => {
    onUpdatePreferences({ onboarding: 'done', caffeineDose: dose, caffeineCutoffHours: CAFFEINE_HOURS[dose] });
    onFinish(next);
  };

  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto bg-slate-950" role="dialog" aria-modal="true" aria-label="Set up CrewCircadian">
      <div className="mx-auto flex min-h-full max-w-xl flex-col gap-6 px-5 pb-[max(2.5rem,calc(env(safe-area-inset-bottom)+1rem))] pt-[calc(env(safe-area-inset-top)+1.5rem)]">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 font-bold text-white">
            <Compass className="h-5 w-5 text-blue-400" /> CrewCircadian
          </span>
          <span className="text-xs text-slate-500" aria-live="polite">
            Step {step + 1} of {STEPS}
          </span>
        </div>
        <div className="h-1 rounded-full bg-slate-800" aria-hidden>
          <div className="h-1 rounded-full bg-blue-500 transition-all" style={{ width: `${((step + 1) / STEPS) * 100}%` }} />
        </div>

        <div className="flex-1">{body[step]}</div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          {step > 0 ? (
            <button onClick={() => setStep(step - 1)} className="inline-flex items-center gap-1 text-sm font-semibold text-slate-400 hover:text-white">
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
          ) : (
            <span />
          )}
          {step < STEPS - 1 ? (
            <button onClick={() => setStep(step + 1)} className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-5 py-2.5 font-semibold text-white hover:bg-blue-500">
              {step === 0 ? 'Get started' : 'Next'} <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <div className="flex flex-wrap gap-2">
              <button onClick={() => finish('today')} className="rounded-xl border border-slate-700 px-4 py-2.5 font-semibold text-slate-300 hover:text-white">
                Not now
              </button>
              <button onClick={() => finish('upload')} className="rounded-xl bg-blue-600 px-5 py-2.5 font-semibold text-white hover:bg-blue-500">
                Add my roster
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
