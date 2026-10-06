import React from 'react';
import { CircadianPlan } from '../types/circadian';
import { rosterClock } from '../services/rosterKeys';

/**
 * Today in one line: what kind of day it is and, on a duty day, check-in, sign-off and route.
 * Sleep, wake-up and caffeine are not repeated here: Now/Next, the next-duty panel and
 * "What matters today" already show them.
 */

interface Props {
  plan: CircadianPlan;
  todayStr: string; // home date
  nowMs: number;
}

export const TodayGlance: React.FC<Props> = ({ plan, todayStr }) => {
  const { events, dailySummaries } = plan;
  const today = dailySummaries.find((d) => d.dateStr === todayStr);

  // Today: what kind of day, and the duty's shape
  const todays = events.filter((e) => e.dutyDate === todayStr);
  const flights = todays.filter((e) => e.type === 'flight').sort((a, b) => a.startUtc.localeCompare(b.startUtc));
  const standby = todays.filter((e) => e.type === 'standby');
  // Sign-off: the latest release among today's flights (from the roster, delays included)
  const legs = plan.roster.flights.filter((f) => flights.some((e) => e.id === f.id || e.id === `flight-${f.id}`));
  const lastRelease = legs.map((f) => Date.parse(f.releaseTimeUtc)).sort((x, y) => x - y).pop();
  const signOff = lastRelease !== undefined ? rosterClock(plan.roster).time(lastRelease) : undefined;
  const route = flights.length ? [flights[0].title.match(/: (\w{3})/)?.[1], ...flights.map((f) => f.title.match(/(\w{3})$/)?.[1])].filter(Boolean).join('→') : '';
  const prep = today?.prepDetails;
  let todayValue = 'Free day';
  let todayLines: (string | false | undefined)[] = [];
  if (flights.length) {
    todayValue = `Duty · ${flights.length} ${flights.length === 1 ? 'flight' : 'flights'}`;
    todayLines = [prep?.reportHbt && `Check-in ${prep.reportHbt}${signOff ? ` · sign-off ${signOff}` : ''}`, route, today?.outlook && today.outlook.level !== 'steady' && today.outlook.headline];
  } else if (standby.length) {
    todayValue = 'Standby';
    todayLines = standby.map((s) => `${s.title} ${s.startHbtStr}–${s.endHbtStr}`);
  } else if (today?.outsideRoster) {
    todayValue = 'No roster';
    todayLines = ['Showing your usual home-time rhythm'];
  } else if (today) {
    todayValue = { off: today.noDuty ? 'No duty' : 'Day off', leave: 'Leave', sick: 'Sick day', training: 'Training', standby: 'Standby', layover: 'Layover', flight: 'Duty' }[today.dutyType];
    todayLines = [today.layoverStation && `Away at ${today.layoverStation.iata}`];
  }

  const shown = todayLines.filter(Boolean) as string[];
  return (
    <section aria-label="Today" className="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3">
      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Today</span>
      <span className="text-base font-bold text-white">{todayValue}</span>
      {shown.length > 0 && <span className="text-xs text-slate-300">{shown.join(' · ')}</span>}
    </section>
  );
};
