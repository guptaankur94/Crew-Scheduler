import React, { useState } from 'react';
import { CaffeineDose, CrewPreferences } from '../types/circadian';
import { TimeInput24 } from './TimeInput24';

/** Sleep and caffeine settings shared by Settings and the first-run set-up. */

export const CAFFEINE_CHOICES: { dose: CaffeineDose; label: string }[] = [
  { dose: 'light', label: 'One coffee, or a few cups of chai or tea' },
  { dose: 'moderate', label: 'Two coffees' },
  { dose: 'strong', label: 'Three or more coffees, or energy drinks' },
];

/** Usual bedtime and wake-up on normal nights; the time between them is the sleep the plan aims for. */
export const UsualSleep: React.FC<{ preferences: CrewPreferences; onUpdatePreferences: (u: Partial<CrewPreferences>) => void }> = ({ preferences, onUpdatePreferences }) => {
  const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  const fmt = (min: number) => `${String(Math.floor((((min % 1440) + 1440) % 1440) / 60)).padStart(2, '0')}:${String((((min % 1440) + 1440) % 1440) % 60).padStart(2, '0')}`;
  const defaultBed = Math.round((23 + ({ lark: -0.75, intermediate: 0, owl: 0.75 }[preferences.chronotype] ?? 0)) * 60);
  const [bed, setBed] = useState(preferences.usualBedtime ?? fmt(defaultBed));
  const [wake, setWake] = useState(preferences.usualWakeTime ?? fmt(defaultBed + preferences.targetSleepHours * 60));
  const valid = (t: string) => /^\d{2}:\d{2}$/.test(t) && Number(t.slice(0, 2)) < 24 && Number(t.slice(3)) < 60;
  const duration = valid(bed) && valid(wake) ? (toMin(wake) - toMin(bed) + 1440) % 1440 : null;
  const ok = duration !== null && duration >= 4 * 60 && duration <= 12 * 60;
  const save = (b: string, w: string) => {
    const d = valid(b) && valid(w) ? (toMin(w) - toMin(b) + 1440) % 1440 : null;
    if (d === null || d < 4 * 60 || d > 12 * 60) return;
    onUpdatePreferences({ usualBedtime: b, usualWakeTime: w, targetSleepHours: Math.round((d / 60) * 4) / 4 });
  };
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 space-y-2">
      <span className="font-bold text-xs uppercase text-slate-300">Your usual sleep</span>
      <div className="flex flex-wrap items-end gap-3">
        <label className="space-y-1 text-[11px] text-slate-400">
          <span className="block">Bedtime</span>
          <TimeInput24 value={bed} onChange={(v) => { setBed(v); save(v, wake); }} ariaLabel="Usual bedtime" className="w-20 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 font-mono text-sm text-white" />
        </label>
        <span className={`pb-2 font-mono text-sm ${ok ? 'text-purple-300' : 'text-rose-300'}`}>
          {duration === null ? '–' : `${Math.floor(duration / 60)} h ${String(duration % 60).padStart(2, '0')} min`}
        </span>
        <label className="space-y-1 text-[11px] text-slate-400">
          <span className="block">Wake up</span>
          <TimeInput24 value={wake} onChange={(v) => { setWake(v); save(bed, v); }} ariaLabel="Usual wake-up time" className="w-20 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 font-mono text-sm text-white" />
        </label>
      </div>
      <p className="text-[11px] text-slate-400">
        {ok ? 'Used on nights without an early start or a duty. Most adults need about 7 hours or more.' : 'Choose between 4 and 12 hours of sleep.'}
      </p>
    </div>
  );
};
