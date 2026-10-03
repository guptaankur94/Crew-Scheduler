# Technology implementation options for CrewCircadian (roster ingestion, circadian engine, alerts, health data, storage, time zones, AI terms)

_Research date: 1–2 Oct 2026. Version context: iOS 27 / Safari 27.0 shipped on 17 Sep 2026 ([WebKit](https://webkit.org/blog/18325/webkit-features-for-safari-27-0/)), so the "iOS 26-era" APIs below (AlarmKit, Foundation Models, RecognizeDocumentsRequest) are now one release old. Current stable Capacitor plugins are v8, with v9 in the "next" docs ([Capacitor Local Notifications](https://capacitorjs.com/docs/apis/local-notifications); [Capacitor Health/Fitness](https://capacitorjs.com/docs/next/apis/health-fitness)). Some findings come from search-result snippets because the page itself blocked automated fetching; these are marked "(snippet)"._

## 1. Roster ingestion: export formats, how crew apps import, LLM vision reliability, structured output, human verification, on-device OCR

### Takeaway
There is no common open roster format. Crew systems mostly offer printouts from their web portals (PDF, HTML or CSV, and sometimes iCal). The market leader, RosterBuster (owned by CAE), combines parsers written for each system, sync using the crew member's portal login, manual PDF upload and email forwarding. Gemini's structured output guarantees JSON that matches the schema, not correct values, so the app must check every extracted roster in code and have the user confirm it. A privacy-first path is now realistic on recent phones: Apple Vision's `RecognizeDocumentsRequest` (OS 26+) reads tables on the device, ML Kit v2 reads lines of text on the device, and on-device language models can turn that text into structured data.

### Cited Findings
#### Crew-system export formats and vendor ownership
- **AIMS eCrew:** CrewLounge documents exporting the eCrew roster as a CSV file ("Export as CSV"). Where CSV export is missing, crew can save the HTM page instead. It warns that a CSV received from the company IT department is "NOT compatible" with its import wizard. An "ONLINE roster import method" also exists for compatible airlines. No iCal export is documented. — [CrewLounge: AIMS eCrew](https://support.crewlounge.aero/support/solutions/articles/24000033768-aims-ecrew-download-your-roster-logbook)
- Third-party tools convert AIMS CSV rosters to iCalendar for Outlook, Google and Apple calendars — [aims-convert docs](https://hursts.org.uk/aimsdocs/command_line.html); [boldi.org](https://www.boldi.org/) (snippet). The third-party iAIMS viewer exports to the calendar, LogTen and Jeppesen CrewAlert — [App Store: iAIMS](https://apps.apple.com/us/app/iaims-crew-roster-viewer/id777214609) (snippet).
- **Lufthansa Systems NetLine/Crew (CrewLink portal):** crew apps import CrewLink rosters in three ways:
  - by entering the crew portal username and password (OffBlock) — [OffBlock](https://offblock.zendesk.com/hc/en-us/articles/10505683293341-Netline-Crewlink-Roster-Import)
  - by parsing the PDF exported from CrewLink
  - by emailing the CrewLink PDF to RosterBuster for automatic import — [RosterBuster: Netline Crewlink](https://rosterbuster.zendesk.com/hc/en-us/articles/206092491-Netline-Crewlink) (snippet)

  FlightLog says it finds NetLine rosters in the user's calendar — [FlightLog](https://flightlog.io/docs/import-your-roster/) (snippet). Dedicated apps such as Crew Sync target NetLine/CrewLink (IADP) — [Google Play](https://play.google.com/store/apps/details?id=com.luxsam.crewsync&hl=en).
- **Sabre (CrewTrac/CrewConnect lineage):**
  - CAE agreed in Oct 2021 to buy Sabre's AirCentre airline-operations portfolio, which covers flight and crew management, for US$392.5M — [Sabre IR](https://investors.sabre.com/news-releases/news-release-details/cae-acquire-sabres-aircentre-airline-operations-portfolio). The deal completed in March 2022 — [CAE](https://www.cae.com/media-centre/press-releases/cae-concludes-acquisition-of-sabres-airline-operations-aircentre-portfolio).
  - RosterBuster has a separate "Sabre PDF" import article, meaning Sabre rosters are handled as PDFs — [RosterBuster: Sabre PDF](https://rosterbuster.zendesk.com/hc/en-us/articles/205950042-Sabre-PDF) (only the title was visible).
- **RosterBuster ownership:** CAE acquired RosterBuster (RB Group) in April 2021 — [AIN](https://www.ainonline.com/aviation-news/business-aviation/2021-04-06/cae-acquires-rosterbuster-crew-management-app). Together with AirCentre and Merlot, it forms CAE's Civil Flight Services portfolio — [CAE](https://www.cae.com/media-centre/press-releases/cae-concludes-acquisition-of-sabres-airline-operations-aircentre-portfolio) (snippet).
- **Jeppesen:**
  - NC Software's commercial schedule importer supports "Jeppesen Crew Access" and exports to iCalendar (.ics) — [NC Software](https://www.nc-software.com/jeppesen-crew-access-in-the-schedule-importer) (snippet).
  - CrewLounge CONNECT can push a roster to the Jeppesen CrewAlert app and export ICS files — [CrewLounge: export to CrewAlert](https://support.crewlounge.aero/support/solutions/articles/24000080991-export-your-roster-to-jeppesen-crewalert); [CrewLounge: export roster to calendar](https://support.crewlounge.aero/support/solutions/articles/24000058668-how-to-export-my-roster-to-calendar-).
- **IBS Software iFlight:** crew view their published roster in the vendor's own "iFlight Crew Mobile" app — [App Store](https://apps.apple.com/us/app/iflight-crew-mobile/id6503934662). No export format for third-party apps was found.

#### How RosterBuster and similar apps import rosters
- RosterBuster's App Store listing:
  - "Many roster formats supported: AIMS, eCrew, AirCrews, AviaBit, ASL, CAS, CrewDock, CrewConnex, KEOPS, Flica, Leon, Meridian, Netline Crewlink, Raido, Rainmaker, Sabre, Rocade, Opsman, Merlot, tops, etc."
  - "500+ supported airlines"
  - free to start, with paid subscriptions
  - the privacy label lists data linked to identity, and usage data used for tracking across other companies' apps and websites

  — [App Store: RosterBuster](https://apps.apple.com/us/app/rosterbuster-crew-app/id1035558169)
- RosterBuster's import routes:
  - in-app download from the crew portal ("Download your (first) roster")
  - manual upload on the web (app.rosterbuster.aero/home/upload) and on mobile
  - emailing the roster from the registered address to rb-importroster@cae.com, which triggers an automatic import and a success or failure email

  — [RosterBuster help: Roster](https://rosterbuster.zendesk.com/hc/en-us/categories/201042121-Roster); [Email your airline roster](https://rosterbuster.zendesk.com/hc/en-us/articles/208376995-Email-PDF-document); [Manual Roster Upload on Web](https://rosterbuster.zendesk.com/hc/en-us/articles/115001146310-Manual-Roster-Upload-on-Web) (snippets; these pages return 403 to automated fetching)
- A competitor's blog claims RosterBuster's portal-upload applet "errors out roughly half the time" — [Wingman blog](https://www.wingmanlog.in/post/rosterbuster-not-working-switching-to-airroster-2026). This is competitor marketing and is unverified.

#### Gemini extraction and structured output
- **Supported schema features:** Gemini structured output accepts a subset of JSON Schema:
  - types: string, number, integer, boolean, object, array, null
  - `title` and `description`
  - `properties`, `required`, `additionalProperties`
  - `enum`, and `format` values `date-time`, `date` and `time`
  - `minimum` and `maximum`
  - `items`, `prefixItems`, `minItems` and `maxItems`
  - `anyOf` and `$ref`

  — [Gemini API: Structured output (updated 2026-09-23)](https://ai.google.dev/gemini-api/docs/structured-output)
- **Limits and advice from the same doc:** "Not all JSON Schema features are supported". "Very large or deeply nested schemas may be rejected". "While output is syntactically correct JSON, always validate values in your application." The doc shows validation with Zod (JavaScript) and Pydantic (Python), and recommends `description` fields, enums and strong typing. — [Gemini API: Structured output](https://ai.google.dev/gemini-api/docs/structured-output)
- **PDF handling** — [Gemini API: Document understanding (updated 2026-09-23)](https://ai.google.dev/gemini-api/docs/document-processing):
  - PDFs of up to 50 MB or 1,000 pages are accepted; each page costs about 258 tokens.
  - Pages are scaled to at most 3072×3072 pixels.
  - Gemini 3 models also extract the PDF's own embedded text, and those tokens are not billed.
  - Gemini 3 adds a `media_resolution` setting (low, medium or high) for each media part.
  - Best practices: correct page orientation, clear images, and placing the text prompt after the page.
- The Gemini API terms warn that the services "may provide inaccurate or offensive content" — [Gemini API Additional Terms](https://ai.google.dev/gemini-api/terms).
- **Independent accuracy evidence:** a 2026 benchmark of 21 PDF table-extraction systems on 451 tables found "significant performance disparities". Rule-based metrics agree poorly with human judgement (TEDS r=0.68; GriTS r=0.70), while an LLM-as-judge agrees well (r=0.93). In practice, an accuracy check needs to be semantic (field by field), not string matching. — [Horn & Keuper, arXiv 2603.18652](https://arxiv.org/abs/2603.18652)
- **App Review consent rule:** apps "must clearly disclose where personal data will be shared with third parties, including with third-party AI, and obtain explicit permission before doing so" (guideline 5.1.2(i)) — [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)

#### On-device alternatives
- **Apple Vision `RecognizeDocumentsRequest` (OS 26):**
  - returns a `DocumentObservation` containing tables (with cells grouped into rows), lists, paragraphs, barcodes and detected data such as dates, times and phone numbers
  - reads 26 languages
  - "all vision APIs run entirely on-device"

  — [WWDC25 session 272](https://developer.apple.com/videos/play/wwdc2025/272/)
- **ML Kit Text Recognition v2:**
  - runs on the device on Android and iOS
  - reads Latin, Chinese, Devanagari, Japanese and Korean scripts
  - returns blocks, lines, elements and symbols with bounding boxes, rotation, confidence scores and language
  - documents no table-structure output

  — [ML Kit](https://developers.google.com/ml-kit/vision/text-recognition/v2)
- **Capacitor OCR wrappers:**
  - `@capacitor-mlkit/text-recognition` — [Capawesome ML Kit](https://github.com/capawesome-team/capacitor-mlkit/)
  - `@jcesarmobile/capacitor-ocr`, which uses Vision on iOS and ML Kit on Android — [GitHub](https://github.com/jcesarmobile/capacitor-ocr)
  - `@capacitor-community/image-to-text` — [GitHub](https://github.com/capacitor-community/image-to-text)
  - capacitor-vision — [GitHub](https://github.com/gommzystudio/capacitor-vision)
- **Apple Foundation Models framework:**
  - requires iOS/iPadOS/macOS 26+ and a device that supports Apple Intelligence
  - Apple says the on-device model is good at "summarization, entity extraction, text and image understanding"
  - the `@Generable` macro provides "strong guarantees that the model generates instances of your type"
  - a server-based Private Cloud Compute model is also available

  — [Apple: Foundation Models](https://developer.apple.com/documentation/foundationmodels)
- **Foundation Models context size:** Apple's technote TN3193 documents a 4,096-token context window — [Apple Developer Forums](https://developer.apple.com/forums/thread/806542). Secondary sources report a larger window (8,192 tokens) for newer models, and new `contextSize` and `tokenCount(for:)` APIs in iOS 26.4 — [InfoQ](https://infoq.com/news/2026/03/apple-foundation-models-context). The larger window is unverified.
- **Android on-device model:** the ML Kit GenAI Prompt API (alpha, October 2025) runs Gemini Nano on the device, only on supported recent flagship devices — [Android Developers Blog](https://android-developers.googleblog.com/2025/10/ml-kit-genai-prompt-api-alpha-release.html). A Capacitor wrapper exists — [Capawesome GenAI Prompt plugin](https://capawesome.io/docs/sdks/capacitor/mlkit/genai-prompt/).

### Inferences
- **Recommended tiered pipeline.** Use the most deterministic source available and fall back in this order:
  1. **Structured files:** .ics, CSV and HTML files from the share sheet, read with deterministic parsers.
  2. **Text PDFs:** extract the embedded text on the device (for example with pdf.js) and parse it.
  3. **Screenshots and scans:** read them on the device (iOS: Vision; Android: ML Kit), then structure the text with deterministic rules or an on-device LLM (Foundation Models / Gemini Nano). The on-device context window (about 4k tokens) is small, so process one roster page or section at a time.
  4. **Cloud LLM (Gemini, paid tier):** only as an explicit, consented fallback (required by App Store 5.1.2(i)). Send cropped or redacted content: crop to the schedule table and strip names and staff numbers.
- **Extraction schema design.**
  - Use a flat array of duty events.
  - Give `dutyType` an enum (e.g. FLIGHT, DEADHEAD/POSITIONING, STANDBY, RESERVE, TRAINING, OFF, REST, OTHER).
  - Include flight number and departure/arrival airport codes.
  - Store times as strings plus an explicit `timeBasis` enum (UTC, LOCAL_AIRPORT, LOCAL_BASE, UNKNOWN).
  - Allow fields to be null rather than letting the model guess.
  - Keep the raw source text for each row, plus an "uncertain" flag, so every value can be traced.
  - Validate the result with Zod on the device.
- **Automatic plausibility checks** (each failure flags a row):
  - every airport code exists in the bundled airport table
  - each arrival is after its departure once converted to UTC
  - each leg's arrival airport is the next leg's departure airport
  - block time is plausible for the great-circle distance
  - there are no overlapping duties
  - dates fall inside the roster period
- **Human verification screen:**
  - show extracted rows next to the original image, with flagged rows highlighted
  - make the user confirm before any plan is generated
  - on re-import, show only what changed compared with the previous roster
  - let the user edit times and the time basis
  - record which source and method produced each event
- **Avoid credential-based portal scraping.** It means holding crew passwords, two-factor login breaks it, airlines may object, and each portal needs its own maintained code. File, share-sheet and email-forwarding routes give most of the benefit at much lower risk.
- **Competitive note.** CAE owns both a crew-management system (the former Sabre AirCentre) and RosterBuster, the leading crew app. A privacy-first, ad-free, on-device positioning is a credible point of difference, given RosterBuster's tracking privacy label.

### Gaps
- Vendor documentation of export formats (AIMS, Lufthansa Systems, Jeppesen, IBS, CAE/Sabre) is not public. The findings rely on third-party crew-app help pages. Whether AIMS eCrew offers native iCal or webcal feeds for some airlines could not be confirmed.
- No published accuracy figures were found for Gemini (or any LLM) on crew-roster tables. An internal evaluation set of real anonymised rosters is needed.
- No Capacitor plugin was confirmed to expose the table structure from `RecognizeDocumentsRequest`. A small custom native plugin may be needed.
- The current ownership of Jeppesen and its crew products was not researched.

## 2. Open-source circadian models (Arcascope `circadian`, JS/TS ports, compute cost, validation)

### Takeaway
Arcascope's `circadian` Python package uses the permissive MIT licence. It implements Forger99, Jewett99 (Kronauer et al. 1999), Hannay19 and Hannay19TP, with RK4 integration, light schedules, DLMO (the evening rise of melatonin, a standard body-clock marker), phase response tools and readers for wearable data. ESRI is a related light-regularity metric from the same group. No maintained JavaScript or TypeScript port was found, so the practical route is a TypeScript port tested against outputs generated by the Python package. Published validations show about 1-hour DLMO accuracy for people living normal schedules, but about 2.9 hours mean error in night-shift workers. Predictions should therefore be shown with uncertainty.

### Cited Findings
- **Arcascope/circadian package:**
  - MIT licence
  - models: Forger99, Jewett99, Hannay19, Hannay19TP
  - features: a `Light` schedule class, `PRCFinder` (phase response curves), actograms and phase plots, DLMO for each model, and `circadian.readers` for wearable data
  - installed with `pip install circadian`
  - Zenodo DOI 10.5281/zenodo.8206871 (v1.0.2, August 2023)
  - about 19 stars, 239 commits and CI workflows at the time of fetching

  — [GitHub: Arcascope/circadian](https://github.com/Arcascope/circadian)
- The docs say the models use "an explicit Runge-Kutta 4 (RK4) scheme". The example uses 0.10-hour time steps. ESRI is listed as a documentation topic. — [circadian docs](https://arcascope.github.io/circadian/)
- The deprecated predecessor `hcrsimpy` also contains the Kronauer–Jewett model — [GitHub: hcrsimpy](https://github.com/Arcascope/hcrsimpy). Another Python implementation of the Forger–Jewett–Kronauer 1999 model exists in Chrono_Aligner (`light.py`) — [GitHub](https://github.com/arahjou/Chrono_Aligner).
- Original model paper: Forger, Jewett & Kronauer, "A simpler model of the human circadian pacemaker" (1999) — [PubMed 10643750](https://pubmed.ncbi.nlm.nih.gov/10643750/).
- **ESRI (Entrainment Signal Regularity Index):**
  - a circular measure from 0 (no organisation of entrainment signals) to 1 (perfect regularity)
  - computed from wrist-worn activity data as the change in the model's amplitude over time
  - authors: Moreno, Hannay, Goetz, Walch and Cheng, *Obesity* 2023
  - in children it was 0.70±0.10 during the school year versus 0.63±0.11 in summer

  — [PMC9975028](https://pmc.ncbi.nlm.nih.gov/articles/PMC9975028/)
- **Validation in normal living (Huang et al., *Sleep* 2021):** the study compared four circadian models fed by wrist-wearable data across several populations. Under normal living conditions, circadian phase "can typically be predicted to within 1 hour, even with data from a widely available commercial device (the Apple Watch)". — [Huang et al. 2021, Sleep](https://academic.oup.com/sleep/article-pdf/44/10/zsab126/49679720/zsab126.pdf)
- **Validation in night-shift workers (Cheng et al., *Sleep*; n=45 fixed night-shift workers, DLMO measured in the lab), using a higher-order Kronauer/Forger-type model with a non-light (activity) input:**
  - combined light-and-activity input: Lin's concordance 0.70 and mean absolute error 2.88 h
  - 76% of predictions within ±2 h and 91% within ±4 h
  - average bias −0.34 h, not significantly different from zero
  - activity-only input: concordance 0.72 and mean absolute error 2.91 h
  - light-only input: concordance 0.63

  — [PMC8240654](https://pmc.ncbi.nlm.nih.gov/articles/PMC8240654)
- **Starting conditions matter:** estimation accuracy depends on how the model is initialised, how long the recording is and how much light exposure is captured — [Lim et al. 2026, J Biol Rhythms](https://doi.org/10.1177/07487304261430123); [PMC12694990](https://pmc.ncbi.nlm.nih.gov/articles/PMC12694990/).

### Inferences
- **Computing cost is negligible on a phone.** Forger99 is three ordinary differential equations (x, xc, n) at roughly a few dozen arithmetic operations per evaluation. RK4 with 0.1-hour steps means 240 steps per day, or about 88k steps per year. That should take well under 50 ms in JavaScript on a phone, so the whole roster horizon can be re-simulated on every edit. No web worker is needed, though one is harmless.
- **Port plan.** Port Forger99 first (it is the most widely used and was validated by Huang/Cheng), then optionally Jewett99 or Hannay19 for comparison. Keep the MIT copyright notice in the ported code.
- **Validation plan for the port:**
  1. Create "golden" test cases with the Python package for set scenarios: a regular 16:8 light/dark schedule; 8-hour phase advance and delay (jet lag); rotating night shifts; constant darkness, which should free-run at the model's intrinsic period.
  2. Save the state trajectories and DLMO/CBTmin (body-temperature low point) times as JSON fixtures.
  3. Assert in Vitest that the TypeScript port agrees within tight tolerances (for example less than 1 minute of phase).
  4. Reproduce the package's phase response curves (`PRCFinder`) as a shape check against the published curves.
- **Light input is the main source of error, not the maths.** Crew rarely have light sensors. Infer light from the schedule:
  - asleep: dark
  - awake indoors or in the cabin: low lux
  - outdoors: high lux, scaled by sun elevation at the airport
  - optionally refined with Apple Watch time-in-daylight or activity (Cheng found activity-only input about as good as light)
- **Start-up and uncertainty.** Warm up each model by simulating several days of the user's habitual home-base schedule. Show the timing of recommendations as windows or ranges, given errors of 1 hour (normal living) to 3 hours (shift work).
- **Sleep pressure is separate.** These models predict body-clock phase only. Advice on nap and sleep timing also needs a sleep-pressure (homeostatic) component, such as the two-process model.

### Gaps
- No JavaScript or TypeScript port of these models was found on GitHub or npm (absence of evidence; the GitHub CLI was unavailable for a deeper code search).
- No published tables of numeric reference outputs were found. Validation must rely on the Python package's own outputs and the published figures.
- Whether ESRI is implemented as a callable function in the current package release was not confirmed.
- Validation specifically for transmeridian (jet-lag) crews, rather than night-shift workers, was not found in this research.
- Open-source sleep-pressure models that pair with these circadian models were not researched.

## 3. Mobile constraints for a Capacitor app: notification limits, exact alarms, Doze, true wake-up alarms, calendar fallback, plugins

### Takeaway
- **iOS:** each app can have at most 64 pending local notifications, so the app must schedule a rolling window rather than the whole plan. Since iOS 26, AlarmKit gives third-party apps real alarms that override Silent mode and Focus, and Capacitor plugins exist for it.
- **Android:** on Android 14+, `SCHEDULE_EXACT_ALARM` is denied by default for new installs. Google Play restricts `USE_EXACT_ALARM` to apps whose core function is an alarm/timer or calendar. A circadian planner should ask the user for `SCHEDULE_EXACT_ALARM`, use alarm-clock-type alarms for wake-ups, and degrade gracefully if refused.
- **Fallback:** calendar events with alerts, which the operating system fires itself, are a robust backup.

### Cited Findings
- **iOS 64-notification limit.** An Apple engineer (January 2026): "there is a limit of 64 for how many simultaneous notification requests can be active/pending at one time per app. This is a system limit and there is no way around it." — [Apple Developer Forums 811171](https://developer.apple.com/forums/thread/811171)
- **Conflict over which 64 are kept:** the legacy Apple wording is "the system keeps the soonest-firing 64 notifications (with automatically rescheduled notifications counting as a single notification) and discards the rest". Contradicting this, the `flutter_local_notifications` docs state that iOS versions after 9 keep the 64 most recently scheduled. — [snippet via search results](https://developer.apple.com/forums/thread/765490); [flutter_local_notifications](https://pub.dev/packages/flutter_local_notifications)
- **Time Sensitive notifications (iOS 15+):** they "break through system controls such as Notification Summary and Focus". The user can turn this off. They require the `com.apple.developer.usernotifications.time-sensitive` entitlement. — [Apple: timeSensitive](https://developer.apple.com/documentation/usernotifications/unnotificationinterruptionlevel/timesensitive)
- **AlarmKit** — [Apple: AlarmKit](https://developer.apple.com/documentation/alarmkit); [Scheduling an alarm with AlarmKit](https://developer.apple.com/documentation/alarmkit/scheduling-an-alarm-with-alarmkit):
  - available on iOS, iPadOS and Mac Catalyst 26.0+
  - an alarm "overrides both a device's focus and silent mode, if necessary"
  - supports one-time alarms, weekly repeating alarms, countdown timers and snooze
  - needs the `NSAlarmKitUsageDescription` key ("If the `NSAlarmKitUsageDescription` key is missing or its value is an empty string, apps can't schedule alarms") plus `AlarmManager.requestAuthorization()`
  - "AlarmKit expects a widget extension if an app supports a countdown presentation. Otherwise, the system may unexpectedly dismiss alarms and fail to alert."
  - the docs state no limit on the number of alarms
- **Capawesome Alarm plugin:**
  - **iOS:** uses AlarmKit and requires iOS 26+; on older versions every method except `isAvailable()` rejects. Alarms belong to the app and can be listed and cancelled with `getAlarms`/`cancelAlarm`. Timers are not available on iOS because they need Live Activity widgets.
  - **Android:** alarms are created "in the system clock app via the AlarmClock intent API. This is fire-and-forget". The app cannot list or cancel them, and only the `SET_ALARM` permission is needed.
  - **Scheduling:** alarms are set by hour and minute (with weekday repeats), not by a specific date.

  — [Capawesome Alarm](https://capawesome.io/docs/sdks/capacitor/alarm/)
- Capgo's `capacitor-alarm` also supports AlarmKit; its commit history mentions a fix for iOS 26.2 compatibility — [GitHub: Cap-go/capacitor-alarm](https://github.com/Cap-go/capacitor-alarm).
- **Android 14 exact-alarm change** — [Android 14: exact alarms denied by default](https://developer.android.com/about/versions/14/changes/schedule-exact-alarms):
  - `SCHEDULE_EXACT_ALARM` is "no longer being pre-granted to most newly installed apps targeting Android 13 and higher".
  - Existing grants are kept when the device upgrades.
  - Calendar and alarm-clock apps can use `USE_EXACT_ALARM`, which is "granted on install".
  - `setExact()`, `setExactAndAllowWhileIdle()` and `setAlarmClock()` need the permission, except when using an `OnAlarmListener`.
  - Apps should check `canScheduleExactAlarms()` (including in `onResume`) and fall back to `setWindow()`.
  - To test, turn off Settings > Apps > Special app access > Alarms & reminders.
- **Android alarm API details** — [Android: Schedule alarms (updated 2026-09-30)](https://developer.android.com/develop/background-work/services/alarms/schedule):
  - `setAlarmClock()`: "the system never adjusts their delivery time… leaves low-power modes if necessary".
  - `setExactAndAllowWhileIdle()` fires even when battery saving is active.
  - On Android 12+, inexact time windows shorter than 10 minutes are clipped to 10 minutes.
  - `USE_EXACT_ALARM` cannot be revoked by the user but is subject to Play policy; `SCHEDULE_EXACT_ALARM` can be revoked.
  - "By default, all alarms are canceled when a device shuts down." Re-scheduling after reboot needs `RECEIVE_BOOT_COMPLETED` and a `BOOT_COMPLETED` receiver.
- **Google Play policy** — [Play policy: Permissions and APIs that access sensitive information](https://support.google.com/googleplay/android-developer/answer/16558241):
  - `USE_EXACT_ALARM` only when "core, user facing functionality requires precisely-timed actions", such as an alarm or timer app, or a calendar app showing event notifications. Other apps should use `SCHEDULE_EXACT_ALARM`.
  - `USE_FULL_SCREEN_INTENT` is granted automatically only to apps whose core function is setting alarms or receiving calls.
  - Declaring restricted permissions requires a Play Console declaration and review — [secondary summary](https://www.technetexperts.com/android-play-store-permissions/).
- **Capacitor Local Notifications v8** — [Capacitor Local Notifications](https://capacitorjs.com/docs/apis/local-notifications):
  - requires `SCHEDULE_EXACT_ALARM` in the manifest for exact timing on Android 12+, and "users can still disable exact notifications from the app settings"
  - provides `checkExactNotificationSetting()` and `changeExactNotificationSetting()`
  - `allowWhileIdle: true` for Doze, but such notifications "can only fire once per 9 minutes, per app"
  - schedules can use `at`, `every` and `on`
- **Calendar plugins:** they create events with alerts (minute offsets) through EventKit on iOS and CalendarContract on Android. The operating system fires the alerts whether or not the app is running. On Android, creating events needs `READ_CALENDAR` as well as `WRITE_CALENDAR`. — [Capawesome Calendar](https://capawesome.io/docs/sdks/capacitor/calendar/); [@ebarooni/capacitor-calendar](https://github.com/ebarooni/capacitor-calendar). All-day events need different date handling per platform (issue #282) — [GitHub issue](https://github.com/ebarooni/capacitor-calendar/issues/282).

### Inferences
- **Notification scheduler design:**
  - Compute the whole plan on the device, but keep only the next N reminders pending (stay well under 64 on iOS, e.g. 40–50), ranked by importance (wake/report > nap end > light > caffeine cut-off > meals).
  - Top the queue up whenever the app opens or resumes, when a roster is imported, and when the time zone or clock changes.
  - Show users a "reminders scheduled until <date>" indicator, so they open the app before the queue runs out.
- **Wake-up and nap-end alarms (safety-critical).**
  - On iOS 26+, offer AlarmKit through a plugin (the Capawesome plugin covers hour/minute alarms; date-specific alarms and countdown naps may need a custom plugin plus a widget extension).
  - Fallbacks: Time Sensitive notifications plus a calendar event with an alert.
  - Always tell users clearly that the app's alarm should not be their only duty-report alarm.
- **Android alarms.** Request `SCHEDULE_EXACT_ALARM` with an in-app explanation, use `setAlarmClock` for wake-ups, and fall back to inexact alarms and calendar alerts if refused. Avoid `USE_EXACT_ALARM`: a circadian planner is unlikely to pass Play review as an "alarm clock app".
- **Calendar export.** Writing plan events (sleep, nap, light windows) into a dedicated "CrewCircadian" calendar is the most robust cross-platform fallback. Exporting a shareable .ics file covers web and desktop users.

### Gaps
- Android 16/17-specific changes to alarms or Doze since the Android 14 change were not verified.
- How Capacitor Local Notifications behaves on iOS beyond 64 pending notifications (silently dropped or an error), and whether it re-arms Android alarms after reboot, was not verified.
- Whether AlarmKit supports a fixed-date one-off alarm through existing Capacitor plugins (the Capawesome docs show only hour/minute) was not confirmed.
- How the Capgo alarm plugin behaves on Android was not researched.

## 4. Health data integration (HealthKit, Health Connect, plugins, useful data, permissions and store review)

### Takeaway
An official `@capacitor/health-fitness` plugin (v8) and several community or paid plugins expose sleep, heart rate and activity from HealthKit and Health Connect. Sleep stages, HRV and Apple's `timeInDaylight` are available only in some plugins. The most useful inputs for a circadian app are:
- actual sleep sessions (to check adherence and feed the model)
- activity
- time in daylight, as a light proxy

Both app stores tightly restrict health-data use: no ads or data mining, no health data in iCloud, a declaration for every permission, and a privacy policy.

### Cited Findings
- **Apple `timeInDaylight`:** "A quantity sample type that measures amount of time the user spent in daylight". It accumulates over time and needs iOS 17 / watchOS 10 or later. — [Apple: timeInDaylight](https://developer.apple.com/documentation/healthkit/hkquantitytypeidentifier/timeindaylight)
- **Official `@capacitor/health-fitness` plugin** — [Capacitor Health/Fitness](https://capacitorjs.com/docs/next/apis/health-fitness):
  - covers Health Connect and HealthKit, not web
  - reads steps, calories, distance, heart rate, sleep, blood pressure, blood glucose, oxygen saturation, body temperature and profile metrics
  - writes are limited (Android: profile variables only; iOS: not category types such as sleep)
  - iOS background jobs via `setBackgroundJob()`
  - "Health Connect requires a privacy policy URL"
  - sleep stages, HRV and time in daylight are not listed
- **Capawesome Health plugin (paid, Insiders only)** — [Capawesome Health](https://capawesome.io/docs/sdks/capacitor/health/):
  - about 20 data types, including heart rate, resting heart rate, HRV, and sleep with stages (awake, deep, light, REM, in bed)
  - on Android, sleep comes as sessions containing all stages; on iOS, each record is a single stage with no session grouping
  - "Health Connect only allows apps to read data from up to 30 days before the moment the permission was first granted"
  - "HealthKit deliberately hides whether a read permission was granted or denied"
  - "Google Play reviews every declared health permission"
  - Android minimum SDK 26; Health Connect is part of the operating system on Android 14+
- Other plugins: [Cap-go/capacitor-health](https://github.com/Cap-go/capacitor-health); [capacitor-health-extended](https://github.com/Flomentum-Solutions/capacitor-health-extended).
- **Health Connect history:** reading data older than 30 days requires `android.permission.health.READ_HEALTH_DATA_HISTORY` — [Android: Read raw data](https://developer.android.com/health-and-fitness/health-connect/read-data) (snippet).
- **Google Fit shutdown:** the Google Fit APIs are supported only until the end of 2026, and new sign-ups closed on 1 May 2024. Health Connect is the mobile replacement. — [Fit migration guide](https://developer.android.com/health-and-fitness/health-connect/migration/fit) (snippet)
- **Google Play Health Connect policy:** approved uses include "fitness and wellness… fitness coaching… medical care, health research". Use must be limited to features visible in the app's interface, and selling or transferring the data for advertising is prohibited. — [Play policy](https://support.google.com/googleplay/android-developer/answer/16558241)
- **App Store guidelines** — [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/):
  - **5.1.3(i):** HealthKit data may not be used for advertising, marketing or data mining, and "You must disclose the specific health data that you are collecting".
  - **5.1.3(ii):** apps "may not store personal health information in iCloud".
  - **2.5.1:** HealthKit "should be used for health and fitness purposes and integrate with the Health app", and the integration should be indicated in the app description.
  - **1.4.1:** apps must "clearly disclose data and methodology to support accuracy claims relating to health measurements" and remind users to check with a doctor.
- **Apple Watch for model input:** wearable data, including from Apple Watch, supports roughly 1-hour phase prediction under normal living — [Huang et al. 2021](https://academic.oup.com/sleep/article-pdf/44/10/zsab126/49679720/zsab126.pdf).

### Inferences
- **Start with a minimal permission set:** sleep (read), steps or activity (read), and on iOS time in daylight (read).
  - Defer heart rate and HRV: they add review burden and privacy weight but little direct value for this planner.
  - Never write to Health unless there is a clear user benefit (writing false data is banned).
- **Plugin choice.** Neither confirmed plugin covers everything:
  - the official plugin is free but lacks stages and time in daylight
  - Capawesome's covers stages and HRV but is paid
  - check whether any plugin supports `timeInDaylight`; otherwise a small custom native bridge for that one type is cheap
- **iCloud rule affects backup.** Because of the iCloud restriction, keep health-derived data local. Exclude it from any CloudKit or iCloud Drive sync, and make "export" an explicit, user-initiated file.
- **Avoid accuracy claims.** Avoid wording that implies medical-grade measurement (guideline 1.4.1). Position the app as wellness and fatigue-management guidance.

### Gaps
- Whether `timeInDaylight` is supported by any Capacitor plugin was not confirmed.
- Which sensor (Apple Watch ambient light sensor) generates `timeInDaylight` samples, and at what time resolution, was not confirmed in the fetched docs.
- How Apple treats device iCloud Backup under the 5.1.3(ii) iCloud rule is unclear.

## 5. Durable on-device storage (WKWebView eviction, Preferences vs SQLite, encryption, offline-first, backup)

### Takeaway
Capacitor's own docs say localStorage must be treated as temporary, because "the OS will reclaim local storage from Web Views if a device is running low on space". WebKit evicts website data in apps that embed a web view on a least-recently-used basis when storage is short. Persistent data should move to SQLite, which also offers SQLCipher encryption with keys in the Keychain or Keystore. Small settings can use Capacitor Preferences, and backup should be an explicit export.

### Cited Findings
- **Capacitor storage guidance** — [Capacitor: Storage guide](https://capacitorjs.com/docs/guides/storage):
  - localStorage "must be considered transient, meaning your app needs to expect that the data will be lost eventually" because "the OS will reclaim local storage from Web Views if a device is running low on space"
  - Preferences is "a native… API that avoids the eviction issues above, but is meant for small amounts of data"
  - SQLite is "the most widely supported option" for large data
  - Ionic Secure Storage is an enterprise SQLite option with "encryption support and integration with secure key management APIs"
- **WebKit storage policy (10 Aug 2023)** — [WebKit: Updates to Storage Policy](https://webkit.org/blog/14403/updates-to-storage-policy/):
  - apps other than browsers (including WKWebView apps) get a per-origin quota of up to 15% of disk and an overall quota of up to 20%
  - data is evicted "when exceeding the overall quota, when the system is under storage pressure, or when the site has not been interacted with by the user for some time", least recently used first
  - `navigator.storage.persist()` is supported, but approval is based on heuristics
- **@capacitor-community/sqlite** — [GitHub: capacitor-community/sqlite](https://github.com/capacitor-community/sqlite):
  - runs on iOS, Android, Electron and web (web uses sql.js and jeep-sqlite stored in IndexedDB; encrypted databases are not supported on web)
  - SQLCipher encryption, with keys in the iOS Keychain and Android Keystore
  - uses SQLCipher even for unencrypted databases, which brings US encryption-export reporting duties
  - MIT licence; now maintained by Robin Genz (Capawesome)
- The ban on storing personal health information in iCloud (App Store 5.1.3(ii)) applies to any health-derived data — [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/).

### Inferences
- **Migration path:**
  1. Move rosters, plans, confirmation history and user settings from localStorage to SQLite, with versioned schema migrations.
  2. Use Preferences only for small flags such as onboarding state or the selected theme.
  3. On first native launch, run a one-time migration from localStorage, then treat localStorage only as a cache.
- **Encryption.** A roster reveals a person's whereabouts, so enable SQLCipher encryption, with the key generated on the device and held in the Keychain or Keystore. Account for the export-compliance declaration in App Store Connect.
- **Offline-first.** All planning and scheduling already runs on the device. Only roster extraction needs the network, and only when cloud fallback is chosen. Design so the app is fully usable in flight mode.
- **Backup and export.** Offer an explicit export of the roster and settings (an encrypted JSON or an .ics plan) through the Capacitor Filesystem and Share plugins, and an import to restore it. Don't rely on WebView storage surviving restores.

### Gaps
- iOS Data Protection classes for files in a Capacitor app, and the Android Auto Backup defaults (size limits, whether to exclude encrypted databases), were not researched in official docs.
- The exact current Capacitor 8 compatibility version of `@capacitor-community/sqlite` was not confirmed (the README fetched referenced Capacitor 5 migration notes).
- Whether the WebKit "not interacted with for some time" eviction applies to Capacitor's local app origin in practice is not documented.

## 6. Time-zone correctness (IANA tzdb, DST, airport→zone datasets, local vs UTC rosters)

### Takeaway
Time-zone rules keep changing: tzdb is already at 2026e, released 29 Sep 2026, with Manitoba moving to permanent UTC−05. Therefore:
- store every event as a UTC instant plus the airport's IANA zone ID
- map airports to zones with an MIT-licensed dataset (OurAirports itself has no time-zone column)
- treat the roster's time basis (UTC or local) as an explicit field the user confirms

JavaScript's Temporal API is still not enabled in Safari 27, so the iOS WebView needs a library or polyfill.

### Cited Findings
- The latest IANA tz database release is 2026e (29 Sep 2026): "Manitoba moves to permanent -05 on 2026-10-31." — [IANA Time Zones](https://www.iana.org/time-zones)
- **OurAirports `airports.csv`:** contains ident, type, name, coordinates, elevation, country and region, municipality, scheduled service, and gps/icao/iata/local codes. It has no time-zone column. — [OurAirports data dictionary](https://ourairports.com/help/data-dictionary.html). "All data is released to the Public Domain, and comes with no guarantee of accuracy", it is updated nightly, and the files are mirrored on GitHub (davidmegginson/ourairports-data). — [OurAirports data](https://ourairports.com/data/)
- **mwgg/Airports:** about 28–29k airports keyed by ICAO code, with IATA code, coordinates, elevation and an IANA `tz` (e.g. "America/Chicago"). Zones were sourced from TimeZoneDB and updated using TimeAPI. MIT licence. — [GitHub: mwgg/Airports](https://github.com/mwgg/Airports)
- **airportsdata (mborsetti):** 28,298 airports (7,884 with IATA codes) with an IANA-compliant tz. Data is validated against national AIPs, ARINC, IATA and ch-aviation; operational airports only, no historical data. MIT licence; CSV downloadable. The fetched page referenced changes from March 2024, so its freshness should be checked. — [GitHub: airportsdata](https://github.com/mborsetti/airportsdata)
- **Temporal browser support:** Temporal shipped in Firefox 139 (May 2025) and Chrome 144 (January 2026) — [Socket](https://socket.dev/blog/temporal-api-ships-in-chrome-144-major-shift-for-javascript-date-handling). It reportedly reached TC39 Stage 4 in March 2026 (secondary source in search results).
- **Safari 27.0 (17 Sep 2026):** Temporal is not enabled by default; the release notes contain only a Temporal spec fix. They also note: "Fixed time zone identifiers to return primary IANA time zone IDs instead of legacy ICU identifiers." — [WebKit: Safari 27.0](https://webkit.org/blog/18325/webkit-features-for-safari-27-0/)

### Inferences
- **Data model.** Store each event as UTC epoch milliseconds plus the IANA zone of the relevant airport. Compute "local time" only for display.
  - The circadian model runs in absolute time.
  - Advice wording ("sleep 22:00–06:00 local") is rendered in the zone where the person will physically be.
- **Time basis on import.** Rosters print times in UTC, airport local time or home-base local time, depending on the airline or system. Make `timeBasis` an explicit extracted field.
  - Detect it from headers (e.g. "UTC", "LT", "Z").
  - If ambiguous, ask once per roster source and remember the answer.
  - Validate with block-time and distance plausibility checks.
- **DST edge cases.** For local times, resolve DST gaps (non-existent times) and overlaps (ambiguous times) explicitly and flag them for review. Day rollover (+1 arrival) is common in roster tables.
- **Libraries.** Use a library that works identically in WKWebView and Android WebView, such as Luxon, date-fns-tz or the `@js-temporal/polyfill`.
  - Most rely on the platform's Intl time-zone data, which iOS updates through OS updates and Android WebView through WebView updates.
  - Record the tz version where possible, and normalise zone IDs (e.g. Asia/Calcutta→Asia/Kolkata, Europe/Kiev→Europe/Kyiv) given the Safari 27 change.
- **Airport data.** Bundle an airport→zone table (from airportsdata or mwgg, both MIT, with attribution) in the app, at about 1–2 MB, or trimmed to airports with IATA codes. Cross-check it with OurAirports (public domain) for coordinates if needed. Update it with app releases.

### Gaps
- No official source was found stating how quickly iOS and Android WebView pick up new tzdb releases.
- Which roster systems print UTC versus local times by default was not documented in the sources found.
- Data freshness and error rates of the airport→zone datasets were not independently verified.

## 7. AI provider terms (Gemini free vs paid; alternatives for privacy-sensitive documents)

### Takeaway
- **Gemini free tier:** Google may use prompts to improve its products, human reviewers may read them, and the terms say not to submit personal information. It is unsuitable for rosters, except that users in the EEA, Switzerland and the UK get paid-tier data terms everywhere.
- **Gemini paid tier:** prompts are not used for product improvement. They are processed under Google's Data Processing Addendum and logged only for abuse detection (logs kept up to 55 days by default; 7, 14 or 28 days can be configured).
- **Medical advice:** the terms also forbid using Gemini to provide medical advice, so Gemini should only extract rosters.
- **Alternatives:** Vertex AI (Google Cloud) with zero data retention; Anthropic or OpenAI APIs (no training on API data by default, about 30-day retention, zero retention by agreement); best of all, on-device processing (Apple Vision plus Foundation Models; ML Kit plus Gemini Nano).

### Cited Findings
- **Gemini API Additional Terms (last modified 28 Apr 2026)** — [Gemini API Additional Terms](https://ai.google.dev/gemini-api/terms):
  - **Unpaid Services:** Google uses submitted content to "provide, improve, and develop Google products and services" including machine learning. "Human reviewers may read, annotate, and process your API input and output." "Do not submit sensitive, confidential, or personal information to the Unpaid Services."
  - **Paid Services:** Google does not use "prompts (including associated system instructions, cached content, and files)" to improve products. Data is processed under the Data Processing Addendum, and logging is limited to detecting violations of the Prohibited Use Policy.
  - **EEA, Switzerland and UK:** the Paid Services data terms apply to all services "even though they are offered free of charge".
  - **Age:** users must be 18+, and services must not be directed at minors.
  - **Prohibited uses:** use "in clinical practice, to provide medical advice, or in any manner that is overseen by or requires clearance or approval from a medical device regulatory agency".
- **Gemini API logs policy (updated 4 Sep 2026)** — [Gemini API logs policy](https://ai.google.dev/gemini-api/docs/logs-policy):
  - "Logs are retained for a default maximum period of 55 days"; this can be set to 7, 14, 28 or 55 days in AI Studio
  - for billing-enabled projects, logs are not used for product improvement unless the developer opts in to sharing datasets
  - shared data falls under the Unpaid Services terms
  - data is disconnected from the account before human review
- **Vertex AI zero data retention.** The Google Cloud page is now titled "Gemini Enterprise Agent Platform and zero data retention". By default, Gemini inputs and outputs are cached for up to 24 hours. Caching can be disabled per project, and zero retention also requires requesting an exception from abuse-monitoring prompt logging. — [Google Cloud ZDR](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/vertex-ai-zero-data-retention) (snippet; the page body could not be fetched)
- **Anthropic (per The Register, 2 Sep 2026):**
  - "Thirty-day retention of inputs and outputs is the norm for commercial customers using the API"
  - no training on enterprise data
  - zero data retention must be applied for
  - since 9 June 2026, certain frontier models need limited retention even under zero data retention, for safety review

  — [The Register](https://www.theregister.com/ai-and-ml/2026/09/02/anthropic-promises-zero-data-retention-but-customers-must-check-it-worked/5293789)
- **OpenAI (per The Register, 20 Aug 2026):** the API keeps data for 30 days by default, and zero data retention is available to commercial customers. OpenAI announced "Private Safety Processing" for zero-retention deployments. — [The Register](https://www.theregister.com/ai-and-ml/2026/08/20/openai-chases-anthropics-biz-customers-with-zero-data-retention-pledge/5290609)
- **App Store consent for third-party AI:** explicit disclosure and permission are needed before sharing personal data with third-party AI (guideline 5.1.2(i)) — [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- **On-device options:** see Section 1 for Apple Vision `RecognizeDocumentsRequest` ([WWDC25](https://developer.apple.com/videos/play/wwdc2025/272/)), Foundation Models ([Apple](https://developer.apple.com/documentation/foundationmodels)), ML Kit text recognition ([Google](https://developers.google.com/ml-kit/vision/text-recognition/v2)) and the Gemini Nano Prompt API ([Android Developers Blog](https://android-developers.googleblog.com/2025/10/ml-kit-genai-prompt-api-alpha-release.html)).

### Inferences
- **If Gemini stays as the server fallback:**
  - use only a billing-enabled (paid) project
  - set the minimum log retention (7 days)
  - never opt in to dataset sharing
  - keep the API key on the Express server, never in the app bundle
  - send cropped, redacted inputs without names or staff IDs
  - delete uploaded files after extraction
  - disclose all of this in the privacy policy and in a consent screen before the first upload (App Store 5.1.2(i))
- **Keep Gemini on extraction only.** Generating sleep or health advice with Gemini risks breaching the "medical advice" prohibition. Keep advice generation in the app's deterministic on-device engine.
- **Preferred direction for privacy:** do extraction on the device by default (Vision/ML Kit, then rules or an on-device LLM, then user verification), and make the cloud an opt-in "help me read this roster" button. For stronger guarantees, Vertex AI with caching disabled and a logging exception gives Google-side zero retention.

### Gaps
- It is unclear whether the 55-day Gemini "logs" retention refers to the opt-in AI Studio logging feature or to mandatory abuse-monitoring logs for paid API calls. The terms and logs pages were summarised, not read in full.
- The Anthropic and OpenAI retention details come from news reporting, not their primary policy pages.
- Gemini Nano Prompt API device coverage and its suitability for parsing roster tables were not evaluated.
