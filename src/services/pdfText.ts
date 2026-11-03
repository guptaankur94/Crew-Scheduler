/**
 * Text from a PDF with where each piece sits on the page, read on the device (pdf.js). Rosters exported as real
 * PDFs (not scans) can then be read exactly, without sending them anywhere. pdf.js is large, so it is loaded only
 * when a PDF is opened.
 */

/** One piece of text: page number (from 1), left edge and baseline in PDF points (y grows upwards). */
export interface PdfTextItem {
  page: number;
  x: number;
  y: number;
  text: string;
}

/** The parts of a pdf.js document this file uses (so the browser and Node builds can both be passed in). */
interface PdfDocumentLike {
  numPages: number;
  getPage(n: number): Promise<{ getTextContent(): Promise<{ items: unknown[] }> }>;
}

const round = (n: number) => Math.round(n * 10) / 10;

/** Every non-blank text item of every page, in document order. */
export async function textItemsFromDocument(doc: PdfDocumentLike): Promise<PdfTextItem[]> {
  const out: PdfTextItem[] = [];
  for (let page = 1; page <= doc.numPages; page++) {
    const content = await (await doc.getPage(page)).getTextContent();
    for (const item of content.items as { str?: string; transform?: number[] }[]) {
      const text = item.str?.trim();
      if (!text || !item.transform) continue;
      out.push({ page, x: round(item.transform[4]), y: round(item.transform[5]), text });
    }
  }
  return out;
}

/** Reads a PDF file's text in the browser or phone app. Returns null for a PDF that cannot be opened. */
export async function extractPdfText(data: ArrayBuffer): Promise<PdfTextItem[] | null> {
  try {
    // The legacy build: the standard one needs JavaScript newer than many phones have (the app supports iOS 15)
    const [pdfjs, worker] = await Promise.all([
      import('pdfjs-dist/legacy/build/pdf.mjs'),
      import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'),
    ]);
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
    const task = pdfjs.getDocument({ data: new Uint8Array(data) });
    try {
      return await textItemsFromDocument(await task.promise);
    } finally {
      void task.destroy();
    }
  } catch (err) {
    console.warn('Could not read the PDF text on the device:', (err as Error)?.message);
    return null;
  }
}
