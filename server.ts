import 'dotenv/config';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import { GoogleGenAI, Type } from '@google/genai';
import path from 'path';
import { fileURLToPath } from 'url';
import { sanitizeParsedRoster } from './server/rosterSanitizer';
import type { SanitizedRoster } from './server/rosterSanitizer';
import { normalizeUpload, extractJsonFromText } from './server/upload';
import { createDailyLimit, createRateLimiter } from './server/rateLimit';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;
// Only this computer can reach the server unless HOST is set deliberately (e.g. when hosting it online)
const HOST = process.env.HOST || '127.0.0.1';
const MAX_RAW_TEXT_CHARS = 100_000;

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
      error: 'AI features are not configured. Add your GEMINI_API_KEY to the .env file and restart the server.',
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

    const systemInstruction = `
You are an expert aviation intelligence specialist and roster reader capable of extracting crew flight duties from ANY airline document or screenshot worldwide (e.g. IndiGo, Air India, Emirates, Etihad, Qatar, Singapore Airlines, British Airways, Lufthansa, Delta, United, American, Southwest, Ryanair, easyJet, Akasa Air, SpiceJet, Vistara, flydubai, Air Arabia, KLM, Air France, Qantas, etc.).

YOU HANDLE ALL PRESENTATION FORMATS:
1. Tabular Roster Tables: Columns like Date, Flight, Origin, Destination, STD, STA, CI/Check-in, CO/Debrief, Block time, Aircraft type, Duty code.
2. Calendar Grid Views: Monthly or weekly calendar view where each day cell shows flight numbers, departures, pairings, or duty pills.
3. Trip Pairings / Rotations: Grouped pairings with pairing codes (e.g. Pairing 4102, Trip 21) followed by flight legs.
4. Mobile App Screens: Screenshots from crew apps like AIMS eCrew, NetLine, Sabre CrewConnection, FLiCA, CrewX, Jeppesen, ARINC, or native airline crew portals.
5. Message / Email / Chat: Plain text or formatted tables forwarded via WhatsApp, SMS, or email.
6. Camera Photos of Printed Paper: Scans or photos of printed duty sheets, briefing packets, or board printouts.

CRITICAL EXTRACTION RULES:
- EXTRACT EVERY REAL FLIGHT LEG: Look for flight numbers (2-character or 3-character airline code followed by digits, e.g. 6E 205, AI 101, EK 512, QR 570, BA 142, UA 880, DL 1234, FR 405, QP 1102, SG 8145, UK 955, etc.).
- STANDBY: Standby / reserve duties (SBY, RSRV, HSBY, ASBY, "standby", "reserve") are NOT flights. Return each one in the "standby" array with its start and end time in UTC. Use "airport" for airport standby (ASBY, airport reserve) and "home" for home standby (SBY, HSBY, home reserve).
- POSITIONING: Flights travelled as a passenger to or from a duty (marked DH, DHD, POS, PAX, "deadhead" or "positioning") ARE returned in "flights" with "isPositioning": true. Normal working flights have "isPositioning": false.
- OTHER DAYS: Days without flying are NOT flights. Return each one in the "otherDuties" array with its date (the roster's local date, "YYYY-MM-DD") and the code as printed. Use "off" for days off (OFF, D/O, DO, G/D, "Golden Day Off", RD), "leave" for leave or holiday (AL, CL, PL, LV, "leave"), "sick" for sick days (SCK, SL, S/L, "sick"), "training" for training or simulator days (SIM, TRG, G/S, CRM, "training"), and "other" for anything else that is not a flight or standby. Hotel / layover lines (HOTEL, L/O, REST) are not returned.
- ROSTER PERIOD: If the document states the dates it covers (e.g. "01/10/2026 - 21/10/2026"), return them as "rosterPeriod" with "start" and "end" dates ("YYYY-MM-DD").
- VISIBLE DATES: Return "visibleDates": every calendar date that has its own row, cell or line in this document, including days that are blank, OFF, leave or rest ("YYYY-MM-DD"). Only dates actually shown, never the whole month just because a header names it. This tells the app which days this screenshot really covers.
- AIRPORTS: Extract 3-letter IATA codes (e.g. DEL, BOM, DXB, LHR, JFK). If city names or 4-letter ICAO codes are shown, convert them to 3-letter IATA codes.
- MISSING YEAR: Today's date is ${today}. If the year is omitted from the document (e.g. only "01 OCT" or "Mon 14" is visible), choose the year that places the date closest to today.
- NEVER GUESS: If a flight's date, time or airport cannot be read, leave that field as an empty string rather than inventing a value.
- TIMES EXACTLY AS PRINTED (do NOT convert time zones):
  * For each flight return "date" (the departure date as printed, "YYYY-MM-DD"), "depTime" and "arrTime" exactly as printed in 24-hour "HH:MM". If the roster prints the arrival date, also return "arrDate".
  * "reportTime" is the check-in / reporting time and "releaseTime" the debrief / sign-off / check-out time, as printed ("HH:MM"). For a multi-sector day the release belongs to the last flight. Leave them as empty strings when not printed; never invent them.
  * Do not add or subtract hours for any time zone. The app converts the times itself.
  * "timeConvention": if the roster states which clock its times use, return "local" (each airport's local time, e.g. "LT", "All times local"), "home" (all in the home base's time, e.g. "All times IST" for an Indian base) or "utc" ("UTC", "Z", "GMT"). If it does not say, return "unknown".
  * Standby: return "date", "startTime" and "endTime" as printed (and "endDate" if printed).
- HOME BASE & AIRLINE:
  * Infer the crew member's home base (the anchor station where trips start and finish, e.g. DEL, BOM, DXB).
  * Identify the airline name (e.g. IndiGo, Air India, Emirates, etc.).
- RESPOND STRICTLY WITH VALID JSON inside a \`\`\`json block matching:
{
  "airline": "string",
  "homeBase": "string",
  "homeBaseTzOffset": 5.5,
  "flights": [
    {
      "flightNumber": "string",
      "origin": "string",
      "destination": "string",
      "date": "YYYY-MM-DD",
      "depTime": "HH:MM",
      "arrTime": "HH:MM",
      "arrDate": "",
      "reportTime": "",
      "releaseTime": "",
      "aircraftType": "string",
      "isRedEye": false,
      "isPositioning": false
    }
  ],
  "standby": [
    { "type": "home", "airport": "DEL", "date": "YYYY-MM-DD", "startTime": "HH:MM", "endTime": "HH:MM" }
  ],
  "otherDuties": [
    { "type": "off", "date": "YYYY-MM-DD", "code": "OFF" }
  ],
  "rosterPeriod": { "start": "YYYY-MM-DD", "end": "YYYY-MM-DD" },
  "visibleDates": ["YYYY-MM-DD"],
  "timeConvention": "local | home | utc | unknown",
  "notes": "string"
}
`;

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
    console.error('Error parsing roster with Gemini:', error);
    return res.status(500).json({
      success: false,
      error: 'Something went wrong while reading the roster. Details are in the server log.',
    });
  }
});

app.use('/api', (_req: Request, res: Response) => {
  res.status(404).json({ success: false, error: 'Unknown API endpoint.' });
});

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
