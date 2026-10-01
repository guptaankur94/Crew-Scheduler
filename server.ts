import 'dotenv/config';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import { GoogleGenAI, Type } from '@google/genai';
import path from 'path';
import { fileURLToPath } from 'url';
import { sanitizeParsedRoster, sanitizeParsedPayslip } from './server/rosterSanitizer';
import type { SanitizedRoster } from './server/rosterSanitizer';
import { normalizeUpload, extractJsonFromText } from './server/upload';
import { createRateLimiter } from './server/rateLimit';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
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

app.use('/api', apiLimiter.middleware, (_req: Request, res: Response, next: NextFunction) => {
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
    const { imageBase64, mimeType = 'image/png', rawText } = req.body;

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
- DISREGARD NON-FLIGHT DUTIES: Days off (OFF, D/O, G/D, RD), Standby / Reserve (SBY, RSRV, ASBY), Leave (AL, S/L, CL), Training / Sim (SIM, TRG, G/S), Hotel / Layover (HOTEL, L/O, REST) must NOT be returned as flight legs. Only actual flights are included.
- AIRPORTS: Extract 3-letter IATA codes (e.g. DEL, BOM, DXB, LHR, JFK). If city names or 4-letter ICAO codes are shown, convert them to 3-letter IATA codes.
- MISSING YEAR: Today's date is ${today}. If the year is omitted from the document (e.g. only "01 OCT" or "Mon 14" is visible), choose the year that places the date closest to today.
- NEVER GUESS: If a flight's date, time or airport cannot be read, leave that field as an empty string rather than inventing a value.
- TIMESTAMPS IN UTC:
  * Timings on rosters are usually in local station time or Indian Standard Time (IST/UTC+5.5).
  * Convert all departure and arrival times into valid ISO 8601 UTC date-time strings: "YYYY-MM-DDTHH:mm:ssZ".
  * If Report Time (Check-In) is not stated on the roster, set it to 75 minutes before departure.
  * If Release Time (Check-Out) is not stated, set it to 30 minutes after arrival.
  * Set durationMinutes as the flight duration in minutes.
- HOME BASE & AIRLINE:
  * Infer the crew member's home base (the anchor station where trips start and finish, e.g. DEL, BOM, DXB).
  * Identify the airline name (e.g. IndiGo, Air India, Emirates, etc.).
- RESPOND STRICTLY WITH VALID JSON inside a \`\`\`json block matching:
{
  "airline": "string",
  "crewName": "string",
  "homeBase": "string",
  "homeBaseTzOffset": 5.5,
  "flights": [
    {
      "flightNumber": "string",
      "origin": "string",
      "destination": "string",
      "departureTimeUtc": "YYYY-MM-DDTHH:mm:ssZ",
      "arrivalTimeUtc": "YYYY-MM-DDTHH:mm:ssZ",
      "reportTimeUtc": "YYYY-MM-DDTHH:mm:ssZ",
      "releaseTimeUtc": "YYYY-MM-DDTHH:mm:ssZ",
      "originTzOffset": 5.5,
      "destTzOffset": 5.5,
      "aircraftType": "string",
      "durationMinutes": 120,
      "isRedEye": false
    }
  ],
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

    const acceptRoster = (text: string): SanitizedRoster | null => sanitizeParsedRoster(extractJsonFromText(text), now);

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

// Endpoint: Parse Salary Slip / Payslip Screenshot or PDF text
app.post('/api/payslip/parse', async (req: Request, res: Response) => {
  try {
    const { imageBase64, mimeType = 'image/png', rawText } = req.body;

    if (!imageBase64 && !rawText) {
      return res.status(400).json({ success: false, error: 'Please provide a payslip screenshot or text.' });
    }

    const upload = imageBase64 ? normalizeUpload(imageBase64, mimeType) : null;
    if (imageBase64 && !upload) {
      return res.status(400).json({ success: false, error: 'Unsupported file. Please upload a PNG, JPEG, WebP or PDF.' });
    }
    if (!upload && (typeof rawText !== 'string' || !rawText.trim() || rawText.length > MAX_RAW_TEXT_CHARS)) {
      return res.status(400).json({ success: false, error: 'Payslip text is empty or too long.' });
    }

    const systemInstruction = `
You are an expert aviation finance specialist analyzing airline cabin crew salary slips and paystubs (such as IndiGo Airlines, Emirates, Etihad, Air India, Qatar Airways, British Airways, etc.).
Your task is to extract the exact remuneration structure:
1. Base fixed salary (retainer / basic pay).
2. Flying hourly allowance (hourly block rate, flying pay per hour).
3. Standby hourly rate or daily standby reserve allowance.
4. Outstation layover allowance / per diem per overnight stay.
5. Night flying / WOCL premium (extra pay per night sector or night hour).
6. Currency (INR, AED, USD, etc.).
7. Seniority rank / job title (e.g. Junior FA, Senior Cabin Crew, In-Flight Manager / Lead).
8. Airline name.

Respond strictly in valid JSON conforming to the requested schema.
`;

    const contents: any[] = [];

    if (upload) {
      contents.push({ inlineData: { mimeType: upload.mimeType, data: upload.data } });
      contents.push({
        text: 'Analyze this airline cabin crew salary slip screenshot and extract the base pay, flying hourly rate, standby rate, layover per diem, night allowance, currency, and rank into structured JSON.',
      });
    } else {
      contents.push({
        text: `Analyze this cabin crew payslip text:\n\n${rawText}\n\nExtract base pay, flying hourly rate, standby rate, layover per diem, night allowance, currency, and rank into structured JSON.`,
      });
    }

    const { result: payslip, lastError } = await generateWithFallback(
      {
        contents,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              airline: { type: Type.STRING },
              rankTitle: { type: Type.STRING },
              currency: { type: Type.STRING, description: 'INR, AED, or USD' },
              baseFixedPay: { type: Type.NUMBER, description: 'Basic monthly salary retainer' },
              flyingHourlyRate: { type: Type.NUMBER, description: 'Hourly pay per flying block hour' },
              standbyHourlyRate: { type: Type.NUMBER, description: 'Hourly pay for standby reserve' },
              layoverPerDiem: { type: Type.NUMBER, description: 'Allowance per outstation layover stay' },
              nightAllowanceRate: { type: Type.NUMBER, description: 'Extra allowance per night sector or night hour' },
              notes: { type: Type.STRING, description: 'Summary of extracted compensation logic' },
            },
            required: ['currency', 'baseFixedPay', 'flyingHourlyRate', 'standbyHourlyRate'],
          },
        },
      },
      (text) => sanitizeParsedPayslip(extractJsonFromText(text))
    );

    if (!payslip) {
      const failure = describeFailure(
        lastError,
        'Could not read any pay figures from this payslip. Please make sure the amounts are visible, or enter your rates manually.'
      );
      return res.status(failure.status).json({ success: false, error: failure.error });
    }

    return res.json({ success: true, data: payslip });
  } catch (error: any) {
    console.error('Error parsing payslip with Gemini:', error);
    return res.status(500).json({
      success: false,
      error: 'Something went wrong while reading the payslip. Details are in the server log.',
    });
  }
});

// Endpoint: AI Aero-Medical Fatigue Consultation
app.post('/api/roster/ai-advise', async (req: Request, res: Response) => {
  try {
    const { roster, preferences } = req.body || {};
    const flights: any[] = Array.isArray(roster?.flights) ? roster.flights.slice(0, 200) : [];
    if (flights.length === 0) {
      return res.status(400).json({ success: false, error: 'A roster with at least one flight is required.' });
    }

    const clip = (value: unknown, max: number) => String(value ?? '').replace(/[\r\n]+/g, ' ').slice(0, max);
    const chronotype = ['lark', 'intermediate', 'owl'].includes(preferences?.chronotype)
      ? preferences.chronotype
      : 'intermediate';
    const summary = flights.map(
      (f) => `${clip(f?.flightNumber, 12)}: ${clip(f?.origin, 4)} -> ${clip(f?.destination, 4)} at ${clip(f?.departureTimeUtc, 30)}`
    );

    const { result: advice, lastError } = await generateWithFallback(
      {
        contents: `You are an expert aerospace medicine and fatigue risk consultant (grounded in NASA Ames Fatigue Countermeasures, ICAO Doc 9966, and Salk Institute Chrono-nutrition).
Given this cabin crew schedule for ${clip(roster.airline, 60).toUpperCase()} based at ${clip(roster.homeBase, 4)} with ${flights.length} flight sectors:
Roster Summary: ${JSON.stringify(summary)}
Crew Chronotype: ${chronotype}

Provide:
1. A concise 3-bullet personalized fatigue risk assessment.
2. Specific high-risk sectors (e.g. WOCL red-eyes or ultra-early checks).
3. Practical advice for galley nutrition, hydration at altitude, and post-flight recovery.
Keep it direct, professional, and encouraging for cabin crew.`,
      },
      (text) => (text.trim() ? text : null)
    );

    if (!advice) {
      const failure = describeFailure(lastError, 'The AI service returned no advice. Please try again.');
      return res.status(failure.status).json({ success: false, error: failure.error });
    }

    return res.json({ success: true, advice });
  } catch (error: any) {
    console.error('Error generating AI advice:', error);
    return res.status(500).json({
      success: false,
      error: 'Something went wrong while generating advice. Details are in the server log.',
    });
  }
});

// Unknown API routes get a JSON 404 instead of the web page
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

  app.listen(PORT, () => {
    console.log(`CrewCircadian server running on http://localhost:${PORT}`);
    if (!ai) {
      console.warn('GEMINI_API_KEY is not set: roster and payslip upload are disabled. Add it to .env and restart.');
    }
  });
}

startServer().catch(console.error);
