# Regulatory, legal, privacy and app-store requirements for CrewCircadian (cabin-crew circadian wellness app)

Research notes as of 2 October 2026. This is research, not legal advice. Items marked **[LAWYER]** need review by qualified counsel. Items marked **[UNVERIFIED]** rely on weak or secondary sources. Research ended early because the session's search and fetch limits ran out (see the Gaps sections).

---

## 1. Medical-device boundary: which claims are wellness and which are medical device

### Takeaway
Every regulator studied judges software by its **intended purpose as expressed in its claims, labelling, user interface and marketing**. Sleep, energy and lifestyle-timing advice to healthy adults, with no disease named, sits inside the FDA "general wellness" category ("sleep management" is listed explicitly). It is also outside EU, UK and Indian device scope. Naming a disorder ("shift work disorder", "jet lag disorder", "insomnia"), giving medication dosing, or making a fitness-for-duty or clinical-risk determination moves the app toward device territory. A device-like intended use would also breach Google's Gemini API terms.

### Cited Findings
**US FDA, General Wellness (revised final guidance, 6 January 2026)**
- FDA reissued "General Wellness: Policy for Low Risk Devices" on 6 January 2026 ("Document issued on January 6, 2026"), replacing the 2019 version. There was no draft or comment period beforehand. Docket FDA-2014-N-1039. — [FDA guidance PDF](https://www.fda.gov/media/90652/download); [Covington client alert (law firm)](https://www.cov.com/en/news-and-insights/insights/2026/01/fda-issues-revised-guidance-on-general-wellness-products)
- The guidance defines two categories. (1) Intended uses relating to "maintaining or encouraging a general state of health or a healthy activity". (2) Intended uses relating "the role of healthy lifestyle with helping to reduce the risk or impact of certain chronic diseases or conditions and where it is well understood and accepted that healthy lifestyle choices may play an important role". — [FDA guidance PDF](https://www.fda.gov/media/90652/download)
- The first category covers "weight management, physical fitness … relaxation or stress management, mental acuity, self-esteem … **sleep management**, or sexual function". Its examples include "Claims to promote sleep management, such as to track sleep trends", claims to improve "concentration … decision-making", and claims to "improve energy". — [FDA guidance PDF](https://www.fda.gov/media/90652/download)
- Examples that fall outside wellness include "A claim that a product helps treat an anxiety disorder", "treat or diagnose obesity", "treat an eating disorder". — [FDA guidance PDF](https://www.fda.gov/media/90652/download)
- Second-category claims must use the "may help to reduce the risk of" or "may help living well with" wording. FDA's examples: "Product Z tracks activity sleep patterns and promotes healthy sleep habits, which, as part of a healthy lifestyle, may help reduce the risk for developing type 2 diabetes"; "Software Product V tracks and records your sleep, work and exercise routine which, as part of a healthy lifestyle, may help living well with anxiety." — [FDA guidance PDF](https://www.fda.gov/media/90652/download)
- New disqualifiers in the 2026 text: "Products are not general wellness products if their labeling, advertising, user interface, or functionality includes any of the following: 1. references to specific diseases, clinical conditions, or diagnostic thresholds; 2. alerts, alarms, or prompts that recommend or require specific clinical action or medical management; 3. treatment guidance intended to inform or direct medical management; 4. claims of clinical equivalence, clinical accuracy, medical or clinical grade …; or 5. intended-use statements that explicitly target diagnosis, screening, monitoring, or management of a disease or condition." Products whose outputs are "used to make treatment decisions (e.g., medication dosing)" are excluded. — [FDA guidance PDF](https://www.fda.gov/media/90652/download)
- A product may still be wellness if it tells users that "evaluation by a healthcare professional may be helpful", provided the notification does "not identify or name a specific disease", does "not characterize the output as abnormal, pathological, or diagnostic", and does "not include clinical thresholds, diagnoses, or treatment recommendations". FDA expects all labelling and marketing to be "consistent with, and does not exceed, the product's stated intended use". — [FDA guidance PDF](https://www.fda.gov/media/90652/download)
- The 2026 revision also lets non-invasive wearables that output physiological parameters (including blood pressure) qualify as wellness when the outputs are for wellness use only. The guidance "notably does not directly address AI". — [Covington](https://www.cov.com/en/news-and-insights/insights/2026/01/fda-issues-revised-guidance-on-general-wellness-products); [Jones Day (law firm)](https://www.jonesday.com/en/insights/2026/01/a-relaxing-2026-fda-updates-general-wellness-and-clinical-decision-support-software-guidance)
- FDA's revised Clinical Decision Support (CDS) guidance, issued the same day, addresses software functions "intended for health care professionals". It created enforcement discretion for software that gives one recommendation when only one option is clinically appropriate. It also removed most of the automatic exclusion for "time-critical" decisions, though time-criticality is still treated as a higher-risk factor. — [Jones Day](https://www.jonesday.com/en/insights/2026/01/a-relaxing-2026-fda-updates-general-wellness-and-clinical-decision-support-software-guidance); [King & Spalding](https://www.kslaw.com/news-and-insights/fda-updates-general-wellness-and-clinical-decision-support-guidance-documents)

**IMDRF**
- IMDRF published "Characterization Considerations for Medical Device Software and Software-Specific Risk" (IMDRF/SaMD WG/N81 FINAL:2025) on 27 January 2025. It builds on, and does not replace, the N12:2014 risk-categorisation framework (significance of the information × state of the healthcare situation), and stresses that a clear intended-purpose statement is the basis of characterisation. — [IMDRF N81 final](https://www.imdrf.org/sites/default/files/2025-01/IMDRF_SaMD%20WG_Software-Specific%20Risk_N81%20Final_0.pdf); [Emergo by UL summary](https://www.emergobyul.com/news/imdrf-releases-key-guidance-documents-medical-device-software)

**EU (MDR 2017/745, Rule 11, MDCG 2019-11)**
- MDCG 2019-11 Rev.1 (June 2025) updated the qualification and classification guidance for medical device software. Secondary summaries say it clarifies that fitness and wellness apps without medical claims are not medical devices, and that software processing health information is regulated only if it directly serves a medical purpose. — [GMP Insiders (secondary)](https://gmpinsiders.com/mdcg-2019-11-rev1-mdr-ivdr/); [OpenRegulatory](https://openregulatory.com/mdcg/mdcg-2019-11)
- (MDR recital 19, which states that software for "life-style and well-being purposes" is not a medical device, and the verbatim Rule 11 text could not be fetched before the session limit. See Gaps.)

**UK MHRA**
- MHRA guidance "Medical device stand-alone software including apps (including IVDMDs)" v1.10 says: "The monitoring of general fitness, general health and general wellbeing is not usually considered to be a medical purpose". It says software is unlikely to be a device if "It offers only lifestyle treatment choices or referral advice (e.g. see your GP)", but "most likely to be a device if … It is intended to influence the actual treatment - dose, size of implant, time of treatment etc." It also says "Apps and software for monitoring sport or fitness purposes … are not considered to be medical devices." — [MHRA guidance PDF](https://assets.publishing.service.gov.uk/media/64a7d22d7a4c230013bba33c/Medical_device_stand-alone_software_including_apps__including_IVDMDs_.pdf)
- MHRA guidance on digital mental health technology (February 2025) bases qualification on intended purpose plus functionality, and states that MHRA reviews websites, screenshots and promotional material. — [Med Device Online (secondary)](https://www.meddeviceonline.com/doc/the-u-k-s-mhra-adds-new-guidance-to-the-changing-regulatory-landscape-for-digital-mental-health-technologies-0001); [HSRAA on "Crafting an intended purpose"](https://the-hsraa.org/new-mhra-guidance-crafting-an-intended-purpose-in-the-context-of-software-as-a-medical-device/)

**India (CDSCO, Medical Devices Rules 2017)**
- On 21 October 2025 CDSCO released a **draft** Guidance Document on Medical Device Software under the Medical Devices Rules 2017. It distinguishes SaMD from SiMD and uses risk Classes A–D, based on the significance of the information and the seriousness of the healthcare situation. It remained a draft as of January 2026. — [Cyril Amarchand Mangaldas blog, Jan 2026 (law firm)](https://corporate.cyrilamarchandblogs.com/2026/01/medical-device-as-software-has-cdsco-guidance-changed-the-rules/); [Nishith Desai (law firm)](https://www.nishithdesai.com/research-and-articles/hotline/pharma-healthcare-update/the-next-frontier-in-medtech-regulation-dissecting-cdscos-draft-guidance-on-medical-device-software-15465); [Nasscom](https://community.nasscom.in/communities/public-policy/cdsco-releases-draft-guidance-medical-device-software-nasscom-submits-key)
- Cyril Amarchand describes it as clarificatory: it "does not introduce new regulatory requirements". The blog notes that "fitness and wellness applications were clearly excluded", but the draft gives no detailed test for separating them from medical software. Licensing follows the MDR 2017 split: CDSCO (central) handles imports and Class C/D manufacture; state authorities handle Class A/B manufacture. — [Cyril Amarchand](https://corporate.cyrilamarchandblogs.com/2026/01/medical-device-as-software-has-cdsco-guidance-changed-the-rules/)

**UAE**
- Federal Decree-Law No. 38 of 2024 on Medical Products, the Pharmacy Profession and Pharmaceutical Establishments took effect on 2 January 2025 and covers "medical software". The Emirates Drug Establishment (EDE) is the federal regulator of medical products. — [IBA, 11 May 2026](https://www.ibanet.org/ai-healthcare-regulation-uae); [RegDesk](https://www.regdesk.co/blog/uae-medical-device-regulatory-update-transfer-of-services-from-mohap-to-ede/)
- A secondary source says EDE formally took over 44 services from MOHAP, including device marketing authorisations, from 29 December 2025. **[UNVERIFIED]** — [Zavis guide (secondary)](https://www.zavis.ai/guides/medical-device-registration-uae-mohap)

**Google Gemini terms (affects device-like features)**
- "You may not use the Services in clinical practice, to provide medical advice, or in any manner that is overseen by or requires clearance or approval from a medical device regulatory agency." (Gemini API Additional Terms, effective 23 March 2026.) — [Gemini API Additional Terms](https://ai.google.dev/gemini-api/terms)

### Inferences
- **Probably safe (wellness) wording:** "plan your sleep around your roster"; "suggested sleep, nap, meal, caffeine and light timing"; "helps you manage sleep and energy on irregular schedules"; "track sleep trends"; "feel more alert". Second-category wording such as "healthy sleep habits, as part of a healthy lifestyle, may help living well with …" is allowed only with FDA's exact "may help" phrasing, and is best avoided.
- **Device or high-risk wording to avoid:** "treats / manages shift work disorder", "prevents / cures jet lag disorder", "treats insomnia", "diagnoses circadian rhythm disorder", "clinically proven", "medical-grade", "fit for duty / unfit to fly", and specific melatonin doses ("take 3 mg at 21:00"). Specific doses look like "medication dosing" (FDA disqualifier) and "influence the actual treatment – dose … time of treatment" (MHRA). Shift work disorder and jet lag disorder are named sleep-disorder diagnoses, so referring to them triggers disqualifier 1 in the FDA text.
- **"Reduces fatigue risk":** this is not a disease claim in itself. In aviation, however, "fatigue risk" is a regulated safety concept (FRMS). The phrase invites an implied safety-performance claim and liability (see section 5). "Supports alertness" is safer.
- **The 0–100 "readiness" score** is the highest-risk feature. Framed as a wellness indicator ("energy/sleep balance estimate, not a measure of fitness for duty"), it fits FDA's allowance for outputs contextualised "in relation to sleep, activity, stress, recovery". Framed as an impairment or fitness determination, it approaches screening, and it also overlaps crew legal duties. It should never use clinical thresholds, colour-coded "unsafe/unfit" labels, or prompts to see a doctor about a named condition.
- **Melatonin:** timing education ("some people use melatonin; talk to a doctor or pharmacist") is safer than dose advice. Melatonin is a regulated medicine in some target markets (see Gaps).

### Gaps
- The verbatim MDR recital 19 / Rule 11 text and the MDCG 2019-11 Rev.1 primary PDF were not retrieved (fetch limit). From background knowledge, not fetched this session: Rule 11 makes decision-support software Class IIa or higher and "all other software" Class I, and recital 19 excludes "life-style and well-being" software. Verify on EUR-Lex.
- The IMDRF N12 categorisation table could not be downloaded.
- No UAE/EDE document was found that says explicitly whether wellness apps are outside scope. **[LAWYER]**
- Whether CDSCO's final software guidance (if issued after January 2026) adds a wellness carve-out is unconfirmed.
- Melatonin status: UAE sources say it is prescription-only or a regulated medicine **[UNVERIFIED: forums and blogs]** ([uaeinform](https://uaeinform.com/healthcare-guide/medication), [Goods Across Borders](https://goodsacrossborders.com/traveling/can-i-bring/melatonin/to/uae)). For India, one blog says it is sold as an FSSAI nutraceutical while CDSCO oversight is under review **[UNVERIFIED]** ([Unbox Health blog](https://blog.unboxhealth.in/melatonin-side-effects/)). The UK NHS page (prescription-only) could not be fetched. **[LAWYER/pharmacist]**

---

## 2. Claims and branding: wording, disclaimers, research citations, airline trademarks

### Takeaway
Use a store-mandated "not a medical device" disclaimer plus an aviation-specific disclaimer. Cite NASA, ICAO and Salk as published research only: no logos, and no "NASA-based" or "approved" phrasing. Airline names should appear only descriptively ("works with rosters from …"), never in the app name, icon or keywords, and with a non-affiliation statement. Both stores penalise unauthorised third-party trademarks in metadata.

### Cited Findings
- Google Play requires non-device health apps to "include a clear disclaimer in their app description indicating that the app is 'not a medical device and does not diagnose, treat, cure, or prevent any medical condition.'" "Apps must also remind users to consult a healthcare professional". Play bans "misleading health claims that contradict existing medical consensus" and apps that "promote or sell unapproved substances". — [Google Play Health Content and Services policy](https://support.google.com/googleplay/android-developer/answer/16679511?hl=en)
- Apple 1.4.1: "Apps should remind users to check with a doctor in addition to using the app and before making medical decisions". Apple also requires apps to "clearly disclose data and methodology to support accuracy claims relating to health measurements". — [App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- Apple 1.4.2: "Drug dosage calculators must come from the drug manufacturer, a hospital, university, health insurance company, pharmacy or other approved entity, or receive approval by the FDA or one of its international counterparts." — [App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- Apple 2.3.7: don't "pack any of your metadata with trademarked terms, popular app names …". Apple 2.3.1(a): misleading marketing "is grounds for removal". — [App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- Apple 5.2.1: "Don't use protected third-party material such as trademarks … without permission, and don't include misleading, false, or copycat representations, names, or metadata". Apple 5.2.2 requires permission under a third-party service's terms when the app uses or displays its content. — [App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- Timeshifter's store listings say it is "not intended to diagnose, treat, cure or prevent any disease", is "intended for healthy adults, 18 years of age or older", carries the FDA "These statements have not been evaluated" line, and is "not intended for pilots and flight crew on duty". — [Timeshifter on Google Play](https://play.google.com/store/apps/details?id=com.timeshifter.timeshifter&hl=en_US); [App Store](https://apps.apple.com/us/app/timeshifter/id1380684374)
- NASA's guidelines bar using NASA's name or initials to suggest a connection or endorsement. Commercial use "must not explicitly or implicitly convey NASA's endorsement". The insignia ("meatball"), logotype ("worm") and seal need prior written approval. "NASA approved" and "official NASA" are prohibited. — [NASA Brand Center: images and media](https://nasa.gov/nasa-brand-center/images-and-media) (via search summary; page not fetched); [Finnegan (law firm)](https://www.finnegan.com/en/insights/articles/the-nasa-brand-flies-high-fulfilling-agencys-mission.html)
- India: under Trade Marks Act 1999 s.30, the Delhi High Court has said nominative fair use is permissible where the use "does not depict sponsorship by the trademark owner" and is "reasonably necessary". The three-part test: the product cannot readily be identified without the mark; use only as much of the mark as needed; imply no sponsorship. — [LiveLaw](https://www.livelaw.in/news-updates/nominative-fair-trademark-owner-reasonably-necessary-delhi-high-court-197480); [AZB & Partners (law firm)](https://www.azbpartners.com/bank/doctrine-of-nominative-fair-use-under-trademark-law/)
- The Gemini API terms say "Don't rely on the Services for medical … advice". Google's Generative AI Prohibited Use Policy bars "Facilitating misleading claims of expertise or capability in sensitive areas — for example in health … in order to deceive." — [Gemini API terms](https://ai.google.dev/gemini-api/terms); [Generative AI Prohibited Use Policy (last modified 17 Dec 2024)](https://policies.google.com/terms/generative-ai/use-policy)

### Inferences
- **Suggested disclaimer set:**
  - (a) Store and in-app: "CrewCircadian is a general wellness tool. It is not a medical device and does not diagnose, treat, cure, or prevent any medical condition. Consult a healthcare professional for medical advice."
  - (b) Aviation: "Not a fatigue risk management tool. Does not assess fitness for duty. Always follow your airline's procedures and applicable regulations, and report fatigue through your airline's system."
  - (c) Research: "References to NASA, ICAO and Salk Institute research describe published studies. These organisations have not reviewed or endorsed this app."
  - (d) Airlines: "IndiGo, Air India, Emirates, Etihad and other names are trademarks of their owners. CrewCircadian is independent and not affiliated with or endorsed by any airline."
- Do not put airline names in the app title, subtitle, icon, screenshots with airline logos, or keyword fields. Airline names in an in-app roster-format picker are the most defensible (necessary identification) use.
- Do not reproduce airline roster templates, logos or crew-portal UI.
- Accuracy and methodology claims (Apple 1.4.1) mean the readiness-score methodology should be described in plain language. Avoid "validated" or "proven" unless backed by a study.

### Gaps
- ICAO's and the Salk Institute's own name and emblem policies were not retrieved. Assume the same no-endorsement principle.
- India's CCPA Guidelines for Prevention of Misleading Advertisements (2022) and the ASCI code on health claims were not checked (search budget exhausted). **[LAWYER]**
- IndiGo's and Emirates' specific trademark enforcement practices were not researched.

---

## 3. Privacy: DPDP Act and Rules 2025, UAE PDPL, Qatar, GDPR, payslip and roster data, airline confidentiality

### Takeaway
India's DPDP regime is now law. Most fiduciary obligations (notice, consent, security, breach reporting, rights) apply from **about 13/14 May 2027**. Until then, IT Act s.43A and the SPDI Rules 2011 still apply. There is no small-business exemption yet: s.17(3) only lets the government exempt startups by notification. The UAE PDPL is in force but its Executive Regulations are, per the most reliable sources, still pending. Sources conflict on this. Sending payslips to Gemini is the largest privacy risk. It must use the **paid** Gemini tier, and Apple's 5.1.2(i) explicit-consent screen must name Google as the AI provider. Rosters contain operationally sensitive data (flight numbers, layover hotels, times). No public airline policy explicitly banning roster sharing was found, but crew-security norms and airline IT policies are relevant.

### Cited Findings
**India: DPDP Act 2023 and DPDP Rules 2025**
- The Rules were notified as G.S.R. 846(E), dated 13 November 2025. PIB states they were notified on 14 November 2025. Rule 1: "Rules 1, 2 and 17 to 21 shall come into force on the date of their publication"; "Rule 4 [Consent Managers] shall come into force one year after"; "Rules 3, 5 to 16, 22 and 23 shall come into force eighteen months after the date of publication". — [DPDP Rules 2025, MeitY gazette PDF](https://www.meity.gov.in/static/uploads/2025/11/53450e6e5dc0bfa85ebd78686cadad39.pdf); [PIB backgrounder, 17 Nov 2025](https://static.pib.gov.in/WriteReadData/specificdocs/documents/2025/nov/doc20251117695301.pdf)
- Act sections 3–17 (the core obligations) and s.44(2), which omits IT Act s.43A, take effect at 18 months (13 May 2027). Until then, "Section 43A of the IT Act and the SPDI Rules continue to form part of the applicable legal framework." — [Legal500 / search summary](https://www.legal500.com/intelligence/india/privacy/what-happens-to-existing-spdi-rules-after-full-dpdp-enforcement); [IFF statement](https://internetfreedom.in/iffs-initial-statement-on-the-notification-of-the-digital-data-protection-rules-2025/); the DPDP Act text confirms "section 43A shall be omitted" — [DPDP Act PDF](https://www.meity.gov.in/static/uploads/2024/06/2bf1f0e9f04e6fb4f8fef35e82c42aa5.pdf)
- **Notice (Rule 3):** the notice must "be presented and be understandable independently of any other information". It must give "in clear and plain language" (i) "an itemised description of such personal data" and (ii) "the specified purpose … and specific description of the goods or services". It must also give a link to withdraw consent "with the ease of doing so being comparable to that with which such consent was given", to exercise rights, and to "make a complaint to the Board". — [DPDP Rules](https://www.meity.gov.in/static/uploads/2025/11/53450e6e5dc0bfa85ebd78686cadad39.pdf)
- The Act requires that the notice be accessible "in English or any language specified in the Eighth Schedule to the Constitution" (s.5(3)). — [DPDP Act](https://www.meity.gov.in/static/uploads/2024/06/2bf1f0e9f04e6fb4f8fef35e82c42aa5.pdf)
- **Security (Rule 6):** minimum measures include "encryption, obfuscation, masking or the use of virtual tokens", access control, logs and monitoring, backups, and a "contract … between such Data Fiduciary and such a Data Processor" covering safeguards. Logs and personal data must be kept "for a period of one year" to support breach investigation. — [DPDP Rules](https://www.meity.gov.in/static/uploads/2025/11/53450e6e5dc0bfa85ebd78686cadad39.pdf)
- **Breach (Rule 7):** affected individuals must be told "without delay". The Board must be told "without delay", with a detailed report "within seventy-two hours". — [DPDP Rules](https://www.meity.gov.in/static/uploads/2025/11/53450e6e5dc0bfa85ebd78686cadad39.pdf)
- **Retention (Rule 8):** the Third Schedule's 3-year erasure rule applies only to large classes (e-commerce ≥2 crore users, gaming ≥50 lakh, social media ≥2 crore). Rule 8(3) requires every fiduciary to keep "personal data, associated traffic data and other logs of the processing for a minimum period of one year". — [DPDP Rules](https://www.meity.gov.in/static/uploads/2025/11/53450e6e5dc0bfa85ebd78686cadad39.pdf)
- **Contact (Rule 9):** every fiduciary must "prominently publish on its website or app" the contact details of a person who can answer processing questions. **Rights:** requests must be answered within 90 days. — [DPDP Rules](https://www.meity.gov.in/static/uploads/2025/11/53450e6e5dc0bfa85ebd78686cadad39.pdf); [PIB](https://static.pib.gov.in/WriteReadData/specificdocs/documents/2025/nov/doc20251117695301.pdf)
- **Children (anyone under 18):** verifiable parental consent is required, plus a ban on "tracking or behavioural monitoring of children or targeted advertising directed at children" (s.9). Under Rule 10 the parent must be verified as an identifiable adult (including via DigiLocker tokens). — [DPDP Act](https://www.meity.gov.in/static/uploads/2024/06/2bf1f0e9f04e6fb4f8fef35e82c42aa5.pdf); [DPDP Rules](https://www.meity.gov.in/static/uploads/2025/11/53450e6e5dc0bfa85ebd78686cadad39.pdf)
- **Cross-border (Rule 15):** transfer abroad is allowed, subject to "such requirements as the Central Government may, by general or special order, specify" for making data available to foreign states. This is a negative-list approach, not a consent requirement. — [DPDP Rules](https://www.meity.gov.in/static/uploads/2025/11/53450e6e5dc0bfa85ebd78686cadad39.pdf)
- **Startups:** s.17(3) lets the government "notify certain Data Fiduciaries or class of Data Fiduciaries, including startups" as exempt from s.5 (notice), s.8(3) and (7), and ss.10–11. No such notification was found in the Rules. — [DPDP Act](https://www.meity.gov.in/static/uploads/2024/06/2bf1f0e9f04e6fb4f8fef35e82c42aa5.pdf)
- **Penalties:** up to ₹250 crore for security-safeguard failure, ₹200 crore for breach-notification or children's-data violations, and ₹50 crore for other violations. — [PIB](https://static.pib.gov.in/WriteReadData/specificdocs/documents/2025/nov/doc20251117695301.pdf)
- (Caution: an AI summary of the PIB PDF invented a "2-year startup exemption" and "explicit consent for cross-border transfer". The primary text contains neither.)

**UAE**
- The PDPL (Federal Decree-Law 45/2021) applies to controllers outside the UAE who process the data of data subjects inside the UAE. DIFC, ADGM and DHCC keep separate regimes. Breaches must be reported to the Data Office "immediately upon becoming aware". — [DLA Piper Data Protection Laws of the World](https://www.dlapiperdataprotection.com/countries/uae-general/law.html)
- **Status conflict:**
  - Chambers Practice Guide (10 March 2026): "The Implementing Regulations … have yet to be issued", and the Data Office "has not yet become fully operational". DLA Piper (January 2025) also said they were not issued, with a six-month compliance window to follow once they are. — [Chambers 2026 UAE](https://practiceguides.chambers.com/practice-guides/data-protection-privacy-2026/uae/trends-and-developments); [DLA Piper](https://www.dlapiperdataprotection.com/countries/uae-general/law.html)
  - Several vendor blogs claim the Executive Regulations were published in 2026 **[UNVERIFIED; no resolution number cited]**. — [itsecnow](https://itsecnow.com/regulators/pdpl-executive-regulations-2026); [uppersetup](https://uppersetup.com/en/blog/uae-personal-data-protection-law-pdpl-the-complete-business)
- Federal Law No. 2 of 2019 (ICT in health fields) requires "local storage and processing of health data" except under Ministerial Decision No. 51 of 2021. It applies across the UAE, including free zones. — [IBA, May 2026](https://www.ibanet.org/ai-healthcare-regulation-uae)
- Federal Decree-Law No. 26 of 2025 on Child Digital Safety takes effect after a one-year grace period. — [Chambers 2026](https://practiceguides.chambers.com/practice-guides/data-protection-privacy-2026/uae/trends-and-developments)

**Qatar**
- Under PDPPL Law No. 13 of 2016, health, physical and psychological condition data is "personal data of a special nature". The National Cyber Security Agency (NCSA) administers the law, and processing special-nature data reportedly requires prior permission from the competent NCSA department; consent alone is not enough. — [Securiti (secondary)](https://securiti.ai/qatar-personal-data-protection-law/); [NCSA guidelines](https://ncsa.gov.qa/shared/document_library/94787172324409/33000/6111/1.0~ed7c75cd-79a1-4086-b01c-1ac3b8bc168c?mimetype=application%2Fpdf&filename=uwef.pdf)

**AI provider (Gemini) and payslip data**
- **Unpaid tier:** "Google uses the content you submit to the Services and any generated responses to provide, improve, and develop Google products and services". "Do not submit sensitive, confidential, or personal information to the Unpaid Services." — [Gemini API Additional Terms, eff. 23 Mar 2026](https://ai.google.dev/gemini-api/terms)
- **Paid tier:** "Google doesn't use your prompts … or responses to improve our products". Data is logged "solely for detecting and preventing violations of the Prohibited Use Policy". "You may use only Paid Services when making API Clients available to users in the European Economic Area, Switzerland, or the United Kingdom." — [Gemini API terms](https://ai.google.dev/gemini-api/terms)
- **Age:** "You must be 18 years of age or older to use the APIs". The service may not be used in an app "directed towards or is likely to be accessed by individuals under the age of 18". — [Gemini API terms](https://ai.google.dev/gemini-api/terms)

**App-store privacy rules relevant here**
- Apple 5.1.2(i), added 13 November 2025: "You must clearly disclose where personal data will be shared with third parties, including with third-party AI, and obtain explicit permission before doing so." — [App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/); [TechCrunch](https://techcrunch.com/2025/11/13/apples-new-app-review-guidelines-clamp-down-on-apps-sharing-personal-data-with-third-party-ai)
- Google Play Data safety: "Collect" means "transmitting data from your app off a user's device". Transfers to a service provider processing "on behalf of the developer and based on the developer's instructions" are not "sharing". "Other financial info" includes "Salary". — [Play Data safety help](https://support.google.com/googleplay/android-developer/answer/10787469?hl=en)

**Airline roster confidentiality and security**
- Emirates investigated crew over a viral behind-the-scenes YouTube video (February 2025). It said "no crew was dismissed", but the case shows Emirates enforces a social-media and conduct policy. — [Khaleej Times](https://www.khaleejtimes.com/uae/dubai-emirates-airline-denies-sacking-employees-for-releasing-behind-the-scenes-video); [AeroTime](https://www.aerotime.aero/articles/former-emirates-cabin-crew-gets-colleagues-in-trouble-due-to-youtube-bts-vlog)
- The roster app Aeroster advertises: "We won't ever ask for your company username or password – we're 100% compliant with your airline's IT policy". Users forward their roster by email instead. This implies airline IT policies forbid sharing crew-portal credentials with third parties. — [Aeroster](https://www.aeroster.com/)
- Industry guidance warns that crew should not disclose layover hotels because crew "can become targets". — [Simple Flying](https://simpleflying.com/90-second-safety-rule-flight-attendants-do-unpacking-layover-destination); an aviation app-vetting vendor notes that third-party crew apps extend airline operational data to vendors "whose security practices the airline doesn't directly control" — [iVerify](https://www.iverify.com/blog/mobile-app-vetting-aviation)

### Inferences
- **Payslips:** Indian payslips usually contain the employee ID, PAN, bank account number, salary and allowances. These are "financial information" (sensitive under the SPDI Rules until May 2027) and "Other financial info" on Play.
  - Minimise: ask users to crop or redact the PAN and bank number, or redact on-device before upload.
  - Use the **paid** Gemini tier only. On the free tier, sending payslips directly breaches Google's instruction not to submit personal information.
  - Show an Apple 5.1.2(i) consent screen naming "Google Gemini" before the first upload, and make the payslip feature optional.
- **Health inferences:** sleep and fatigue scores computed on-device and never transmitted are not "collected" under Play's definition. That is a major compliance advantage of on-device storage. Keep the readiness score on-device and avoid analytics SDKs that would send it off.
- **DPDP:** the app is probably a Data Fiduciary for whatever it processes off-device (the Gemini calls) and for any account data. Google acts as Data Processor; a Rule 6(1)(f) contract is needed, and Google's paid-tier terms may suffice. **[LAWYER]** Plan for Rule 3 notice, a withdrawal mechanism, a grievance contact, a 72-hour breach procedure, and Hindi and other Eighth-Schedule language options before May 2027. A purely on-device app with no backend has a minimal footprint, but the Gemini upload still counts as processing.
- **Children:** cabin crew are adults, so set an 18+ age gate or rating. This also satisfies Gemini's under-18 restriction.
- **UAE:** treat the PDPL as applicable (extraterritorial scope). Health data localisation (Law 2/2019) probably targets healthcare-sector entities rather than a consumer wellness app. **[LAWYER]**
- **Qatar:** if crew there use the app and any health-type data leaves the device, the NCSA permit requirement may bite. **[LAWYER]**
- **GDPR (EU-based crew):** sleep and fatigue data is likely "data concerning health" (Art. 9; explicit consent needed). Art. 27 may require an EU representative if the app targets EU users. Gemini must be on the paid tier for EEA, UK and Swiss users.
- **Rosters:** advise users to upload their own roster file or screenshot, never to give crew-portal credentials. Do not build social or roster-sharing features. Strip or avoid storing hotel names. Note in the terms that users are responsible for complying with their employer's policies.

### Gaps
- Verbatim GDPR Art. 9 and Art. 4(15) text and CJEU C-184/20 were not fetched.
- The status of the UAE Executive Regulations is unresolved; confirm with UAE counsel.
- The Qatar statute's article text was not retrieved (download failed).
- No published IndiGo, Air India, Emirates or Etihad policy specifically on third-party roster apps or sharing rosters was found; such policies are likely internal. Ask crew contacts or counsel. **[LAWYER]**
- The SPDI Rules PDF download failed. The "financial information" and health-data categories are from background knowledge.

---

## 4. App-store rules (Apple and Google Play)

### Takeaway
Both stores are likely to treat CrewCircadian as a health app. Apple's 5.1.1(ix) covers "healthcare" and "air travel" apps and apps that "require sensitive user information". Google Play wants organization accounts for medical-type health apps. A company entity (with a D-U-N-S number) is therefore strongly advisable. Mandatory items: privacy policy, Health apps declaration (choose "Sleep management", "Activity and fitness" and "Nutrition"; not "Medical device"), Data safety form, Apple privacy labels, AI-consent screen, store disclaimer, and in-app account deletion if accounts exist.

### Cited Findings
- **Apple 5.1.1(ix):** "Apps that provide services in highly regulated fields (such as banking and financial services, healthcare, gambling, legal cannabis use, air travel and crypto exchanges) or that require sensitive user information should be submitted by a legal entity that provides the services, and not by an individual developer." — [App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- **Apple 5.1.1(i)–(v):**
  - A privacy policy is required in metadata and in-app. It must cover data uses, third-party sharing at an "equal protection" standard, retention and deletion, and how to revoke consent.
  - Consent is required for data collection, with an easy way to withdraw it.
  - Data minimisation applies.
  - Apps must not require login without significant account-based features.
  - If accounts exist, apps "must also offer account deletion within the app".
  - Source: [App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- **Apple 5.1.3:** "Health, fitness, and medical data are especially sensitive". Apps may not use such data for advertising or data mining. Apps "may not store personal health information in iCloud". Apple 5.1.2(vi): HealthKit data "may not be used for marketing, advertising or use-based data mining". — [App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- **Apple 4.2:** apps need features "that elevate it beyond a repackaged website". Apple 4.2.2: apps should not be primarily "content aggregators, or a collection of links". — [App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- **Apple 5.1.2(i) (third-party AI consent) and 1.4.1/1.4.2:** see sections 2 and 3. — [App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- **Google Play Health apps declaration:** "All developers that have an app published on Google Play must complete the Health apps declaration"; "After August 31, 2024, all apps will be required to have completed an accurate Health apps declaration." Health and fitness categories include "Activity and Fitness", "Nutrition and Weight Management", "Sleep Management: Apps dedicated to improving and tracking sleep patterns and quality" and "Stress Management, Relaxation, Mental Acuity". Medical categories include "Clinical Decision Support", "Medication and Treatment Management" and "Medical Device Apps". — [Play health apps declaration](https://support.google.com/googleplay/android-developer/answer/14738291?hl=en)
- **Google Play medical apps:** "Apps that are regulated as a medical device must provide proof of approval, clearance or certification by the relevant authority upon request". Health Connect data "is regarded as personal and sensitive user data … subjected to additional requirements". — [Play Health Content and Services policy](https://support.google.com/googleplay/android-developer/answer/16679511?hl=en)
- **Google Play accounts:** "You should choose an organization account if you provide … Health apps, such as Medical apps and Human Subjects Research apps". "To create a developer account for an organization, you must have a D-U-N-S number." — [Play: choose a developer account type](https://support.google.com/googleplay/android-developer/answer/13634885?hl=en)
- **Google Play privacy policy:** the policy must be posted in Play Console and in-app on an active, public, non-geofenced URL (no PDFs). — [Play health declaration help](https://support.google.com/googleplay/android-developer/answer/14738291?hl=en) (via search summary)

### Inferences
- Declare only wellness categories on Play. Declaring "Medication and Treatment Management" (because of melatonin) or "Clinical Decision Support" (because of the readiness score) would invite medical-app scrutiny. Wording therefore has to match the declaration.
- The Apple 1.4.2 risk is triggered if melatonin **dose** amounts are shown. Show timing only and defer dose to a doctor or pharmacist.
- The Apple 5.1.1(ix) "air travel" wording targets booking and airline-service apps, but reviewers may apply it. An Indian Pvt Ltd or LLP as publisher also helps with the DPDP startup route and Play organization status.
- Apple "Nutrition label" and Play Data safety: if roster and payslip images go to Gemini, declare "Financial info – Other (salary)" and roster/"Other user content" as collected, not shared (Google acts as service provider), unless ephemeral processing applies. Paid Gemini still logs requests for abuse monitoring, so "ephemeral" is doubtful. **[LAWYER]**
- An age rating of 17+/18+ (or a declared adult audience) aligns with Gemini's under-18 restriction.

### Gaps
- Google Play's personal-account closed-testing requirement (tester count and days) was not confirmed this session.
- Google Play's Health Connect permission-declaration specifics and Impersonation policy text were not fetched.
- Whether Apple actually enforces 5.1.1(ix) against individual developers of crew wellness apps is unknown (no case reports found).

---

## 5. Liability: duty of care, FRMS conflicts, comparable apps' terms, Indian consumer law

### Takeaway
Crew are under a personal legal duty not to operate when fatigued (EASA/GCAA CAT.GEN.MPA.100), and airlines must run fatigue-reporting systems (DGCA November 2025 instructions; FDTL CARs). The app's biggest liability risk is a crew member relying on a high readiness score to operate when they feel unfit, or a low score being used against them. Comparable apps (Timeshifter, Rise) disclaim medical and safety-critical use and cap liability at roughly fees paid or $50. Under India's CPA 2019, a truly free service is outside "service", but liability waivers may be void as "unfair contracts", and product liability turns heavily on "adequate instructions or warnings".

### Cited Findings
- UAE GCAA CAR-AIR OPS Part-CAT, CAT.GEN.MPA.100 (mirrors EASA): a crew member shall not perform duties "if he/she is in any doubt of being able to accomplish his/her assigned duties; or (5) if he/she knows or suspects that he/she is suffering from fatigue … or feels otherwise unfit, to the extent that the flight may be endangered." — [GCAA CAR-AIR OPS Part-CAT Issue 01 PDF](https://www.gcaa.gov.ae/en/epublication/EPublications/Civil%20Aviation%20Regulations%20(CARs)/CAR%20IV%20-%20FLIGHT%20OPERATIONS%20REGULATIONS/CAR%20AIR%20OPS/CAR-AIR%20OPS%20-%20PART-CAT%20-%20ISSUE%2001.pdf); same wording in the [UK CAA regulatory library, CAT.GEN.MPA.100](https://regulatorylibrary.caa.co.uk/air-operations-pre-30-october-2025/Content/Document%20Structure/04%20CAT/2%20Regs/05410_CATGENMPA100_Crew_responsibilities.htm)
- India: DGCA issued draft CAR Section 7 Series J Part I Issue V (cabin crew FDTL) on 15 October 2025. Operators must "ensure no cabin crew performs duty while fatigued". — [TeamLease RegTech](https://www.teamleaseregtech.com/updates/article/48511/dgca-issued-draft-civil-aviation-requirement-section-7-cabin-crew-stan/)
- DGCA's November 2025 fatigue-management instructions require:
  - "a formal way to report when they feel overly tired without fear of reprisal";
  - one hour of fatigue training a year for pilots and cabin crew;
  - quarterly fatigue reports to DGCA;
  - an independent Fatigue Review Committee;
  - at least 24 hours' rest after a fatigue event.
  - Sources: [Aviation A2Z](https://aviationa2z.com/index.php/2025/11/26/dgca-makes-new-rules-on-pilot-cabin-crew-fatigue-and-rest/); [Business Standard](https://www.business-standard.com/industry/aviation/dgca-new-guidelines-pilot-cabin-crew-fatigue-management-rules-125112500614_1.html)
- Crew fatigue was politically salient in India after the December 2025 IndiGo scheduling crisis and DGCA's rollback of a weekly-rest order. — [Wikipedia: 2025 IndiGo scheduling crisis](https://en.wikipedia.org/wiki/2025_IndiGo_scheduling_crisis); [Deccan Herald](https://www.deccanherald.com/india/blackmail-worked-social-media-users-lash-out-at-indigo-after-dgca-rolls-back-order-on-weekly-rest-for-crew-3820938)
- **Rise Science terms:**
  - Services "are not intended, designed, or implied to diagnose, prevent, or treat any condition or disease".
  - "Do not use the Services while driving, operating heavy machinery, or performing other tasks that require attention".
  - Services are provided "as is".
  - Liability is capped at amounts paid "or fifty dollars ($50)".
  - Binding individual arbitration with class waiver; Delaware law.
  - Source: [Rise Science terms](https://www.risescience.com/terms)
- **Timeshifter:** "not intended for pilots and flight crew on duty"; for "healthy adults, 18 years of age or older". — [Timeshifter Play listing](https://play.google.com/store/apps/details?id=com.timeshifter.timeshifter&hl=en_US)
- **India CPA 2019 (Nishith Desai FAQ, law firm, 2020):**
  - "Services rendered free of charge … are excluded from the service covered under the CPA 2019."
  - A defence exists where the complainant "has availed a product free of charge".
  - A product service provider is liable where "adequate instructions or warnings to prevent harm were not issued" or where the service "did not conform to express warranty".
  - "a waiver of claims under the CPA 2019 may be construed as an unfair contract", and absolute restraints on legal proceedings are void under s.28 of the Indian Contract Act.
  - Source: [Nishith Desai FAQ on product liability (PDF)](https://www.nishithdesai.com/fileadmin/user_upload/pdfs/NDA%20Hotline/FAQ-Consumer-Protection-Act-A4.pdf)
- A secondary commentator says app stores are "electronic service providers" under CPA s.2(17) and cannot claim intermediary status. **[secondary]** — [iPleaders](https://blog.ipleaders.in/liability-app-stores-consumer-protection-law/)
- **Gemini Prohibited Use Policy:** bars "automated decisions that have a material detrimental impact on individual rights without human supervision in high-risk domains — for example, in employment, healthcare". — [Google Generative AI Prohibited Use Policy](https://policies.google.com/terms/generative-ai/use-policy)

### Inferences
- **Conflict with crew duties and FRMS:** a "readiness 85/100" display could falsely reassure a crew member who feels unfit. The law requires the self-assessment ("feels otherwise unfit") to govern. Build-in safeguards:
  - (a) Never label scores "fit / safe to fly".
  - (b) Always show "If you feel fatigued, follow your airline's fatigue reporting procedure", regardless of score.
  - (c) Never recommend calling in fatigued or not reporting. The app must not substitute for the airline's FRMS or fatigue report.
  - (d) Do not let airlines or employers use scores for crew decisions without a separate legal review; that is high-risk "employment" automated decision-making, both under Gemini's policy and as a data-protection issue.
- **Duty of care:** advice to safety-sensitive workers raises the expected standard of warnings. Under CPA 2019, "adequate instructions or warnings" is the main defence lever, so prominent onboarding warnings matter more than fine-print caps.
- **Indian terms:** liability caps and arbitration clauses modelled on US apps (Rise) may be partly unenforceable for Indian consumers, especially if any paid tier is added. A free, ad-free app reduces CPA exposure, though tort negligence claims remain possible. **[LAWYER]**
- **Melatonin and caffeine timing:** add "check with a doctor before using melatonin or other sleep aids; aviation medical rules and local law may restrict them".
- **Professional indemnity / product liability insurance:** worth pricing once the user base grows. **[LAWYER/broker]**

### Gaps
- Timeshifter's full terms (its liability cap and governing law) could not be fetched (404, then session limit).
- The final (not draft) DGCA cabin-crew FDTL CAR text and its effective date were not confirmed.
- The ICAO Annex 6 crew fatigue provision and Doc 9966 were not retrieved.
- No case law was found on the liability of a wellness app to aviation workers.
- Whether Indian courts treat downloadable software as a "product" under CPA s.2(33) is unresolved in the sources found.

---

## 6. AI provider terms: Google Gemini (free vs paid, health-use restrictions)

### Takeaway
Payslip and roster extraction is permissible "data extraction", not medical advice. However, it must run on the **paid** tier: the free tier lets Google use the content, has human review, and forbids personal information. The paid tier is mandatory for EEA, UK and Swiss users. Gemini output must never drive medical advice, clinical use, or any regulator-cleared function. The app must not target under-18s.

### Cited Findings
- **Terms version and data use:** the Gemini API Additional Terms are effective 23 March 2026. Unpaid Services: Google uses submitted content "to provide, improve, and develop Google products and services". "Do not submit sensitive, confidential, or personal information to the Unpaid Services." — [Gemini API Additional Terms](https://ai.google.dev/gemini-api/terms)
- **Paid Services:** prompts and responses are not used "to improve our products"; data is logged "solely for detecting and preventing violations of the Prohibited Use Policy". — [Gemini API terms](https://ai.google.dev/gemini-api/terms)
- **Regional rule:** "You may use only Paid Services when making API Clients available to users in the European Economic Area, Switzerland, or the United Kingdom." — [Gemini API terms](https://ai.google.dev/gemini-api/terms)
- **Medical use:** "You may not use the Services in clinical practice, to provide medical advice, or in any manner that is overseen by or requires clearance or approval from a medical device regulatory agency." "Don't rely on the Services for medical, mental health, legal, financial, or other professional advice." — [Gemini API terms](https://ai.google.dev/gemini-api/terms)
- **Age:** users must be 18+. API clients must not be "directed towards or is likely to be accessed by individuals under the age of 18". — [Gemini API terms](https://ai.google.dev/gemini-api/terms)
- **Prohibited Use Policy (last modified 17 December 2024):** prohibits automated high-risk decisions without human supervision (employment, healthcare), "misleading claims of expertise or capability in sensitive areas — for example in health", and "using personal data … without legally-required consent". — [Generative AI Prohibited Use Policy](https://policies.google.com/terms/generative-ai/use-policy)

### Inferences
- Keep Gemini's role to "extract dates, duties and pay lines". Generate all sleep, meal and caffeine advice with deterministic on-device logic based on cited research. This keeps Gemini outside "medical advice" and makes behaviour auditable.
- **Key handling:** if the app ships with an embedded Google AI Studio key, it may be on the free tier unless billing is enabled. Check the billing status. Per project memory, the live AI upload path has not yet been tested with a real key. Also consider proxying calls through a server so the key is not extractable from the app binary (security, not a legal requirement).
- **Consent:** under Apple 5.1.2(i), and DPDP notice once in force, consent must name Google as recipient, state the purpose (extraction only), and say that Google may log requests for abuse monitoring.

### Gaps
- The paid-tier abuse-monitoring retention period was not captured in the fetch.
- Whether Google's paid tier processes data outside India (relevant only if the Central Government later restricts transfers under Rule 15) was not checked.
- Vertex AI (enterprise) terms, an alternative with a data processing addendum, were not reviewed.

---

### Concrete compliance steps for a small team (synthesis of the above; priority order)
1. **Before launch.** Incorporate (Pvt Ltd or LLP; consider DPIIT startup recognition) and publish under an organization account on both stores (D-U-N-S). — Apple 5.1.1(ix); Play account types.
2. **Before launch.** Fix the intended-purpose statement, store copy and in-app copy to wellness wording. Remove disease names, "fit for duty", "reduces fatigue risk" and melatonin doses. Add the four disclaimers in section 2.
3. **Before launch.** Switch Gemini to the paid tier. Add an explicit pre-upload consent screen naming Google Gemini. Make the payslip feature optional, with redaction guidance. Never request crew-portal credentials.
4. **Before launch.** Publish a privacy policy (web URL plus in-app). Complete the Play Health declaration (wellness categories), Data safety form and Apple privacy labels. Set an 18+ audience. Provide in-app data deletion (and account deletion if accounts exist).
5. **Before launch.** Write Terms of Use with: wellness-only use; not FRMS or fitness-for-duty; follow airline procedures; as-is warranty; reasonable liability cap; Indian governing law. Have Indian counsel review CPA and Contract Act enforceability. **[LAWYER]**
6. **By May 2027 (DPDP 18-month date).** Put in place:
   - a Rule 3-compliant standalone notice with an itemised data list and multilingual option;
   - a withdrawal link;
   - a published grievance contact;
   - a 72-hour breach runbook;
   - a processor contract with Google;
   - one-year log retention for any server component.
   Until then, meet the SPDI Rules (reasonable security practices; consent for sensitive financial data).
7. **Ongoing.** Re-check UAE PDPL Executive Regulations status, CDSCO final software guidance, Qatar NCSA permit applicability, and store-policy updates (Apple's November 2025 update shows these change). Get local legal opinions before marketing in UAE or Qatar. **[LAWYER]**
