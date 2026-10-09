import React, { useState } from 'react';
import { ChevronDown, Wallet } from 'lucide-react';
import { CrewPreferences } from '../types/circadian';
import { PeriodStats } from '../services/periodStats';
import { payFromOwnRates, RATE_FIELDS, RateKey } from '../services/payEstimate';

/** Pay estimate for the month, from rates the crew member enters (never example rates). Closed by default. */

interface Props {
  stats: PeriodStats;
  preferences: CrewPreferences;
  onUpdatePreferences: (updated: Partial<CrewPreferences>) => void;
}

const SYMBOL: Record<string, string> = { INR: '₹', AED: 'AED ', USD: '$' };

export const PayEstimateCard: React.FC<Props> = ({ stats, preferences, onUpdatePreferences }) => {
  const [open, setOpen] = useState(false);
  const estimate = payFromOwnRates(stats, preferences);
  const sym = SYMBOL[preferences.currency] ?? '';
  const money = (n: number) => `${sym}${n.toLocaleString('en-IN')}`;
  const setRate = (key: RateKey, raw: string) => {
    const n = raw.trim() === '' ? undefined : Number(raw);
    if (n !== undefined && (!Number.isFinite(n) || n < 0)) return;
    onUpdatePreferences({ [key]: n } as Partial<CrewPreferences>);
  };

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/70">
      <button onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left sm:px-5">
        <span className="flex items-center gap-2 text-sm font-semibold text-white">
          <Wallet className="h-4 w-4 text-slate-400" /> Pay estimate (your rates)
        </span>
        <span className="flex items-center gap-2 text-xs text-slate-400">
          {estimate ? <strong className="font-mono text-sm text-white">{money(estimate.total)}</strong> : 'Enter your rates'}
          <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>
      {open && (
        <div className="space-y-3 border-t border-slate-800 px-4 py-3 text-xs sm:px-5">
          <p className="text-slate-400">
            Uses only the rates you enter, from your contract or payslip. Before deductions; allowances your airline pays differently are not included. Check
            against your payslip.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {RATE_FIELDS.map((f) => (
              <label key={f.key} className="flex items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-slate-300">
                <span>
                  {f.label} <span className="text-slate-500">{f.per}</span>
                </span>
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  value={preferences[f.key] ?? ''}
                  onChange={(e) => setRate(f.key, e.target.value)}
                  placeholder="not set"
                  aria-label={`${f.label} ${f.per}`}
                  className="w-24 rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-right font-mono text-white"
                />
              </label>
            ))}
          </div>
          <label className="flex items-center gap-2 text-slate-400">
            Currency
            <select
              value={preferences.currency}
              onChange={(e) => onUpdatePreferences({ currency: e.target.value as CrewPreferences['currency'] })}
              className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-white"
            >
              <option value="INR">₹ INR</option>
              <option value="AED">AED</option>
              <option value="USD">$ USD</option>
            </select>
          </label>
          {estimate && (
            <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
              <ul className="space-y-1 font-mono text-slate-200">
                {estimate.lines.map((l) => (
                  <li key={l.key} className="flex justify-between gap-3">
                    <span className="font-sans text-slate-300">
                      {l.label} <span className="text-slate-500">{l.detail}</span>
                    </span>
                    <span>{money(l.amount)}</span>
                  </li>
                ))}
                <li className="flex justify-between gap-3 border-t border-slate-800 pt-1 font-bold text-white">
                  <span className="font-sans">Estimate</span>
                  <span>{money(estimate.total)}</span>
                </li>
              </ul>
              {estimate.missing.length > 0 && <p className="mt-2 text-slate-500">Not included (no rate entered): {estimate.missing.join(', ')}.</p>}
            </div>
          )}
        </div>
      )}
    </section>
  );
};
