import React, { useState, useRef } from 'react';
import { RosterData } from '../types/circadian';
import { RosterPreset } from '../data/rosterPresets';
import { X, Upload, Sparkles, FileText, Image, Check, AlertCircle, Loader2 } from 'lucide-react';

interface RosterModalProps {
  isOpen: boolean;
  onClose: () => void;
  presets: RosterPreset[];
  activePresetId: string;
  onSelectPreset: (preset: RosterPreset) => void;
  onRosterParsed: (roster: RosterData) => void;
}

export const RosterModal: React.FC<RosterModalProps> = ({
  isOpen,
  onClose,
  presets,
  activePresetId,
  onSelectPreset,
  onRosterParsed,
}) => {
  if (!isOpen) return null;

  const [activeTab, setActiveTab] = useState<'upload' | 'samples' | 'text'>('upload');
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [rawTextInput, setRawTextInput] = useState('');
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (file: File) => {
    if (!file) return;
    setParseError(null);
    setIsParsing(true);

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64Data = e.target?.result as string;
        setPreviewImage(base64Data);

        const response = await fetch('/api/roster/parse', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageBase64: base64Data,
            mimeType: file.type || 'image/png',
          }),
        });

        const result = await response.json();
        if (result.success && result.data) {
          const parsed: RosterData = {
            id: `roster-upload-${Date.now()}`,
            airline: result.data.airline || 'Airline',
            crewName: result.data.crewName || 'Cabin Crew',
            homeBase: result.data.homeBase || 'DEL',
            homeBaseTzOffset: result.data.homeBaseTzOffset || 5.5,
            flights: result.data.flights || [],
            layovers: [],
            parsedAt: new Date().toISOString(),
          };
          onRosterParsed(parsed);
          onClose();
        } else {
          setParseError(result.error || 'Could not parse flights. Ensure screenshot table is legible.');
        }
        setIsParsing(false);
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      setParseError(err.message || 'File processing failed.');
      setIsParsing(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (items) {
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) handleFileUpload(file);
          break;
        }
      }
    }
  };

  const handleParseText = async () => {
    if (!rawTextInput.trim()) return;
    setIsParsing(true);
    setParseError(null);

    try {
      const response = await fetch('/api/roster/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawText: rawTextInput }),
      });

      const result = await response.json();
      if (result.success && result.data) {
        const parsed: RosterData = {
          id: `roster-text-${Date.now()}`,
          airline: result.data.airline || 'Airline',
          crewName: result.data.crewName || 'Cabin Crew',
          homeBase: result.data.homeBase || 'DEL',
          homeBaseTzOffset: result.data.homeBaseTzOffset || 5.5,
          flights: result.data.flights || [],
          layovers: [],
          rawText: rawTextInput,
          parsedAt: new Date().toISOString(),
        };
        onRosterParsed(parsed);
        onClose();
      } else {
        setParseError(result.error || 'Failed to parse text.');
      }
    } catch (err: any) {
      setParseError(err.message || 'Network error.');
    } finally {
      setIsParsing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" onPaste={handlePaste}>
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:p-6 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="border-b border-slate-800 pb-4 pr-8">
          <h3 className="text-base font-bold text-white sm:text-lg">
            Update Crew Roster
          </h3>
          <p className="text-xs text-slate-400">
            Upload your roster screenshot, choose a sample schedule, or paste roster text.
          </p>

          <div className="mt-3 flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-950 p-1 text-xs">
            <button
              onClick={() => setActiveTab('upload')}
              className={`flex-1 rounded-md py-1.5 font-medium transition-colors ${
                activeTab === 'upload' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Upload Screenshot
            </button>
            <button
              onClick={() => setActiveTab('samples')}
              className={`flex-1 rounded-md py-1.5 font-medium transition-colors ${
                activeTab === 'samples' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Sample Schedules ({presets.length})
            </button>
            <button
              onClick={() => setActiveTab('text')}
              className={`flex-1 rounded-md py-1.5 font-medium transition-colors ${
                activeTab === 'text' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Paste Text
            </button>
          </div>
        </div>

        {/* Tab 1: Upload Screenshot */}
        {activeTab === 'upload' && (
          <div className="mt-4 space-y-3">
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
              accept="image/png,image/jpeg,image/webp,image/heic,application/pdf"
              className="hidden"
            />

            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-700 bg-slate-950/60 px-6 py-10 text-center transition-all hover:border-blue-500 hover:bg-slate-900/60"
            >
              {isParsing ? (
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                  <p className="text-sm font-semibold text-white">Extracting flight dates & check-ins with AI...</p>
                  <p className="text-xs text-slate-400">Parsing your airline roster format</p>
                </div>
              ) : (
                <>
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-600/10 text-blue-400 ring-1 ring-blue-500/20">
                    <Upload className="h-6 w-6" />
                  </div>
                  <p className="mt-3 text-sm font-semibold text-white">
                    Drop your Roster Screenshot here, or <span className="text-blue-400 underline">browse</span>
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    Supports any airline mobile screenshot (AIMS, Sabre, NetLine, CrewLynx) • Or paste with <kbd className="rounded bg-slate-800 px-1 py-0.5 text-[10px] font-mono">Ctrl+V</kbd>
                  </p>
                </>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Sample Schedules */}
        {activeTab === 'samples' && (
          <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {presets.map((preset) => {
              const isActive = preset.id === activePresetId;
              return (
                <button
                  key={preset.id}
                  onClick={() => {
                    onSelectPreset(preset);
                    onClose();
                  }}
                  className={`flex flex-col justify-between rounded-xl border p-3.5 text-left transition-all ${
                    isActive
                      ? 'border-blue-500 bg-blue-950/30 ring-1 ring-blue-500'
                      : 'border-slate-800 bg-slate-950/40 hover:border-slate-700 hover:bg-slate-900'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="rounded bg-blue-500/10 px-2 py-0.5 text-[10px] font-bold text-blue-400 border border-blue-500/20">
                        {preset.badge}
                      </span>
                      {isActive && <Check className="h-3.5 w-3.5 text-blue-400" />}
                    </div>
                    <h4 className="mt-2 text-xs font-bold text-white">{preset.name}</h4>
                    <p className="mt-1 text-[11px] text-slate-400 leading-relaxed line-clamp-2">
                      {preset.description}
                    </p>
                  </div>
                  <div className="mt-2.5 text-[10px] text-slate-500 font-mono">
                    {preset.roster.flights.length} Flight Legs • Base: {preset.roster.homeBase}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Tab 3: Paste Text */}
        {activeTab === 'text' && (
          <div className="mt-4 space-y-3">
            <textarea
              value={rawTextInput}
              onChange={(e) => setRawTextInput(e.target.value)}
              placeholder="Paste your flight schedule table text here (e.g. 6E 205 DEL BOM 06:30 08:45 CI 05:30...)"
              rows={5}
              className="w-full rounded-xl border border-slate-800 bg-slate-950 p-3 font-mono text-xs text-slate-200 placeholder-slate-500 focus:border-blue-500 focus:outline-none"
            />
            <div className="flex justify-end">
              <button
                onClick={handleParseText}
                disabled={isParsing || !rawTextInput.trim()}
                className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow hover:bg-blue-500 disabled:opacity-50"
              >
                {isParsing ? 'Parsing with AI...' : 'Parse & Update Schedule'}
              </button>
            </div>
          </div>
        )}

        {parseError && (
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-950/20 p-3 text-xs text-red-300">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
            <span>{parseError}</span>
          </div>
        )}
      </div>
    </div>
  );
};
