import { apiBase, isNativeApp } from './platform';

/**
 * Live updates for the installed phone app. The app's screens (this web code) can be updated without a new store
 * build: the server publishes the newest screens at /updates/ (scripts/make-update-bundle.mjs), the app downloads
 * them in the background and switches to them the next time it goes to the background or is reopened. The app
 * always keeps a working copy on the phone, so it opens offline. Changes to native code (alarms, widgets, plugins)
 * still need a new build.
 */

/** Switched off with VITE_LIVE_UPDATES=off at build time. */
const enabled = (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_LIVE_UPDATES !== 'off';

let checking = false;

async function checkOnce(): Promise<void> {
  if (checking) return;
  checking = true;
  try {
    const { CapacitorUpdater } = await import('@capgo/capacitor-updater');
    const response = await fetch(`${apiBase()}/updates/latest.json`, { cache: 'no-store' });
    if (!response.ok) return;
    const latest = (await response.json()) as { version?: string; file?: string };
    if (!latest.version || !latest.file || !/^[a-f0-9]{8,64}$/.test(latest.version)) return;
    const { bundle } = await CapacitorUpdater.current();
    if (bundle.version === latest.version) return;
    const { bundles } = await CapacitorUpdater.list();
    const ready =
      bundles.find((b) => b.version === latest.version && b.status === 'success') ??
      (await CapacitorUpdater.download({ url: `${apiBase()}/updates/${latest.file}`, version: latest.version }));
    await CapacitorUpdater.next({ id: ready.id });
  } catch (err) {
    // Offline or the server is unreachable: keep the version on the phone and try again later
    console.warn('Live update check skipped', err);
  } finally {
    checking = false;
  }
}

/** Call once when the app starts: confirms this version works (otherwise the plugin rolls back) and checks for a newer one. */
export async function startLiveUpdates(): Promise<void> {
  if (!enabled || !isNativeApp()) return;
  try {
    const { CapacitorUpdater } = await import('@capgo/capacitor-updater');
    await CapacitorUpdater.notifyAppReady();
    const { App } = await import('@capacitor/app');
    await App.addListener('resume', () => void checkOnce());
  } catch (err) {
    console.warn('Live updates unavailable', err);
    return;
  }
  void checkOnce();
}
