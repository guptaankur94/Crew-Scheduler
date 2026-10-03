import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateCircadianPlan } from '../src/services/circadianCalculator';
import { getPresets } from '../src/data/rosterPresets';
import type { CircadianEvent, CircadianPlan, CrewPreferences, FlightLeg, RosterData } from '../src/types/circadian';

const prefs: CrewPreferences = {
  airline: 'airline',
  homeBaseIata: 'DEL',
  homeBaseTzOffset: 5.5,
  chronotype: 'intermediate',
  targetSleepHours: 7.5,
  caffeineCutoffHours: 6,
  preferredNapDuration: 26,
  groomingMinutes: 60,
  cabBufferMinutes: 60,
  crewRank: 'senior',
  currency: 'INR',
};

/** A flight given in Delhi local time (UTC+5:30). Report 75 min before, release 30 min after. */
const leg = (id: string, from: string, to: string, depIst: string, arrIst: string, destTz = 5.5): FlightLeg => {
  const dep = Date.parse(`${depIst}:00+05:30`);
  const arr = Date.parse(`${arrIst}:00+05:30`);
  return {
    id,
    flightNumber: id.toUpperCase(),
    origin: from,
    destination: to,
    departureTimeUtc: new Date(dep).toISOString(),
    arrivalTimeUtc: new Date(arr).toISOString(),
    reportTimeUtc: new Date(dep - 75 * 60000).toISOString(),
    releaseTimeUtc: new Date(arr + 30 * 60000).toISOString(),
    originTzOffset: from === 'DEL' || from === 'BOM' ? 5.5 : destTz,
    destTzOffset: destTz,
    durationMinutes: Math.round((arr - dep) / 60000),
  };
};

const roster = (flights: FlightLeg[]): RosterData => ({
  id: 'test',
  airline: 'Test',
  homeBase: 'DEL',
  homeBaseTzOffset: 5.5,
  flights,
  layovers: [],
  parsedAt: '2026-10-01T00:00:00.000Z',
});

const ms = (iso: string) => Date.parse(iso);
const overlaps = (a: CircadianEvent, b: CircadianEvent) => ms(a.startUtc) < ms(b.endUtc) && ms(b.startUtc) < ms(a.endUtc);
const isSleep = (e: CircadianEvent) =>
  (e.type === 'anchor_sleep' || e.type === 'recovery_sleep' || e.type === 'nasa_nap') && !e.id.startsWith('crew-rest-');

/** Checks every rule that keeps a plan self-consistent. Returns a list of problems. */
function problems(plan: CircadianPlan): string[] {
  const found: string[] = [];
  const sleeps = plan.events.filter(isSleep);
  const duties = plan.roster.flights.map((f) => ({ id: f.id, start: ms(f.reportTimeUtc), end: ms(f.releaseTimeUtc) }));

  for (let i = 0; i < sleeps.length; i++) {
    for (let j = i + 1; j < sleeps.length; j++) {
      if (overlaps(sleeps[i], sleeps[j])) found.push(`sleeps overlap: ${sleeps[i].id} / ${sleeps[j].id}`);
    }
    for (const d of duties) {
      if (ms(sleeps[i].startUtc) < d.end && d.start < ms(sleeps[i].endUtc)) found.push(`sleep during duty: ${sleeps[i].id} / ${d.id}`);
    }
  }

  const allowed = plan.events.filter((e) => e.type === 'caffeine_allowed');
  const cutoffs = plan.events.filter((e) => e.type === 'caffeine_cutoff');
  for (const a of allowed) for (const c of cutoffs) if (overlaps(a, c)) found.push(`caffeine yes and no at once: ${a.id} / ${c.id}`);

  const meals = plan.events.filter((e) => e.type === 'eating_window' || e.type === 'fasting_window');
  for (const m of meals) for (const s of sleeps) if (overlaps(m, s)) found.push(`meal during sleep: ${m.id} / ${s.id}`);

  const shades = plan.events.filter((e) => e.type === 'melatonin_shield');
  const daylight = plan.events.filter((e) => e.type === 'light_exposure');
  for (const a of shades) for (const b of daylight) if (overlaps(a, b)) found.push(`sunglasses and daylight at once: ${a.id} / ${b.id}`);
  for (const l of daylight) for (const s of sleeps) if (overlaps(l, s)) found.push(`daylight during sleep: ${l.id} / ${s.id}`);

  for (const e of plan.events) {
    if (ms(e.endUtc) < ms(e.startUtc)) found.push(`event ends before it starts: ${e.id}`);
    if (!e.dutyDate) found.push(`event has no day: ${e.id}`);
  }
  const ids = plan.events.map((e) => e.id);
  if (new Set(ids).size !== ids.length) found.push('duplicate event ids');
  return found;
}

test('every sample roster produces a self-consistent plan', () => {
  for (const preset of getPresets()) {
    const plan = generateCircadianPlan(preset.roster, { ...prefs, homeBaseIata: preset.roster.homeBase, homeBaseTzOffset: preset.roster.homeBaseTzOffset });
    assert.deepEqual(problems(plan), [], preset.name);
  }
});

test('plans stay consistent with an 8-hour caffeine cutoff and 9 hours of sleep', () => {
  for (const preset of getPresets()) {
    const plan = generateCircadianPlan(preset.roster, { ...prefs, targetSleepHours: 9, caffeineCutoffHours: 8 });
    assert.deepEqual(problems(plan), [], preset.name);
  }
});

test('an early report is planned under its own home-time date with an early bedtime', () => {
  // 04:00 IST report = 22:30 UTC the previous day; it must still belong to 10 Oct
  const plan = generateCircadianPlan(roster([leg('6e1', 'DEL', 'BOM', '2026-10-10T05:15', '2026-10-10T07:30')]), prefs);
  const flight = plan.events.find((e) => e.type === 'flight')!;
  assert.equal(flight.dutyDate, '2026-10-10');
  const prep = plan.dailySummaries.find((d) => d.dateStr === '2026-10-10')!.prepDetails!;
  assert.equal(prep.reportHbt, '04:00');
  assert.equal(prep.wakeUpHbt, '02:00');
  assert.equal(prep.targetBedtimeHbt, '18:30');
  assert.equal(prep.targetBedtimeDateStr, '2026-10-09');
  assert.deepEqual(problems(plan), []);
});

test('one bedtime the night before an early duty, not two', () => {
  const plan = generateCircadianPlan(
    roster([
      leg('a', 'DEL', 'BOM', '2026-10-10T10:00', '2026-10-10T12:00'),
      leg('b', 'BOM', 'DEL', '2026-10-10T13:30', '2026-10-10T15:30'),
      leg('c', 'DEL', 'BLR', '2026-10-12T05:15', '2026-10-12T08:00'),
    ]),
    prefs
  );
  const sleepsEndingOn12th = plan.events.filter((e) => isSleep(e) && e.type !== 'nasa_nap' && e.dutyDate === '2026-10-12');
  assert.equal(sleepsEndingOn12th.length, 1);
  assert.equal(sleepsEndingOn12th[0].startHbtStr, '18:30');
  assert.deepEqual(problems(plan), []);
});

test('a night is planned after a duty that comes before a day off', () => {
  const plan = generateCircadianPlan(roster([leg('a', 'DEL', 'BOM', '2026-10-10T10:00', '2026-10-10T12:00')]), prefs);
  const nightAfter = plan.events.find((e) => isSleep(e) && e.dutyDate === '2026-10-11');
  assert.ok(nightAfter, 'expected a sleep on the night after the duty');
  assert.equal(nightAfter!.startHbtStr, '23:00');
});

test('red-eye turnaround: one duty, nap before, recovery sleep and sunglasses after, no taxi abroad', () => {
  const plan = generateCircadianPlan(
    roster([
      leg('out', 'DEL', 'DXB', '2026-10-10T23:30', '2026-10-11T02:00', 4),
      leg('back', 'DXB', 'DEL', '2026-10-11T03:30', '2026-10-11T06:30', 5.5),
    ]),
    prefs
  );
  assert.deepEqual(problems(plan), []);
  const preps = plan.events.filter((e) => e.type === 'pre_flight_prep');
  assert.equal(preps.length, 1, 'the turnaround is a single duty');
  assert.ok(plan.events.some((e) => e.type === 'nasa_nap' && e.endHbtStr === preps[0].startHbtStr), 'nap ends when getting ready starts');
  const recovery = plan.events.find((e) => e.type === 'recovery_sleep');
  assert.ok(recovery, 'recovery sleep after the duty');
  assert.ok(plan.events.some((e) => e.type === 'melatonin_shield'), 'sunglasses on the way home');
  // Released 07:00, home by 08:00, wind down: sleep starts 08:30
  assert.equal(recovery!.startHbtStr, '08:30');
});

test('a duty starting at a layover uses hotel pickup, not home', () => {
  const plan = generateCircadianPlan(
    roster([
      leg('out', 'DEL', 'BOM', '2026-10-10T18:00', '2026-10-10T20:00'),
      leg('back', 'BOM', 'DEL', '2026-10-11T09:00', '2026-10-11T11:00'),
    ]),
    prefs
  );
  const preps = plan.events.filter((e) => e.type === 'pre_flight_prep');
  assert.equal(preps.length, 2);
  assert.match(preps[0].title, /Leave home/);
  assert.match(preps[1].title, /Hotel pickup/);
  assert.equal(preps[1].prepDetails?.isAwayFromBase, true);
  assert.deepEqual(problems(plan), []);
});

test('caffeine early in a night duty stops before the cutoff for the sleep after it', () => {
  const plan = generateCircadianPlan(roster([leg('n', 'DEL', 'SIN', '2026-10-10T22:00', '2026-10-11T04:00', 8)]), prefs);
  const ok = plan.events.find((e) => e.type === 'caffeine_allowed');
  assert.ok(ok, 'expected a caffeine window early in the duty');
  assert.equal(ok!.startHbtStr, '20:45');
  assert.deepEqual(problems(plan), []);
});

test('quick turnaround with very short rest does not invent a sleep', () => {
  const plan = generateCircadianPlan(
    roster([
      leg('a', 'DEL', 'BOM', '2026-10-10T16:00', '2026-10-10T18:00'),
      leg('b', 'BOM', 'DEL', '2026-10-11T01:30', '2026-10-11T03:30'),
    ]),
    prefs
  );
  assert.deepEqual(problems(plan), []);
});

test('empty roster gives a quiet week of plain nights', () => {
  const plan = generateCircadianPlan(roster([]), prefs);
  assert.equal(plan.dailySummaries.length, 7);
  assert.ok(plan.events.some((e) => e.type === 'anchor_sleep'));
  assert.ok(!plan.events.some((e) => e.type === 'flight' || e.type === 'pre_flight_prep'));
  assert.deepEqual(problems(plan), []);
});

test('moving a sleep keeps it out of the duties around it', () => {
  const r = roster([
    leg('a', 'DEL', 'BOM', '2026-10-10T10:00', '2026-10-10T12:00'),
    leg('b', 'DEL', 'BLR', '2026-10-11T05:15', '2026-10-11T08:00'),
  ]);
  const base = generateCircadianPlan(r, prefs);
  const sleep = base.events.find((e) => e.type === 'anchor_sleep' && e.dutyDate === '2026-10-11')!;
  for (const minutes of [-600, -60, 60, 600]) {
    const plan = generateCircadianPlan(r, prefs, { [sleep.id]: minutes });
    assert.deepEqual(problems(plan), [], `nudge ${minutes}`);
  }
});

test('night-flight count only includes flights through the home-time body-clock night', () => {
  const plan = generateCircadianPlan(
    roster([
      leg('day', 'DEL', 'BOM', '2026-10-10T10:00', '2026-10-10T12:00'),
      leg('night', 'DEL', 'BOM', '2026-10-12T03:00', '2026-10-12T05:00'),
    ]),
    prefs
  );
  assert.equal(plan.monthlyStats.woclNightFlights, 1);
});

test('a London base keeps a 23:00 home bedtime across the October clock change', () => {
  const london = (id: string, depUtc: string, arrUtc: string): FlightLeg => ({
    id,
    flightNumber: id,
    origin: 'LHR',
    destination: 'CDG',
    departureTimeUtc: depUtc,
    arrivalTimeUtc: arrUtc,
    reportTimeUtc: new Date(Date.parse(depUtc) - 75 * 60000).toISOString(),
    releaseTimeUtc: new Date(Date.parse(arrUtc) + 30 * 60000).toISOString(),
    originTzOffset: 1,
    destTzOffset: 2,
    durationMinutes: 75,
  });
  // UK clocks go back on Sunday 25 October 2026
  const plan = generateCircadianPlan(
    { ...roster([london('x1', '2026-10-22T10:00:00.000Z', '2026-10-22T11:15:00.000Z')]), homeBase: 'LHR', homeBaseTzOffset: 1, totalDays: 7 },
    { ...prefs, homeBaseIata: 'LHR', homeBaseTzOffset: 1 }
  );
  const nights = plan.events.filter((e) => e.type === 'anchor_sleep');
  const before = nights.find((e) => e.startUtc.startsWith('2026-10-23'));
  const after = nights.find((e) => e.startUtc.startsWith('2026-10-26'));
  assert.equal(before?.startHbtStr, '23:00');
  assert.equal(before?.startUtc, '2026-10-23T22:00:00.000Z'); // BST, UTC+1
  assert.equal(after?.startHbtStr, '23:00');
  assert.equal(after?.startUtc, '2026-10-26T23:00:00.000Z'); // GMT, UTC+0
  assert.deepEqual(problems(plan), []);
});

test('chronotype moves the usual bedtime by about 45 minutes', () => {
  const r = roster([leg('a', 'DEL', 'BOM', '2026-10-10T10:00', '2026-10-10T12:00')]);
  const bedtime = (chronotype: CrewPreferences['chronotype']) =>
    generateCircadianPlan(r, { ...prefs, chronotype }).events.find((e) => e.type === 'anchor_sleep' && e.dutyDate === '2026-10-11')!.startHbtStr;
  assert.equal(bedtime('lark'), '22:15');
  assert.equal(bedtime('intermediate'), '23:00');
  assert.equal(bedtime('owl'), '23:45');
  for (const chronotype of ['lark', 'owl'] as const) {
    assert.deepEqual(problems(generateCircadianPlan(r, { ...prefs, chronotype })), [], chronotype);
  }
});

test('bunk-rest shift places the crew-rest nap in the chosen half, ending before landing', () => {
  const r = roster([leg('lh', 'DEL', 'LHR', '2026-10-10T02:00', '2026-10-10T11:00', 1)]); // 9-hour sector
  const nap = (shift?: 'shift1' | 'shift2') =>
    generateCircadianPlan(r, { ...prefs, bunkShiftAssignments: shift ? { lh: shift } : undefined }).events.find((e) => e.id === 'crew-rest-lh')!;
  const dep = Date.parse(r.flights[0].departureTimeUtc);
  const arr = Date.parse(r.flights[0].arrivalTimeUtc);
  const first = nap('shift1');
  const second = nap('shift2');
  assert.ok(Date.parse(first.endUtc) <= dep + (arr - dep) / 2, 'first shift nap in the first half');
  assert.ok(Date.parse(second.startUtc) >= dep + (arr - dep) / 2, 'second shift nap in the second half');
  assert.ok(Date.parse(second.endUtc) <= arr - 60 * 60000, 'ends at least an hour before landing');
  assert.equal(first.durationMinutes, 20);
});

test('a chosen bunk shift adds a nap on a 5-hour sector; no choice means none', () => {
  const r = roster([leg('mid', 'DEL', 'SIN', '2026-10-10T09:00', '2026-10-10T14:30', 8)]);
  assert.equal(generateCircadianPlan(r, prefs).events.some((e) => e.id === 'crew-rest-mid'), false);
  assert.equal(generateCircadianPlan(r, { ...prefs, bunkShiftAssignments: { mid: 'shift2' } }).events.some((e) => e.id === 'crew-rest-mid'), true);
});

test('a logged short night moves the next bedtime up to an hour earlier, only while recent', () => {
  const r = roster([]);
  const loggedAt = new Date();
  const withLog = (hours: number, at: Date) =>
    generateCircadianPlan(r, { ...prefs, actualLastSleepHours: hours, actualLastSleepLoggedAt: at.toISOString() });
  const nextNight = (p: CircadianPlan) =>
    p.events.filter((e) => e.type === 'anchor_sleep' && Date.parse(e.startUtc) > loggedAt.getTime()).sort((a, b) => Date.parse(a.startUtc) - Date.parse(b.startUtc))[0];

  const normal = nextNight(generateCircadianPlan(r, prefs));
  const short = nextNight(withLog(5, loggedAt));
  assert.equal(Date.parse(normal.startUtc) - Date.parse(short.startUtc), 60 * 60000, 'one hour earlier');
  assert.match(short.subtitle, /short sleep last night/);

  const old = nextNight(withLog(5, new Date(loggedAt.getTime() - 3 * 86400000)));
  assert.equal(old.startUtc, normal.startUtc, 'a 3-day-old log no longer applies');

  const fine = nextNight(withLog(7.5, loggedAt));
  assert.equal(fine.startUtc, normal.startUtc, 'a normal night changes nothing');
  assert.deepEqual(problems(withLog(4, loggedAt)), []);
});

test('the day outlook is in words with reasons, never a score', () => {
  const plan = generateCircadianPlan(
    roster([
      leg('out', 'DEL', 'DXB', '2026-10-10T23:30', '2026-10-11T02:00', 4),
      leg('back', 'DXB', 'DEL', '2026-10-11T03:30', '2026-10-11T06:30', 5.5),
    ]),
    prefs
  );
  const duty = plan.dailySummaries.find((d) => d.dateStr === '2026-10-10')!;
  assert.equal(duty.outlook?.level, 'watch');
  assert.ok(duty.outlook!.reasons.some((r) => r.includes('body-clock night')));
  assert.match(duty.keyGuidance, /^Keep an eye on today\. Because of flying through your body-clock night\./);
  const later = plan.dailySummaries.find((d) => d.dateStr === '2026-10-12')!;
  assert.equal(later.outlook?.level, 'steady');
  assert.equal(later.outlook?.headline, 'A day to rest');
});

test('airport standby is planned like a duty: no sleep during it, with a wake-up and leave-home time', () => {
  const plan = generateCircadianPlan(
    {
      ...roster([leg('a', 'DEL', 'BOM', '2026-10-10T10:00', '2026-10-10T12:00')]),
      standbyDuties: [{ id: 's1', kind: 'airport', airport: 'DEL', startUtc: '2026-10-12T00:30:00.000Z', endUtc: '2026-10-12T06:30:00.000Z' }],
    },
    prefs
  );
  assert.deepEqual(problems(plan), []);
  const sb = { start: Date.parse('2026-10-12T00:30:00.000Z'), end: Date.parse('2026-10-12T06:30:00.000Z') };
  const sleeps = plan.events.filter(isSleep);
  assert.ok(sleeps.every((e) => Date.parse(e.endUtc) <= sb.start || Date.parse(e.startUtc) >= sb.end), 'no sleep during airport standby');
  const prep = plan.events.find((e) => e.type === 'pre_flight_prep' && e.title.includes('airport standby'));
  assert.ok(prep, 'getting-ready step for the standby');
  assert.equal(prep!.endHbtStr, '06:00');
  const day = plan.dailySummaries.find((d) => d.dateStr === '2026-10-12')!;
  assert.equal(day.isOffDay, false);
  assert.equal(day.dutyType, 'standby');
  assert.equal(plan.monthlyStats.standbyHours, 6);
});

test('home standby shows a note but does not move sleep; a callout merges with it', () => {
  const base = roster([leg('a', 'DEL', 'BOM', '2026-10-10T10:00', '2026-10-10T12:00')]);
  const withHome = generateCircadianPlan(
    { ...base, standbyDuties: [{ id: 'h', kind: 'home', airport: 'DEL', startUtc: '2026-10-11T00:30:00.000Z', endUtc: '2026-10-11T12:30:00.000Z' }] },
    prefs
  );
  const without = generateCircadianPlan(base, prefs);
  const sleepTimes = (p: CircadianPlan) => p.events.filter(isSleep).map((e) => e.startUtc).join();
  assert.equal(sleepTimes(withHome), sleepTimes(without));
  assert.ok(withHome.events.some((e) => e.type === 'standby' && e.title.includes('Home standby')));

  const callout = generateCircadianPlan(
    {
      ...roster([leg('c', 'DEL', 'BOM', '2026-10-12T09:00', '2026-10-12T11:00')]),
      standbyDuties: [{ id: 's', kind: 'airport', airport: 'DEL', startUtc: '2026-10-12T00:30:00.000Z', endUtc: '2026-10-12T06:30:00.000Z' }],
    },
    prefs
  );
  assert.equal(callout.events.filter((e) => e.type === 'pre_flight_prep').length, 1, 'standby and callout flight are one duty');
  assert.deepEqual(problems(callout), []);
});

test('positioning flights are duty time but not flying hours', () => {
  const plan = generateCircadianPlan(
    roster([
      { ...leg('dh', 'DEL', 'BOM', '2026-10-10T10:00', '2026-10-10T12:00'), isPositioning: true },
      leg('w', 'BOM', 'DEL', '2026-10-10T13:30', '2026-10-10T15:30'),
    ]),
    prefs
  );
  assert.equal(plan.monthlyStats.totalFlightHours, 2);
  assert.match(plan.events.find((e) => e.id === 'flight-dh')!.title, /^Positioning \(as passenger\)/);
  assert.deepEqual(problems(plan), []);
});
