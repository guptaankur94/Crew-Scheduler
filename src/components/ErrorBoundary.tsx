import React from 'react';
import { clearAppState } from '../services/appStateStorage';
import { clearRosterHistoryLogs } from '../services/rosterHistoryService';

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Catches a crash anywhere in the UI and offers a way out instead of a blank screen.
 * Saved data is the most likely cause of a crash that repeats on reload, so it can be reset from here.
 */
export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('CrewCircadian crashed:', error, info.componentStack);
  }

  handleReset = () => {
    clearAppState();
    clearRosterHistoryLogs();
    window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div role="alert" className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
        <div className="max-w-md space-y-4 rounded-2xl border border-slate-800 bg-slate-900 p-6 text-sm">
          <h1 className="text-lg font-bold text-white">Something went wrong</h1>
          <p className="text-slate-300">
            The app hit an unexpected error. Reloading usually fixes it. If it keeps happening, reset the saved
            roster and settings on this device.
          </p>
          <p className="rounded-lg bg-slate-950 p-3 font-mono text-xs text-rose-300 break-words">
            {this.state.error.message}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => window.location.reload()}
              className="rounded-xl bg-blue-600 px-4 py-2 font-bold text-white hover:bg-blue-500"
            >
              Reload
            </button>
            <button
              onClick={this.handleReset}
              className="rounded-xl border border-rose-800 px-4 py-2 font-bold text-rose-200 hover:bg-rose-950"
            >
              Reset saved data and reload
            </button>
          </div>
        </div>
      </div>
    );
  }
}
