import React from 'react';
import { CircadianEvent, CircadianPlan } from '../types/circadian';

/**
 * "Today at a glance": the four things crew check first, in one row.
 *   Today      duty (report → finish, route), standby, day off, leave, sick, training or no roster
 *   Sleep      the next main sleep (or the one in progress) and its length
 *   Wake-up    the alarm for the next duty within 24 hours, otherwise the end of the next sleep
 *   Caffeine   the last time for caffeine before the next sleep
 * Same tile style as the Month summary: one value, then bulleted facts.
 */

interface Props {
  plan: CircadianPlan;
  todayStr: string; // home date
  nowMs: number;
}

const Tile: React.FC<{ title: string; value: string; lines?: (string | false | undefined)[] }> = ({ title, value, lines = [] }) => {
  const shown = lines.filter(Boolean) as string[];
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3.5">
      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{title}</span>
      <p className="mt-1 text-lg font-bold text-white">{value}</p>
      {shown.length > 0 && (
        <ul className="mt-1.5 space-y-1 text-xs leading-snug text-slate-300">
          {shown.map((line) => (
            <li key={line} className="flex gap-2">
              <span aria-hidden className="mt-[0.35rem] h-1 w-1 shrink-0 rounded-full bg-slate-500" />
              <span>{line}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const hours = (e: CircadianEvent) => Math.round(((Date.parse(e.endUtc) - Date.parse(e.startUtc)) / 3600000) * 10) / 10;

export const TodayGlance: React.FC<Props> = ({ plan, todayStr, nowMs }) => {
  const { events, dailySummaries } = plan;
  const today = dailySummaries.find((d) => d.dateStr === todayStr);
  const upcoming = (types: string[]) =>
    events.filter((e) => types.includes(e.type) && Date.parse(e.endUtc) > nowMs).sort((a, b) => a.startUtc.localeCompare(b.startUtc));

  // Today: what kind of day, and the duty's shape
  const todays = events.filter((e) => e.dutyDate === todayStr);
  const flights = todays.filter((e) => e.type === 'flight').sort((a, b) => a.startUtc.localeCompare(b.startUtc));
  const standby = todays.filter((e) => e.type === 'standby');
  const dutyParts = todays.filter((e) => e.type === 'flight' || e.type === 'duty_ground');
  const dutyEnd = dutyParts.sort((a, b) => a.endUtc.localeCompare(b.endUtc)).pop();
  const route = flights.length ? [flights[0].title.match(/: (\w{3})/)?.[1], ...flights.map((f) => f.title.match(/(\w{3})$/)?.[1])].filter(Boolean).join('→') : '';
  const prep = today?.prepDetails;
  let todayValue = 'Free day';
  let todayLines: (string | false | undefined)[] = [];
  if (flights.length) {
    todayValue = `Duty · ${flights.length} ${flights.length === 1 ? 'sector' : 'sectors'}`;
    todayLines = [prep?.reportHbt && `Report ${prep.reportHbt}${dutyEnd ? ` · finish about ${dutyEnd.endHbtStr}` : ''}`, route, today?.outlook && today.outlook.level !== 'steady' && today.outlook.headline];
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

  // Sleep: the next main sleep, or the one in progress
  const sleep = upcoming(['anchor_sleep', 'recovery_sleep'])[0];
  const sleepingNow = sleep && Date.parse(sleep.startUtc) <= nowMs;
  const nap = upcoming(['nasa_nap']).find((n) => !sleep || n.startUtc < sleep.startUtc);

  // Wake-up: the alarm for a duty within 24 hours, otherwise the end of the next sleep
  const nextPrep = upcoming(['pre_flight_prep']).find((p) => Date.parse(p.startUtc) - nowMs <= 24 * 3600000);
  const wakeValue = nextPrep?.prepDetails?.wakeUpHbt ?? sleep?.endHbtStr ?? '—';
  // Only call it a wake-up when a planned sleep or nap really ends then; for an afternoon or evening duty
  // you are already awake, so it is the time to start getting ready.
  const prepWakeMs = nextPrep?.prepDetails?.wakeUpUtc ? Date.parse(nextPrep.prepDetails.wakeUpUtc) : undefined;
  const wakesFromSleep =
    prepWakeMs === undefined ||
    upcoming(['anchor_sleep', 'recovery_sleep', 'nasa_nap']).some((s) => Math.abs(Date.parse(s.endUtc) - prepWakeMs) <= 30 * 60000);
  const wakeLines = nextPrep?.prepDetails
    ? [`For your duty: report ${nextPrep.prepDetails.reportHbt}`, `${nextPrep.prepDetails.pickupLabel || 'Leave home'} ${nextPrep.prepDetails.cabPickupHbt}`]
    : sleep
    ? ['End of your next sleep']
    : [];

  // Caffeine: the cutoff before the next sleep
  const cutoff = upcoming(['caffeine_cutoff'])[0];
  const caffeineValue = !cutoff ? '—' : Date.parse(cutoff.startUtc) <= nowMs ? 'None now' : `Until ${cutoff.startHbtStr}`;
  const caffeineLines = cutoff ? [Date.parse(cutoff.startUtc) <= nowMs ? `No caffeine until after your sleep at ${cutoff.endHbtStr}` : `Then none before your sleep at ${cutoff.endHbtStr}`] : [];

  return (
    <section aria-label="Today at a glance" className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
      <Tile title="Today" value={todayValue} lines={todayLines} />
      <Tile
        title={sleepingNow ? 'Sleep now' : 'Next sleep'}
        value={sleep ? `${sleep.startHbtStr}–${sleep.endHbtStr}` : '—'}
        lines={[sleep && `About ${hours(sleep)}h`, nap && `Nap ${nap.startHbtStr}–${nap.endHbtStr} first`]}
      />
      <Tile title={wakesFromSleep ? 'Wake-up' : 'Get ready'} value={wakeValue} lines={wakeLines} />
      <Tile title="Caffeine" value={caffeineValue} lines={caffeineLines} />
    </section>
  );
};
