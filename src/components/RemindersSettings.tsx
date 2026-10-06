import React from 'react';
import { BellRing } from 'lucide-react';
import { CircadianPlan, CrewPreferences } from '../types/circadian';
import { planReminders, ReminderKind } from '../services/reminders';
import { rosterClock } from '../services/rosterKeys';
import { isNativeApp } from '../services/platform';

/** Reminders and alarms: all off until switched on, with a preview of the next few. */

interface Props {
  plan: CircadianPlan;
  preferences: CrewPreferences;
  onUpdatePreferences: (updated: Partial<CrewPreferences>) => void;
}

const KINDS: { kind: ReminderKind; label: string; note: string }[] = [
  { kind: 'wake', label: 'Wake-up alarm before each duty', note: 'Rings even in Silent mode where your phone allows. Keep a second alarm too.' },
  { kind: 'leave', label: 'Time to leave', note: '10 minutes before you need to leave home or the hotel.' },
  { kind: 'bedtime', label: 'Wind down before sleep', note: '30 minutes before a planned sleep.' },
  { kind: 'caffeine', label: 'Last caffeine', note: 'When your caffeine cut-off starts.' },
];

export const RemindersSettings: React.FC<Props> = ({ plan, preferences, onUpdatePreferences }) => {
  const settings = preferences.reminders ?? {};
  const upcoming = planReminders(plan, settings, Date.now()).slice(0, 4);
  const clock = rosterClock(plan.roster);
  const native = isNativeApp();
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 space-y-3">
      <div>
        <span className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider text-slate-300">
          <BellRing className="h-4 w-4 text-sky-400" /> Reminders and alarms
        </span>
        <p className="mt-0.5 text-[11px] text-slate-400">
          Off unless you switch them on. Never during a planned sleep.{' '}
          {native ? '' : 'They ring in the CrewCircadian phone app; in a web browser they are only listed here.'}
        </p>
      </div>
      <div className="space-y-2">
        {KINDS.map(({ kind, label, note }) => (
          <label key={kind} className="flex cursor-pointer items-start gap-3 text-sm text-slate-200">
            <input
              type="checkbox"
              checked={!!settings[kind]}
              onChange={(e) => onUpdatePreferences({ reminders: { ...settings, [kind]: e.target.checked } })}
              className="mt-1 h-4 w-4 accent-sky-500"
            />
            <span>
              {label}
              <span className="block text-[11px] text-slate-400">{note}</span>
            </span>
          </label>
        ))}
      </div>
      {upcoming.length > 0 && (
        <div className="border-t border-slate-800 pt-2 text-xs text-slate-300">
          <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">Coming up (home time)</p>
          <ul className="space-y-0.5">
            {upcoming.map((r) => (
              <li key={r.id} className="flex gap-2">
                <span className="w-24 shrink-0 font-mono text-slate-400">
                  {new Date(`${clock.date(Date.parse(r.atUtc))}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' })}{' '}
                  {clock.time(Date.parse(r.atUtc))}
                </span>
                <span>{r.title}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
