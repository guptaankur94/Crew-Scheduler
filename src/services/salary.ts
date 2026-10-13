import { CrewPreferences, CrewRank, RosterData, SalaryBreakdown, SalaryCurrency } from '../types/circadian';

// Salary breakdown calculator based on real airline cabin crew compensation models
/** Standby hours: an explicit total if the roster has one, otherwise the sum of its standby periods. */
export function rosterStandbyHours(roster: RosterData): number {
  if (roster.standbyHours !== undefined) return roster.standbyHours;
  const hours = (roster.standbyDuties ?? []).reduce((sum, sb) => sum + (Date.parse(sb.endUtc) - Date.parse(sb.startUtc)) / 3600000, 0);
  return Number(hours.toFixed(1));
}

export function calculateSalaryBreakdown(
  roster: RosterData,
  preferences: CrewPreferences,
  totalFlightMinutes: number,
  woclSectorsCount: number,
  layoverNights = 0,
  standbyHoursOverride?: number
): SalaryBreakdown {
  const currency = preferences.currency || 'INR';
  const rank = preferences.crewRank || 'senior';
  const flyingHours = Number((totalFlightMinutes / 60).toFixed(1));
  const standbyHours = standbyHoursOverride ?? rosterStandbyHours(roster);
  const layoverCount = layoverNights;

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
