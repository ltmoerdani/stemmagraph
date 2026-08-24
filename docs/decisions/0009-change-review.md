# ADR 0009: Change review, two versions one gate

## Status

Accepted (2026-08-25). Implements item P2-5 on branch `improve/p2-5-change-review`.

## Context

ADR 0004 made membership per-tree and enforced its matrix, and the matrix lets an Editor edit a member directly. That is the remaining trust gap: an invited relative can rewrite a person's facts silently, and the family member who curates the tree finds out after the fact, if at all. Every tree already has a natural arbiter, the Owner, and every edit already has a natural shape, a row. The P2-5 research asks for a review mode built from those two facts: an Editor's edit waits as a proposal beside the live version, and the Owner decides. Two versions, one gate.

The design also carries a privacy obligation. A proposal queue copies record content into a second table that outlives the editing session, so the copied field set must be as small as the editable columns themselves, free text must stay capped and purposeful, and the consent switch of a living person must sit outside the flow entirely. The consent clause R-74.6 (the T0e filter track) governs here the same way it governed invitations in ADR 0004 and the feed in ADR 0006.

## Decision

### Two versions, one gate

A proposal is one proposed edit of one live record, member or relationship, stored in the additive `ChangeProposal` table. The proposer sends `afterJson`, a snapshot limited to the proposal field contract; the server snapshots the live record into `beforeJson` at propose time so the diff the Owner reviews is frozen, not recomputed from a moving row. Until a decision, the live record never moves. Deciding is one Owner action with three outcomes, described below.

### Three states, and no fourth

`pending`, `rejected`, `distinct`. The vocabulary in `src/lib/changes` fixes the set, and the server refuses anything else.

`pending` is the queue. `rejected` records an Owner refusal with a mandatory decision note, and re-proposing different content on the same target stays allowed: refusal is feedback, not a ban. `distinct` is the verdict that the subject of the proposal is a different person or record than the one it targeted. It is permanent on purpose: the Owner is telling every future proposer that this exact content on this exact target is wrong by identity, not by timing or taste, so repeating it must fail before a row is written. The fence compares canonical JSON (sorted keys, no whitespace) so key order or formatting cannot smuggle refused content back in. A proposal matching a distinct row answers 410 with `CHANGE_DISTINCT_TARGET_LOCKED`.

Accepted is deliberately absent from the set. Accept is a transition, never a stored state: the endpoint consumes the proposal row and applies `afterJson` to the live record through the same update path a direct edit uses, in one commit. The consumption is a conditional delete (`state: pending` in the where clause), so two racing Owners cannot both accept; exactly one wins the row and the loser reads a clean already-decided answer. What remains after an accept is the audit fact, a `CHANGE_ACCEPTED` event, not a zombie row with a fourth state.

### The field contract

`beforeJson` and `afterJson` hold editable columns, nothing else. For a member: `name`, `nickname`, `birthDate`, `deathDate`, `birthPlace`, `currentLocation`, `profession`, `education`, `gender`, `photoUrl`, `email`, `phone`, `isAlive`, `generation`, `maritalStatus`, `notes`. For a relationship: `memberId`, `relatedId`, `type`. Unknown keys are refused at validation, which is what keeps a proposal from smuggling a second person's contact data, or any non-target column, into the queue table. `privacyStatus` is absent from the member list on purpose: it is the per-individual consent switch of the T0e track, and a proposal never touches consent. Technical keys (`id`, `treeId`, timestamps) identify the row rather than describe it, so they stay out too.

Free text exists in exactly two places, both capped so a proposal row can never become a message board. `reasonNote` is required, 3 to 500 trimmed characters: the Owner never reviews a mute edit. `decisionNote` is optional at 300 characters or fewer, mandatory only when rejecting, because a refusal without a stated verdict is not honest feedback for the proposer.

### Auto-accept is narrow, and off by default

One rule decides who may skip the gate: the proposer must be an Owner of that tree and a per-user opt-in flag must be active. Both must hold. An Editor's edit is never auto-accepted, whatever flags exist, because the entire point of the gate is that a non-owner's write waits for a human. v1 ships no settings surface for the flag, so the server passes `AUTO_ACCEPT_DEFAULT` (false) and every proposal, Owner-written included, waits for the gate. The policy lives in the pure module as `reviewAutoAccept`, a single decision point, so widening it later means changing one tested function and this record.

### Consent is never overridden

This clause repeats the stance of ADR 0002 and ADR 0004 because a queue table makes it tempting to break. A proposal never writes `privacyStatus`, and a decision never rewrites it: accept applies only the field contract above. Records of living people stay subject to the T0e privacy filter on every read and export surface regardless of how they were last edited, because accept routes through the same update path a direct Owner edit uses and adds no new read surface of its own. When role and consent disagree, consent wins. No part of P2-5 modifies the consent or living filters.

### Events and notifications

Three event types extend the vocabulary of ADR 0003, all written through its single gate: `CHANGE_PROPOSED` (actor is the proposer), `CHANGE_ACCEPTED` and `CHANGE_REJECTED` (actor is the deciding Owner). Payloads carry technical ids and policy metadata only; the validator refuses `beforeJson`, `afterJson`, and note texts, so record content and free text never enter the event store. A distinct verdict writes no event: the vocabulary ships exactly three change facts, and "marked distinct" is a table-level fence against future proposals, not an audited transition of the tree.

Notifications follow the fact, per the ADR 0003 projection pattern: a new proposal notifies the tree's active Owners, and a decision notifies the proposer. Nothing leaves the server (digests and email are ADR 0008 business and read events only).

### Surfaces

The API is role-shaped. `GET /trees/:id/change-proposals` answers with the caller's role: Owners see every pending proposal, Editors see their own submissions with outcomes, Viewers get an honest 403 because there is nothing for them to act on. Deciding endpoints require tree Owner.

In the UI, an Editor editing an existing member on a REST-backed tree submits through the member modal's propose path: the banner says the edit goes to the Owner, a reason of 3 to 500 characters is required, and the sent message keeps the outcome visible. Owners keep the direct edit path, unchanged. One panel, `ChangeReviewPanel`, serves both shapes: an Owner reviews every proposal (accept, reject with a required note, mark distinct), an Editor tracks their own. Adapters without the backend (mock, supabase) return null from `getChangeReviewApi()` and the UI hides the surfaces instead of pretending.

Relationship proposals are contract-complete (fields, endpoints, panel rendering) but nothing sends them yet: the product has no UI for editing an existing relationship, so the modal ships no such form. The gate is ready; the producer waits for that UI to exist.

### What SQLite does and does not enforce

Same honesty note as ADR 0003 and ADR 0004. The indexes on `(familyTreeId, state)` and `proposerUserId` are real; nothing in SQLite enforces that `afterJson` stays inside the field contract, that canonical comparison happens before every insert, or that a distinct row is never deleted to re-open refused content. Those properties live in the single server write path and the pure module's tests. Racing decisions are settled by the conditional update and delete primitives; a burst of simultaneous proposals on one target serializes behind SQLite's single writer at family scale.

## Consequences

- An Editor's edit becomes visible before it becomes true: the Owner reviews a frozen diff with a stated reason, and refusal carries feedback instead of silence.
- The Owner's curation survives collaboration: identity-level mistakes can be fenced off permanently without blocking the editor from proposing different content.
- The queue table duplicates record content by design, so the contract above is the minimization boundary, and the event store stays free of it.
- Accept leaves no residue to reconcile: the row is consumed and the event is the record, so the panel never renders a stale decided state.
- Viewers are refused loudly (403) rather than shown an empty queue that implies there is nothing to review.

## Non-goals

Tiered ratings of any kind (one proposal, one verdict, no scoring, no weights), bulk accept or reject, proposal comments or discussion threads, editing someone else's proposal, a UI form for proposing relationship changes, proposal expiry or scheduling, any change to consent or living filters (T0e), new event vocabulary beyond the three types above, and any commercial construct (pure core, ADR 0001).

## References

- ADR 0002 for the role vocabulary and the consent-wins clause this gate inherits.
- ADR 0003 for the event store, the single write gate, and the payload minimization policy extended here.
- ADR 0004 for per-tree membership and the invitation roles that feed this gate.
- Research note R-74.6, the consent clause behind the T0e filter, which no part of this flow may override.
- The pure module `src/lib/changes` (states, note bounds, field contracts, auto-accept and anti-re-proposal policy) and the P2-5 acceptance packet.
