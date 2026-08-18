# ADR 0001: Pure core, no commercial code in the application

## Status

Accepted (2026-08-18). Direction from the product owner (Laksana), 18 August 2026.

## Context

This repository was reused from an earlier product experiment that shipped a SaaS model, and scaffolding from that model survived the handover:

- `src/store/dashboardStore.ts` carried `isPremium: boolean` plus a `setPremium()` action in global dashboard state.
- `src/components/Dashboard/Dashboard.tsx` computed `maxMembersPerTree = isPremium ? Infinity : 15`, capping trees at 15 members until the user paid.
- `src/App.tsx` registered a commercial `/upgrade` route, with a matching `upgrade` view in `src/utils/routing.ts`.
- `src/components/Upgrade/` held a full mock purchase flow (`UpgradePage.tsx`, `PaymentModal.tsx`) with a pricing countdown and a fake payment gateway.

These constructs contradicted the product direction recorded in `docs/vision.md` (Product Purity Principle, section 1.5). Item S-01 removed all four in merge `838a26b` on `develop`: 968 lines deleted across six files, no replacement code. What remains is a clean baseline, and this record exists to keep it that way.

The market research behind the vision (`docs/research/01-global-market-research.md`) reinforces the point. Genealogy data outlives companies, and subscription distrust in this category is measurable: MyHeritage sits at 1.9/5 on consumer review platforms, and 23andMe's bankruptcy ended with its customers' genetic data auctioned. For a family deciding where to store fifty years of research, a core they can audit, with zero billing inside it, is a competitive feature. Any commercial code would quietly erase it.

## Decision

1. The Stemmagraph core is the complete product. Every genealogy feature runs in full for anyone who runs the app: tree editing, all view modes, export, collaboration, and future work such as GEDCOM interoperability. No feature gating, no payment-linked quotas, no premium tiers, no upgrade surfaces anywhere in the UI.

2. Commercial code stays out of the application. `src/` and `server/` must contain no billing, no premium flags, no paywalls, and no subscription logic. A violation fails the build and is rejected in review.

3. Paid services, if they ever exist, live on top of the application as separate services in separate codebases. Managed hosting is the working example; separately deployed add-ons would follow the same rule. Such a service provisions and operates instances of the core. Its plan limits are enforced at the infrastructure layer (storage quotas, rate-limiting proxies) and never in application code. Precedents for this split: WordPress.org versus WordPress.com, and Gramps versus grampshub.com.

## Consequences

Positive:

- Product focus. Engineering time goes into genealogy features, and no pull request ever debates whether a feature is free or paid.
- Frictionless onboarding. A family that opens the demo or self-hosts gets the whole product immediately, with no upgrade screens between them and their tree.
- Healthy contribution. Outside contributors can read and reuse the entire codebase without untangling payment scaffolding, which keeps the AGPL promise credible.
- Small audit surface. With no billing code there are no payment flows to audit and no checkout paths where security or privacy incidents breed.

Risks and mitigations:

- Monetization cannot be switched on from inside the product. Revenue depends on building a separate service that earns trust operationally. This is accepted by design: the vision's business model (section 7) is an overlay service, and it must win users on its own merits, not by holding trees hostage.
- Purity erodes quietly, one small flag at a time. Mitigated by automated enforcement (next section): commercial patterns fail the build, and any exception must be argued in a new ADR, so every deviation stays visible.

## Enforcement

Three mechanisms keep this decision active. They ship as item S-02 on branch `improve/pure-core-guard` and land in `develop` as a follow-up merge after this record. This section cites file and branch names only, with no commit hash, since the guard branch is still in review at the time of writing.

- `scripts/guard-pure-core.mjs` scans the source roots `src/` and `server/` for the commercial patterns `isPremium`, `paywall`, `billing`, and `subscription`, matched case-insensitively. It never descends into directories named `docs`, `node_modules`, `dist`, or `.github` at any depth, and it skips binary file types, so only source text is inspected. Markdown is out of scope by construction: documentation, including this ADR, may discuss commercial patterns freely without tripping the guard. The script runs on Node built-ins alone, needs no install step, and exits non-zero on the first offense it finds.

- The `prebuild` hook in `package.json` runs the guard on every `npm run build`, before Vite starts. A local build is therefore also a purity check; skipping it requires deliberately removing the hook, which review treats as a red flag.

- Continuous integration runs the same script on every push and pull request through `.github/workflows/pure-core.yml` (checkout, Node 22, run the guard), so violations fail before merge regardless of what any single machine does.

The guard carries an internal allowlist for legitimate exceptions. It is empty by default because the post-teardown baseline (`838a26b`) is clean. Adding an entry requires a new ADR that names the file path, the offending pattern, and the reason it is legitimate.

## References

- `docs/vision.md`, sections 1.5 (Product Purity Principle) and 5 (Strategic Architecture: Pure Core, SaaS-Overlay). This record turns that strategy into a binding architectural rule.
- Item S-01, branch `improve/teardown-saas-core`, merged to `develop` in `838a26b`: the teardown this baseline comes from.
- Item S-02, branch `improve/pure-core-guard`: `scripts/guard-pure-core.mjs`, the `prebuild` hook in `package.json`, and `.github/workflows/pure-core.yml`.
- `docs/research/01-global-market-research.md`: market evidence behind the pure-product positioning.
- ADR format follows Michael Nygard's template, as documented at https://adr.github.io/.
