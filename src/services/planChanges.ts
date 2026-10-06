import { CircadianEvent, CircadianPlan, PrepDetails } from '../types/circadian';
import { rosterClock } from './rosterKeys';

/**
 * "Your plan changed": what actually moved in the plan after an update, day by day.
 * The whole plan is always recalculated (it is fast and nothing derived is stored); this compares the plan
 * before and after and keeps only changes worth telling the person about:
 * - wake-up alarm, sleep or nap moved by 30 minutes or more, or added / removed;
 * - last caffeine moved by 30 minutes or more;
 * - the duty became a different kind (e.g. day duty → overnight duty).
 * Past days are not mentioned.
 */

export const NOTICE_THRESHOLD_MINUTES = 30;

export interface PlanChangeDay {
  date: string; // home date, YYYY-MM-DD
  lines: string[];
}

const CATEGORY_WORDS: Record<NonNullable<PrepDetails['dutyCategory']>, string> = {
  early_morning: 'early-morning duty',
  daytime: 'daytime duty',
  evening: 'evening duty',
  redeye: 'overnight duty',
};

type Kind = 'sleep' | 'nap' | 'caffeine';
const kindOf = (e: CircadianEvent): Kind | null =>
  e.type === 'anchor_sleep' || e.type === 'recovery_sleep' ? 'sleep' : e.type === 'nasa_nap' ? 'nap' : e.type === 'caffeine_cutoff' ? 'caffeine' : null;

export function comparePlans(before: CircadianPlan, after: CircadianPlan, nowMs: number): PlanChangeDay[] {
  const clock = rosterClock(after.roster);
  const t = (iso: string) => clock.time(Date.parse(iso));
  const today = clock.date(nowMs);
  const min = (a: string, b: string) => Math.abs(Date.parse(a) - Date.parse(b)) / 60000;

  // Upcoming sleeps, naps and caffeine cutoffs, by home date and kind, in time order
  const group = (plan: CircadianPlan) => {
    const map = new Map<string, CircadianEvent[]>();
    for (const e of plan.events) {
      const kind = kindOf(e);
      if (!kind || Date.parse(e.endUtc) <= nowMs) continue;
      const key = `${clock.date(Date.parse(e.startUtc))}|${kind}`;
      map.set(key, [...(map.get(key) ?? []), e]);
    }
    for (const list of map.values()) list.sort((a, b) => a.startUtc.localeCompare(b.startUtc));
    return map;
  };
  const b = group(before);
  const a = group(after);
  const byDay = new Map<string, string[]>();
  const add = (date: string, line: string) => byDay.set(date, [...(byDay.get(date) ?? []), line]);

  for (const key of [...new Set([...b.keys(), ...a.keys()])].sort()) {
    const [date, kind] = key.split('|') as [string, Kind];
    const was = b.get(key) ?? [];
    const now = a.get(key) ?? [];
    const label = kind === 'sleep' ? 'Sleep' : kind === 'nap' ? 'Nap' : 'Last caffeine';
    const span = (e: CircadianEvent) => (kind === 'caffeine' ? t(e.startUtc) : `${t(e.startUtc)}–${t(e.endUtc)}`);
    for (let i = 0; i < Math.max(was.length, now.length); i++) {
      const x = was[i];
      const y = now[i];
      if (x && y) {
        if (min(x.startUtc, y.startUtc) >= NOTICE_THRESHOLD_MINUTES || (kind !== 'caffeine' && min(x.endUtc, y.endUtc) >= NOTICE_THRESHOLD_MINUTES)) {
          add(date, `${label} ${span(x)} → ${span(y)}`);
        }
      } else if (y && kind !== 'caffeine') add(date, `${label} added ${span(y)}`);
      else if (x && kind !== 'caffeine') add(date, `${label} ${span(x)} no longer needed`);
    }
  }

  // Wake-up alarm and kind of duty, from each day's prep details
  const prepByDate = (plan: CircadianPlan) => new Map(plan.dailySummaries.filter((d) => d.dateStr >= today).map((d) => [d.dateStr, d.prepDetails]));
  const pb = prepByDate(before);
  const pa = prepByDate(after);
  for (const date of [...pa.keys()].sort()) {
    const x = pb.get(date);
    const y = pa.get(date);
    if (x?.wakeUpUtc && y?.wakeUpUtc && Date.parse(y.wakeUpUtc) > nowMs && min(x.wakeUpUtc, y.wakeUpUtc) >= NOTICE_THRESHOLD_MINUTES) {
      add(date, `Wake-up alarm ${x.wakeUpHbt} → ${y.wakeUpHbt}`);
    }
    if (x?.dutyCategory && y?.dutyCategory && x.dutyCategory !== y.dutyCategory) {
      const words = CATEGORY_WORDS[y.dutyCategory];
      add(date, `Now ${/^[aeiou]/.test(words) ? 'an' : 'a'} ${words} (was ${CATEGORY_WORDS[x.dutyCategory]})`);
    }
  }

  return [...byDay.entries()]
    .filter(([date]) => date >= today)
    .sort(([x], [y]) => x.localeCompare(y))
    .map(([date, lines]) => ({ date, lines: [...new Set(lines)] }));
}

/**
 * The heads-up shown on Today after an update: only changes today or tomorrow (when the person may need to
 * move an alarm), in one or two plain phrases, most important first (wake-up, sleep, nap, caffeine, duty).
 * Null when nothing meaningful changes soon.
 */
export function planHeadsUp(before: CircadianPlan, after: CircadianPlan, nowMs: number): string | null {
  const clock = rosterClock(after.roster);
  const today = clock.date(nowMs);
  const tomorrow = clock.addDays(today, 1);
  const word = (date: string, evening = false) => (date === today ? (evening ? 'tonight' : 'today') : 'tomorrow');
  const items: { rank: number; text: string }[] = [];
  for (const day of comparePlans(before, after, nowMs).filter((d) => d.date === today || d.date === tomorrow)) {
    for (const line of day.lines) {
      let m: RegExpMatchArray | null;
      if ((m = line.match(/^Wake-up alarm (\S+) → (\S+)$/))) items.push({ rank: 0, text: `your wake-up alarm ${word(day.date)} moves to ${m[2]} (was ${m[1]})` });
      else if ((m = line.match(/^Sleep (\S+)–(\S+) → (\S+)–(\S+)$/))) items.push({ rank: 1, text: `your sleep ${word(day.date, m[3] >= '18:00')} is now ${m[3]}–${m[4]}` });
      else if ((m = line.match(/^Sleep added (\S+)–(\S+)$/))) items.push({ rank: 1, text: `a sleep was added ${word(day.date, m[1] >= '18:00')}, ${m[1]}–${m[2]}` });
      else if ((m = line.match(/^Sleep (\S+)–\S+ no longer needed$/))) items.push({ rank: 1, text: `the sleep ${word(day.date, m[1] >= '18:00')} at ${m[1]} is no longer needed` });
      else if ((m = line.match(/^Nap (\S+)–\S+ → (\S+)–(\S+)$/))) items.push({ rank: 2, text: `your nap ${word(day.date)} moves to ${m[2]}–${m[3]}` });
      else if ((m = line.match(/^Nap added (\S+)–(\S+)$/))) items.push({ rank: 2, text: `a nap was added ${word(day.date)}, ${m[1]}–${m[2]}` });
      else if ((m = line.match(/^Nap (\S+)–\S+ no longer needed$/))) items.push({ rank: 2, text: `the nap ${word(day.date)} at ${m[1]} is no longer needed` });
      else if ((m = line.match(/^Last caffeine \S+ → (\S+)$/))) items.push({ rank: 3, text: `last caffeine ${word(day.date)} is now ${m[1]}` });
      else if ((m = line.match(/^Now an? (.+) \(was /))) items.push({ rank: 4, text: `${word(day.date) === 'today' ? "today's" : "tomorrow's"} duty is now an ${m[1]}` });
    }
  }
  if (!items.length) return null;
  const top = items.sort((a, b) => a.rank - b.rank).slice(0, 2).map((i) => i.text);
  const sentence = top.join('; ');
  return sentence.charAt(0).toUpperCase() + sentence.slice(1) + '.';
}
