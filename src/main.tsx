import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import {ErrorBoundary} from './components/ErrorBoundary.tsx';
import {requestPersistentStorage} from './services/backup.ts';
import {initStorage} from './services/kv.ts';
import {startLiveUpdates} from './services/liveUpdate.ts';
import './index.css';

// Ask the browser to keep saved rosters even when storage runs low
void requestPersistentStorage();

// In the phone app, saved data is loaded from the device before the app starts (a browser needs no wait)
initStorage()
  .catch((err) => console.warn('Could not load saved data', err))
  .finally(() =>
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </StrictMode>,
    ),
  )
  // In the phone app: mark this version as working and fetch newer screens in the background
  .then(() => startLiveUpdates());
