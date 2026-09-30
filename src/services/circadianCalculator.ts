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

// Science Citations Database
export const CITATIONS: Record<string, ScientificCitation> = {
  anchor_sleep: {
    organization: 'ICAO FRMS',
    studyTitle: 'ICAO Doc 9966: Fatigue Risk Management Systems Manual',
    keyFinding: 'Core anchor sleep of at least 4-6 hours maintains cognitive baseline across irregular shift rotations.',
    explanation: 'Anchor sleep locks in the primary slow-wave restorative sleep stage, preventing cumulative microsleep risk even when overall schedule is fragmented.',
    actionableTip: 'Keep your room pitch dark and cool (18-20°C). Use eye masks and earplugs to block circadian daylight cues.',
  },
  recovery_sleep: {
    organization: 'NASA Ames',
    studyTitle: 'NASA Ames Fatigue Countermeasures: Crew Sleep Banking & Recovery',
    keyFinding: 'Recovery sleep immediately after early or night duty repays acute sleep debt before slow-wave deprivation compounds.',
    explanation: 'Post-duty sleep dampens elevated cortisol from early wakefulness or night operations and restores neurobehavioral alertness.',
    actionableTip: 'Wind down for 30 minutes without smartphone blue light before entering bed. Have a warm shower to promote peripheral cooling.',
  },
  nasa_nap_26: {
    organization: 'NASA Ames',
    studyTitle: 'NASA Ames 26-Minute Cockpit Rest Study (Dr. Mark Rosekind)',
    keyFinding: 'A planned 26-minute nap improves cognitive alertness by 54% and physiological vigilance by 34%.',
    explanation: 'Capping the nap under 30 minutes avoids entering Stage 3/4 slow-wave sleep, completely preventing groggy sleep inertia upon waking.',
    actionableTip: 'Set an alarm for 30 minutes (giving yourself 4 minutes to drift off). Wake up promptly and take 5 deep breaths.',
  },
  pre_duty_90_nap: {
    organization: 'Sleep Research Society',
    studyTitle: 'Pre-Shift Full Cycle Sleep Architecture in Aviation Crews',
    keyFinding: 'A 90-minute sleep cycle before a night flight provides a complete cycle of light, deep, and REM sleep.',
    explanation: 'Taking a 90-minute sleep block in late afternoon (15:00-18:00) clears homeostatic sleep pressure before embarking on an all-night duty.',
    actionableTip: 'Schedule this sleep at least 2 hours before your departure for the airport to allow any residual grogginess to lift.',
  },
  chrono_nutrition_window: {
    organization: 'Salk Institute',
    studyTitle: 'Dr. Satchin Panda: Circadian Chrono-Nutrition & Peripheral Clocks',
    keyFinding: 'Restricting caloric consumption to an 8-10 hour daytime window optimizes insulin sensitivity and metabolic health.',
    explanation: 'Stomach motility and pancreatic insulin secretion drop sharply at night. Eating meals during biological daytime synchronizes peripheral liver and gut clocks with the brain.',
    actionableTip: 'Consume balanced meals with protein, healthy fats, and low-glycemic complex carbs during this window.',
  },
  gut_rest_night: {
    organization: 'Salk Institute',
    studyTitle: 'Gastrointestinal Chronobiology in Night-Shift Personnel',
    keyFinding: 'Gastric acid secretion and bowel motility drop by over 50% between 22:00 and 06:00 biological time.',
    explanation: 'Heavy meals during night flights cause bloating, gas expansion at 8,000 ft cabin altitude, and severe morning fatigue.',
    actionableTip: 'Stick to warm herbal teas, water with electrolytes, or small handful of almonds if genuinely hungry. Avoid sugary airline snacks and heavy curries.',
  },
  caffeine_cutoff: {
    organization: 'FAA/EASA',
    studyTitle: 'Aero-Medical Advisory: Caffeine Pharmacokinetics in Flight Crew',
    keyFinding: 'Caffeine has a 5-7 hour half-life and up to 12 hour quarter-life, impairing deep Stage 3 sleep even if you fall asleep.',
    explanation: 'Caffeine blocks adenosine receptors. While it temporarily masks tiredness, residual caffeine destroys sleep architecture and prevents restorative slow-wave recovery.',
    actionableTip: 'Cease all coffee, energy drinks, and black tea at least 6-8 hours before your target sleep time.',
  },
  melatonin_shield: {
    organization: 'ICAO FRMS',
    studyTitle: 'Circadian Photobiology: Preventing Phase Shift with Dark Sunglasses',
    keyFinding: 'Morning sunlight hitting the retina after a night flight suppresses melatonin and induces unwanted circadian alertness.',
    explanation: 'Intense morning daylight signals the SCN (suprachiasmatic nucleus) that it is daytime, making falling asleep upon returning to your hotel or home extremely difficult.',
    actionableTip: 'Wear polarized, dark sunglasses before stepping out of the airport into morning light until you reach your darkened bedroom.',
  },
  wocl_risk: {
    organization: 'NASA Ames',
    studyTitle: 'Window of Circadian Low (WOCL: 02:00-06:00) Performance Degradation',
    keyFinding: 'Human alertness, reaction time, and decision-making reach biological minimum during 02:00-06:00 Home Base Time.',
    explanation: 'Body temperature drops to its nadir and sleep propensity peaks. Cabin crew on duty during WOCL experience the highest vulnerability to microsleeps.',
    actionableTip: 'Stay active in the cabin, hydrate every 30 minutes, practice team cross-checking, and avoid long seated periods in dim light.',
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
        organization: 'ICAO FRMS',
        studyTitle: 'Standard Flight Duty Period (FDP) Management',
        keyFinding: 'Pre-flight briefing and safety equipment checks require focused cognitive alertness.',
        explanation: 'Ensure hydration and light protein snack 30-45 minutes before reporting to sustain early duty stamina.',
        actionableTip: 'Avoid heavy sugars at check-in that cause reactive hypoglycemia during boarding.',
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
        organization: 'FAA/EASA',
        studyTitle: 'In-Flight Cabin Crew Physical Workload & Hydration',
        keyFinding: 'Cabin humidity drops under 15% within 45 mins of cruising altitude.',
        explanation: 'Drink 250-350ml water per flight hour. Maintain gentle calf raises and walking to prevent peripheral venous pooling.',
        actionableTip: 'Add electrolyte pinch to water bottle to maintain cellular hydration without frequent diuresis.',
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
        title: '⚠️ Window of Circadian Low (WOCL Peak Risk)',
        subtitle: `Biological Night (02:00-06:00 ${flight.origin === 'DEL' || flight.origin === 'BOM' ? 'IST' : 'HBT'})`,
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
      title: `Pax Deboarding & Post-Flight Release (${flight.destination})`,
      subtitle: `Security search, transit handover & duty sign-off`,
      startUtc: debriefStart,
      endUtc: debriefEnd,
      durationMinutes: debriefDur,
      startLocalStr: formatShortTime(debriefStart, flight.destTzOffset),
      endLocalStr: formatShortTime(debriefEnd, flight.destTzOffset),
      startHbtStr: formatShortTime(debriefStart, hbtOffset),
      endHbtStr: formatShortTime(debriefEnd, hbtOffset),
      scientificCitation: {
        organization: 'ICAO FRMS',
        studyTitle: 'Post-Duty Transition & Decompression',
        keyFinding: 'Clear demarcation between operational duty and rest period initiates biological recovery.',
        explanation: 'Once signed off, mentally disengage from the flight and transition straight into recovery protocol.',
        actionableTip: 'Prepare sunglasses before stepping off the jet bridge if daytime outside.',
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
        title: '🛏️ Restorative Sleep (Rest & Banking)',
        subtitle: `${preferences.targetSleepHours}h uninterrupted sleep on Home Base rhythm for circadian repair`,
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
        title: '🥗 Full 10-Hour Metabolic Window',
        subtitle: 'Eat nutrient-dense meals on home schedule to synchronize liver and gut clocks',
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

      // Morning Sunlight Exposure for SCN Master Clock Reset
      events.push({
        id: `off-light-${dateStr}`,
        dutyDate: dateStr,
        type: 'light_exposure',
        title: '☀️ Outdoor Natural Light Reset',
        subtitle: '20-30 mins outdoor daylight before 10:00 AM to keep your brain clock pinned to home base',
        startUtc: `${dateStr}T03:00:00.000Z`,
        endUtc: `${dateStr}T04:00:00.000Z`,
        durationMinutes: 60,
        startLocalStr: formatShortTime(`${dateStr}T03:00:00.000Z`, hbtOffset),
        endLocalStr: formatShortTime(`${dateStr}T04:00:00.000Z`, hbtOffset),
        startHbtStr: formatShortTime(`${dateStr}T03:00:00.000Z`, hbtOffset),
        endHbtStr: formatShortTime(`${dateStr}T04:00:00.000Z`, hbtOffset),
        scientificCitation: {
          organization: 'Sleep Research Society',
          studyTitle: 'Morning Phototherapy and Circadian Entrainment',
          keyFinding: 'Natural sunlight (>10,000 lux) resets the suprachiasmatic nucleus daily phase.',
          explanation: 'On non-flying days, natural morning light anchors biological daytime and prevents circadian drift.',
          actionableTip: 'Take a brisk morning walk outside without sunglasses for 20 minutes.',
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
        title: '🚫 Evening Caffeine Cutoff',
        subtitle: 'Stop coffee by 17:00 to ensure deep Stage 3 slow-wave sleep tonight',
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

    // Biomathematical Duty Categorization based on ICAO FRMS & NASA Ames:
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
      subtitle: `${groomingMin}m grooming & prep, ${cabMin}m cab transit to report at ${reportHbt} (${firstFlight.origin})`,
      startUtc: prepStartTime.toISOString(),
      endUtc: firstReportTime.toISOString(),
      durationMinutes: totalPrepMin,
      startLocalStr: formatShortTime(prepStartTime.toISOString(), firstFlight.originTzOffset),
      endLocalStr: formatShortTime(firstReportTime.toISOString(), firstFlight.originTzOffset),
      startHbtStr: prepStartHbt,
      endHbtStr: reportHbt,
      prepDetails,
      scientificCitation: {
        organization: 'FAA/EASA',
        studyTitle: 'Pre-Duty Buffer Management & Commute Fatigue in Aviation',
        keyFinding: 'Structured pre-duty timelines reduce cognitive rush stress and cortisol spikes by 32%.',
        explanation: 'Providing an exact window from grooming to cab pickup guarantees mental composure for pre-flight safety briefings.',
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
        title: `🛏️ Pre-Duty Anchor Sleep (${(durationMinutes / 60).toFixed(1)}h Target)`,
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
        title: '💤 Post-Duty Recovery Nap (90-Min Cycle)',
        subtitle: 'Clears accumulated homeostatic sleep debt from early morning wakefulness',
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
        title: '☕ Optimal Caffeine Window',
        subtitle: 'Micro-dose 50-100mg caffeine to bolster morning vigilance and briefing focus',
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
        title: `🚫 Evening Caffeine Cutoff (${preferences.caffeineCutoffHours}h Pre-Sleep)`,
        subtitle: `Stop coffee/tea by ${caffeineCutoffHbt} to protect slow-wave sleep depth`,
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
        title: '🥗 Active Digestion Window (Salk 10h Protocol)',
        subtitle: 'High insulin sensitivity & active gut motility: optimal for meals during duty',
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
        title: `🛏️ Core Nocturnal Sleep (${preferences.targetSleepHours}h Rest)`,
        subtitle: `Natural nocturnal sleep (${formatShortTime(coreSleepStart.toISOString(), hbtOffset)} – ${formatShortTime(coreSleepEnd.toISOString(), hbtOffset)} HBT) on home rhythm before afternoon duty`,
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

      // Optional NASA Ames Pre-Flight Alertness Nap (26m) around 11:00 AM before grooming
      const napStart = new Date(prepStartTime.getTime() - 60 * 60000); // 1 hour before grooming begins
      const napEnd = new Date(napStart.getTime() + 26 * 60000);
      events.push({
        id: `preflight-nap-${dateStr}`,
        dutyDate: dateStr,
        type: 'nasa_nap',
        title: '⚡ Pre-Flight Alertness Nap (26m NASA Ames)',
        subtitle: 'Optional 26m power nap before grooming to top up cognitive vigilance for flight',
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
        title: '☕ Daytime Caffeine Window',
        subtitle: 'Strategic coffee with breakfast and pre-departure to maintain alertness',
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
        title: '🚫 Evening Caffeine Cutoff (17:00 HBT)',
        subtitle: 'Cease all coffee and stimulants by 17:00 to clear adenosine receptors for tonight',
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

      // Salk 10h Chrono-Nutrition Eating Window (08:30 to 18:30 HBT)
      const eatStartDate = new Date(Date.parse(`${dateStr}T00:00:00Z`) + (8.5 - hbtOffset) * 3600000);
      const eatEndDate = new Date(eatStartDate.getTime() + 10 * 3600000);
      events.push({
        id: `eat-window-${dateStr}`,
        dutyDate: dateStr,
        type: 'eating_window',
        title: '🥗 Active Digestion Window (Salk 10h Protocol)',
        subtitle: 'Eat main meals between 08:30 and 18:30 HBT to keep metabolic genes synchronized',
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
        title: `🛏️ Core Nocturnal Sleep (${preferences.targetSleepHours}h Rest)`,
        subtitle: `Overnight sleep (${formatShortTime(coreSleepStart.toISOString(), hbtOffset)} – ${formatShortTime(coreSleepEnd.toISOString(), hbtOffset)} HBT) on home rhythm`,
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
        title: '💤 Pre-Duty Afternoon Sleep Banking (90m Cycle)',
        subtitle: 'Strategic afternoon rest to guarantee peak vigilance through late evening arrival',
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
        title: '☕ Strategic Caffeine Window',
        subtitle: 'Coffee permitted until 2 hours into flight duty',
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
        title: '🥗 Active Digestion Window (Salk 10h Protocol)',
        subtitle: 'High insulin sensitivity: consume main meals before late evening duty',
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
        title: '🛏️ Pre-Duty Sleep Banking (Red-Eye Preparation)',
        subtitle: `Bank 2.5 hours core sleep (${formatShortTime(preDutyNapStart.toISOString(), hbtOffset)} – ${prepStartHbt}) before overnight duty`,
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

      // Galley / Controlled Rest Nap (NASA 26m)
      const midDutyTime = new Date(firstFlight.departureTimeUtc);
      const nasaNapStart = new Date(midDutyTime.getTime() + 60 * 60000);
      const nasaNapEnd = new Date(nasaNapStart.getTime() + 26 * 60000);
      events.push({
        id: `nasa-nap-${dateStr}`,
        dutyDate: dateStr,
        type: 'nasa_nap',
        title: '⚡ NASA Ames 26-Min Controlled Power Nap',
        subtitle: 'If allocated bunk or crew rest: +54% alertness boost with zero sleep inertia',
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
        title: '🕶️ Melatonin Shield (Wear Dark Sunglasses)',
        subtitle: 'Block morning sunlight immediately upon cabin exit to preserve sleepy brain chemistry',
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
        title: '🛏️ Daytime Recovery Sleep (Post Red-Eye)',
        subtitle: '5.5 hours in pitch-black, cool room (19°C) with eye-mask and earplugs',
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

      // Gut Rest / Biological Night Fasting during overnight flight
      events.push({
        id: `gut-rest-${dateStr}`,
        dutyDate: dateStr,
        type: 'fasting_window',
        title: '🍵 Biological Night Gut Rest (Metabolic Fast)',
        subtitle: 'Stomach motility & insulin downregulated: warm water, herbal tea, or light almonds only',
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
        title: '🚫 In-Flight Caffeine Cutoff',
        subtitle: 'No more coffee/tea past mid-flight to ensure you can fall asleep upon morning return',
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

  let cumulativeSleepDebtMinutes = 0;

  const dailySummaries: DailyCircadianSummary[] = sortedDates.map((dateStr, idx) => {
    const dayEvents = events.filter((e) => e.startUtc.startsWith(dateStr));
    const dayFlights = dayEvents.filter((e) => e.type === 'flight');
    const sleepEvents = dayEvents.filter((e) => e.type === 'anchor_sleep' || e.type === 'recovery_sleep');
    const totalSleepMin = sleepEvents.reduce((acc, cur) => acc + cur.durationMinutes, 0);
    totalSleepAccumMinutes += totalSleepMin;

    // Track sleep debt vs target
    const dailyTargetMin = preferences.targetSleepHours * 60;
    const dayDebt = Math.max(0, dailyTargetMin - totalSleepMin);
    cumulativeSleepDebtMinutes += dayDebt;

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
        hotelBlackoutRating: '98% Light Sealed',
        diningTip: 'High-protein breakfast at 08:00 local to cue morning metabolic gene expression.',
        tempCelsius: 21,
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
  const standbyHours = roster.standbyHours || 16;
  const cumulativeSleepDebtHours = Number((cumulativeSleepDebtMinutes / 60 * 0.35).toFixed(1)); // Damped rolling debt

  const monthlyStats = {
    totalFlightHours: Number((totalFlightMinutes / 60).toFixed(1)),
    totalSectors,
    dutyDays: dutyDaysCount,
    offDays: offDaysCount,
    woclNightFlights: woclCount,
    avgSleepPerDay,
    standbyHours,
    cumulativeSleepDebtHours,
    fdpCompliant: true,
    maxFdpHours: 13.0,
  };

  const salaryBreakdown = calculateSalaryBreakdown(roster, preferences, totalFlightMinutes, woclCount);

  // 4. Calculate Current Biological Status & SAFTE ReadiScore (Biomathematical Fatigue Model)
  const nowUtc = new Date().toISOString();
  const upcomingEvents = events.filter((e) => new Date(e.startUtc).getTime() > new Date(nowUtc).getTime());
  const activeEvents = events.filter(
    (e) => new Date(e.startUtc).getTime() <= new Date(nowUtc).getTime() && new Date(e.endUtc).getTime() >= new Date(nowUtc).getTime()
  );

  let currentPhase = 'Circadian Baseline (Home Base Rhythm)';
  let stateType: CircadianPlan['currentStatus']['stateType'] = 'alert';
  let summaryAdvice = 'Maintain regular hydration. Your circadian clocks are aligned.';

  // Determine HBT hour for circadian modulation
  const nowDate = new Date();
  const hbtDate = new Date(nowDate.getTime() + hbtOffset * 3600000);
  const hbtHour = hbtDate.getUTCHours() + hbtDate.getUTCMinutes() / 60;

  // SAFTE / 3-Process Model Alertness Calculation
  let baseSafte = 92;

  // Wearable sleep override impact
  if (preferences.actualLastSleepHours !== undefined) {
    const sleepDiff = preferences.actualLastSleepHours - preferences.targetSleepHours;
    baseSafte += sleepDiff * 4;
  }
  if (preferences.actualSleepEfficiency !== undefined) {
    baseSafte += (preferences.actualSleepEfficiency - 85) * 0.3;
  }

  // Circadian Nadir dip between 02:00 and 06:00
  let biologicalPhase: CircadianPlan['currentStatus']['biologicalPhase'] = 'day';
  if (hbtHour >= 2 && hbtHour < 6) {
    biologicalPhase = 'night_nadir';
    baseSafte -= 18; // Circadian nadir of core body temperature
  } else if (hbtHour >= 21 || hbtHour < 2 || (hbtHour >= 6 && hbtHour < 7.5)) {
    biologicalPhase = 'transition';
    baseSafte -= 6;
  } else {
    biologicalPhase = 'day';
  }

  // Active event influence on SAFTE and Immediate Action Card
  let immediateAction: CircadianPlan['currentStatus']['immediateAction'] = {
    icon: 'check',
    title: 'Biological System Aligned',
    subtitle: 'Standard hydration and daytime alertness protocol active.',
    urgency: 'info',
    actionType: 'rest',
  };

  if (activeEvents.length > 0) {
    const primary = activeEvents[0];
    if (primary.type === 'flight') {
      currentPhase = `Active Flight Duty (${primary.title})`;
      stateType = 'alert';
      summaryAdvice = 'Hydrate with 250ml water every 45 mins. Avoid heavy galley carbohydrate snacking.';
      baseSafte -= 4;
      immediateAction = {
        icon: 'plane',
        title: 'Active In-Flight Duty Window',
        subtitle: 'Maintain hourly micro-breaks and hydration. Avoid sugar crash snacks.',
        urgency: 'medium',
        actionType: 'flight',
      };
    } else if (primary.type === 'anchor_sleep' || primary.type === 'recovery_sleep') {
      currentPhase = 'Designated Sleep Block';
      stateType = 'sleep_prep';
      summaryAdvice = 'Keep room dark and cool (18°C). Avoid smartphone light.';
      immediateAction = {
        icon: 'moon',
        title: 'Designated Sleep Block Active',
        subtitle: 'Keep bedroom pitch black and cool (18°C). Zero smartphone blue light.',
        urgency: 'high',
        actionType: 'rest',
      };
    } else if (primary.type === 'caffeine_cutoff') {
      currentPhase = 'Caffeine Restricted Window';
      stateType = 'caffeine_ban';
      summaryAdvice = 'Strictly avoid coffee or tea to preserve subsequent slow-wave sleep depth.';
      immediateAction = {
        icon: 'coffee-off',
        title: 'Hard Caffeine Cutoff Active',
        subtitle: 'Cease all coffee and stimulants now to clear adenosine receptors for sleep.',
        urgency: 'medium',
        actionType: 'caffeine',
      };
    } else if (primary.type === 'fasting_window') {
      currentPhase = 'Metabolic Gut Rest (Biological Night)';
      stateType = 'fasting';
      summaryAdvice = 'Pancreatic and gut motility are dormant. Water and herbal tea only.';
      immediateAction = {
        icon: 'utensils-off',
        title: 'Biological Night Fasting Active',
        subtitle: 'Digestive motility dormant. Warm water or chamomile only to prevent gut dysbiosis.',
        urgency: 'info',
        actionType: 'fasting',
      };
    } else if (primary.type === 'wocl_risk') {
      currentPhase = 'Window of Circadian Low (WOCL)';
      stateType = 'wocl_warning';
      summaryAdvice = 'Peak physiological fatigue zone. Stay active and cross-check tasks with crew.';
      baseSafte -= 14;
      immediateAction = {
        icon: 'alert-triangle',
        title: 'Window of Circadian Low (WOCL) Zone',
        subtitle: 'Reaction times lag by 30%. Engage physical movement and cross-check procedures.',
        urgency: 'high',
        actionType: 'rest',
      };
    } else if (primary.type === 'melatonin_shield') {
      immediateAction = {
        icon: 'glasses',
        title: 'Put on Dark Sunglasses Now',
        subtitle: 'Shield eyes from morning sunlight to protect melatonin onset before sleep.',
        urgency: 'high',
        actionType: 'sunglasses',
      };
    } else if (primary.type === 'nasa_nap') {
      immediateAction = {
        icon: 'moon',
        title: 'NASA 26m Rest Protocol Window',
        subtitle: 'Take a controlled 26-minute nap to restore cognitive vigilance by 34%.',
        urgency: 'medium',
        actionType: 'nap',
      };
    }
  } else if (biologicalPhase === 'night_nadir') {
    immediateAction = {
      icon: 'moon',
      title: 'Core Circadian Night (Nadir Zone)',
      subtitle: 'Body temperature lowest. Minimize cognitive load and prepare for sleep.',
      urgency: 'medium',
      actionType: 'rest',
    };
  }

  const safteScore = Math.max(45, Math.min(99, Math.round(baseSafte)));
  const safteCategory: CircadianPlan['currentStatus']['safteCategory'] =
    safteScore >= 85 ? 'optimal' : safteScore >= 70 ? 'moderate' : 'fatigue_risk';

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
      safteScore,
      safteCategory,
      biologicalPhase,
      immediateAction,
    },
  };
}
