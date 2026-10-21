import 'dotenv/config';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import { GoogleGenAI, Type } from '@google/genai';
import path from 'path';
import { fileURLToPath } from 'url';
import { sanitizeParsedRoster } from './server/rosterSanitizer';
import type { SanitizedRoster } from './server/rosterSanitizer';
import { normalizeUpload, extractJsonFromText } from './server/upload';
import { rosterInstructions } from './src/services/rosterPrompt';
import { createDailyLimit, createRateLimiter } from './server/rateLimit';
import { allowedOrigins, apiCors, securityHeaders } from './server/security';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;
// Only this computer can reach the server unless HOST is set deliberately (e.g. when hosting it online)
const HOST = process.env.HOST || '127.0.0.1';
const MAX_RAW_TEXT_CHARS = 100_000;

// Behind a hosting proxy, use the visitor's address (for rate limits) rather than the proxy's. Set TRUST_PROXY=1 there.
if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY);
// Browser protections when serving the built app online (not in development, where live reload needs inline scripts)
if (process.env.NODE_ENV === 'production') app.use(securityHeaders);
// Only the web app and the phone app may call the roster reader
app.use('/api', apiCors(allowedOrigins(process.env.ALLOWED_ORIGINS)));

// Generous body limit for high-resolution roster screenshots
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// The key stays on the server. A missing or placeholder key disables the AI endpoints
// with a clear message instead of crashing the whole app.
const apiKey = (process.env.GEMINI_API_KEY || '').trim();
const hasApiKey = apiKey.length > 0 && apiKey !== 'MY_GEMINI_API_KEY';

const ai = hasApiKey
  ? new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    })
  : null;

// Models are tried in order until one answers. Override with GEMINI_MODELS="model-a,model-b" in .env.
const CANDIDATE_MODELS = (process.env.GEMINI_MODELS || 'gemini-3.8-flash,gemini-flash-latest,gemini-3.1-flash-lite')
  .split(',')
  .map((m) => m.trim())
  .filter(Boolean);

const isAuthError = (err: any) => /api[ _]?key|401|403|permission_denied|unauthenticated/i.test(err?.message || '');
const isCapacityError = (err: any) => /503|429|overloaded|demand|unavailable|resource_exhausted/i.test(err?.message || '');

/**
 * Runs a Gemini request against each candidate model until `accept` returns a value.
 * Returns that value (or null) together with the last error seen, for reporting.
 */
async function generateWithFallback<T>(
  request: { contents: any; config?: any },
  accept: (text: string) => T | null
): Promise<{ result: T | null; lastError: any }> {
  let lastError: any = null;
  for (const model of CANDIDATE_MODELS) {
    try {
      const response = await ai!.models.generateContent({ model, ...request });
      const result = accept(response.text || '');
      if (result !== null) return { result, lastError };
    } catch (err: any) {
      lastError = err;
      console.warn(`Model ${model} failed (${err.message}). Trying next candidate...`);
      if (isAuthError(err)) break; // A rejected key fails the same way on every model
      await new Promise((r) => setTimeout(r, 400));
    }
  }
  return { result: null, lastError };
}

/** Maps an upstream failure to a status code and a message that is safe to show the user. */
function describeFailure(lastError: any, notFoundMessage: string): { status: number; error: string } {
  if (isAuthError(lastError)) {
    return { status: 502, error: 'Gemini rejected the API key. Check GEMINI_API_KEY in your .env file and restart the server.' };
  }
  if (isCapacityError(lastError)) {
    return { status: 503, error: 'The AI service is busy right now. Please try again in a few seconds.' };
  }
  if (lastError) {
    return { status: 502, error: 'The AI service could not be reached. Please try again; details are in the server log.' };
  }
  return { status: 422, error: notFoundMessage };
}

const apiLimiter = createRateLimiter(30, 60_000);
// Hard daily cap on AI calls, so a bug or misuse cannot run up a large bill. Override with GEMINI_DAILY_LIMIT.
const dailyAiLimit = createDailyLimit(Number(process.env.GEMINI_DAILY_LIMIT) || 200);

app.use('/api', apiLimiter.middleware, dailyAiLimit.middleware, (_req: Request, res: Response, next: NextFunction) => {
  if (!ai) {
    return res.status(503).json({
      success: false,
      error: 'Roster reading is not set up on this server yet (GEMINI_API_KEY is missing). You can still use "Read with your own AI app".',
    });
  }
  next();
});

// Endpoint: Parse Roster Screenshot or Raw Text using resilient multi-model Gemini pipeline
app.post('/api/roster/parse', async (req: Request, res: Response) => {
  try {
    const { imageBase64, mimeType = 'image/png', rawText, timeConvention, homeBase } = req.body;

    if (!imageBase64 && !rawText) {
      return res.status(400).json({ success: false, error: 'Please provide a roster screenshot image or schedule text.' });
    }

    const upload = imageBase64 ? normalizeUpload(imageBase64, mimeType) : null;
    if (imageBase64 && !upload) {
      return res.status(400).json({ success: false, error: 'Unsupported file. Please upload a PNG, JPEG, WebP or PDF.' });
    }
    if (!upload && (typeof rawText !== 'string' || !rawText.trim() || rawText.length > MAX_RAW_TEXT_CHARS)) {
      return res.status(400).json({ success: false, error: 'Schedule text is empty or too long.' });
    }

    const now = new Date();
    const today = now.toISOString().slice(0, 10);

    const systemInstruction = rosterInstructions(today);

    const contents: any[] = upload
      ? [
          { inlineData: { mimeType: upload.mimeType, data: upload.data } },
          {
            text: `Analyze this crew roster document/screenshot with utmost precision. Decipher all flight duty lines, dates, flight numbers, route airports, and departure/arrival timings. Return valid JSON inside a \`\`\`json block.`,
          },
        ]
      : [
          {
            text: `Analyze this crew roster text data:\n\n${rawText}\n\nExtract all flight duty legs, dates, flight numbers, route airports, and departure/arrival timings into clean structured JSON inside a \`\`\`json block.`,
          },
        ];

    // The crew member's time setting and saved home base, used when the roster does not say which clock it uses
    const sanitizeOptions = {
      timeConvention: ['local', 'home', 'utc'].includes(timeConvention) ? timeConvention : undefined,
      homeBase: typeof homeBase === 'string' && /^[A-Z]{3}$/.test(homeBase) ? homeBase : undefined,
    };
    const acceptRoster = (text: string): SanitizedRoster | null => sanitizeParsedRoster(extractJsonFromText(text), now, sanitizeOptions);

    // Stage 1: direct structured extraction
    let { result: roster, lastError } = await generateWithFallback({ contents, config: { systemInstruction } }, acceptRoster);

    // Stage 2: transcribe the image to text first, then structure the transcription
    if (!roster && upload && !isAuthError(lastError)) {
      console.log('Stage 1 produced no usable flights. Trying two-step transcription...');
      const transcription = await generateWithFallback(
        {
          contents: [
            { inlineData: { mimeType: upload.mimeType, data: upload.data } },
            {
              text: 'Transcribe every flight line, table row, date, flight number (e.g. 6E 205), airport code, and departure/arrival time visible in this roster image. Be exhaustive.',
            },
          ],
        },
        (text) => (text.length > 20 ? text : null)
      );
      lastError = transcription.lastError || lastError;

      if (transcription.result) {
        const structured = await generateWithFallback(
          {
            contents: [
              {
                text: `Below is the text transcribed from an airline crew roster:\n\n${transcription.result}\n\nExtract all flight duty legs into strictly valid JSON inside \`\`\`json matching the schema with airline, homeBase, flights array.`,
              },
            ],
            config: { systemInstruction },
          },
          acceptRoster
        );
        roster = structured.result;
        lastError = structured.lastError || lastError;
      }
    }

    if (!roster) {
      const failure = describeFailure(
        lastError,
        'Could not read any complete flight legs from this document. Please make sure the flight numbers, dates, airports and times are visible, or use the Paste Text option.'
      );
      return res.status(failure.status).json({ success: false, error: failure.error });
    }

    return res.json({ success: true, data: roster });
  } catch (error: any) {
    // Message and status only: never anything that could contain the roster itself
    console.error('Error parsing roster with Gemini:', (error as { status?: number })?.status ?? '', (error as Error)?.message ?? 'unknown error');
    return res.status(500).json({
      success: false,
      error: 'Something went wrong while reading the roster. Details are in the server log.',
    });
  }
});

app.use('/api', (_req: Request, res: Response) => {
  res.status(404).json({ success: false, error: 'Unknown API endpoint.' });
});

// Live updates for the installed phone apps (scripts/make-update-bundle.mjs): the app checks latest.json and
// downloads the zip of the newest screens. The phone app runs on another origin, so these allow it like the API does.
app.use(
  '/updates',
  apiCors(allowedOrigins(process.env.ALLOWED_ORIGINS)),
  express.static(path.resolve(__dirname, 'dist-update'), {
    setHeaders: (res, filePath) => res.setHeader('Cache-Control', filePath.endsWith('latest.json') ? 'no-store' : 'public, max-age=31536000, immutable'),
  }),
  (_req: Request, res: Response) => res.status(404).json({ success: false, error: 'No live update here.' })
);

// Dev vs Production Vite Setup
async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  // Malformed or oversized request bodies end up here
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const tooLarge = err?.type === 'entity.too.large';
    if (!tooLarge) console.error('Request error:', err?.message || err);
    res.status(tooLarge ? 413 : 400).json({
      success: false,
      error: tooLarge ? 'That file is too large. Please upload a file under 15 MB.' : 'The request could not be read.',
    });
  });

  app.listen(PORT, HOST, () => {
    console.log(`CrewCircadian server running on http://localhost:${PORT}`);
    if (!ai) {
      console.warn('GEMINI_API_KEY is not set: roster upload is disabled. Add it to .env and restart.');
    }
  });
}

startServer().catch(console.error);
