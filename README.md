# CrewCircadian

A calm rest planner for airline cabin crew. Upload a roster (screenshot, PDF or pasted text), check it once, and the app builds a sleep, nap, caffeine, light and meal plan around your duties, with flying and duty hours for the month. Product rules: see the Product Constitution; the advice rules are in `docs/RULE_BOOK.md`.

> This app gives general wellbeing guidance. It is not medical advice and does not replace your airline's fatigue-management rules or duty-time limits.

## Run it on your computer

You need [Node.js](https://nodejs.org) 22 or newer.

```bash
npm install            # download the libraries (first time only)
cp .env.example .env   # create your private settings file (first time only)
npm run dev            # start the app
```

Open http://localhost:3000. Stop the app with `Ctrl + C`.

The sample roster and all planning screens work straight away. To read your own roster with AI, create a free key at https://aistudio.google.com/apikey, paste it into `.env` as `GEMINI_API_KEY="..."`, and restart the app. Keep `.env` private; it is excluded from git.

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
- **AI**: Google Gemini only reads rosters; it never writes advice. It is never trusted blindly: a flight whose date, time or airport cannot be read is left out and reported to you, never guessed.

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

- **An upload is a new version of the schedule, reconciled day by day** (`src/services/rosterDiff.ts`, tests in `tests/rosterDiff.test.ts`):
  - *Identity* comes from content, never row position: a flight is home departure date + flight number + route (`src/services/rosterKeys.ts`). Times are not part of identity; they are what changes.
  - *Scope*: an upload only changes the dates it visibly shows (the reader returns `visibleDates`). A partial screenshot with a whole-month header updates only its own dates unless the person chooses otherwise; a saved day the upload says nothing about is asked about, never assumed free.
  - *Newer roster wins* on in-scope dates: matching flight by flight is not enough, because a re-planned day rarely overlaps the old one in time (this once made October show 59.9h instead of 49.9h).
  - *Idempotent*: the same roster uploaded again finds no changes and saves nothing; an already-imported file is recognised before it is sent to the AI (`src/services/importFingerprints.ts`).
  - *Conservative*: differences that look like reading errors (≤5 min, one character) keep the saved value; flights the person added are kept unless they remove them; sleep adjustments are kept except next to changed days.
  - Duties, the plan and all totals are recalculated from the saved items, never stored, so they cannot be duplicated.
- **The roster is never edited by what the person reports.** Delays, cancelled flights, standby changes (times moved, released early, cancelled) and callouts are stored as separate updates keyed to the flight or standby (`src/services/userUpdates.ts`) and applied on top only when planning. A delay moves departure, arrival and release but never the rostered report time; a callout ends the standby at the callout's report time, so nothing is counted twice. Re-uploading the same roster therefore finds no changes; a newer roster keeps an update while what it refers to is still on the roster, and retires a callout once the roster itself shows its flights.
- **Every roster change is recorded once and the newest can be undone** (`commitChange` in `src/App.tsx`, `undoableEntry` in `src/services/rosterHistoryService.ts`); each uploaded item records its source so the app can say why it believes a duty exists (`src/services/provenance.ts`).
- **The plan is always recalculated in full; only the explanation is selective.** After any update, the plan before and after is compared and Today shows what moved (30 minutes or more, sleeps or naps added or removed, a different kind of duty), never past days (`src/services/planChanges.ts`). A delay carries through the rest of its duty using the planner's own 6-hour duty rule, so a duty that runs past midnight is still one duty.
- **Duty limits are a guide, taken from the DGCA text itself** (`src/services/dutyLimits.ts`): CAR 7-J-I Issue IV (in force since 1 Nov 2018) by default, and the October 2025 draft Issue V as a labelled preview. Every number carries its paragraph reference; secondary summaries disagreed with the text (e.g. on airport standby), so they are not used. The check uses the roster as published plus recorded callouts, cancellations and standby changes, not delays, and says plainly what it does not check.
- **Times are read exactly as printed, then converted by the app** (`src/services/rosterTimes.ts`). The reader copies clock times and dates; the app converts them with the airport reference list and the clock the roster uses: each airport's local time (default), home-base time or UTC, as stated on the roster or chosen by the crew member (Settings, or on the upload check screen). Printed times are kept on each flight, so they can be re-read if the clock was wrong.
- **The Month screen is where crew check the roster.** Each day shows anything doubtful (`src/services/rosterFindings.ts`: reading checks, duty limits, blank days when the roster lists days off) with a ⚠ line; a day panel lets the person fix it (one-tap fixes where possible, or edit flights, standby and the kind of day), tick "Looks right" (dropped automatically if the day changes later), or open the day in the Timeline. Corrections change the roster itself, are marked "corrected by you", and have history and Undo.
- **Check-in belongs to the first sector of a duty and debrief to the last** (`src/services/dutyTimes.ts`). Rosters print one of each per duty; sectors in between are turnarounds with no check-in or release of their own. Applied when a roster is read, before comparing uploads, and on every saved change; saved rosters from earlier versions are repaired once.
- **Rosters page: upload, then Re-read or Remove** (`src/components/UploadedRosters.tsx`, `src/services/importRecords.ts`). Each upload is remembered with what it read and its original files are kept on this device (`src/services/fileStore.ts`, IndexedDB, size-capped, deletable in Settings). Each roster owns its own dates (a newer roster wins dates both cover). **Re-read** is a clean slate for those dates: the kept file is read again (or, if it was not kept, what was read at upload is used); manual corrections on those dates go, delays and callouts stay. **Remove** takes those dates out of the plan and deletes the kept file; Undo brings both back. The full change history, with restore to an earlier point, is in Settings.
- **Totals count flights by their home-time departure date**, and positioning flights are not flying hours or sectors (`src/services/periodStats.ts`).
- **Countries are compared by ISO code from the airport database**, never by name (`airportCountryCode` in `src/data/airports.ts`).

## Privacy

Files and text you upload are sent to Google Gemini to be read. Nothing is stored on the server. Crop out anything you do not want to share, such as bank details or ID numbers.

## Known limitations

- Airport time zones come from an offline list of about 8,000 airports (`src/data/airportDb.json`, rebuilt with `scripts/build-airport-db.py`). A flight at an airport not on the list is flagged and cannot be saved until the code is corrected; the app never guesses a time zone.
- The home base uses one UTC offset for the whole roster, so a home base that observes daylight saving can be an hour out across a clock change.
- The server has no login. It is safe on your own computer, but add authentication before hosting it on the public internet.
- Mobile packaging (`capacitor.config.json`) is not set up yet: a phone build needs the server hosted online first.
- **Every piece of advice comes from a numbered rule** (`CITATIONS` in `src/services/circadianCalculator.ts`) with an evidence grade (strong, moderate, limited, practical, regulation), shown in its Why? sheet. `npm run rulebook` writes `docs/RULE_BOOK.md` for review by a sleep physician; a test fails if the file is out of date.
- **Caffeine cut-off follows the usual amount** (Settings): 6 h for one coffee or a few cups of chai, 8 h for two coffees, 12 h for more (Gardiner et al. 2025), plus 2 h before a daytime sleep (our stated margin). **No alcohol in the 12 h before check-in or a home standby** (DGCA). **Finish hard workouts 4 h before a night's sleep** (Leota et al. 2025).
- **Duty-limit notes never say "compliant"**. They are "worth a look" with the paragraph; the rule text carries a checked-on date and switches off if its 6-monthly re-check is more than 30 days overdue (`rulesStatus`).
- **Golden rosters** (`tests/golden.test.ts`, `tests/fixtures/golden-sep-oct-2026.json`): a real crew member's September and October rosters (names removed) pin down confirmed totals (October flying 49.9 h) and rules every plan must keep (no sleep over a duty, one check-in and one sign-off per duty, cut-offs end at a sleep). Plus a daylight-saving test for London.
- **No crew names are kept.** The reader no longer returns a name and names saved by earlier versions are dropped when the app loads.
