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
/** Shown when the app's server cannot be reached (offline, or a copy of the app hosted without it, e.g. GitHub Pages). */
export const NO_SERVER_MESSAGE = 'The reading server is not available here. Use "Read with your own AI app" (below the upload box) instead.';

/** Calls the app's server. Every API answer is JSON, so anything else means there is no server here. */
export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(`${apiBase()}${path}`, init);
  } catch {
    throw new Error(NO_SERVER_MESSAGE);
  }
  if (!(response.headers.get('content-type') ?? '').includes('json')) throw new Error(NO_SERVER_MESSAGE);
  return response;
}
