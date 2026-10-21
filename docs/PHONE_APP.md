# Building the phone app

The iPhone and Android apps wrap the same web app with [Capacitor](https://capacitorjs.com) 8. Projects: `ios/`, `android/`.
Beginner's step-by-step guide (with where to click): see the guide page linked in the project notes.

## Set up on this Mac (done)

- **Xcode 27** with the iOS 27 simulator runtime. Note: this Xcode has no **Simulator** window app at the usual place
  (`Xcode.app/Contents/Developer/Applications/Simulator.app`). Simulated iPhones run, but you cannot see one until the
  Simulator app is installed (try Xcode → Settings → Components, or Xcode → Open Developer Tool → Simulator).
- **Android SDK** in `~/Library/Android/sdk` (Android 36, build tools, emulator) and a virtual phone **CrewPixel**.
  Android Studio uses Java 25; the project's Gradle is 9.1 and fetches Java 21 automatically for plugins that need it.

## Everyday commands

| Command | What it does |
|---|---|
| `npm run app:sync` | Builds the web app and copies it into `ios/` and `android/` |
| `npx cap open ios` / `npx cap open android` | Opens the project in Xcode / Android Studio (then press ▶) |
| `npm run dev` then `npm run phone:live:android` | Runs the app on the Android emulator straight from the development server: changes appear without rebuilding |
| `npm run phone:live:ios` | The same for iPhone (needs the Simulator app) |
| `npm run phone:release-sync` | Puts the normal build back after live reload (always before a release) |

The Android app file is built at `android/app/build/outputs/apk/debug/app-debug.apk`: copy it to an Android phone
to install a test version (allow "install unknown apps" for the app you open it with).

For a build that reads rosters on a real phone, point it at the hosted server first (see `docs/HOSTING.md`):
`echo 'VITE_API_BASE=https://YOUR-SERVER' > .env.production.local`, then `npm run app:sync`.

## What only the phone app does

| Feature | Android | iPhone |
|---|---|---|
| Data saved as files the phone does not clear (`kv.ts`, `fileStore.ts`) | Yes | Yes |
| Wake-up alarm that rings on silent (`WakeAlarm` plugin) | Yes: AlarmManager alarm clock, alarm volume, repeats until dismissed, restored after restart. Tested on the emulator | Yes on iOS 26+: AlarmKit. Bridge tested; the ring needs one "Allow" tap on a visible simulator or a phone (see below) |
| Reminders (leave, wind down, last caffeine) | Notifications with buttons ("Snooze 10 min", "I'm up"); buttons registered, tested on the emulator | Same (not yet seen on a device) |
| Keep my phone calendar updated (opt-in, `calendarSync.ts`) | Yes: a "CrewCircadian" calendar; tested on the emulator | Yes (same plugin; not yet tested on a device) |
| Share → CrewCircadian | Yes, from any app (images and PDFs). Tested | "Open in CrewCircadian" for images and PDFs from Files, Mail, WhatsApp documents. From **Photos** needs a share extension (needs the Apple developer team) |
| Saving files (calendar, backup, hours report) | Share sheet | Share sheet |
| Home-screen widget (next step) | Yes (long-press the home screen → Widgets → CrewCircadian) | Yes: home screen (small, medium) and lock screen, WidgetKit extension `ios/App/NextStepWidget/`; data via the App Group. Built and checked in the Simulator |
| Duty-day Live Activity (lock screen + Dynamic Island countdown) | — | Yes (`liveActivity.ts`, `DutyLiveActivity.swift`): from 3 h before wake-up to sign-off. Checked in the Simulator |
| Live updates of the screens and calculations (`liveUpdate.ts`) | Yes; tested end to end, online and offline | Yes (same plugin; not yet tested on a device) |
| Light status-bar icons on the dark app | Capacitor `SystemBars` style DARK | Automatic |

### Testing the iPhone alarm

1. Open the project in Xcode (`npx cap open ios`), choose an iPhone simulator (or your iPhone), and press ▶.
2. In the app: Settings → Reminders and alarms → switch on **Wake-up alarm before each duty** → **Allow** when iOS asks.
3. Quick test without waiting for a duty: in Xcode, **Product → Scheme → Edit Scheme → Run → Arguments**, add
   `-wakeAlarmSelfTest`, press ▶: a test alarm rings 45 seconds after launch (development builds only).

### Testing the widget and Live Activity in the Simulator

Development builds launched with `-liveActivitySelfTest` give the widget four test steps and start a test duty Live
Activity (see `MainViewController.swift`). Open another app to see the countdown in the Dynamic Island.

## Before every build you send to testers: raise the version

Installed apps keep the last live update they downloaded until the **build number** changes. Before each TestFlight
or Play upload, raise it:

- iPhone: Xcode → App target → General → **Build** (and the same number on the NextStepWidgetExtension target).
- Android: `android/app/build.gradle` → `versionCode` (+1) and `versionName`.

When a change needs a new build and a live update, ship the build first.

## When the Apple developer account is ready

1. Xcode → open `ios/App/App.xcodeproj` (`npx cap open ios`).
2. Select the **App** target → **Signing & Capabilities** → Team: your account. Xcode registers the bundle ID
   `com.crewcircadian.app`.
3. Same for the **NextStepWidgetExtension** target (bundle ID `com.crewcircadian.app.widget`).
4. On both targets, check **App Groups** shows `group.com.crewcircadian.app` ticked (it is in the entitlements files;
   Xcode registers it with Apple when the team is set). Without it the widget shows "Open the app".
5. Plug in your iPhone (iOS 26+ for the alarm), choose it at the top, press ▶. Test: alarm, widget, Live Activity,
   calendar, reminder buttons.
6. TestFlight: Product → Archive → Distribute App → App Store Connect. Then in App Store Connect → TestFlight, add
   testers by email (the first external build needs Apple's beta review, about a day).

## Still to do

iOS share extension (sharing from the Photos app; "Open in" already works), App Store and Play Store listings
(drafts in `docs/STORE_LISTING.md`), crash reports and anonymous usage counts (need a service account).
