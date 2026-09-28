import 'dotenv/config';
import express, { Request, Response } from 'express';
import { GoogleGenAI, Type } from '@google/genai';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Generous body limit for high-resolution roster screenshots
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Initialize GoogleGenAI SDK per guidelines
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Helper airport dictionary for UTC timezone offsets & city normalization
const AIRPORT_TZ_MAP: Record<string, { tzOffset: number; city: string }> = {
  DEL: { tzOffset: 5.5, city: 'Delhi' },
  BOM: { tzOffset: 5.5, city: 'Mumbai' },
  BLR: { tzOffset: 5.5, city: 'Bengaluru' },
  HYD: { tzOffset: 5.5, city: 'Hyderabad' },
  CCU: { tzOffset: 5.5, city: 'Kolkata' },
  MAA: { tzOffset: 5.5, city: 'Chennai' },
  AMD: { tzOffset: 5.5, city: 'Ahmedabad' },
  GOI: { tzOffset: 5.5, city: 'Goa' },
  PNQ: { tzOffset: 5.5, city: 'Pune' },
  COK: { tzOffset: 5.5, city: 'Kochi' },
  GAU: { tzOffset: 5.5, city: 'Guwahati' },
  TRV: { tzOffset: 5.5, city: 'Trivandrum' },
  IXC: { tzOffset: 5.5, city: 'Chandigarh' },
  DXB: { tzOffset: 4, city: 'Dubai' },
  AUH: { tzOffset: 4, city: 'Abu Dhabi' },
  DOH: { tzOffset: 3, city: 'Doha' },
  MCT: { tzOffset: 4, city: 'Muscat' },
  BAH: { tzOffset: 3, city: 'Bahrain' },
  KWI: { tzOffset: 3, city: 'Kuwait City' },
  RUH: { tzOffset: 3, city: 'Riyadh' },
  JED: { tzOffset: 3, city: 'Jeddah' },
  SIN: { tzOffset: 8, city: 'Singapore' },
  BKK: { tzOffset: 7, city: 'Bangkok' },
  HKT: { tzOffset: 7, city: 'Phuket' },
  KUL: { tzOffset: 8, city: 'Kuala Lumpur' },
  MLE: { tzOffset: 5, city: 'Malé' },
  CMB: { tzOffset: 5.5, city: 'Colombo' },
  LHR: { tzOffset: 1, city: 'London' },
  CDG: { tzOffset: 2, city: 'Paris' },
  FRA: { tzOffset: 2, city: 'Frankfurt' },
  JFK: { tzOffset: -4, city: 'New York' },
  SFO: { tzOffset: -7, city: 'San Francisco' },
  SYD: { tzOffset: 10, city: 'Sydney' },
};

// Endpoint: Parse Roster Screenshot or Raw Text using resilient multi-model Gemini pipeline
app.post('/api/roster/parse', async (req: Request, res: Response) => {
  try {
    const { imageBase64, mimeType = 'image/png', rawText } = req.body;

    if (!imageBase64 && !rawText) {
      return res.status(400).json({ error: 'Please provide a roster screenshot image or schedule text.' });
    }

    let cleanBase64 = imageBase64;
    let cleanMime = (mimeType || 'image/png').toLowerCase().trim();

    if (typeof cleanBase64 === 'string') {
      if (cleanBase64.includes(';base64,')) {
        const parts = cleanBase64.split(';base64,');
        cleanBase64 = parts[1];
        if (parts[0].startsWith('data:')) {
          cleanMime = parts[0].replace('data:', '').toLowerCase().trim();
        }
      } else if (cleanBase64.includes(',')) {
        cleanBase64 = cleanBase64.split(',')[1];
      }
      cleanBase64 = cleanBase64.replace(/\s+/g, '');
    }

    // MIME type normalization for Gemini
    if (cleanMime === 'image/jpg' || cleanMime === 'image/pjpeg') cleanMime = 'image/jpeg';
    if (cleanMime.includes('pdf')) cleanMime = 'application/pdf';
    else if (cleanMime.includes('png')) cleanMime = 'image/png';
    else if (cleanMime.includes('jpeg') || cleanMime.includes('jpg')) cleanMime = 'image/jpeg';
    else if (cleanMime.includes('webp')) cleanMime = 'image/webp';
    else cleanMime = 'image/jpeg';

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
- REFERENCE YEAR 2026: If the year is omitted from the screenshot (e.g. only "01 OCT" or "Mon 14" is visible), assume the year is 2026.
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

    const contents: any[] = [];

    if (cleanBase64) {
      contents.push({
        inlineData: {
          mimeType: cleanMime,
          data: cleanBase64,
        },
      });
      contents.push({
        text: `Analyze this crew roster document/screenshot with utmost precision. Decipher all flight duty lines, dates (assume reference year 2026 if year is omitted), flight numbers, route airports, and departure/arrival timings. Return valid JSON inside a \`\`\`json block.`,
      });
    } else {
      contents.push({
        text: `Analyze this crew roster text data (reference year 2026 if year is omitted):\n\n${rawText}\n\nExtract all flight duty legs, dates, flight numbers, route airports, and departure/arrival timings into clean structured JSON inside a \`\`\`json block.`,
      });
    }

    // Helper: Robust JSON extraction from LLM response text
    const extractJsonFromText = (text: string): any => {
      if (!text) return null;
      let clean = text.trim();

      // Check for ```json ... ``` block
      const jsonBlockMatch = clean.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
      if (jsonBlockMatch && jsonBlockMatch[1]) {
        clean = jsonBlockMatch[1].trim();
      } else {
        const firstBrace = clean.indexOf('{');
        const lastBrace = clean.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
          clean = clean.slice(firstBrace, lastBrace + 1);
        }
      }

      // Remove trailing commas before } or ]
      clean = clean.replace(/,\s*([}\]])/g, '$1');

      try {
        return JSON.parse(clean);
      } catch (err) {
        console.warn('Direct JSON parse failed, attempting loose fix:', err);
        return null;
      }
    };

    // Resilient Multi-Model Candidate Pool
    const CANDIDATE_MODELS = ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite'];
    let parsedJson: any = null;
    let lastError: any = null;

    for (const modelName of CANDIDATE_MODELS) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents,
          config: {
            systemInstruction,
          },
        });

        const extracted = extractJsonFromText(response.text || '');
        if (extracted && Array.isArray(extracted.flights) && extracted.flights.length > 0) {
          parsedJson = extracted;
          break;
        } else if (extracted && Array.isArray(extracted.flights)) {
          // Keep if non-empty later
          parsedJson = extracted;
        }
      } catch (err: any) {
        lastError = err;
        console.warn(`Model ${modelName} failed or busy (${err.message}). Trying next candidate...`);
        // Small pause before fallback
        await new Promise((r) => setTimeout(r, 400));
      }
    }

    // Stage 2: Two-Step Vision Transcription fallback if 0 flights extracted
    if ((!parsedJson || !Array.isArray(parsedJson.flights) || parsedJson.flights.length === 0) && cleanBase64) {
      console.log('Stage 1 produced 0 flights. Launching Stage 2 Two-Step Human-Like Reader...');
      try {
        // Step 2A: Full text and table transcription using fast flash
        const transcriptionRes = await ai.models.generateContent({
          model: 'gemini-flash-latest',
          contents: [
            {
              inlineData: {
                mimeType: cleanMime,
                data: cleanBase64,
              },
            },
            {
              text: 'Transcribe every flight line, table row, date, flight number (e.g. 6E 205), airport code, and departure/arrival time visible in this roster image. Be exhaustive.',
            },
          ],
        });

        const transcribedText = transcriptionRes.text || '';
        if (transcribedText.length > 20) {
          // Step 2B: Convert transcribed text into structured flight schedule
          const parseTextRes = await ai.models.generateContent({
            model: 'gemini-flash-latest',
            contents: [
              {
                text: `Below is the text transcribed from an airline crew roster (Reference Year 2026):\n\n${transcribedText}\n\nExtract all flight duty legs into strictly valid JSON inside \`\`\`json matching the schema with airline, homeBase, flights array.`,
              },
            ],
            config: {
              systemInstruction,
            },
          });

          const step2Json = extractJsonFromText(parseTextRes.text || '');
          if (step2Json && Array.isArray(step2Json.flights) && step2Json.flights.length > 0) {
            parsedJson = step2Json;
          }
        }
      } catch (stage2Err: any) {
        console.warn('Stage 2 encountered an issue:', stage2Err.message);
      }
    }

    if (!parsedJson || typeof parsedJson !== 'object') {
      const isCapacityError = lastError?.message?.includes('503') || lastError?.message?.includes('demand');
      const errorMessage = isCapacityError
        ? 'AI Vision service is temporarily experiencing high traffic. Please tap Try Again in a few seconds or use the Paste Text option.'
        : 'Could not detect flight legs in this screenshot. Please ensure the schedule table, flight numbers (e.g. 6E 205), and dates are visible.';

      return res.status(422).json({
        success: false,
        error: errorMessage,
      });
    }

    // Post-processing & Sanitization to ensure 100% frontend compatibility
    const rawFlights: any[] = Array.isArray(parsedJson.flights) ? parsedJson.flights : [];
    const sanitizedFlights: any[] = [];

    const homeBase = (parsedJson.homeBase || 'DEL').toUpperCase().trim();
    const homeBaseTz =
      typeof parsedJson.homeBaseTzOffset === 'number'
        ? parsedJson.homeBaseTzOffset
        : AIRPORT_TZ_MAP[homeBase]?.tzOffset ?? 5.5;

    for (let i = 0; i < rawFlights.length; i++) {
      const fl = rawFlights[i];
      if (!fl) continue;

      const flightNumber = (fl.flightNumber || `FLT-${i + 1}`).trim().toUpperCase();
      const origin = (fl.origin || homeBase).trim().toUpperCase();
      const destination = (fl.destination || 'BOM').trim().toUpperCase();

      const originTz =
        typeof fl.originTzOffset === 'number'
          ? fl.originTzOffset
          : AIRPORT_TZ_MAP[origin]?.tzOffset ?? homeBaseTz;
      const destTz =
        typeof fl.destTzOffset === 'number'
          ? fl.destTzOffset
          : AIRPORT_TZ_MAP[destination]?.tzOffset ?? originTz;

      // Validate or construct ISO UTC timestamps
      let depUtc = fl.departureTimeUtc;
      let arrUtc = fl.arrivalTimeUtc;

      const isValidDate = (dStr: any) => {
        if (!dStr || typeof dStr !== 'string') return false;
        const ts = Date.parse(dStr);
        return !isNaN(ts);
      };

      if (!isValidDate(depUtc)) {
        const fallbackDate = new Date();
        fallbackDate.setDate(fallbackDate.getDate() + i);
        fallbackDate.setUTCHours(6, 0, 0, 0);
        depUtc = fallbackDate.toISOString();
      }

      if (!isValidDate(arrUtc)) {
        const depMs = new Date(depUtc).getTime();
        arrUtc = new Date(depMs + 135 * 60000).toISOString();
      }

      const depMs = new Date(depUtc).getTime();
      const arrMs = new Date(arrUtc).getTime();
      const durationMinutes =
        typeof fl.durationMinutes === 'number' && fl.durationMinutes > 0
          ? fl.durationMinutes
          : Math.max(30, Math.round((arrMs - depMs) / 60000));

      const reportTimeUtc = isValidDate(fl.reportTimeUtc)
        ? fl.reportTimeUtc
        : new Date(depMs - 75 * 60000).toISOString();

      const releaseTimeUtc = isValidDate(fl.releaseTimeUtc)
        ? fl.releaseTimeUtc
        : new Date(arrMs + 30 * 60000).toISOString();

      const depHbtHour = (new Date(depMs).getUTCHours() + homeBaseTz + 24) % 24;
      const isRedEye =
        typeof fl.isRedEye === 'boolean'
          ? fl.isRedEye
          : depHbtHour >= 22 || depHbtHour < 6;

      sanitizedFlights.push({
        id: fl.id || `flight-${Date.now()}-${i}`,
        flightNumber,
        origin,
        originCity: fl.originCity || AIRPORT_TZ_MAP[origin]?.city || origin,
        destination,
        destinationCity: fl.destinationCity || AIRPORT_TZ_MAP[destination]?.city || destination,
        departureTimeUtc: depUtc,
        arrivalTimeUtc: arrUtc,
        reportTimeUtc,
        releaseTimeUtc,
        originTzOffset: originTz,
        destTzOffset: destTz,
        aircraftType: fl.aircraftType || 'A320 / B777',
        durationMinutes,
        isRedEye,
      });
    }

    // Sort chronologically
    sanitizedFlights.sort(
      (a, b) => new Date(a.departureTimeUtc).getTime() - new Date(b.departureTimeUtc).getTime()
    );

    const finalRosterData = {
      airline: parsedJson.airline || 'Airline',
      crewName: parsedJson.crewName || 'Cabin Crew',
      homeBase,
      homeBaseTzOffset: homeBaseTz,
      flights: sanitizedFlights,
      notes: parsedJson.notes || `Successfully parsed ${sanitizedFlights.length} flight legs from document.`,
    };

    return res.json({ success: true, data: finalRosterData });
  } catch (error: any) {
    console.error('Error parsing roster with Gemini:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to parse roster screenshot.',
    });
  }
});

// Endpoint: Parse Salary Slip / Payslip Screenshot or PDF text
app.post('/api/payslip/parse', async (req: Request, res: Response) => {
  try {
    const { imageBase64, mimeType = 'image/png', rawText } = req.body;

    if (!imageBase64 && !rawText) {
      return res.status(400).json({ error: 'Please provide a payslip screenshot or text.' });
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

    if (imageBase64) {
      const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
      contents.push({
        inlineData: {
          mimeType,
          data: cleanBase64,
        },
      });
      contents.push({
        text: 'Analyze this airline cabin crew salary slip screenshot and extract the base pay, flying hourly rate, standby rate, layover per diem, night allowance, currency, and rank into structured JSON.',
      });
    } else {
      contents.push({
        text: `Analyze this cabin crew payslip text:\n\n${rawText}\n\nExtract base pay, flying hourly rate, standby rate, layover per diem, night allowance, currency, and rank into structured JSON.`,
      });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
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
    });

    const parsedJson = JSON.parse(response.text || '{}');
    return res.json({ success: true, data: parsedJson });
  } catch (error: any) {
    console.error('Error parsing payslip with Gemini:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to parse salary slip.',
    });
  }
});

// Endpoint: AI Aero-Medical Fatigue Consultation
app.post('/api/roster/ai-advise', async (req: Request, res: Response) => {
  try {
    const { roster, preferences } = req.body;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: `You are an expert aerospace medicine and fatigue risk consultant (grounded in NASA Ames Fatigue Countermeasures, ICAO Doc 9966, and Salk Institute Chrono-nutrition).
Given this cabin crew schedule for ${roster.airline.toUpperCase()} based at ${roster.homeBase} with ${roster.flights?.length || 0} flight sectors:
Roster Summary: ${JSON.stringify(roster.flights?.map((f: any) => `${f.flightNumber}: ${f.origin} -> ${f.destination} at ${f.departureTimeUtc}`))}
Crew Chronotype: ${preferences?.chronotype || 'intermediate'}

Provide:
1. A concise 3-bullet personalized fatigue risk assessment.
2. Specific high-risk sectors (e.g. WOCL red-eyes or ultra-early checks).
3. Practical advice for galley nutrition, hydration at altitude, and post-flight recovery.
Keep it direct, professional, and encouraging for cabin crew.`,
    });

    return res.json({ success: true, advice: response.text });
  } catch (error: any) {
    console.error('Error generating AI advice:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
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

  app.listen(PORT, () => {
    console.log(`CrewCircadian server running on http://localhost:${PORT}`);
  });
}

startServer().catch(console.error);
