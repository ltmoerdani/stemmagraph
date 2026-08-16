# Global Market Research: Pain Points, Feature Needs & Open-Source Strategy for Stemmagraph

> **Status**: 🟢 Active
> **Topic**: Global genealogy market evidence — pain points, feature expectations, monetization models
> **Updated**: 2026-08-16 (English rewrite of the original Indonesian research)
> **Tags**: research, market, competitors, open-source, monetization
> **Supersedes**: `01-riset-pasar-global.md` (Bahasa Indonesia version)

## TL;DR
- **Stemmagraph's global opportunity is real:** the genealogy market is worth ~USD 5–7 billion (2025) growing at ~11–12% CAGR, but it is dominated by subscription players that users resent for *subscription traps*, data *lock-in*, and *shutdown* risk — precisely the gap for an open-source AGPL, GEDCOM-native, self-hostable platform.
- **Stemmagraph's strongest differentiators** are a combination no single product has: modern UX (which Gramps/Webtrees lack) + full data ownership & self-hosting (which MyHeritage/Ancestry lack) + GEDCOM 7 interop + a *middle-ground* DNA path (raw uploads without selling kits).
- **Don't chase DNA/records retention yet** — those are expensive incumbent moats. First win the users churning over price, privacy (GDPR/living persons), and data-loss fear (evidence: 23andMe's bankruptcy & Geni's stagnation), while staying interoperable with GEDmatch/FamilySearch.

## Key Findings

**1. The global #1 complaint is subscription practice, not features.** Consumer sentiment toward MyHeritage is deeply negative — on PissedConsumer, MyHeritage scores 1.9 out of 5 across 333 reviews, with **only 5% recommending it, 79% unfavorable, and 63% saying they won't use the service again**; the most prominent complaints are *unauthorized charges and double billing*, *difficulty canceling trials or subscriptions*, and *unhelpful chatbots*. This creates anti-subscription sentiment that an open-source/self-host model can exploit immediately.

**2. Lock-in and data portability are the industry's structural wound.** Cross-platform export is full of friction: the GEDCOM standard doesn't carry media/photos and often loses citations; FamilySearch has no full native export at all (only 8 generations via GEDCOM 7, without photos). This strongly validates the "GEDCOM-native, no lock-in" positioning.

**3. The "platform death" risk is real and terrifying to users.** 23andMe's 2025 bankruptcy and Geni.com's stagnation after MyHeritage's acquisition prove that placing family data in a proprietary *walled garden* means carrying permanent risk. This is the strongest sales argument for self-host + AGPL.

**4. The open-source ecosystem (Gramps, Webtrees) is feature-strong but UX- and mobile-weak.** Both are mature, privacy-first, GEDCOM-native — but heavily criticized as too technical, with steep learning curves, not mobile-friendly, and convoluted basic flows. This is Stemmagraph's precise gap: modern UX (a React Flow canvas) on top of the same open-source value foundation.

**5. DNA matching is the incumbents' retention moat, but a middle ground exists.** MyHeritage/Ancestry lock *shared matches* & advanced DNA features behind subscriptions. However, the "raw DNA upload" path exists (MyHeritage free + a USD 29 *unlock fee*, GEDmatch cross-platform) and can be copied without Stemmagraph selling its own kits.

**6. Generative AI (2025–2026) is the new battlefield — with hallucination concerns.** Ancestry AI Stories, MyHeritage Scribe AI/GAIA, and the FamilySearch AI Research Assistant have all launched; critics and even Ancestry's CTO admit hallucinations will never fully go away. Stemmagraph can position AI as "transparent & source-grounded".

## Details

### A. Global Pain Points (with sources)

**Subscription traps & billing.** MyHeritage reviews are poor on PissedConsumer (1.9/5 rating; 333 reviews; 79% unfavorable; 63% won't use again). Complaint patterns are consistent: auto-charges after *free trials*, difficulty finding how to cancel, partial refunds (e.g., an Australian user billed €196.80 after a trial, offered only €49.20 back), and customer service consisting only of bots/tickets without replies. BBB and ComplaintsBoard show similar patterns, including accusations of *unauthorized charges* after DNA kit purchases. Even positive Trustpilot reviews are often stories of "I almost canceled but an agent offered a discount" — indicating retention depends on a *save-desk*, not product satisfaction.

**Price as the churn driver.** Community discussions show users pausing/canceling Ancestry purely for financial reasons (rotating historical-newspaper subscriptions, using public-library access). Ancestry All Access runs ~USD 129/6 months (discounted), reverting to *list price* on auto-renewal — a recurring friction source.

**Data portability & lock-in.** FamilySearch forums are full of questions about exporting trees to Ancestry/MyHeritage; the consistent answers: FamilySearch has no native export (needs certified third-party software), GEDCOM doesn't carry media/photos, and the export is "only 8 generations, no photos" via GEDCOM 7. Users with 2,000+ people & attached photos/records are effectively locked in.

**Privacy & living persons (GDPR).** A major issue in Europe. GDPR Recital 160 explicitly mentions genealogical research; however, the *right to be forgotten*/erasure applies to living persons, and the *controller* (the family tree owner) must respond to erasure requests, generally within 30 days. Geneanet even conducted a dedicated GDPR legal audit. Privacy activists in the DNA community (DNAeXplained) warn about public profiles containing living people without consent. The "personal/family activity" exemption (Art. 2(2)(c)) means private research falls outside GDPR — but once data is *published* online, obligations arise. This demands *consent management* & granular privacy as standard, not options.

**Shutdown risk / acquisition killing products.**
- **23andMe (2025):** filed Chapter 11 on **March 23, 2025** (U.S. Bankruptcy Court, Eastern District of Missouri). After a reopened auction, its assets — including the genetic database of **~13–15 million customers** (~13M per the court memorandum; ~15M commonly cited by *attorneys general*) — were acquired by the nonprofit **TTAM Research Institute** led by co-founder Anne Wojcicki for **USD 305 million**, beating Regeneron's initial USD 256M bid; the "substantially all" asset purchase was approved by Judge **Brian C. Walsh** and closed **July 14, 2025**. A bipartisan coalition of **27–28 US states + DC** sued to block the sale of genetic data without consent; several AGs (Utah, New York, Pennsylvania) issued *alerts* urging customers to delete their DNA data. The starkest possible case about permanent-data risk in a *walled garden*.
- **Geni.com:** acquired by MyHeritage in 2012; the community complains about the *single shared tree* model with *curators* blocking documented profile edits, and post-acquisition stagnation. Critics (Tamura Jones) document MyHeritage's pattern of buying competitors then migrating/deprecating products.

**Hint/matching & AI accuracy.** FamilySearch's *single global tree* is criticized because its import tools fail to detect duplicates and can overwrite good data; users advise keeping a private *master tree*. For AI: **Ancestry launched AI Stories (audio genealogy narration) on December 12, 2025**; Ancestry CTO & EVP Product/Technology **Sriram Thiagarajan** stressed "We want our AI to reflect those facts and the ground truth, and not hallucinate and make up stuff about your ancestors just for the heck of it," while also admitting AI inaccuracies are "never going to go away," so *guardrails* remain necessary (example guardrail: models trained not to assume someone served in a war merely because their military draft card was found). Ancestry claims a base of 65 billion records from 80+ countries. A coalition of researchers at RootsTech 2026 published five responsible-AI principles (accuracy, disclosure, privacy, education, compliance). A Family Tree Magazine reviewer found MyHeritage Scribe AI making transcription errors (recording text as "crossed out" when it wasn't).

### B. Specific Open-Source Community Complaints

Gramps is heavily criticized for usability ("does not even come close to user friendly", poor documentation — complaints collected on the project's own page, GEPS 034) and not running natively on mobile (needs Linux or Gramps Web via browser). Webtrees requires technical knowledge (PHP/MySQL/web hosting), a complex interface for beginners, and no dedicated customer support. Gramps Web is criticized for convoluted basic flows (adding a married person with children is judged "overcomplicated"), lacking *relationship privacy* (some users stay on Webtrees because of this), and 10,000-person GEDCOM imports taking hours (a database-efficiency bug). **What the open-source community considers missing in closed-source: freedom & data control. What they admit is missing in their own tools: UX, mobile, and easy onboarding.**

### C. Global Feature Needs Complementing the Indonesia Research

- **GDPR-grade privacy as a product feature:** per-person *consent management*, a *right-to-be-forgotten* flow (30 days), automatic *living-person* hiding, and *relationship-based privacy* (which even Gramps Web lacks). This complements the Indonesian PDP-Law research — one privacy architecture can satisfy both.
- **DNA middle ground:** support raw DNA uploads (from Ancestry/23andMe/MyHeritage/FTDNA) & GEDmatch-style interop, without Stemmagraph selling kits. Neutralizes part of the incumbents' DNA moat at low cost.
- **GEDCOM 7 interop:** as of 2025, GEDCOM 5.5.1 remains *de facto*; GEDCOM 7 is supported by FamilySearch, RootsMagic, Gramps (in development), Heredis, and Family Historian, while **Ancestry & MyHeritage still use 5.5.1**. A natively GEDCOM 7 Stemmagraph = an interop & long-term-archival advantage.
- **Archives/records integration:** serious users consider records access (FamilySearch, National Archives, Fold3, Newspapers.com) a main reason to stay on Ancestry. Stemmagraph doesn't need to own records — *deep links* & structured import suffice.
- **Transparent, source-grounded AI:** position AI as an assistant that always links the original source & flags uncertainty, contrasting with incumbent hallucination concerns.
- **Accessibility & multilingual support:** Webtrees supports 60+ languages & naming conventions (patronymic/matrilineal); Gramps is multilingual. This is the *baseline* to match for a global audience, and it aligns with Indonesian marga/trah needs.
- **Diaspora features:** cross-country/cross-language families need multilingual support, multi-calendar handling, and alternative names — where an Indonesia-first context (names without surnames, patronymics) becomes a global advantage.

### D. Open-Source Ecosystem Benchmark

- **Gramps:** Python/GTK desktop, first released 2001, GPL license, volunteer-developed, supporting patronymic/matronymic/multi-surname naming conventions — strong for professionals, weak in UX & mobile.
- **Gramps Web:** AGPL-3.0 web app (JavaScript/Lit frontend, Python/Flask REST backend), a companion to Gramps Desktop with two-way sync, with an AI assistant & interactive map; actively developed (David Straub et al.) but with a relatively small contributor community.
- **Webtrees:** PHP/MySQL self-hosted, a PhpGedView fork (2010), GPL-3.0, 60+ languages, granular privacy, multi-user collaboration; considered the most mature & active open-source web tool (tens of thousands of commits, 200+ GitHub contributors). *Market fit:* technical hobbyists & families wanting their own site.
- **Others:** PhpGedView (the predecessor, now dormant), HuMo-gen (multilingual PHP), TNG/The Next Generation (proprietary, web publishing), Ancestris (Java desktop, GPL, v13 Nov 2025), GeneWeb (OCaml), Rodovid (wiki), WikiTree (single world tree, free + ads, read-only MIT API, *core* closed for privacy).
- **Success/failure lessons:** winning projects have (a) strong GEDCOM interop, (b) contributor & translation communities, (c) privacy as a core value; those failing traction generally do so because of bad UX, missing mobile, and difficult onboarding. **Monetization models:** mostly pure donations/volunteering; Gramps Web offers paid *managed hosting* (grampshub.com) as the commercial bridge — a benchmark besides "open core".

### E. 2025–2026 Global Market Trends

- **Market size:** estimates vary by research firm. **Fact.MR:** USD 6.7B (2025) → USD 7.4B (2026) → USD 21.7B (2036), 11.3% CAGR. **The Business Research Company:** USD 4.61B (2024) → USD 5.15B (2025), 11.8% CAGR. **Kings Research:** USD 6.60B (2024) → USD 16.60B (2032), 12.06% CAGR. **Global Growth Insights:** USD 4.7B (2025) → USD 13.8B (2035), 11.36% CAGR. Consensus: a ~USD 5–7B market growing ~11–12% CAGR. **North America leads — Fact.MR cites ~45% of the global market**; Asia-Pacific grows fastest (~13% CAGR per Kings Research) — relevant to an Indonesia-first positioning.
- **Demographics:** genealogy users skew older — an Australian survey (775 respondents) had a median age of 63; a photo-restoration survey averaged ~57 with only 0.2% under 30. Primary motivations: identity seeking, family legacy, intellectual challenge, and health information (medical history via DNA).
- **Evolving product category:** from "family tree app" to "family history" (records + narrative + DNA) and now "AI-assisted family history". Stemmagraph's opening: real-time family collaboration + WhatsApp-first (from the Indonesia research) = the "family organizer/collaboration" category Western incumbents haven't seriously addressed.

## Recommendations

**Phase 1 (0–6 months) — Win the subscription rebels & data owners.** Focus on two personas: (a) users *churning* from MyHeritage/Ancestry over price/billing, and (b) the self-host/privacy community (r/selfhosted, r/datahoarder, Gramps/Webtrees communities) wanting modern UX. Core message: *"Your family's data, yours forever — native GEDCOM 7, self-host, AGPL, never shut down or sold."* Use the 23andMe & Geni cases as concrete proof. Success benchmarks: self-host install count & GEDCOM import count.

**Phase 2 (6–18 months) — Interoperability as the moat.** Prioritize: lossless GEDCOM 7 import/export (including media), raw DNA upload + GEDmatch-style interop, and *deep links* to FamilySearch/national archives. This neutralizes the incumbents' two retention reasons (records & DNA) without expensive content. Benchmark: GEDCOM *round-trip* fidelity (zero data loss) as a measurable marketing claim.

**Phase 3 — Privacy & AI as the ethical differentiators.** Ship *consent management* + *right-to-be-forgotten* + *relationship-based privacy* (beating Gramps Web) to satisfy GDPR & Indonesia's PDP Law simultaneously. For AI, launch *source-grounded* features (every output links the original record, uncertainty flagged) — make "anti-hallucination" a brand position distinct from the incumbents.

**Keep the Indonesia-first differentiation as a global advantage, not a limitation.** Marga/trah support, patronymics, surname-less names, and multilingual/multi-calendar support built for Indonesia precisely serve the diaspora & non-Western audiences Ancestry/MyHeritage ignore. Position Stemmagraph as *"genealogy done right for the whole world, not just the West."*

**Monetization model:** open-core + *managed hosting* (mirroring the Gramps Web/grampshub bridge) + premium collaboration/AI features — avoid the hated *subscription trap*; make transparent cancellation a brand differentiator.

**Strategy-changing thresholds:**
- If self-host adoption stagnates while *managed hosting* grows → pivot to SaaS-first with open source as the *trust signal*.
- If DNA interop proves to be the main retention driver (measure via cohorts) → invest deeper in DNA features.
- If Ancestry/MyHeritage start adopting GEDCOM 7 → accelerate the features they can't copy (self-host, granular privacy, real-time collaboration).

## Caveats
- **Market figures are inconsistent** across research firms (USD 4.6–6.7B for 2024–2025) and many come from commercial research vendors with opaque methodology; treat as indicative, not precise. "Genetic genealogy" figures (USD 1.04B, 2025) are a different subset and must not be conflated with the total genealogy market.
- **Consumer reviews (Trustpilot/PissedConsumer/BBB) carry selection bias** — skewed negative and not representative of the entire user base. However, the consistency of the pattern (billing/subscriptions) strengthens its validity as a signal.
- **Open-source community data** (contributor/commit counts) come from GitHub/forum snapshots and change quickly.
- **23andMe customer counts** vary by source (~13M per the court memorandum vs ~15M commonly cited by AGs/press).
- Some secondary sources (Grokipedia, Ithy, vendor blogs) were used only for context; important claims should be verified against primary sources before external publication.
