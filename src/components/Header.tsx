import React, { useState, useEffect } from 'react';
import { CircadianPlan } from '../types/circadian';
import { AIRPORTS, getAirportTzOffset, lookupAirport } from '../data/airports';
import {
  Compass,
  MapPin,
  Clock,
  Download,
  ChevronDown,
  Menu,
  Radio,
} from 'lucide-react';
import { downloadIcsFile } from '../services/icsExport';

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
    const timer = setInterval(() => setTime(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  const { preferences, roster } = plan;
  const hbtOffset = preferences.homeBaseTzOffset;
  const hbtTime = new Date(time.getTime() + hbtOffset * 3600000);

  const formatClock = (d: Date) => {
    const h = d.getUTCHours().toString().padStart(2, '0');
    const m = d.getUTCMinutes().toString().padStart(2, '0');
    return `${h}:${m}`;
  };

  const baseAirport = {
    city: lookupAirport(roster.homeBase)?.city || roster.homeBase,
    iata: roster.homeBase,
  };

  // Current location: where the last landed flight went, while the roster keeps you there (the next flight
  // leaves from it) or it landed in the last 48 hours; otherwise home (e.g. after a roster ends mid-trip)
  const nowMs = time.getTime();
  const byTime = [...roster.flights].sort((a, b) => Date.parse(a.departureTimeUtc) - Date.parse(b.departureTimeUtc));
  const activeFlight = [...byTime].reverse().find((f) => Date.parse(f.arrivalTimeUtc) <= nowMs);
  const nextFlight = byTime.find((f) => Date.parse(f.departureTimeUtc) > nowMs);
  const isAway =
    !!activeFlight &&
    activeFlight.destination !== roster.homeBase &&
    (nextFlight ? nextFlight.origin === activeFlight.destination : nowMs - Date.parse(activeFlight.arrivalTimeUtc) < 48 * 3600000);
  const localAirport = isAway
    ? {
        city: lookupAirport(activeFlight.destination)?.city || activeFlight.destinationCity || activeFlight.destination,
        iata: activeFlight.destination,
        // Today's offset at that airport (daylight saving included); the flight's own verified offset otherwise
        tzOffset: getAirportTzOffset(activeFlight.destination, time) ?? activeFlight.destTzOffset,
      }
    : null;

  const localTime = localAirport
    ? new Date(time.getTime() + localAirport.tzOffset * 3600000)
    : null;

  const quickBases = ['DEL', 'BOM', 'BLR', 'HYD', 'CCU', 'DXB', 'AUH', 'SIN', 'LHR'];

  // Current active station determination
  const currentStationIata = localAirport ? localAirport.iata : roster.homeBase;
  const currentStationCity = localAirport ? localAirport.city : baseAirport.city;
  const currentStationTz = localAirport ? localAirport.tzOffset : hbtOffset;
  const currentStationTime = localAirport && localTime ? localTime : hbtTime;
  const tzDiffHours = currentStationTz - hbtOffset;

  return (
    <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-slate-950/95 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-3 sm:px-6 py-2.5">
        {/* Sleek, Single-Level Avionics HUD Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2.5">
          {/* LEFT-HAND SIDE: Current Location & Local Time */}
          <div className="flex items-center justify-between lg:justify-start gap-2.5 min-w-0">
            <div className="flex items-center gap-2">
              {onOpenMobileMenu && (
                <button
                  onClick={onOpenMobileMenu}
                  className="flex lg:hidden h-8 w-8 items-center justify-center rounded-lg border border-slate-800 bg-slate-900 text-slate-300 hover:text-white shrink-0"
                  title="Open navigation menu"
                >
                  <Menu className="h-4 w-4" />
                </button>
              )}

              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600/20 text-blue-400 ring-1 ring-blue-500/30 shrink-0">
                <Compass className="h-4 w-4" />
              </div>
              <div className="hidden sm:block">
                <span className="text-xs font-black tracking-tight text-white block leading-none">
                  CrewCircadian
                </span>
                {activeViewTitle && (
                  <span className="text-[10px] font-bold text-sky-400 block leading-tight mt-0.5 truncate max-w-[140px]">
                    {activeViewTitle}
                  </span>
                )}
              </div>
            </div>

            {/* Current Location & Local Station Time Pill (Always on Left Hand Side) */}
            <div className="flex items-center gap-2 rounded-xl border border-amber-800/60 bg-gradient-to-r from-amber-950/40 to-slate-900 px-2.5 py-1.5 text-xs shadow-sm">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-400">
                <MapPin className="h-3.5 w-3.5" />
              </div>
              <div className="text-left leading-tight min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] uppercase font-black tracking-wider text-amber-400">
                    Current Location
                  </span>
                  <span className="rounded bg-amber-500/10 px-1 py-0.2 text-[8px] font-mono text-amber-300 border border-amber-500/30">
                    UTC{currentStationTz >= 0 ? `+${currentStationTz}` : currentStationTz}
                  </span>
                  {tzDiffHours !== 0 && (
                    <span className="text-[8px] font-mono text-slate-400">
                      ({tzDiffHours > 0 ? `+${tzDiffHours}` : tzDiffHours}h)
                    </span>
                  )}
                </div>
                <div className="font-mono text-xs font-black text-amber-300 flex items-center gap-1.5 mt-0.5">
                  <span className="text-white font-extrabold">{currentStationCity}</span>
                  <span className="text-amber-400 font-bold">({currentStationIata})</span>
                  <span className="text-slate-500 font-sans">•</span>
                  <span className="text-amber-200">{formatClock(currentStationTime)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* TOP / CENTER: Always Show Biological Clock (Home Base Time) */}
          <div className="flex items-center justify-between sm:justify-center gap-2 rounded-xl border border-blue-900/60 bg-gradient-to-r from-blue-950/50 via-slate-900/90 to-blue-950/50 px-3 py-1.5 shadow-sm text-left">
            <div className="flex items-center gap-2.5">
              <div className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-500/20 text-blue-400 ring-1 ring-blue-500/40">
                <Compass className="h-4 w-4 animate-spin [animation-duration:12s]" />
                <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500" />
                </span>
              </div>
              <div className="text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] font-black uppercase tracking-wider text-blue-400">
                    Biological Clock (Home Base Time)
                  </span>
                  <span className="rounded bg-blue-500/20 border border-blue-500/40 px-1.5 py-0.2 text-[8px] font-mono font-bold text-blue-300">
                    UTC{hbtOffset >= 0 ? `+${hbtOffset}` : hbtOffset}
                  </span>
                  <span className="hidden sm:inline-flex items-center gap-1 text-[8px] font-mono text-cyan-400 font-bold uppercase">
                    <Radio className="h-2.5 w-2.5 text-cyan-400 animate-pulse" />
                    Home time
                  </span>
                </div>
                <p className="font-mono text-xs sm:text-sm font-black text-white mt-0.5">
                  {baseAirport.city} ({roster.homeBase}) •{' '}
                  <span className="text-sky-300 font-extrabold">{formatClock(hbtTime)} HBT</span>
                </p>
              </div>
            </div>
          </div>

          {/* RIGHT: Quick Home Base Switcher & Export Tools */}
          <div className="flex items-center justify-end gap-2 relative">
            <button
              onClick={() => setShowBasePicker(!showBasePicker)}
              className="flex items-center gap-1.5 rounded-xl border border-blue-900/60 bg-blue-950/40 hover:bg-blue-900/50 px-2.5 py-1.5 text-xs font-semibold text-blue-300 transition-colors"
              title="Change Home Base"
            >
              <span className="text-[10px] text-slate-400 font-sans hidden sm:inline">Home Base:</span>
              <span className="font-bold text-white">{roster.homeBase}</span>
              <ChevronDown className="h-3 w-3 text-blue-400" />
            </button>

            <button
              onClick={() => downloadIcsFile(plan)}
              title="Export sleep and duty windows to Apple/Google calendar (.ics)"
              className="flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900/80 hover:bg-slate-800 px-2.5 py-1.5 text-xs font-medium text-slate-300 transition-colors"
            >
              <Download className="h-3.5 w-3.5 text-indigo-400" />
              <span className="hidden sm:inline">Export .ICS</span>
            </button>

            {/* Quick Home Base Switcher Dropdown */}
            {showBasePicker && (
              <div className="absolute right-0 top-11 z-50 rounded-xl border border-slate-700 bg-slate-900 p-3 shadow-2xl w-64">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
                  Switch Home Base Airport
                </span>
                <div className="grid grid-cols-3 gap-1.5">
                  {quickBases.map((code) => {
                    const ap = AIRPORTS[code];
                    const isCurrent = roster.homeBase === code;
                    return (
                      <button
                        key={code}
                        onClick={() => {
                          onChangeHomeBase(code, getAirportTzOffset(code, new Date()) ?? ap?.tzOffset ?? 5.5);
                          setShowBasePicker(false);
                        }}
                        className={`rounded-lg px-2 py-1 text-xs font-semibold transition-colors ${
                          isCurrent
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-950 border border-slate-800 text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        {code}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
