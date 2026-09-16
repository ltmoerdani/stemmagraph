# ADR 0012: Consent facts in the event vocabulary

## Status

Accepted (2026-09-17). Part of S-09a-i on branch `improve/stg-s09a-i-events`.

## Context

The consent ledger (S-06a, src/lib/consent) records every grant, revoke, and regrant per member, and the privacy gate already reads it on export and share. The append-only event store (ADR 0003) has no consent vocabulary, so the strongest privacy decisions a family can make leave no mark in the audit trail: if a ledger row is corrected, purged, or lost, nothing in the event history shows that a consent was once given or withdrawn.

Consent enforcement is a privacy pillar promise. A decision this central deserves the same durable audit treatment as account lifecycle and change review: one fact per decision, technical ids only, appended once and never rewritten.

## Decision

Two event types join the vocabulary, bringing it from ten to twelve: `CONSENT_GRANTED` and `CONSENT_REVOKED`. The action `regrant` maps to `CONSENT_GRANTED`, because from the store's point of view a regrant is a consent given again; the ledger keeps the fine distinction, the audit vocabulary does not need it.

The payload carries exactly four keys: `consentId` (the ledger row the fact derives from), `memberId` (the subject of the decision), `action` (grant, revoke, or regrant), and `occurredAt` (ISO timestamp copied from the ledger row). The envelope carries the actor account and the tree as columns, per the ADR 0003 pattern.

The ledger's free-text `note` and its `scope` string never enter the store. The note is unreviewable user content and the scope taxonomy is still moving; both stay in the ConsentRecord table, the same way change-review snapshots stay out of the store (ADR 0009).

The builder `buildConsentEvent()` and the validator `validateConsentEvent()` live in src/lib/events/consent.ts as pure functions with no server import, so wiring and testing can proceed independently of the endpoint layer.

## Consequences

Every consent decision becomes a permanent, queryable audit fact, which strengthens the privacy pillar and gives support an honest history when a member disputes a decision. The vocabulary grows by two types, so the projectors must be extended when the wiring lands; until then the types exist as contract only. Payload data is minimal by construction, so a withdrawn consent leaves no PII beyond technical ids, which is exactly what an audit trail needs and no more.
