import React, { useRef, useState } from 'react';
import { createBackupFromDevice, deleteAllLocalData, parseBackup, writeRestoredData } from '../../services/backup';
import { CrewPreferences, RosterData } from '../../types/circadian';
import { AIRPORTS, getAirportTzOffset } from '../../data/airports';
import {
  Sliders,
  Moon,
  Clock,
  Car,
  Bell,
  MapPin,
} from 'lucide-react';

interface SettingsViewProps {
  preferences: CrewPreferences;
  roster: RosterData;
  onUpdatePreferences: (updated: Partial<CrewPreferences>) => void;
  onChangeHomeBase: (iata: string, tzOffset: number) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  preferences,
  roster,
  onUpdatePreferences,
  onChangeHomeBase,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dataMessage, setDataMessage] = useState<{ text: string; tone: 'ok' | 'error' } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleExport = () => {
    const blob = new Blob([createBackupFromDevice()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `crewcircadian-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setDataMessage({ text: 'Backup saved. Keep the file somewhere safe, such as your files app or email.', tone: 'ok' });
  };

  const handleRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const result = parseBackup(await file.text(), preferences);
    if ('error' in result) {
      setDataMessage({ text: result.error, tone: 'error' });
      return;
    }
    writeRestoredData(result);
    window.location.reload();
  };

  const handleDeleteAll = () => {
    deleteAllLocalData();
    window.location.reload();
  };

  const quickBases = [
    { iata: 'DEL', name: 'Delhi', tzOffset: 5.5 },
    { iata: 'BOM', name: 'Mumbai', tzOffset: 5.5 },
    { iata: 'BLR', name: 'Bengaluru', tzOffset: 5.5 },
    { iata: 'HYD', name: 'Hyderabad', tzOffset: 5.5 },
    { iata: 'CCU', name: 'Kolkata', tzOffset: 5.5 },
    { iata: 'DXB', name: 'Dubai', tzOffset: 4 },
    { iata: 'DOH', name: 'Doha', tzOffset: 3 },
    { iata: 'SIN', name: 'Singapore', tzOffset: 8 },
    { iata: 'LHR', name: 'London Heathrow', tzOffset: 1 },
  ];

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header Banner */}
      <div className="rounded-2xl border border-slate-800 bg-gradient-to-r from-slate-900/90 via-slate-900/60 to-slate-950 p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600/10 text-blue-400 ring-1 ring-blue-500/20">
            <Sliders className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">
              Settings
            </h2>
            <p className="text-xs text-slate-400">
              Only settings that change your plan are shown here.
            </p>
          </div>
        </div>
      </div>

      {/* 1. Pre-Flight Morning Departure Buffers */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
          <Clock className="h-4 w-4 text-sky-400" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
            1. Getting to work
          </h3>
        </div>
        <p className="text-xs text-slate-400">
          Determines your exact wake-up alarm and cab arrival time before your duty report time.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Grooming Time */}
          <div className="rounded-xl border border-sky-900/40 bg-sky-950/20 p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm text-sky-200 flex items-center gap-1.5">
                <Bell className="h-4 w-4 text-sky-400" /> Grooming & Prep Duration
              </span>
              <span className="font-mono font-bold text-white text-base">
                {preferences.groomingMinutes} min
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Time from your wake-up alarm to stepping into your cab (shower, uniform, makeup, flight bag).
            </p>
            <input
              type="range"
              min="30"
              max="120"
              step="15"
              value={preferences.groomingMinutes}
              onChange={(e) => onUpdatePreferences({ groomingMinutes: parseInt(e.target.value) })}
              className="w-full accent-sky-400 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>30m (Quick)</span>
              <span>60m (Standard)</span>
              <span>120m (Leisurely)</span>
            </div>
          </div>

          {/* Cab Transit Buffer */}
          <div className="rounded-xl border border-amber-900/40 bg-amber-950/20 p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm text-amber-200 flex items-center gap-1.5">
                <Car className="h-4 w-4 text-amber-400" /> Cab Commute Buffer
              </span>
              <span className="font-mono font-bold text-white text-base">
                {preferences.cabBufferMinutes} min
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              City traffic buffer from your door to airport crew briefing center before reporting time.
            </p>
            <input
              type="range"
              min="30"
              max="120"
              step="15"
              value={preferences.cabBufferMinutes}
              onChange={(e) => onUpdatePreferences({ cabBufferMinutes: parseInt(e.target.value) })}
              className="w-full accent-amber-400 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>30m (Airport Close)</span>
              <span>60m (Average Traffic)</span>
              <span>120m (Peak Rush Hour)</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Circadian Rhythm & Sleep Biology */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
          <Moon className="h-4 w-4 text-purple-400" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
            2. Sleep & caffeine
          </h3>
        </div>

        {/* Target Sleep Hours & Caffeine Clearance */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Target Sleep Duration */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs uppercase text-slate-300">Sleep you need</span>
              <span className="font-mono font-bold text-purple-300 text-sm">
                {preferences.targetSleepHours} Hours
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              How much sleep you usually need to feel rested. Most adults need about 7 hours or more.
            </p>
            <input
              type="range"
              min="6.0"
              max="9.0"
              step="0.5"
              value={preferences.targetSleepHours}
              onChange={(e) => onUpdatePreferences({ targetSleepHours: parseFloat(e.target.value) })}
              className="w-full accent-purple-400 cursor-pointer"
            />
          </div>

          {/* Caffeine cutoff */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs uppercase text-slate-300">Last caffeine before sleep</span>
              <span className="font-mono font-bold text-amber-300 text-sm">
                {preferences.caffeineCutoffHours} hours before
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Caffeine can stay in your body for many hours. Choose 8 if you are sensitive to it or drink strong coffee.
            </p>
            <div className="flex gap-2 pt-1">
              {[6, 8].map((hrs) => (
                <button
                  key={hrs}
                  onClick={() => onUpdatePreferences({ caffeineCutoffHours: hrs })}
                  className={`flex-1 rounded-lg py-1.5 text-xs font-bold transition-all ${
                    preferences.caffeineCutoffHours === hrs
                      ? 'bg-amber-600 text-white shadow-sm'
                      : 'border border-slate-800 bg-slate-900 text-slate-400 hover:text-white'
                  }`}
                >
                  {hrs} hours
                </button>
              ))}
            </div>
          </div>
        </div>

      </div>

      {/* 3. Home Base Airport & Position Rank */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
          <MapPin className="h-4 w-4 text-emerald-400" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
            3. Home base
          </h3>
        </div>

        {/* Quick Base Airport Switcher */}
        <div className="space-y-2">
          <label className="font-bold uppercase tracking-wider text-slate-300 text-xs">
            Select Your Permanent Home Base Airport
          </label>
          <div className="grid grid-cols-3 sm:grid-cols-9 gap-2">
            {quickBases.map((b) => {
              const isCurrent = roster.homeBase === b.iata;
              return (
                <button
                  key={b.iata}
                  onClick={() => onChangeHomeBase(b.iata, getAirportTzOffset(b.iata, new Date()) ?? b.tzOffset)}
                  className={`rounded-xl border p-2 text-center transition-all ${
                    isCurrent
                      ? 'border-emerald-500 bg-emerald-950/40 text-emerald-300 font-bold ring-1 ring-emerald-500'
                      : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:text-white hover:border-slate-700'
                  }`}
                >
                  <span className="font-mono text-xs block font-bold">{b.iata}</span>
                  <span className="text-[9px] text-slate-500 block truncate">{b.name}</span>
                </button>
              );
            })}
          </div>
        </div>

      </div>

      {/* 4. Your data */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
        <div className="border-b border-slate-800 pb-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">4. Your data</h3>
        </div>
        <p className="text-xs text-slate-400">
          Your roster and settings are stored only on this device. Nothing is shared with your airline. Save a backup so
          you can restore them if this browser's data is cleared or you switch devices.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleExport}
            className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-500"
          >
            Save a backup
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-xs font-bold text-slate-200 hover:bg-slate-800"
          >
            Restore from a backup
          </button>
          <input ref={fileInputRef} type="file" accept="application/json,.json" onChange={handleRestore} className="hidden" />
          {!confirmDelete ? (
            <button
              onClick={() => setConfirmDelete(true)}
              className="rounded-xl border border-rose-900 px-4 py-2 text-xs font-bold text-rose-300 hover:bg-rose-950"
            >
              Delete all my data
            </button>
          ) : (
            <span className="flex items-center gap-2 text-xs text-rose-200">
              Delete your roster, settings and history from this device?
              <button onClick={handleDeleteAll} className="rounded-lg bg-rose-700 px-3 py-1.5 font-bold text-white hover:bg-rose-600">
                Yes, delete
              </button>
              <button onClick={() => setConfirmDelete(false)} className="rounded-lg border border-slate-700 px-3 py-1.5 font-bold text-slate-300">
                Cancel
              </button>
            </span>
          )}
        </div>
        {dataMessage && (
          <p role="status" className={`text-xs ${dataMessage.tone === 'ok' ? 'text-emerald-300' : 'text-rose-300'}`}>
            {dataMessage.text}
          </p>
        )}
      </div>
    </div>
  );
};
