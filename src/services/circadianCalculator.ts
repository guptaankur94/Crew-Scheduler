import {
  CircadianEvent,
  CircadianPlan,
  CrewPreferences,
  CrewRank,
  DailyCircadianSummary,
  RosterData,
  SalaryBreakdown,
  SalaryCurrency,
  ScientificCitation,
} from '../types/circadian';
import { lookupAirport } from '../data/airports';
import { buildPlanEvents, flightInBodyNight, groupDuties, HomeClock, planRange, shortSleepCatchUpMs } from './planEngine';

// Format helper for UTC ISO string to time string with timezone offset
export function formatTimeWithTz(isoUtc: string, tzOffsetHours: number): string {
  const date = new Date(isoUtc);
  const utcMs = date.getTime();
  const targetMs = utcMs + tzOffsetHours * 3600000;
  const targetDate = new Date(targetMs);

  const hours = targetDate.getUTCHours().toString().padStart(2, '0');
  const minutes = targetDate.getUTCMinutes().toString().padStart(2, '0');
  const sign = tzOffsetHours >= 0 ? '+' : '-';
  const absOffset = Math.abs(tzOffsetHours);
  const offsetH = Math.floor(absOffset);
  const offsetM = Math.round((absOffset - offsetH) * 60);
  const tzStr = `UTC${sign}${offsetH}${offsetM > 0 ? `:${offsetM}` : ''}`;

  return `${hours}:${minutes} (${tzStr})`;
}

export function formatShortTime(isoUtc: string, tzOffsetHours: number): string {
  const date = new Date(isoUtc);
  const targetDate = new Date(date.getTime() + tzOffsetHours * 3600000);
  const hours = targetDate.getUTCHours().toString().padStart(2, '0');
  const minutes = targetDate.getUTCMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

export function formatDateLabel(isoUtc: string, tzOffsetHours: number): string {
  const date = new Date(isoUtc);
  const targetDate = new Date(date.getTime() + tzOffsetHours * 3600000);
  const options: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' };
  return targetDate.toLocaleDateString('en-US', options);
}

// Sources behind each kind of advice. Every entry names a real document and links to it;
// wording stays within what the source supports. Pending review by a sleep physician.
const FMG_URL = 'https://www.iata.org/contentassets/39bb2b7d6d5b40c6abf88c11111fcd12/fatigue-management-guide_airline20operators.pdf';

export const CITATIONS = {
  anchor_sleep: {
    ruleId: 'SLEEP-01',
    evidence: 'strong',
    organization: 'Peer-reviewed research',
    studyTitle: 'Mollicone et al. 2008: total sleep per 24 hours and performance',
    keyFinding: 'Alertness depends mainly on total sleep in each 24 hours, whether it comes in one block or a main sleep plus a nap.',
    explanation: 'Most adults need about 7 hours or more. Regularly getting 6 hours or less builds up effects that people tend not to notice in themselves.',
    actionableTip: 'Keep the room dark and cool (about 18–20 °C). An eye mask and earplugs help in hotels.',
    sourceUrl: 'https://europepmc.org/article/MED/19194521',
  },
  recovery_sleep: {
    ruleId: 'SLEEP-02',
    evidence: 'moderate',
    organization: 'ICAO / IATA / IFALPA',
    studyTitle: 'Fatigue Management Guide for Airline Operators (2015)',
    keyFinding: 'Recovering from short or disrupted sleep usually takes more than one night; the guide suggests two consecutive nights of unrestricted sleep.',
    explanation: 'After a night or early duty, sleeping soon after you get home or to the hotel, in a dark room, makes the most of the time available.',
    actionableTip: 'Wind down with dim light for a short while before bed, and keep the room dark and cool.',
    sourceUrl: FMG_URL,
  },
  nasa_nap_26: {
    ruleId: 'NAP-01',
    evidence: 'moderate',
    organization: 'NASA Ames',
    studyTitle: 'NASA Technical Memorandum 108839 (Rosekind et al., 1994)',
    keyFinding: 'Pilots given a 40-minute rest opportunity on long flights slept about 26 minutes on average and had fewer attention lapses and micro-sleeps afterwards.',
    explanation: 'This study was on pilots, not cabin crew. Other research finds that naps of about 10–20 minutes help quickly, while naps of 30 minutes or more can leave you groggy for 15–30 minutes.',
    actionableTip: 'Aim for a 10–20 minute nap and allow time to wake up properly before safety tasks or driving.',
    sourceUrl: 'https://ntrs.nasa.gov/api/citations/19950006379/downloads/19950006379.pdf',
  },
  pre_duty_90_nap: {
    ruleId: 'NAP-02',
    evidence: 'moderate',
    organization: 'Peer-reviewed research',
    studyTitle: 'Dinges et al. 1987; Hilditch & McHill 2019: naps before night duty and sleep inertia',
    keyFinding: 'A nap taken before a night of duty helps alertness more than one taken later in the night.',
    explanation: 'Longer naps give more benefit but cause more grogginess on waking (sleep inertia), usually 15–30 minutes and sometimes longer.',
    actionableTip: 'Finish the nap well before you leave for the airport so any grogginess has passed.',
    sourceUrl: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC6710480/',
  },
  chrono_nutrition_window: {
    ruleId: 'MEAL-01',
    evidence: 'limited',
    organization: 'Peer-reviewed research',
    studyTitle: 'Liu et al. 2022 (New England Journal of Medicine): time-restricted eating trial',
    keyFinding: 'Eating mostly in the daytime is reasonable, but large trials find strict eating windows no better for weight than simply eating less.',
    explanation: 'Treat this window as a gentle guide, not a rule. Do not fast through a duty to stay inside it.',
    actionableTip: 'Have balanced meals with protein and vegetables when you can, and keep water with you.',
    sourceUrl: 'https://doi.org/10.1056/NEJMoa2114833',
  },
  gut_rest_night: {
    ruleId: 'MEAL-02',
    evidence: 'moderate',
    organization: 'Peer-reviewed research',
    studyTitle: 'Centofanti et al. 2024: meal versus snack during simulated night work',
    keyFinding: 'A full meal in the middle of the night worsened next-day blood-sugar control more than a small snack did.',
    explanation: 'Your body handles food less well during its biological night. A small snack avoids most of the effect.',
    actionableTip: 'Have your main meal before a night duty. If you get hungry during the night, choose a small snack rather than a meal.',
    sourceUrl: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC11663163/',
  },
  caffeine_cutoff: {
    ruleId: 'CAF-01',
    evidence: 'moderate',
    organization: 'Peer-reviewed research',
    studyTitle: 'Gardiner et al. 2025: caffeine dose, timing and sleep',
    keyFinding: 'About one cup of coffee (around 100 mg) up to about 4 hours before bed had little effect on sleep; a large dose (400 mg) should stop about 12 hours before.',
    explanation: 'Your cut-off follows how much caffeine you usually have (Settings): 6 hours for one coffee or a few cups of chai, 8 for two coffees, 12 for more. Caffeine disturbs daytime sleep after a night duty more than night sleep, so before a daytime sleep the app adds 2 hours; that margin is our own choice, as research has not pinned down the exact amount. Daily limits: 400 mg, or 200 mg in pregnancy (EFSA).',
    actionableTip: 'Have coffee early in a duty rather than near its end, and stop earlier before daytime sleep.',
    sourceUrl: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC11985402/',
  },
  melatonin_shield: {
    ruleId: 'LIGHT-02',
    evidence: 'moderate',
    organization: 'Peer-reviewed research',
    studyTitle: 'Crowley et al. 2003: bright light at work and dark sunglasses on the way home',
    keyFinding: 'Night workers who wore dark sunglasses on the way home in the morning adapted better to their sleep schedule.',
    explanation: 'Bright morning light tells your body clock it is daytime, which can make it harder to sleep when you get home.',
    actionableTip: 'Wear dark sunglasses from the airport until you are in a darkened room.',
    sourceUrl: 'https://europepmc.org/article/MED/14667152',
  },
  daylight: {
    ruleId: 'LIGHT-01',
    evidence: 'moderate',
    organization: 'Peer-reviewed research',
    studyTitle: 'Brown et al. 2022: expert recommendations on daytime and evening light',
    keyFinding: 'Bright light in the daytime and dim light in the evening help keep your body clock steady.',
    explanation: 'Daylight is far brighter than indoor lighting, so time outdoors in the morning is an easy way to get it.',
    actionableTip: 'Spend some time in daylight in the morning, and keep lights dim in the evening before sleep.',
    sourceUrl: 'https://europepmc.org/article/MED/35298459',
  },
  prep: {
    ruleId: 'PREP-01',
    evidence: 'practical',
    organization: 'General guidance',
    studyTitle: 'Practical tip, not from a specific study',
    keyFinding: 'This time is worked back from your report time using your own travel and getting-ready settings.',
    explanation: 'In an FAA survey of US flight attendants, fear of oversleeping was one of the main things disturbing sleep before duty. A reliable alarm helps.',
    actionableTip: 'Set more than one alarm, and pack your bag, documents and uniform the evening before.',
  },
  wocl_risk: {
    ruleId: 'ALERT-01',
    evidence: 'moderate',
    organization: 'ICAO / IATA / IFALPA',
    studyTitle: 'Fatigue Management Guide for Airline Operators (2015)',
    keyFinding: 'For people adjusted to their home time, alertness is usually lowest in the early hours, roughly 02:00–06:00.',
    explanation: 'This window is an average across people. Yours may be earlier or later, and it moves after travel or night work.',
    actionableTip: 'Move around when duties allow, drink water, and cross-check tasks with your crew.',
    sourceUrl: FMG_URL,
  },
  exercise_cutoff: {
    ruleId: 'EXER-01',
    evidence: 'moderate',
    organization: 'Peer-reviewed research',
    studyTitle: 'Leota et al. 2025: evening exercise and sleep across 4 million nights',
    keyFinding: 'Hard exercise that ended within about 4 hours of bedtime was linked to later, shorter and poorer sleep. Lighter exercise had little effect.',
    explanation: 'This is a link seen in wearable data, not a trial, so treat it as a sensible guide. After a night duty, sleep comes first; keep movement gentle.',
    actionableTip: 'Do hard workouts earlier in the day. A walk or stretching in the evening is fine.',
    sourceUrl: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC12000559/',
  },
  alcohol_cutoff: {
    ruleId: 'ALC-01',
    evidence: 'regulation',
    organization: 'DGCA India',
    studyTitle: 'DGCA rules on alcohol for crew (12 hours before flight duty)',
    keyFinding: 'Crew must not drink alcohol in the 12 hours before a flight duty, and may be breath-tested before flying.',
    explanation: 'Even a couple of drinks also reduce deep and dream sleep (Gardiner et al. 2025). Your airline may set a longer limit; follow whichever is stricter.',
    actionableTip: 'Plan the last drink at least 12 hours before check-in, or before your standby starts.',
    sourceUrl: 'https://www.teamleaseregtech.com/updates/article/26621/dgca-notified-the-procedure-for-medical-examination-of-aircraft-person/',
  },
  checkin_tip: {
    ruleId: 'PREP-02',
    evidence: 'practical',
    organization: 'General guidance',
    studyTitle: 'Practical tip, not from a specific study',
    keyFinding: 'Briefing and safety checks need your full attention.',
    explanation: 'Arriving rested, fed and with time to spare makes the start of duty calmer.',
    actionableTip: 'Have water and a light snack before you report if you have not eaten recently.',
  },
  long_flight: {
    ruleId: 'MOVE-01',
    evidence: 'strong',
    organization: 'Peer-reviewed research',
    studyTitle: 'Kuipers et al. 2007: blood clots after flights of 4 hours or more',
    keyFinding: 'The risk of a blood clot is higher in the weeks after flights of 4 hours or more, though it stays low overall.',
    explanation: 'Moving your legs and staying hydrated are simple ways to look after yourself on long sectors.',
    actionableTip: 'Drink water regularly and move around or flex your calves when duties allow.',
    sourceUrl: 'https://europepmc.org/article/MED/17896862',
  },
  signoff_tip: {
    ruleId: 'PREP-03',
    evidence: 'practical',
    organization: 'General guidance',
    studyTitle: 'Practical tip, not from a specific study',
    keyFinding: 'The time between sign-off and sleep is often longer than expected.',
    explanation: 'In an FAA survey of US flight attendants, getting from the aircraft door to the hotel took 49 minutes on average.',
    actionableTip: 'If you are heading to sleep in daylight, keep sunglasses handy for the trip.',
    sourceUrl: 'https://www.faa.gov/sites/faa.gov/files/data_research/research/med_humanfacs/oamtechreports/200924.pdf',
  },
} satisfies Record<string, ScientificCitation>;

export { calculateSalaryBreakdown, rosterStandbyHours } from './salary';
import { rosterStandbyHours } from './salary';
import { computePeriodStats, defaultPeriod } from './periodStats';

export function generateCircadianPlan(
  roster: RosterData,
  preferences: CrewPreferences,
  customNudges: Record<string, number> = {} // eventId -> offset in minutes
): CircadianPlan {
  const events: CircadianEvent[] = [];
  const hbtOffset = preferences.homeBaseTzOffset;
  // Home time follows the home airport's real time zone (daylight saving included) when it is known
  const clock = new HomeClock(hbtOffset, lookupAirport(roster.homeBase)?.timeZone);
  const duties = groupDuties(roster.flights, roster.homeBase, roster.standbyDuties ?? []);
  // Every flight belongs to the home-time date its duty starts on, so a duty that crosses midnight stays together
  const dutyDateByFlight = new Map<string, string>();
  duties.forEach((d) => d.flights.forEach((f) => dutyDateByFlight.set(f.id, clock.date(d.startMs))));

  // 1. Map all Flights & Ground Duties
  roster.flights.forEach((flight, idx) => {
    // Ground Report Duty
    const reportStart = flight.reportTimeUtc;
    const reportEnd = flight.departureTimeUtc;
    const reportDur = Math.round((new Date(reportEnd).getTime() - new Date(reportStart).getTime()) / 60000);

    const flightDutyDate = dutyDateByFlight.get(flight.id) ?? clock.date(Date.parse(flight.reportTimeUtc));

    // Only the first sector of a duty has a check-in of its own (see dutyTimes)
    if (reportDur > 0) events.push({
      id: `duty-report-${flight.id}`,
      dutyDate: flightDutyDate,
      type: 'duty_ground',
      title: `Pre-Flight Check-In & Briefing (${flight.origin})`,
      subtitle: `Reporting for Flight ${flight.flightNumber} to ${flight.destination}`,
      startUtc: reportStart,
      endUtc: reportEnd,
      durationMinutes: reportDur,
      startLocalStr: formatShortTime(reportStart, flight.originTzOffset),
      endLocalStr: formatShortTime(reportEnd, flight.originTzOffset),
      startHbtStr: clock.time(Date.parse(reportStart)),
      endHbtStr: clock.time(Date.parse(reportEnd)),
      scientificCitation: CITATIONS.checkin_tip,
      priority: 'critical',
      color: '#f59e0b', // amber
      icon: 'briefcase',
    });

    // Flight Leg
    const flStart = flight.departureTimeUtc;
    const flEnd = flight.arrivalTimeUtc;
    const flDur = flight.durationMinutes;

    // Does any part of the flight fall in the home-time body-clock night (02:00–06:00)?
    const isWocl = flightInBodyNight(flight, clock);

    events.push({
      id: `flight-${flight.id}`,
      dutyDate: flightDutyDate,
      type: 'flight',
      title: `${flight.isPositioning ? 'Positioning (as passenger) ' : 'Flight '}${flight.flightNumber}: ${flight.origin} ✈️ ${flight.destination}`,
      subtitle: `${flight.originCity || flight.origin} to ${flight.destinationCity || flight.destination} • ${Math.floor(flDur / 60)}h ${flDur % 60}m ${flight.aircraftType ? `• ${flight.aircraftType}` : ''}`,
      startUtc: flStart,
      endUtc: flEnd,
      durationMinutes: flDur,
      startLocalStr: formatShortTime(flStart, flight.originTzOffset),
      endLocalStr: formatShortTime(flEnd, flight.destTzOffset),
      startHbtStr: clock.time(Date.parse(flStart)),
      endHbtStr: clock.time(Date.parse(flEnd)),
      scientificCitation: isWocl ? CITATIONS.wocl_risk : CITATIONS.long_flight,
      priority: 'critical',
      color: isWocl ? '#ef4444' : '#3b82f6', // red if red-eye/WOCL, else blue
      icon: 'plane',
    });

    // If red-eye / WOCL, add a dedicated WOCL warning block
    if (isWocl) {
      events.push({
        id: `wocl-warning-${flight.id}`,
        dutyDate: flightDutyDate,
        type: 'wocl_risk',
        title: '⚠️ Body-clock night',
        subtitle: 'Roughly 02:00–06:00 home time: usually your least alert hours',
        startUtc: flStart,
        endUtc: flEnd,
        durationMinutes: flDur,
        startLocalStr: formatShortTime(flStart, flight.originTzOffset),
        endLocalStr: formatShortTime(flEnd, flight.destTzOffset),
        startHbtStr: clock.time(Date.parse(flStart)),
        endHbtStr: clock.time(Date.parse(flEnd)),
        scientificCitation: CITATIONS.wocl_risk,
        priority: 'critical',
        color: '#dc2626',
        icon: 'alert-triangle',
      });
    }

    // Post-Flight Release Duty (30-45m)
    const debriefStart = flight.arrivalTimeUtc;
    const debriefEnd = flight.releaseTimeUtc;
    const debriefDur = Math.round((new Date(debriefEnd).getTime() - new Date(debriefStart).getTime()) / 60000);

    // Only the last sector of a duty has a sign-off of its own
    if (debriefDur > 0) events.push({
      id: `duty-release-${flight.id}`,
      dutyDate: flightDutyDate,
      type: 'duty_ground',
      title: `After landing: deboarding & sign-off (${flight.destination})`,
      subtitle: 'Post-flight duties before you are released',
      startUtc: debriefStart,
      endUtc: debriefEnd,
      durationMinutes: debriefDur,
      startLocalStr: formatShortTime(debriefStart, flight.destTzOffset),
      endLocalStr: formatShortTime(debriefEnd, flight.destTzOffset),
      startHbtStr: clock.time(Date.parse(debriefStart)),
      endHbtStr: clock.time(Date.parse(debriefEnd)),
      scientificCitation: CITATIONS.signoff_tip,
      priority: 'recommended',
      color: '#d97706',
      icon: 'check-circle-2',
    });
  });

  // 2. Sleep, naps, caffeine, meals and light, planned across the whole roster as one timeline
  const range = planRange(duties, roster, clock, new Date());
  const sortedDates = range.dates;
  const plan = buildPlanEvents({
    roster,
    preferences,
    customNudges,
    duties,
    range,
    clock,
    citations: CITATIONS,
  });
  events.push(...plan.events);
  const dayPrepMap = plan.prepByDate;

  // Sort all events chronologically
  events.sort((a, b) => new Date(a.startUtc).getTime() - new Date(b.startUtc).getTime());

  // 3. Calculate Daily Summaries
  let totalFlightMinutes = 0;
  let totalSectors = 0;
  let woclCount = 0;
  let dutyDaysCount = 0;
  let totalSleepAccumMinutes = 0;

  roster.flights.forEach((fl) => {
    // Positioning as a passenger is duty time but not flying time
    if (!fl.isPositioning) totalFlightMinutes += fl.durationMinutes;
    totalSectors += 1;
    if (flightInBodyNight(fl, clock)) woclCount += 1;
  });

  // The day after a logged short night (home time), if the log is still recent
  const catchUp = shortSleepCatchUpMs(preferences, Date.now());
  const shortNightDate = catchUp ? clock.date(catchUp.loggedAtMs) : undefined;

  // Days a duty ends on (an overnight duty from the evening before)
  const releaseDates = new Set(roster.flights.map((f) => clock.date(Date.parse(f.releaseTimeUtc))));

  const dailySummaries: DailyCircadianSummary[] = sortedDates.map((dateStr, idx) => {
    const dayEvents = events.filter((e) => e.dutyDate === dateStr);
    const dayFlights = dayEvents.filter((e) => e.type === 'flight');
    const sleepEvents = dayEvents.filter((e) => e.type === 'anchor_sleep' || e.type === 'recovery_sleep');
    const totalSleepMin = sleepEvents.reduce((acc, cur) => acc + cur.durationMinutes, 0);
    totalSleepAccumMinutes += totalSleepMin;

    const naps = dayEvents.filter((e) => e.type === 'nasa_nap').length;
    const woclExposure = dayEvents.filter((e) => e.type === 'wocl_risk').reduce((acc, cur) => acc + cur.durationMinutes, 0);

    const hasStandby = dayEvents.some((e) => e.type === 'standby');
    // A non-flying day the roster lists as leave, sick or training is not a day off
    const listedOther = (roster.otherDuties ?? []).find((d) => d.date === dateStr && d.kind !== 'off' && d.kind !== 'other');
    const isTraining = dayFlights.length === 0 && !hasStandby && listedOther?.kind === 'training';
    const isOffDay = dayFlights.length === 0 && !hasStandby && !isTraining;
    if (!isOffDay) dutyDaysCount += 1;

    // A worded outlook for the day, with its reasons, instead of a number
    const reasons: string[] = [];
    const prep = dayPrepMap.get(dateStr);
    if (prep?.dutyCategory === 'early_morning' && prep.wakeUpUtc && clock.hour(Date.parse(prep.wakeUpUtc)) < 5) {
      reasons.push(`an early start (wake ${prep.wakeUpHbt})`);
    }
    if (woclExposure > 0) reasons.push('flying through your body-clock night');
    if (!isOffDay && totalSleepMin > 0 && totalSleepMin < 6 * 60) {
      reasons.push(`less than 6 hours of planned sleep (${(totalSleepMin / 60).toFixed(1)}h)`);
    }
    if (shortNightDate === dateStr) reasons.push("last night's sleep was short");

    const level: NonNullable<DailyCircadianSummary['outlook']>['level'] =
      reasons.length >= 2 ? 'harder' : reasons.length === 1 ? 'watch' : 'steady';
    const outlook: DailyCircadianSummary['outlook'] = {
      level,
      headline: level === 'harder' ? 'Harder day ahead' : level === 'watch' ? 'Keep an eye on today' : isOffDay ? 'A day to rest' : 'A steadier day',
      reasons,
      tip:
        level === 'steady'
          ? isOffDay
            ? 'Keep your usual bedtime so the next duty is easier.'
            : 'Follow your plan as usual.'
          : woclExposure > 0
          ? 'Protect your nap before the duty, have caffeine early in it, and move around on board when you can.'
          : 'Protect any nap you can get and go to bed on time tonight.',
    };
    const guidance = `${outlook.headline}.${reasons.length ? ` Because of ${reasons.join(' and ')}.` : ''} ${outlook.tip}`;

    // Layover station details if night ends in non-home airport
    let layoverStation: DailyCircadianSummary['layoverStation'] = undefined;
    const rosterFlightsOnDay = roster.flights.filter((f) => dutyDateByFlight.get(f.id) === dateStr);
    const lastDayFlight = rosterFlightsOnDay[rosterFlightsOnDay.length - 1];
    if (lastDayFlight && lastDayFlight.destination !== roster.homeBase) {
      const destAirport = {
        iata: lastDayFlight.destination,
        city: lookupAirport(lastDayFlight.destination)?.city || lastDayFlight.destinationCity || lastDayFlight.destination,
      };
      const tzDiff = lastDayFlight.destTzOffset - clock.offsetAt(Date.parse(lastDayFlight.arrivalTimeUtc));
      const tzDiffStr = tzDiff === 0 ? 'Same time as home' : `${tzDiff > 0 ? '+' : ''}${tzDiff}h vs home`;
      layoverStation = {
        city: destAirport.city,
        iata: destAirport.iata,
        hotelBlackoutRating: 'Use an eye mask or blackout curtains',
        diningTip: 'On a short layover, keep meals near your home-time mealtimes where you can.',
        tempCelsius: 19,
        timeZoneDiffStr: tzDiffStr,
      };
    }

    return {
      dateStr,
      dayLabel: formatDateLabel(`${dateStr}T12:00:00Z`, 0),
      dayNumber: idx + 1,
      isOffDay,
      // Blank on the roster: no flight, standby or listed day (an OFF, leave, etc. is listed)
      // (a day an overnight duty ends on is not blank)
      noDuty: isOffDay && range.rosterDates.has(dateStr) && !(roster.otherDuties ?? []).some((d) => d.date === dateStr) && !releaseDates.has(dateStr),
      dutyType:
        dayFlights.length > 0
          ? 'flight'
          : hasStandby
          ? 'standby'
          : listedOther
          ? listedOther.kind === 'training'
            ? 'training'
            : listedOther.kind === 'leave'
            ? 'leave'
            : 'sick'
          : 'off',
      totalSleepHours: Number((totalSleepMin / 60).toFixed(1)),
      napsCount: naps,
      eatingWindowHours: 9.5,
      woclExposureMinutes: woclExposure,
      fatigueRiskLevel: level === 'harder' ? 'high' : level === 'watch' ? 'moderate' : 'low',
      keyGuidance: guidance,
      outlook,
      // A day is a roster day only when the roster covers it; with no roster at all, every day is outside it
      outsideRoster: !range.rosterDates.has(dateStr),
      prepDetails: dayPrepMap.get(dateStr),
      layoverStation,
    };
  });

  const offDaysCount = sortedDates.length - dutyDaysCount;
  const avgSleepPerDay = sortedDates.length > 0 ? Number((totalSleepAccumMinutes / 60 / sortedDates.length).toFixed(1)) : 7.5;
  // Only standby the roster actually contains; never an assumed figure
  const standbyHours = rosterStandbyHours(roster);

  const monthlyStats = {
    totalFlightHours: Number((totalFlightMinutes / 60).toFixed(1)),
    totalSectors,
    dutyDays: dutyDaysCount,
    offDays: offDaysCount,
    woclNightFlights: woclCount,
    avgSleepPerDay,
    standbyHours,
  };

  // The salary estimate covers one pay period (calendar month unless a pay cycle is set): the one
  // containing today, or the most recent one with flights. Whole-roster totals stay in monthlyStats.
  const salaryPeriod = defaultPeriod(dailySummaries, clock.date(Date.now()), preferences.payPeriodStartDay);
  const salaryBreakdown = computePeriodStats({ roster, preferences, dailySummaries }, salaryPeriod).salary;

  // 4. Current status: what is happening now and what comes next
  const nowUtc = new Date().toISOString();
  const upcomingEvents = events.filter((e) => new Date(e.startUtc).getTime() > new Date(nowUtc).getTime());
  const activeEvents = events.filter(
    (e) => new Date(e.startUtc).getTime() <= new Date(nowUtc).getTime() && new Date(e.endUtc).getTime() >= new Date(nowUtc).getTime()
  );

  let currentPhase = 'No planned activity right now';
  let stateType: CircadianPlan['currentStatus']['stateType'] = 'alert';
  let summaryAdvice = 'Drink water regularly and keep to your plan for the next duty.';

  // Determine HBT hour for circadian modulation
  const nowDate = new Date();
  const hbtDate = new Date(nowDate.getTime() + clock.offsetAt(nowDate.getTime()) * 3600000);
  const hbtHour = hbtDate.getUTCHours() + hbtDate.getUTCMinutes() / 60;

  // Body-clock night is approximated as 02:00-06:00 home-base time (a population average, not a personal measurement)
  let biologicalPhase: CircadianPlan['currentStatus']['biologicalPhase'] = 'day';
  if (hbtHour >= 2 && hbtHour < 6) {
    biologicalPhase = 'night_nadir';
  } else if (hbtHour >= 21 || hbtHour < 2 || (hbtHour >= 6 && hbtHour < 7.5)) {
    biologicalPhase = 'transition';
  } else {
    biologicalPhase = 'day';
  }

  // The immediate action card reflects whichever planned event is active now
  let immediateAction: CircadianPlan['currentStatus']['immediateAction'] = {
    icon: 'check',
    title: 'Nothing scheduled right now',
    subtitle: 'Your next step is shown below.',
    urgency: 'info',
    actionType: 'rest',
  };

  if (activeEvents.length > 0) {
    const primary = activeEvents[0];
    if (primary.type === 'flight') {
      currentPhase = `Active Flight Duty (${primary.title})`;
      stateType = 'alert';
      summaryAdvice = 'Drink water regularly. Lighter, protein-rich snacks are easier than heavy or sugary ones.';
      immediateAction = {
        icon: 'plane',
        title: 'On duty',
        subtitle: 'Drink water regularly and move around when duties allow.',
        urgency: 'medium',
        actionType: 'flight',
      };
    } else if (primary.type === 'anchor_sleep' || primary.type === 'recovery_sleep') {
      currentPhase = 'Designated Sleep Block';
      stateType = 'sleep_prep';
      summaryAdvice = 'Keep the room dark and cool (about 18–20 °C) and the lights dim.';
      immediateAction = {
        icon: 'moon',
        title: 'Sleep time',
        subtitle: 'Dark, cool room (about 18–20 °C). Put the phone away.',
        urgency: 'high',
        actionType: 'rest',
      };
    } else if (primary.type === 'caffeine_cutoff') {
      currentPhase = 'Caffeine Restricted Window';
      stateType = 'caffeine_ban';
      summaryAdvice = 'Skip coffee, tea and energy drinks now so caffeine does not disturb your next sleep.';
      immediateAction = {
        icon: 'coffee-off',
        title: 'No more caffeine before your next sleep',
        subtitle: 'Caffeine taken now can still be in your system at bedtime.',
        urgency: 'medium',
        actionType: 'caffeine',
      };
    } else if (primary.type === 'fasting_window') {
      currentPhase = 'Body-clock night: keep food light';
      stateType = 'fasting';
      summaryAdvice = 'If you are hungry during your body-clock night, a small snack is better than a full meal.';
      immediateAction = {
        icon: 'utensils-off',
        title: 'Keep food light for now',
        subtitle: 'A small snack is easier on your body than a full meal at this hour.',
        urgency: 'info',
        actionType: 'fasting',
      };
    } else if (primary.type === 'wocl_risk') {
      currentPhase = 'Body-clock night (usually your least alert hours)';
      stateType = 'wocl_warning';
      summaryAdvice = 'Alertness is usually lowest now. Move around when you can and cross-check tasks with crew.';
      immediateAction = {
        icon: 'alert-triangle',
        title: 'Body-clock night',
        subtitle: 'Alertness is usually lowest now. Move around when you can and cross-check tasks.',
        urgency: 'high',
        actionType: 'rest',
      };
    } else if (primary.type === 'melatonin_shield') {
      immediateAction = {
        icon: 'glasses',
        title: 'Put on Dark Sunglasses Now',
        subtitle: 'Bright morning light now can make it harder to sleep when you get home.',
        urgency: 'high',
        actionType: 'sunglasses',
      };
    } else if (primary.type === 'nasa_nap') {
      immediateAction = {
        icon: 'moon',
        title: 'Nap window',
        subtitle: 'A 10–20 minute nap boosts alertness with little grogginess afterwards.',
        urgency: 'medium',
        actionType: 'nap',
      };
    }
  } else if (biologicalPhase === 'night_nadir') {
    immediateAction = {
      icon: 'moon',
      title: 'Body-clock night',
      subtitle: 'Usually your least alert hours. Keep lights dim if you are about to sleep.',
      urgency: 'medium',
      actionType: 'rest',
    };
  }

  const next = upcomingEvents[0] || events[0];
  const minutesUntil = next ? Math.max(0, Math.round((new Date(next.startUtc).getTime() - new Date(nowUtc).getTime()) / 60000)) : 0;

  return {
    roster,
    preferences,
    events,
    dailySummaries,
    monthlyStats,
    salaryBreakdown,
    generatedAt: nowUtc,
    currentStatus: {
      currentPhase,
      stateType,
      summaryAdvice,
      nextMilestoneTitle: next ? next.title : 'All Roster Duties Complete',
      nextMilestoneTime: next ? clock.time(Date.parse(next.startUtc)) : '--:--',
      minutesUntilNext: minutesUntil,
      biologicalPhase,
      immediateAction,
    },
  };
}
