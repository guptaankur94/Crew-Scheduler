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
  bunkShift?: 'shift1' | 'shift2' | 'none'; // In-flight rest split for long-haul
}

/** A standby period from the roster: at home (on call) or at the airport (ready to fly). */
export interface StandbyDuty {
  id: string;
  kind: 'home' | 'airport';
  airport: string; // where the standby is held, usually the home base
  startUtc: string;
  endUtc: string;
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
  | 'standby';

export interface ScientificCitation {
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

export interface CrewPreferences {
  airline: AirlineId;
  homeBaseIata: string;
  homeBaseTzOffset: number;
  chronotype: Chronotype;
  targetSleepHours: number;
  caffeineCutoffHours: number; // 6 or 8 hours before sleep
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
  useMelatoninProtocol?: boolean;
  bunkShiftAssignments?: Record<string, 'shift1' | 'shift2'>;
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
}

export interface RosterData {
  id: string;
  airline: AirlineId;
  crewName?: string;
  homeBase: string;
  homeBaseTzOffset: number;
  flights: FlightLeg[];
  layovers: LayoverInfo[];
  periodStart?: string;
  periodEnd?: string;
  totalDays?: number;
  standbyHours?: number;
  standbyDuties?: StandbyDuty[];
  rawText?: string;
  parsedAt: string;
  sourceDocumentUrl?: string;
  sourceDocumentName?: string;
}

export type HistoryActionType = 'upload' | 'preset' | 'manual_edit' | 'cleared';

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
  sourceDocumentUrl?: string;
  sourceDocumentName?: string;
}

export interface DailyCircadianSummary {
  dateStr: string; // YYYY-MM-DD
  dayLabel: string; // e.g. "Mon, Oct 12"
  dayNumber: number; // 1 to 30
  isOffDay: boolean;
  dutyType: 'flight' | 'off' | 'standby' | 'layover';
  totalSleepHours: number;
  napsCount: number;
  eatingWindowHours: number;
  woclExposureMinutes: number;
  fatigueRiskLevel: 'low' | 'moderate' | 'high';
  keyGuidance: string;
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
