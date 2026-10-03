import {
  CircadianEvent,
  CircadianPlan,
  CrewPreferences,
  CrewRank,
  DailyCircadianSummary,
  FlightLeg,
  PrepDetails,
  RosterData,
  SalaryBreakdown,
  SalaryCurrency,
  ScientificCitation,
} from '../types/circadian';
import { AIRPORTS } from '../data/airports';
import { formatAviationDate } from '../utils/dateUtils';

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

export const CITATIONS: Record<string, ScientificCitation> = {
  anchor_sleep: {
    organization: 'Peer-reviewed research',
    studyTitle: 'Mollicone et al. 2008: total sleep per 24 hours and performance',
    keyFinding: 'Alertness depends mainly on total sleep in each 24 hours, whether it comes in one block or a main sleep plus a nap.',
    explanation: 'Most adults need about 7 hours or more. Regularly getting 6 hours or less builds up effects that people tend not to notice in themselves.',
    actionableTip: 'Keep the room dark and cool (about 18–20 °C). An eye mask and earplugs help in hotels.',
    sourceUrl: 'https://europepmc.org/article/MED/19194521',
  },
  recovery_sleep: {
    organization: 'ICAO / IATA / IFALPA',
    studyTitle: 'Fatigue Management Guide for Airline Operators (2015)',
    keyFinding: 'Recovering from short or disrupted sleep usually takes more than one night; the guide suggests two consecutive nights of unrestricted sleep.',
    explanation: 'After a night or early duty, sleeping soon after you get home or to the hotel, in a dark room, makes the most of the time available.',
    actionableTip: 'Wind down with dim light for a short while before bed, and keep the room dark and cool.',
    sourceUrl: FMG_URL,
  },
  nasa_nap_26: {
    organization: 'NASA Ames',
    studyTitle: 'NASA Technical Memorandum 108839 (Rosekind et al., 1994)',
    keyFinding: 'Pilots given a 40-minute rest opportunity on long flights slept about 26 minutes on average and had fewer attention lapses and micro-sleeps afterwards.',
    explanation: 'This study was on pilots, not cabin crew. Other research finds that naps of about 10–20 minutes help quickly, while naps of 30 minutes or more can leave you groggy for 15–30 minutes.',
    actionableTip: 'Aim for a 10–20 minute nap and allow time to wake up properly before safety tasks or driving.',
    sourceUrl: 'https://ntrs.nasa.gov/api/citations/19950006379/downloads/19950006379.pdf',
  },
  pre_duty_90_nap: {
    organization: 'Peer-reviewed research',
    studyTitle: 'Dinges et al. 1987; Hilditch & McHill 2019: naps before night duty and sleep inertia',
    keyFinding: 'A nap taken before a night of duty helps alertness more than one taken later in the night.',
    explanation: 'Longer naps give more benefit but cause more grogginess on waking (sleep inertia), usually 15–30 minutes and sometimes longer.',
    actionableTip: 'Finish the nap well before you leave for the airport so any grogginess has passed.',
    sourceUrl: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC6710480/',
  },
  chrono_nutrition_window: {
    organization: 'Peer-reviewed research',
    studyTitle: 'Liu et al. 2022 (New England Journal of Medicine): time-restricted eating trial',
    keyFinding: 'Eating mostly in the daytime is reasonable, but large trials find strict eating windows no better for weight than simply eating less.',
    explanation: 'Treat this window as a gentle guide, not a rule. Do not fast through a duty to stay inside it.',
    actionableTip: 'Have balanced meals with protein and vegetables when you can, and keep water with you.',
    sourceUrl: 'https://doi.org/10.1056/NEJMoa2114833',
  },
  gut_rest_night: {
    organization: 'Peer-reviewed research',
    studyTitle: 'Centofanti et al. 2024: meal versus snack during simulated night work',
    keyFinding: 'A full meal in the middle of the night worsened next-day blood-sugar control more than a small snack did.',
    explanation: 'Your body handles food less well during its biological night. A small snack avoids most of the effect.',
    actionableTip: 'Have your main meal before a night duty. If you get hungry during the night, choose a small snack rather than a meal.',
    sourceUrl: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC11663163/',
  },
  caffeine_cutoff: {
    organization: 'Peer-reviewed research',
    studyTitle: 'Gardiner et al. 2025: caffeine dose, timing and sleep',
    keyFinding: 'About one cup of coffee (around 100 mg) up to about 4 hours before bed had little effect on sleep; a large dose (400 mg) should stop about 12 hours before.',
    explanation: 'Caffeine disturbs daytime sleep after a night duty more than normal night sleep. Daily limits: 400 mg, or 200 mg in pregnancy (EFSA).',
    actionableTip: 'Have coffee early in a duty rather than near its end, and stop earlier before daytime sleep.',
    sourceUrl: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC11985402/',
  },
  melatonin_shield: {
    organization: 'Peer-reviewed research',
    studyTitle: 'Crowley et al. 2003: bright light at work and dark sunglasses on the way home',
    keyFinding: 'Night workers who wore dark sunglasses on the way home in the morning adapted better to their sleep schedule.',
    explanation: 'Bright morning light tells your body clock it is daytime, which can make it harder to sleep when you get home.',
    actionableTip: 'Wear dark sunglasses from the airport until you are in a darkened room.',
    sourceUrl: 'https://europepmc.org/article/MED/14667152',
  },
  wocl_risk: {
    organization: 'ICAO / IATA / IFALPA',
    studyTitle: 'Fatigue Management Guide for Airline Operators (2015)',
    keyFinding: 'For people adjusted to their home time, alertness is usually lowest in the early hours, roughly 02:00–06:00.',
    explanation: 'This window is an average across people. Yours may be earlier or later, and it moves after travel or night work.',
    actionableTip: 'Move around when duties allow, drink water, and cross-check tasks with your crew.',
    sourceUrl: FMG_URL,
  },
};

// Salary breakdown calculator based on real airline cabin crew compensation models
export function calculateSalaryBreakdown(
  roster: RosterData,
  preferences: CrewPreferences,
  totalFlightMinutes: number,
  woclSectorsCount: number
): SalaryBreakdown {
  const currency = preferences.currency || 'INR';
  const rank = preferences.crewRank || 'senior';
  const flyingHours = Number((totalFlightMinutes / 60).toFixed(1));
  const standbyHours = roster.standbyHours || 16;
  const layoverCount = roster.layovers?.length || 2;

  const defaultRankConfigs: Record<SalaryCurrency, Record<CrewRank, { base: number; rate: number; sbyRate: number; layoverPerDiem: number; nightRate: number; title: string }>> = {
    INR: {
      junior: { base: 36000, rate: 480, sbyRate: 200, layoverPerDiem: 4500, nightRate: 1500, title: 'Junior Flight Attendant' },
      senior: { base: 48000, rate: 620, sbyRate: 300, layoverPerDiem: 6000, nightRate: 2500, title: 'Senior Cabin Crew' },
      lead: { base: 65000, rate: 820, sbyRate: 400, layoverPerDiem: 8000, nightRate: 3500, title: 'Lead / In-Flight Manager' },
    },
    AED: {
      junior: { base: 4500, rate: 60, sbyRate: 25, layoverPerDiem: 350, nightRate: 150, title: 'Cabin Crew Grade II' },
      senior: { base: 6200, rate: 75, sbyRate: 35, layoverPerDiem: 450, nightRate: 200, title: 'Senior Flight Steward / Stewardess' },
      lead: { base: 8500, rate: 95, sbyRate: 50, layoverPerDiem: 600, nightRate: 300, title: 'Purser / Cabin Service Manager' },
    },
    USD: {
      junior: { base: 2200, rate: 35, sbyRate: 15, layoverPerDiem: 120, nightRate: 50, title: 'Flight Attendant' },
      senior: { base: 3100, rate: 50, sbyRate: 22, layoverPerDiem: 160, nightRate: 80, title: 'Senior Flight Attendant' },
      lead: { base: 4200, rate: 65, sbyRate: 30, layoverPerDiem: 220, nightRate: 110, title: 'In-Flight Director / Purser' },
    },
  };

  const symbolMap: Record<SalaryCurrency, string> = {
    INR: '₹',
    AED: 'AED ',
    USD: '$',
  };

  const cfg = defaultRankConfigs[currency][rank];
  const baseFixedPay = preferences.customBasePay !== undefined ? preferences.customBasePay : cfg.base;
  const flyingRate = preferences.customHourlyRate !== undefined ? preferences.customHourlyRate : cfg.rate;
  const standbyRate = preferences.customStandbyRate !== undefined ? preferences.customStandbyRate : cfg.sbyRate;
  const layoverRate = preferences.customLayoverRate !== undefined ? preferences.customLayoverRate : cfg.layoverPerDiem;
  const nightRate = preferences.customNightRate !== undefined ? preferences.customNightRate : cfg.nightRate;

  const flyingPay = Math.round(flyingHours * flyingRate);
  const standbyPay = Math.round(standbyHours * standbyRate);
  const layoverPerDiem = layoverCount * layoverRate;
  const nightAllowance = woclSectorsCount * nightRate;
  const total = baseFixedPay + flyingPay + standbyPay + layoverPerDiem + nightAllowance;

  const isCustom = preferences.customBasePay !== undefined ||
    preferences.customHourlyRate !== undefined ||
    preferences.customStandbyRate !== undefined ||
    preferences.customLayoverRate !== undefined ||
    preferences.customNightRate !== undefined;

  return {
    totalEarnings: total,
    currency,
    currencySymbol: symbolMap[currency],
    baseFixedPay,
    flyingPay,
    flyingHours,
    flyingRate,
    standbyPay,
    standbyHours,
    standbyRate,
    layoverPerDiem,
    layoverCount,
    layoverRate,
    nightAllowance,
    nightSectors: woclSectorsCount,
    nightRate,
    rankTitle: cfg.title,
    isCustomRates: isCustom,
    source: preferences.payslipUploaded ? 'payslip' : isCustom ? 'custom' : 'standard',
  };
}

export function generateCircadianPlan(
  roster: RosterData,
  preferences: CrewPreferences,
  customNudges: Record<string, number> = {} // eventId -> offset in minutes
): CircadianPlan {
  const events: CircadianEvent[] = [];
  const hbtOffset = preferences.homeBaseTzOffset;
  const dayPrepMap = new Map<string, PrepDetails>();

  // 1. Map all Flights & Ground Duties
  roster.flights.forEach((flight, idx) => {
    // Ground Report Duty
    const reportStart = flight.reportTimeUtc;
    const reportEnd = flight.departureTimeUtc;
    const reportDur = Math.round((new Date(reportEnd).getTime() - new Date(reportStart).getTime()) / 60000);

    events.push({
      id: `duty-report-${flight.id}`,
      type: 'duty_ground',
      title: `Pre-Flight Check-In & Briefing (${flight.origin})`,
      subtitle: `Reporting for Flight ${flight.flightNumber} to ${flight.destination}`,
      startUtc: reportStart,
      endUtc: reportEnd,
      durationMinutes: reportDur,
      startLocalStr: formatShortTime(reportStart, flight.originTzOffset),
      endLocalStr: formatShortTime(reportEnd, flight.originTzOffset),
      startHbtStr: formatShortTime(reportStart, hbtOffset),
      endHbtStr: formatShortTime(reportEnd, hbtOffset),
      scientificCitation: {
        organization: 'General guidance',
        studyTitle: 'Practical tip, not from a specific study',
        keyFinding: 'Briefing and safety checks need your full attention.',
        explanation: 'Arriving rested, fed and with time to spare makes the start of duty calmer.',
        actionableTip: 'Have water and a light snack before you report if you have not eaten recently.',
      },
      priority: 'critical',
      color: '#f59e0b', // amber
      icon: 'briefcase',
    });

    // Flight Leg
    const flStart = flight.departureTimeUtc;
    const flEnd = flight.arrivalTimeUtc;
    const flDur = flight.durationMinutes;

    // Check if flight overlaps WOCL (02:00 - 06:00 Home Base Time)
    const depDateHbt = new Date(new Date(flStart).getTime() + hbtOffset * 3600000);
    const depHourHbt = depDateHbt.getUTCHours() + depDateHbt.getUTCMinutes() / 60;
    const isWocl = (depHourHbt >= 1.5 && depHourHbt <= 6.0) || flight.isRedEye;

    const flightDutyDate = flight.reportTimeUtc.slice(0, 10);

    events.push({
      id: `flight-${flight.id}`,
      dutyDate: flightDutyDate,
      type: 'flight',
      title: `Flight ${flight.flightNumber}: ${flight.origin} ✈️ ${flight.destination}`,
      subtitle: `${flight.originCity || flight.origin} to ${flight.destinationCity || flight.destination} • ${Math.floor(flDur / 60)}h ${flDur % 60}m ${flight.aircraftType ? `• ${flight.aircraftType}` : ''}`,
      startUtc: flStart,
      endUtc: flEnd,
      durationMinutes: flDur,
      startLocalStr: formatShortTime(flStart, flight.originTzOffset),
      endLocalStr: formatShortTime(flEnd, flight.destTzOffset),
      startHbtStr: formatShortTime(flStart, hbtOffset),
      endHbtStr: formatShortTime(flEnd, hbtOffset),
      scientificCitation: isWocl ? CITATIONS.wocl_risk : {
        organization: 'Peer-reviewed research',
        studyTitle: 'Kuipers et al. 2007: blood clots after flights of 4 hours or more',
        keyFinding: 'The risk of a blood clot is higher in the weeks after flights of 4 hours or more, though it stays low overall.',
        explanation: 'Moving your legs and staying hydrated are simple ways to look after yourself on long sectors.',
        actionableTip: 'Drink water regularly and move around or flex your calves when duties allow.',
        sourceUrl: 'https://europepmc.org/article/MED/17896862',
      },
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
        startHbtStr: formatShortTime(flStart, hbtOffset),
        endHbtStr: formatShortTime(flEnd, hbtOffset),
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

    events.push({
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
      startHbtStr: formatShortTime(debriefStart, hbtOffset),
      endHbtStr: formatShortTime(debriefEnd, hbtOffset),
      scientificCitation: {
        organization: 'General guidance',
        studyTitle: 'Practical tip, not from a specific study',
        keyFinding: 'The time between sign-off and sleep is often longer than expected.',
        explanation: 'In an FAA survey of US flight attendants, getting from the aircraft door to the hotel took 49 minutes on average.',
        actionableTip: 'If you are heading to sleep in daylight, keep sunglasses handy for the trip.',
        sourceUrl: 'https://www.faa.gov/sites/faa.gov/files/data_research/research/med_humanfacs/oamtechreports/200924.pdf',
      },
      priority: 'recommended',
      color: '#d97706',
      icon: 'check-circle-2',
    });
  });

  // 2. Generate Sleep, Naps, Caffeine, and Eating Windows for each operational day
  // Identify all distinct days covered by the roster
  const dayBuckets = new Map<string, FlightLeg[]>();
  roster.flights.forEach((fl) => {
    const dStr = fl.reportTimeUtc.slice(0, 10);
    if (!dayBuckets.has(dStr)) dayBuckets.set(dStr, []);
    dayBuckets.get(dStr)!.push(fl);
  });

  // Determine full calendar date sequence
  let allDates: string[] = [];
  const flightDates = Array.from(dayBuckets.keys()).sort();

  if (roster.totalDays && roster.totalDays > 0 && flightDates.length > 0) {
    const startBase = new Date(flightDates[0] + 'T00:00:00Z');
    for (let i = 0; i < roster.totalDays; i++) {
      const d = new Date(startBase.getTime() + i * 86400000);
      allDates.push(d.toISOString().slice(0, 10));
    }
  } else if (flightDates.length > 0) {
    // If range is at least 2 days, fill consecutive dates
    const startBase = new Date(flightDates[0] + 'T00:00:00Z');
    const endBase = new Date(flightDates[flightDates.length - 1] + 'T00:00:00Z');
    const spanDays = Math.round((endBase.getTime() - startBase.getTime()) / 86400000) + 1;
    const daysToGenerate = Math.max(spanDays, flightDates.length);

    for (let i = 0; i < daysToGenerate; i++) {
      const d = new Date(startBase.getTime() + i * 86400000);
      allDates.push(d.toISOString().slice(0, 10));
    }
  } else {
    // When no flights are uploaded (e.g. empty or cleared roster), generate 7 standard days
    const today = new Date().toISOString().slice(0, 10);
    const startBase = new Date(today + 'T00:00:00Z');
    for (let i = 0; i < 7; i++) {
      const d = new Date(startBase.getTime() + i * 86400000);
      allDates.push(d.toISOString().slice(0, 10));
    }
  }

  // Remove duplicates & sort
  const sortedDates = Array.from(new Set(allDates)).sort();

  sortedDates.forEach((dateStr, dayIndex) => {
    const flightsToday = dayBuckets.get(dateStr);

    // IF REST / OFF DAY (No flights today)
    if (!flightsToday || flightsToday.length === 0) {
      // 23:00 HBT on dateStr in UTC
      const offSleepDateUtc = new Date(Date.parse(`${dateStr}T00:00:00Z`) + (23 - hbtOffset) * 3600000);
      const offSleepStart = offSleepDateUtc.toISOString();
      const offSleepEnd = new Date(offSleepDateUtc.getTime() + preferences.targetSleepHours * 3600000).toISOString();
      const offEatDateUtc = new Date(Date.parse(`${dateStr}T00:00:00Z`) + (8.5 - hbtOffset) * 3600000);
      const offEatStart = offEatDateUtc.toISOString();
      const offEatEnd = new Date(offEatDateUtc.getTime() + 10 * 3600000).toISOString();
      const offCafDateUtc = new Date(Date.parse(`${dateStr}T00:00:00Z`) + (17 - hbtOffset) * 3600000);
      const offCafCutoff = offCafDateUtc.toISOString();

      // Rest Day Anchor Sleep
      events.push({
        id: `off-sleep-${dateStr}`,
        dutyDate: dateStr,
        type: 'anchor_sleep',
        title: '🛏️ Sleep',
        subtitle: `About ${preferences.targetSleepHours}h of sleep on home time`,
        startUtc: offSleepStart,
        endUtc: offSleepEnd,
        durationMinutes: preferences.targetSleepHours * 60,
        startLocalStr: formatShortTime(offSleepStart, hbtOffset),
        endLocalStr: formatShortTime(offSleepEnd, hbtOffset),
        startHbtStr: formatShortTime(offSleepStart, hbtOffset),
        endHbtStr: formatShortTime(offSleepEnd, hbtOffset),
        scientificCitation: CITATIONS.anchor_sleep,
        priority: 'recommended',
        color: '#8b5cf6',
        icon: 'moon',
        userAdjustable: true,
      });

      // Day Off Chrono-Nutrition
      events.push({
        id: `off-eat-${dateStr}`,
        dutyDate: dateStr,
        type: 'eating_window',
        title: '🥗 Daytime meals',
        subtitle: 'A gentle guide: eat your meals in the daytime on home time',
        startUtc: offEatStart,
        endUtc: offEatEnd,
        durationMinutes: 600,
        startLocalStr: formatShortTime(offEatStart, hbtOffset),
        endLocalStr: formatShortTime(offEatEnd, hbtOffset),
        startHbtStr: formatShortTime(offEatStart, hbtOffset),
        endHbtStr: formatShortTime(offEatEnd, hbtOffset),
        scientificCitation: CITATIONS.chrono_nutrition_window,
        priority: 'recommended',
        color: '#10b981',
        icon: 'utensils',
      });

      // Morning daylight on days off
      events.push({
        id: `off-light-${dateStr}`,
        dutyDate: dateStr,
        type: 'light_exposure',
        title: '☀️ Morning daylight',
        subtitle: 'Some time in daylight this morning helps keep your body clock steady',
        startUtc: `${dateStr}T03:00:00.000Z`,
        endUtc: `${dateStr}T04:00:00.000Z`,
        durationMinutes: 60,
        startLocalStr: formatShortTime(`${dateStr}T03:00:00.000Z`, hbtOffset),
        endLocalStr: formatShortTime(`${dateStr}T04:00:00.000Z`, hbtOffset),
        startHbtStr: formatShortTime(`${dateStr}T03:00:00.000Z`, hbtOffset),
        endHbtStr: formatShortTime(`${dateStr}T04:00:00.000Z`, hbtOffset),
        scientificCitation: {
          organization: 'Peer-reviewed research',
          studyTitle: 'Brown et al. 2022: expert recommendations on daytime and evening light',
          keyFinding: 'Bright light in the daytime and dim light in the evening help keep your body clock steady.',
          explanation: 'Daylight is far brighter than indoor lighting, so time outdoors in the morning is an easy way to get it.',
          actionableTip: 'Spend some time in daylight in the morning, and keep lights dim in the evening before sleep.',
          sourceUrl: 'https://europepmc.org/article/MED/35298459',
        },
        priority: 'recommended',
        color: '#f59e0b',
        icon: 'sun',
      });

      // Caffeine Cutoff on Off Day
      events.push({
        id: `off-caf-${dateStr}`,
        dutyDate: dateStr,
        type: 'caffeine_cutoff',
        title: '🚫 No more caffeine today',
        subtitle: 'Stopping coffee and tea now protects tonight’s sleep',
        startUtc: offCafCutoff,
        endUtc: offSleepStart,
        durationMinutes: 360,
        startLocalStr: formatShortTime(offCafCutoff, hbtOffset),
        endLocalStr: formatShortTime(offSleepStart, hbtOffset),
        startHbtStr: formatShortTime(offCafCutoff, hbtOffset),
        endHbtStr: formatShortTime(offSleepStart, hbtOffset),
        scientificCitation: CITATIONS.caffeine_cutoff,
        priority: 'recommended',
        color: '#b91c1c',
        icon: 'x-circle',
      });

      return;
    }

    // IF DUTY / FLIGHT DAY
    const firstFlight = flightsToday[0];
    const lastFlight = flightsToday[flightsToday.length - 1];

    const firstReportTime = new Date(firstFlight.reportTimeUtc);
    const lastReleaseTime = new Date(lastFlight.releaseTimeUtc);

    // Analyze first report time in Home Base Time (HBT)
    const reportHbtDate = new Date(firstReportTime.getTime() + hbtOffset * 3600000);
    const reportHourHbt = reportHbtDate.getUTCHours() + reportHbtDate.getUTCMinutes() / 60;

    // Buffers from preferences
    const groomingMin = preferences.groomingMinutes || 60;
    const cabMin = preferences.cabBufferMinutes || 60;
    const totalPrepMin = groomingMin + cabMin;

    const cabPickupTime = new Date(firstReportTime.getTime() - cabMin * 60000);
    const prepStartTime = new Date(cabPickupTime.getTime() - groomingMin * 60000);

    const prepStartHbt = formatShortTime(prepStartTime.toISOString(), hbtOffset);
    const cabPickupHbt = formatShortTime(cabPickupTime.toISOString(), hbtOffset);
    const reportHbt = formatShortTime(firstFlight.reportTimeUtc, hbtOffset);
    const departureHbt = formatShortTime(firstFlight.departureTimeUtc, hbtOffset);

    // Duty categories by first report time (home base time):
    // 1. Early morning: report 03:30 - 08:30 (requires early bedtime the night before)
    // 2. Daytime / Afternoon: report 08:30 - 15:30 (e.g. 15:00 departure! Crew sleeps normal nocturnal sleep 23:00 - 07:00!)
    // 3. Evening: report 15:30 - 20:00 (nocturnal sleep + afternoon sleep bank 13:00 - 14:30)
    // 4. Red-eye / Night: report 20:00 - 03:30 (pre-duty deep sleep bank 17:00 - 19:30 + daytime recovery)
    const isEarlyMorning = reportHourHbt >= 3.5 && reportHourHbt < 8.5;
    const isDaytime = reportHourHbt >= 8.5 && reportHourHbt < 15.5;
    const isLateAfternoon = reportHourHbt >= 15.5 && reportHourHbt < 20.0;
    const isRedEye = reportHourHbt >= 20.0 || reportHourHbt < 3.5;

    let dutyCategory: PrepDetails['dutyCategory'] = 'daytime';
    let step1Label = 'Step 1: Prep & Uniform Alarm';
    let step1Description = 'Shower, uniform inspection, makeup & flight bag check';
    let bedtimeExplanation = '';
    let targetBedtimeUtc = '';
    let targetBedtimeHbt = '';
    let caffeineCutoffHbt = '';
    let caffeineCutoffUtc = '';

    const debriefMin = preferences.debriefMinutes !== undefined ? preferences.debriefMinutes : 30;
    const debriefStartHbt = formatShortTime(lastFlight.arrivalTimeUtc, hbtOffset);
    const debriefEndUtc = new Date(new Date(lastFlight.arrivalTimeUtc).getTime() + debriefMin * 60000);
    const debriefEndHbt = formatShortTime(debriefEndUtc.toISOString(), hbtOffset);

    if (isEarlyMorning) {
      dutyCategory = 'early_morning';
      step1Label = 'Step 1: Wake-Up Alarm';
      step1Description = 'Wake up directly to get ready: shower, uniform inspection & bag check';

      const bedtime = new Date(prepStartTime.getTime() - preferences.targetSleepHours * 3600000);
      targetBedtimeUtc = bedtime.toISOString();
      targetBedtimeHbt = formatShortTime(targetBedtimeUtc, hbtOffset);
      const cafCutoff = new Date(bedtime.getTime() - preferences.caffeineCutoffHours * 3600000);
      caffeineCutoffUtc = cafCutoff.toISOString();
      caffeineCutoffHbt = formatShortTime(caffeineCutoffUtc, hbtOffset);

      const eveDateObj = new Date(bedtime.getTime() + hbtOffset * 3600000);
      const eveAviation = formatAviationDate(eveDateObj);
      const dutyAviation = formatAviationDate(dateStr);
      bedtimeExplanation = `Early morning departure: lights out by ${targetBedtimeHbt} on the evening before (${eveAviation}) to wake up refreshed at ${prepStartHbt} on ${dutyAviation}.`;
    } else if (isDaytime) {
      dutyCategory = 'daytime';
      step1Label = 'Step 1: Prep & Uniform Alarm';
      step1Description = 'Shower, uniform inspection, makeup & flight bag check before cab';

      // Core nocturnal sleep was 23:00 HBT on previous night until 07:00 AM HBT!
      const prevNightUtc = new Date(Date.parse(`${dateStr}T00:00:00Z`) - 86400000 + (23 - hbtOffset) * 3600000);
      targetBedtimeUtc = prevNightUtc.toISOString();
      targetBedtimeHbt = formatShortTime(targetBedtimeUtc, hbtOffset);
      const cafCutoff = new Date(prevNightUtc.getTime() - preferences.caffeineCutoffHours * 3600000);
      caffeineCutoffUtc = cafCutoff.toISOString();
      caffeineCutoffHbt = formatShortTime(caffeineCutoffUtc, hbtOffset);

      bedtimeExplanation = `Normal nocturnal sleep (23:00 – 07:00 HBT) completed overnight. Relaxed morning with departure prep beginning at ${prepStartHbt} for ${cabPickupHbt} cab pickup.`;
    } else if (isLateAfternoon) {
      dutyCategory = 'evening';
      step1Label = 'Step 1: Prep & Uniform Alarm';
      step1Description = 'Shower, uniform check & pack flight bag before cab arrives';

      const prevNightUtc = new Date(Date.parse(`${dateStr}T00:00:00Z`) - 86400000 + (23 - hbtOffset) * 3600000);
      targetBedtimeUtc = prevNightUtc.toISOString();
      targetBedtimeHbt = formatShortTime(targetBedtimeUtc, hbtOffset);
      const cafCutoff = new Date(prevNightUtc.getTime() - preferences.caffeineCutoffHours * 3600000);
      caffeineCutoffUtc = cafCutoff.toISOString();
      caffeineCutoffHbt = formatShortTime(caffeineCutoffUtc, hbtOffset);

      bedtimeExplanation = `Standard overnight sleep (23:00 – 07:30) reinforced with a 90-min afternoon rest bank before evening reporting.`;
    } else {
      dutyCategory = 'redeye';
      step1Label = 'Step 1: Wake from Sleep Bank & Prep';
      step1Description = 'Wake up from pre-duty sleep bank, uniform check & documents review';

      // 2.5-hour bank sleep in afternoon ending at prepStartTime
      const bankStart = new Date(prepStartTime.getTime() - 150 * 60000);
      targetBedtimeUtc = bankStart.toISOString();
      targetBedtimeHbt = formatShortTime(targetBedtimeUtc, hbtOffset);
      const cafCutoff = new Date(bankStart.getTime() - preferences.caffeineCutoffHours * 3600000);
      caffeineCutoffUtc = cafCutoff.toISOString();
      caffeineCutoffHbt = formatShortTime(caffeineCutoffUtc, hbtOffset);

      bedtimeExplanation = `Bank 2.5 hours sleep before overnight duty (${targetBedtimeHbt} – ${prepStartHbt}). Daytime recovery sleep scheduled upon landing.`;
    }

    const prepDetails: PrepDetails = {
      wakeUpHbt: prepStartHbt,
      cabPickupHbt,
      reportHbt,
      departureHbt,
      groomingMinutes: groomingMin,
      cabBufferMinutes: cabMin,
      targetBedtimeHbt,
      targetBedtimeDateStr: new Date(new Date(targetBedtimeUtc).getTime() + hbtOffset * 3600000).toISOString().slice(0, 10),
      caffeineCutoffHbt,
      wakeUpUtc: prepStartTime.toISOString(),
      cabPickupUtc: cabPickupTime.toISOString(),
      targetBedtimeUtc,
      dutyCategory,
      step1Label,
      step1Description,
      bedtimeExplanation,
      debriefMinutes: debriefMin,
      debriefStartHbt,
      debriefEndHbt,
    };
    dayPrepMap.set(dateStr, prepDetails);

    // Dedicated Pre-Flight Departure Routine Timeline Card
    events.push({
      id: `prep-routine-${dateStr}`,
      dutyDate: dateStr,
      type: 'pre_flight_prep',
      title: `⏰ ${prepStartHbt} ${isEarlyMorning ? 'Wake-Up' : 'Prep Alarm'} ➔ 🚖 ${cabPickupHbt} Cab Pickup`,
      subtitle: `${groomingMin} min to get ready, ${cabMin} min to travel, report at ${reportHbt} (${firstFlight.origin})`,
      startUtc: prepStartTime.toISOString(),
      endUtc: firstReportTime.toISOString(),
      durationMinutes: totalPrepMin,
      startLocalStr: formatShortTime(prepStartTime.toISOString(), firstFlight.originTzOffset),
      endLocalStr: formatShortTime(firstReportTime.toISOString(), firstFlight.originTzOffset),
      startHbtStr: prepStartHbt,
      endHbtStr: reportHbt,
      prepDetails,
      scientificCitation: {
        organization: 'General guidance',
        studyTitle: 'Practical tip, not from a specific study',
        keyFinding: 'This time is worked back from your report time using your own commute and getting-ready settings.',
        explanation: 'In an FAA survey of US flight attendants, fear of oversleeping was one of the main things disturbing sleep before duty. A reliable alarm helps.',
        actionableTip: `Set your phone alarm for ${prepStartHbt}. Pack flight bag, passport, and uniform the evening before.`,
      },
      priority: 'critical',
      color: '#0284c7',
      icon: 'clock',
    });

    // ==============================================================
    // SLEEP & NUTRITION EVENTS BASED ON DUTY CATEGORY
    // ==============================================================

    if (isEarlyMorning) {
      // 1. EARLY MORNING DUTY
      // Core Sleep: Shifted early the evening before, waking up at prepStartTime
      const anchorId = `anchor-sleep-${dateStr}`;
      const nudge = customNudges[anchorId] || 0;
      const nudgedStart = new Date(new Date(targetBedtimeUtc).getTime() + nudge * 60000).toISOString();
      const nudgedEnd = new Date(prepStartTime.getTime() + nudge * 60000).toISOString();
      const durationMinutes = Math.round((new Date(nudgedEnd).getTime() - new Date(nudgedStart).getTime()) / 60000);

      const eveDateObj = new Date(new Date(nudgedStart).getTime() + hbtOffset * 3600000);
      const wakeDateObj = new Date(new Date(nudgedEnd).getTime() + hbtOffset * 3600000);
      const eveAviation = formatAviationDate(eveDateObj);
      const wakeAviation = formatAviationDate(wakeDateObj);
      const isNightBefore = eveAviation !== wakeAviation;

      events.push({
        id: anchorId,
        dutyDate: dateStr,
        type: 'anchor_sleep',
        title: `🛏️ Sleep before duty (about ${(durationMinutes / 60).toFixed(1)}h)`,
        subtitle: isNightBefore
          ? `🌙 Eve of ${eveAviation} at ${targetBedtimeHbt} ➔ Wake ${wakeAviation} at ${prepStartHbt} (Cab: ${cabPickupHbt})`
          : `Bedtime at ${targetBedtimeHbt} for ${prepStartHbt} wake-up (Cab: ${cabPickupHbt})`,
        startUtc: nudgedStart,
        endUtc: nudgedEnd,
        durationMinutes,
        startLocalStr: formatShortTime(nudgedStart, hbtOffset),
        endLocalStr: formatShortTime(nudgedEnd, hbtOffset),
        startHbtStr: formatShortTime(nudgedStart, hbtOffset),
        endHbtStr: formatShortTime(nudgedEnd, hbtOffset),
        scientificCitation: CITATIONS.anchor_sleep,
        priority: 'critical',
        color: '#8b5cf6',
        icon: 'moon',
        userAdjustable: true,
      });

      // Post-Duty Recovery Nap (90 mins) in afternoon after landing
      const napStart = new Date(lastReleaseTime.getTime() + 90 * 60000);
      const napEnd = new Date(napStart.getTime() + 90 * 60000);
      events.push({
        id: `recovery-nap-${dateStr}`,
        dutyDate: dateStr,
        type: 'recovery_sleep',
        title: '💤 Nap after an early duty',
        subtitle: 'Early starts usually cut sleep short; a nap helps you catch up',
        startUtc: napStart.toISOString(),
        endUtc: napEnd.toISOString(),
        durationMinutes: 90,
        startLocalStr: formatShortTime(napStart.toISOString(), lastFlight.destTzOffset),
        endLocalStr: formatShortTime(napEnd.toISOString(), lastFlight.destTzOffset),
        startHbtStr: formatShortTime(napStart.toISOString(), hbtOffset),
        endHbtStr: formatShortTime(napEnd.toISOString(), hbtOffset),
        scientificCitation: CITATIONS.recovery_sleep,
        priority: 'recommended',
        color: '#6366f1',
        icon: 'bed',
        userAdjustable: true,
      });

      // Caffeine Window: 30 min before report until mid-shift
      const cafStart = new Date(firstReportTime.getTime() - 30 * 60000);
      const cafEnd = new Date(firstReportTime.getTime() + 3.5 * 3600000);
      events.push({
        id: `caf-allowed-${dateStr}`,
        dutyDate: dateStr,
        type: 'caffeine_allowed',
        title: '☕ Good time for caffeine',
        subtitle: 'A cup of coffee or tea early in the duty helps most',
        startUtc: cafStart.toISOString(),
        endUtc: cafEnd.toISOString(),
        durationMinutes: 240,
        startLocalStr: formatShortTime(cafStart.toISOString(), firstFlight.originTzOffset),
        endLocalStr: formatShortTime(cafEnd.toISOString(), firstFlight.originTzOffset),
        startHbtStr: formatShortTime(cafStart.toISOString(), hbtOffset),
        endHbtStr: formatShortTime(cafEnd.toISOString(), hbtOffset),
        scientificCitation: CITATIONS.caffeine_cutoff,
        priority: 'recommended',
        color: '#ea580c',
        icon: 'coffee',
      });

      // Strict Caffeine Cutoff: 6-8h before evening bedtime
      events.push({
        id: `caf-cutoff-${dateStr}`,
        dutyDate: dateStr,
        type: 'caffeine_cutoff',
        title: `🚫 No more caffeine (${preferences.caffeineCutoffHours}h before sleep)`,
        subtitle: `Stop coffee and tea by ${caffeineCutoffHbt} to protect your sleep`,
        startUtc: caffeineCutoffUtc,
        endUtc: targetBedtimeUtc,
        durationMinutes: preferences.caffeineCutoffHours * 60,
        startLocalStr: formatShortTime(caffeineCutoffUtc, hbtOffset),
        endLocalStr: formatShortTime(targetBedtimeUtc, hbtOffset),
        startHbtStr: formatShortTime(caffeineCutoffUtc, hbtOffset),
        endHbtStr: formatShortTime(targetBedtimeUtc, hbtOffset),
        scientificCitation: CITATIONS.caffeine_cutoff,
        priority: 'critical',
        color: '#b91c1c',
        icon: 'x-circle',
      });

      // Chrono-Nutrition Eating Window
      const eatStart = new Date(prepStartTime.getTime() + 45 * 60000);
      const eatEnd = new Date(eatStart.getTime() + 9.5 * 3600000);
      events.push({
        id: `eat-window-${dateStr}`,
        dutyDate: dateStr,
        type: 'eating_window',
        title: '🥗 Meal window',
        subtitle: 'A gentle guide for main meals around your duty',
        startUtc: eatStart.toISOString(),
        endUtc: eatEnd.toISOString(),
        durationMinutes: 570,
        startLocalStr: formatShortTime(eatStart.toISOString(), firstFlight.originTzOffset),
        endLocalStr: formatShortTime(eatEnd.toISOString(), lastFlight.destTzOffset),
        startHbtStr: formatShortTime(eatStart.toISOString(), hbtOffset),
        endHbtStr: formatShortTime(eatEnd.toISOString(), hbtOffset),
        scientificCitation: CITATIONS.chrono_nutrition_window,
        priority: 'recommended',
        color: '#10b981',
        icon: 'utensils',
      });
    } else if (isDaytime) {
      // 2. DAYTIME & AFTERNOON DUTY (e.g. 15:00 departure!)
      // Core Sleep: Normal nocturnal sleep overnight (23:00 to 07:00 HBT)!
      const anchorId = `anchor-sleep-${dateStr}`;
      const nudge = customNudges[anchorId] || 0;
      const coreSleepStart = new Date(new Date(targetBedtimeUtc).getTime() + nudge * 60000);
      const coreSleepEnd = new Date(coreSleepStart.getTime() + preferences.targetSleepHours * 3600000);

      events.push({
        id: anchorId,
        dutyDate: dateStr,
        type: 'anchor_sleep',
        title: `🛏️ Night sleep (about ${preferences.targetSleepHours}h)`,
        subtitle: `Sleep ${formatShortTime(coreSleepStart.toISOString(), hbtOffset)} – ${formatShortTime(coreSleepEnd.toISOString(), hbtOffset)} home time before your duty`,
        startUtc: coreSleepStart.toISOString(),
        endUtc: coreSleepEnd.toISOString(),
        durationMinutes: preferences.targetSleepHours * 60,
        startLocalStr: formatShortTime(coreSleepStart.toISOString(), hbtOffset),
        endLocalStr: formatShortTime(coreSleepEnd.toISOString(), hbtOffset),
        startHbtStr: formatShortTime(coreSleepStart.toISOString(), hbtOffset),
        endHbtStr: formatShortTime(coreSleepEnd.toISOString(), hbtOffset),
        scientificCitation: CITATIONS.anchor_sleep,
        priority: 'critical',
        color: '#8b5cf6',
        icon: 'moon',
        userAdjustable: true,
      });

      // Optional short nap before getting ready
      const napStart = new Date(prepStartTime.getTime() - 60 * 60000); // 1 hour before grooming begins
      const napEnd = new Date(napStart.getTime() + 26 * 60000);
      events.push({
        id: `preflight-nap-${dateStr}`,
        dutyDate: dateStr,
        type: 'nasa_nap',
        title: '⚡ Optional short nap',
        subtitle: 'Aim for 10–20 minutes of sleep, finished well before you get ready',
        startUtc: napStart.toISOString(),
        endUtc: napEnd.toISOString(),
        durationMinutes: 26,
        startLocalStr: formatShortTime(napStart.toISOString(), hbtOffset),
        endLocalStr: formatShortTime(napEnd.toISOString(), hbtOffset),
        startHbtStr: formatShortTime(napStart.toISOString(), hbtOffset),
        endHbtStr: formatShortTime(napEnd.toISOString(), hbtOffset),
        scientificCitation: CITATIONS.nasa_nap_26,
        priority: 'optional',
        color: '#06b6d4',
        icon: 'zap',
      });

      // Caffeine Window: Morning until 1.5h before check-in
      const cafStart = coreSleepEnd;
      const cafEnd = new Date(firstReportTime.getTime() + 2 * 3600000);
      events.push({
        id: `caf-allowed-${dateStr}`,
        dutyDate: dateStr,
        type: 'caffeine_allowed',
        title: '☕ Good time for caffeine',
        subtitle: 'Coffee or tea with breakfast and before departure',
        startUtc: cafStart.toISOString(),
        endUtc: cafEnd.toISOString(),
        durationMinutes: Math.round((cafEnd.getTime() - cafStart.getTime()) / 60000),
        startLocalStr: formatShortTime(cafStart.toISOString(), hbtOffset),
        endLocalStr: formatShortTime(cafEnd.toISOString(), firstFlight.originTzOffset),
        startHbtStr: formatShortTime(cafStart.toISOString(), hbtOffset),
        endHbtStr: formatShortTime(cafEnd.toISOString(), hbtOffset),
        scientificCitation: CITATIONS.caffeine_cutoff,
        priority: 'recommended',
        color: '#ea580c',
        icon: 'coffee',
      });

      // Evening Caffeine Cutoff: 17:00 HBT (6h before 23:00 nocturnal sleep)
      const eveningCafCutoffDate = new Date(Date.parse(`${dateStr}T00:00:00Z`) + (17 - hbtOffset) * 3600000);
      const eveningBedtimeDate = new Date(Date.parse(`${dateStr}T00:00:00Z`) + (23 - hbtOffset) * 3600000);
      events.push({
        id: `caf-cutoff-${dateStr}`,
        dutyDate: dateStr,
        type: 'caffeine_cutoff',
        title: '🚫 No more caffeine today',
        subtitle: 'Stopping coffee and tea now protects tonight’s sleep',
        startUtc: eveningCafCutoffDate.toISOString(),
        endUtc: eveningBedtimeDate.toISOString(),
        durationMinutes: 360,
        startLocalStr: formatShortTime(eveningCafCutoffDate.toISOString(), hbtOffset),
        endLocalStr: formatShortTime(eveningBedtimeDate.toISOString(), hbtOffset),
        startHbtStr: formatShortTime(eveningCafCutoffDate.toISOString(), hbtOffset),
        endHbtStr: formatShortTime(eveningBedtimeDate.toISOString(), hbtOffset),
        scientificCitation: CITATIONS.caffeine_cutoff,
        priority: 'critical',
        color: '#b91c1c',
        icon: 'x-circle',
      });

      // Daytime meal window (08:30 to 18:30 HBT)
      const eatStartDate = new Date(Date.parse(`${dateStr}T00:00:00Z`) + (8.5 - hbtOffset) * 3600000);
      const eatEndDate = new Date(eatStartDate.getTime() + 10 * 3600000);
      events.push({
        id: `eat-window-${dateStr}`,
        dutyDate: dateStr,
        type: 'eating_window',
        title: '🥗 Meal window',
        subtitle: 'A gentle guide: main meals in the daytime on home time',
        startUtc: eatStartDate.toISOString(),
        endUtc: eatEndDate.toISOString(),
        durationMinutes: 600,
        startLocalStr: formatShortTime(eatStartDate.toISOString(), hbtOffset),
        endLocalStr: formatShortTime(eatEndDate.toISOString(), lastFlight.destTzOffset),
        startHbtStr: formatShortTime(eatStartDate.toISOString(), hbtOffset),
        endHbtStr: formatShortTime(eatEndDate.toISOString(), hbtOffset),
        scientificCitation: CITATIONS.chrono_nutrition_window,
        priority: 'recommended',
        color: '#10b981',
        icon: 'utensils',
      });
    } else if (isLateAfternoon) {
      // 3. LATE AFTERNOON & EVENING DUTY
      // Core Nocturnal Sleep Overnight (23:00 - 07:30)
      const anchorId = `anchor-sleep-${dateStr}`;
      const coreSleepStart = new Date(targetBedtimeUtc);
      const coreSleepEnd = new Date(coreSleepStart.getTime() + preferences.targetSleepHours * 3600000);

      events.push({
        id: anchorId,
        dutyDate: dateStr,
        type: 'anchor_sleep',
        title: `🛏️ Night sleep (about ${preferences.targetSleepHours}h)`,
        subtitle: `Sleep ${formatShortTime(coreSleepStart.toISOString(), hbtOffset)} – ${formatShortTime(coreSleepEnd.toISOString(), hbtOffset)} home time`,
        startUtc: coreSleepStart.toISOString(),
        endUtc: coreSleepEnd.toISOString(),
        durationMinutes: preferences.targetSleepHours * 60,
        startLocalStr: formatShortTime(coreSleepStart.toISOString(), hbtOffset),
        endLocalStr: formatShortTime(coreSleepEnd.toISOString(), hbtOffset),
        startHbtStr: formatShortTime(coreSleepStart.toISOString(), hbtOffset),
        endHbtStr: formatShortTime(coreSleepEnd.toISOString(), hbtOffset),
        scientificCitation: CITATIONS.anchor_sleep,
        priority: 'critical',
        color: '#8b5cf6',
        icon: 'moon',
        userAdjustable: true,
      });

      // Afternoon Pre-Duty Sleep Banking (90m full cycle) between 13:00 and 14:30
      const bankDateUtc = new Date(Date.parse(`${dateStr}T00:00:00Z`) + (13 - hbtOffset) * 3600000);
      const bankEndUtc = new Date(bankDateUtc.getTime() + 90 * 60000);
      events.push({
        id: `bank-nap-${dateStr}`,
        dutyDate: dateStr,
        type: 'recovery_sleep',
        title: '💤 Afternoon nap before duty',
        subtitle: 'A nap before a late duty helps you stay alert into the evening',
        startUtc: bankDateUtc.toISOString(),
        endUtc: bankEndUtc.toISOString(),
        durationMinutes: 90,
        startLocalStr: formatShortTime(bankDateUtc.toISOString(), hbtOffset),
        endLocalStr: formatShortTime(bankEndUtc.toISOString(), hbtOffset),
        startHbtStr: formatShortTime(bankDateUtc.toISOString(), hbtOffset),
        endHbtStr: formatShortTime(bankEndUtc.toISOString(), hbtOffset),
        scientificCitation: CITATIONS.recovery_sleep,
        priority: 'recommended',
        color: '#6366f1',
        icon: 'bed',
        userAdjustable: true,
      });

      // Caffeine Window & Cutoff
      const cafStart = coreSleepEnd;
      const cafEnd = new Date(firstReportTime.getTime() + 2 * 3600000);
      events.push({
        id: `caf-allowed-${dateStr}`,
        dutyDate: dateStr,
        type: 'caffeine_allowed',
        title: '☕ Good time for caffeine',
        subtitle: 'Have coffee early in the duty rather than near its end',
        startUtc: cafStart.toISOString(),
        endUtc: cafEnd.toISOString(),
        durationMinutes: Math.round((cafEnd.getTime() - cafStart.getTime()) / 60000),
        startLocalStr: formatShortTime(cafStart.toISOString(), hbtOffset),
        endLocalStr: formatShortTime(cafEnd.toISOString(), firstFlight.originTzOffset),
        startHbtStr: formatShortTime(cafStart.toISOString(), hbtOffset),
        endHbtStr: formatShortTime(cafEnd.toISOString(), hbtOffset),
        scientificCitation: CITATIONS.caffeine_cutoff,
        priority: 'recommended',
        color: '#ea580c',
        icon: 'coffee',
      });

      // Eating window
      const eatStartDate = new Date(Date.parse(`${dateStr}T00:00:00Z`) + (9 - hbtOffset) * 3600000);
      const eatEndDate = new Date(eatStartDate.getTime() + 10 * 3600000);
      events.push({
        id: `eat-window-${dateStr}`,
        dutyDate: dateStr,
        type: 'eating_window',
        title: '🥗 Meal window',
        subtitle: 'Have your main meal before the late duty',
        startUtc: eatStartDate.toISOString(),
        endUtc: eatEndDate.toISOString(),
        durationMinutes: 600,
        startLocalStr: formatShortTime(eatStartDate.toISOString(), hbtOffset),
        endLocalStr: formatShortTime(eatEndDate.toISOString(), lastFlight.destTzOffset),
        startHbtStr: formatShortTime(eatStartDate.toISOString(), hbtOffset),
        endHbtStr: formatShortTime(eatEndDate.toISOString(), hbtOffset),
        scientificCitation: CITATIONS.chrono_nutrition_window,
        priority: 'recommended',
        color: '#10b981',
        icon: 'utensils',
      });
    } else {
      // 4. RED-EYE & OVERNIGHT DUTY
      // Pre-Duty Deep Sleep Banking (2.5 hours) ending at prepStartTime
      const preDutyNapEnd = prepStartTime;
      const preDutyNapStart = new Date(preDutyNapEnd.getTime() - 150 * 60000);

      events.push({
        id: `pre-duty-bank-${dateStr}`,
        dutyDate: dateStr,
        type: 'anchor_sleep',
        title: '🛏️ Nap before the night duty',
        subtitle: `Sleep ${formatShortTime(preDutyNapStart.toISOString(), hbtOffset)} – ${prepStartHbt} before you get ready`,
        startUtc: preDutyNapStart.toISOString(),
        endUtc: preDutyNapEnd.toISOString(),
        durationMinutes: 150,
        startLocalStr: formatShortTime(preDutyNapStart.toISOString(), firstFlight.originTzOffset),
        endLocalStr: formatShortTime(preDutyNapEnd.toISOString(), firstFlight.originTzOffset),
        startHbtStr: formatShortTime(preDutyNapStart.toISOString(), hbtOffset),
        endHbtStr: prepStartHbt,
        scientificCitation: CITATIONS.pre_duty_90_nap,
        priority: 'critical',
        color: '#8b5cf6',
        icon: 'moon',
        userAdjustable: true,
      });

      // Short nap during crew rest, if available
      const midDutyTime = new Date(firstFlight.departureTimeUtc);
      const nasaNapStart = new Date(midDutyTime.getTime() + 60 * 60000);
      const nasaNapEnd = new Date(nasaNapStart.getTime() + 26 * 60000);
      events.push({
        id: `nasa-nap-${dateStr}`,
        dutyDate: dateStr,
        type: 'nasa_nap',
        title: '⚡ Short nap if you get a rest break',
        subtitle: 'If you have crew rest, aim for 10–20 minutes and allow time to wake up properly',
        startUtc: nasaNapStart.toISOString(),
        endUtc: nasaNapEnd.toISOString(),
        durationMinutes: 26,
        startLocalStr: formatShortTime(nasaNapStart.toISOString(), firstFlight.originTzOffset),
        endLocalStr: formatShortTime(nasaNapEnd.toISOString(), firstFlight.destTzOffset),
        startHbtStr: formatShortTime(nasaNapStart.toISOString(), hbtOffset),
        endHbtStr: formatShortTime(nasaNapEnd.toISOString(), hbtOffset),
        scientificCitation: CITATIONS.nasa_nap_26,
        priority: 'recommended',
        color: '#06b6d4',
        icon: 'zap',
      });

      // Post-Flight Morning Landing: Melatonin Shield (Sunglasses)
      const landTime = new Date(lastFlight.arrivalTimeUtc);
      const shieldEnd = new Date(lastReleaseTime.getTime() + 120 * 60000);
      events.push({
        id: `melatonin-shield-${dateStr}`,
        dutyDate: dateStr,
        type: 'melatonin_shield',
        title: '🕶️ Wear dark sunglasses home',
        subtitle: 'If it is daylight, sunglasses make it easier to sleep when you get in',
        startUtc: landTime.toISOString(),
        endUtc: shieldEnd.toISOString(),
        durationMinutes: 120,
        startLocalStr: formatShortTime(landTime.toISOString(), lastFlight.destTzOffset),
        endLocalStr: formatShortTime(shieldEnd.toISOString(), lastFlight.destTzOffset),
        startHbtStr: formatShortTime(landTime.toISOString(), hbtOffset),
        endHbtStr: formatShortTime(shieldEnd.toISOString(), hbtOffset),
        scientificCitation: CITATIONS.melatonin_shield,
        priority: 'critical',
        color: '#475569',
        icon: 'sun-dim',
      });

      // Daytime Recovery Sleep (after commute home)
      const daySleepStart = shieldEnd;
      const daySleepDurationHours = 5.5;
      const daySleepEnd = new Date(daySleepStart.getTime() + daySleepDurationHours * 3600000);
      events.push({
        id: `day-recovery-sleep-${dateStr}`,
        dutyDate: dateStr,
        type: 'recovery_sleep',
        title: '🛏️ Sleep after the night duty',
        subtitle: 'Dark, cool room (about 18–20 °C), eye mask and earplugs',
        startUtc: daySleepStart.toISOString(),
        endUtc: daySleepEnd.toISOString(),
        durationMinutes: Math.round(daySleepDurationHours * 60),
        startLocalStr: formatShortTime(daySleepStart.toISOString(), lastFlight.destTzOffset),
        endLocalStr: formatShortTime(daySleepEnd.toISOString(), lastFlight.destTzOffset),
        startHbtStr: formatShortTime(daySleepStart.toISOString(), hbtOffset),
        endHbtStr: formatShortTime(daySleepEnd.toISOString(), hbtOffset),
        scientificCitation: CITATIONS.recovery_sleep,
        priority: 'critical',
        color: '#8b5cf6',
        icon: 'moon',
        userAdjustable: true,
      });

      // Keep food light during the body-clock night on overnight flights
      events.push({
        id: `gut-rest-${dateStr}`,
        dutyDate: dateStr,
        type: 'fasting_window',
        title: '🍵 Keep food light overnight',
        subtitle: 'Main meal before the duty; a small snack if you get hungry. Keep drinking water.',
        startUtc: firstReportTime.toISOString(),
        endUtc: landTime.toISOString(),
        durationMinutes: Math.round((landTime.getTime() - firstReportTime.getTime()) / 60000),
        startLocalStr: formatShortTime(firstReportTime.toISOString(), firstFlight.originTzOffset),
        endLocalStr: formatShortTime(landTime.toISOString(), lastFlight.destTzOffset),
        startHbtStr: formatShortTime(firstReportTime.toISOString(), hbtOffset),
        endHbtStr: formatShortTime(landTime.toISOString(), hbtOffset),
        scientificCitation: CITATIONS.gut_rest_night,
        priority: 'critical',
        color: '#047857',
        icon: 'shield-alert',
      });

      // In-flight caffeine cutoff: 90 mins after departure
      const redEyeCafCutoff = new Date(firstFlight.departureTimeUtc);
      redEyeCafCutoff.setMinutes(redEyeCafCutoff.getMinutes() + 90);
      events.push({
        id: `redeye-caf-cutoff-${dateStr}`,
        dutyDate: dateStr,
        type: 'caffeine_cutoff',
        title: '🚫 No more caffeine this duty',
        subtitle: 'Caffeine late in the duty makes it harder to sleep when you get home',
        startUtc: redEyeCafCutoff.toISOString(),
        endUtc: daySleepEnd.toISOString(),
        durationMinutes: Math.round((daySleepEnd.getTime() - redEyeCafCutoff.getTime()) / 60000),
        startLocalStr: formatShortTime(redEyeCafCutoff.toISOString(), firstFlight.originTzOffset),
        endLocalStr: formatShortTime(daySleepEnd.toISOString(), lastFlight.destTzOffset),
        startHbtStr: formatShortTime(redEyeCafCutoff.toISOString(), hbtOffset),
        endHbtStr: formatShortTime(daySleepEnd.toISOString(), hbtOffset),
        scientificCitation: CITATIONS.caffeine_cutoff,
        priority: 'critical',
        color: '#b91c1c',
        icon: 'x-circle',
      });
    }
  });

  // Sort all events chronologically
  events.sort((a, b) => new Date(a.startUtc).getTime() - new Date(b.startUtc).getTime());

  // 3. Calculate Daily Summaries
  let totalFlightMinutes = 0;
  let totalSectors = 0;
  let woclCount = 0;
  let dutyDaysCount = 0;
  let totalSleepAccumMinutes = 0;

  roster.flights.forEach((fl) => {
    totalFlightMinutes += fl.durationMinutes;
    totalSectors += 1;
    if (fl.isRedEye) woclCount += 1;
  });

  const dailySummaries: DailyCircadianSummary[] = sortedDates.map((dateStr, idx) => {
    const dayEvents = events.filter((e) => e.startUtc.startsWith(dateStr));
    const dayFlights = dayEvents.filter((e) => e.type === 'flight');
    const sleepEvents = dayEvents.filter((e) => e.type === 'anchor_sleep' || e.type === 'recovery_sleep');
    const totalSleepMin = sleepEvents.reduce((acc, cur) => acc + cur.durationMinutes, 0);
    totalSleepAccumMinutes += totalSleepMin;

    const naps = dayEvents.filter((e) => e.type === 'nasa_nap').length;
    const woclExposure = dayEvents.filter((e) => e.type === 'wocl_risk').reduce((acc, cur) => acc + cur.durationMinutes, 0);

    const isOffDay = dayFlights.length === 0;
    if (!isOffDay) dutyDaysCount += 1;

    const isHighRisk = woclExposure > 120 || (totalSleepMin < 300 && !isOffDay);
    const isModRisk = woclExposure > 0 || (totalSleepMin < 390 && !isOffDay);

    let guidance = 'Well-balanced schedule with full circadian recovery.';
    if (isOffDay) {
      guidance = 'Circadian Re-alignment Day. Sleep banking and metabolic restoration on home rhythm.';
    } else if (isHighRisk) {
      guidance = 'High fatigue exposure (WOCL night duty / short sleep). Strictly observe the 26m nap and post-flight blackout sleep.';
    } else if (isModRisk) {
      guidance = 'Moderate operational load. Maintain hydration and adhere to the 6h caffeine cutoff.';
    }

    // Layover station details if night ends in non-home airport
    let layoverStation: DailyCircadianSummary['layoverStation'] = undefined;
    const rosterFlightsOnDay = roster.flights.filter((f) => f.departureTimeUtc.startsWith(dateStr));
    const lastDayFlight = rosterFlightsOnDay[rosterFlightsOnDay.length - 1];
    if (lastDayFlight && lastDayFlight.destination !== roster.homeBase) {
      const destAirport = AIRPORTS[lastDayFlight.destination] || {
        city: lastDayFlight.destinationCity || lastDayFlight.destination,
        iata: lastDayFlight.destination,
        name: lastDayFlight.destination,
        country: '',
        tzOffset: lastDayFlight.destTzOffset,
      };
      const tzDiff = lastDayFlight.destTzOffset - hbtOffset;
      const tzDiffStr = tzDiff === 0 ? 'Same as HBT' : `${tzDiff > 0 ? '+' : ''}${tzDiff}h vs Home`;
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
      dayLabel: formatDateLabel(`${dateStr}T12:00:00Z`, hbtOffset),
      dayNumber: idx + 1,
      isOffDay,
      dutyType: isOffDay ? 'off' : 'flight',
      totalSleepHours: Number((totalSleepMin / 60).toFixed(1)),
      napsCount: naps,
      eatingWindowHours: 9.5,
      woclExposureMinutes: woclExposure,
      fatigueRiskLevel: isOffDay ? 'low' : isHighRisk ? 'high' : isModRisk ? 'moderate' : 'low',
      keyGuidance: guidance,
      prepDetails: dayPrepMap.get(dateStr),
      layoverStation,
    };
  });

  const offDaysCount = sortedDates.length - dutyDaysCount;
  const avgSleepPerDay = sortedDates.length > 0 ? Number((totalSleepAccumMinutes / 60 / sortedDates.length).toFixed(1)) : 7.5;
  // Only standby the roster actually contains; never an assumed figure
  const standbyHours = roster.standbyHours ?? 0;

  const monthlyStats = {
    totalFlightHours: Number((totalFlightMinutes / 60).toFixed(1)),
    totalSectors,
    dutyDays: dutyDaysCount,
    offDays: offDaysCount,
    woclNightFlights: woclCount,
    avgSleepPerDay,
    standbyHours,
  };

  const salaryBreakdown = calculateSalaryBreakdown(roster, preferences, totalFlightMinutes, woclCount);

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
  const hbtDate = new Date(nowDate.getTime() + hbtOffset * 3600000);
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
      nextMilestoneTime: next ? formatShortTime(next.startUtc, hbtOffset) : '--:--',
      minutesUntilNext: minutesUntil,
      biologicalPhase,
      immediateAction,
    },
  };
}
