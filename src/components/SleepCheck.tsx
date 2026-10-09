import React, { useState } from 'react';
import { CircadianPlan, CrewPreferences } from '../types/circadian';

/*
 * "Did you get this sleep?" One tap after a planned sleep ends, asked once. No scores and no streaks. A short
 * sleep (partly or no) asks roughly how long, and tonight's bedtime then moves a little earlier (the same rule as
 * "How did you sleep last night?" in Settings).
 */

interface Props {
  plan: CircadianPlan;
  nowMs: number;
  onUpdatePreferences: (updated: Partial<CrewPreferences>) => void;
}

const ASK_WITHIN_HOURS = 14;
const KEEP = 60;

export const SleepCheck: React.FC<Props> = ({ plan, nowMs, onUpdatePreferences }) => {
  const [stage, setStage] = useState<'ask' | 'hours' | 'done'>('ask');
  const answers = plan.preferences.sleepFeedback ?? {};
  // The planned main sleep that ended most recently, within the last 14 hours
  const sleep = plan.events
    .filter((e) => (e.type === 'anchor_sleep' || e.type === 'recovery_sleep') && Date.parse(e.endUtc) <= nowMs && nowMs - Date.parse(e.endUtc) < ASK_WITHIN_HOURS * 3600000)
    .sort((a, b) => b.endUtc.localeCompare(a.endUtc))[0];
  if (!sleep || (answers[sleep.startUtc] && stage !== 'done') || (stage === 'done' && !answers[sleep.startUtc])) return null;

  const save = (answer: 'yes' | 'partly' | 'no', extra: Partial<CrewPreferences> = {}) => {
    const kept = Object.entries({ ...answers, [sleep.startUtc]: answer }).sort(([a], [b]) => b.localeCompare(a)).slice(0, KEEP);
    onUpdatePreferences({ sleepFeedback: Object.fromEntries(kept), ...extra });
    setStage('done');
  };

  if (stage === 'done') {
    return (
      <p className="rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-sm text-slate-300">
        Thanks. {answers[sleep.startUtc] === 'yes' ? 'Noted.' : 'Tonight\'s bedtime moves a little earlier to help you catch up.'}
      </p>
    );
  }

  return (
    <section aria-label="Did you get this sleep?" className="space-y-2 rounded-xl border border-indigo-900/50 bg-indigo-950/20 px-4 py-3 text-sm">
      {stage === 'ask' ? (
        <>
          <p className="text-slate-200">
            Did you get your planned sleep ({sleep.startHbtStr}–{sleep.endHbtStr})?
          </p>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => save('yes')} className="rounded-lg border border-slate-700 px-3 py-1.5 font-semibold text-slate-200 hover:border-slate-500">
              Yes
            </button>
            <button onClick={() => setStage('hours')} className="rounded-lg border border-slate-700 px-3 py-1.5 font-semibold text-slate-200 hover:border-slate-500">
              Partly
            </button>
            <button onClick={() => setStage('hours')} className="rounded-lg border border-slate-700 px-3 py-1.5 font-semibold text-slate-200 hover:border-slate-500">
              No
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="text-slate-200">Roughly how many hours did you sleep?</p>
          <div className="flex flex-wrap gap-2">
            {[3, 4, 5, 6].map((h) => (
              <button
                key={h}
                onClick={() => save(h <= 4 ? 'no' : 'partly', { actualLastSleepHours: h, actualLastSleepLoggedAt: new Date(nowMs).toISOString() })}
                className="rounded-lg border border-slate-700 px-3 py-1.5 font-semibold text-slate-200 hover:border-slate-500"
              >
                {h === 3 ? '3 or less' : `${h} h`}
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  );
};
