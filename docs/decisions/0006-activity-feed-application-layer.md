# ADR 0006: Activity feed as an application layer over the event store

## Status

Accepted (2026-08-24). Implements item P2-6 on branch `improve/p2-6-activity-feed`.

## Context

ADR 0003 gave the product a single append-only event store as its audit trail, and P2-2 wired the seven v1 event types into it: four account facts (pending registration created, activated, disabled, enabled) and three invitation facts (created, used, revoked). The store is complete but silent. A member who opens the dashboard cannot see what happened around them: who joined, which invitation link was used, whether an account came back to life. The answer to "what changed" already sits in the `events` table; the missing piece is a projection of it.

Two build options existed. A feed table: the server listens to its own events and maintains a denormalized `feed_items` row per event, which the UI then queries. A pure projection: the feed is computed from the event store at read time, with no new table, no new writer, and no second copy of history to keep honest. Research note R-75.5 settles it: the feed is a pure query over the P2-2 event store, no exceptions. A denormalized table would duplicate the audit trail and add a consistency problem (the feed table drifts when a write fails between the two writes) for zero read benefit at family-scale volumes.

Research note R-75.8 adds the boundary: the feed is an application layer, outside the GEDCOM export. An export file is a portable copy of genealogical data meant to leave the product; a feed is a here-and-now answer about activity for the person looking at the screen. Merging the two would put operational telemetry into a family data file.

Law No. 27 of 2022 and the consent clause R-74.6 (filter T0e) shape the payload side: whatever the feed shows must respect consent, and living persons' records are the sensitive class. The v1 payloads happen to carry no living-person data, but that is luck of scope, and scope changes.

## Decision

### The feed is a read-only projection, not a stored artifact

`src/lib/feed/` contains a pure projector: an `EventEnvelope` goes in, a `FeedItem` view model comes out (id, type, kind, createdAt, actorUserId, familyTreeId, i18nKey, minimal params). The module imports nothing: no database, no HTTP, no React. The server endpoint `GET /api/v1/activity-feed` (requireAuth) queries the event store, projects, and returns `{ items, nextCursor }`. Nothing in the P2-6 code calls `appendEvent`, adds an event type, or writes any table. The feed cannot drift from the audit trail because it is the audit trail, read.

### Scope v1: your trees and your own account

The endpoint returns two slices: events for trees where the caller is a TreeMember (every role may read, consistent with the ADR 0002 matrix), and account events where the caller is the subject or the actor. Account events about other people never enter a member's feed; the owner keeps the full view through `/api/v1/admin/events`. Query parameters are validated honestly: an unknown `?type=` is a 400, `?limit=` defaults to 50 and clamps into 1..100, and `?before=` is an idempotent keyset cursor on createdAt.

### Invitation minimization is the consent fence

Projected invitation items carry exactly five facts: the channel, the invitation type, the outcome, the time, and the invitation id. Phone numbers, share message text, and invitation tokens never pass through: params are rebuilt per event type from a whitelist, never copied from the raw payload, so even a legacy row that smuggled contact data into its payload cannot leak it into a feed item. Tests pin this by planting a phone number, a token, and message text in an envelope's payload and asserting none of them survive projection.

### A documented fence for future living-person events

The v1 vocabulary carries no living-person data. The fence for the future is structural: the projector has an explicit type allowlist, and a tree event that touches a living person's record reaches the feed only after that type is added to the allowlist on purpose, with its own minimization review and consent filter in front of it. Until then the projector refuses unknown types outright, and a test pins the refusal with a hypothetical person-record event.

### Outside the GEDCOM export, permanently

The feed is not exported. Not in the current PDF/PNG exports, not in a future GEDCOM export: an exporter that ever wants activity history gets its own decision and its own consent story. The export documentation says so in one sentence.

## Consequences

- The dashboard gains a section tab with a localized list of what happened, a filter over the seven v1 types plus "all", cursor-based load more, and honest empty, loading, retry, and unavailable states. The unavailable state is honest by design: only the REST adapter has a server event store, so mock and supabase adapters report that the feed needs the server backend instead of showing a fake list.
- The read path costs a projection per request instead of a table scan of a feed table. At family-scale volumes this is invisible, and it buys the property that the feed is always exactly as truthful as the audit trail.
- Adding an eighth event type is now a visible decision: the projector's allowlist, the i18n keys, the filter dropdown, and the privacy review all have to move together, which is the point.
- Pagination is cursor-based and stable, so "load more" never duplicates or skips items across inserts that arrive mid-scroll.

## Non-goals

Email digests (P2-7 track), review mode (P2-5), a K-factor dashboard (P2-8), new event types, realtime push or WebSocket transport, new columns or migrations, any change to the Notification module (P2-1), any change to the GEDCOM export format, storing computed feed items anywhere, and any commercial construct (pure core, ADR 0001).

## Enforcement

- The projector in `src/lib/feed/feed.ts` keeps the explicit type allowlist; the defensive tests feed it unknown and hypothetical person-record types and assert refusal.
- The minimization tests plant contact data in an envelope and assert it never reaches the projected item.
- `scripts/guard-pure-core.mjs` keeps scanning `src/` and `server/`; P2-6 adds no billing or subscription pattern.
- The unit suites in `src/lib/feed/feed.test.ts` and `src/lib/feed/query.test.ts` pin projection, grouping, filtering, and pagination behavior.

## References

- ADR 0003 for the event store this layer reads.
- ADR 0002 for the role matrix that lets every TreeMember read their tree's feed.
- ADR 0001 for the pure-core rule.
- Research notes R-75.5 (feed as a pure query over the event store) and R-75.8 (feed outside the GEDCOM export), consent clause R-74.6 (filter T0e), and Law No. 27 of 2022 for the minimization stance.
