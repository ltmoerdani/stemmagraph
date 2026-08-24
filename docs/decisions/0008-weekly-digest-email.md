# ADR 0008: Weekly digest email, opt-in and consent-first

## Status

Accepted (2026-08-24). Implements item P2-7 on branch `improve/p2-7-weekly-digest-email`.

## Context

Every fact in Stemmagraph already lands in the event store (ADR 0003), but a member who opens the app once a month has no way to hear that a cousin added three people to their shared tree. The product needs a summary channel that tells members what happened while they were away, without becoming a surveillance surface or a second data pipeline.

Two constraints shape the decision before any code. The first is legal: UU PDP (Law No. 27 of 2022 on Personal Data Protection) requires a lawful basis for processing personal data, and recurring electronic communication to a person is exactly that. The cleanest basis for a product email is explicit consent given by the account owner, not a pre-checked box and not an admin flipping switches for other people.

The second is privacy: an email that leaves the server must carry as little as possible. Event payloads hold names, dates, and relationship facts about living people, so the digest never reads payload bodies. Research note R-74.4 additionally rejects WhatsApp as a delivery channel: WhatsApp in this product is click-to-chat sharing initiated by a human (ADR 0005), and automating messages into it would break that discipline and the channel's own terms.

## Decision

### Opt-in consent, stored as one column, default false

`User.digestOptIn` defaults to false. Nobody receives a digest until the account owner flips their own switch through `PUT /api/v1/digest/preferences`, which sits behind requireAuth and writes only the caller's own row, one boolean, nothing else. Switching off stops future emails at the next pass. Consent this narrow is trivial to audit: one column, one writer, the account owner.

### The privacy fence: counts and names, never payload data

The email body is plain text built by a pure module (`src/lib/digest/builder.ts`). Per tree where the recipient holds a TreeMember row, it carries the tree name, a count per event type, and the display names of the acting accounts, plus the ISO window label. That is the whole payload: no birth dates, no relationship details, no payloadJson fragments, no invitation tokens, no email addresses. Actor and tree names come from lookup rows passed in by the caller, never scraped out of event payloads. Without a TreeMember row the recipient gets nothing, and installation-wide events (null tree) never enter a digest.

### B2: the recipient's own actions are excluded

Events whose actor is the recipient do not count. The digest reports what others did on the recipient's trees; a member's own edits are facts they already know, and self-listings would only pad the email. This is acceptance criterion B2 of the P2-7 packet.

### SMTP_URL optional, DIGEST_DRY_RUN for rehearsal

The mailer has three honest states. Without `SMTP_URL` no transport is ever created, the hourly scheduler never starts, and the owner's manual send endpoint answers 503 instead of pretending a send happened. With `DIGEST_DRY_RUN=1` the email is rendered and logged with zero network traffic, for development and QA rehearsal. Otherwise one createTransport per send from the SMTP_URL string (`smtp://` or `smtps://`, optional `user:pass`). An installation that never configures SMTP simply has no digest feature running, which is the intended default.

### Once per ISO week, fail-closed per recipient

The window is the last complete ISO week, the same bucket rule as the growth metrics (ADR 0007): Monday 00:00 UTC, half-open `[startAt, endAt)`, never the week in progress. The guard `shouldSendDigest` allows a send only when `digestLastSentAt` is null or strictly earlier than the window start; a malformed stored timestamp parses to NaN and compares false, so garbage never authorizes an extra email. The column advances only after a real send succeeds: a dry-run rehearsal advances nothing (or it would block the real email later), and an honest empty digest skips the recipient without advancing either. Each recipient is isolated in try/catch inside the pass, so one broken row or one rejected send never stops the others.

### No backlog and no persisted email

Sent emails are not stored anywhere. The only write the digest pass performs is `User.digestLastSentAt`; it reads Event rows and never writes them (the P2-6 discipline). A failed send is not queued for retry: the recipient is simply served by the next weekly window, or earlier by the owner's manual trigger. There is no outbox table to leak, and no retention question to answer.

### Weekly only in v1

One frequency, one guard column. Daily digests, per-tree granularity, or a preferences matrix are deliberately absent; each would multiply the consent and guard surface for a need no user has stated yet.

## Consequences

- The dashboard gains a digest settings section (DigestSettingsPanel): the opt-in switch, a preview of last week's email via `GET /api/v1/digest/weekly` (look before you switch on), honest empty and failed states, and an honest unavailable note on adapters without a server backend (mock, supabase).
- The owner can trigger a pass manually via `POST /api/v1/admin/digest/send` (requireOwner), which fails closed with 503 when SMTP_URL is unset.
- Reading the whole window once per pass (all events, trees, memberships, actor names) and filtering per recipient in memory costs one query set per hour at most. At family-scale volumes this is invisible, and it keeps the builder pure and testable.
- Operators who want digests must configure SMTP_URL (and optionally DIGEST_FROM). Without it the feature is inert by design, which is the safe failure mode.

## Non-goals

WhatsApp delivery in any form (R-74.4); new EVENT_TYPES or changes to the event schema; writing Event rows; persisting email bodies, subjects, or a send backlog; per-tree or per-frequency digest settings; HTML email templates; open/click tracking of any kind; commercial constructs (pure core, ADR 0001).

## Enforcement

- `src/lib/digest/builder.test.ts` pins the privacy fence: membership filter, self-action exclusion (B2), counts and names only, no payload fields in output.
- `src/lib/digest/window.test.ts` pins the ISO week boundary, the half-open interval, and the once-per-week guard including the NaN fail-closed case.
- `src/lib/digest/mailer.test.ts` pins the three mailer states (disabled, dry-run, send) and the fail-closed refusal without SMTP_URL.
- `src/lib/digest/panelState.test.ts` and `src/lib/i18n/locales.parity.test.ts` pin the UI branch order and the EN = ID key parity of the `digest` namespace.
- The digest pass imports prisma for read queries plus one User.update; grep for writers of the Event table still returns only the P2-2 gate.
- `scripts/guard-pure-core.mjs` keeps scanning `src/` and `server/`; P2-7 adds no billing or subscription pattern.

## References

- Brief #75 pillar 2; the P2-7 acceptance packet `reports/ac-p2-7-stemmagraph-weekly-digest-email.md`; research note R-74.4 (reject WhatsApp as a digest channel).
- ADR 0003 (event store), ADR 0005 (WhatsApp v1 click-to-chat), ADR 0006 (application-layer read discipline), ADR 0007 (ISO week bucket rule).
- UU No. 27 of 2022 on Personal Data Protection: explicit consent as the lawful basis for recurring communication.
