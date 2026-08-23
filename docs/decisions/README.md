# Architecture Decision Records

This directory holds Stemmagraph's architecture decision records. Each ADR captures one significant decision: the context that forced it, the decision itself, its consequences, and how it is enforced. Records are numbered in sequence and never rewritten after acceptance. A decision that changes gets a new record that supersedes the old one.

Index:

1. [0001](0001-pure-core.md) Pure core, no commercial code in the application. Status: Accepted.
2. [0002](0002-roles-and-account-states.md) Roles and account states. Status: Accepted.

To add a record: copy `0001-pure-core.md` as a template, take the next free number, keep the section order (Status, Context, Decision, Consequences, Enforcement when applicable, References), and open a pull request. Allowlist entries for the pure-core guard are one example of a change that requires a new ADR; code comments do not count.
