# ADR 0010: Public share links, read-only with consent redaction

## Status

Accepted (2026-09-09). Implements GAP #4 on branch `improve/stg-share-link`.

## Context

Every read surface so far sits behind an account. Relatives who want to look at a tree must receive an invitation, register, and be granted a role, which is the right shape for collaboration and the wrong shape for "show grandma the tree". GAP #4 asks for a read-only public link: one URL, optional password, nothing to install for the reader.

A public link is the widest audience the platform has served, so it inherits the strictest privacy rules in one direction: the payload must come from the same consent logic as the clean export (phase 1 gate), the contact book must never leave the server, and the endpoint must survive being hammered by strangers. It also needs one shareable preview surface, the OG image, without pulling a native image stack into a pure-core codebase.

## Decision

### One additive table

`TreeShareLink` (migration `20260909120000`) is the only schema change: `treeId`, unique `token`, `mode` (`public` or `password`), `passwordHash`, `revokedAt`, `lastUsedAt`, `createdAt`, with a cascade FK to `FamilyTree` and an index on `treeId`. FamilyTree gains only the Prisma relation annotation. `revokedAt` is a stamp rather than a delete so a revoked link stays explainable in support questions. No core model columns change.

### The token is the credential

`generateShareToken()` (src/lib/share/token.ts) mints 256 bits from node:crypto's CSPRNG, base64url encoded. The token is the only secret gating a public read, so it carries the same entropy floor ADR 0004 gave invitation tokens. Tokens are never derived from names, ids, or timestamps.

### Password mode, and how the password travels

A `password` link verifies a bcrypt hash (cost 10, src/lib/share/password.ts) against the `x-share-password` request header. Accounts use 12 rounds; share links use 10 because the endpoint is public and rate limited, and the trade-off is recorded here for reviewers. Accepted length is 8 to 72 characters (bcrypt truncates past 72 bytes). A missing header answers 401 `SHARE_PASSWORD_REQUIRED`, a wrong password answers 401 `SHARE_PASSWORD_INVALID`. v1 deliberately accepts no query-string password: URLs land in browser history, referrer headers, and access logs, headers do not.

### One payload builder, the export gate inside

`buildPublicTreePayload()` (src/lib/share/public-tree.ts) is the single source of truth for what a public reader may see. It calls `evaluateMemberPrivacy` from the phase 1 export privacy gate, so a share payload and a clean GEDCOM export can never disagree about who is redacted. The conservative living rule carries over unchanged: a member who is alive, or whose records leave life status ambiguous (missing death date, NULL or unknown consent flag), is treated as living and redacted to `{ id, generation, visible: false }`. The id survives so relationships keep their topology, the same way the GEDCOM gate keeps FAM and CHIL structure. Deceased members and living members with explicit `shared` consent ship in full.

Contact fields (`email`, `phone`) and free-text fields (`notes`, `currentLocation`, `maritalStatus`) are dropped for every member, redacted or not. A public link carries the genealogy, never the contact book.

### Rate limiting is a brake, not a boundary

`FixedWindowRateLimiter` (src/lib/share/rate-limit.ts) is a fixed-window counter per key, in-memory, with an injectable clock for deterministic tests. The server applies three instances to the share section: read attempts, OG image fetches, and password verification each get their own budget, and password verification gets the tightest one because it is the guessing surface. Keys combine request IP and token. The store dies with the process and resets counters; that is honest for a self-hosted single-process deployment where the token carries the real security weight. Refused requests answer 429 with a `Retry-After` header.

### OG image v1 is SVG

`GET /api/v1/share/:token/og-image` returns a dynamically built 1200x630 SVG showing the tree title. The builder (src/lib/share/og-image.ts) is a pure string function with XML escaping and length capping, because the title is user content and SVG injection is a real risk. No canvas, sharp, or headless browser enters the tree for this.

For `public` links the image shows the tree name. For `password` links it shows a generic title, because the OG route cannot demand a header from a crawler and the tree name must not leak through a preview. The same rule drives `GET /api/v1/share/:token/preview`, a minimal HTML document with Open Graph and Twitter meta tags that a reverse proxy or curious QA can fetch.

Honest limitation, accepted for v1: several crawlers do not render SVG in `og:image`. When that matters in practice, the upgrade path is rasterizing the same builder output behind a flag, not redesigning the share link.

### Route surface and semantics

`GET /api/v1/share/:token` resolves the link, refuses revoked rows with 410 `SHARE_REVOKED`, unknown tokens with 404 `SHARE_NOT_FOUND`, verifies the password when `mode` is `password`, stamps `lastUsedAt`, and returns `{ link: { mode }, payload }` where the payload comes only from the builder above. Management endpoints (create, list, revoke a link by an authenticated owner) are a separate follow-up task; this ADR covers the public read surface only.

## Consequences

The share payload and the export gate share one decision function, so a consent change is visible to both on the next read. Public read is possible without an account, and the redaction default errs toward silence for every ambiguous life or consent status. The rate limiter keeps brute force slow but does not pretend to be a distributed quota. OG previews work for public links everywhere, and for password links without leaking the tree name. SVG support in crawlers is the known v1 gap, recorded above with its upgrade path. Management endpoints for link lifecycle remain open work.
