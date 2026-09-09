// Node-only token generation for share links (ADR 0010).
//
// This is the ONLY place allowed to mint share-link tokens. The bytes
// come from node:crypto's CSPRNG: never derived from user input, never
// hardcoded, never seeded from a timestamp. Encoding is base64url, so
// the token is URL-safe with no padding to escape. This file must stay
// out of the browser bundle; the pure payload logic never imports it.
//
// Deliberately a sibling of src/lib/invitations/token.ts rather than a
// reuse: invitation tokens and share tokens have different lifecycles
// and different revocation rules, and the invitation module documents
// itself as the only minter of invitation tokens.

import { randomBytes } from 'node:crypto';

/**
 * Bytes of entropy per share token: 256 bits, matching the invitation
 * floor. The token is the only secret gating public read access, so it
 * keeps the same margin ADR 0004 gave invitation tokens.
 */
export const SHARE_TOKEN_ENTROPY_BYTES = 32;
export const SHARE_TOKEN_ENTROPY_BITS = SHARE_TOKEN_ENTROPY_BYTES * 8;

/** Generates a fresh URL-safe token for one share link row. */
export function generateShareToken(): string {
  return randomBytes(SHARE_TOKEN_ENTROPY_BYTES).toString('base64url');
}
