import React from 'react';
import {
  Compass,
  Calendar,
  UploadCloud,
  Sliders,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  CalendarDays,
} from 'lucide-react';
import { CircadianPlan } from '../types/circadian';
import { lookupAirport } from '../data/airports';

export type NavView = 'today' | 'roster' | 'mastersheet' | 'upload' | 'settings' | 'science';

interface SidebarProps {
  activeView: NavView;
  onSelectView: (view: NavView) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  plan: CircadianPlan;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeView,
  onSelectView,
  isCollapsed,
  onToggleCollapse,
  plan,
  isMobileOpen = false,
  onCloseMobile,
}) => {
  const { preferences, roster } = plan;

  const navItems: { id: NavView; label: string; shortLabel: string; icon: React.ReactNode; badge?: string; desc: string }[] = [
    {
      id: 'today',
      label: "Today's Duty",
      shortLabel: 'Today',
      icon: <Clock className="h-4 w-4" />,
      desc: 'What to do next'
    },
    {
      id: 'roster',
      label: 'Days',
      shortLabel: 'Days',
      icon: <Calendar className="h-4 w-4" />,
      desc: 'Your days, step by step',
    },
    {
      id: 'mastersheet',
      label: 'Month',
      shortLabel: 'Month',
      icon: <CalendarDays className="h-4 w-4" />,
      desc: 'Hours, calendar & checks',
    },
    {
      id: 'upload',
      label: 'Rosters',
      shortLabel: 'Rosters',
      icon: <UploadCloud className="h-4 w-4" />,
      desc: 'Upload, re-read or remove',
    },
    {
      id: 'settings',
      label: 'Settings',
      shortLabel: 'Settings',
      icon: <Sliders className="h-4 w-4" />,
      desc: 'Commute, sleep & caffeine',
    },
    {
      id: 'science',
      label: 'The science',
      shortLabel: 'Science',
      icon: <BookOpen className="h-4 w-4" />,
      desc: 'Sources behind the advice',
    },
  ];

  const baseAirport = {
    city: lookupAirport(roster.homeBase)?.city || roster.homeBase,
    iata: roster.homeBase,
  };

  const handleNavClick = (viewId: NavView) => {
    onSelectView(viewId);
    if (onCloseMobile) onCloseMobile();
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden transition-opacity"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 flex flex-col justify-between border-r border-slate-800/80 bg-slate-950/95 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] backdrop-blur-xl transition-all duration-300 ${
          isCollapsed ? 'w-18' : 'w-64'
        } ${isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        {/* Top Brand Header */}
        <div>
          <div className="flex items-center justify-between border-b border-slate-800/80 p-4">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600/20 text-blue-400 ring-1 ring-blue-500/40">
                <Compass className="h-5 w-5" />
              </div>
              {!isCollapsed && (
                <div className="truncate">
                  <span className="font-bold text-sm tracking-tight text-white block leading-tight">
                    CrewCircadian
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono tracking-wider uppercase">
                    Rest planner for cabin crew
                  </span>
                </div>
              )}
            </div>

            {/* Desktop Collapse Toggle */}
            <button
              onClick={onToggleCollapse}
              className="hidden lg:flex h-7 w-7 items-center justify-center rounded-lg border border-slate-800 bg-slate-900/80 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title={isCollapsed ? 'Expand menu' : 'Collapse menu'}
            >
              {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>
          </div>

          {/* Quick Home Base Anchor in Sidebar */}
          {!isCollapsed && (
            <div className="mx-3 mt-3 rounded-xl border border-slate-800/60 bg-slate-900/40 p-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1">
                  <MapPin className="h-3 w-3 text-blue-400" /> Home Base
                </span>
                <span className="font-mono font-bold text-blue-300 text-xs">
                  {roster.homeBase}
                </span>
              </div>
              <p className="text-[11px] text-slate-300 mt-1 font-medium truncate">
                {baseAirport.city} • UTC{preferences.homeBaseTzOffset >= 0 ? `+${preferences.homeBaseTzOffset}` : preferences.homeBaseTzOffset}
              </p>
            </div>
          )}

          {/* Navigation Links */}
          <nav className="space-y-1 p-2.5 mt-2">
            {navItems.map((item) => {
              const isActive = activeView === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={`group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-blue-600/15 text-blue-300 border border-blue-500/30 shadow-sm'
                      : 'text-slate-400 hover:bg-slate-900/60 hover:text-slate-200 border border-transparent'
                  }`}
                  title={item.label}
                >
                  {/* Left Active Line Indicator */}
                  {isActive && (
                    <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r bg-blue-400" />
                  )}

                  <div
                    className={`shrink-0 transition-colors ${
                      isActive ? 'text-blue-400' : 'text-slate-500 group-hover:text-slate-300'
                    }`}
                  >
                    {item.icon}
                  </div>

                  {!isCollapsed && (
                    <div className="flex-1 truncate">
                      <div className="flex items-center justify-between">
                        <span className="truncate">{item.label}</span>
                        {item.badge && (
                          <span
                            className={`ml-1.5 rounded px-1.5 py-0.2 text-[9px] font-mono font-bold uppercase tracking-wider ${
                              item.id === 'today'
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : 'bg-slate-800 text-slate-300'
                            }`}
                          >
                            {item.badge}
                          </span>
                        )}
                      </div>
                      <span className="block text-[10px] font-normal text-slate-500 truncate mt-0.5">
                        {item.desc}
                      </span>
                    </div>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

      </aside>
    </>
  );
};
