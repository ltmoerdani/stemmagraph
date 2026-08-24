# ADR 0007: Growth metrics and the k-factor dashboard

## Status

Accepted (2026-08-24). Implements item P2-8 on branch `improve/p2-8-kfactor-dashboard`.

## Context

Brief #75 pillar 2 asks the product to understand its own growth loop: an owner mints an invitation (E1), a registration lands (E2), an owner approves the account (E3), and a revoked link (E4) closes a branch of that funnel. Research note R-75.7 proposes the C2 k-factor formula: new accounts that the existing active base produced in a week, divided by the size of that base at the start of the week. The owner needs to see this loop on an internal dashboard, next to the account list the admin panel already shows.

The event store (ADR 0003) already records every fact the formula needs, using the seven v1 event types. The temptation in the industry is to bolt on an analytics library or a tracking SDK; both would add a second data pipeline, new privacy surface, and a commercial dependency that ADR 0001 forbids in the pure core. The funnel semantics also carry an honest caveat: E2 (ACCOUNT_PENDING_CREATED) is a registration event, and treating it as "born from an invitation" is an inference from funnel order, not a tracked attribution. Until the product has its own data to validate the funnel, the numbers must stay labeled as an inference.

## Decision

### The C2 formula, computed from existing events only

`K(W) = N(W) / D(W)` where:

- `N(W)`, the numerator, counts accounts that recorded ACCOUNT_ACTIVATED inside week W AND recorded ACCOUNT_PENDING_CREATED strictly earlier (the invitation funnel order) AND are not disabled at the end of W. This is the PM cycle 5 item (c) decision: an activation that ends the week disabled produced no durable growth, so it does not count.
- `D(W)`, the denominator, counts accounts that recorded ACCOUNT_ACTIVATED before the start of W AND are not disabled at the start of W: the active base the new accounts came from.

Buckets are ISO weeks, Monday 00:00 UTC, half-open `[startAt, endAt)`. The `weeks` parameter defaults to 12 and clamps into 1..26. Two companion rates round out the funnel view: `pakaiRate(W) = E2 in W / E1 in W` and `aktivasiRate(W) = E3 in W / E2 in W`. These use raw counts and deliberately differ from the restricted K numerator; the difference is documented here and in the module. No new event types are added, no event fields change, and no analytics library or tracking of any kind enters the code: the metrics read what the audit trail already stores.

### A pure projector, an owner-only endpoint, and zero division honesty

`src/lib/metrics/kfactor.ts` is free of I/O: raw event rows go in, weekly buckets come out. Garbage input (unknown type, broken payload, invalid timestamp) returns an honest validation error instead of a silently corrupted aggregate. Division by zero yields an honest 0, never NaN and never an exception; an empty week is a fact, not a crash. Rates keep exact fractions inside the module and round to 4 decimals only at the serialization boundary of the endpoint.

`GET /api/v1/admin/metrics/growth` sits behind requireAuth + requireOwner, the same gate as the admin accounts routes. It reads the five metric event types with a read-only findMany (the P2-6 feed query discipline), projects them with the pure module, and adds one snapshot number that events cannot answer.

### The active-editor metric comes from live rows, not events

`treesWithActiveEditorPct` is the percentage of trees with at least one TreeMember that have at least one TreeMember with role editor whose User row has status active, rounded to 2 decimals. The source is TreeMember plus User, because membership and current account status are present-tense facts; replaying events would reconstruct a history the question does not ask for. An empty membership table yields an honest 0.

### An application layer outside every export, and an inference until proven

The dashboard is an application layer in the sense of R-75.8: growth metrics never enter the PDF or PNG exports and never enter a future GEDCOM export. An export file is portable genealogical data; a k-factor is an operational observation about the installation. The funnel labels stay honest in the UI copy and here: E1 to E2 to E3 is an assumed funnel inferred from event order, not per-user attribution, and the first weeks of data on the product's own install base are the validation.

## Consequences

- The owner admin panel gains a read-only growth section: a weekly table (week, E1, E2, E3, K, use rate, activation rate) and the trees-with-active-editor snapshot, with honest empty, failed, and unavailable states. Only the REST adapter implements the surface; mock and supabase report unavailability instead of fake numbers.
- The denominator grows as the active base grows, so K naturally shrinks for a stable base; owners reading the dashboard need the denominator column to interpret it, which is why the response ships it.
- Reading full activation history per request costs one findMany over five event types. At family-scale volumes this is invisible, and it keeps the metrics exactly as truthful as the audit trail.
- Disabled-then-re-enabled accounts rejoin the denominator once their last state flip is an enable; the formula follows the account state machine rather than punishing past disables forever.

## Non-goals

New event types, tracking, telemetry, cookies, or analytics libraries; per-user attribution or cohort tooling; email digests (P2-7); realtime updates; writing any computed metric to the database; changes to the event store or schema; export of metrics in any format; commercial constructs (pure core, ADR 0001).

## Enforcement

- `src/lib/metrics/kfactor.test.ts` pins bucket boundaries, the numerator restrictions (no earlier E2, disabled at week end), the denominator restrictions (disabled at week start), zero-division honesty, both rates, and the weeks clamp; `kfactor.query.test.ts` pins the ?weeks= parsing discipline.
- The projector refuses unknown event types and broken payloads; tests feed it garbage and assert the honest error.
- The endpoint reuses requireOwner; grep for a second writer to the Event table still returns only the P2-2 gate.
- `scripts/guard-pure-core.mjs` keeps scanning `src/` and `server/`; P2-8 adds no billing or subscription pattern.
- The i18n keys for the panel exist in exact EN = ID parity.

## References

- Brief #75 pillar 2 and research notes R-75.7 (C2 formula) and R-75.8 (application layer outside exports).
- PM cycle 5 item (c): the K numerator counts activations that end the week not disabled.
- ADR 0003 for the event store; ADR 0006 for the read-only application-layer discipline this dashboard follows.
- Owner approval of the P2 bundle, 2026-08-23.
