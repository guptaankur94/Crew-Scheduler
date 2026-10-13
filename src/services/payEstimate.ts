import { CrewPreferences } from '../types/circadian';
import { hoursMinutes, PeriodStats } from './periodStats';

/*
 * PAY ESTIMATE FROM YOUR OWN RATES
 *
 * Only rates the crew member entered are used; nothing is filled in from example rates (Product Constitution).
 * Parts without a rate are left out and listed, so the estimate never looks more complete than it is.
 */

export type RateKey = 'customBasePay' | 'customHourlyRate' | 'customStandbyRate' | 'customLayoverRate' | 'customNightRate';

export const RATE_FIELDS: { key: RateKey; label: string; per: string }[] = [
  { key: 'customBasePay', label: 'Fixed monthly pay', per: 'a month' },
  { key: 'customHourlyRate', label: 'Flying', per: 'per flying hour' },
  { key: 'customStandbyRate', label: 'Standby', per: 'per standby hour' },
  { key: 'customLayoverRate', label: 'Layover allowance', per: 'per layover night' },
  { key: 'customNightRate', label: 'Night flying allowance', per: 'per night flight' },
];

export interface PayLine {
  key: RateKey;
  label: string;
  detail: string;
  amount: number;
}

export interface PayEstimate {
  lines: PayLine[];
  total: number;
  /** Parts with no rate entered (not included). */
  missing: string[];
}

export function payFromOwnRates(stats: Pick<PeriodStats, 'flyingMinutes' | 'standbyMinutes' | 'layoverNights' | 'nightFlights'>, prefs: Pick<CrewPreferences, RateKey>): PayEstimate | null {
  // Hours from exact minutes (46:30 is 46.5 hours), shown as hours:minutes
  const quantity: Record<RateKey, { n: number; unit: string; shown?: string }> = {
    customBasePay: { n: 1, unit: '' },
    customHourlyRate: { n: stats.flyingMinutes / 60, unit: 'flying', shown: hoursMinutes(stats.flyingMinutes) },
    customStandbyRate: { n: stats.standbyMinutes / 60, unit: 'standby', shown: hoursMinutes(stats.standbyMinutes) },
    customLayoverRate: { n: stats.layoverNights, unit: 'layover nights' },
    customNightRate: { n: stats.nightFlights, unit: 'night flights' },
  };
  const lines: PayLine[] = [];
  const missing: string[] = [];
  for (const f of RATE_FIELDS) {
    const rate = prefs[f.key];
    if (rate === undefined || rate === null || !Number.isFinite(rate)) {
      missing.push(f.label);
      continue;
    }
    const q = quantity[f.key];
    lines.push({ key: f.key, label: f.label, detail: f.key === 'customBasePay' ? 'fixed' : `${q.shown ?? q.n} ${q.unit} × ${rate}`, amount: Math.round(q.n * rate) });
  }
  if (!lines.length) return null;
  return { lines, total: lines.reduce((s, l) => s + l.amount, 0), missing };
}
