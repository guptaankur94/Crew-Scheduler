const SUPPORTED_MIME_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'];

export interface NormalizedUpload {
  data: string; // bare base64, no data: prefix
  mimeType: string;
}

/**
 * Accepts either a bare base64 string or a full data URL (as produced by FileReader)
 * for an image or PDF, and returns bare base64 plus a MIME type Gemini accepts.
 * Returns null when the payload is not usable base64.
 */
export function normalizeUpload(payload: unknown, declaredMimeType: unknown): NormalizedUpload | null {
  if (typeof payload !== 'string' || !payload.trim()) return null;

  let data = payload;
  let mime = typeof declaredMimeType === 'string' ? declaredMimeType.toLowerCase().trim() : '';

  const dataUrl = payload.match(/^data:([^;,]+)?(?:;[^,]*)?,/);
  if (dataUrl) {
    data = payload.slice(dataUrl[0].length);
    if (dataUrl[1]) mime = dataUrl[1].toLowerCase().trim();
  }

  data = data.replace(/\s+/g, '');
  if (!data || !/^[A-Za-z0-9+/]+={0,2}$/.test(data)) return null;

  if (mime.includes('pdf')) mime = 'application/pdf';
  else if (mime.includes('png')) mime = 'image/png';
  else if (mime.includes('jpeg') || mime.includes('jpg')) mime = 'image/jpeg';
  else if (mime.includes('webp')) mime = 'image/webp';

  if (!SUPPORTED_MIME_TYPES.includes(mime)) return null;

  return { data, mimeType: mime };
}

/**
 * Pulls a JSON object out of model output that may be wrapped in a ```json fence or prose.
 */
export function extractJsonFromText(text: string): any {
  if (!text) return null;
  let clean = text.trim();

  const fenced = clean.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced && fenced[1]) {
    clean = fenced[1].trim();
  } else {
    const firstBrace = clean.indexOf('{');
    const lastBrace = clean.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      clean = clean.slice(firstBrace, lastBrace + 1);
    }
  }

  // Remove trailing commas before } or ]
  clean = clean.replace(/,\s*([}\]])/g, '$1');

  try {
    return JSON.parse(clean);
  } catch {
    return null;
  }
}
