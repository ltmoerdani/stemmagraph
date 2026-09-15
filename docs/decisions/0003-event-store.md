# ADR 0003: Append-only event store

## Status

Accepted (2026-08-23). Implements item P2-2 on branch `improve/p2-2-event-store`.

## Context

Until now, the only durable trace of account administration was the `Notification` table from P2-1. Notifications are a delivery mechanism: they exist so a screen can show a badge, they get read and marked read, and their payload is shaped for display (it carries the pending user's email and name). Answering "who disabled this account, and when" from notifications alone is impossible, and the account lifecycle has no audit trail at all: a disable leaves no row anywhere.

Two product needs converge here. First, later phases want to react to facts (P2-3 invitation flows, P2-5 and P2-6 analytics and digest surfaces, P2-8 maintenance jobs); they need a stable log of what happened, not a scrape of display payloads. Second, the Indonesian Personal Data Protection Law (Law No. 27 of 2022, Article 31) requires the controller to record and document each personal data processing activity. A minimal, append-only event store is the honest way to meet that obligation for account administration without building a general audit framework.

## Decision

### One write gate and one dedicated table

Every fact is written through a single server-side helper, `appendEvent(type, actorUserId, familyTreeId, payload)` in `server/events.ts`. It is the only place in the codebase that calls `prisma.event.create`; a grep for that call anywhere else must return nothing. The `Event` table is dedicated to the store (AC-1): `id`, `type`, `actorUserId`, `familyTreeId`, `payloadJson`, `createdAt`, with four indexes covering the list, type, actor, and tree access paths. There is no update and no delete path, in code or in any endpoint. The admin surface is one read-only listing: `GET /api/v1/admin/events`, owner-only, 50 most recent rows, optional exact `?type=` filter.

```
  route handler ──builds envelope──► appendEvent ──validates──► Event table
                                    │
                                    └──same envelope──► notification projection
```

### Why append-only

An audit log loses its value the moment it can be edited. Rows are inserted, never mutated: no endpoint issues an update or delete against `Event`, and the pure module refuses to construct anything but a complete envelope. This also keeps the storage story trivial on SQLite: no compaction, no rewrite jobs, the table only grows, and a family-scale installation grows it by a handful of rows per administrative action.

### Payload minimization and the PII refusal policy

The store must outlive consent changes, so it must hold the least data that still answers the audit question. The v1 contract gives every payload exactly one technical key, `subjectUserId`; the actor and the family tree live in indexed columns, not in JSON. The validator in `src/lib/events` refuses third-party contact keys (`phone`, `phoneNumber`, `number`, `wa`, `whatsapp`, `nomor`, `email`, compared after normalization so `phone_number` and `PhoneNumber` are caught too), unknown keys, and empty values. Technical user ids are allowed: they identify accounts, they are not contact data, and without them the log could not say which account a fact is about. The gate is best-effort by review and by convention; it is a contract the server honors, and future contributors extend it by extending the pure module first.

### What SQLite does and does not enforce

This is an honesty note, not a complaint. SQLite enforces the schema and the indexes, but nothing in it makes a table append-only: any code with a database handle can issue `UPDATE` or `DELETE`. The append-only property is therefore enforced by the single write gate, by the absence of any mutating endpoint, and by review (the grep check above is part of the definition of done). Filesystem-level protections (immutable files, WAL snapshots) are out of scope for a self-hosted family server and would fight the normal backup story.

### Notifications are a projection

The P2-1 notification rows are now derived from the emitted event: the handler writes the fact first through `appendEvent`, then builds notification rows from that same envelope (`projectPendingCreatedNotifications`, `projectAccountActivatedNotification`). Display data (the pending user's email and name) comes from the user record at projection time, never from the event payload, which is why notifications can stay friendly while the store stays minimal. External behavior is unchanged: same notification types, same payloads, same status codes. Future consumers (P2-3 invitations reacting to activation, P2-5 and P2-6 surfaces, P2-8 jobs) read the store or add their own projections; they do not write parallel logs.

### Consent is not overridden by events

Recording a processing activity does not license more processing. An event says "this happened"; it does not extend any permission, does not subscribe anyone to anything, and does not make a pending account active. Consent filtering for living persons (the T0e track) keeps its own state, and projections must respect it before showing anything user-facing.

### No backfill

The store starts empty. Existing installations keep their notification history exactly as it is; nothing reconstructs past account events from it, because notification rows are display-shaped and would fabricate precision (no actor, approximate timing). The log is honest from its first day forward, and the omission is recorded here rather than papered over.

## Consequences

- Account administration has a factual trail: type, actor, subject, timestamp, queryable by the owner.
- Every new write path must go through the gate and the pure module; "just one more field in the payload" is a contract change that needs a validator update and a note here.
- The table grows without bound by design; at family scale this is thousands of rows over years, and a retention decision (if ever needed) belongs to its own ADR.
- The Article 31 processing record is satisfied for account administration in a minimal way; a fuller processing register is a separate concern, not this table's job.
