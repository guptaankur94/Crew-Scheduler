export type AirlineId = string;

export interface AirportInfo {
  iata: string;
  name: string;
  city: string;
  country: string;
  tzOffset: number; // standard-time hours from UTC, e.g. +5.5 for DEL/BOM, +4 for DXB
  timeZone?: string; // IANA zone (e.g. 'Europe/London') for daylight-saving-aware offsets
}

export interface FlightLeg {
  id: string;
  flightNumber: string; // e.g. "6E 205" or "EK 001"
  origin: string; // IATA code
  originCity?: string;
  destination: string; // IATA code
  destinationCity?: string;
  departureTimeUtc: string; // ISO 8601
  arrivalTimeUtc: string; // ISO 8601
  reportTimeUtc: string; // usually 60-90 min before departure
  releaseTimeUtc: string; // usually 30-45 min after arrival
  originTzOffset: number;
  destTzOffset: number;
  aircraftType?: string;
  durationMinutes: number;
  isRedEye?: boolean;
  isPositioning?: boolean; // travelling as a passenger to or from a duty (deadhead); duty time, not flying pay
  tzUnverified?: boolean; // an airport's time zone could not be verified from the reference list; must be checked before saving
  bunkShift?: 'shift1' | 'shift2' | 'none'; // In-flight rest split for long-haul
  userChange?: 'added' | 'callout' | 'delayed'; // set when the person added or changed this flight themselves, not a roster upload
  userDelayMinutes?: number; // total delay the person entered for this flight
  importedFrom?: ImportSource; // the upload this flight came from, so the app can say why it believes it
  printed?: { date: string; dep: string; arr: string; arrDate?: string; report?: string; release?: string }; // times exactly as printed on the roster
  timeConvention?: 'local' | 'home' | 'utc'; // which clock the printed times were read in
  correctedByUser?: boolean; // the person fixed a reading mistake in this flight (Month screen)
  operationalDelay?: { minutes: number; rosteredDepartureUtc: string; rosteredArrivalUtc: string; rosteredReleaseUtc: string }; // set only on the plan's working copy when the person reported a delay; never saved in the roster
}

/** A standby period from the roster: at home (on call) or at the airport (ready to fly). */
export interface StandbyDuty {
  id: string;
  kind: 'home' | 'airport';
  airport: string; // where the standby is held, usually the home base
  startUtc: string;
  endUtc: string;
  importedFrom?: ImportSource;
}

/**
 * Something the person told the app happened, kept separate from the roster (what the airline published).
 * The plan uses the roster with these applied; the roster itself is never changed by them.
 *   delay             a flight leaves late: departure, arrival and release move; the rostered report does not
 *   standby_times     a standby's times were changed by crew control
 *   standby_released  released from standby early (at or before its start means it was cancelled)
 *   callout           called out from standby (or ad hoc) to one or more flights
 *   cancelled         a rostered flight did not operate (the roster keeps it, the plan leaves it out)
 */
export type UserUpdate =
  | { id: string; kind: 'delay'; sectorKey: string; minutes: number; createdAt: string }
  | { id: string; kind: 'standby_times'; standbyKey: string; startUtc: string; endUtc: string; createdAt: string }
  | { id: string; kind: 'standby_released'; standbyKey: string; atUtc: string; createdAt: string }
  | { id: string; kind: 'callout'; standbyKey?: string; flights: FlightLeg[]; createdAt: string }
  | { id: string; kind: 'cancelled'; sectorKey: string; createdAt: string };

/** Which upload an item came from (shown as its source). */
export interface ImportSource {
  title: string; // file name or 'Pasted text'
  at: string; // ISO time of the upload
}

/** A non-flying day listed on the roster. Dates are as printed on the roster (home-base dates). */
export interface OtherDuty {
  id: string;
  kind: 'off' | 'leave' | 'sick' | 'training' | 'other';
  date: string; // YYYY-MM-DD
  code?: string; // as printed, e.g. 'OFF', 'AL', 'SCK', 'SIM'
  importedFrom?: ImportSource;
}

export interface LayoverInfo {
  id: string;
  airport: string;
  city: string;
  tzOffset: number;
  startUtc: string;
  endUtc: string;
  durationHours: number;
  strategy: 'home_base_time' | 'local_time' | 'transition';
}

export type EventType = 
  | 'flight'
  | 'duty_ground'
  | 'pre_flight_prep'
  | 'anchor_sleep'
  | 'recovery_sleep'
  | 'nasa_nap'
  | 'eating_window'
  | 'fasting_window'
  | 'caffeine_allowed'
  | 'caffeine_cutoff'
  | 'light_exposure'
  | 'melatonin_shield'
  | 'wocl_risk'
  | 'rest_day'
  | 'standby'
  | 'exercise_cutoff'
  | 'alcohol_cutoff';

/**
 * How well a rule is supported: strong (consistent trials or reviews), moderate (some trials or expert guidance),
 * limited (early or mixed evidence; shown as a gentle guide), practical (arithmetic on your roster and settings),
 * regulation (a legal rule, not a health claim).
 */
export type EvidenceGrade = 'strong' | 'moderate' | 'limited' | 'practical' | 'regulation';

export interface ScientificCitation {
  /** Stable ID of the rule in the rule book (docs/RULE_BOOK.md), e.g. SLEEP-01. */
  ruleId: string;
  evidence: EvidenceGrade;
  organization: string;
  studyTitle: string;
  keyFinding: string;
  explanation: string;
  actionableTip: string;
  sourceUrl?: string; // link to the document the claim comes from
}

export interface PrepDetails {
  wakeUpHbt: string;
  cabPickupHbt: string;
  reportHbt: string;
  departureHbt: string;
  groomingMinutes: number;
  cabBufferMinutes: number;
  targetBedtimeHbt?: string;
  targetBedtimeDateStr?: string;
  caffeineCutoffHbt?: string;
  wakeUpUtc?: string;
  cabPickupUtc?: string;
  targetBedtimeUtc?: string;
  dutyCategory?: 'early_morning' | 'daytime' | 'evening' | 'redeye';
  step1Label?: string;
  step1Description?: string;
  bedtimeExplanation?: string;
  debriefMinutes?: number;
  debriefStartHbt?: string;
  debriefEndHbt?: string;
  isAwayFromBase?: boolean; // duty starts at an outstation (hotel), not at home
  pickupLabel?: string; // e.g. 'Leave home' or 'Hotel pickup'
}

export interface CircadianEvent {
  id: string;
  dutyDate?: string; // Links this event to a specific duty calendar date
  type: EventType;
  title: string;
  subtitle: string;
  startUtc: string;
  endUtc: string;
  durationMinutes: number;
  startLocalStr: string;
  endLocalStr: string;
  startHbtStr: string;
  endHbtStr: string;
  scientificCitation: ScientificCitation;
  priority: 'critical' | 'recommended' | 'optional';
  color: string;
  icon: string;
  userAdjustable?: boolean;
  notes?: string;
  prepDetails?: PrepDetails;
}

export type Chronotype = 'lark' | 'intermediate' | 'owl';
export type CrewRank = 'junior' | 'senior' | 'lead';
export type SalaryCurrency = 'INR' | 'AED' | 'USD';

/** Usual caffeine: light = one coffee or a few cups of chai (≈100 mg), moderate = two coffees, strong = three or more, or energy drinks (≈400 mg). */
export type CaffeineDose = 'light' | 'moderate' | 'strong';

export interface CrewPreferences {
  airline: AirlineId;
  homeBaseIata: string;
  homeBaseTzOffset: number;
  chronotype: Chronotype;
  targetSleepHours: number;
  caffeineCutoffHours: number; // hours before night sleep (follows caffeineDose when set)
  /** How much caffeine the person usually has; decides the cut-off (Gardiner et al. 2025). */
  caffeineDose?: CaffeineDose;
  /** First-run set-up: 'pending' shows the welcome steps; absent or 'done' does not. */
  onboarding?: 'pending' | 'done';
  /** Which reminders the person switched on (all off unless chosen). */
  reminders?: Partial<Record<'wake' | 'leave' | 'bedtime' | 'caffeine', boolean>>;
  preferredNapDuration: 25 | 26 | 45 | 90; // NASA 26m vs full cycle 90m
  groomingMinutes: number; // Time from wake-up to cab pickup (e.g. 60 min)
  cabBufferMinutes: number; // Time from cab pickup to reporting at base (e.g. 60 min)
  debriefMinutes?: number; // Post-flight debrief & release buffer (e.g. 30 min)
  crewRank: CrewRank;
  currency: SalaryCurrency;
  customBasePay?: number;
  customHourlyRate?: number;
  customStandbyRate?: number;
  customLayoverRate?: number;
  customNightRate?: number;
  payslipUploaded?: boolean;
  payslipFileName?: string;
  // Wearable sleep sync override (Apple Health / Oura / Garmin)
  actualLastSleepHours?: number; // hours slept last night, as entered by the user
  actualLastSleepLoggedAt?: string; // ISO time the entry was made; it stops applying after 48 hours
  /** One-tap answers to "Did you get this sleep?", by the planned sleep's start (UTC). Never scored. Last 60 kept. */
  sleepFeedback?: Record<string, 'yes' | 'partly' | 'no'>;
  useMelatoninProtocol?: boolean;
  bunkShiftAssignments?: Record<string, 'shift1' | 'shift2'>;
  payPeriodStartDay?: number; // day of the month the salary window starts (1 = calendar month, up to 28)
  rosterTimeConvention?: 'local' | 'home' | 'utc'; // how the person's rosters print times (default: each airport's local time)
  usualBedtime?: string; // 'HH:MM' home time: the person's own bedtime on normal nights (overrides the chronotype default)
  usualWakeTime?: string; // 'HH:MM' home time; with the bedtime it sets targetSleepHours
  dutyLimitRules?: 'dgca-cc-iv' | 'dgca-cc-v-draft'; // which DGCA cabin crew rules the duty-limit guide uses (default: the one in force)
}

export interface SalaryBreakdown {
  totalEarnings: number;
  currency: SalaryCurrency;
  currencySymbol: string;
  baseFixedPay: number;
  flyingPay: number;
  flyingHours: number;
  flyingRate: number;
  standbyPay: number;
  standbyHours: number;
  standbyRate: number;
  layoverPerDiem: number;
  layoverCount: number;
  layoverRate: number;
  nightAllowance: number;
  nightSectors: number;
  nightRate: number;
  rankTitle: string;
  isCustomRates?: boolean;
  source?: 'standard' | 'custom' | 'payslip';
  periodStart?: string; // the window this estimate covers (home-base dates, inclusive)
  periodEnd?: string;
  periodLabel?: string; // e.g. 'October 2026' or '21 Sep – 20 Oct 2026'
}

export interface RosterData {
  id: string;
  airline: AirlineId;
  homeBase: string;
  homeBaseTzOffset: number;
  flights: FlightLeg[];
  layovers: LayoverInfo[];
  periodStart?: string; // first date the roster covers (YYYY-MM-DD), when the roster states it
  periodEnd?: string; // last date the roster covers
  totalDays?: number;
  standbyHours?: number;
  standbyDuties?: StandbyDuty[];
  otherDuties?: OtherDuty[]; // OFF, leave, sick and training days as listed on the roster
  rawText?: string;
  parsedAt: string;
  sourceDocumentUrl?: string;
  sourceDocumentName?: string;
}

export type HistoryActionType = 'upload' | 'preset' | 'manual_edit' | 'cleared' | 'undo';

/** One day's changes in a history entry, in plain words. */
export interface HistoryDayChange {
  date: string; // YYYY-MM-DD
  label: string; // e.g. 'Now free', 'Changed'
  lines: string[]; // e.g. '6E 408 BLR→PNQ 04:30 → 04:12'
}

export interface RosterHistoryEntry {
  id: string;
  timestamp: string; // ISO string of action time
  actionType: HistoryActionType;
  title: string; // e.g. "IndiGo_Oct_Roster.png" or "Delhi 30-Day Heavy Flying"
  description?: string; // Summary of change
  airline: string;
  homeBase: string;
  flightsCount: number;
  dateRange?: string; // e.g. "Oct 01 - Oct 30, 2026"
  isActive: boolean;
  rosterSnapshot?: RosterData; // Snapshot to enable instant restore
  previousSnapshot?: RosterData; // the roster just before this change; kept on the newest entry only, for Undo
  changes?: HistoryDayChange[]; // what changed, day by day (roster updates)
  updatesSnapshot?: UserUpdate[]; // the person's updates after this change
  previousUpdates?: UserUpdate[]; // the person's updates just before this change; newest entry only, for Undo
  sourceDocumentUrl?: string;
  sourceDocumentName?: string;
}

export interface DailyCircadianSummary {
  dateStr: string; // YYYY-MM-DD
  dayLabel: string; // e.g. "Mon, Oct 12"
  dayNumber: number; // 1 to 30
  isOffDay: boolean;
  dutyType: 'flight' | 'off' | 'standby' | 'layover' | 'training' | 'leave' | 'sick';
  totalSleepHours: number;
  napsCount: number;
  eatingWindowHours: number;
  woclExposureMinutes: number;
  fatigueRiskLevel: 'low' | 'moderate' | 'high';
  keyGuidance: string;
  outsideRoster?: boolean; // true for days the roster does not cover (usual home-time rhythm only)
  noDuty?: boolean; // a blank day inside the roster: nothing at all listed for it (shown as "No duty", counted with days off)
  outlook?: {
    level: 'steady' | 'watch' | 'harder';
    headline: string; // e.g. 'Harder day ahead'
    reasons: string[]; // plain reasons, e.g. 'an early start (wake 03:30)'
    tip: string;
  };
  prepDetails?: PrepDetails;
  layoverStation?: {
    city: string;
    iata: string;
    hotelBlackoutRating: string;
    diningTip: string;
    tempCelsius: number;
    timeZoneDiffStr: string;
  };
}

export interface ImmediateActionCard {
  icon: string;
  title: string;
  subtitle: string;
  urgency: 'high' | 'medium' | 'info';
  actionType: 'sunglasses' | 'caffeine' | 'fasting' | 'nap' | 'flight' | 'rest' | 'melatonin';
}

export interface CircadianPlan {
  roster: RosterData;
  preferences: CrewPreferences;
  events: CircadianEvent[];
  dailySummaries: DailyCircadianSummary[];
  monthlyStats: {
    totalFlightHours: number;
    totalSectors: number;
    dutyDays: number;
    offDays: number;
    woclNightFlights: number;
    avgSleepPerDay: number;
    standbyHours: number;
  };
  salaryBreakdown: SalaryBreakdown;
  generatedAt: string;
  currentStatus: {
    currentPhase: string;
    stateType: 'alert' | 'sleep_prep' | 'eating_open' | 'fasting' | 'caffeine_ban' | 'wocl_warning';
    summaryAdvice: string;
    nextMilestoneTitle: string;
    nextMilestoneTime: string;
    minutesUntilNext: number;
    biologicalPhase: 'day' | 'night_nadir' | 'transition';
    immediateAction: ImmediateActionCard;
  };
}
