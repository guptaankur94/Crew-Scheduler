import React, { useState, useRef } from 'react';
import { RosterData, RosterHistoryEntry, FlightLeg } from '../../types/circadian';
import { RosterPreset } from '../../data/rosterPresets';
import { RosterHistoryTable } from '../RosterHistoryTable';
import { ConflictResolutionModal } from '../ConflictResolutionModal';
import {
  analyzeRosterMerge,
  resolveAndMergeFlights,
  ConflictResolutionChoice,
  RosterConflict,
} from '../../services/rosterMerger';
import {
  Upload,
  Sparkles,
  FileText,
  Image as ImageIcon,
  Check,
  AlertCircle,
  Loader2,
  Calendar,
  CheckCircle2,
  Plane,
  RefreshCw,
  Clock,
  Layers,
  History,
  Trash2,
  AlertTriangle,
  Files,
  X,
  Plus,
  ArrowRight,
  UploadCloud,
  FileCode,
  Eye,
  ZoomIn,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  GitMerge,
} from 'lucide-react';

interface UploadViewProps {
  currentRoster: RosterData;
  presets: RosterPreset[];
  activePresetId: string;
  history: RosterHistoryEntry[];
  onSelectPreset: (preset: RosterPreset) => void;
  onRosterParsed: (roster: RosterData, sourceTitle?: string, customDescription?: string) => void;
  onViewRosterTimeline: () => void;
  onRestoreRoster: (entry: RosterHistoryEntry) => void;
  onClearActiveRoster: () => void;
  onDeleteHistoryItem: (id: string) => void;
  onClearAllHistory: () => void;
  onAddManualSector?: (flight: FlightLeg) => void;
  onMergeRosterSnapshot?: (snapshot: RosterData, title: string) => void;
}

export interface FileBatchItem {
  id: string;
  file: File;
  name: string;
  sizeKb: number;
  type: string;
  previewUrl?: string;
  status: 'staged' | 'queued' | 'processing' | 'success' | 'error';
  flightsCount?: number;
  extractedFlights?: FlightLeg[];
  airline?: string;
  homeBase?: string;
  homeBaseTzOffset?: number;
  crewName?: string;
  error?: string;
}

export const UploadView: React.FC<UploadViewProps> = ({
  currentRoster,
  presets,
  activePresetId,
  history,
  onSelectPreset,
  onRosterParsed,
  onViewRosterTimeline,
  onRestoreRoster,
  onClearActiveRoster,
  onDeleteHistoryItem,
  onClearAllHistory,
  onAddManualSector,
  onMergeRosterSnapshot,
}) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'samples' | 'text' | 'history'>('upload');
  const [isParsingBatch, setIsParsingBatch] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [batchSummary, setBatchSummary] = useState<{
    totalUniqueFlights: number;
    filesCount: number;
    breakdown: { fileName: string; count: number }[];
  } | null>(null);

  // Multi-file queue & Staging
  const [fileBatch, setFileBatch] = useState<FileBatchItem[]>([]);
  const [currentProcessingIdx, setCurrentProcessingIdx] = useState<number>(-1);
  const [rawTextInput, setRawTextInput] = useState('');
  const [showClearConfirmModal, setShowClearConfirmModal] = useState<boolean>(false);
  
  // Lightbox modal for enlarged preview verification
  const [previewModalIndex, setPreviewModalIndex] = useState<number | null>(null);

  // Smart Conflict Resolution State
  const [pendingConflictData, setPendingConflictData] = useState<{
    conflicts: RosterConflict[];
    identicalCount: number;
    newSectorsCount: number;
    incomingFlights: FlightLeg[];
    sourceTitle: string;
    customDescription: string;
    detectedAirline: string;
    detectedCrewName: string;
    detectedHomeBase: string;
    detectedHomeBaseTzOffset: number;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Helper to determine clean MIME type
  const determineMimeType = (file: File): string => {
    if (file.type && file.type !== 'image/jpg') {
      return file.type;
    }
    const name = file.name.toLowerCase();
    if (name.endsWith('.pdf')) return 'application/pdf';
    if (name.endsWith('.png')) return 'image/png';
    if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'image/jpeg';
    if (name.endsWith('.webp')) return 'image/webp';
    if (name.endsWith('.heic')) return 'image/heic';
    if (name.endsWith('.heif')) return 'image/heif';
    return 'image/png';
  };

  // Helper to optimize and convert images via Canvas before upload
  const prepareFileForUpload = (file: File): Promise<{ base64Data: string; mimeType: string }> => {
    return new Promise((resolve) => {
      const mime = determineMimeType(file);

      // If PDF, read directly
      if (mime === 'application/pdf') {
        const reader = new FileReader();
        reader.onload = (e) => resolve({ base64Data: e.target?.result as string, mimeType: 'application/pdf' });
        reader.onerror = () => resolve({ base64Data: '', mimeType: 'application/pdf' });
        reader.readAsDataURL(file);
        return;
      }

      // For images, load into an Image element and optimize resolution via canvas
      const url = URL.createObjectURL(file);
      const img = new Image();

      img.onload = () => {
        URL.revokeObjectURL(url);
        try {
          const maxDim = 2400;
          let w = img.width;
          let h = img.height;

          if (w > maxDim || h > maxDim) {
            if (w > h) {
              h = Math.round((h * maxDim) / w);
              w = maxDim;
            } else {
              w = Math.round((w * maxDim) / h);
              h = maxDim;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, w, h);
            ctx.drawImage(img, 0, 0, w, h);
            const optimizedBase64 = canvas.toDataURL('image/jpeg', 0.92);
            resolve({ base64Data: optimizedBase64, mimeType: 'image/jpeg' });
            return;
          }
        } catch {
          // Canvas failed, fallback to raw base64
        }

        // Fallback: read directly
        const reader = new FileReader();
        reader.onload = (e) => resolve({ base64Data: e.target?.result as string, mimeType: mime });
        reader.readAsDataURL(file);
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        const reader = new FileReader();
        reader.onload = (e) => resolve({ base64Data: e.target?.result as string, mimeType: mime });
        reader.readAsDataURL(file);
      };

      img.src = url;
    });
  };

  // Stage incoming files for user verification BEFORE processing
  const stageIncomingFiles = (incomingFiles: File[]) => {
    if (!incomingFiles || incomingFiles.length === 0) return;

    setParseError(null);
    setSuccessMessage(null);
    setBatchSummary(null);

    const newItems: FileBatchItem[] = incomingFiles.map((file, idx) => ({
      id: `file-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
      file,
      name: file.name,
      sizeKb: Math.round(file.size / 1024),
      type: determineMimeType(file),
      previewUrl: file.type.startsWith('image/') || file.name.match(/\.(png|jpe?g|webp|heic|heif)$/i)
        ? URL.createObjectURL(file)
        : undefined,
      status: 'staged',
    }));

    setFileBatch((prev) => [...prev, ...newItems]);
    setActiveTab('upload');
  };

  // Remove a single file from the staging queue
  const removeFileFromBatch = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setFileBatch((prev) => {
      const itemToRemove = prev.find((item) => item.id === id);
      if (itemToRemove?.previewUrl) {
        URL.revokeObjectURL(itemToRemove.previewUrl);
      }
      return prev.filter((item) => item.id !== id);
    });

    if (previewModalIndex !== null) {
      setPreviewModalIndex(null);
    }
  };

  // Clear all staged files
  const clearAllStagedFiles = () => {
    fileBatch.forEach((item) => {
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
    });
    setFileBatch([]);
    setParseError(null);
    setSuccessMessage(null);
    setBatchSummary(null);
    setPreviewModalIndex(null);
  };

  // Process all staged files with Gemini AI
  const startProcessingBatch = async () => {
    if (fileBatch.length === 0) return;

    setParseError(null);
    setSuccessMessage(null);
    setBatchSummary(null);
    setIsParsingBatch(true);

    const itemsToProcess = [...fileBatch];
    const allExtractedFlights: FlightLeg[] = [];
    let detectedAirline = currentRoster.airline !== 'None' ? currentRoster.airline : 'Airline';
    let detectedHomeBase = currentRoster.homeBase || 'DEL';
    let detectedHomeBaseTzOffset = currentRoster.homeBaseTzOffset || 5.5;
    let detectedCrewName = currentRoster.crewName || 'Cabin Crew';
    const breakdown: { fileName: string; count: number }[] = [];

    // Process files one by one sequentially
    for (let i = 0; i < itemsToProcess.length; i++) {
      setCurrentProcessingIdx(i);
      const currentItem = itemsToProcess[i];

      setFileBatch((prev) =>
        prev.map((item) => (item.id === currentItem.id ? { ...item, status: 'processing' } : item))
      );

      try {
        const { base64Data, mimeType: resolvedMime } = await prepareFileForUpload(currentItem.file);

        const response = await fetch('/api/roster/parse', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageBase64: base64Data,
            mimeType: resolvedMime,
          }),
        });

        const result = await response.json();

        if (result.success && result.data && Array.isArray(result.data.flights) && result.data.flights.length > 0) {
          const flights: FlightLeg[] = result.data.flights;

          if (result.data.airline && result.data.airline !== 'other') {
            detectedAirline = result.data.airline;
          }
          if (result.data.homeBase) {
            detectedHomeBase = result.data.homeBase;
          }
          if (typeof result.data.homeBaseTzOffset === 'number') {
            detectedHomeBaseTzOffset = result.data.homeBaseTzOffset;
          }
          if (result.data.crewName) {
            detectedCrewName = result.data.crewName;
          }

          allExtractedFlights.push(...flights);
          breakdown.push({ fileName: currentItem.name, count: flights.length });

          setFileBatch((prev) =>
            prev.map((item) =>
              item.id === currentItem.id
                ? {
                    ...item,
                    status: 'success',
                    flightsCount: flights.length,
                    extractedFlights: flights,
                  }
                : item
            )
          );
        } else {
          const errMsg = result.error || 'No flight legs could be found in this file.';
          setFileBatch((prev) =>
            prev.map((item) =>
              item.id === currentItem.id ? { ...item, status: 'error', error: errMsg } : item
            )
          );
        }
      } catch (err: any) {
        setFileBatch((prev) =>
          prev.map((item) =>
            item.id === currentItem.id ? { ...item, status: 'error', error: err.message || 'Processing failed' } : item
          )
        );
      }
    }

    setIsParsingBatch(false);
    setCurrentProcessingIdx(-1);

    // If at least one flight was extracted across all files:
    if (allExtractedFlights.length > 0) {
      const title =
        itemsToProcess.length === 1
          ? itemsToProcess[0].name
          : `${itemsToProcess.length} Roster Files (${itemsToProcess[0].name}${
              itemsToProcess.length > 1 ? ` +${itemsToProcess.length - 1} more` : ''
            })`;

      const breakdownStr = breakdown.map((b) => `${b.fileName}: ${b.count}`).join(', ');
      const description =
        itemsToProcess.length === 1
          ? `Extracted ${allExtractedFlights.length} flight legs via Gemini Aero-OCR`
          : `Extracted ${allExtractedFlights.length} flight legs from ${itemsToProcess.length} files (${breakdownStr})`;

      // SMART CONTINUOUS TIMELINE MERGING:
      // If there's an existing active roster, check for conflicts and continuous overlap!
      if (currentRoster.flights.length > 0) {
        const mergeAnalysis = analyzeRosterMerge(currentRoster.flights, allExtractedFlights);

        if (mergeAnalysis.hasConflicts) {
          // Open the Conflict Resolution Dialog!
          setPendingConflictData({
            conflicts: mergeAnalysis.conflicts,
            identicalCount: mergeAnalysis.identicalCount,
            newSectorsCount: mergeAnalysis.newSectorsCount,
            incomingFlights: allExtractedFlights,
            sourceTitle: title,
            customDescription: description,
            detectedAirline,
            detectedCrewName,
            detectedHomeBase,
            detectedHomeBaseTzOffset,
          });
          return;
        } else {
          // Seamless non-conflicting continuous timeline merge!
          const mergedFlights = mergeAnalysis.nonConflictingMergedFlights;

          const mergedRoster: RosterData = {
            id: `roster-continuous-${Date.now()}`,
            airline: detectedAirline,
            crewName: detectedCrewName,
            homeBase: detectedHomeBase,
            homeBaseTzOffset: detectedHomeBaseTzOffset,
            flights: mergedFlights,
            layovers: currentRoster.layovers || [],
            parsedAt: new Date().toISOString(),
          };

          onRosterParsed(
            mergedRoster,
            title,
            `Extended continuous timeline to ${mergedFlights.length} sectors (${mergeAnalysis.identicalCount} overlapping sectors verified, ${mergeAnalysis.newSectorsCount} new sectors added).`
          );

          setBatchSummary({
            totalUniqueFlights: mergedFlights.length,
            filesCount: itemsToProcess.length,
            breakdown,
          });

          setSuccessMessage(
            `Smart Timeline Merge: Successfully combined with active schedule! Total continuous timeline now has ${mergedFlights.length} flight sectors.`
          );
          return;
        }
      }

      // Initial clean roster (no previous active flights)
      // 1. Deduplicate
      const seenKeys = new Set<string>();
      const initialFlights: FlightLeg[] = [];
      for (const leg of allExtractedFlights) {
        const depHourKey = leg.departureTimeUtc ? leg.departureTimeUtc.slice(0, 13) : leg.id;
        const normFlightNo = leg.flightNumber.toUpperCase().replace(/\s+/g, '');
        const key = `${normFlightNo}_${depHourKey}`;
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          initialFlights.push(leg);
        }
      }

      initialFlights.sort(
        (a, b) => new Date(a.departureTimeUtc).getTime() - new Date(b.departureTimeUtc).getTime()
      );

      const newRoster: RosterData = {
        id: `roster-init-${Date.now()}`,
        airline: detectedAirline,
        crewName: detectedCrewName,
        homeBase: detectedHomeBase,
        homeBaseTzOffset: detectedHomeBaseTzOffset,
        flights: initialFlights,
        layovers: [],
        parsedAt: new Date().toISOString(),
      };

      onRosterParsed(newRoster, title, description);

      setBatchSummary({
        totalUniqueFlights: initialFlights.length,
        filesCount: itemsToProcess.length,
        breakdown,
      });

      setSuccessMessage(
        itemsToProcess.length === 1
          ? `Successfully uploaded "${itemsToProcess[0].name}" and extracted ${initialFlights.length} flight legs!`
          : `Successfully parsed ${itemsToProcess.length} files and created continuous timeline of ${initialFlights.length} flight sectors!`
      );
    } else {
      setParseError(
        'Could not extract any valid flight sectors from the uploaded file(s). Please verify that the screenshots or PDFs contain readable flight tables.'
      );
    }
  };

  // Handle resolutions from Conflict Resolution Modal
  const handleResolveConflicts = (resolutions: Record<string, ConflictResolutionChoice>) => {
    if (!pendingConflictData) return;

    const mergedFlights = resolveAndMergeFlights(
      currentRoster.flights,
      pendingConflictData.incomingFlights,
      resolutions
    );

    const mergedRoster: RosterData = {
      id: `roster-continuous-${Date.now()}`,
      airline: pendingConflictData.detectedAirline,
      crewName: pendingConflictData.detectedCrewName,
      homeBase: pendingConflictData.detectedHomeBase,
      homeBaseTzOffset: pendingConflictData.detectedHomeBaseTzOffset,
      flights: mergedFlights,
      layovers: currentRoster.layovers || [],
      parsedAt: new Date().toISOString(),
    };

    onRosterParsed(
      mergedRoster,
      pendingConflictData.sourceTitle,
      `Resolved schedule revisions. Continuous timeline now spans ${mergedFlights.length} flight sectors.`
    );

    setBatchSummary({
      totalUniqueFlights: mergedFlights.length,
      filesCount: fileBatch.length,
      breakdown: fileBatch.map((f) => ({ fileName: f.name, count: f.flightsCount || 0 })),
    });

    setSuccessMessage(
      `Schedule Revisions Applied: Merged into continuous timeline! Total active flights: ${mergedFlights.length}.`
    );

    setPendingConflictData(null);
  };

  // Retry an individual file
  const retrySingleFile = async (itemId: string) => {
    const item = fileBatch.find((f) => f.id === itemId);
    if (!item) return;

    setFileBatch((prev) =>
      prev.map((f) => (f.id === itemId ? { ...f, status: 'processing', error: undefined } : f))
    );

    try {
      const { base64Data, mimeType: resolvedMime } = await prepareFileForUpload(item.file);
      const response = await fetch('/api/roster/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: base64Data,
          mimeType: resolvedMime,
        }),
      });

      const result = await response.json();
      if (result.success && result.data && Array.isArray(result.data.flights) && result.data.flights.length > 0) {
        setFileBatch((prev) =>
          prev.map((f) =>
            f.id === itemId
              ? { ...f, status: 'success', flightsCount: result.data.flights.length, extractedFlights: result.data.flights }
              : f
          )
        );
      } else {
        setFileBatch((prev) =>
          prev.map((f) =>
            f.id === itemId ? { ...f, status: 'error', error: result.error || 'Extraction failed' } : f
          )
        );
      }
    } catch (err: any) {
      setFileBatch((prev) =>
        prev.map((f) => (f.id === itemId ? { ...f, status: 'error', error: err.message || 'Error' } : f))
      );
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      stageIncomingFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      stageIncomingFiles(Array.from(e.target.files));
    }
    e.target.value = '';
  };

  const handleParseText = async () => {
    if (!rawTextInput.trim()) return;
    setIsParsingBatch(true);
    setParseError(null);
    setSuccessMessage(null);
    setBatchSummary(null);

    try {
      const response = await fetch('/api/roster/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawText: rawTextInput }),
      });

      const result = await response.json();
      if (result.success && result.data) {
        const newFlights: FlightLeg[] = result.data.flights || [];
        
        if (currentRoster.flights.length > 0) {
          const mergeAnalysis = analyzeRosterMerge(currentRoster.flights, newFlights);
          if (mergeAnalysis.hasConflicts) {
            setPendingConflictData({
              conflicts: mergeAnalysis.conflicts,
              identicalCount: mergeAnalysis.identicalCount,
              newSectorsCount: mergeAnalysis.newSectorsCount,
              incomingFlights: newFlights,
              sourceTitle: 'Pasted Raw Schedule Text',
              customDescription: `Extracted ${newFlights.length} flight legs from text`,
              detectedAirline: result.data.airline || currentRoster.airline,
              detectedCrewName: result.data.crewName || currentRoster.crewName || 'Cabin Crew',
              detectedHomeBase: result.data.homeBase || currentRoster.homeBase,
              detectedHomeBaseTzOffset: result.data.homeBaseTzOffset || currentRoster.homeBaseTzOffset,
            });
            return;
          } else {
            const merged = mergeAnalysis.nonConflictingMergedFlights;
            const continuous: RosterData = {
              id: `roster-text-merged-${Date.now()}`,
              airline: result.data.airline || currentRoster.airline,
              crewName: result.data.crewName || currentRoster.crewName || 'Cabin Crew',
              homeBase: result.data.homeBase || currentRoster.homeBase,
              homeBaseTzOffset: result.data.homeBaseTzOffset || currentRoster.homeBaseTzOffset,
              flights: merged,
              layovers: currentRoster.layovers || [],
              parsedAt: new Date().toISOString(),
            };
            onRosterParsed(continuous, 'Pasted Raw Schedule Text', `Merged into continuous timeline (${merged.length} sectors)`);
            setSuccessMessage(`Merged text sectors into continuous timeline (${merged.length} total flights)!`);
            return;
          }
        }

        const parsed: RosterData = {
          id: `roster-text-${Date.now()}`,
          airline: result.data.airline || 'Airline',
          crewName: result.data.crewName || 'Cabin Crew',
          homeBase: result.data.homeBase || 'DEL',
          homeBaseTzOffset: result.data.homeBaseTzOffset || 5.5,
          flights: newFlights,
          layovers: [],
          parsedAt: new Date().toISOString(),
        };
        onRosterParsed(parsed, 'Pasted Raw Schedule Text', `Extracted ${parsed.flights.length} flights from text`);
        setSuccessMessage(`Parsed ${parsed.flights.length} flights from text!`);
      } else {
        setParseError(result.error || 'Failed to parse text. Please ensure flight numbers and dates are included.');
      }
    } catch (err: any) {
      setParseError(err.message || 'Text parsing error.');
    } finally {
      setIsParsingBatch(false);
    }
  };

  // Whether there are any files staged for verification
  const hasStagedFiles = fileBatch.some((f) => f.status === 'staged');
  const hasProcessedFiles = fileBatch.some((f) => f.status === 'success');

  return (
    <div className="space-y-5">
      {/* Header Banner */}
      <div className="rounded-2xl border border-slate-800 bg-gradient-to-r from-slate-900/90 via-slate-900/60 to-slate-950 p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-blue-400" />
              <h2 className="text-base font-bold text-white">Roster Upload & Continuous Timeline Hub</h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Select or drop multiple roster screenshots across months (Jan, Feb, Mar). Verify thumbnails, resolve schedule revisions smartly, and build one uninterrupted continuous duty timeline.
            </p>
          </div>

          {/* Current Active Roster Stat Pill */}
          <div className="rounded-xl border border-blue-900/40 bg-blue-950/30 px-3 py-2 text-xs flex items-center gap-3">
            <div>
              <span className="text-[10px] uppercase font-bold text-blue-300 tracking-wider block">Continuous Timeline</span>
              <span className="font-mono font-bold text-white text-xs">
                {currentRoster.flights.length > 0 ? (
                  `${currentRoster.flights.length} Flights • Base ${currentRoster.homeBase}`
                ) : (
                  <span className="text-amber-400">Baseline Rest Cycle</span>
                )}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              {currentRoster.flights.length > 0 && (
                <button
                  onClick={() => setShowClearConfirmModal(true)}
                  title="Clear or deactivate active roster"
                  className="rounded-lg border border-rose-800/60 bg-rose-950/40 hover:bg-rose-900/60 px-2 py-1 text-[11px] font-bold text-rose-300 transition-colors flex items-center gap-1"
                >
                  <Trash2 className="h-3 w-3" />
                  <span className="hidden sm:inline">Deactivate</span>
                </button>
              )}
              {currentRoster.flights.length > 0 && (
                <button
                  onClick={onViewRosterTimeline}
                  className="rounded-lg bg-blue-600 hover:bg-blue-500 px-2.5 py-1 text-[11px] font-bold text-white transition-colors"
                >
                  Timeline ➔
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('upload')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all shrink-0 ${
            activeTab === 'upload'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-400 hover:bg-slate-900 hover:text-white'
          }`}
        >
          <Upload className="h-3.5 w-3.5" />
          <span>Upload & Verify Roster</span>
          {fileBatch.length > 0 && (
            <span className="rounded-full bg-blue-900 px-1.5 py-0.2 text-[9px] font-mono text-white">
              {fileBatch.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all shrink-0 ${
            activeTab === 'history'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-400 hover:bg-slate-900 hover:text-white'
          }`}
        >
          <History className="h-3.5 w-3.5" />
          <span>Upload & Audit History</span>
          <span
            className={`rounded-full px-1.5 py-0.2 text-[9px] font-mono font-bold ${
              activeTab === 'history' ? 'bg-blue-800 text-white' : 'bg-slate-800 text-slate-400'
            }`}
          >
            {history.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('samples')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all shrink-0 ${
            activeTab === 'samples'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-400 hover:bg-slate-900 hover:text-white'
          }`}
        >
          <Sparkles className="h-3.5 w-3.5" />
          <span>Sample 30-Day Rosters</span>
        </button>

        <button
          onClick={() => setActiveTab('text')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all shrink-0 ${
            activeTab === 'text'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-400 hover:bg-slate-900 hover:text-white'
          }`}
        >
          <FileText className="h-3.5 w-3.5" />
          <span>Paste Raw Text</span>
        </button>
      </div>

      {/* Success Banner */}
      {successMessage && (
        <div className="rounded-2xl border border-emerald-800/60 bg-emerald-950/40 p-4 text-xs space-y-3 text-emerald-200">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
              <span className="font-bold text-white text-sm">{successMessage}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setActiveTab('history')}
                className="rounded-lg bg-emerald-800/60 hover:bg-emerald-700/80 px-2.5 py-1 font-bold text-emerald-100 text-xs"
              >
                View History Logs
              </button>
              <button
                onClick={onViewRosterTimeline}
                className="rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3 py-1 font-bold text-white text-xs flex items-center gap-1 shadow-sm"
              >
                <span>Go to Timeline</span>
                <ArrowRight className="h-3 w-3" />
              </button>
            </div>
          </div>

          {batchSummary && batchSummary.filesCount > 1 && (
            <div className="border-t border-emerald-800/40 pt-2.5 flex flex-wrap items-center gap-2 text-[11px]">
              <span className="text-emerald-300 font-semibold">Per-File Breakdown:</span>
              {batchSummary.breakdown.map((item, idx) => (
                <span
                  key={idx}
                  className="rounded-lg bg-emerald-900/40 border border-emerald-700/40 px-2 py-0.5 text-emerald-200 font-mono"
                >
                  {item.fileName}: <strong>{item.count} sectors</strong>
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Error Alert with Smart Guidance */}
      {parseError && (
        <div className="rounded-2xl border border-rose-800/80 bg-rose-950/40 p-4 text-xs space-y-2 text-rose-200 shadow-sm">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold text-white text-sm">Roster Processing Note</p>
              <p className="text-rose-200/90">{parseError}</p>
            </div>
          </div>
          <div className="border-t border-rose-900/40 pt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-rose-300">
            <div className="flex items-center gap-1.5 text-rose-300/80">
              <span>💡 Tip: Ensure flight numbers (e.g. 6E 205, AI 101, EK 512) and dates or times are visible in the image.</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveTab('text')}
                className="rounded-lg bg-rose-900/50 hover:bg-rose-900/80 border border-rose-700/50 px-2.5 py-1 text-white font-semibold transition-colors"
              >
                Paste Text Instead
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="rounded-lg bg-rose-700 hover:bg-rose-600 px-2.5 py-1 text-white font-bold transition-colors"
              >
                Try Another Screenshot
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileInputChange}
        accept="image/*,application/pdf"
        multiple
        className="hidden"
      />

      {/* Tab 1: Upload & Continuous Timeline Merging */}
      {activeTab === 'upload' && (
        <div className="space-y-6">
          {/* Main Dropzone / Multi-File Selector */}
          {fileBatch.length === 0 ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-4">
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-700 bg-slate-950/70 p-8 text-center transition-all hover:border-blue-500 hover:bg-slate-900/80 cursor-pointer group"
              >
                <div className="space-y-3">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600/10 text-blue-400 ring-1 ring-blue-500/20 group-hover:scale-105 transition-transform">
                    <Files className="h-7 w-7" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">
                      Click to choose or drag & drop your roster screenshots
                    </p>
                    <p className="text-xs text-slate-400 mt-1 max-w-lg mx-auto">
                      Upload rosters in chunks (e.g. Jan 1–21, Jan 21–Feb 20, Feb 15–Mar 15). The app will display thumbnail previews for verification, auto-merge overlapping dates, and prompt you if schedule revisions conflict.
                    </p>
                    <p className="text-[11px] text-blue-400/90 mt-1">
                      ✓ Thumbnail Verification • ✓ Smart Overlap Deduplication • ✓ Uninterrupted Continuous Timeline
                    </p>
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-500 transition-colors">
                    <Plus className="h-3.5 w-3.5" />
                    <span>Select Roster Files</span>
                  </div>
                </div>
              </div>

              {/* Supported Airlines info bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800/80 pt-3 text-[11px] text-slate-400">
                <span className="flex items-center gap-1.5">
                  <Plane className="h-3.5 w-3.5 text-blue-400" />
                  <span>Compatible with IndiGo (AIMS, CrewLynx), Air India, Emirates, Etihad, Qatar, & DGCA/FAA formats</span>
                </span>
                <span className="text-slate-500">Supports PNG, JPG, JPEG, WEBP, PDF</span>
              </div>
            </div>
          ) : (
            /* COMPACT ADDER when files are already in staging */
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900/50 p-3.5">
              <div className="flex items-center gap-2.5">
                <span className="flex h-2.5 w-2.5 rounded-full bg-blue-400 animate-pulse" />
                <span className="text-xs font-bold text-white">
                  {fileBatch.length} {fileBatch.length === 1 ? 'file' : 'files'} in staging queue
                </span>
                <span className="text-xs text-slate-400 hidden sm:inline">• Verify your images below, then click Upload</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isParsingBatch}
                  className="flex items-center gap-1.5 rounded-xl border border-blue-600/40 bg-blue-600/20 hover:bg-blue-600/30 px-3 py-1.5 text-xs font-bold text-blue-300 transition-colors disabled:opacity-40"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add More Files</span>
                </button>
                <button
                  onClick={clearAllStagedFiles}
                  disabled={isParsingBatch}
                  className="flex items-center gap-1.5 rounded-xl border border-slate-800 hover:bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-rose-400 transition-colors disabled:opacity-40"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Clear All</span>
                </button>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* THUMBNAIL PREVIEW & VERIFICATION AREA                    */}
          {/* ======================================================== */}
          {fileBatch.length > 0 && (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 space-y-4 shadow-sm">
              {/* Header Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-800 pb-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-blue-400" />
                    <h3 className="text-sm font-bold text-white">
                      Thumbnail Preview & Verification Area
                    </h3>
                    <span className="rounded-full bg-blue-900/60 border border-blue-700/50 px-2 py-0.5 text-[10px] font-mono font-bold text-blue-300">
                      {fileBatch.length} {fileBatch.length === 1 ? 'item' : 'items'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Verify that your screenshots show the correct dates and flight sectors. Tap any image to inspect full size.
                  </p>
                </div>

                {isParsingBatch && (
                  <div className="flex items-center gap-2 text-xs font-bold text-blue-300 bg-blue-950/60 border border-blue-800/60 px-3 py-1.5 rounded-xl">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-400" />
                    <span>
                      Uploading & Parsing {currentProcessingIdx + 1} of {fileBatch.length}...
                    </span>
                  </div>
                )}
              </div>

              {/* Progress Bar */}
              {isParsingBatch && currentProcessingIdx >= 0 && (
                <div className="space-y-1.5 rounded-xl border border-blue-900/50 bg-blue-950/30 p-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-300 font-medium">
                      Extracting file {currentProcessingIdx + 1} of {fileBatch.length}:{' '}
                      <strong className="text-white font-mono">{fileBatch[currentProcessingIdx]?.name}</strong>
                    </span>
                    <span className="text-blue-400 font-mono font-bold">
                      {Math.round(((currentProcessingIdx + 1) / fileBatch.length) * 100)}%
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
                    <div
                      className="h-full bg-blue-500 transition-all duration-300 rounded-full"
                      style={{
                        width: `${((currentProcessingIdx + 1) / fileBatch.length) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Thumbnail Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {fileBatch.map((item, idx) => (
                  <div
                    key={item.id}
                    className={`group relative flex flex-col rounded-2xl border transition-all overflow-hidden ${
                      item.status === 'processing'
                        ? 'border-blue-500 bg-blue-950/20 ring-1 ring-blue-500/50 shadow-md'
                        : item.status === 'success'
                        ? 'border-emerald-800/70 bg-emerald-950/20'
                        : item.status === 'error'
                        ? 'border-rose-800/70 bg-rose-950/20'
                        : 'border-slate-800 bg-slate-950/80 hover:border-slate-700 hover:bg-slate-900/90'
                    }`}
                  >
                    {/* Top Status & Remove Bar */}
                    <div className="absolute top-2.5 left-2.5 right-2.5 z-10 flex items-center justify-between pointer-events-none">
                      <div className="pointer-events-auto">
                        {item.status === 'staged' && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-slate-900/90 backdrop-blur-md px-2 py-0.5 text-[10px] font-bold text-slate-300 ring-1 ring-slate-700/60 shadow-sm">
                            <Clock className="h-3 w-3 text-slate-400" /> Page {idx + 1}
                          </span>
                        )}
                        {item.status === 'processing' && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-blue-950/90 backdrop-blur-md px-2 py-0.5 text-[10px] font-bold text-blue-300 ring-1 ring-blue-500/50 shadow-sm">
                            <Loader2 className="h-3 w-3 animate-spin text-blue-400" /> Extracting...
                          </span>
                        )}
                        {item.status === 'success' && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-950/90 backdrop-blur-md px-2 py-0.5 text-[10px] font-bold text-emerald-300 ring-1 ring-emerald-500/50 shadow-sm">
                            <Check className="h-3 w-3 text-emerald-400" /> {item.flightsCount} sectors
                          </span>
                        )}
                        {item.status === 'error' && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-rose-950/90 backdrop-blur-md px-2 py-0.5 text-[10px] font-bold text-rose-300 ring-1 ring-rose-500/50 shadow-sm">
                            <AlertCircle className="h-3 w-3 text-rose-400" /> Error
                          </span>
                        )}
                      </div>

                      {!isParsingBatch && (
                        <button
                          onClick={(e) => removeFileFromBatch(item.id, e)}
                          title="Remove from batch"
                          className="pointer-events-auto rounded-lg bg-black/60 backdrop-blur-md p-1.5 text-slate-400 hover:text-white hover:bg-rose-600 transition-colors shadow-sm"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Image / Thumbnail Container */}
                    <div
                      onClick={() => setPreviewModalIndex(idx)}
                      className="relative h-44 sm:h-48 w-full bg-slate-950 flex items-center justify-center cursor-pointer overflow-hidden p-2 select-none"
                    >
                      {item.previewUrl ? (
                        <img
                          src={item.previewUrl}
                          alt={item.name}
                          className="h-full w-full object-contain rounded-lg transition-transform duration-200 group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center text-slate-500 space-y-2">
                          {item.type.includes('pdf') ? (
                            <FileText className="h-10 w-10 text-rose-400" />
                          ) : (
                            <ImageIcon className="h-10 w-10 text-blue-400" />
                          )}
                          <span className="text-[11px] font-mono text-slate-400">PDF Document</span>
                        </div>
                      )}

                      <div className="absolute inset-0 bg-blue-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 backdrop-blur-[2px]">
                        <span className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900/90 px-3 py-1.5 text-xs font-bold text-white ring-1 ring-white/20 shadow-lg">
                          <Eye className="h-3.5 w-3.5 text-blue-400" />
                          <span>Click to Enlarge & Verify</span>
                        </span>
                      </div>
                    </div>

                    {/* File Information Footer */}
                    <div className="p-3 border-t border-slate-800/80 bg-slate-950/60 flex items-center justify-between text-xs">
                      <div className="min-w-0 pr-2">
                        <div
                          className="font-bold text-white truncate font-mono text-[11px]"
                          title={item.name}
                        >
                          {item.name}
                        </div>
                        <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5">
                          <span>{item.sizeKb} KB</span>
                          <span>•</span>
                          <span className="uppercase">{item.type.split('/')[1] || 'IMAGE'}</span>
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center gap-1.5">
                        {item.status === 'error' ? (
                          <button
                            onClick={() => retrySingleFile(item.id)}
                            className="inline-flex items-center gap-1 rounded-lg bg-rose-900/60 hover:bg-rose-800 border border-rose-700/60 px-2 py-1 text-[11px] font-semibold text-rose-200 transition-colors"
                          >
                            <RefreshCw className="h-3 w-3" />
                            <span>Retry</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => setPreviewModalIndex(idx)}
                            className="inline-flex items-center gap-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 px-2 py-1 text-[11px] font-semibold text-slate-300 transition-colors"
                            title="Inspect image"
                          >
                            <ZoomIn className="h-3 w-3 text-blue-400" />
                            <span>Verify</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* PRIMARY UPLOAD ACTION BUTTON BAR */}
              {!isParsingBatch && hasStagedFiles && (
                <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl bg-gradient-to-r from-blue-950/80 via-slate-900 to-slate-950 border border-blue-700/50 shadow-lg">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center ring-1 ring-blue-500/30 shrink-0">
                      <Upload className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">
                        {fileBatch.length} {fileBatch.length === 1 ? 'Roster File' : 'Roster Files'} Verified
                      </p>
                      <p className="text-xs text-slate-300 mt-0.5">
                        {currentRoster.flights.length > 0
                          ? `Ready to merge into active continuous timeline (${currentRoster.flights.length} existing sectors). Any conflicting dates will be flagged for review.`
                          : 'Ready to ingest and extract flight duties, report times, and circadian rest buffers.'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 w-full sm:w-auto shrink-0">
                    <button
                      onClick={clearAllStagedFiles}
                      className="w-1/2 sm:w-auto px-3.5 py-2.5 rounded-xl border border-slate-700 hover:bg-slate-800 text-xs font-semibold text-slate-300 transition-colors text-center"
                    >
                      Reselect
                    </button>
                    {/* BUTTON CLEARLY LABELED AS UPLOAD AS REQUESTED */}
                    <button
                      onClick={startProcessingBatch}
                      className="w-1/2 sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white shadow-md shadow-blue-900/30 transition-all hover:scale-[1.02] text-center"
                    >
                      <Upload className="h-4 w-4" />
                      <span>Upload & Process with AI ➔</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Completed Batch Actions */}
              {!isParsingBatch && hasProcessedFiles && (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-800/40 text-xs">
                  <div className="flex items-center gap-2 text-emerald-300">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    <span>Upload & extraction complete! Integrated into your continuous duty timeline.</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={onViewRosterTimeline}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-colors"
                    >
                      View in Duty Timeline ➔
                    </button>
                    <button
                      onClick={clearAllStagedFiles}
                      className="px-3 py-1.5 rounded-lg border border-slate-700 hover:bg-slate-800 text-slate-300 font-semibold transition-colors"
                    >
                      Upload Another Roster
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ======================================================== */}
          {/* EMBEDDED ROSTER HISTORY TABLE DIRECTLY IN UPLOAD TAB     */}
          {/* ======================================================== */}
          <div className="space-y-3 pt-3 border-t border-slate-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-blue-400" />
                <h3 className="text-sm font-bold text-white">Upload & Audit History Logs</h3>
                <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-mono text-slate-300 font-bold">
                  {history.length}
                </span>
              </div>
              <span className="text-[11px] text-slate-400 hidden sm:inline">
                Deactivate, delete, or re-upload / merge past rosters with 1 tap
              </span>
            </div>

            <RosterHistoryTable
              history={history}
              currentRoster={currentRoster}
              onRestoreRoster={onRestoreRoster}
              onClearActiveRoster={onClearActiveRoster}
              onDeleteHistoryItem={onDeleteHistoryItem}
              onClearAllHistory={onClearAllHistory}
              onAddManualSector={onAddManualSector}
              onOpenUploadTab={() => setActiveTab('upload')}
              onUploadFiles={stageIncomingFiles}
              isParsing={isParsingBatch}
              onViewTimeline={onViewRosterTimeline}
              onMergeRosterSnapshot={onMergeRosterSnapshot}
            />
          </div>
        </div>
      )}

      {/* Tab 2: Upload & Audit History Standalone */}
      {activeTab === 'history' && (
        <RosterHistoryTable
          history={history}
          currentRoster={currentRoster}
          onRestoreRoster={onRestoreRoster}
          onClearActiveRoster={onClearActiveRoster}
          onDeleteHistoryItem={onDeleteHistoryItem}
          onClearAllHistory={onClearAllHistory}
          onAddManualSector={onAddManualSector}
          onOpenUploadTab={() => setActiveTab('upload')}
          onUploadFiles={stageIncomingFiles}
          isParsing={isParsingBatch}
          onViewTimeline={onViewRosterTimeline}
          onMergeRosterSnapshot={onMergeRosterSnapshot}
        />
      )}

      {/* Tab 3: Sample 30-Day Presets */}
      {activeTab === 'samples' && (
        <div className="space-y-3">
          <p className="text-xs text-slate-400">
            Pick from realistic pre-configured rosters to immediately preview circadian recommendations, monthly salary estimation, and pre-flight routines:
          </p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {presets.map((preset) => {
              const isSelected = activePresetId === preset.id;
              return (
                <div
                  key={preset.id}
                  onClick={() => onSelectPreset(preset)}
                  className={`rounded-2xl border p-4 transition-all cursor-pointer ${
                    isSelected
                      ? 'border-blue-500 bg-blue-950/20 ring-1 ring-blue-500 shadow-md'
                      : 'border-slate-800 bg-slate-900/60 hover:border-slate-700 hover:bg-slate-900'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-white">{preset.name}</span>
                        {isSelected && (
                          <span className="rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 px-1.5 py-0.5 text-[9px] font-mono font-bold">
                            Active
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 leading-snug">{preset.description}</p>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between border-t border-slate-800/80 pt-2.5 text-[11px] text-slate-400">
                    <span>
                      Base: <strong className="text-slate-200">{preset.roster.homeBase}</strong>
                    </span>
                    <span>{preset.roster.flights.length} Flight Legs</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectPreset(preset);
                      }}
                      className="rounded-lg bg-slate-800 hover:bg-slate-700 px-2.5 py-1 text-xs font-semibold text-white transition-colors"
                    >
                      {isSelected ? 'Loaded ✓' : 'Load Roster'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab 4: Raw Schedule Text */}
      {activeTab === 'text' && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
              Paste Raw Roster Text
            </label>
            <p className="text-xs text-slate-400 mt-0.5">
              Copy flight lines from your crew portal, SMS, or WhatsApp schedule message. Will merge into your active continuous timeline.
            </p>
          </div>

          <textarea
            value={rawTextInput}
            onChange={(e) => setRawTextInput(e.target.value)}
            placeholder={`Example:\n01 OCT 6E 205 DEL 06:30 BOM 08:45\n01 OCT 6E 206 BOM 09:35 DEL 11:50\n03 OCT 6E 534 DEL 14:00 BLR 16:45`}
            rows={8}
            className="w-full rounded-xl border border-slate-800 bg-slate-950 p-3 font-mono text-xs text-slate-200 placeholder:text-slate-600 focus:border-blue-500 focus:outline-none"
          />

          <button
            onClick={handleParseText}
            disabled={isParsingBatch || !rawTextInput.trim()}
            className="flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 px-4 py-2.5 text-xs font-bold text-white transition-all disabled:opacity-50"
          >
            {isParsingBatch ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            <span>Upload & Parse Text with Gemini</span>
          </button>
        </div>
      )}

      {/* SMART CONFLICT RESOLUTION MODAL */}
      {pendingConflictData && (
        <ConflictResolutionModal
          conflicts={pendingConflictData.conflicts}
          identicalCount={pendingConflictData.identicalCount}
          newSectorsCount={pendingConflictData.newSectorsCount}
          onResolve={handleResolveConflicts}
          onCancel={() => setPendingConflictData(null)}
        />
      )}

      {/* FULL-SCREEN LIGHTBOX / PREVIEW VERIFICATION MODAL */}
      {previewModalIndex !== null && fileBatch[previewModalIndex] && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 sm:p-6"
          onClick={() => setPreviewModalIndex(null)}
        >
          <div
            className="relative flex flex-col w-full max-w-4xl max-h-[90vh] rounded-3xl border border-slate-800 bg-slate-950 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800/80 px-5 py-3.5 bg-slate-900/80">
              <div className="flex items-center gap-3 min-w-0">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-600/20 text-blue-400 font-mono text-xs font-bold">
                  {previewModalIndex + 1}/{fileBatch.length}
                </span>
                <div className="min-w-0">
                  <h4 className="font-bold text-white text-sm truncate font-mono">
                    {fileBatch[previewModalIndex].name}
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    {fileBatch[previewModalIndex].sizeKb} KB • Verify flight numbers, departure/arrival times & dates
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {!isParsingBatch && (
                  <button
                    onClick={() => removeFileFromBatch(fileBatch[previewModalIndex].id)}
                    className="flex items-center gap-1.5 rounded-xl border border-rose-800/60 bg-rose-950/30 hover:bg-rose-900/60 px-2.5 py-1.5 text-xs text-rose-300 font-semibold transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Remove File</span>
                  </button>
                )}

                <button
                  onClick={() => setPreviewModalIndex(null)}
                  className="rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 p-2 text-slate-300 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Modal Image Viewport */}
            <div className="relative flex-1 overflow-auto bg-slate-950 p-4 flex items-center justify-center min-h-[300px]">
              {fileBatch[previewModalIndex].previewUrl ? (
                <img
                  src={fileBatch[previewModalIndex].previewUrl}
                  alt={fileBatch[previewModalIndex].name}
                  className="max-h-[65vh] w-auto max-w-full object-contain rounded-xl shadow-lg border border-slate-800"
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-center p-8 space-y-3">
                  <FileText className="h-16 w-16 text-rose-400" />
                  <p className="text-white font-bold text-sm">{fileBatch[previewModalIndex].name}</p>
                  <p className="text-xs text-slate-400 max-w-sm">
                    This is a PDF roster document. Gemini Aero-OCR will parse the embedded vector tables directly.
                  </p>
                </div>
              )}

              {fileBatch.length > 1 && (
                <>
                  <button
                    onClick={() =>
                      setPreviewModalIndex((prev) =>
                        prev !== null ? (prev === 0 ? fileBatch.length - 1 : prev - 1) : null
                      )
                    }
                    className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-slate-900/80 hover:bg-slate-800 p-2.5 text-white ring-1 ring-slate-700 backdrop-blur-sm transition-all"
                    title="Previous file"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() =>
                      setPreviewModalIndex((prev) =>
                        prev !== null ? (prev === fileBatch.length - 1 ? 0 : prev + 1) : null
                      )
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-slate-900/80 hover:bg-slate-800 p-2.5 text-white ring-1 ring-slate-700 backdrop-blur-sm transition-all"
                    title="Next file"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between border-t border-slate-800 px-5 py-3 bg-slate-900/70 text-xs">
              <span className="text-slate-400">
                Tip: If text appears blurry, ensure your screenshot was taken at full resolution.
              </span>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPreviewModalIndex(null)}
                  className="rounded-xl bg-blue-600 hover:bg-blue-500 px-4 py-1.5 font-bold text-white transition-colors"
                >
                  Confirm & Close Preview
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Clear Active Roster Modal */}
      {showClearConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-rose-800/80 bg-slate-950 p-5 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-500/20 text-rose-400 ring-1 ring-rose-500/30">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <h4 className="text-base font-bold text-white">Deactivate Active Continuous Timeline?</h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  This will temporarily unload the current <strong>{currentRoster.flights.length} flights</strong> from your active duty schedule and reset to baseline rest rhythm.
                </p>
                <p className="text-xs text-slate-400">
                  Your roster is fully saved in your <strong>Upload & Audit History</strong> below. You can re-activate or merge it anytime with one tap.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setShowClearConfirmModal(false)}
                className="rounded-xl border border-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-900 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onClearActiveRoster();
                  setShowClearConfirmModal(false);
                }}
                className="flex items-center gap-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 px-4 py-2 text-xs font-bold text-white transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Yes, Deactivate Schedule</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
