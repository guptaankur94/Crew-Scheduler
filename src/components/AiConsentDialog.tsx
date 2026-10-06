import React, { useCallback, useState } from 'react';
import { giveAiConsent, hasAiConsent } from '../services/aiConsent';

const AiConsentDialog: React.FC<{ onAnswer: (allowed: boolean) => void }> = ({ onAnswer }) => (
  <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-labelledby="ai-consent-title">
    <div className="w-full max-w-md space-y-4 rounded-2xl border border-slate-800 bg-slate-900 p-6 text-sm text-slate-300 shadow-2xl">
      <h2 id="ai-consent-title" className="text-lg font-bold text-white">
        Read your file with AI?
      </h2>
      <p>
        To read your roster, CrewCircadian sends the file to <strong className="text-white">Google Gemini</strong>,
        an AI service run by Google. It is used only to read your flights and duties. CrewCircadian does not keep a
        copy; Google's own terms apply to how it handles the file.
      </p>
      <p>Before uploading, crop out anything you do not want to share, such as your name or staff number.</p>
      <p className="text-xs text-slate-500">You can withdraw this permission at any time in Settings → Your data.</p>
      <div className="flex justify-end gap-2 pt-2">
        <button
          onClick={() => onAnswer(false)}
          className="rounded-xl border border-slate-700 px-4 py-2 font-semibold text-slate-300 hover:bg-slate-800"
        >
          Don't send
        </button>
        <button onClick={() => onAnswer(true)} className="rounded-xl bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-500">
          Allow and continue
        </button>
      </div>
    </div>
  </div>
);

/**
 * Asks once for permission to send files to Gemini. `requestConsent` resolves true when allowed;
 * render `dialog` somewhere in the component.
 */
export function useAiConsent() {
  const [resolver, setResolver] = useState<((allowed: boolean) => void) | null>(null);

  const requestConsent = useCallback((): Promise<boolean> => {
    if (hasAiConsent()) return Promise.resolve(true);
    return new Promise<boolean>((resolve) => setResolver(() => resolve));
  }, []);

  const dialog = resolver ? (
    <AiConsentDialog
      onAnswer={(allowed) => {
        if (allowed) giveAiConsent();
        resolver(allowed);
        setResolver(null);
      }}
    />
  ) : null;

  return { requestConsent, dialog };
}
