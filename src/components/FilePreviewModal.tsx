import React from 'react';
import { ChevronLeft, ChevronRight, FileText, Trash2, X } from 'lucide-react';
import type { FileBatchItem } from './views/UploadView';

/** Full-screen preview of a staged roster file, with previous/next and remove. */

interface Props {
  items: FileBatchItem[];
  index: number;
  onIndexChange: (index: number | null) => void;
  onRemove: (id: string, e?: React.MouseEvent) => void;
  busy?: boolean;
}

export const FilePreviewModal: React.FC<Props> = ({ items, index, onIndexChange, onRemove, busy }) => {
  const item = items[index];
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 sm:p-6"
      onClick={() => onIndexChange(null)}
    >
      <div
        className="relative flex flex-col w-full max-w-4xl max-h-[90vh] rounded-3xl border border-slate-800 bg-slate-950 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800/80 px-5 py-3.5 bg-slate-900/80">
          <div className="flex items-center gap-3 min-w-0">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-600/20 text-blue-400 font-mono text-xs font-bold">
              {index + 1}/{items.length}
            </span>
            <div className="min-w-0">
              <h4 className="font-bold text-white text-sm truncate font-mono">{item.name}</h4>
              <p className="text-[11px] text-slate-400">{item.sizeKb} KB • Verify flight numbers, departure/arrival times & dates</p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {!busy && (
              <button
                onClick={() => onRemove(item.id)}
                className="flex items-center gap-1.5 rounded-xl border border-rose-800/60 bg-rose-950/30 hover:bg-rose-900/60 px-2.5 py-1.5 text-xs text-rose-300 font-semibold transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Remove File</span>
              </button>
            )}

            <button
              onClick={() => onIndexChange(null)}
              className="rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 p-2 text-slate-300 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Modal Image Viewport */}
        <div className="relative flex-1 overflow-auto bg-slate-950 p-4 flex items-center justify-center min-h-[300px]">
          {item.previewUrl ? (
            <img
              src={item.previewUrl}
              alt={item.name}
              className="max-h-[65vh] w-auto max-w-full object-contain rounded-xl shadow-lg border border-slate-800"
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-center p-8 space-y-3">
              <FileText className="h-16 w-16 text-rose-400" />
              <p className="text-white font-bold text-sm">{item.name}</p>
              <p className="text-xs text-slate-400 max-w-sm">
                This is a PDF roster document. Gemini Aero-OCR will parse the embedded vector tables directly.
              </p>
            </div>
          )}

          {items.length > 1 && (
            <>
              <button
                onClick={() => onIndexChange(index === 0 ? items.length - 1 : index - 1)}
                className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-slate-900/80 hover:bg-slate-800 p-2.5 text-white ring-1 ring-slate-700 backdrop-blur-sm transition-all"
                title="Previous file"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                onClick={() => onIndexChange(index === items.length - 1 ? 0 : index + 1)}
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
          <span className="text-slate-400">Tip: If text appears blurry, ensure your screenshot was taken at full resolution.</span>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onIndexChange(null)}
              className="rounded-xl bg-blue-600 hover:bg-blue-500 px-4 py-1.5 font-bold text-white transition-colors"
            >
              Confirm & Close Preview
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
