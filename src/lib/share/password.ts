// Node-only password hashing for password share links (ADR 0010).
//
// bcryptjs, the same primitive the server already uses for account
// passwords. The plaintext password exists only inside the request that
// creates the link and the requests that unlock it; the database row
// keeps the hash and nothing else. Rounds sit at 10 (accounts use 12):
// a share link guards an already-public read surface behind a rate
// limiter, so the cheaper verify keeps the public endpoint responsive,
// and the doc comment records the trade-off for reviewers.

import bcrypt from 'bcryptjs';

/** Minimum length for a share password, same floor as accounts. */
export const SHARE_PASSWORD_MIN_LENGTH = 8;

/** Maximum accepted length: bcrypt input is truncated past 72 bytes. */
export const SHARE_PASSWORD_MAX_LENGTH = 72;

/** bcrypt cost used for share link hashes. */
export const SHARE_PASSWORD_BCRYPT_ROUNDS = 10;

/**
 * Type guard for a usable share password: a string inside the length
 * bounds. Everything else (missing field, empty string, oversized
 * input) is refused before any hashing happens.
 */
export function isValidSharePassword(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  if (value.length < SHARE_PASSWORD_MIN_LENGTH) return false;
  return value.length <= SHARE_PASSWORD_MAX_LENGTH;
}

/** Hashes one share password for storage. Never returns the plaintext. */
export async function hashSharePassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SHARE_PASSWORD_BCRYPT_ROUNDS);
}

/** Constant-time-ish compare through bcrypt; wrong passwords return false. */
export async function verifySharePassword(
  plain: string,
  hash: string,
): Promise<boolean> {
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    // A malformed stored hash must never crash the public endpoint.
    return false;
  }
}
