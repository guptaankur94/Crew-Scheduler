import { isNativeApp } from './platform';

/*
 * Saving a file the app made (calendar file, backup, hours report). In a browser it downloads as usual. In the
 * phone app a download does nothing, so the file is written to the app's cache folder and the phone's share sheet
 * opens (Save to Files, email, WhatsApp, a calendar app…).
 */
export async function saveOrShareFile(name: string, content: string | Blob, mimeType: string): Promise<void> {
  const blob = typeof content === 'string' ? new Blob([content], { type: mimeType }) : content;
  if (!isNativeApp()) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return;
  }
  const [{ Filesystem, Directory }, { Share }] = await Promise.all([import('@capacitor/filesystem'), import('@capacitor/share')]);
  const data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
  const { uri } = await Filesystem.writeFile({ directory: Directory.Cache, path: name, data });
  await Share.share({ title: name, files: [uri] });
}
