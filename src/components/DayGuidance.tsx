import React from 'react';
import { AlertTriangle, Coffee, HelpCircle, Sun, Utensils, XCircle } from 'lucide-react';
import { CircadianEvent, PrepDetails } from '../types/circadian';

/** The Days screen's guidance cards: meals and caffeine, and the notes below them (good to know, light, night duty). */

interface Props {
  nutritionEvents: CircadianEvent[];
  caffeineEvents: CircadianEvent[];
  prepDetails?: PrepDetails;
  isOffDay?: boolean;
  selectedDate: string;
  onSelectEvent: (event: CircadianEvent) => void;
}

/** Meals and Caffeine: two cards in the day's grid. */
export const MealsAndCaffeine: React.FC<Props> = ({
  nutritionEvents,
  caffeineEvents,
  prepDetails,
  isOffDay,
  selectedDate,
  onSelectEvent,
}) => (
  <>
    {/* Pillar 3: Meals */}
    <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4 space-y-3">
      <div className="flex items-center justify-between border-b border-slate-800/60 pb-2">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
            <Utensils className="h-3.5 w-3.5" />
          </div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">Meals</h3>
        </div>
      </div>

      <div className="space-y-2.5">
        {nutritionEvents.length === 0 ? (
          <p className="py-4 text-center text-xs text-slate-500">Your usual daytime meals.</p>
        ) : (
          nutritionEvents.map((event) => (
            <div key={event.id} className="rounded-xl border border-emerald-900/30 bg-emerald-950/15 p-3 text-xs space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-bold text-white">{event.title}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">{event.subtitle}</p>
                </div>

                <div className="text-right shrink-0">
                  <span className="font-mono text-xs font-extrabold text-emerald-200">
                    {event.startHbtStr} – {event.endHbtStr}
                  </span>
                  <p className="text-[10px] text-slate-500">Home time</p>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-emerald-900/20 pt-2 text-[11px]">
                <button
                  onClick={() => onSelectEvent(event)}
                  className="flex items-center gap-1 text-slate-400 hover:text-emerald-300 transition-colors"
                >
                  <HelpCircle className="h-3 w-3 text-emerald-400" />
                  <span className="underline decoration-slate-700 underline-offset-2">Why this timing?</span>
                </button>
                <span className="text-[10px] text-emerald-400/80 font-medium">
                  {event.type === 'eating_window' ? 'Meals' : 'Light food'}
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
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">Caffeine</h3>
        </div>
      </div>

      <div className="space-y-2.5">
        {/* The cut-off before this duty's sleep, when it falls on another day's list */}
        {!isOffDay &&
          prepDetails?.caffeineCutoffHbt &&
          !caffeineEvents.some((e) => e.type === 'caffeine_cutoff' && e.startHbtStr === prepDetails.caffeineCutoffHbt) && (
            <p className="rounded-xl border border-red-900/40 bg-red-950/20 p-3 text-xs text-slate-300">
              Before the sleep ahead of this duty: last caffeine at{' '}
              <strong className="font-mono text-white">{prepDetails.caffeineCutoffHbt}</strong>
              {prepDetails.targetBedtimeDateStr && prepDetails.targetBedtimeDateStr !== selectedDate ? ' the day before' : ''}.
            </p>
          )}
        {caffeineEvents.length === 0 ? (
          <p className="py-4 text-center text-xs text-slate-500">No caffeine limits today beyond your usual cut-off.</p>
        ) : (
          caffeineEvents.map((event) => {
            const isCutoff = event.type === 'caffeine_cutoff';
            return (
              <div
                key={event.id}
                className={`rounded-xl border p-3 text-xs space-y-2 ${
                  isCutoff ? 'border-red-900/40 bg-red-950/20' : 'border-amber-900/30 bg-amber-950/15'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-bold text-white flex items-center gap-1.5">
                      {isCutoff ? <XCircle className="h-3.5 w-3.5 text-red-400" /> : <Coffee className="h-3.5 w-3.5 text-amber-400" />}
                      <span>{event.title}</span>
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">{event.subtitle}</p>
                  </div>

                  <div className="text-right shrink-0">
                    <span className={`font-mono text-xs font-extrabold ${isCutoff ? 'text-red-300' : 'text-amber-200'}`}>
                      {event.startHbtStr} – {event.endHbtStr}
                    </span>
                    <p className="text-[10px] text-slate-500">Home time</p>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-slate-800/60 pt-2 text-[11px]">
                  <button
                    onClick={() => onSelectEvent(event)}
                    className="flex items-center gap-1 text-slate-400 hover:text-slate-200 transition-colors"
                  >
                    <HelpCircle className="h-3 w-3 text-slate-400" />
                    <span className="underline decoration-slate-700 underline-offset-2">Why this timing?</span>
                  </button>
                  <span className={`text-[10px] font-semibold ${isCutoff ? 'text-red-400' : 'text-amber-400'}`}>
                    {isCutoff ? 'No caffeine' : 'Caffeine is fine'}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  </>
);

/** Notes under the cards: alcohol and exercise guardrails, morning light, and night duty. */
export const DayNotes: React.FC<{
  goodToKnow: CircadianEvent[];
  lightEvents: CircadianEvent[];
  alertEvents: CircadianEvent[];
  onSelectEvent: (event: CircadianEvent) => void;
}> = ({ goodToKnow, lightEvents, alertEvents, onSelectEvent }) => (
  <>
    {/* Good to know: alcohol before duty, hard exercise before sleep */}
    {goodToKnow.length > 0 && (
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3.5 text-xs">
        <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">Good to know</p>
        <ul className="space-y-1.5">
          {goodToKnow.map((e) => (
            <li key={e.id} className="flex flex-wrap items-baseline justify-between gap-2">
              <span>
                <strong className="text-slate-100">{e.title}</strong> <span className="text-slate-400">· {e.subtitle}</span>
              </span>
              <button
                onClick={() => onSelectEvent(e)}
                className="text-[11px] font-semibold text-slate-400 underline underline-offset-2 hover:text-white"
              >
                Why?
              </button>
            </li>
          ))}
        </ul>
      </div>
    )}

    {/* Layer 6: Morning Light / Sunlight Reset card on Off Day or Layover */}
    {lightEvents.length > 0 && (
      <div className="rounded-xl border border-amber-900/30 bg-amber-950/20 p-3.5 text-xs flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Sun className="h-4 w-4 text-amber-400 shrink-0" />
          <div>
            <strong className="text-amber-200">Morning light: </strong>
            <span className="text-slate-300">Some time in daylight this morning helps keep your body clock on home time.</span>
          </div>
        </div>
        <button
          onClick={() => onSelectEvent(lightEvents[0])}
          className="text-[11px] font-semibold text-amber-300 underline underline-offset-2 shrink-0 ml-3"
        >
          Why?
        </button>
      </div>
    )}

    {/* Special WOCL Alert if applicable */}
    {alertEvents.length > 0 && (
      <div className="rounded-xl border border-rose-900/30 bg-rose-950/20 p-3.5 text-xs flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
          <div>
            <strong className="text-rose-200">Night duty: </strong>
            <span className="text-slate-300">
              This duty runs through your body-clock night (roughly 02:00–06:00 home time), when alertness is usually lowest. A nap before
              the duty helps.
            </span>
          </div>
        </div>
        <button
          onClick={() => onSelectEvent(alertEvents[0])}
          className="text-[11px] font-semibold text-rose-300 underline underline-offset-2 shrink-0 ml-3"
        >
          Why?
        </button>
      </div>
    )}
  </>
);
