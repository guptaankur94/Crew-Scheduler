# Psychology, Behaviour Change, Trust and UX Evidence for a Calm, Minimal Circadian App for Cabin Crew

Evidence tags: [PR] = peer-reviewed journal article; [Abstract] = conference abstract (peer-reviewed for meeting, not full paper); [Industry] = company/vendor/marketing data; [Design] = design literature; [News] = news report; [Reg] = regulator/government; [Thesis] = dissertation/grey literature.

Product context noted from the repo (for implications): the current app shows a "SAFTE {score}/100" biomathematical score and a "WOCL Fatigue Risk" label in `src/components/CockpitStatus.tsx`, "Why: {scientificCitation.organization}" lines in `src/components/TimelineView.tsx`, sector badges, and screens with names like Cockpit, Tactical Duty and Science Lab.

## 1. Adherence: what sleep/circadian interventions do shift workers actually follow, and why?

### Takeaway
Shift workers follow advice that is personalised to their actual roster, is flexible rather than prescriptive, and fits around family and life. Generic sleep-hygiene education alone does not change behaviour. App trials (SleepSync, Sleepfit) show early benefits but also steep attrition and low engagement with most content. Fatigue itself, family duties and roster unpredictability are the main barriers.

### Cited Findings
- [PR] SleepSync user-testing trial (Murray et al., 2023, *Digital Health*). n=27 (20 healthcare, 7 other industries; 63% female; mean age 36; 74% nurses), 2 weeks, no control group, iOS only. Total sleep time went up by 29 min/night (P=.04). Insomnia (P=.02), sleep hygiene, sleep-related impairment, anxiety (P=.001) and stress (P=.006) improved. Depression (P=.07) and recovery on days off (P=.19) did not change significantly. 81% reported better sleep quality and 70% found it easier to fall asleep — [Murray et al. 2023](https://pmc.ncbi.nlm.nih.gov/articles/PMC10064476/)
- [PR] SleepSync features and engagement. Calendar for work *and personal* commitments. "Biologically viable recommendations for sleep timing that account for work and social obligations." Daily sleep/mood logging, a "recovery score" based on adherence, and advice on light from devices and caffeine timing. 67% said it influenced their behaviour, 82% found it easy to integrate into daily routines and 88.9% were satisfied with schedule management. Only 44.4% found editing shifts straightforward, and 29.6% found maintaining personal events difficult — [Murray et al. 2023](https://pmc.ncbi.nlm.nih.gov/articles/PMC10064476/)
- [Abstract] SleepSync in nurses (Varma, Postnova, Knock, Howard, Rajaratnam, Sletten; Sleep Advances 2024 supplement). Open-label, not randomised: n=32 nurses (27 female), 2-week baseline then 6 weeks of personalised recommendations. Insomnia Severity Index fell from 16.4 to 10.2 (p<.001), Sleep Hygiene Index from 27.6 to 20.5, and PVT reaction time improved. Sleep-related impairment did not change. 75% found the app satisfactory and 65.6% would recommend it. The app is described as co-designed with nurses and using biomathematical sleep/alertness models — [Varma et al. 2024 abstract](https://academic.oup.com/sleepadvances/article/5/Supplement_1/A21/7915638)
- [PR] SleepSync was also tested early in Australian Defence Force shift workers (cognitive fitness outcomes); details not retrieved — [SleepSync defence 2024](https://pmc.ncbi.nlm.nih.gov/articles/PMC11203003/)
- [PR] Sleepfit app, RE-AIM feasibility study (*Behavioral Sleep Medicine* 2025). 110 shift workers enrolled. 48% completed post-assessment and only 30.9% followed the full protocol. 85.4% downloaded and used the app but engaged with an average of only 17.3% of activities. Shiftwork-specific modules ("Coping with Shiftwork") had the highest engagement. Reasons for stopping: lack of time, inconvenience, losing interest — [Sleepfit RE-AIM 2025](https://www.tandfonline.com/doi/full/10.1080/15402002.2025.2476687)
- [PR] Qualitative evidence synthesis (Scand J Work Environ Health 2025; 28 studies, 1,519 shift workers). Three themes:
  - Fatigue is accepted as "part of the job", with peer pressure to "soldier through".
  - Family obligations override sleep, with gendered domestic expectations and guilt about sleeping in family hours.
  - There is a knowledge–behaviour gap, and fatigue and stress erode self-regulation.

  Workers were sceptical of generic advice and feared employer repercussions for disclosing fatigue. The authors concluded: "sleep education alone is unlikely to be effective… Interventions should focus on helping shift workers self-regulate their behaviors, thoughts, and emotions" — [Shift workers' experiences synthesis 2025](https://pmc.ncbi.nlm.nih.gov/articles/PMC12281556/)
- [PR] Delphi consensus "Healthy sleep practices for shift workers" (Shriane et al., 2023, *SLEEP*). 18 guidelines; 84% of experts agreed shift workers need tailored guidelines. Standard sleep hygiene conflicts with fatigue management on three points: it advises against napping, says to avoid caffeine 6–8 h before bed, and requires regular sleep times, which is "impractical" on rotating rosters. Key guidelines:
  - Aim for 7–9 h per 24 h, in one block or split.
  - Naps of 15–20 min for alertness, or about 90 min to reduce sleep debt.
  - Allow for sleep inertia of 15–30 min (up to 2 h).
  - Wear sunglasses after night shifts.

  Experts asked for "a softening of the language". Specific doses were removed. The guidelines stress "everyone is different" and "trial and error". 85% of shift workers had little understanding of the term "sleep hygiene" — [Shriane et al. 2023](https://pmc.ncbi.nlm.nih.gov/articles/PMC10710992/)
- [PR] Co-designed sleep resources for young shift workers aged 18–25 (Shriane et al., *Sleep Medicine* 2025). 48 co-designers. Themes: sleep science, impacts of poor sleep, habits, strategies, workplace recommendations. Output formats were a website, a pictorial infographic, an animated video and social media. Behavioural impact was not yet evaluated — [Shriane et al. 2025](https://www.sciencedirect.com/science/article/pii/S1389945725001790)
- [PR] Digital CBT-I adapted for shift work (SleepCare; Ell et al., 2024, *J Sleep Res*; nurses with shift work disorder; pilot RCT). It improved insomnia, sleep, mental health and occupational functioning. The ISI fell by 5.4 points, compared with an average of 3.1 points in a meta-analysis of CBT-I in shift workers. The intervention was *guided* — [Ell et al. 2024](https://onlinelibrary.wiley.com/doi/10.1111/jsr.14193)
- [PR] Scoping review: app-based dCBT-I RCTs in shift workers have had samples of 27–83. Earlier evidence was judged insufficient because of methodological heterogeneity — [dCBT-I scoping review 2025](https://pmc.ncbi.nlm.nih.gov/articles/PMC12206534/)
- [PR] Behavioural therapy for shift work disorder (Vallières et al., 2024, *J Sleep Res*, Canada). n=43 (77% female, mostly nurses), 6 mostly face-to-face sessions. Adherence to procedures rose from 64% in week 1 to 81–82% later. Attrition was 32.6%. Large effects on daytime insomnia (−1.25 to −1.95), and 92% were no longer diagnosed with shift work disorder — [Vallières et al. 2024](https://pmc.ncbi.nlm.nih.gov/articles/PMC11596990/)
- [PR] Anonymous personalised online counselling RCT (Retzer et al., 2026, *Sci Rep*, Germany). 66 participants, 59% dropout. Sleep efficiency improved in *both* the intervention group (d=0.66) and controls (d=0.93), with no group difference — [Retzer et al. 2026](https://www.nature.com/articles/s41598-026-64210-7)
- [PR] Cabin crew: early starts are associated with roughly 2 h less sleep, and long-haul and eastward flying with worse sleep. One included study reported workday sleep of 4.6 h against a self-perceived need of 8.1 h — [Wen et al. 2023 scoping review](https://pmc.ncbi.nlm.nih.gov/articles/PMC9916232/)

### Inferences
- The strongest adherence lever is fit to the real roster and real life (family, commute, social plans). The app should accept "I can't sleep then" and re-plan, rather than present one ideal schedule.
- SleepSync's weakest usability points were editing shifts and maintaining personal events. Effortless roster import and correction (AI upload) and one-tap "I'm busy then" inputs matter more than extra content.
- Engagement concentrates on shift-specific practical content (Sleepfit). Keep the content minimal and roster-specific; drop generic sleep-hygiene essays.
- Use softened, non-prescriptive language with ranges ("aim for", "if you can"), per the Delphi experts. Avoid absolutes like "you must sleep at 14:00".
- Expect large drop-off within 2 weeks in every trial. The core value must be delivered in a glance without logging; heavy daily logging is a dropout risk.
- No study tested an app in cabin crew. All evidence comes from nurses, defence and mining populations.

### Gaps
- No controlled trial of SleepSync with full results was found; the 2024 nurse study is an uncontrolled abstract.
- No adherence data were found on which specific recommendations (nap vs light vs caffeine vs meal timing) are actually followed.
- No app intervention studies in cabin crew, or in Indian or Gulf crew, were found.
- The commuting burden for Indian crew (e.g., long city commutes before early reports) is undocumented in the sources retrieved.

## 2. Behaviour-change frameworks and notification evidence

### Takeaway
Behaviour needs capability, opportunity and motivation (COM-B), plus a prompt at a moment when the action is easy (Fogg). Habits need a stable cue and weeks to form, which irregular rosters break. Event-anchored "if–then" plans and a few well-timed, contextual nudges are therefore the better fit. Notifications have small positive effects. Batching or limiting them improves wellbeing, and spammy apps get uninstalled.

### Cited Findings
- [PR] COM-B (Michie, van Stralen & West, 2011): behaviour occurs when Capability, Opportunity and Motivation are present. It sits at the core of the Behaviour Change Wheel, with 9 intervention functions — [Michie et al. 2011](https://implementationscience.biomedcentral.com/articles/10.1186/1748-5908-6-42); [overview](https://www.sciencedirect.com/topics/psychology/com-b-model)
- [Design] Fogg Behavior Model (2009; B=MAP): behaviour happens when Motivation, Ability and a Prompt converge. Ability factors include time, money, physical effort, "brain cycles" and "non-routine". Prompts can be spark, facilitator or signal types — [Decision Lab](https://thedecisionlab.com/reference-guide/psychology/fogg-behavior-model); [Behavioral Scientist](https://www.thebehavioralscientist.com/articles/fogg-behavior-model)
- [PR] Habit formation: median 66 days to automaticity, range 18–254 (Lally 2010, n=96) — [Univ. of Surrey](https://www.surrey.ac.uk/news/does-it-really-take-66-days-form-habit-we-asked-expert-dr-pippa-lally). A 2024 meta-analysis (20 studies, 2,601 participants) found medians of 59–66 days, means of 106–154 days and a range of 4–335 days. Morning and self-selected habits were stronger — [Singh et al. 2024](https://www.mdpi.com/2227-9032/12/23/2488)
- [PR] Implementation intentions ("if X, then I will Y"): meta-analysis of 94 studies, >8,000 participants, d=0.65 for goal attainment (Gollwitzer & Sheeran 2006) — [KOPS](https://kops.uni-konstanz.de/handle/123456789/10973)
- [PR] Sleep hygiene trial in 72 students: implementation intentions and self-monitoring both improved sleep. Only implementation intentions increased avoidance of stressful activities before bed (Mairs & Mullan 2015) — [Springer](https://link.springer.com/article/10.1007/s12529-015-9467-1)
- [PR] JITAIs (Nahum-Shani et al., 2018) are built from decision points, intervention options, tailoring variables and decision rules. The aim is "the right type/amount of support, at the right time" — [PubMed](https://pubmed.ncbi.nlm.nih.gov/27663578/)
- [PR] Wang & Miller meta-analysis: JITAI g=1.65 vs waitlist and 0.89 vs non-JITAI. Tailoring to past patterns and current need states was associated with efficacy — [Wang & Miller](https://www.researchgate.net/publication/335656965_Just-in-the-Moment_Adaptive_Interventions_JITAI_A_Meta-Analytical_Review). A 2025 meta-analysis of JITAIs/EMIs for mental health found a small effect (g=0.15). The mapping of this figure to the linked paper is from the search summary — [2025 meta-analysis](https://www.researchgate.net/publication/396035471_Effectiveness_of_just-in-time_adaptive_interventions_for_improving_mental_health_and_psychological_well-being_a_systematic_review_and_meta-analysis)
- [PR] Micro-randomised trial of push notifications (Bidargaddi et al., 2018; 1,255 users; 89 days):
  - A notification raised the chance of engagement in the next 24 h by 3.9% (RR 1.039).
  - The effect was 8.7% on weekends vs 2.5% on weekdays (difference not significant).
  - The effect was 11.8% at 12:30 pm on weekends.
  - The effect attenuated over the study, but not significantly.

  The authors' advice was to send at moments of receptivity — [JMIR mHealth 2018](https://mhealth.jmir.org/2018/11/e10123/)
- [PR] Batching notifications (Fitz et al., 2019, *Computers in Human Behavior*; randomised field experiment, n=237). Participants whose notifications were batched 3 times a day felt more attentive, productive, in a better mood and more in control of their phones than controls — [Fitz et al. 2019](https://www.semanticscholar.org/paper/Batching-smartphone-notifications-can-improve-Fitz-Kushlev/ce19cf66bdc6ced56a2f16d2483d97f9dc59b21d)
- [Industry] CleverTap 2019 survey (>2,000 users): 28% uninstalled apps because of too many ads and notifications. Other widely circulated figures (e.g., "71% uninstall due to annoying notifications") come from marketing aggregators without traceable primary data — [CleverTap](https://clevertap.com/blog/uninstall-apps/); [Business of Apps](https://www.businessofapps.com/marketplace/push-notifications/research/push-notifications-statistics/)
- [PR] Systematic review: tailoring, individualised push reminders, user-friendly design and personal support all improved mHealth adherence — [PMC9178451](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC9178451/)

### Inferences
- **Capability:** almost none is needed if the app gives one clear next action. **Opportunity:** this is the binding constraint (roster, family, hotel), so the plan must adapt to it. **Motivation:** crew are already motivated by fatigue, so the app should not lean on gamification.
- Clock-time habits are impossible on irregular rosters. Anchor guidance to roster events instead: "after you check in at the hotel → dark room, sleep until X", or "on the way to report → light/caffeine now". This is an event-based implementation intention.
- Notifications should be opt-in, few, and tied to roster decision points (pre-report, landing, layover arrival, pre-sleep). A daily digest beats scattered alerts. No streaks.
- Do not deliver prompts during known sleep windows. A sleep app that wakes you destroys trust.

### Gaps
- No notification-frequency trial in shift workers or crew was found.
- Optimal number of prompts per day is unknown.
- Bell et al. 2023 (Drink Less MRT; habituation data) full text was not retrieved — [JMIR 2023](https://mhealth.jmir.org/2023/1/e38342).
- It was not verified whether Fitz et al. found that receiving *no* notifications increased anxiety/FOMO.

## 3. Psychological risks, uncertainty, explanations and calibrated trust

### Takeaway
Sleep scores and trackers can create anxiety and perfectionism (orthosomnia), especially in younger, employed and perfectionistic people. Negative sleep feedback can itself make people feel worse the next day. Trust is best built by:
- brief, plain explanations of *why* a recommendation exists;
- honest uncertainty given as numbers or ranges, not vague hedging;
- letting users adjust the plan.

A precise-looking 0–100 score works against all of these.

### Cited Findings
- [PR] Baron et al. (2017, *J Clin Sleep Med*) coined "orthosomnia": patients whose perfectionistic pursuit of tracker-defined ideal sleep worsened their sleep — [Baron et al. 2017 (DOI 10.5664/jcsm.6472)](https://doi.org/10.5664/jcsm.6472)
- [PR] Jahrami et al. 2024 (*Brain Sciences*, Gulf-based authors), n=523. 35.8% regularly used trackers. Orthosomnia prevalence was 3.0%, 8.6% or 14.0% depending on the cut-off. Cases had more severe insomnia — [Jahrami et al. 2024](https://www.mdpi.com/2076-3425/14/11/1123)
- [Abstract] US national survey (Goel, …, Czeisler, Robbins; *SLEEP* 2026 supplement), n=1,280. 32.4% track their sleep, and 30.9% of trackers screened positive for orthosomnia risk, about twice prior estimates. Tracking was more common in younger adults. 70.4% track to improve sleep — [SLEEP 2026 abstract](https://academic.oup.com/sleep/article/49/Supplement_1/A246/8674102)
- [PR] Bergen Orthosomnia Scale (Guldbrandsen, Baron et al., *Frontiers in Sleep*, Oct 2025). 12 items in two factors, interference and rigidity. Correlations:

  | Construct | Interference | Rigidity |
  |---|---|---|
  | Dysfunctional sleep beliefs | 0.45 | 0.30 |
  | Perfectionism | 0.35 | 0.21 |
  | Health anxiety | 0.32 | 0.16 |
  | Insomnia | 0.28 | negative |

  Younger age was associated with stronger interference, and being employed with both factors. Tracking itself was only "tangentially related" — [Guldbrandsen et al. 2025](https://www.frontiersin.org/journals/sleep/articles/10.3389/frsle.2025.1640355/full)
- [PR] Sham sleep feedback (Gavriloff et al., 2018, *J Sleep Res*; n=63 with insomnia). Being told you slept badly reduced alert cognition (d=0.79) and increased sleepiness/fatigue (d=0.55), with no change in objective vigilance — [Gavriloff et al. 2018](https://onlinelibrary.wiley.com/doi/10.1111/jsr.12726). Nuance: a pilot in healthy sleepers found poor false feedback did not affect pre-sleep arousal — [Springer 2022](https://link.springer.com/article/10.1007/s41105-022-00390-9)
- [PR] Wearables and health anxiety (Rosman et al., 2024, *JAHA*; 172 AF patients). 1 in 5 wearable users reported intense fear when alerted. Users were more preoccupied with symptoms and used more healthcare — [JAHA](https://www.ahajournals.org/doi/10.1161/JAHA.123.033750); an editorial cautions against overstating this — [JAHA editorial](https://www.ahajournals.org/doi/10.1161/JAHA.124.035962)
- [PR] Readiness/recovery scores (Ibrahim et al., 2024; 17 Oura/Whoop users). Users changed non-exercise behaviours "to manage and optimize their scores" but recognised device errors. They "prioritize self-awareness, flexibility, and personal judgment" — [Europe PMC/PubMed 38668986](https://pubmed.ncbi.nlm.nih.gov/38668986/)
- [PR] Uncertainty (van der Bles et al., 2020, *PNAS*). Giving uncertainty *numerically* (ranges) slightly lowered confidence in the number but barely affected trust in the source. Vague *verbal* uncertainty reduced trust — [van der Bles et al. 2020](https://www.researchgate.net/publication/340105395_The_effects_of_communicating_uncertainty_on_public_trust_in_facts_and_numbers)
- [PR] Explanations (Cadario, Longoni & Morewedge, 2021, *Nature Human Behaviour*). Resistance to medical AI stems from feeling algorithms are a "black box". Brief interventions that increase subjective understanding of how the algorithm decides raised willingness to use it, including in a field test (N=14,013) — [Nature Human Behaviour](https://www.nature.com/articles/s41562-021-01146-0)
- [PR] Algorithm aversion (Dietvorst, Simmons & Massey, 2018, *Management Science*). People abandon algorithms after seeing them err, but use imperfect algorithms if they can modify them even slightly, and are more satisfied when they can — [Management Science](https://pubsonline.informs.org/doi/10.1287/mnsc.2016.2643)
- [PR] Participatory explainable-AI framework for mHealth (JMIR 2026). Core requirements: human–AI collaboration/clinical validation, transparent logic paths, contextual personalisation, cultural and linguistic relevance, and trust calibration. Users wanted human validation — [JMIR 2026](https://www.jmir.org/2026/1/e87158)

### Inferences
- **Replace the "SAFTE xx/100" score and the "WOCL Fatigue Risk" label as the hero element** with a plain next action ("Sleep 13:30–17:30 at hotel; dark room"). A precise number invites score-chasing, implies false precision (a group-average model shown as a personal truth) and acts as negative feedback on bad days (Gavriloff). If a model output is kept, show it on a secondary screen in coarse bands and words ("lower alertness likely 03:00–06:00").
- Explain each recommendation in one plain-language "why" line ("Your body clock is still on Delhi time; light now helps shift it"). Keep citations behind a tap. Understanding drives uptake more than authority badges.
- Use honest ranges ("about 20–30 min nap") rather than vague hedging. Never say "results may vary" alone.
- Let users nudge the plan (move a nap, skip caffeine). Small control preserves trust when the app is imperfect (Dietvorst).
- Avoid negative framing ("You under-slept by 2 h", "high risk"). Use neutral, forward-looking language ("Tonight, aim to…"). This matters more because the users are young and employed, which the Bergen data link to higher orthosomnia risk.

### Gaps
- No study was found that tests sleep or fatigue scores specifically in shift workers or crew.
- The De Gruyter 2025 evaluation of composite wearable scores could not be retrieved — [link](https://www.degruyterbrill.com/document/doi/10.1515/teb-2025-0001/html?lang=en).
- No direct trial of "why this time?" explanations in sleep apps was found.

## 4. Cabin crew mental health and wellbeing, and implications for a "peace of mind" product

### Takeaway
Cabin crew have very high rates of fatigue and sleep disorder risk. Since the pandemic, half report worse mental health. They carry heavy emotional labour, harassment, loneliness and family separation, and Gulf expatriate crew also face acculturation stress. A "peace of mind" product should therefore reduce load and judgment, not add another performance metric. Employer-reporting fears make privacy central.

### Cited Findings
- [PR] Wen et al. 2023 scoping review (IJERPH; 27 studies; 72% of studies predominantly female; mean age 38.7):
  - 63.5% met fatigue criteria.
  - 46.9% were sleepy.
  - 57.7% were at risk of insomnia and 68.0% at risk of shift work disorder.
  - 33.7% had doctor-diagnosed sleep disturbance; sleep disorder prevalence was reported as 5.7× the general population in female crew and 3.7× in males.
  - Crew are at greater risk of depression and anxiety, and younger crew are more fatigued.

  — [Wen et al. 2023](https://pmc.ncbi.nlm.nih.gov/articles/PMC9916232/)
- [PR] European survey (*J Air Transport Management* 2024; 2,679 cabin crew, 6,379 pilots): 1 in 2 cabin crew report a decline in mental health, and 29% say safety has deteriorated — [Ramp-up in the air](https://www.sciencedirect.com/science/article/pii/S0969699724001078)
- [PR] UK cabin crew (Preston et al., *Economic and Industrial Democracy*, summarised in LSE blog, May 2026). Scores out of 5: burnout 3, workload 3.2, harassment 2.6, managerial support 2.72, peer support 3.66. The blog also cites industry figures (71% sleep problems, 89% exhaustion) whose primary source is unclear — [LSE Business Review](https://blogs.lse.ac.uk/businessreview/2026/05/22/precarious-jobs-caused-by-economic-and-political-disruption-are-causing-burnout-among-cabin-crew/)
- [Industry/union survey] AFA-CWA 2018 (3,568 US crew, 80% women):
  - 68% experienced sexual harassment during their career.
  - In the past year, 35% experienced verbal harassment and 18% physical harassment from passengers.
  - Only 7% reported it to their employer.

  — [AFA-CWA](https://www.afacwa.org/survey_reveals_widespread_harassment_of_flight_attendants)
- [Book/secondary] Hochschild's *The Managed Heart* (1983) coined "emotional labour" from flight attendants trained to suppress their own feelings — [Wikipedia](https://en.wikipedia.org/wiki/The_Managed_Heart). A doctoral thesis found emotional labour affects crew wellbeing (not directly retention) — [White Rose thesis](https://etheses.whiterose.ac.uk/id/eprint/763/)
- [Thesis/qualitative] Long separations from family and partners; relationship impacts "may lead to increased loneliness, anxiety and depression even for resilient crew members" — [London Met](https://repository.londonmet.ac.uk/7636/1/511733.pdf)
- [PR/grey] Middle East airlines: acculturation stress, homesickness and loneliness drive turnover of foreign crew. Rostering was identified as a particular stressor for Emirates crew (as summarised; full texts not reviewed) — [IJERPH PDF](https://pdfs.semanticscholar.org/45e1/8b23376001b3ae2b4773dbcff9e28e35c160.pdf); [MTSU](https://jewlscholar.mtsu.edu/server/api/core/bitstreams/b3490744-40f1-4c8e-a4b2-17cd4d34c84b/content)
- [Industry] Emirates: about 22,000 crew of 140+ nationalities, speaking 70+ languages — [Emirates](https://www.emirates.com/media-centre/celebrating-international-cabin-crew-day-the-emirates-way/)
- [Reg/News] India: DGCA issued draft cabin crew FDTL rules in Oct 2025. IndiGo, Air India and SpiceJet called them "more restrictive" than global norms — [Business Standard](https://www.business-standard.com/industry/aviation/indigo-air-india-spicejet-fdtl-rules-crew-rest-dgca-flight-duty-126021101796_1.html). The Dec 2025 IndiGo scheduling crisis followed new pilot FDTL rules — [Wikipedia](https://en.wikipedia.org/wiki/2025_IndiGo_scheduling_crisis). Reported 2025 *pilot* fatigue-report rejection rates: IndiGo 96.9% (8,449 of 8,721), Air India 54.5% (attribution from search summary; verify) — [BusinessToday](https://www.businesstoday.in/latest/corporate/story/bt-explainer-why-fatigued-indian-pilots-raise-aviation-safety-concerns-528564-2026-05-02)
- [PR] Shift workers fear employer repercussions for disclosing fatigue — [synthesis 2025](https://pmc.ncbi.nlm.nih.gov/articles/PMC12281556/)

### Inferences
- The tone should be warm, brief and non-judgmental, like a calm senior colleague. Avoid military or pilot jargon ("Cockpit", "Tactical"): it mismatches cabin crew identity and adds arousal.
- After a duty full of performing emotions for others, the app must not demand more effort, cheerfulness or "streaks". Give permission ("Rest is the priority today; skip the workout").
- Include gentle recovery support for layovers and days off: wind-down, connecting with family at body-clock-friendly times. Avoid clinical mental-health screening unless done carefully, with links to proper support.
- Data must visibly never go to airlines. Given low fatigue-report acceptance and harassment under-reporting, any hint of employer access would kill trust.

### Gaps
- No peer-reviewed mental health data were found for Indian or Gulf cabin crew specifically, and no harassment surveys for those carriers.
- Loneliness on layovers has not been quantified.

## 5. Calm/minimal design, wellness app retention, business model, willingness to pay and privacy

### Takeaway
Calm Technology principles (minimal attention, use the periphery, the minimum technology needed, work even when it fails) map directly onto the owner's vision. Wellness app retention is very poor across the industry. Annual subscriptions dominate health and fitness, and price, billing frustration and streaks drive churn. Privacy concerns are widespread, and India's DPDP Rules now formalise consent.

### Cited Findings
- [Design] Weiser & Brown (Xerox PARC, 1995), "Designing Calm Technology": technology should move from the periphery of attention to the centre and back; "informing without overburdening" — [calmtech.com paper](https://calmtech.com/papers/designing-calm-technology)
- [Design] Amber Case's 8 principles: technology should
  - require the smallest possible amount of attention;
  - inform and create calm;
  - use the periphery;
  - amplify the best of technology and of humanity;
  - communicate without needing to speak;
  - work even when it fails;
  - use the minimum technology needed to solve the problem;
  - respect social norms.

  A Calm Tech Certified standard exists — [Calm Technology](https://calmtech.com/)
- [PR] Mental health app retention (Baumel et al., 2019): median 15-day retention 3.9% and 30-day 3.3%. At day 30, tracker apps retained 6.1%, mindfulness apps 4.7% and peer support 8.9% — [JMIR 2019](https://www.jmir.org/2019/9/e14567/)
- [Industry] RevenueCat 2025/2026: annual plans dominate health and fitness revenue. Median annual renewal is about 25% (interquartile range 16–37%). Nearly 30% of annual subscriptions are cancelled in month 1. Cheaper annual plans retain better (as summarised) — [RevenueCat SOSA 2025](https://www.revenuecat.com/state-of-subscription-apps-2025); [renewal benchmarks](https://www.revenuecat.com/blog/growth/average-subscription-renewal-rates-by-app-category)
- [Conference/Industry] Calm/Headspace user reviews: price is the main barrier, and cancelling trials is hard. Headspace streak resets demotivate. Fitting the app into busy lives is the core concern — [ICEB 2020](https://aisel.aisnet.org/iceb2020/43/); [Relative Insight](https://relativeinsight.com/analyzing-mindfulness-app-reviews-calm-vs-headspace/)
- [Industry] Timeshifter (developed with Harvard's Steven Lockley) self-reports from 130,000+ post-flight surveys: 96.4% of people who followed its advice had no severe jet lag, versus a 6.2× higher rate of severe jet lag when they did not follow it. This is observational with selection bias. It partners with United and Lufthansa Group and states it is not intended for crew on duty — [Sleep Review](https://sleepreviewmag.com/sleep-disorders/circadian-rhythm-disorders/jet-lag/jet-lag-app-reaches-1-million-users-expands-airline-partnerships/); [Timeshifter](https://www.timeshifter.com/jet-lag-app)
- [PR] European survey (Causio et al., 2025; 8 countries; n=6,581):
  - 21.9% use health apps.
  - 72.3% fear data misuse and 63.7% fear hacking.
  - 52.8% would share data with their providers, but only 9% with private institutions.

  — [Eur J Public Health 2025](https://academic.oup.com/eurpub/article/35/3/401/8116209)
- [PR] Perceived control over data builds trust in mHealth — [PubMed 40209320](https://pubmed.ncbi.nlm.nih.gov/40209320/)
- [PR] Ads and health-site credibility: mixed effects, negative for .org domains and positive for .com (2004) — [JMIR 2004](https://doi.org/10.2196/jmir.6.3.e24)
- [Reg] India's DPDP Rules were notified in Nov 2025. Consent must be free, specific, informed, unconditional and unambiguous; dark patterns and pre-ticked boxes are not allowed. Most duties apply from 13 May 2027 — [PIB](https://www.pib.gov.in/PressReleasePage.aspx?PRID=2190655&reg=48&lang=2); [India Briefing](https://www.india-briefing.com/news/dpdp-rules-2025-india-data-protection-law-compliance-40769.html/)

### Inferences
- Design target: one "Now / Next" card per day, which answers "what do I do next and when". Everything else (science, history, settings) sits one tap away. Remove decorative badges and repeated information.
- "Work even when it fails" (Case): offline-first. The plan must be visible in flight mode and at foreign hotels, and must degrade gracefully when a roster parse is uncertain (show "please confirm" rather than wrong advice).
- Ad-free is necessary but not sufficient. Retention will be low by default, so value must be front-loaded (the first roster upload should instantly produce a useful week).
- For the business model, consider a low-cost annual plan with transparent, easy cancellation and no dark patterns. Avoid streaks. Price for Indian incomes; Gulf crew probably tolerate higher prices.
- Make privacy a visible feature: local or on-device processing where possible, no employer sharing, explicit DPDP-grade consent and an easy delete.

### Gaps
- No willingness-to-pay data for cabin crew or shift workers were found.
- No India- or Gulf-specific subscription benchmarks were retrieved.
- Oura, Whoop and Rise retention data are not public in the sources retrieved.

## 6. Wearable sleep tracker accuracy and whether integration helps or harms

### Takeaway
Consumer wearables detect sleep well (>90% sensitivity) but detect wake poorly (specificity roughly 18–54%). They overestimate total sleep, and their sleep staging is only fair. Performance is worse on disrupted sleep and for short daytime naps, which is exactly the crew case. Integration may help schedule awareness, but stage and score data add orthosomnia and nocebo risk.

### Cited Findings
- [PR] Chinoy et al. 2021 (*SLEEP*), 7 devices vs polysomnography (PSG): sensitivity ≥0.93 and specificity 0.18–0.54. Most devices matched or beat actigraphy (Garmin was worse). All performed worse on nights of poorer or disrupted sleep — [Monash](https://research.monash.edu/en/publications/performance-of-seven-consumer-sleep-tracking-devices-compared-wit); DOI 10.1093/sleep/zsaa291
- [PR] Schyvens et al. 2025 (*Sleep Advances*; n=62, including people with suspected sleep apnoea). Total sleep time (TST) was overestimated by every device, and wake after sleep onset was underestimated across all devices:

  | Device | Specificity | TST bias | κ |
  |---|---|---|---|
  | Apple Watch S8 | 52% | +19.6 min | 0.53 |
  | Fitbit Sense | 49% | +6.3 min | 0.42 |
  | Whoop 4.0 | 40% | +24.5 min | 0.37 |
  | Garmin Vivosmart 4 | 29% | +38.4 min | 0.21 |

  — [Schyvens et al. 2025](https://pmc.ncbi.nlm.nih.gov/articles/PMC12038347/)
- [PR] Fitbit Charge 2 in shift workers (naturalistic): mean values were reasonably accurate, but wide limits of agreement limit accuracy for individual sleep episodes — [PMC8527385](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC8527385/)
- [PR] Daytime sleep with 4 devices: low timing bias overall, but some devices missed daytime episodes, especially when time in bed was short — [Nat Sci Sleep 2023](https://www.tandfonline.com/doi/full/10.2147/NSS.S395732)
- [PR] de Zambotti et al. 2024 (*SLEEP*) state-of-science review: timing and total sleep time measures are the most reliable. Black-box algorithms and lack of raw data hinder validation — [SRS](https://sleepresearchsociety.org/srs-podcast-state-of-science-and-recommendations-for-using-wearable-technology-in-sleep-and-circadian-research/); [Chronobiol Med review](https://www.chronobiologyinmedicine.org/journal/view.php?number=196)
- [PR] Orthosomnia, sham-feedback and health-anxiety findings are listed in section 3 ([Gavriloff 2018](https://onlinelibrary.wiley.com/doi/10.1111/jsr.12726); [Rosman 2024](https://www.ahajournals.org/doi/10.1161/JAHA.123.033750))

### Inferences
- Wearables should be optional and used only for coarse inputs (actual sleep start and end) to re-plan. Never show sleep stages or "deep sleep minutes" as targets.
- Crew naps (short, daytime, in crew rest or hotels) are the weakest case for trackers. Let the user's own report override the device.
- The app must work fully without a wearable (Calm Tech: minimum technology needed).

### Gaps
- No validation of trackers in cabin crew, in-flight crew rest bunks or across time-zone shifts was found.
- Pooled 2025 JCSM meta-analysis numbers were not retrieved — [JCSM](https://jcsm.aasm.org/doi/10.5664/jcsm.11460).
- No trial was found testing whether tracker integration improves adherence in shift-work apps.

## 7. Gender, demographics, safety and cultural tone

### Takeaway
Users are mostly young women (e.g., about 84% of Air India cabin crew). Menstrual-cycle effects on sleep, pregnancy (caffeine limits; flying during sleep hours linked to miscarriage risk), layover safety and harassment are real considerations. Gulf crew are highly multinational expatriates, and Indian users need respectful, culturally relevant language. Little direct evidence exists on tone.

### Cited Findings
- [News] Women make up about 84% of Air India's cabin crew (Mar 2026). IndiGo's overall workforce is >45% women; no IndiGo cabin crew figure was found — [Storyboard18](https://www.storyboard18.com/how-it-works/women-pilots-account-for-up-to-17-5-at-indigo-16-at-air-india-91585.htm)
- [Reg/PR] NIOSH/FAA: flight attendants in many countries report menstrual irregularities, and show more circadian disruption (more variable melatonin) than comparison groups — [CDC stacks](https://stacks.cdc.gov/view/cdc/195952/cdc_195952_DS1.pdf)
- [PR] Menstrual cycle and sleep: in the luteal phase body temperature is higher, temperature rhythm amplitude is lower, REM is lower and spindles higher. Subjective sleep quality is worst around menses — [Baker & Driver 2007](https://www.sciencedirect.com/science/article/abs/pii/S1389945706006216); [Shechter & Boivin](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC2817387/)
- [PR] Grajewski et al. 2015 (*Epidemiology*; 840 pregnancies). First-trimester miscarriage risk was higher with ≥15 h flying during home-base sleep hours (OR 1.5, 1.1–2.2) and with high physical demands (OR 2.5, 1.5–4.2). Overall risk was not higher than in teachers — [CDC](https://stacks.cdc.gov/view/cdc/32319); [NIOSH blog](https://blogs.cdc.gov/niosh-science-blog/2015/05/12/flight-attendants/)
- [Reg] ACOG advises pregnant women to limit caffeine to <200 mg/day — [ACOG](https://www.acog.org/womens-health/experts-and-stories/ask-acog/how-much-coffee-can-i-drink-while-pregnant)
- [PR] Women shift workers face gendered domestic expectations and guilt about sleeping in the daytime — [synthesis 2025](https://pmc.ncbi.nlm.nih.gov/articles/PMC12281556/)
- [News] Aug 2024: an Air India crew member was assaulted by an intruder in her room at a London Heathrow layover hotel (around 01:30). The airline moved crew to another hotel — [AeroTime](https://www.aerotime.aero/articles/air-india-cabin-crew-assaulted-in-london-heathrow-hotel)
- [Industry] Emirates crew come from 140+ nationalities — [Emirates](https://www.emirates.com/media-centre/celebrating-international-cabin-crew-day-the-emirates-way/). The JMIR 2026 XAI framework lists "cultural and linguistic relevance" as a core trust requirement — [JMIR 2026](https://www.jmir.org/2026/1/e87158)
- [PR] Younger people show stronger orthosomnia interference — [Bergen 2025](https://www.frontiersin.org/journals/sleep/articles/10.3389/frsle.2025.1640355/full)

### Inferences
- Offer an optional, private "cycle" or "pregnancy" mode:
  - Pregnancy caps caffeine advice at <200 mg/day.
  - It suggests gentler exercise and suppresses heavy-exertion prompts.
  - It does not frame advice as medical, and it never collects these data by default.
- Layover advice should never push risky behaviour, such as walking outside at night for "light exposure" in unfamiliar cities. Prefer light by the hotel window or in the lobby. Add a "safe options" mindset to outdoor suggestions.
- Tone should be respectful, plain English first, avoiding slang or US-centric idioms. Consider Hindi and Arabic later, but note that Gulf crew are mostly non-Arab expatriates, so simple international English is the core. Food and fasting suggestions should be flexible (vegetarian, Ramadan fasting).
- Do not use body-image or weight framing in eating or workout advice. Avoid gendered assumptions.

### Gaps
- No peer-reviewed research was found on health-communication tone preferences of Indian or Gulf cabin crew.
- No data on menstrual-cycle-aware advice adherence.
- Pregnancy grounding policies of IndiGo, Air India, Emirates and Etihad were not retrieved.
- Ramadan and crew sleep guidance was not researched.
- The 2026 *SLEEP* paper on menstrual phase and snacking during a mock night shift was identified but not reviewed — [SLEEP 2026](https://academic.oup.com/sleep/article/49/3/zsaf362/8320496).
