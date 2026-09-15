// Owner-side share link management (S-05, GAP #4, ADR 0010).
//
// Pure decision logic for listing and revoking TreeShareLink rows.
// The server owns every write and every authorization check; this
// module only derives state and shapes rows so the API layer and the
// owner panel render one truth. Mirrors the invitation rule (ADR
// 0004): the full token appears exactly once at creation, every later
// surface shows the masked form.

export type ShareLinkState = 'active' | 'revoked';

export type ShareAccessError = 'SHARE_NOT_FOUND' | 'SHARE_REVOKED';

/** HTTP status each public-surface failure answers with (S-05 AC-1b). */
export const SHARE_ACCESS_HTTP: Record<ShareAccessError, number> = {
  SHARE_NOT_FOUND: 404,
  SHARE_REVOKED: 410,
};

export interface ShareLinkRowInput {
  id: string;
  treeId: string;
  token: string;
  mode: string;
  revokedAt: Date | string | null;
  lastUsedAt?: Date | string | null;
  createdAt: Date | string;
}

/** Row shape the owner list returns: never the full token. */
export interface ShareLinkSummary {
  id: string;
  treeId: string;
  mode: string;
  state: ShareLinkState;
  tokenMasked: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

/**
 * Masked token for every surface after creation, same shape as
 * maskInvitationToken (ADR 0004): first and last four characters, the
 * middle replaced, and short tokens collapsed to stars only.
 */
export function maskShareToken(token: string): string {
  if (token.length <= 8) return '****';
  return `${token.slice(0, 4)}****${token.slice(-4)}`;
}

function toIso(value: Date | string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

/** Revocation is a stamp, so state derives from revokedAt alone. */
export function evaluateShareLinkState(link: { revokedAt: Date | string | null }): ShareLinkState {
  return link.revokedAt !== null ? 'revoked' : 'active';
}

/**
 * Single gate the public resolver consults (S-05 AC-1b): unknown token
 * and unknown tree answer the same failure, a revoked link never passes.
 * Order matches the phase 1 resolver: revoked wins over a missing tree
 * row so a revoked link cannot leak which part is gone.
 */
export function resolveShareAccess<L extends { revokedAt: Date | string | null }, T>(
  link: L | null,
  tree: T | null,
): { error: ShareAccessError } | { link: L; tree: T } {
  if (!link) return { error: 'SHARE_NOT_FOUND' };
  if (evaluateShareLinkState(link) === 'revoked') return { error: 'SHARE_REVOKED' };
  if (!tree) return { error: 'SHARE_NOT_FOUND' };
  return { link, tree };
}

/** One list row: masked token, ISO dates, derived state. */
export function formatShareLinkSummary(link: ShareLinkRowInput): ShareLinkSummary {
  return {
    id: link.id,
    treeId: link.treeId,
    mode: link.mode,
    state: evaluateShareLinkState(link),
    tokenMasked: maskShareToken(link.token),
    createdAt: toIso(link.createdAt) as string,
    lastUsedAt: toIso(link.lastUsedAt ?? null),
    revokedAt: toIso(link.revokedAt),
  };
}

/**
 * List builder for the owner panel: only rows of the requested tree
 * survive, newest first, and every token comes out masked only.
 */
export function buildShareLinkList(links: ShareLinkRowInput[], treeId: string): ShareLinkSummary[] {
  return links
    .filter((link) => link.treeId === treeId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .map(formatShareLinkSummary);
}
