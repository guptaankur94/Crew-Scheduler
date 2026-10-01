import React, { useState, useRef } from 'react';
import { CircadianPlan, CrewPreferences, CrewRank, SalaryBreakdown, SalaryCurrency } from '../types/circadian';
import {
  DollarSign,
  Upload,
  Sparkles,
  FileText,
  Sliders,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  Info,
  ChevronRight,
  TrendingUp,
  FileCheck,
  ShieldCheck,
  X,
} from 'lucide-react';

interface SalarySectionProps {
  plan: CircadianPlan;
  onUpdatePreferences: (updated: Partial<CrewPreferences>) => void;
  onClose?: () => void;
  isModal?: boolean;
}

export const SalarySection: React.FC<SalarySectionProps> = ({
  plan,
  onUpdatePreferences,
  onClose,
  isModal = false,
}) => {
  const { salaryBreakdown, preferences, monthlyStats } = plan;
  const [activeTab, setActiveTab] = useState<'breakdown' | 'custom' | 'upload'>('breakdown');
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatMoney = (val: number, symbol: string) => {
    return `${symbol}${val.toLocaleString()}`;
  };

  // Sample Payslip Presets for one-click testing
  const samplePayslips = [
    {
      id: 'indigo-senior',
      title: 'IndiGo Airlines Senior FA',
      subtitle: 'Senior Cabin Crew (Base: DEL/BOM)',
      badge: 'IndiGo Standard',
      currency: 'INR' as SalaryCurrency,
      rank: 'senior' as CrewRank,
      baseFixedPay: 48000,
      flyingHourlyRate: 620,
      standbyHourlyRate: 300,
      layoverPerDiem: 6000,
      nightAllowanceRate: 2500,
    },
    {
      id: 'emirates-grade2',
      title: 'Emirates Cabin Crew Grade II',
      subtitle: 'Flight Steward / Stewardess (Base: DXB)',
      badge: 'Emirates UAE',
      currency: 'AED' as SalaryCurrency,
      rank: 'senior' as CrewRank,
      baseFixedPay: 6200,
      flyingHourlyRate: 75,
      standbyHourlyRate: 35,
      layoverPerDiem: 450,
      nightAllowanceRate: 200,
    },
    {
      id: 'airindia-lead',
      title: 'Air India / Vistara Lead IFM',
      subtitle: 'In-Flight Manager / Line Trainer',
      badge: 'Line Lead',
      currency: 'INR' as SalaryCurrency,
      rank: 'lead' as CrewRank,
      baseFixedPay: 65000,
      flyingHourlyRate: 820,
      standbyHourlyRate: 400,
      layoverPerDiem: 8000,
      nightAllowanceRate: 3500,
    },
  ];

  const handleApplySamplePayslip = (preset: typeof samplePayslips[0]) => {
    onUpdatePreferences({
      currency: preset.currency,
      crewRank: preset.rank,
      customBasePay: preset.baseFixedPay,
      customHourlyRate: preset.flyingHourlyRate,
      customStandbyRate: preset.standbyHourlyRate,
      customLayoverRate: preset.layoverPerDiem,
      customNightRate: preset.nightAllowanceRate,
      payslipUploaded: true,
      payslipFileName: `${preset.title} Payslip Verified`,
    });
    setUploadSuccess(`Successfully loaded contract numbers from ${preset.title}!`);
    setUploadError(null);
    setActiveTab('breakdown');
  };

  const handleResetToDefaults = () => {
    onUpdatePreferences({
      customBasePay: undefined,
      customHourlyRate: undefined,
      customStandbyRate: undefined,
      customLayoverRate: undefined,
      customNightRate: undefined,
      payslipUploaded: false,
      payslipFileName: undefined,
    });
    setUploadSuccess(null);
    setUploadError(null);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset so choosing the same file again still triggers a new upload
    e.target.value = '';
    if (!file) return;

    setIsUploading(true);
    setUploadError(null);
    setUploadSuccess(null);

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64 = reader.result as string;
          const res = await fetch('/api/payslip/parse', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              imageBase64: base64,
              mimeType: file.type || 'image/png',
            }),
          });

          const json = await res.json();
          if (!json.success || !json.data) {
            throw new Error(json.error || 'Failed to extract remuneration from salary slip.');
          }

          const parsed = json.data;
          onUpdatePreferences({
            currency: (parsed.currency === 'AED' ? 'AED' : parsed.currency === 'USD' ? 'USD' : 'INR') as SalaryCurrency,
            customBasePay: parsed.baseFixedPay,
            customHourlyRate: parsed.flyingHourlyRate,
            customStandbyRate: parsed.standbyHourlyRate,
            customLayoverRate: parsed.layoverPerDiem,
            customNightRate: parsed.nightAllowanceRate,
            payslipUploaded: true,
            payslipFileName: file.name,
          });

          setUploadSuccess(`Payslip verified! Extracted ${parsed.airline || 'Airline'} base pay and hourly rates.`);
          setActiveTab('breakdown');
        } catch (err: any) {
          setUploadError(err.message || 'Could not parse payslip. You can also pick a sample payslip below.');
        } finally {
          setIsUploading(false);
        }
      };
      reader.onerror = () => {
        setUploadError('Could not read that file. Please try a different image or PDF.');
        setIsUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      setUploadError(err.message);
      setIsUploading(false);
    }
  };

  return (
    <div className={`rounded-2xl border border-slate-800 bg-slate-900/95 p-5 sm:p-6 shadow-xl space-y-5 ${isModal ? 'max-h-[90vh] overflow-y-auto' : ''}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-800 pb-4 gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20">
            <DollarSign className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-white sm:text-lg">
                Cabin Crew Remuneration & Payslip Studio
              </h3>
              {preferences.payslipUploaded ? (
                <span className="flex items-center gap-1 rounded bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                  <ShieldCheck className="h-3 w-3" /> Payslip Verified
                </span>
              ) : salaryBreakdown.isCustomRates ? (
                <span className="rounded bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 text-[10px] font-bold text-blue-300">
                  Custom Rates
                </span>
              ) : (
                <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-slate-400">
                  Standard Model
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400">
              Calculate projected take-home pay based on block hours, standby reserve, and contractual allowances.
            </p>
          </div>
        </div>

        {/* Tab Controls & Close */}
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-xl border border-slate-800 bg-slate-950 p-1 text-xs">
            <button
              onClick={() => setActiveTab('breakdown')}
              className={`rounded-lg px-3 py-1.5 font-semibold transition-all ${
                activeTab === 'breakdown'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Overview & Payout
            </button>
            <button
              onClick={() => setActiveTab('custom')}
              className={`rounded-lg px-3 py-1.5 font-semibold transition-all ${
                activeTab === 'custom'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Rate Settings
            </button>
            <button
              onClick={() => setActiveTab('upload')}
              className={`rounded-lg px-3 py-1.5 font-semibold flex items-center gap-1.5 transition-all ${
                activeTab === 'upload'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Upload className="h-3.5 w-3.5" />
              Upload Salary Slip
            </button>
          </div>

          {onClose && (
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>

      {/* Success / Error Banners */}
      {uploadSuccess && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-900/50 bg-emerald-950/30 p-3 text-xs text-emerald-300">
          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>{uploadSuccess}</span>
        </div>
      )}
      {uploadError && (
        <div className="flex items-center gap-2 rounded-xl border border-red-900/50 bg-red-950/30 p-3 text-xs text-red-300">
          <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
          <span>{uploadError}</span>
        </div>
      )}

      {/* TAB 1: BREAKDOWN & SUMMARY */}
      {activeTab === 'breakdown' && (
        <div className="space-y-4">
          {/* Top Big Callout */}
          <div className="rounded-2xl border border-emerald-900/40 bg-gradient-to-r from-emerald-950/40 via-slate-900/90 to-slate-950 p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5" /> Projected Monthly Take-Home Pay
              </span>
              <p className="text-3xl sm:text-4xl font-black font-mono text-emerald-300">
                {formatMoney(salaryBreakdown.totalEarnings, salaryBreakdown.currencySymbol)}
              </p>
              <p className="text-xs text-slate-400">
                Based on <strong className="text-white font-mono">{salaryBreakdown.flyingHours} block hours</strong>, <strong className="text-white font-mono">{salaryBreakdown.standbyHours} standby hours</strong>, and {salaryBreakdown.layoverCount} outstation layovers.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <button
                onClick={() => setActiveTab('custom')}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-750 px-4 py-2.5 text-xs font-semibold text-slate-200 transition-colors"
              >
                <Sliders className="h-3.5 w-3.5 text-emerald-400" />
                <span>Adjust Hourly Rates</span>
              </button>
              <button
                onClick={() => setActiveTab('upload')}
                className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-4 py-2.5 text-xs font-semibold text-white shadow-md transition-colors"
              >
                <Upload className="h-3.5 w-3.5" />
                <span>Scan Payslip</span>
              </button>
            </div>
          </div>

          {/* 5 Distinct Pillars Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
            {/* 1. Base Fixed Retainer */}
            <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-3.5 space-y-1.5">
              <span className="text-[10px] text-slate-400 uppercase tracking-wide font-bold">1. Base Fixed Pay</span>
              <p className="text-lg font-bold font-mono text-white">
                {formatMoney(salaryBreakdown.baseFixedPay, salaryBreakdown.currencySymbol)}
              </p>
              <p className="text-[10px] text-slate-500 leading-snug">
                Guaranteed monthly retainer for {salaryBreakdown.rankTitle}
              </p>
            </div>

            {/* 2. Flying Hours Allowance */}
            <div className="rounded-xl border border-blue-900/40 bg-slate-950/80 p-3.5 space-y-1.5">
              <span className="text-[10px] text-blue-300 uppercase tracking-wide font-bold">2. Flying Allowance</span>
              <p className="text-lg font-bold font-mono text-blue-300">
                {formatMoney(salaryBreakdown.flyingPay, salaryBreakdown.currencySymbol)}
              </p>
              <p className="text-[10px] text-slate-400 leading-snug font-mono">
                {salaryBreakdown.flyingHours}h @ {formatMoney(salaryBreakdown.flyingRate, salaryBreakdown.currencySymbol)}/hr
              </p>
            </div>

            {/* 3. Standby Reserve Duty */}
            <div className="rounded-xl border border-amber-900/40 bg-slate-950/80 p-3.5 space-y-1.5">
              <span className="text-[10px] text-amber-300 uppercase tracking-wide font-bold">3. Standby Reserve</span>
              <p className="text-lg font-bold font-mono text-amber-300">
                {formatMoney(salaryBreakdown.standbyPay, salaryBreakdown.currencySymbol)}
              </p>
              <p className="text-[10px] text-slate-400 leading-snug font-mono">
                {salaryBreakdown.standbyHours}h @ {formatMoney(salaryBreakdown.standbyRate, salaryBreakdown.currencySymbol)}/hr
              </p>
            </div>

            {/* 4. Layover Per Diem */}
            <div className="rounded-xl border border-purple-900/40 bg-slate-950/80 p-3.5 space-y-1.5">
              <span className="text-[10px] text-purple-300 uppercase tracking-wide font-bold">4. Layover Per Diem</span>
              <p className="text-lg font-bold font-mono text-purple-300">
                {formatMoney(salaryBreakdown.layoverPerDiem, salaryBreakdown.currencySymbol)}
              </p>
              <p className="text-[10px] text-slate-400 leading-snug font-mono">
                {salaryBreakdown.layoverCount} stops @ {formatMoney(salaryBreakdown.layoverRate, salaryBreakdown.currencySymbol)}
              </p>
            </div>

            {/* 5. Red-Eye / WOCL Bonus */}
            <div className="rounded-xl border border-rose-900/40 bg-slate-950/80 p-3.5 space-y-1.5">
              <span className="text-[10px] text-rose-300 uppercase tracking-wide font-bold">5. Red-Eye / WOCL</span>
              <p className="text-lg font-bold font-mono text-rose-300">
                {formatMoney(salaryBreakdown.nightAllowance, salaryBreakdown.currencySymbol)}
              </p>
              <p className="text-[10px] text-slate-400 leading-snug font-mono">
                {salaryBreakdown.nightSectors} flights @ {formatMoney(salaryBreakdown.nightRate, salaryBreakdown.currencySymbol)}
              </p>
            </div>
          </div>

          {/* Research & Regulation Note */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3.5 text-xs text-slate-400 flex items-start gap-2.5">
            <Info className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-slate-300">
                Commercial Airline Remuneration Mechanics (DGCA & ICAO Standards):
              </p>
              <p className="text-[11px] leading-relaxed">
                Flight pay is strictly accrued on <strong>Block Hours</strong> (chock-to-chock time between pushback from gate and arrival parking brake). Standby reserve is paid on allocated availability hours. DGCA CAR Section 7 / FAA Part 121 mandates a strict rolling 30-day cap of 100 block hours.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CUSTOM RATES & CONTRACT OVERRIDES */}
      {activeTab === 'custom' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-800 pb-3 gap-2">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                Contractual Hourly Rates & Allowances
              </h4>
              <p className="text-[11px] text-slate-400">
                Fine-tune the exact hourly flying rate and reserve stipends agreed upon in your airline contract.
              </p>
            </div>

            <button
              onClick={handleResetToDefaults}
              className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-950 hover:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
            >
              <RefreshCw className="h-3 w-3" />
              <span>Reset to Standard Defaults</span>
            </button>
          </div>

          {/* Currency & Rank Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Currency</span>
              <div className="flex items-center gap-1.5 pt-1">
                {(['INR', 'AED', 'USD'] as SalaryCurrency[]).map((cur) => (
                  <button
                    key={cur}
                    onClick={() => onUpdatePreferences({ currency: cur })}
                    className={`flex-1 rounded-lg py-1.5 font-semibold text-xs transition-colors ${
                      preferences.currency === cur
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {cur === 'INR' ? '₹ INR (India)' : cur === 'AED' ? 'AED (UAE)' : '$ USD'}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Crew Seniority Level</span>
              <div className="flex items-center gap-1.5 pt-1">
                {(['junior', 'senior', 'lead'] as CrewRank[]).map((rk) => (
                  <button
                    key={rk}
                    onClick={() => onUpdatePreferences({ crewRank: rk })}
                    className={`flex-1 rounded-lg py-1.5 font-semibold text-xs capitalize transition-colors ${
                      preferences.crewRank === rk
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {rk === 'lead' ? 'Lead / IFM' : rk}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Granular Rate Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {/* Base Pay */}
            <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">Monthly Fixed Base Pay</span>
                <span className="font-mono font-bold text-emerald-400">{formatMoney(salaryBreakdown.baseFixedPay, salaryBreakdown.currencySymbol)}</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={salaryBreakdown.baseFixedPay}
                  onChange={(e) => onUpdatePreferences({ customBasePay: Number(e.target.value) || 0 })}
                  className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 font-mono text-xs text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Hourly Flying Pay */}
            <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-blue-300">Flying Hourly Rate</span>
                <span className="font-mono font-bold text-blue-400">{formatMoney(salaryBreakdown.flyingRate, salaryBreakdown.currencySymbol)}/hr</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={salaryBreakdown.flyingRate}
                  onChange={(e) => onUpdatePreferences({ customHourlyRate: Number(e.target.value) || 0 })}
                  className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 font-mono text-xs text-blue-300 focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Standby Hourly Pay */}
            <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-300">Standby Reserve Rate</span>
                <span className="font-mono font-bold text-amber-400">{formatMoney(salaryBreakdown.standbyRate, salaryBreakdown.currencySymbol)}/hr</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={salaryBreakdown.standbyRate}
                  onChange={(e) => onUpdatePreferences({ customStandbyRate: Number(e.target.value) || 0 })}
                  className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 font-mono text-xs text-amber-300 focus:border-amber-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Layover Per Diem */}
            <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-purple-300">Layover Outstation Per Diem</span>
                <span className="font-mono font-bold text-purple-400">{formatMoney(salaryBreakdown.layoverRate, salaryBreakdown.currencySymbol)}/night</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={salaryBreakdown.layoverRate}
                  onChange={(e) => onUpdatePreferences({ customLayoverRate: Number(e.target.value) || 0 })}
                  className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 font-mono text-xs text-purple-300 focus:border-purple-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Night / Red-Eye Sector Bonus */}
            <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-rose-300">Night / WOCL Sector Bonus</span>
                <span className="font-mono font-bold text-rose-400">{formatMoney(salaryBreakdown.nightRate, salaryBreakdown.currencySymbol)}/sector</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={salaryBreakdown.nightRate}
                  onChange={(e) => onUpdatePreferences({ customNightRate: Number(e.target.value) || 0 })}
                  className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 font-mono text-xs text-rose-300 focus:border-rose-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={() => setActiveTab('breakdown')}
              className="rounded-xl bg-emerald-600 hover:bg-emerald-500 px-5 py-2 text-xs font-semibold text-white shadow-md transition-colors"
            >
              Apply Rates & View Projected Pay
            </button>
          </div>
        </div>
      )}

      {/* TAB 3: UPLOAD SALARY SLIP (OCR AUTO-CONFIG) */}
      {activeTab === 'upload' && (
        <div className="space-y-4">
          <div className="border-b border-slate-800 pb-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">
              Upload Airline Salary Slip / Paystub
            </h4>
            <p className="text-[11px] text-slate-400">
              Upload a photo or PDF screenshot of your monthly paystub. Multimodal Gemini extracts the exact base pay, hourly block rates, and allowances automatically. The file is sent to Google Gemini to be read, so crop out bank details or ID numbers you do not want to share.
            </p>
          </div>

          {/* Dropzone Upload */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-700 bg-slate-950/60 p-6 text-center hover:border-emerald-500 hover:bg-slate-950 cursor-pointer transition-all space-y-2.5"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf"
              onChange={handleFileUpload}
              className="hidden"
            />
            {isUploading ? (
              <div className="flex flex-col items-center gap-2 py-4">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
                <p className="text-xs font-semibold text-white">Analyzing salary slip structure with Gemini AI...</p>
                <p className="text-[11px] text-slate-500">Extracting base pay, flying block rate & standby allowances</p>
              </div>
            ) : (
              <>
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
                  <FileText className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">
                    Click or Drag to Upload Salary Slip
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Supports PNG, JPG, or PDF screenshots of your airline pay document
                  </p>
                </div>
                <span className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-1 text-[11px] font-semibold text-slate-300">
                  Select File from Device
                </span>
              </>
            )}
          </div>

          {/* Quick One-Click Sample Payslips */}
          <div className="space-y-2 pt-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-amber-400" /> Or Test with Verified Airline Payslip Samples:
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {samplePayslips.map((sample) => (
                <div
                  key={sample.id}
                  className="rounded-xl border border-slate-800 bg-slate-950/80 p-3.5 space-y-2.5 hover:border-emerald-500/50 transition-all flex flex-col justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 text-[9px] font-bold">
                        {sample.badge}
                      </span>
                      <span className="font-mono text-xs font-bold text-white">
                        {sample.currency === 'INR' ? '₹' : sample.currency === 'AED' ? 'AED ' : '$'}{sample.flyingHourlyRate}/hr
                      </span>
                    </div>
                    <h5 className="font-bold text-white text-xs mt-1">{sample.title}</h5>
                    <p className="text-[10px] text-slate-400">{sample.subtitle}</p>
                    <p className="text-[10px] font-mono text-slate-500">
                      Base: {sample.currency === 'INR' ? '₹' : sample.currency === 'AED' ? 'AED ' : '$'}{sample.baseFixedPay.toLocaleString()} • Sby: {sample.standbyHourlyRate}/h
                    </p>
                  </div>

                  <button
                    onClick={() => handleApplySamplePayslip(sample)}
                    className="w-full flex items-center justify-center gap-1 rounded-lg border border-slate-800 bg-slate-900 hover:bg-emerald-600 hover:text-white py-1.5 text-xs font-semibold text-slate-300 transition-colors"
                  >
                    <span>Load Payslip Data</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
