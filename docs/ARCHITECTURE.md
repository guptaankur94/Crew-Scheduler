# CrewCircadian architecture

Read this before changing the app. It says what each part does, where it runs, what works offline, and which
changes reach installed phones by live update versus a new store build.

## The big picture

```
┌───────────────── PHONE (works offline) ─────────────────┐        ┌──── RENDER SERVER (online) ────┐
│ Native shell  (ios/, android/)                           │        │ server.ts + server/            │
│   alarms · reminders · Android widget · "Share to app"   │        │   1. Roster reading (Gemini    │
│ Screens + brain  (src/ → built into ~320 KB of files)    │ ─────► │      key lives here only)      │
│   all screens · all calculations · all rules             │ ◄───── │   2. Live updates (/updates/)  │
│ Saved data: on the phone only (no database)              │        │   3. Website version of app    │
└──────────────────────────────────────────────────────────┘        └────────────────────────────────┘
Laptop only (never on a phone or server): tests/, scripts/, docs/, reports/, research_notes/
```

- **Stack:** React 19 + TypeScript (screens and calculations), Vite (build), Tailwind (styles), Capacitor 8 (wraps the
  web code as iPhone and Android apps), Swift (iPhone native parts), Java (Android native parts), Node.js + Express
  (server), Google Gemini (roster reading).
- **No database and no accounts.** Each person's roster, plan and settings stay on their own device.
- **Hosting:** Render, Docker, Singapore region, deploys automatically from `main` on GitHub.

## What uses the internet (checked 2026-10-21)

Only two features. Everything else works offline.

| Feature | Code | Offline behaviour |
|---|---|---|
| Reading a roster screenshot or text (server asks Gemini) | `src/components/views/UploadView.tsx` via `apiFetch` in `src/services/platform.ts` | Clear message; "Read with your own AI app" still works (the pasted answer is read on the device) |
| Live-update check | `src/services/liveUpdate.ts` (+ the `@capgo/capacitor-updater` plugin) | Skipped; the app keeps the version it has |

No analytics, ads or third-party trackers. The update plugin's own statistics are switched off
(`capacitor.config.json` → `CapacitorUpdater.statsUrl: ""`).

## Live updates vs new builds

| Change in… | Reaches installed apps by |
|---|---|
| `src/` (screens, calculations, rules, wording) | **Live update**: push to `main` → Render rebuilds and packs `/updates/` → the app downloads in the background, verifies the SHA-256 checksum and switches on the next background/reopen. A version that fails to start rolls back. |
| `server.ts`, `server/` | Render redeploy on push (no app change needed) |
| `ios/`, `android/`, `capacitor.config.json`, new Capacitor plugins, permissions, icons | **New build** (TestFlight / Play upload) |

When a change needs both, ship the new build first and the live update after, so an older app never receives
code it cannot run.

## 1. Phone app: screens and calculations (`src/`)

### Start-up and frame
| File | Role |
|---|---|
| `main.tsx` | Loads saved data from the device, renders the app, starts live updates |
| `App.tsx` | Holds roster, settings and the person's updates; switches Duty · Month · Rosters · Settings; syncs reminders and the widget |
| `index.css` | Styles |
| `types/circadian.ts` | Shared data shapes: flight, roster, standby, plan, settings |

### Calculations
| File | Role |
|---|---|
| `services/planEngine.ts` | **Core engine**: sleeps, naps, caffeine, meals, light, alarms across the whole roster |
| `services/circadianCalculator.ts` | Builds the full plan around the engine; holds the rule sources (`CITATIONS`, rule IDs) |
| `services/dutyTimes.ts` | Check-in and sign-off belong to the duty; a duty belongs to its check-in day |
| `services/rosterTimes.ts` | Times as printed (local, home or UTC) → exact times |
| `services/periodStats.ts` | Month totals: flying and duty hours (h:mm), days off, standby |
| `services/hoursReport.ts` | Day-by-day hours report and CSV |
| `services/payEstimate.ts`, `services/salary.ts` | Pay from the person's own rates; standby hours |
| `services/dutyLimits.ts` | DGCA duty-limit "worth a look" flags (a guide, not a compliance check) |
| `services/reminders.ts` | Which reminders to send and when (never during sleep, opt-in) |
| `services/nowNext.ts` | "Now" and "Next" at the top of the Duty screen |
| `services/planChanges.ts` | "Your plan changed" after an update |
| `services/monthDays.ts` | One line per day for the Month list |
| `services/widgetSteps.ts` | Next steps for the home-screen widgets (Android and iPhone) |

### Roster handling
| File | Role |
|---|---|
| `services/rosterPrompt.ts` | AI reading instructions (shared by the server and "Read with your own AI app") |
| `services/pastedRoster.ts` | Reads an answer pasted from the person's own AI app, on the device |
| `services/rosterChecks.ts`, `services/rosterFindings.ts` | Doubtful rows and days (wrong time zone, long release, blank days) |
| `services/rosterDiff.ts` | New upload vs saved roster ("What changed?") |
| `services/rosterKeys.ts` | Stable identity of flights and standbys |
| `services/rosterCodes.ts` | OFF, SBY, leave, sick, training codes |
| `services/rosterFiles.ts` | File type and image shrinking before upload |
| `services/importRecords.ts`, `services/importFingerprints.ts` | "Your rosters" list; recognising a file already uploaded |
| `services/userUpdates.ts` | The person's own changes (delays, cancellations, call-outs), kept apart from the roster |
| `services/manualFlight.ts` | A flight from typed times |
| `services/provenance.ts` | "Source: …" line for each flight |
| `services/rosterHistoryService.ts`, `services/historyCompact.ts` | Undo, restore, compact history |
| `services/readingEval.ts` | Reading-accuracy measurement (used by `scripts/reading-eval.ts`) |

### Saving and phone features
| File | Role |
|---|---|
| `services/kv.ts` | Where data lives: browser localStorage, or files in the app's private Library folder on phones |
| `services/fileStore.ts` | Original roster files kept on the device for "Re-read" (IndexedDB / Library folder) |
| `services/appStateStorage.ts` | Loading and saving the app state |
| `services/backup.ts` | Backup and restore (optional password protection) |
| `services/aiConsent.ts` | The "OK to send to Gemini" answer |
| `services/platform.ts` | Phone vs browser; server address (`VITE_API_BASE`); `apiFetch` |
| `services/liveUpdate.ts` | Live updates |
| `services/nativeReminders.ts` | Local notifications on the phone, with Snooze / I'm up buttons |
| `services/wakeAlarm.ts` | Native alarm (Android AlarmManager; iPhone AlarmKit on iOS 26+) |
| `services/sharedRosters.ts` | Files arriving via "Share → CrewCircadian" |
| `services/saveFile.ts` | Download (browser) or share sheet (phone) |
| `services/icsExport.ts` | Calendar file export (one-time, browser and phone) |
| `services/calendarSync.ts` | "Keep my phone calendar updated" (opt-in): a CrewCircadian calendar on the phone |
| `services/liveActivity.ts` | iPhone duty-day Live Activity: which duty, its steps and countdown |
| `services/feedback.ts` | "Send feedback": share sheet with version info, never roster data |
| `data/airports.ts` + `data/airportDb.json` | Offline database of airports and time zones |
| `data/rosterPresets.ts` | Sample rosters |
| `utils/dateUtils.ts` | Date formatting |

### Screens (`src/components/`)
| Area | Files |
|---|---|
| Duty tab | `TimelineView.tsx` (the day as numbered steps), `views/RosterView.tsx`, `views/TodayPreview.tsx` (today's header), `TodayGlance`, `SleepCheck`, `PlanChangedCard`, `DayGuidance`, `DateNavigator`, `DelayCard`, `CancelFlightDialog`, `CalloutForm`, `StandbyCard`, `StandbyNotice`, `EventDetailModal` ("Why?") |
| Month tab | `views/MonthView.tsx`, `MonthSummary`, `HoursReportDialog`, `PayEstimateCard`, `DayPanel` |
| Rosters tab | `views/UploadView.tsx`, `RosterReviewDialog` (check before saving), `WhatChangedDialog`, `UploadedRosters`, `FilePreviewModal`, `AiConsentDialog`, `RecentChanges` |
| Settings and science | `views/SettingsView.tsx`, `SleepSettings`, `RemindersSettings`, `views/ScienceView.tsx` + `ScienceLab` |
| Frame | `Header` (calendar export, backup), `Sidebar`, `Onboarding`, `ErrorBoundary`, `TimeInput24` |

## 2. Phone app: native shell (needs a new build to change)

| File | Role |
|---|---|
| `capacitor.config.json` | App ID, notification icon, status bar, live-update settings |
| `android/app/src/main/java/com/crewcircadian/app/MainActivity.java` | Starts the app, registers our plugins |
| `…/WakeAlarmPlugin.java`, `WakeAlarmReceiver.java`, `WakeAlarmStore.java`, `WakeAlarmBootReceiver.java` | Native alarm (alarm volume, survives restarts) |
| `…/NextStepWidget.java`, `NextStepWidgetPlugin.java` | Android home-screen widget |
| `…/SharedRosterPlugin.java` | "Share → CrewCircadian" |
| `ios/App/App/AppDelegate.swift`, `SceneDelegate.swift`, `MainViewController.swift` | Start the app, register plugins (SceneDelegate must use `MainViewController`) |
| `ios/App/App/WakeAlarmPlugin.swift` | Alarm via AlarmKit (iOS 26+); not yet tested on a real iPhone |
| `ios/App/App/NextStepWidgetPlugin.swift` | iPhone widget data (`setSteps`) and the Live Activity (`showDuty` / `endDuty`) |
| `ios/App/App/CrewShared.swift` | Shared by app and widget: App Group ID, step format, Live Activity data |
| `ios/App/NextStepWidget/` | The widget extension: home/lock-screen widget (`NextStepWidget.swift`), Live Activity (`DutyLiveActivity.swift`) |
| `ios/App/App/App.entitlements`, `NextStepWidget.entitlements` | App Group `group.com.crewcircadian.app` |
| `PrivacyInfo.xcprivacy` (app and widget) | Apple privacy manifests: no tracking; roster content only to read it |
| `ios/App/CapApp-SPM/Package.swift` | Capacitor plugins in the iPhone build (updated by `npx cap sync ios`) |

Not built yet on iPhone: Share extension (sharing from Photos). Raise the build number before each tester build
(installed apps keep their last live update until it changes).

## 3. Server (Render, online only)

| File | Role |
|---|---|
| `server.ts` | `/api/roster/parse` (roster reading), `/updates/` (live updates), and the website |
| `server/rosterSanitizer.ts` | Checks and cleans the AI's answer (also used on the device for pasted answers) |
| `server/security.ts` | Security headers, allowed origins (the phone apps are always allowed) |
| `server/rateLimit.ts` | Request limits and the daily AI cap |
| `server/upload.ts` | File checks; pulls JSON out of AI answers |
| `Dockerfile` | Build → `npm run bundle:update` → start |
| Settings (Render dashboard, or `.env` on a laptop) | `GEMINI_API_KEY`, `NODE_ENV`, `HOST`, `PORT`, `TRUST_PROXY`, `GEMINI_DAILY_LIMIT`, optional `ALLOWED_ORIGINS`, `GEMINI_MODELS`. The key is never in Git or in the app. |

## 4. Laptop only

| Item | Role |
|---|---|
| `package.json` | Dependencies and commands (below) |
| `vite.config.ts`, `tsconfig.json`, `index.html`, `public/` | Build settings, start page, icon, install manifest |
| `scripts/make-update-bundle.mjs` | Packs live updates into `dist-update/` |
| `scripts/rulebook.ts` | Writes `docs/RULE_BOOK.md` from the rules in the code (`npm run rulebook`) |
| `scripts/reading-eval.ts` | Measures roster-reading accuracy |
| `scripts/build-airport-db.py` | Rebuilds the airport database |
| `tests/` | Node test runner; includes "golden" tests on a real roster with made-up flight numbers |
| `docs/` | Phone-app guide, hosting, privacy draft, store listing and screenshots, rule book, this file |
| `reports/`, `research_notes/` | Research behind product decisions |
| `assets/` | Source images for app icons |

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Local app + server at http://localhost:3000 (needs `.env`) |
| `npm run check` | Type check + all tests + build. **Run before every commit.** |
| `npm run app:sync` | Build and copy into the iPhone and Android projects |
| `npm run rulebook` | Regenerate the rule book after changing `CITATIONS` |

## Working rules

- Work on `main` and push when a piece of work is finished; the owner also works through Claude on his phone,
  which reads `main` on GitHub.
- Never commit real people's data (backups, rosters, screenshots); `.gitignore` blocks the common file types.
  Tests use made-up flight numbers.
- Never put the Gemini key in code, the app or chat.
- Do not remove or hide an existing feature without the owner's explicit approval (show a table first).
- Every piece of advice in the plan carries a rule ID and source in `CITATIONS`; keep the rule book in step.
