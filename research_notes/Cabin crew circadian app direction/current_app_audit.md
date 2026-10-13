# Current CrewCircadian App: Code Audit of Rules, Claims and UI Complexity

Method: static reading of the source on branch `hardening-and-local-setup` (commit 7dcc70e). The app was not run. Sources are given as `file:line` (paths relative to the repo root). "Calc" means `src/services/circadianCalculator.ts`. Anything marked **Inference** was traced by hand from the code and the sample roster data; it was not executed. HBT = Home Base Time (one fixed UTC offset for the whole roster).

## Q1. Rules and constants behind each recommendation

### Takeaway
All recommendations come from one rule-based function, `generateCircadianPlan` (Calc:196-1377). It sorts each UTC calendar date into one of four duty categories by the first report time in HBT, and fills each category with fixed clock times and fixed durations. Several settings shown to users (chronotype, melatonin protocol, bunk shift, nap length, layover strategy, debrief) are never read by the calculator. "SAFTE/ReadiScore" is a time-of-day lookup, not the SAFTE model. FDP compliance is hard-coded to `true`.

### Cited Findings

**Defaults and preferences**
- Defaults: home base DEL, UTC+5.5, chronotype `intermediate`, 7.5 h target sleep, 6 h caffeine cutoff, nap 26 min, grooming 60 min, cab 60 min, rank senior, currency INR — `src/App.tsx:36-48`.
- Settings ranges: grooming and cab 30-120 min in 15-min steps (`src/components/views/SettingsView.tsx:89-126`); target sleep 6.0-9.0 h in 0.5 h steps (`SettingsView.tsx:200-207`); caffeine cutoff 6 or 8 h only (`SettingsView.tsx:223`).
- The plan is recalculated only when the roster, preferences or nudges change (`src/App.tsx:105-107`).

**Day bucketing and duty categories**
- Flights are grouped by the UTC date of `reportTimeUtc` (Calc:328-333).
- The date range is `totalDays` from the first flight date, or the first-to-last flight span (Calc:339-355). An empty roster gives 7 days from today's UTC date (Calc:356-364).
- Category is set by the first flight's report hour in HBT (Calc:503-506):
  - early morning: 03:30-08:30
  - daytime: 08:30-15:30
  - late afternoon/evening: 15:30-20:00
  - red-eye: 20:00 or later, or before 03:30
- Buffers: grooming `|| 60` and cab `|| 60` (Calc:486-487). Prep/alarm start = report − cab − grooming (Calc:490-491).
- Only the first flight of the day drives category and prep. Only the last flight's release drives post-duty items (Calc:475-479).

**Sleep timing**
- Off day: sleep 23:00 HBT on that date for `targetSleepHours` (Calc:375-377, 385-403). This is the night *after* the off day.
- Early duty: bedtime = prep start − target sleep; wake = prep start (Calc:527, 638-670). Nudges apply.
- Daytime duty: fixed 23:00 HBT the previous night + target (Calc:544, 761-784). Nudges apply.
- Late-afternoon duty: fixed 23:00 HBT the previous night + target (Calc:557, 876-898). The event is marked `userAdjustable`, but `customNudges` is not applied here, unlike the early and daytime branches.
- Red-eye duty:
  - Pre-duty "bank" of 150 min ending at prep start (Calc:571, 969-990). It cites the "90-minute" citation (Calc:985 vs Calc:73-78).
  - Daytime recovery sleep of 5.5 h, starting at release + 120 min (Calc:1038-1059).
- Explanation strings say "23:00 – 07:00" (Calc:551) and "23:00 – 07:30" (Calc:564). They do not match 23:00 + 7.5 h, but they are never shown (see Q6).

**Naps**
- Early duty: "recovery nap" of 90 min, starting release + 90 min (Calc:673-693).
- Daytime duty: optional 26-min "NASA Ames" nap starting prep start − 60 min (Calc:787-806). The comment "around 11:00 AM" (Calc:786) only holds for about a 14:00 report.
- Late-afternoon duty: fixed 13:00-14:30 HBT "sleep banking" (Calc:901-921). It cites the *recovery* sleep citation (Calc:916).
- Red-eye duty: 26-min nap at departure + 60 min, whatever the flight length (Calc:993-1013). Subtitle: "+54% alertness boost with zero sleep inertia" (Calc:1001).
- `preferredNapDuration` (types `src/types/circadian.ts:122`, default `App.tsx:43`) is never read. Nap lengths are hard-coded at 26, 90 and 150 min.

**Eating and fasting**
- Off day: 08:30 HBT + 10 h (Calc:378-380, 406-423).
- Early duty: prep start + 45 min, for 9.5 h (Calc:738-757). It is titled "Salk 10h Protocol" (Calc:744).
- Daytime duty: 08:30-18:30 HBT (Calc:853-872).
- Late-afternoon duty: 09:00-19:00 HBT (Calc:946-965).
- Red-eye duty: no eating window. "Gut rest" fast runs from first report to landing: "warm water, herbal tea, or light almonds only" (Calc:1062-1079).
- Daily summary `eatingWindowHours` is hard-coded 9.5 (Calc:1185) and is never displayed.

**Caffeine**
- Off day: cutoff fixed at 17:00 HBT until 23:00 (Calc:381, 452-469). Ignores the preference.
- Early duty:
  - "Optimal" window from report − 30 min to report + 3.5 h, with "Micro-dose 50-100mg" (Calc:696-715).
  - Cutoff = bedtime − preference, on the evening before (Calc:530, 718-735).
- Daytime duty:
  - Allowed from core-sleep end to report + 2 h (Calc:809-828). The comment says "until 1.5h before check-in" (Calc:808), which contradicts the code.
  - Cutoff fixed at 17:00-23:00 HBT (Calc:831-850). Ignores the preference.
- Late-afternoon duty: allowed until report + 2 h, "Coffee permitted until 2 hours into flight duty" (Calc:924-943). No cutoff event at all.
- Red-eye duty: no allowed window. In-flight cutoff from departure + 90 min to the end of daytime recovery sleep (Calc:1082-1101). The subtitle says "past mid-flight".
- The preference is used only for early-duty cutoffs and the `prepDetails` banner times (Calc:530, 547, 560, 574).

**Light and "melatonin shield"**
- Off day: "Outdoor Natural Light Reset" at a fixed **03:00-04:00 UTC** (Calc:426-449). That is 08:30-09:30 only in IST. Subtitle: "20-30 mins ... before 10:00 AM" (Calc:431).
- Duty days get no light-seeking events.
- Red-eye only: "Melatonin Shield (Wear Dark Sunglasses)" from landing to release + 120 min (Calc:1016-1035). `durationMinutes` is hard-coded 120. There is no check of local daylight or sunrise.

**Melatonin protocol**
- Settings toggle "Low-Dose Melatonin Timer (0.5mg–3mg Phase Response Curve)", "Calculates precise pre-sleep administration window" (`SettingsView.tsx:295-315`).
- `useMelatoninProtocol` is never read outside Settings (grep). There is no melatonin dosing logic anywhere.

**WOCL**
- A flight is flagged WOCL if its departure hour in HBT is between 1.5 and 6.0, or if `isRedEye` is set (Calc:241-244). Overlap with 02:00-06:00 is not checked.
- The WOCL warning event spans the entire flight (Calc:274-293). Its subtitle says "IST" if the *origin* is DEL or BOM, else "HBT" (Calc:280).
- `isRedEye` is set in different places with different rules:
  - Server sanitizer: departure 22:00-06:00 HBT (`server/rosterSanitizer.ts:127-131`).
  - Manual and standby flights: always `false` (`src/services/manualFlight.ts:67`).
  - Samples: hand-set.
- The monthly "WOCL night flights" count and the salary night allowance count only `isRedEye` (Calc:1118, 1212).

**"SAFTE"/ReadiScore** (Calc:1230-1351)
- Base 92.
- Wearable sliders: + (actual sleep − target) × 4, and + (efficiency − 85) × 0.3.
- Time of day: −18 if HBT is 02:00-06:00 ("night_nadir"); −6 if 21:00-02:00 or 06:00-07:30.
- Active event: −4 if the primary active event is a flight; −14 if it is a WOCL event.
- Clamped to 45-99. Bands: ≥85 optimal, ≥70 moderate, else fatigue_risk (Calc:1349-1351).
- Without wearable input there are only 9 possible values: 92, 88, 78, 86, 82, 72, 74, 70, 60.
- Labels: "Optimal Vigilance", "Standard Alertness – Routine flight operations compliant", "WOCL Fatigue Risk" (`src/components/CockpitStatus.tsx:78-101`).
- There is no sleep history, time awake, or homeostatic process.
- The "primary" active event is the earliest-starting active event (Calc:1217-1219, 1264).

**Sleep debt and daily risk**
- Per UTC date: debt = max(0, target − sum of `anchor_sleep` and `recovery_sleep` durations starting that date) (Calc:1123-1133).
- Cumulative debt = minutes / 60 × **0.35** ("Damped rolling debt") (Calc:1197). It is computed from the app's own planned sleep, not actual sleep.
- Daily risk: high if WOCL exposure > 120 min, or planned sleep < 300 min on a duty day; moderate if WOCL > 0 or sleep < 390 (Calc:1141-1142). Off days are always "low" (Calc:1187).
- The `keyGuidance` text (Calc:1144-1151) is never displayed.

**FDP and compliance**
- `fdpCompliant: true` and `maxFdpHours: 13.0` are hard-coded (Calc:1208-1209). No FDP, rest-period or block-hour limit is calculated anywhere.

**Chronotype**
- Only selectable in Settings (`SettingsView.tsx:151-183`). The "Lark" card claims "Sleep shifted 45m earlier" (`SettingsView.tsx:155`).
- The calculator never reads it. It is sent only to the `/api/roster/ai-advise` prompt (`server.ts:338-350`), which no client code calls.

**Bunk shift**
- A "Shift 1 (Early Bunk) / Shift 2 (Late Bunk)" selector appears for flights ≥300 min (`src/components/views/TodayView.tsx:508-550`; `src/components/TimelineView.tsx:903-945`). It is stored in `bunkShiftAssignments`.
- The calculator never reads it (grep). `FlightLeg.bunkShift` (`types:28`) is also unused.

**Debrief, grooming and commute buffers**
- `preferences.debriefMinutes` (default 30, Calc:517) has no Settings control. It only feeds `debriefStartHbt` and `debriefEndHbt`, which are never displayed.
- Today and Timeline show "Debrief & Duty Release" = touchdown + 15/30/45 min from local, unsaved component state, default 30 (`TodayView.tsx:62, 553-583`; `TimelineView.tsx:87, 983-1013`).
- The Master Sheet uses a fixed +30 (`src/components/MasterRosterOverview.tsx:687`).
- The calculator's post-duty timing uses the roster's `releaseTimeUtc`. When the roster gives none, that defaults to arrival + 30 min (`server/rosterSanitizer.ts:19, 82-87`; `manualFlight.ts:63`).
- Report time defaults to departure − 75 min (`rosterSanitizer.ts:18, 75-80`; prompt `server.ts:138-139`; manual add `src/components/RosterHistoryTable.tsx:159`), or − 60 min for a standby callout (`src/components/TacticalDutyModal.tsx:67`).

**Salary** (Calc:118-194)
- Total = base + round(flying hours × rate) + round(standby hours × rate) + layovers × per diem + red-eye sectors × night rate.
- Flying hours = sum of all roster flight durations (departure to arrival) / 60.
- `standbyHours = roster.standbyHours || 16` (Calc:127; also Calc:1196).
- `layoverCount = roster.layovers?.length || 2` (Calc:128).
- Rate tables for INR, AED and USD × junior, senior and lead (Calc:130-146). Example: INR senior is base 48,000, ₹620/h, standby ₹300/h, ₹6,000 per layover, ₹2,500 per night sector.
- Custom or payslip rates override the table (Calc:155-159).

### Inferences
- **Inference:** Settings exposes three controls (chronotype, melatonin, bunk shift) plus a "wearable" calibration that change no schedule, and the 6/8 h caffeine choice changes only some cutoffs. Users may believe they are personalising the plan.
- **Inference:** With the default sample roster (28 flights, 5 flagged red-eye), the hand-computed INR senior salary is ₹124,296 (flying 75.8 h). It includes 16 assumed standby hours and 2 layovers that are not derived from the roster.

### Gaps
- Behaviour was not verified by running the app or tests. No test file covers `circadianCalculator.ts`; `tests/` has 6 files for other modules.

## Q2. Workout or exercise guidance

### Takeaway
There is no workout feature: no exercise event type, setting, schedule or science content. Movement appears only as incidental tip text, and most of it is rarely or never shown.

### Cited Findings
- Event types contain no exercise type (`src/types/circadian.ts:42-57`).
- WOCL citation tip: "Stay active in the cabin, hydrate every 30 minutes ... avoid long seated periods in dim light" (Calc:113).
- WOCL status strings: "Stay active and cross-check tasks with crew" (Calc:1313) and "Engage physical movement" (Calc:1318).
- Non-WOCL flight citation: "Maintain gentle calf raises and walking to prevent peripheral venous pooling" (Calc:265).
- Active-flight action: "Maintain hourly micro-breaks" (Calc:1273).
- Off-day light tip: "Take a brisk morning walk outside without sunglasses for 20 minutes" (Calc:444).
- Only sleep, nutrition, caffeine, light and WOCL events can open the detail modal (`TodayView.tsx:718, 793, 865`; `TimelineView.tsx:1151, 1230, 1302, 1333, 1352`). No flight card opens one.

### Inferences
- **Inference:** The calf-raise text (a flight citation `explanation`) is never shown in the UI. The ICS export includes only subtitle, organisation, study title and tip (`src/services/icsExport.ts:25`).
- **Inference:** The WOCL movement tips appear only via the Timeline WOCL notice, or if a WOCL event is the "primary" active event, which is rare (see Q5).

### Gaps
- There is nothing in the code to say what workout guidance is intended. Any workout feature would be new.

## Q3. Scientific citations and claims

### Takeaway
There are 14 citation objects: 9 in `CITATIONS` (Calc:51-115) and 5 inline. They are attributed to five organisations only (`types:60`). None gives a year, DOI, URL or page. Most titles look generic or invented, several carry unsourced percentages, and the same NASA figures are stated with the metrics swapped in two places.

### Cited Findings

**Citation objects** (verifiability assessed from the code text alone)

| Key / location | Organisation, title and claim | Verifiability |
|---|---|---|
| anchor_sleep (Calc:52-58) | "ICAO Doc 9966: Fatigue Risk Management Systems Manual"; "Core anchor sleep of at least 4-6 hours maintains cognitive baseline"; room 18-20°C | Specific document number. The exact title and claim need checking. |
| recovery_sleep (Calc:59-65) | NASA Ames "Crew Sleep Banking & Recovery"; post-duty sleep "dampens elevated cortisol" | Generic title, no study named. |
| nasa_nap_26 (Calc:66-72) | "NASA Ames 26-Minute Cockpit Rest Study (Dr. Mark Rosekind)"; "improves cognitive alertness by 54% and physiological vigilance by 34%"; "completely preventing groggy sleep inertia" | Specific and checkable. Note it is a *cockpit* (pilot) study applied to cabin crew. |
| pre_duty_90_nap (Calc:73-79) | Sleep Research Society "Pre-Shift Full Cycle Sleep Architecture in Aviation Crews"; 90-min cycle, late afternoon 15:00-18:00 | No author or year. Unverifiable as written. |
| chrono_nutrition_window (Calc:80-86) | Salk "Dr. Satchin Panda: Circadian Chrono-Nutrition & Peripheral Clocks"; 8-10 h daytime eating window "optimizes insulin sensitivity" | Names a researcher, no paper. |
| gut_rest_night (Calc:87-93) | Salk "Gastrointestinal Chronobiology in Night-Shift Personnel"; "Gastric acid secretion and bowel motility drop by over 50% between 22:00 and 06:00" | Unverifiable as written. |
| caffeine_cutoff (Calc:94-100) | FAA/EASA "Aero-Medical Advisory: Caffeine Pharmacokinetics in Flight Crew"; "5-7 hour half-life and up to 12 hour quarter-life"; stop "6-8 hours before" sleep | No document number. |
| melatonin_shield (Calc:101-107) | Attributed to "ICAO FRMS": "Circadian Photobiology: Preventing Phase Shift with Dark Sunglasses" | Unverifiable. ICAO attribution doubtful. |
| wocl_risk (Calc:108-114) | NASA Ames "Window of Circadian Low (WOCL: 02:00-06:00) Performance Degradation" | Generic title. |
| Inline, report duty (Calc:224-230) | ICAO FRMS "Standard FDP Management"; "light protein snack 30-45 minutes before reporting", "reactive hypoglycemia" | Vague. |
| Inline, flight (Calc:262-267) | FAA/EASA; "Cabin humidity drops under 15% within 45 mins"; "250-350ml water per flight hour" | Specific numbers, no source. |
| Inline, release (Calc:313-319) | ICAO FRMS "Post-Duty Transition & Decompression" | Vague. |
| Inline, off-day light (Calc:439-445) | Sleep Research Society; "Natural sunlight (>10,000 lux) resets the SCN" | Unverifiable title. |
| Inline, prep routine (Calc:619-625) | FAA/EASA; "reduce cognitive rush stress and cortisol spikes by 32%" | Unsourced statistic. Looks fabricated. |

**Other numeric claims in UI and status text**
- "Reaction times lag by 30%" (Calc:1318).
- "restore cognitive vigilance by 34%" (Calc:1334).
- "Hydrate with 250ml water every 45 mins" (Calc:1268).
- Room temperature is given three ways: 18°C (Calc:1280, 1284; `CockpitStatus.tsx:289`), 19°C (Calc:1046) and 18-20°C (Calc:57). The layover hub shows "21°C Optimal" (Calc:1172; `TimelineView.tsx:767`).
- "98% Light Sealed" hotel rating, hard-coded for every layover (Calc:1170).

**Science Lab** (`src/components/ScienceLab.tsx`)
- Header: "The peer-reviewed clinical research and aviation safety manuals powering CrewCircadian" (25).
- NASA: "Pioneered by Dr. Mark Rosekind & Dr. David Dinges" (74). "26-minute nap ... improve physiological alertness by 54% and cognitive psychomotor vigilance performance by 34%" (81). This **swaps the metrics** relative to Calc:69.
- Nap timing: "Around minute 30–35 ... Stage 3/4 ... Sleep Inertia ... lasting 20–45 minutes" (92). Rule: "Either cap nap at <30 mins OR commit to a full 90-minute sleep cycle" (95).
- "Walter Reed Army Institute of Research proved that sleeping 8.5–9 hours per night for 2–3 days ... reducing cognitive lapses by up to 40%" (104).
- Nutrition: "same meal eaten at 02:00 AM produces twice the blood glucose spike compared to noon" (133). "Stomach emptying slows by >50% at night. At 8,000 ft ... gas expands by 25% (Boyle's Law)" (140). 8-10 h window "protects cardiovascular health in shift workers" (147).
- WOCL: "ICAO Doc 9966 & FAA Part 117 / EASA FTL" (159), with WOCL given as "02:00 – 05:59" (162). "Airline accident statistics demonstrate that human error vulnerability multiplies substantially" (165) is vague.
- Layovers: "adjusts ... at an average rate of only 1 hour per day" (172). "For any layover under 36 hours, maintain sleep and nutrition pinned ... to HBT" (175). "If staying >48 hours ... 20–30 minutes of natural outdoor sunlight between 08:00 and 10:00 local" (207).
- Light: "ipRGCs ... ultra-sensitive to blue-sky wavelengths (460–480 nm)" (192).
- The `initialTopic` prop is unused, so the NASA tab always opens (6-10).

**Elsewhere in the UI and server**
- Footer: "Clinical rules based on NASA Ames Fatigue Countermeasures, ICAO Doc 9966, and Salk Institute Chrono-Nutrition research" (`src/App.tsx:637`).
- Salary note: "DGCA CAR Section 7 / FAA Part 121 mandates a strict rolling 30-day cap of 100 block hours" (`src/components/SalarySection.tsx:371-374`).
- Timeline: "FAR Part 117 / DGCA FDP Compliant" (`TimelineView.tsx:304`).
- The unused AI-advice prompt claims grounding in NASA, ICAO 9966 and Salk (`server.ts:347`).

**Citation mismatches**
- The 150-min red-eye bank cites the 90-min citation (Calc:985).
- The pre-duty 13:00 bank cites recovery sleep (Calc:916).
- "Caffeine allowed" windows cite the *cutoff* citation (Calc:711, 824, 939).
- Pillar links are hard-coded: "Why: Dr. Satchin Panda Gut Research" (`TodayView.tsx:798`) and "Why: Adenosine & Sleep Architecture" (`TodayView.tsx:870`).

### Inferences
- **Inference:** Only three items name something traceable: ICAO Doc 9966, the Rosekind/NASA cockpit-rest study, and Satchin Panda/Salk. Even these come with unsourced numbers.
- **Inference (for the evidence team to verify):** FAR Part 117 is generally understood to govern flightcrew (pilots), not cabin crew.

### Gaps
- No claim was checked against external literature (out of scope for this audit). The evidence team should check the 54%/34% mapping, the 32%, 30%, 40%, ">50%", "25% gas expansion", "1 h/day", "15% humidity" and ">10,000 lux" figures, and the Doc 9966 title.

## Q4. Overstated precision and hard-coded assumptions

### Takeaway
The app shows minute-level (and second-level) times, an integer 0-100 "SAFTE" score and "verified/compliant" badges, none of which the computations support. Most anchors are hard-coded to an Indian (DEL, UTC+5.5) context with fixed clock times.

### Cited Findings

**Precision overstated**
- Every event is shown as HH:MM (Calc:35-41).
- The header shows live clocks with seconds (`src/components/Header.tsx:37-51`).
- "SAFTE {n}/100" (`CockpitStatus.tsx:165, 225`) comes from a 9-value lookup (Q1).
- Sleep debt is shown to 0.1 h after an arbitrary × 0.35 (Calc:1197; `TimelineView.tsx:297`).
- "Live Bio-Clock HUD (Right Now)" (`CockpitStatus.tsx:145`) is computed only when the plan regenerates (`App.tsx:105-107`; Calc:1215). The 1-second header timer re-renders only the header.
- Hard-coded reassurance labels:
  - "Rhythm: Synced" (`src/components/Sidebar.tsx:242`).
  - "Aligned with Base {homeBase}" (`CockpitStatus.tsx:297-299`).
  - "Eliminates mental calculation" (`TodayView.tsx:193`).
  - "Zero mental math" (`TimelineView.tsx:529`).

**Compliance and verification claims with no logic behind them**
- "DGCA & FAA Limits Verified" (`TimelineView.tsx:198`).
- "FAR Part 117 / DGCA FDP Compliant (13h ceiling)", always rendered (`TimelineView.tsx:304`).
- "DGCA / FAA Compliant" under off days (`MasterRosterOverview.tsx:301`).
- "100h max"/"100h Cap" progress bars (`TimelineView.tsx:238-247`; `MasterRosterOverview.tsx:269-279`).
- A standby bar fixed at 2/5 width (`TimelineView.tsx:259`).
- Mock document "STATUS: RECOGNISED ... ALL TIMINGS VERIFIED" (`MasterRosterOverview.tsx:516-517`).
- "Verified Airline Payslip Samples": loading a sample sets `payslipUploaded: true`, which shows the "Payslip Verified" badge (`SalarySection.tsx:46-99, 192-195, 591`).
- "Projected Monthly Take-Home Pay" is gross, with no deductions (`SalarySection.tsx:280`).

**Hard-coded assumptions**
- DEL / UTC+5.5 defaults in many places:
  - App defaults (`App.tsx:38-39`).
  - Empty roster (`src/services/rosterHistoryService.ts:24`).
  - Upload fallbacks (`src/components/views/UploadView.tsx:279-281, 659`).
  - Standby form: home base `DEL`, flight "6E 215", tz fallback 5.5 (`TacticalDutyModal.tsx:35, 42-44, 68`).
  - Header base picker `ap?.tzOffset || 5.5` (`Header.tsx:212`).
  - AI prompt: "Timings on rosters are usually in ... IST/UTC+5.5" (`server.ts:136`).
- HBT is a single fixed offset for the whole roster, so daylight-saving changes are ignored. Quick base picks use static offsets, e.g. LHR = +1 all year (`SettingsView.tsx:41`; `src/data/airports.ts:39`). The `airports.ts` static offsets mix summer values (LHR, CDG, FRA, JFK, ORD, SFO) with standard ones (SYD), despite the "standard-time" comment (`types:8`).
- Fixed clock anchors:
  - WOCL 02:00-06:00 HBT and the 01:30-06:00 departure test (Calc:244, 1244).
  - Bedtime 23:00 HBT on off, daytime and evening days (Calc:375, 544, 557).
  - Caffeine cutoff 17:00 on off and daytime days (Calc:381, 831).
  - Meals 08:30 or 09:00 + 10 h (Calc:378, 853, 946).
  - Bank nap 13:00 (Calc:901).
  - Light 03:00 UTC (Calc:432).
  - Layover breakfast "08:00 local" (Calc:1171).
- "60m to STD" label is fixed (`TodayView.tsx:307`; `TimelineView.tsx:647`). Sample report leads vary from 30 to 90 min, e.g. fl-02 has 30 min (`src/data/rosterPresets.ts:70-72`).
- Chronotype default is `intermediate` and unused.
- India-specific copy: "chai" (`TimelineView.tsx:734`), "BA breathalyzer" (`TodayView.tsx:315`), "IST".
- Sample data contradicts its own labels:
  - "32 Sectors" but 28 flights (`rosterPresets.ts:33`).
  - "04:30 AM check-in" but data is 05:30 IST (`rosterPresets.ts:568, 587`).
  - The SIN layover is labelled 28.5 h, but its own start and end give 52.5 h; BKK is labelled 22 h but spans 46 h (`rosterPresets.ts:544-556`).

### Inferences
- **Inference:** For a London base the off-day "morning light" event falls at 03:00-04:00 local (winter) or 04:00-05:00 (summer). For Dubai it is 07:00-08:00.

### Gaps
- None.

## Q5. Edge cases

### Takeaway
The day-by-day template does not look at neighbouring days, actual location, or rest between duties. On the default sample roster this produces overlapping and contradictory instructions: sleeping during a flight, sunglasses and "go outside without sunglasses" at the same hour, and an off-day 23:00 bedtime the night before a 04:30 wake-up.

### Cited Findings and traced cases
- **Early report (04:00 HBT, DEL)** (Calc:503, 527-530, 738-739):
  - Prep start is 02:00, bedtime 18:30 the previous day, caffeine cutoff 12:30 (6 h).
  - The eating window opens at 02:45, inside the app's own "biological night" (gut_rest_night 22:00-06:00, Calc:90; Science Lab "03:00 AM" warning, `ScienceLab.tsx:125`).
  - A 04:00 IST report is 22:30 UTC the previous day. The duty is therefore filed and labelled under the previous date (Calc:330, 1179).
  - **Inference:** The "Prior-Day Sleep Bedtime" banner (`TodayView.tsx:352-372`) then names a date one day too early.
- **Discontinuity at 03:30:** a report at 03:29 is "red-eye" (2.5 h bank). A report at 03:30 is "early" (7.5 h sleep from 18:00) (Calc:503, 506).
- **Back-to-back duties, short rest. Inference, traced on the default 30-day sample:**
  - Day 3 DEL→DXB red-eye (release 05:30 IST) and day 4 DXB→DEL (report 05:45 IST) fall on different UTC dates (`rosterPresets.ts:146-180`). They become a red-eye day plus an independent "early" day.
  - Day 4's "Pre-Duty Anchor Sleep" runs 20:15-03:45 IST, overlapping the day-3 bank, briefing and entire flight.
  - Day 4 also gets a 03:45 wake alarm and a "crew car arrives at your door" cab at 04:45 while the crew is in Dubai.
  - Day 3's 07:30-13:00 recovery sleep overlaps the day-4 flight (06:30-10:00).
  - Day 3's in-flight caffeine cutoff (02:30-13:00) overlaps day 4's "Optimal Caffeine Window" (05:15-09:15).
  - The same pattern recurs on days 9/10 (BOM-DOH-BOM) and in the "Red-Eye Gulf Turnaround" sample.
  - No rest period or minimum-rest check exists anywhere (FDP hard-coded, Calc:1208).
  - Separate duties on one UTC date are merged under the first flight's category (Calc:475-476).
- **Night and red-eye flights** (rules in Q1):
  - **Inference:** On day 3 the melatonin shield runs 03:15-06:00 Dubai local, before sunrise.
  - **Inference:** A manually added 23:00-05:00 HBT flight gets red-eye events but no WOCL warning, no WOCL count and no night pay (`manualFlight.ts:67`; Calc:244, 1118).
- **Daytime duty nap inside core sleep.** **Inference:** Sample day 25 (report 08:45 IST) gets core sleep 23:00-06:30 and a "pre-flight nap" 05:45-06:11, inside that sleep (Calc:763-764, 787-788).
  - A target above 7.5 h pushes core sleep into prep, e.g. 9 h ends 08:00 for an 08:30 report.
  - A late-afternoon report at 15:30-16:30 puts the 13:00-14:30 bank nap inside prep time.
- **Off days.** Off days use a fixed template (Q1). **Inference:**
  - The night *after* a duty day followed by an off day has **no sleep event**, because the off-day sleep is 23:00 on the off day itself (Calc:375). Example: arriving SIN 22:00 local on day 14, the first planned sleep starts about 27.5 h after release.
  - The off day before an early duty yields two conflicting sleeps. Day 27 off-sleep is 23:00-06:30; day 28 anchor sleep is 21:00-04:30. Caffeine cutoffs also conflict (17:00 vs 15:00).
  - Day 17 (off, after the SIN red-eye) has "Outdoor Natural Light Reset ... without sunglasses" at 08:30-09:30 IST while the red-eye "Melatonin Shield (Wear Dark Sunglasses)" runs 07:45-10:30 IST (Calc:426-449 vs 1016-1035).
- **Multi-day layovers abroad:**
  - No layover logic. `LayoverInfo.strategy` and `durationHours` are never read (grep).
  - Layover days are off days on HBT. "Local" times for off-day events are actually HBT (Calc:394-397).
  - The Science Lab's 36 h and 48 h rules are not implemented.
  - The layover hub data is constant (Calc:1153-1175).
  - The header "Current Location" uses the roster's *first* flight's destination, not the current position (`Header.tsx:61-69`).
- **Standby:**
  - The parser discards SBY/RSRV duties (`server.ts:131`). The `standby` and `rest_day` event types are never generated.
  - Standby days look like WKOFF rest days. Standby hours default to 16 (Calc:127, 1196).
  - The callout form claims it will "convert standby hours into flying hours" (`TacticalDutyModal.tsx:232`), but standby hours are never reduced.
  - "Ground Duty / Standby Reserve" (`MasterRosterOverview.tsx:626`) is unreachable, because `isOff` is already true when a day has no flights (line 106).
- **Empty roster:**
  - Seven off days are generated from today (Calc:356-364), with the banner "No Active Flights" (`TodayView.tsx:94-116`).
  - Salary still adds 16 standby hours and 2 layovers. **Inference:** For INR senior that is ₹64,800.
- **Uploading over the sample:**
  - The upload merges into the current roster whenever it has flights (`UploadView.tsx:379-428`). `activePresetId` is used only for highlighting (line 1304).
  - Non-overlapping flights are kept side by side (`src/services/rosterMerger.ts:46-71, 120`).
  - **Inference:** A new user's first upload can mix the fictional "Priya Sharma" sample flights with real flights unless they clear the roster first.
  - Uploaded rosters carry no standby or layover data (`UploadView.tsx:456, 661`), so the 16 h and 2-layover defaults apply.
- **Status during flights.** **Inference:** The primary active event is the earliest-starting one (Calc:1264).
  - During early-duty flights it is the eating window (no branch), so the HUD says "Biological System Aligned" with no flight penalty.
  - During red-eye flights it is the gut-rest fast, so the WOCL −14 essentially never applies.
  - The default `stateType` 'alert' (Calc:1222) displays as "Active Flight Duty" (`CockpitStatus.tsx:29-35`), including on off days between 08:30 and 17:00.

### Inferences
- **Inference:** Several of these failures appear in the roster every new user sees by default (`App.tsx:64-68`).

### Gaps
- Behaviour was not executed. The traced times assume default preferences (7.5 h, 60 + 60 min buffers, 6 h cutoff).
- Per project memory, the live Gemini upload path has never been run with a real key (as of 2026-09-30), so the accuracy of parsing real rosters is unknown.

## Q6. UI complexity versus the calm, minimal vision

### Takeaway
The app has 7 primary screens plus about 6 modals, and dense dashboards with many badges, jargon and duplicated blocks. Core advice (sleep, meals, caffeine, light) is spread across two near-identical screens, while the Today screen omits light and sunglasses advice altogether. Salary, AIMS audit and history features are unrelated to the circadian vision.

### Cited Findings

**Screens**
- Sidebar, 7 items: Today's Duty ("Live"), Chrono Timeline, Master Duty Sheet ("AIMS"), Salary & Earnings (badge "₹…k"), Roster & History, Buffers & Rhythm, Science Lab (`Sidebar.tsx:44-97`).
- Mobile bottom bar, 5 tabs: Today, Timeline, Sheet, **Salary**, Upload (`App.tsx:645-651`).
- Every screen also shows:
  - Header with two live seconds clocks, UTC badges, "Live Anchor", base picker and Export .ICS (`Header.tsx:118-196`).
  - Sidebar profile box with "Aero-Chrono v2.4" (`Sidebar.tsx:138`).
  - Citation footer.

**Today screen**
- CockpitStatus (`CockpitStatus.tsx:107-307`): urgency badge, action, SAFTE score, phase meter, next action and countdown, protocol box, "Science ➔", "Why this window?".
- Day carousel with one chip per roster day (`TodayView.tsx:122-179`). "Today" means the roster's first day, not the current date (59, 161). Samples start tomorrow UTC (`rosterPresets.ts:16`).
- Pre-flight runway: 4 steps, grooming and cab ± controls, copy-alarms button, bedtime banner, caffeine banner (182-401).
- Four "pillars": flights, sleep, nutrition, caffeine (403-883).
- `alertEvents` and `lightEvents` are computed but **never rendered** (77-78). The melatonin shield, WOCL warning and light advice are therefore missing from Today.
- **Inference (estimate):** A 2-sector early duty day shows roughly 30 badges or pills and about 30 clock times.

**Timeline screen** (`TimelineView.tsx`)
- Monthly stats: 5 tiles, sleep debt, FDP badge (188-308).
- Salary Studio embedded inline (311-318).
- Month, week and day navigators (320-513).
- The same runway (515-741), a layover hub (743-771), the same four pillars (773-1320), and light and WOCL notices (1322-1358).
- Per-sector "Real-Time Tactical Changes": Delay, Cancel/Layover, Delete (947-980).

**Master Duty Sheet** (`MasterRosterOverview.tsx`)
- "AIMS / NetLine" table, split-screen document verification, zoom, print, 5 stat tiles including "Audit Check %", search and 5 filters, verify checkboxes (208-719).
- Reachable three ways: sidebar, Roster tab (`src/components/views/RosterView.tsx:60-70`), and the Timeline button (`TimelineView.tsx:208-217`).

**Other screens and modals**
- Salary (`SalarySection.tsx`): 3 tabs, 5 pay pillars, airline-branded sample payslips (IndiGo, Emirates, Air India/Vistara), and Gemini payslip upload.
- Upload/History, by headings: multi-file OCR hub, presets, text paste, audit history table, manual sector add, conflict resolution modal (`UploadView.tsx:688-1513`; `RosterHistoryTable.tsx:272-796`; `src/components/ConflictResolutionModal.tsx:77`).
- Settings: 3 sections (`SettingsView.tsx`).
- Science Lab: 4 tabs.
- Modals: EventDetailModal ("Critical Safety Window", "The Biological Mechanism", `src/components/EventDetailModal.tsx:39-85`), TacticalDutyModal and others.

**Jargon counts**
These are raw occurrences in the UI files plus the calculator and samples. They include code identifiers and comments, so they over-count visible text.

| Term | Occurrences | Files |
|---|---|---|
| WOCL | 28 | 7 |
| HBT | 45 | 6 |
| SAFTE | 9 | 3 |
| Tactical | 30 | 3 |
| AIMS | 15 | 6 |
| NASA | 20 | 6 |
| ICAO | 12 | 5 |
| Salk | 12 | 5 |
| FAA | 10 | 6 |
| DGCA | 6 | 4 |
| WKOFF | 8 | 4 |
| Aero-OCR | 3 | 2 |
| "verified" | 29 | 5 |
| "compliant" | 4 | 4 |

Visible jargon examples:
- "Core Nadir (WOCL)" (`CockpitStatus.tsx:253`)
- "Biomathematical" (Calc:498)
- "suprachiasmatic nucleus (SCN)" (`TimelineView.tsx:1329`)
- "Adenosine & Sleep Architecture" (`TodayView.tsx:870`)
- "Phase Response Curve" (`SettingsView.tsx:299`)
- "Master Sheet (AIMS)" (`TimelineView.tsx:215`)
- "Gemini Aero-OCR" (`App.tsx:194`)

**Duplications**
- Runway and four pillars appear in both Today and Timeline. The copy differs slightly, e.g. "tea" vs "chai" (`TodayView.tsx:394` vs `TimelineView.tsx:734`).
- Grooming and cab controls appear in 3 places (Today, Timeline, Settings).
- Monthly stat tiles appear twice (Timeline and Master Sheet).
- Home base can be set in the Header and in Settings. Currency and rank can be set in Settings and in Salary.
- Release time is shown 3-4 different ways: per-card 15/30/45 toggle, Master Sheet +30, unused preference, roster `releaseTimeUtc`.
- Bedtime is shown in a banner, a sleep card and copied text.
- "Science" entry points: header-level button, "Why this window?", per-event "Why", sidebar, footer.

**Dead or unshown content**
- `bedtimeExplanation` is shown only if `targetBedtimeHbt` is empty, which never happens (Calc:529, 546, 559, 573; `TodayView.tsx:378`).
- `keyGuidance`, `avgSleepPerDay` and `eatingWindowHours` are never rendered (grep).

**Unrelated to the core vision**
- Salary Studio and payslip OCR (Calc:118-194; `SalarySection.tsx`).
- AIMS audit and verification sheet.
- Roster audit-history log.
- Fictional named crew in the samples ("Priya Sharma", "Karan Patel", `rosterPresets.ts:39, 656`).
- Unused AI-advice endpoint (`server.ts:329-374`; no client caller).

### Inferences
- **Inference:** The "minimal, no redundant information" vision is far from the current state. Most visual weight goes to times, badges and authority labels rather than one or two clear actions.
- **Inference:** The most important safety-adjacent advice (sunglasses, light, WOCL) is the least visible on Today.
- No ads were found in the code.

### Gaps
- Screens were not rendered. Counts and density are estimated from JSX.
- UploadView (1,546 lines) and RosterHistoryTable were skimmed by headings, not read fully.
