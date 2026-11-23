# ADR 0016: Pure-Core Architecture &amp; Commercial-Free Enforcement

- Status: Accepted
- Date: 2026-11-23
- Decided by: Ardi (PM) &amp; Pak Laksana

## Context
Stemmagraph is envisioned as a pure, open-source genealogical platform without commercial paywalls, subscription models, or feature gating inside the core application. To preserve this vision under D-tier principles, all legacy SaaS constructs must be completely dismantled and guarded automatically against regression.

## Decision
1. **Zero Paywall / Zero Billing in Core:** The application core (`src/` and `server/`) must never contain billing logic, subscription state checks, premium flags (`isPremium`), or feature paywalls.
2. **Automated CI / Prebuild Guards:** A pre-build check must actively scan for prohibited commercial regex patterns (`isPremium`, `paywall`, `billing`, `subscription`) to fail builds instantly upon violation.
3. **Unrestricted Portability:** All genealogical data and family tree exports remain completely open and un-metered for every user.

## Consequences
- Developers and automated agents cannot introduce commercial gates into `src/` or `server/`.
- Future monetization, if any, must live strictly outside the core application layer.