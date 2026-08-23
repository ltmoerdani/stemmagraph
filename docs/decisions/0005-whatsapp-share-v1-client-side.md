# ADR 0005: WhatsApp invitation sharing, v1 client-side click-to-chat

## Status

Accepted (2026-08-24). Implements item P2-4 on branch `improve/p2-4-whatsapp-share`.

## Context

ADR 0004 gave invitations a lifecycle and a `channel` column that records the owner's intent, and stated the boundary plainly: the server sends nothing, and composing a share message is P2-4. Families that pick `wa` as the channel today still copy the link by hand, switch apps, paste, and send. The gap is not delivery itself, because the owner's own phone delivers fine. The gap is composition: the owner has to invent the words, and the link travels without the context ADR 0004 already guarantees (tree name, inviter name, honest scope).

Two architectures were on the table. Client-side click-to-chat: the app builds a `wa.me` URL in the browser and opens it, the owner's personal WhatsApp sends the message. Server-side WhatsApp Business Platform (Cloud API): the server calls Meta's API, which requires a Meta business account, a verified business, per-message pricing, opt-in evidence per recipient before the first message, and webhook handling. For a self-hosted family product the second architecture is not a harder version of the first; it is a different product with different legal duties. The opt-in rule alone is decisive: the platform demands proof that each recipient agreed to receive messages from a business identity, and a family genealogy install cannot produce that proof for relatives who have never interacted with the product.

Law No. 27 of 2022 weighs in the same direction. A phone number the owner typed for convenience is personal data (Article 4); storing it would demand purpose limitation, accuracy, and deletion mechanics (Articles 24, 31, 33) that click-to-chat never needs, because nothing is stored at all.

## Decision

### v1 is click-to-chat, personal, zero server involvement

When the channel is `wa`, the InvitationsPanel offers an optional phone input and a share button. The button creates the invitation through the existing P2-3 API (payload unchanged, no phone in it), composes a fixed four-field text, builds a `https://wa.me/` URL in the browser, and opens it with `window.open(..., '_blank', 'noopener')`. The owner's own WhatsApp app carries the message. The server has no sending endpoint, no WhatsApp API client, no credentials, and no webhook. This is the same "the app sends nothing on your behalf" posture the P2-3 copy already promised.

The composition lives in a pure module, `src/lib/share/whatsapp.ts`, with three exports: `normalizeWhatsAppPhone`, `buildWhatsAppUrl`, and `buildInvitationShareText`. The module imports nothing from the DOM, the server, or the store, so it is testable and safe to bundle.

### wa.me format rules, summarized

The URL grammar comes from the wa.me Help Center and is enforced, not assumed:

- The phone number is written in full international form: country code, subscriber number, digits only. No leading plus, no brackets, no hyphens, no spaces, no dots, no leading zero. `+62 812-3456-789` normalizes to `628123456789`.
- The normalized number must be 6 to 15 digits; anything else is refused before a URL is ever built.
- The message rides in `?text=` and must be URL-encoded by the caller (`encodeURIComponent`), never hand-concatenated.
- With no number at all, `https://wa.me/?text=<encoded>` opens WhatsApp's contact picker: the owner chooses the recipient in their own app. An empty phone is therefore a first-class path, and a missing input must not block sharing.

### Message minimization and the ad hoc number

The share text carries exactly four fields in a stable order: inviter name, tree name, invitation URL, and one consent-honest sentence from i18n. No member data, no tree statistics, no tracking parameters, nothing else. The consent sentence stays aligned with the P2-3 copy: joining grants limited access set by the inviter, and the app sends nothing on anyone's behalf.

The phone number the owner may type is component-local state. It is reset when the panel closes, never sent to the server, never persisted, never logged, never written to an event payload, and never appears in any URL except the wa.me URL opened in the owner's browser. The P2-3 payload validator's refusal list for recipient contact keys stays as it is; no schema, migration, or event type changes. The `channel: 'wa'` value on the invitation row is the only record that sharing was intended, exactly as ADR 0004 defined it.

### WhatsApp Business Platform is refused for v1, recorded as backlog

Server-side sending through the WhatsApp Business Platform (Cloud API) is rejected for v1 and moved to the backlog. The refusal is not about effort: business verification, per-recipient opt-in evidence, template approval, and per-message billing are obligations of a business sender, and they contradict both the pure-core stance of ADR 0001 (no billing constructs in the application) and the self-hosted reality of the product. If a hosted variant of Stemmagraph ever wants server-sent invitations, that decision gets its own ADR and its own consent architecture.

## Consequences

- Owners with channel `wa` get a one-click path: optional number, share button, WhatsApp opens with the message ready to send or a contact picker when no number was given.
- The server surface for invitations is untouched: no new endpoint, no new event type, no schema change, no dependency. The lockfile does not move.
- The number input must stay honest UI: the hint next to it says the number is not saved, and the component state is the only place it lives.
- Typos in numbers produce a wa.me URL that opens the wrong chat or WhatsApp's own "phone number shared via url is invalid" notice; the digit-count guard catches the crude cases, and the contact-picker path avoids typing entirely.
- Testing is locale-free: the pure module is covered by unit tests over digits and URL encoding, and the i18n template is covered by key parity between locales.

## Non-goals

Sending messages from the server under any circumstances, WhatsApp Business Platform or Cloud API integration, storing or syncing phone numbers (no column, no contact book, no analytics), WhatsApp branding assets (icons come from lucide-react), read receipts or delivery status, email sending (P2-7 track), any change to ADR 0002 or ADR 0004, any change to the invitation lifecycle, and any commercial construct (pure core, ADR 0001).

## Enforcement

- The payload validator in `src/lib/invitations` keeps refusing recipient contact keys, so a phone cannot enter an event payload even by accident.
- `scripts/guard-pure-core.mjs` keeps scanning `src/` and `server/`; no billing or subscription pattern may appear.
- The unit suite in `src/lib/share/whatsapp.test.ts` pins normalization, URL building, and composition, including the refusal cases.

## References

- ADR 0004 for the invitation lifecycle, the `channel` column, and the "server sends nothing" boundary this record implements.
- ADR 0001 for the pure-core rule that rules out per-message billing in v1.
- wa.me Help Center ("How to link to WhatsApp from a different app") for the URL grammar summarized above.
- Research notes for P2-4 (client-side click-to-chat chosen, Business Platform deferred) and Law No. 27 of 2022 Articles 4, 24, 31, and 33 for the minimization stance.
