import React, { useState } from 'react';
import { CircadianPlan } from '../types/circadian';
import {
  Moon,
  Coffee,
  Utensils,
  Zap,
  HelpCircle,
  Droplets,
  AlertTriangle,
  Sun,
  Shield,
  Activity,
  CheckCircle2,
  Clock,
  Glasses,
} from 'lucide-react';

interface CockpitStatusProps {
  plan: CircadianPlan;
  onOpenScienceModal: () => void;
}

export const CockpitStatus: React.FC<CockpitStatusProps> = ({ plan, onOpenScienceModal }) => {
  const [waterCups, setWaterCups] = useState<number>(3);
  const targetWater = 8;
  const { currentStatus } = plan;

  const getStatusTheme = () => {
    switch (currentStatus.stateType) {
      case 'alert':
        return {
          icon: <Zap className="h-4 w-4 text-amber-400" />,
          title: 'Active Flight Duty',
          pill: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
          border: 'border-amber-500/20',
        };
      case 'sleep_prep':
        return {
          icon: <Moon className="h-4 w-4 text-purple-400" />,
          title: 'Target Sleep Window',
          pill: 'bg-purple-500/10 text-purple-300 border-purple-500/30',
          border: 'border-purple-500/20',
        };
      case 'caffeine_ban':
        return {
          icon: <Coffee className="h-4 w-4 text-red-400" />,
          title: 'Caffeine Cutoff Active',
          pill: 'bg-red-500/10 text-red-300 border-red-500/30',
          border: 'border-red-500/20',
        };
      case 'fasting':
        return {
          icon: <Utensils className="h-4 w-4 text-emerald-400" />,
          title: 'Gut Rest / Fasting Period',
          pill: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
          border: 'border-emerald-500/20',
        };
      case 'wocl_warning':
        return {
          icon: <AlertTriangle className="h-4 w-4 text-rose-400" />,
          title: 'Window of Circadian Low (02:00-06:00)',
          pill: 'bg-rose-500/15 text-rose-300 border-rose-500/40',
          border: 'border-rose-500/30',
        };
      default:
        return {
          icon: <Utensils className="h-4 w-4 text-blue-400" />,
          title: 'Active Digestion Window',
          pill: 'bg-blue-500/10 text-blue-300 border-blue-500/30',
          border: 'border-blue-500/20',
        };
    }
  };

  const theme = getStatusTheme();
  const safte = currentStatus.safteScore;

  // Color classes for SAFTE Score
  const safteTheme =
    safte >= 85
      ? {
          color: 'text-emerald-400',
          border: 'border-emerald-500/40',
          bg: 'bg-emerald-950/30',
          label: 'Optimal Vigilance',
          sub: 'Reaction time & executive function peak',
        }
      : safte >= 70
      ? {
          color: 'text-sky-300',
          border: 'border-sky-500/40',
          bg: 'bg-sky-950/30',
          label: 'Standard Alertness',
          sub: 'Routine flight operations compliant',
        }
      : {
          color: 'text-rose-400',
          border: 'border-rose-500/40',
          bg: 'bg-rose-950/30',
          label: 'WOCL Fatigue Risk',
          sub: 'Micro-sleep vulnerability; cross-check duties',
        };

  const [showMobileDetails, setShowMobileDetails] = useState<boolean>(false);
  const action = currentStatus.immediateAction;

  return (
    <div className="space-y-2.5 sm:space-y-3">
      {/* 1. GLANCEABLE 3-SECOND ACTION STRIP (Immediate operational clarity) */}
      <div
        className={`rounded-2xl border p-2.5 sm:p-3.5 shadow-sm transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 ${
          action.urgency === 'high'
            ? 'border-rose-800/80 bg-gradient-to-r from-rose-950/60 via-slate-900 to-slate-950 text-rose-200'
            : action.urgency === 'medium'
            ? 'border-amber-800/80 bg-gradient-to-r from-amber-950/50 via-slate-900 to-slate-950 text-amber-200'
            : 'border-blue-800/60 bg-gradient-to-r from-blue-950/40 via-slate-900 to-slate-950 text-blue-200'
        }`}
      >
        <div className="flex items-center gap-2.5 sm:gap-3">
          <div
            className={`flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-xl font-bold ${
              action.urgency === 'high'
                ? 'bg-rose-500/20 text-rose-400 ring-1 ring-rose-500/40'
                : action.urgency === 'medium'
                ? 'bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/40'
                : 'bg-blue-500/20 text-blue-400 ring-1 ring-blue-500/40'
            }`}
          >
            {action.actionType === 'sunglasses' ? (
              <Glasses className="h-4 w-4 sm:h-5 sm:w-5" />
            ) : action.actionType === 'caffeine' ? (
              <Coffee className="h-4 w-4 sm:h-5 sm:w-5" />
            ) : action.actionType === 'nap' ? (
              <Moon className="h-4 w-4 sm:h-5 sm:w-5" />
            ) : action.actionType === 'fasting' ? (
              <Utensils className="h-4 w-4 sm:h-5 sm:w-5" />
            ) : action.urgency === 'high' ? (
              <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5" />
            ) : (
              <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="text-[9px] sm:text-[10px] uppercase font-black tracking-wider text-slate-400 truncate">
                Live Bio-Clock HUD (Right Now)
              </span>
              <span
                className={`rounded px-1.5 py-0.2 text-[8px] sm:text-[9px] font-mono font-bold uppercase shrink-0 ${
                  action.urgency === 'high'
                    ? 'bg-rose-500/20 text-rose-300'
                    : 'bg-slate-800 text-slate-300'
                }`}
              >
                {action.urgency}
              </span>
            </div>
            <p className="text-xs sm:text-sm font-bold text-white mt-0.5 truncate">{action.title}</p>
            <p className="text-[11px] sm:text-xs text-slate-300 line-clamp-1">{action.subtitle}</p>
          </div>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-2 border-t sm:border-t-0 border-slate-800/60 pt-1.5 sm:pt-0">
          <div className="sm:hidden flex items-center gap-2">
            <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/40">
              SAFTE {safte}/100
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowMobileDetails(!showMobileDetails)}
              className="sm:hidden rounded-lg border border-slate-800 bg-slate-900/80 px-2 py-1 text-[10px] font-medium text-slate-300 hover:bg-slate-800"
            >
              {showMobileDetails ? 'Hide Vitals ▲' : 'Vitals & Phase ▼'}
            </button>
            <button
              onClick={onOpenScienceModal}
              className="rounded-lg border border-slate-800 bg-slate-900/80 px-2 sm:px-2.5 py-1 sm:py-1.5 text-[10px] sm:text-[11px] font-medium text-slate-300 hover:bg-slate-800 transition-colors shrink-0"
            >
              Science ➔
            </button>
          </div>
        </div>
      </div>

      {/* 2. MAIN COCKPIT STATUS CARD (Always visible on sm+, expandable on mobile) */}
      <div className={`rounded-2xl border ${theme.border} bg-slate-900/80 p-3.5 sm:p-5 shadow-lg transition-all ${
        showMobileDetails ? 'block' : 'hidden sm:block'
      }`}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          {/* Left: What is happening right now */}
          <div className="space-y-1.5 flex-1">
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${theme.pill}`}>
                {theme.icon}
                {theme.title}
              </span>
              <button
                onClick={onOpenScienceModal}
                className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 transition-colors"
              >
                <HelpCircle className="h-3.5 w-3.5 text-slate-400" />
                <span className="underline decoration-slate-600 underline-offset-2">Why this window?</span>
              </button>
            </div>

            <h2 className="text-base sm:text-lg font-bold text-white">
              {currentStatus.currentPhase}
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-xl">
              {currentStatus.summaryAdvice}
            </p>
          </div>

          {/* Center-Right: SAFTE Alertness Gauge, Biological Phase Meter & Next Action */}
          <div className="flex flex-col sm:flex-row sm:flex-wrap lg:flex-row items-stretch sm:items-center gap-2.5 shrink-0 border-t lg:border-t-0 lg:border-l border-slate-800 pt-3 lg:pt-0 lg:pl-5">
            {/* 2-Column Gauge Row on Mobile, Flex on Desktop */}
            <div className="grid grid-cols-2 sm:flex items-center gap-2.5 w-full sm:w-auto">
              {/* SAFTE Biomathematical Score */}
              <div className={`rounded-xl border ${safteTheme.border} ${safteTheme.bg} p-2.5 min-w-0 sm:min-w-[135px]`}>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                    <Activity className="h-3 w-3 text-blue-400" /> SAFTE
                  </span>
                  <span className={`font-mono font-black text-sm sm:text-base ${safteTheme.color}`}>
                    {safte}/100
                  </span>
                </div>
                <p className={`text-[11px] font-bold mt-1 ${safteTheme.color} truncate`}>
                  {safteTheme.label}
                </p>
                <p className="text-[9px] text-slate-400 mt-0.5 leading-tight truncate">
                  {safteTheme.sub}
                </p>
              </div>

              {/* Biological Phase Meter */}
              <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-2.5 min-w-0 sm:min-w-[130px]">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block truncate">
                  Circadian Phase
                </span>
                <div className="flex items-center gap-1.5 mt-1">
                  {currentStatus.biologicalPhase === 'day' ? (
                    <Sun className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                  ) : currentStatus.biologicalPhase === 'night_nadir' ? (
                    <Moon className="h-3.5 w-3.5 text-purple-400 shrink-0" />
                  ) : (
                    <Clock className="h-3.5 w-3.5 text-sky-400 shrink-0" />
                  )}
                  <span className="font-bold text-xs text-white truncate">
                    {currentStatus.biologicalPhase === 'day'
                      ? 'Biological Day'
                      : currentStatus.biologicalPhase === 'night_nadir'
                      ? 'Core Nadir (WOCL)'
                      : 'Phase Transition'}
                  </span>
                </div>
                <p className="text-[9px] text-slate-400 mt-0.5 truncate">
                  {currentStatus.biologicalPhase === 'day'
                    ? 'Daytime metabolic state'
                    : 'Lowest body temp & lag'}
                </p>
              </div>
            </div>

            {/* Next Milestone (Visible on BOTH mobile and desktop) */}
            <div className="flex items-center justify-between sm:block border-t sm:border-t-0 border-slate-800/80 pt-2 sm:pt-0 text-left">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Next Action ({currentStatus.nextMilestoneTime})
                </span>
                <p className="text-xs font-semibold text-white truncate max-w-[180px] sm:max-w-[150px]">
                  {currentStatus.nextMilestoneTitle}
                </p>
              </div>
              <p className="text-[11px] font-mono text-blue-400 font-semibold sm:mt-0.5">
                {currentStatus.minutesUntilNext > 0
                  ? `in ${Math.floor(currentStatus.minutesUntilNext / 60)}h ${currentStatus.minutesUntilNext % 60}m`
                  : 'Starting now'}
              </p>
            </div>

            {/* Altitude Hydration Logger */}
            <button
              onClick={() => setWaterCups((c) => Math.min(10, c + 1))}
              className="flex items-center justify-center sm:justify-start gap-2 rounded-xl border border-sky-800/60 bg-sky-950/40 hover:bg-sky-900/50 px-3 py-2 text-xs transition-colors w-full sm:w-auto"
              title="Click to log +250ml water intake"
            >
              <Droplets className="h-4 w-4 text-sky-400" />
              <div className="text-left font-mono">
                <span className="text-[10px] text-slate-400 block">Hydration (+250ml)</span>
                <span className="font-bold text-sky-200">
                  {waterCups * 250}ml <span className="text-[10px] text-slate-400">({waterCups}/{targetWater})</span>
                </span>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
