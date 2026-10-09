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
| Reminders (leave, wind down, last caffeine) | Notifications | Notifications |
| Share → CrewCircadian | Yes, from any app (images and PDFs). Tested | "Open in CrewCircadian" for images and PDFs from Files, Mail, WhatsApp documents. From **Photos** needs a share extension (needs the Apple developer team) |
| Saving files (calendar, backup, hours report) | Share sheet | Share sheet |
| Home-screen widget (next step) | Yes (long-press the home screen → Widgets → CrewCircadian) | Needs an App Group (Apple developer team) |
| Light status-bar icons on the dark app | Capacitor `SystemBars` style DARK | Automatic |

### Testing the iPhone alarm

1. Open the project in Xcode (`npx cap open ios`), choose an iPhone simulator (or your iPhone), and press ▶.
2. In the app: Settings → Reminders and alarms → switch on **Wake-up alarm before each duty** → **Allow** when iOS asks.
3. Quick test without waiting for a duty: in Xcode, **Product → Scheme → Edit Scheme → Run → Arguments**, add
   `-wakeAlarmSelfTest`, press ▶: a test alarm rings 45 seconds after launch (development builds only).

## Still to do (needs the Apple developer team)

iOS share extension (Photos share sheet), iOS widget, App Store and Play Store listings (drafts in
`docs/STORE_LISTING.md`), and signing for TestFlight / Play internal testing.
