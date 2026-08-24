# Architecture Decision Records

This directory holds Stemmagraph's architecture decision records. Each ADR captures one significant decision: the context that forced it, the decision itself, its consequences, and how it is enforced. Records are numbered in sequence and never rewritten after acceptance. A decision that changes gets a new record that supersedes the old one.

Index:

1. [0001](0001-pure-core.md) Pure core, no commercial code in the application. Status: Accepted.
2. [0002](0002-roles-and-account-states.md) Roles and account states. Status: Accepted.
3. [0003](0003-event-store.md) Event store for the audit trail. Status: Accepted.
4. [0004](0004-invitations-and-tree-membership.md) Invitations and per-tree membership. Status: Accepted.
5. [0005](0005-whatsapp-share-v1-client-side.md) WhatsApp invitation sharing, v1 client-side click-to-chat. Status: Accepted.
6. [0006](0006-activity-feed-application-layer.md) Activity feed as an application layer over the event store. Status: Accepted.
7. [0007](0007-growth-metrics-k-factor.md) Growth metrics and the k-factor dashboard. Status: Accepted.
8. [0008](0008-weekly-digest-email.md) Weekly digest email, opt-in and consent-first. Status: Accepted.

To add a record: copy `0001-pure-core.md` as a template, take the next free number, keep the section order (Status, Context, Decision, Consequences, Enforcement when applicable, References), and open a pull request. Allowlist entries for the pure-core guard are one example of a change that requires a new ADR; code comments do not count.
