// Node-only token generation for invitations (P2-3, ADR 0004).
//
// This is the ONLY place allowed to mint invitation tokens. The bytes come
// from node:crypto's CSPRNG: never derived from user input, never hardcoded,
// never seeded from a timestamp. Encoding is base64url, so the token is
// URL-safe with no padding to escape. This file must stay out of the
// browser bundle; the pure logic in ./index never imports it.

import { randomBytes } from 'node:crypto';

/**
 * Bytes of entropy per token: 256 bits, double the 128-bit floor recorded
 * in ADR 0004, so future formats (longer prefixes, version tags) keep the
 * margin without regenerating the constant.
 */
export const TOKEN_ENTROPY_BYTES = 32;
export const TOKEN_ENTROPY_BITS = TOKEN_ENTROPY_BYTES * 8;

/** Generates a fresh URL-safe token for one invitation row. */
export function generateInvitationToken(): string {
  return randomBytes(TOKEN_ENTROPY_BYTES).toString('base64url');
}
