# ADR 0002: Roles and account states

## Status

Accepted (2026-08-23). Implements item P2-1 on branch `improve/p2-1-account-states`.

## Context

Before this record, every registration on a Stemmagraph server was born fully usable: the register endpoint hashed the password, created the user, and immediately returned a working session token. There was no role model beyond the implicit "every account can do everything", no way to stop an account from signing in, and no admin surface at all. For a server a family runs together, that meant any stranger who finds the URL could join and edit, and the only remedy for a compromised or abusive account was deleting rows in the database by hand.

Two more constraints shape the design. First, the collaboration model needs roles scoped per tree (an Owner of one tree is a mere Viewer on another), and that enforcement is scheduled as P2-3; this record must define the vocabulary now without building the per-tree machinery early. Second, living-person consent is its own track (T0e): collaboration features must stay subordinate to consent filtering, and an invitation must never become a way to bypass it.

## Decision

### Account states

Every user account carries a `status` with exactly three values, and a `role` with exactly two values at installation level:

- `status`: `pending`, `active`, `disabled`
- `role`: `owner`, `member`

The state machine is pure logic in `src/lib/account-states` and has one source of truth for the server and the tests:

```
  pending  ──activate──►  active
  pending  ──disable───►  disabled
  active   ──disable───►  disabled
  disabled ──enable────►  active
```

Who may execute each transition: an account with role `owner` and status `active`, through the admin endpoints only (`POST /api/v1/admin/accounts/:id/activate|disable|enable`). There is no self-service transition and no other caller. Same-state writes are refused (`canTransition` returns false for `pending -> pending` and friends) so bugs surface as 409s instead of silent no-ops.

What each state means at the gate:

- `pending`: registration succeeded but nobody approved it yet. Login returns 403 `ACCOUNT_PENDING`, no token is ever issued, and every authenticated request with a (hypothetically leaked) token returns 403.
- `active`: normal account. Login works, tokens work.
- `disabled`: the account is cut off. Login returns 403 `ACCOUNT_DISABLED`, and because `requireAuth` re-reads the account from the database on every request, every outstanding token stops working on its next use. This is what "disable cuts all sessions" means in practice; there is no token blocklist to maintain.

### Permission matrix

Actions below are scoped per tree unless marked otherwise. Tree-scoped roles (Owner, Editor, Viewer) are the target model defined here; their per-tree enforcement lands in P2-3 and is explicitly out of scope for P2-1, which ships only the installation-level `owner`/`member` split.

| Action | Scope | Owner | Editor | Viewer |
|---|---|---|---|---|
| View tree | tree | yes | yes | yes |
| Create/edit member | tree | yes | yes | no |
| Delete member | tree | yes | no | no |
| Invite collaborator | tree | yes | no | no |
| Activate account | installation | yes | no | no |
| Disable account | installation | yes | no | no |
| Propose change | tree | yes | yes | no |
| Review proposed change | tree | yes | yes | no |

Reading the matrix honestly as of P2-1: the only enforced columns today are the installation-level ones (activate, disable). Every active member currently acts as Owner on trees they can reach, because per-tree membership does not exist yet. That is recorded here as a known gap, closed by P2-3.

### Last owner guard

An installation must never end up with zero active owners: that state has no recovery path through the application, only through direct database surgery. Therefore any operation that would disable or demote the only remaining active owner is rejected before the write, with error code `LAST_OWNER_GUARD`. The same guard covers the actor disabling themselves when they are that last owner, and a separate refusal (`SELF_DISABLE_FORBIDDEN`) covers self-disable even when other owners remain, because an owner locking themselves out mid-session is always a mistake, never an intent. Role demotion follows the same rule when it lands with P2-3: demoting the last active owner to member is rejected identically.

### Consent clause

Collaboration permissions are subordinate to living-person consent (T0e). A collaborator's role decides what actions they may attempt; consent filtering decides which living persons' data any action may touch. An invitation never overrides consent: adding someone as Editor on a tree does not grant them visibility into living relatives who have not consented, and a consent withdrawal applies to Owners and Editors alike. When the two systems disagree, consent wins and the role-derived action fails closed.

### Bootstrap rule

A fresh installation must be able to administer itself, and a shared family server must not let strangers walk in. Both come from one rule:

1. The first account registered on an empty user table is born `active` with role `owner` and receives a session token immediately. `bootstrapAccountState(0)` is the pure function behind it.
2. Every later registration is born `pending` with role `member`, receives no token, and gets an honest 202 response saying the account waits for owner activation. Pending registrations raise an `ACCOUNT_PENDING_CREATED` notification to every active owner; activation raises `ACCOUNT_ACTIVATED` to the activated user. Delivery is in-app only: no email, no outbound transport of any kind in P2-1.

Migration honesty: existing users created before this change were migrated to `status = active`, `role = member`. The consequence is stated plainly: an installation upgraded from a pre-P2-1 database has active members but no owner, so the admin surface is unreachable until someone runs `scripts/seed-owner.mjs <email>` against that database to promote exactly one account to `owner`. That script exists for this upgrade path and for disaster recovery, not for routine use.

## Consequences

Positive:

- A closed registration surface. Strangers who find the URL land in `pending` and can do nothing until a human decides.
- A working off switch. Disabling an account cuts every session on its next request, with no token infrastructure beyond what already exists.
- Admin actions never strand the installation: the last-owner guard turns a class of footguns into a 403 with a readable code.
- The vocabulary for P2-3 per-tree roles is fixed now, so the membership work inherits states, guard, and vocabulary instead of inventing them under pressure.

Risks and costs:

- Single-owner small installs carry a real toil cost: every family member who registers waits for the owner. That is accepted; the alternative (open self-registration) is the status quo this record removes.
- `requireAuth` does one extra database read per request. At the scale this server serves (a family, a few concurrent editors), the cost is negligible against the correctness gain, and it can be revisited with caching if profiling ever demands it.
- The migrated-install gap (active members, zero owners) is real and requires a manual script run. Documented above rather than hidden behind an auto-promotion heuristic, which would silently pick the wrong person.

## Enforcement

- The state machine, last-owner guard, and bootstrap rule are pure functions in `src/lib/account-states` with unit tests; the server consumes them, so no route re-implements the rules.
- `requireOwner` gates every admin route and re-reads the account per request, so a role or status change applies on the very next call, mid-session included.
- Invalid transitions return 409 `INVALID_TRANSITION`; guard refusals return 403 with `LAST_OWNER_GUARD` or `SELF_DISABLE_FORBIDDEN`.
- The end-to-end behavior (bootstrap, pending login, activation, disable cutting sessions, guards) is exercised by the P2-1 smoke harness during review and by the unit suite on every run.

## References

- ADR 0001, pure core: no commercial construct is touched by this work.
- Product vision `docs/vision.md`, section on collaboration and consent (T0e, living-person privacy, PDP/GDPR-grade).
- Roadmap items P2-3 (per-tree membership and roles, invitations) and P2-2 (event store) consume and extend this vocabulary.
