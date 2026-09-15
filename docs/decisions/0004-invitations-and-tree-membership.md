# ADR 0004: Invitations and per-tree membership

## Status

Accepted (2026-08-23). Implements item P2-3 on branch `improve/p2-3-invitations`.

## Context

ADR 0002 fixed the vocabulary for collaboration (tree-scoped Owner, Editor, Viewer) but left the enforcement open: every active account could reach and edit every tree, and the record states that gap plainly. Growing a tree today means telling a relative "register, then wait", with no way to hand them a scoped place in one specific tree. Two needs converge. First, membership must become per-tree, otherwise the Editor and Viewer columns of the permission matrix are fiction. Second, the joining flow needs a bearer object a family can pass around by hand: an invitation link with a lifecycle, not a shared password and not a manual database row.

The invitation design also carries legal weight. The audit trail requirements of the Indonesian Personal Data Protection Law (Law No. 27 of 2022) apply here: Article 22 (right to object to processing), Article 24 (accuracy and purpose limitation), Article 31 (recording and documenting processing activities), and Article 33 (consent of the data subject for disclosure of personal data). The event store from ADR 0003 is the mechanism chosen to satisfy Article 31 for invitations; the consent clause below exists because of Article 33.

## Decision

### Two invitation types, one table

An invitation is a row in `Invitation` with a URL-safe token of at least 128 bits of entropy generated per row through the Node `crypto` module. The token is never derived from user input, never hardcoded, and shown in full exactly once, in the creation response. Every later surface sees a masked token.

Two types ship, both scoped to one tree and one granting role:

- `personal`: single use, time to live 48 hours, granted role is always `viewer`. Meant for one named relative; consumed by the first successful registration.
- `family`: multi use, time to live 7 days, `maxUses` defaults to 20 and is clamped to the range 1..100 at creation, granted role is `viewer` or `editor`. Meant for a family gathering or a group chat, where the owner cannot predict who will click.

The constants (TTL per type, default and clamped max uses) live in the pure module `src/lib/invitations` and are consumed by the server, so the numbers in this record and the numbers in the code cannot drift apart. The `channel` column records how the owner intends to hand the link over (`manual`, `wa`, `email`). It is data only: this server sends nothing out, and composing or sending a WhatsApp message is P2-4, not this record.

### The state machine

`invitationState(invitation, now)` in the pure module returns exactly one of `active`, `expired`, `exhausted`, `revoked`, `consumed`. Precedence is fixed so a caller never has to guess: `revoked` beats everything, then `expired`, then `exhausted` or `consumed` (a personal invitation is consumed after one successful use; a family invitation is exhausted when `usedCount` reaches `maxUses`), and only then `active`. Expiry is inclusive: at exactly `expiresAt` the invitation is already expired. Every read surface recomputes state from the row, so there is no cached status column to fall out of sync.

### Registration is fail-closed

The register endpoint accepts an optional `invitationToken`. The rule is one sentence: an invalid, expired, exhausted, revoked, or consumed token creates no account. The attempt answers with an honest code (404 for an unknown token, 410 for the three dead states) and emits `INVITATION_USED` with `result: failure` and the reason code, so the audit trail records abuse and typos without creating half-registered users.

A valid token changes two things and only two things. The account is still born by the P2-1 rule: `pending`, role `member`, no session token, owners notified exactly as before; the invitation never overrides the activation gate. And a `TreeMember` row is born with the invitation's granted role, `usedCount` rises by one, `lastUsedAt` is stamped, and `INVITATION_USED` with `result: success` records the new `subjectUserId`.

Bootstrap precedence stays exactly as ADR 0002 defines it: the first account on an empty user table is born active with installation role owner, invitation or none. An invitation cannot mint an installation owner.

### Per-tree enforcement and the one exception

The permission matrix of ADR 0002 is now enforced at the API:

- `GET /api/v1/trees` returns only trees where the caller holds a `TreeMember` row.
- Reading a tree, its members, or its relationships requires any tree role.
- Creating or editing a member, and creating a relationship, require `editor` or `owner`.
- Deleting a member or relationship, updating or deleting the tree, managing invitations, and managing membership require `owner`.
- Violations answer 403 with code `FORBIDDEN_TREE`.

Creating a tree always births the creator's `TreeMember` row with role `owner`, so no tree exists without an owner.

One exception is documented and deliberate: an active installation owner (the `role` column of `User` from ADR 0002) retains administrative reach across all trees, including trees they hold no membership in. Without it, a single-owner installation that never creates a personal tree could not see or repair anything a family member built. The strict target model, where installation owners hold no implicit tree reach and every cross-tree action needs an explicit membership row, is recorded here as the evolution path; reaching it requires a backfill or an explicit self-grant step, and doing that silently is worse than the exception. When that step is designed, this exception is retired.

### TREE_LAST_OWNER_GUARD

A tree must never lose its last active tree owner: that tree would be unfixable through the application. Demoting or removing the membership of the only active account holding tree role `owner` is refused before the write with 409 and code `TREE_LAST_OWNER_GUARD`, mirroring the installation-level `LAST_OWNER_GUARD`. An account-level disable of that same person is not additionally guarded here; the membership row survives and can be restored by enabling the account, which is why the guard is scoped to the membership operations.

### Consent is never overridden

This clause repeats ADR 0002 because invitations make it tempting to break. A granted role decides which actions a collaborator may attempt; the living-person consent filter (the T0e track) decides which living relatives' data any action may touch. An Editor invitation is not a promise of full genealogy visibility, and the invitation copy the owner hands around must not claim one: the register context screen and the suggested text say what the tree is and that living relatives' data stays subject to each person's consent. When role and consent disagree, consent wins and the action fails closed. No part of P2-3 modifies the consent or living filters.

### Audit through the event store

Three event types extend the v1 vocabulary of ADR 0003, all written through the same single gate: `INVITATION_CREATED` (creation facts: type, channel, granted role, expiry, max uses), `INVITATION_USED` (every redemption attempt with `result` and, on failure, a reason code), `INVITATION_REVOKED`. Payloads carry technical ids and policy metadata only. The recipient's contact details never enter the store: the validator's refusal list now also names recipient-specific keys, and the design keeps no column for a recipient phone number at all. This is the Articles 22, 24, and 31 story for invitations: what was created, by whom, when, how it was meant to be shared, what each attempt did, and when it was killed.

### What SQLite does and does not enforce

Same honesty note as ADR 0003. The unique token constraint, the `(treeId, userId)` uniqueness, and the indexes are real; nothing in SQLite enforces that a token has 128 bits of entropy, that `usedCount` only rises through the redemption path, or that revocation is append-only in spirit. Those properties live in the single server write path and the pure module's tests. Concurrent redemptions of the last family use are serialized by SQLite's single-writer nature at family scale; a burst of simultaneous registrations on one multi-use link can still overshoot `maxUses` by at most the number of in-flight requests, and the clamp plus the honest `usedCount` reading make that visible rather than hidden.

## Consequences

- Joining a tree becomes a link a family can hand around, with an honest lifecycle instead of shared credentials.
- The permission matrix columns Owner, Editor, Viewer are enforced facts now, with `FORBIDDEN_TREE` as the loud boundary.
- Trees cannot strand themselves: creation births an owner, and the last-owner guard refuses the remaining footguns.
- The public `/info` endpoint tells an unauthenticated visitor only the minimum: type, tree name, inviter display name, expiry, remaining uses. No contact data, no member data, no login oracle beyond the token they already hold.
- The strict installation-owner model is deferred with a documented exception, which is cheaper than a silent backfill and easier to retire.

## Non-goals

Sending anything outside the server (email, SMS, WhatsApp), composing share messages (P2-4), an activity feed UI (P2-6), email digests (P2-7), invitation analytics or K-factor surfaces (P2-8), a review mode for proposed changes (P2-5), any change to consent or living filters (T0e), any change to GEDCOM, PDF, or PNG export, backfilling event history, and any commercial construct (pure core, ADR 0001).

## References

- ADR 0002 for the permission matrix, the bootstrap rule, and the consent clause this record enforces.
- ADR 0003 for the event store, the single write gate, and the payload minimization policy extended here.
- Research R-74 (invitation lifecycle, two types, audit obligations under Articles 22, 24, 31, and 33 of Law No. 27 of 2022).
