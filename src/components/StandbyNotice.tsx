import React from 'react';
import { CircadianEvent } from '../types/circadian';

/** Shows the standby periods for a day, if any. */
export const StandbyNotice: React.FC<{ events: CircadianEvent[]; onSelectEvent: (e: CircadianEvent) => void }> = ({
  events,
  onSelectEvent,
}) => {
  const standby = events.filter((e) => e.type === 'standby');
  if (standby.length === 0) return null;
  return (
    <div className="space-y-2">
      {standby.map((e) => (
        <button
          key={e.id}
          onClick={() => onSelectEvent(e)}
          className="w-full rounded-2xl border border-purple-800/60 bg-purple-950/20 p-4 text-left text-xs hover:border-purple-700"
        >
          <p className="text-sm font-bold text-white">
            {e.title} · {e.startHbtStr}–{e.endHbtStr}
          </p>
          <p className="mt-1 text-slate-300">{e.subtitle}</p>
        </button>
      ))}
    </div>
  );
};
