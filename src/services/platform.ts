/**
 * Where the app is running. In the phone app (Capacitor) native features such as alarms are available and the
 * roster reader is reached at the hosted server; in a browser the page's own server is used.
 */
type CapacitorGlobal = { isNativePlatform?: () => boolean };

export function isNativeApp(): boolean {
  const cap = (globalThis as { Capacitor?: CapacitorGlobal }).Capacitor;
  return !!cap?.isNativePlatform?.();
}

/** Base URL for the server API: empty in a browser (same server), the hosted server in the phone app. */
export function apiBase(): string {
  const configured = (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_API_BASE;
  return isNativeApp() ? configured ?? '' : '';
}

/** fetch() for the app's own API, wherever the app is running. */
export function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${apiBase()}${path}`, init);
}
