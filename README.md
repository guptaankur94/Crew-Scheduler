# CrewCircadian

A fatigue, rest and pay planner for airline cabin crew. Upload a roster (screenshot, PDF or pasted text) and the app builds a sleep, nap, caffeine and meal plan around your flights, plus a salary estimate.

> This app gives general wellbeing guidance. It is not medical advice and does not replace your airline's fatigue-management rules or duty-time limits.

## Run it on your computer

You need [Node.js](https://nodejs.org) 22 or newer.

```bash
npm install            # download the libraries (first time only)
cp .env.example .env   # create your private settings file (first time only)
npm run dev            # start the app
```

Open http://localhost:3000. Stop the app with `Ctrl + C`.

The sample roster and all planning screens work straight away. To read your own roster or payslip with AI, create a free key at https://aistudio.google.com/apikey, paste it into `.env` as `GEMINI_API_KEY="..."`, and restart the app. Keep `.env` private; it is excluded from git.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Starts the app for development, reloading as you edit. |
| `npm test` | Runs the automated tests. |
| `npm run lint` | Checks the code for type errors. |
| `npm run build` | Builds the optimised version into `dist/`. |
| `npm start` | Serves the built version (run `npm run build` first). |

## How it fits together

- **Browser app** (`src/`): React + TypeScript + Tailwind CSS. All planning maths runs here, in `src/services/circadianCalculator.ts`. Your roster, settings and history are saved in this browser only (`localStorage`).
- **Server** (`server.ts`, `server/`): a small Express server. It keeps the Gemini key secret, sends uploads to Gemini, and validates what comes back before the browser sees it.
- **AI**: Google Gemini reads rosters and payslips. It is never trusted blindly: a flight whose date, time or airport cannot be read is left out and reported to you, never guessed.

| Path | Purpose |
|---|---|
| `server.ts` | API endpoints and web server. |
| `server/rosterSanitizer.ts` | Validates flights and pay figures returned by the AI. |
| `server/upload.ts`, `server/rateLimit.ts` | Upload handling and request limiting. |
| `src/App.tsx` | Top-level screen switching and app state. |
| `src/components/` | Screens and UI pieces. |
| `src/services/` | Planning logic, roster merging, saved state, calendar export. |
| `src/data/airports.ts` | Airports and daylight-saving-aware time zones. |
| `tests/` | Automated tests. |

### Rules that keep the numbers right

- **A newer roster wins for the days it covers.** When a roster is uploaded on top of a saved one, everything saved on the new roster's dates (flights, standby, days off) is replaced, not combined. The dates are the period printed on the roster, widened to the first and last entries found. The person sees exactly what will be replaced before saving and can keep the older entries. Matching flight by flight is not enough: a re-planned day rarely overlaps the old one in time, so old flights would stay and inflate monthly totals. Code: `uploadCoverage` and `splitByCoverage` in `src/services/rosterMerger.ts`; regression tests in `tests/rosterReplace.test.ts`.
- **Totals count flights by their home-time departure date**, and positioning flights are not flying hours or sectors (`src/services/periodStats.ts`).
- **Countries are compared by ISO code from the airport database**, never by name (`airportCountryCode` in `src/data/airports.ts`).

## Privacy

Files and text you upload are sent to Google Gemini to be read. Nothing is stored on the server. Crop out anything you do not want to share, such as bank details or ID numbers.

## Known limitations

- Airport time zones come from an offline list of about 8,000 airports (`src/data/airportDb.json`, rebuilt with `scripts/build-airport-db.py`). A flight at an airport not on the list is flagged and cannot be saved until the code is corrected; the app never guesses a time zone.
- The home base uses one UTC offset for the whole roster, so a home base that observes daylight saving can be an hour out across a clock change.
- The server has no login. It is safe on your own computer, but add authentication before hosting it on the public internet.
- Mobile packaging (`capacitor.config.json`) is not set up yet: a phone build needs the server hosted online first.
