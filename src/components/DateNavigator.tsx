import React, { useEffect, useMemo, useState } from 'react';
import { DailyCircadianSummary } from '../types/circadian';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Calendar-style day picker for the Timeline: a week strip (Monday to Sunday) or a month grid,
 * with one status per day. Replaces the separate month filter, W1–W5 tabs and loose day chips.
 */

interface DateNavigatorProps {
  days: DailyCircadianSummary[];
  selectedDate: string;
  todayStr: string;
  onSelect: (dateStr: string) => void;
  initialView?: 'week' | 'month';
  /** Called with the first day of the month on screen whenever it changes. */
  onVisibleMonthChange?: (monthStart: string) => void;
}

type Status = { label: string; dot: string; text: string; legend: string };

const DAY_MS = 86400000;
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const toMs = (dateStr: string) => Date.parse(`${dateStr}T12:00:00Z`);
const toStr = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const addDays = (dateStr: string, n: number) => toStr(toMs(dateStr) + n * DAY_MS);
/** Monday of the week containing the date. */
const weekStart = (dateStr: string) => addDays(dateStr, -((new Date(toMs(dateStr)).getUTCDay() + 6) % 7));
const monthKey = (dateStr: string) => dateStr.slice(0, 7);
const monthName = (dateStr: string, withYear = true) =>
  new Date(toMs(dateStr)).toLocaleDateString('en-GB', { month: 'long', ...(withYear ? { year: 'numeric' } : {}), timeZone: 'UTC' });

const STATUS = {
  duty: { label: 'Duty', dot: 'bg-blue-400', text: 'text-blue-300', legend: 'Duty' },
  harder: { label: 'Harder', dot: 'bg-amber-400', text: 'text-amber-300', legend: 'Harder duty day' },
  standby: { label: 'Standby', dot: 'bg-purple-400', text: 'text-purple-300', legend: 'Standby' },
  off: { label: 'Off', dot: 'bg-emerald-400', text: 'text-emerald-300', legend: 'Day off' },
  training: { label: 'Training', dot: 'bg-cyan-400', text: 'text-cyan-300', legend: 'Training' },
  leave: { label: 'Leave', dot: 'bg-teal-600', text: 'text-teal-300', legend: 'Leave' },
  sick: { label: 'Sick', dot: 'bg-rose-400', text: 'text-rose-300', legend: 'Sick' },
  none: { label: 'No roster', dot: 'bg-slate-600', text: 'text-slate-500', legend: 'No roster' },
} as const;
/** Legend order, most to least important. */
const LEGEND_ORDER = [STATUS.duty, STATUS.harder, STATUS.standby, STATUS.training, STATUS.off, STATUS.leave, STATUS.sick, STATUS.none];

function statusOf(day: DailyCircadianSummary | undefined): Status | null {
  if (!day) return null;
  if (day.outsideRoster) return STATUS.none;
  if (day.dutyType === 'standby') return STATUS.standby;
  if (day.dutyType === 'training') return STATUS.training;
  if (day.dutyType === 'leave') return STATUS.leave;
  if (day.dutyType === 'sick') return STATUS.sick;
  if (day.isOffDay) return STATUS.off;
  if (day.outlook?.level === 'harder') return STATUS.harder;
  return STATUS.duty;
}

export const DateNavigator: React.FC<DateNavigatorProps> = ({
  days,
  selectedDate,
  todayStr,
  onSelect,
  initialView = 'week',
  onVisibleMonthChange,
}) => {
  const byDate = useMemo(() => new Map(days.map((d) => [d.dateStr, d])), [days]);
  const firstDate = days[0]?.dateStr ?? todayStr;
  const lastDate = days[days.length - 1]?.dateStr ?? todayStr;

  const [view, setView] = useState<'week' | 'month'>(initialView);
  // The week or month on screen; follows the selected day
  const [anchor, setAnchor] = useState(selectedDate || todayStr);
  useEffect(() => {
    if (selectedDate) setAnchor(selectedDate);
  }, [selectedDate]);

  const shownWeek = weekStart(anchor);
  const shownMonth = `${monthKey(anchor)}-01`;
  useEffect(() => {
    onVisibleMonthChange?.(shownMonth);
  }, [shownMonth, onVisibleMonthChange]);
  const canGoBack = view === 'week' ? shownWeek > firstDate : shownMonth > firstDate;
  const canGoForward = view === 'week' ? addDays(shownWeek, 6) < lastDate : monthKey(addDays(shownMonth, 31)) <= monthKey(lastDate);

  const move = (direction: 1 | -1) => {
    if (view === 'week') setAnchor(addDays(shownWeek, 7 * direction));
    else {
      const d = new Date(toMs(shownMonth));
      d.setUTCMonth(d.getUTCMonth() + direction);
      setAnchor(toStr(d.getTime()));
    }
  };

  const title = (() => {
    if (view === 'month') return monthName(shownMonth);
    const end = addDays(shownWeek, 6);
    if (monthKey(shownWeek) === monthKey(end)) return monthName(shownWeek);
    const sameYear = shownWeek.slice(0, 4) === end.slice(0, 4);
    return `${monthName(shownWeek, !sameYear)} – ${monthName(end)}`;
  })();

  const cells =
    view === 'week'
      ? Array.from({ length: 7 }, (_, i) => addDays(shownWeek, i))
      : Array.from({ length: 42 }, (_, i) => addDays(weekStart(shownMonth), i)).filter(
          (d, i, all) => i < 35 || monthKey(all[35]) === monthKey(shownMonth)
        );

  // Legend: only the statuses visible in the current week or month
  const visibleStatuses = new Set(
    cells
      .filter((d) => view === 'week' || monthKey(d) === monthKey(shownMonth))
      .map((d) => statusOf(byDate.get(d)))
      .filter(Boolean) as Status[]
  );
  const legend = LEGEND_ORDER.filter((s) => visibleStatuses.has(s));

  const selected = byDate.get(selectedDate);
  const selectedStatus = statusOf(selected);

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 shadow-sm">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 pt-4 sm:px-5">
        <div className="flex items-center gap-1">
          <button
            onClick={() => move(-1)}
            disabled={!canGoBack}
            aria-label={view === 'week' ? 'Previous week' : 'Previous month'}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white disabled:opacity-25 disabled:hover:bg-transparent"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <h3 className="min-w-[10rem] text-center text-base font-semibold text-white">{title}</h3>
          <button
            onClick={() => move(1)}
            disabled={!canGoForward}
            aria-label={view === 'week' ? 'Next week' : 'Next month'}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white disabled:opacity-25 disabled:hover:bg-transparent"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          {byDate.has(todayStr) && (
            <button
              onClick={() => onSelect(todayStr)}
              className="ml-2 rounded-lg border border-slate-700 px-2.5 py-1 text-xs font-semibold text-slate-300 hover:border-slate-600 hover:text-white"
            >
              Today
            </button>
          )}
        </div>

        <div className="inline-flex rounded-lg border border-slate-800 bg-slate-950 p-0.5 text-xs font-semibold">
          {(['week', 'month'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`rounded-md px-3 py-1 capitalize transition-colors ${view === v ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* Days */}
      <div className="px-4 py-4 sm:px-5">
        <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
          {view === 'month' &&
            WEEKDAYS.map((w) => (
              <span key={w} className="pb-1 text-center text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                {w}
              </span>
            ))}
          {cells.map((dateStr, i) => {
            const day = byDate.get(dateStr);
            const status = statusOf(day);
            const isSelected = dateStr === selectedDate;
            const isToday = dateStr === todayStr;
            const inMonth = view === 'week' || monthKey(dateStr) === monthKey(shownMonth);
            const dayNumber = Number(dateStr.slice(8));
            return (
              <button
                key={dateStr}
                onClick={() => day && onSelect(dateStr)}
                disabled={!day}
                aria-label={`${dateStr}${status ? `, ${status.label}` : ''}`}
                aria-pressed={isSelected}
                className={`relative flex flex-col items-center rounded-xl border text-center transition-all ${
                  view === 'week' ? 'gap-1 py-2.5 sm:py-3' : 'gap-1 py-1.5 sm:py-2'
                } ${
                  isSelected
                    ? 'border-blue-500 bg-blue-600/15 ring-1 ring-blue-500'
                    : day
                    ? 'border-slate-800 bg-slate-950/60 hover:border-slate-600'
                    : 'border-transparent'
                } ${!day || !inMonth ? 'opacity-30' : ''} disabled:cursor-default`}
              >
                {view === 'week' && (
                  <span className={`text-[10px] font-semibold uppercase tracking-wider ${isToday ? 'text-blue-300' : 'text-slate-500'}`}>
                    {isToday ? 'Today' : WEEKDAYS[i]}
                  </span>
                )}
                <span
                  className={`font-semibold tabular-nums ${view === 'week' ? 'text-xl sm:text-2xl' : 'text-sm'} ${
                    isSelected ? 'text-white' : isToday ? 'text-blue-200' : 'text-slate-200'
                  }`}
                >
                  {dayNumber}
                </span>
                {status ? (
                  view === 'week' ? (
                    <span className={`flex items-center gap-1 text-[10px] font-medium ${status.text}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
                      <span className="hidden sm:inline">{status.label}</span>
                    </span>
                  ) : (
                    <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
                  )
                ) : (
                  <span className="h-1.5" />
                )}
                {view === 'month' && isToday && <span className="absolute right-1 top-1 h-1 w-1 rounded-full bg-blue-300" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Legend for the status dots: always in Month view; in Week view only on phones, where labels are hidden */}
      {legend.length > 0 && (
        <div
          className={`flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 pb-3 text-[11px] text-slate-400 sm:px-5 ${view === 'week' ? 'sm:hidden' : ''}`}
          aria-label="What the coloured dots mean"
        >
          {legend.map((s) => (
            <span key={s.label} className="flex items-center gap-1.5">
              <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
              {s.legend}
            </span>
          ))}
        </div>
      )}

      {/* Selected day */}
      {selected && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 px-4 py-3 text-sm sm:px-5">
          <span className="text-white">
            {new Date(toMs(selected.dateStr)).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })}
            {selected.dateStr === todayStr && <span className="ml-2 text-xs text-blue-300">Today</span>}
          </span>
          <span className="flex items-center gap-3 text-xs">
            {selectedStatus && (
              <span className={`flex items-center gap-1.5 ${selectedStatus.text}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${selectedStatus.dot}`} />
                {selectedStatus.label === 'No roster' ? 'No roster for this day' : selectedStatus.label}
              </span>
            )}
            {selected.outlook && selected.outlook.level !== 'steady' && <span className="text-slate-300">{selected.outlook.headline}</span>}
          </span>
        </div>
      )}
    </div>
  );
};
