import React, { useEffect, useState } from 'react';
import { CircadianEvent, CircadianPlan } from '../types/circadian';
import { getNowNext, hasLocalTime, nextLine, nowLine } from '../services/nowNext';
import { Info } from 'lucide-react';

interface NowNextCardProps {
  plan: CircadianPlan;
  onSelectEvent: (event: CircadianEvent) => void;
}

function untilText(ms: number): string {
  const minutes = Math.max(0, Math.round(ms / 60000));
  if (minutes < 60) return `in ${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `in ${h}h ${m}m` : `in ${h}h`;
}

/** At-a-glance summary at the top of Today: what matters now, and what comes next. */
export const NowNextCard: React.FC<NowNextCardProps> = ({ plan, onSelectEvent }) => {
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  const { now, next } = getNowNext(plan, nowMs);
  if (!now && !next) return null;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <button
        onClick={() => now && onSelectEvent(now)}
        disabled={!now}
        className="rounded-2xl border border-slate-800 bg-slate-900 p-4 text-left transition-colors hover:border-slate-700 disabled:hover:border-slate-800"
      >
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Now</span>
        {now ? (
          <>
            <p className="mt-1 text-base font-bold text-white">{nowLine(now)}</p>
            <p className="mt-0.5 text-xs text-slate-400">
              Until {now.endHbtStr}
              {hasLocalTime(now) && <span className="text-slate-500"> ({now.endLocalStr} local)</span>}
            </p>
          </>
        ) : (
          <>
            <p className="mt-1 text-base font-bold text-white">Free time</p>
            <p className="mt-0.5 text-xs text-slate-400">Nothing planned right now.</p>
          </>
        )}
        {now && (
          <span className="mt-2 inline-flex items-center gap-1 text-[11px] text-slate-500">
            <Info className="h-3 w-3" /> Tap for why
          </span>
        )}
      </button>

      {next && (
        <button
          onClick={() => onSelectEvent(next)}
          className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-left transition-colors hover:border-slate-700"
        >
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Next · {next.startHbtStr} · {untilText(Date.parse(next.startUtc) - nowMs)}
          </span>
          <p className="mt-1 text-base font-bold text-white">{nextLine(next)}</p>
          <p className="mt-0.5 text-xs text-slate-400 line-clamp-2">{next.subtitle}</p>
          <span className="mt-2 inline-flex items-center gap-1 text-[11px] text-slate-500">
            <Info className="h-3 w-3" /> Tap for why
          </span>
        </button>
      )}
    </div>
  );
};
