# Family Tree App Pain Points & Feature Needs Research: Recommendations for Stemmagraph

> **Status**: 🟢 Active
> **Topic**: Validated user pain points, Indonesian-specific needs (adat, religious, legal), AI trends, and feature gaps
> **Updated**: 2026-08-16 (English rewrite of the original Indonesian research)
> **Tags**: research, pain-points, indonesia, uu-pdp, kinship, ai
> **Supersedes**: `02-riset-pain-point-kebutuhan-fitur.md` (Bahasa Indonesia version)

## TL;DR
- The biggest cross-platform pain points globally are **data lock-in & leaky GEDCOM** (photos/sources lost in migration), **aggressive subscription pricing + auto-renewal**, **learning curves burdening beginners**, and **collaboration chaos (duplicates & merging)** — all four are gaps Stemmagraph's "open & portable" positioning can win.
- For the Indonesian market, the most distinctive validated needs are **customary kinship structures (marga/trah/tarombo), WhatsApp sharing, privacy of living members' data under the PDP Law, and real religious needs like wali nasab** — not DNA testing, whose reference panels are weak for Southeast Asia.
- The tier list in the vision document is already strong; the main gaps to add: **granular per-living-person consent management under the PDP Law, a first-class merge/dedup workflow, AI handwriting transcription (not just OCR), haul/birthday/event reminders, and onboarding + ready-made templates**.

## Key Findings

### A. User Pain Points (validated from sources)
1. **Lock-in & lossy GEDCOM** — GEDCOM 5.5.1 (the de-facto standard since 2019) doesn't carry photo files, only links. Ancestry blocks third-party media downloads, so photos are lost when moving to MyHeritage. FamilySearch cannot export GEDCOM directly at all.
2. **Aggressive pricing & auto-renewal** — many MyHeritage complaints about unexpected subscription bills and hard-to-reach customer service.
3. **Learning curve / overwhelming** — MyHeritage, Gramps, and Legacy are all rated overwhelming for beginners.
4. **Collaboration = duplicate & merge chaos** — WikiTree and FamilySearch centralize extensive documentation on merge conflicts; duplicates are a structural problem of the "one shared tree" model.
5. **Living-person privacy** — fears of living family members' data appearing publicly; mechanisms for sharing living-person data among family members are often unavailable.
6. **Basic features missing in simple tools** — Family Echo has no auto-merge, doesn't support adoption/stepchildren/godparents, and has no mobile app.

### B. Indonesian Context
- **WhatsApp-first & mobile-first**: Per DataReportal's "Digital 2025: Indonesia" (We Are Social/Meltwater), Indonesia has 212 million internet users (74.6% penetration) and 143 million social media identities as of February 2025, with **WhatsApp as the favorite social platform**; access is dominated by mobile (~98%). Active WhatsApp user counts vary by source (Quantumrun/Backlinko 2025 places Indonesia 3rd globally with ~86.9M MAU, after India ~535.8M and Brazil ~139.3M; World Population Review cites ~112M for 2024). Sharing family tree links to WA groups is already the norm explicitly targeted by local competitors (TRAHku, Naoto).
- **Customary structures**: Batak marga (Dalihan Na Tolu, partuturan/martaribo), Javanese trah, tarombo, Minang ranji. The local competitor Naoto already advertises "seayah, seibu, besan, ipar read instantly" plus an automatic relationship calculator.
- **Religious**: wali nasab (Islam) demands precise paternal-line tracing; baptismal genealogy (Christianity); the zu pu (族谱) tradition of Chinese-Indonesian communities.
- **Archives**: ANRI (the Indonesian National Archives) holds colonial civil-registration records (Bevolkingsregister) and even offers genealogy research services to the public; most remain undigitized/unindexed.

### C. 2025–2026 AI Trends (the new industry standard)
- **AI handwriting transcription / full-text search** is now standard. FamilySearch Full-Text Search was announced at RootsTech on February 29, 2024 and released sitewide in late August 2024; per Family Tree Magazine, "As of March 2025, the tool has 1.2 billion images in more than 3,000 collections" (from ~100 million images at launch). Followed by Ancestry Document Transcription and MyHeritage **Scribe AI** (introduced at RootsTech 2026).
- **AI Stories / audio narration**: Ancestry launched AI Stories on December 12, 2025; per Ancestry's official blog, "There are currently over 940 million records available for audio narration with the AI Stories feature", available in six languages. MyHeritage has AI Biographer and announced the GAIA assistant.
- **Face Match / photo animation**: Ancestry Face Match; MyHeritage Deep Nostalgia.
- **AI Research Assistant & Computer-Generated Trees** (FamilySearch, RootsTech 2026), accompanied by a panel on responsible AI use.

## Details

### 1. Pain Points — Details & Sources

**1.1 Data lock-in & broken GEDCOM interoperability.** GEDCOM 5.5.1 only stores photo links, not files. Robert Kehrer (FamilySearch) confirmed only GEDCOM v7 supports rich media, and MyHeritage doesn't yet support GEDCOM 7 export. Ancestry blocks external services from downloading media, so photos don't migrate to MyHeritage. FamilySearch provides no direct GEDCOM export — users must go through third-party software (RootsMagic, Ancestral Quest, etc.). One user (Christina68785, August 2025 in the FamilySearch community) complained about retyping 251 entries because a MyHeritage→FamilySearch migration wasn't smooth. **Implication for Stemmagraph:** GEDCOM 7 + GEDZIP (media-inclusive) must be the baseline, not Tier 1; full no-loss export is the core differentiator behind the "portable" claim.

**1.2 Pricing & subscription practices.** ComplaintsBoard hosts many MyHeritage complaints about unexpected annual bills (one case ~$700 for two kits deemed unauthorized), bot-only support, and refused refunds. This reinforces Stemmagraph's transparent model (open source + a self-host option).

**1.3 Learning curve.** Reviews consistently call MyHeritage, Gramps, and Legacy "overwhelming for beginners". Even loyal Gramps users admit a "rather steep learning curve". Simple onboarding + ready-made templates become a practical differentiator.

**1.4 Collaboration, duplicates, & merging.** WikiTree mandates one profile per person and runs a dedicated project (Arborists) for duplicate merges; its documentation calls merge-conflict resolution "the height of genealogy collaboration... our greatest challenge". FamilySearch (1.74 billion names as of July 2025) acknowledges duplicates cause "duplicate research" and "incorrect merges". **Gap:** most local tools lack a mature merge/conflict workflow. Naoto already advertises "every change can be reviewed before approval" — a signal that approval workflows are a real need in the Indonesian market.

**1.5 Living-person privacy.** FamilySearch restricts living-person data (born <110 years ago without a death date) to its creator, but precisely **cannot share living-person data among family members** — a recurring complaint in its community. There was also an incident of a living person appearing in a public Timeline (the rickfaulkner2698453 case, 2022).

### 2. DNA Testing — Recommendation: STILL AVOID for the core
Southeast Asian DNA reference panels are weak: MyHeritage/Ancestry often give only coarse labels, and in a direct comparison AncestryDNA detected Southeast Asian ancestry that MyHeritage missed entirely. For the Indonesian market, DNA testing is (a) expensive, (b) imprecise in results, (c) a genetic-privacy concern. Moreover, genetic data is classified as high-risk "specific data" under Indonesia's PDP Law. **Recommendation:** do not build DNA testing as a core feature; if ever needed, an entirely optional "raw data upload" much later suffices.

### 3. Validated Indonesia-Specific Features

**3.1 Wali nasab calculator (Islam) — a real legal need.** The Compilation of Islamic Law (KHI) Article 21 regulates nasab guardians in four sequential groups **entirely through the paternal line** (the father & paternal grandfather upward; full/paternal brothers and their descendants; paternal uncles and their descendants; the grandfather's brothers and their descendants). Article 22: guardianship shifts to the next order when a closer eligible one doesn't qualify. The Ministry of Religious Affairs stresses "the marriage guardian order must not skip" (Kemenag Malang article), and KUA offices actively verify lineage clarity before the marriage contract (Kemenag/KUA Banyumas: "the clarity of the marriage guardian's nasab is the deciding factor of a marriage's validity"). A genealogy app mapping the paternal tree to KHI Article 21's order solves a real administrative/legal need. Talinasab.com already positions itself in the "nasab" space — a sign of market demand.

**3.2 Granular privacy + consent (PDP Law No. 27 of 2022) — a legal must.** The PDP Law was passed October 17, 2022, and its two-year transition ended October 17, 2024 — since then its provisions, including sanctions, are fully enforceable. The law applies to living persons' data. Full names, religion, and marital status are "general personal data"; meanwhile **genetic data and children's data are "specific data"** (PDP Law Article 4, alongside health, biometric, criminal-record, and personal financial data). Processing generally requires explicit, informed consent (Articles 20–21), controllers must retain consent evidence, and access/erasure/portability/consent-withdrawal rights must be honored. Sanctions are severe: **administrative fines "at most 2% (two percent) of annual revenue" (Article 57 paragraph 3)** and criminal provisions (Articles 67–70). Per Kominfo Press Release No. 426/HM/KOMINFO/09/2022, criminal exposure includes "fines up to IDR 4 billion to IDR 6 billion and imprisonment up to 4 to 6 years", with Article 70 adding fines up to 10x for corporations. **This turns "living vs deceased privacy" from nice-to-have into a non-negotiable legal must.**

**3.3 Marga/trah/tarombo & kinship terms.** Already in the vision's Tier 1 — strongly validated. Naoto and silsilahku.com show demand; the automatic kinship calculator (Naoto's flagship) is already "table stakes" locally, not a differentiator.

**3.4 Haul/birthday/event reminders & reunion mode.** Idola.id cites birthday notifications, communication forums, and confirmed event invitations as flagship features sought by Indonesian extended families. Grand family reunions are increasingly common (documented by TRAHku). **Gap in the vision:** **haul (death-anniversary memorials)**, specific to Islamic/Javanese culture, isn't explicit yet and carries high retention value.

### 4. Feature Gaps NOT Yet in the Vision Document (recommended additions)
1. **Consent management & per-living-person consent audit** (not just generic encryption/audit logs) — PDP Law mandatory.
2. **A first-class merge/dedup engine + approval workflow** — lessons from WikiTree/FamilySearch; local competitors remain weak here.
3. **AI handwriting transcription** (not merely "OCR of old books") — already the 2026 industry standard. Plain OCR is inadequate for handwritten tarombo/babad manuscripts or regional scripts.
4. **Haul/birthday/family-event reminder module** as a retention driver.
5. **Onboarding + ready-made templates** (e.g., a 6-generation core-family template, a marga/trah format) to cut the universally complained-about learning curve.
6. **GEDCOM 7 / GEDZIP + mapping to GEDCOM X / the FamilySearch API** as the 2025–2026 interoperability baseline (not just GEDCOM 5.5.1).
7. **Zu pu (Chinese clan genealogy) & baptismal genealogy import templates** for Chinese-Indonesian & Christian communities.

## Recommendations

**Phase 0 (foundation, 0–3 months): win "portable" for real.**
- Promote **GEDCOM 7 + GEDZIP** (media-inclusive) to Tier-0 foundation, with the explicit promise of "full export, no photo/source loss". *Benchmark:* a 100% lossless GEDCOM 7 round-trip.
- Build **per-living-person consent management + the living/deceased distinction** as PDP-Law compliance from day one. *Trigger threshold:* before storing third-party living persons' data, a consent flow + consent-evidence storage must exist.

**Phase 1 (parity + local differentiation, 3–9 months):**
- **Merge/dedup engine + collaborative approval workflow** (adopting the WikiTree/FamilySearch lessons). *Benchmark:* automatic duplicate detection at entry + review before commit.
- **Marga/trah/tarombo module + the visual kinship calculator** (parity with Naoto) and the **KHI Article-21-based wali nasab calculator** (a unique differentiator no global player has).
- **WA share links + print posters/PDF + birthday/haul/event reminders**.

**Phase 2 (AI & interoperability moat, 9–18 months):**
- **AI handwriting transcription** for old documents/tarombo (not just OCR) + **AI story weaver** — catching the 2026 standard, but with "no hallucination" guardrails per the ethics concerns raised at RootsTech 2026.
- **FamilySearch API integration (GEDCOM X)** and **Docker self-hosting** for open-source community penetration (Gramps Web as the collaborative open-source benchmark).

**What to AVOID/defer:** DNA testing (weak reference panels for Indonesia + PDP-Law "specific data" risk). Change this decision only if a provider with a credible Southeast Asian panel emerges; even then, limit it to optional "raw data upload".

## Caveats
- **The Stemmagraph vision document was not found as a single accessible file in Google Drive** (only a generic Vision Statement template from the "Dari Mata Turun ke Hati" folder). The "gap" analysis was based on the tier summary provided in the task prompt, not a reading of the original document. If a final version exists, some "gaps" may already be covered. *(Note: the vision now lives at `docs/vision.md` and incorporates these findings as of rev. 2/3.)*
- The **KHI Article 21** quotes come from official reproductions (Depag 2001 via UIN Malang/Datahukum); for formal legal/marketing use, verify against the official JDIH copy of Presidential Instruction No. 1 of 1991.
- The PDP Law's criminal articles (67–70) were summarized from official sources (Kominfo press release) and legal analyses; precise per-article quotes should be taken directly from the official BPK/Komdigi PDF (Law No. 27/2022, LN 2022/196).
- Some review sources (affiliate blogs, commercial comparison sites) are promotional; core complaints were corroborated across sources (official FamilySearch forum, WikiTree, ComplaintsBoard, Sitejabber).
- Indonesian WhatsApp user statistics vary by source (DataReportal, Quantumrun/Backlinko, World Population Review); use as a scale indication, not a single certain figure.
- Specific reviews for local apps (TRAHku, Galur.id, Naoto) aren't widely available publicly in app stores; local findings mostly come from their official marketing materials and third-party articles, requiring field validation (interviews/user testing) before final product decisions.
