# Building the phone app

The iPhone and Android apps wrap the same web app with [Capacitor](https://capacitorjs.com) 8. Projects: `ios/`, `android/`.

## One-time set-up (on a Mac)

1. **iPhone:** install **Xcode** from the Mac App Store (large download), open it once to accept the licence, then
   `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer`. An Apple Developer account
   (US$99 a year, as a company for health and travel apps) is needed to put the app on the App Store or on testers' phones.
2. **Android:** install **Android Studio**, and from its SDK Manager the latest Android SDK. A Google Play developer
   account (US$25 once, an organisation account for health apps) is needed to publish.

## Build and run

```bash
# The phone app reaches the roster reader on the hosted server
echo 'VITE_API_BASE=https://YOUR-SERVER' > .env.production.local
npm run app:sync          # builds the web app and copies it into ios/ and android/
npx cap open ios          # or: npx cap open android, then press Run
```

## The hosted server

Run `npm start` on the host with these settings (never commit them):

| Setting | Value |
|---|---|
| `GEMINI_API_KEY` | A **paid** Gemini API key (the free tier lets Google use submitted content) |
| `NODE_ENV` | `production` (turns on the security headers) |
| `HOST` | `0.0.0.0` |
| `TRUST_PROXY` | `1` when behind the host's proxy, so rate limits see real visitors |
| `ALLOWED_ORIGINS` | The web address of the hosted web app, if any (the phone app is always allowed) |
| `GEMINI_DAILY_LIMIT` | Daily cap on AI reads (default 200) |

## What works only in the phone app

- Data is saved as files in the app's private folder (`src/services/kv.ts`), which the phone does not clear.
- Reminders are scheduled as local notifications (`src/services/nativeReminders.ts`). A wake alarm that rings
  through Silent mode needs a native alarm module (iOS AlarmKit, Android exact alarms): still to do.

## Still to do for the phone (Phase 1b)

Share sheet ("Share → CrewCircadian"), native alarms, app icons and splash screens, store listings and screenshots,
privacy labels (see `docs/PRIVACY_POLICY_DRAFT.md`), and testing on real phones.
