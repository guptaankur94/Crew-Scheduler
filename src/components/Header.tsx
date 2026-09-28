import React, { useState, useEffect } from 'react';
import { CircadianPlan } from '../types/circadian';
import { AIRPORTS } from '../data/airports';
import {
  Compass,
  MapPin,
  Clock,
  Upload,
  BookOpen,
  Download,
  Settings2,
  ChevronDown,
  Info,
} from 'lucide-react';
import { downloadIcsFile } from '../services/icsExport';
import { Menu } from 'lucide-react';

interface HeaderProps {
  plan: CircadianPlan;
  onChangeHomeBase: (iata: string, tzOffset: number) => void;
  onOpenUploader: () => void;
  onOpenScience: () => void;
  onOpenCustomizer: () => void;
  onOpenMobileMenu?: () => void;
  activeViewTitle?: string;
}

export const Header: React.FC<HeaderProps> = ({
  plan,
  onChangeHomeBase,
  onOpenUploader,
  onOpenScience,
  onOpenCustomizer,
  onOpenMobileMenu,
  activeViewTitle,
}) => {
  const [time, setTime] = useState(new Date());
  const [showBasePicker, setShowBasePicker] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const { preferences, roster } = plan;
  const hbtOffset = preferences.homeBaseTzOffset;
  const hbtTime = new Date(time.getTime() + hbtOffset * 3600000);

  const formatClock = (d: Date) => {
    const h = d.getUTCHours().toString().padStart(2, '0');
    const m = d.getUTCMinutes().toString().padStart(2, '0');
    const s = d.getUTCSeconds().toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  const baseAirport = AIRPORTS[roster.homeBase] || {
    city: roster.homeBase,
    name: 'Home Base',
    iata: roster.homeBase,
    tzOffset: hbtOffset,
  };

  // Determine current active location from upcoming/current flight if away from home
  const activeFlight = roster.flights[0];
  const isAway = activeFlight && activeFlight.destination !== roster.homeBase;
  const localAirport = isAway ? (AIRPORTS[activeFlight.destination] || {
    city: activeFlight.destinationCity || activeFlight.destination,
    iata: activeFlight.destination,
    tzOffset: activeFlight.destTzOffset,
  }) : null;

  const localTime = localAirport ? new Date(time.getTime() + localAirport.tzOffset * 3600000) : null;

  const quickBases = ['DEL', 'BOM', 'BLR', 'HYD', 'CCU', 'DXB', 'AUH', 'SIN', 'LHR'];

  return (
    <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-slate-950/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-2.5 sm:px-6">
        {/* Top Level: Brand & Action Shortcuts */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {onOpenMobileMenu && (
              <button
                onClick={onOpenMobileMenu}
                className="flex lg:hidden h-8 w-8 items-center justify-center rounded-lg border border-slate-800 bg-slate-900 text-slate-300 hover:text-white"
                title="Open menu"
              >
                <Menu className="h-4 w-4" />
              </button>
            )}

            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600/20 text-blue-400 ring-1 ring-blue-500/30">
              <Compass className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold tracking-tight text-white">
                  CrewCircadian
                </span>
                {activeViewTitle && (
                  <span className="text-xs font-semibold text-blue-400 border-l border-slate-800 pl-2 hidden sm:inline">
                    {activeViewTitle}
                  </span>
                )}
              </div>
              <span className="text-[11px] text-slate-400 hidden sm:block">
                Cabin Crew Rest & Chrono-Nutrition System
              </span>
            </div>
          </div>

          {/* Action Tools & Mobile Clock Chip */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Mobile Clock Pill (Replaces bulky banner on mobile) */}
            <button
              onClick={() => setShowBasePicker(!showBasePicker)}
              className="flex sm:hidden items-center gap-1 rounded-lg border border-blue-900/60 bg-blue-950/40 px-2 py-1 text-[11px] font-mono font-bold text-blue-300"
              title="Change Home Base"
            >
              <MapPin className="h-3 w-3 text-blue-400" />
              <span>{roster.homeBase}</span>
              <span className="text-white font-extrabold">{formatClock(hbtTime).slice(0, 5)}</span>
            </button>

            <button
              onClick={() => downloadIcsFile(plan)}
              title="Export sleep and caffeine windows to Apple/Google calendar (.ics)"
              className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/80 hover:bg-slate-800 px-2.5 py-1.5 text-xs font-medium text-slate-300 transition-colors"
            >
              <Download className="h-3.5 w-3.5 text-indigo-400" />
              <span className="hidden sm:inline">Export .ICS</span>
            </button>
          </div>
        </div>

        {/* PRIMARY MENTAL ANCHOR: The Body Clock Anchor Banner (Visible on sm+ screens) */}
        <div className="relative hidden sm:flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-900/30 bg-gradient-to-r from-blue-950/40 via-slate-900/60 to-slate-950 px-3.5 py-2.5">
          {/* Main Home Base Body Clock Anchor */}
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400 ring-1 ring-blue-500/20">
              <MapPin className="h-4 w-4" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-400">
                  Body Clock Anchor (Home Base)
                </span>
                <span className="rounded bg-blue-500/10 px-1.5 py-0.2 text-[10px] font-mono text-blue-300">
                  UTC{hbtOffset >= 0 ? `+${hbtOffset}` : hbtOffset}
                </span>
              </div>

              <div className="flex items-baseline gap-2">
                <button
                  onClick={() => setShowBasePicker(!showBasePicker)}
                  className="group flex items-center gap-1 font-bold text-white hover:text-blue-300 transition-colors text-sm sm:text-base"
                >
                  <span>{baseAirport.city} ({roster.homeBase})</span>
                  <ChevronDown className="h-3.5 w-3.5 text-slate-400 group-hover:text-blue-300" />
                </button>
                <span className="font-mono text-sm sm:text-base font-extrabold text-blue-300 tracking-wide">
                  {formatClock(hbtTime)}
                </span>
              </div>
            </div>
          </div>

          {/* Outstation / Local Clock if traveling */}
          {localAirport && localTime && (
            <div className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-1 font-mono text-xs">
              <Clock className="h-3 w-3 text-amber-400/80" />
              <div>
                <span className="text-[9px] uppercase tracking-wider text-slate-400">
                  Station: {localAirport.city} ({localAirport.iata})
                </span>
                <p className="font-bold text-amber-300">
                  {formatClock(localTime)} ({localAirport.tzOffset >= 0 ? `+${localAirport.tzOffset}` : localAirport.tzOffset})
                </p>
              </div>
            </div>
          )}

          {/* Circadian Explanation Tooltip */}
          <div className="hidden lg:flex items-center gap-1.5 text-[11px] text-slate-400">
            <Info className="h-3.5 w-3.5 text-blue-400 shrink-0" />
            <span>All digestion & sleep recommendations below are locked to this biological clock.</span>
          </div>

          {/* Quick Home Base Switcher Dropdown */}
          {showBasePicker && (
            <div className="absolute left-4 top-14 z-50 rounded-xl border border-slate-700 bg-slate-900 p-3 shadow-2xl">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Select Your Home Base Airport
              </span>
              <div className="mt-2 grid grid-cols-3 gap-1.5">
                {quickBases.map((code) => {
                  const ap = AIRPORTS[code];
                  const isCurrent = roster.homeBase === code;
                  return (
                    <button
                      key={code}
                      onClick={() => {
                        onChangeHomeBase(code, ap?.tzOffset || 5.5);
                        setShowBasePicker(false);
                      }}
                      className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                        isCurrent
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-950 border border-slate-800 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      {code} ({ap?.city || code})
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
