import { registerPlugin } from '@capacitor/core';
import { isNativeApp } from './platform';

/*
 * "Share → CrewCircadian" and "Open in CrewCircadian": roster screenshots or PDFs sent from another app arrive as
 * files for the Rosters page, exactly as if picked there (consent and the check screen still apply).
 *   Android  the app's SharedRoster plugin (share sheet)
 *   iPhone   "Open in" for images and PDFs (Files, Mail, WhatsApp documents), delivered as a file link
 */

interface SharedFile {
  name: string;
  type: string | null;
  data: string; // base64
}
interface SharedRosterPlugin {
  getPending(): Promise<{ files: SharedFile[] }>;
  addListener(event: 'shared', cb: (e: { files: SharedFile[] }) => void): Promise<{ remove: () => Promise<void> }>;
}

const shared = registerPlugin<SharedRosterPlugin>('SharedRoster');

const toFile = (f: SharedFile): File => {
  const bytes = Uint8Array.from(atob(f.data), (c) => c.charCodeAt(0));
  const type = f.type || (/\.pdf$/i.test(f.name) ? 'application/pdf' : 'image/jpeg');
  return new File([bytes], f.name || 'Shared roster', { type });
};

/** Calls onFiles whenever roster files are shared to the app. Returns a function that stops listening. */
export async function listenForSharedRosters(onFiles: (files: File[]) => void): Promise<() => void> {
  if (!isNativeApp()) return () => {};
  const stops: (() => void)[] = [];
  const deliver = (files: SharedFile[]) => files.length && onFiles(files.map(toFile));

  // Android
  try {
    const l = await shared.addListener('shared', (e) => deliver(e.files));
    stops.push(() => void l.remove());
    deliver((await shared.getPending()).files);
  } catch {
    // Not on this phone (iPhone)
  }

  // iPhone: "Open in CrewCircadian" passes a file link
  const { App } = await import('@capacitor/app');
  const openFile = async (url?: string) => {
    if (!url || !url.startsWith('file:')) return;
    try {
      const { Filesystem } = await import('@capacitor/filesystem');
      const { data } = await Filesystem.readFile({ path: url });
      const name = decodeURIComponent(url.split('/').pop() || 'Shared roster');
      const base64 = typeof data === 'string' ? data : await blobToBase64(data);
      deliver([{ name, type: null, data: base64 }]);
    } catch {
      // Unreadable file: nothing to add
    }
  };
  const handle = await App.addListener('appUrlOpen', (e) => void openFile(e.url));
  stops.push(() => void handle.remove());
  void openFile((await App.getLaunchUrl())?.url);

  return () => stops.forEach((s) => s());
}

const blobToBase64 = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
