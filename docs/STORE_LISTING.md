# Store listing (draft)

> Draft for the App Store and Google Play. Wording follows the Product Constitution: wellness only, no medical or
> fitness-for-duty claims, no airline or regulator names used as endorsements. Review with the lawyer before submitting.

## Basics

| Field | Draft |
|---|---|
| App name | CrewCircadian |
| Subtitle (App Store, 30 characters) | Sleep planner for cabin crew |
| Short description (Play, 80 characters) | Your roster, turned into a calm plan for sleep, naps, caffeine and meals. |
| Category | Health & Fitness (secondary: Travel) |
| Age rating | 17+ / 18+ (the app is for working crew; Gemini's terms require 18+) |
| Price | Free (a paid tier is planned later; nothing safety-related will ever be paid) |
| Keywords (App Store) | cabin crew, roster, sleep, jet lag, fatigue, flight attendant, nap, caffeine, shift work, layover |

## Full description

Rest that fits your roster.

CrewCircadian is built for airline cabin crew. Add your roster (a screenshot, a PDF or pasted text), check it once,
and the app plans around every duty:

• When to wake, leave home and check in, worked out from your own getting-ready and travel times
• Sleep before early starts and recovery sleep after night duties
• Naps that fit, and when to stop caffeine so it doesn't spoil your sleep
• Meals around night duties, light and dark on layovers
• A wake-up alarm before each duty, and gentle reminders you choose

Calm by design: one next step at a time, plain words, and a "Why?" behind every suggestion with the research it
comes from. Times from your roster are exact; body-clock advice is an honest guide.

Your data stays on your phone. No ads, no account, no tracking, and nothing is ever shared with your airline.
When you choose to read a roster with AI, the image is sent to Google Gemini only to be read.

Also: delays, standby callouts and cancellations in one tap; a monthly view of flying hours, duty hours and days
off; and notes worth a look when a roster seems to break DGCA duty limits.

If you feel fatigued, follow your airline's fatigue procedure, whatever this app shows. CrewCircadian is a wellness
guide. It is not a medical device and does not assess fitness for duty. Not affiliated with any airline.

## Privacy answers (to confirm with the lawyer)

| Question | Answer |
|---|---|
| Data collected by the developer | None stored. Roster images or text the person chooses to read are sent through our server to Google Gemini and not kept by us |
| Apple "Data Used to Track You" | No |
| Apple "Data Linked to You" | No |
| Play "Data shared" | Roster images/text with Google (service provider) for reading, only when the person asks |
| Play "Processed ephemerally" | Yes (not stored on our server) |
| Encryption in transit | Yes (HTTPS) |
| Deletion | Settings → Delete all my data (on the device; nothing kept on the server) |
| Privacy policy URL | Needed: publish `docs/PRIVACY_POLICY_DRAFT.md` after review |

## Permissions to explain in review notes

| Permission | Why |
|---|---|
| Notifications | Reminders the person switches on (leave, wind down, last caffeine) |
| Alarms (iOS AlarmKit; Android exact alarms) | The wake-up alarm before a duty, so it rings even on silent |
| Run at start-up (Android) | Puts saved wake-up alarms back after the phone restarts |

## Screenshots

`docs/store/ios/` (1320 × 2868, iPhone 6.9") and `docs/store/android/` (1080 × 2400), taken with the built-in sample
roster (no real person's data): Today, Days, Sleep, Month, Reminders.

## Before submitting

Company and developer accounts, privacy policy published at a web address, app icon at 1024 × 1024 (`assets/icon-only.png`),
a support email, review notes with a demo (the sample roster needs no login), and a final check on a real phone.
