// S-05: pure logic tests for share link management (list masked, revoke
// effect on the public gate, owner-only guard shape).

import { describe, expect, it } from 'vitest';
import {
  SHARE_ACCESS_HTTP,
  buildShareLinkList,
  evaluateShareLinkState,
  formatShareLinkSummary,
  maskShareToken,
  resolveShareAccess,
  type ShareLinkRowInput,
} from './manage';
// canPerformTreeAction lives in the invitations module (ADR 0002 matrix).
import { canPerformTreeAction } from '../invitations/index';

const TREE_A = 'tree-aaa';
const TREE_B = 'tree-bbb';

const link = (over: Partial<ShareLinkRowInput> = {}): ShareLinkRowInput => ({
  id: 'link-1',
  treeId: TREE_A,
  token: 'QkFQYWt3b3Jvb2Rvb3Jvb3Q',
  mode: 'public',
  revokedAt: null,
  lastUsedAt: null,
  createdAt: '2026-09-01T02:00:00.000Z',
  ...over,
});

const tree = { name: 'Keluarga Wijaya', description: null, generationCount: 3 };

// ─── Token masking ───────────────────────────────────────

describe('maskShareToken', () => {
  it('shows prefix and suffix only, never the middle', () => {
    const token = 'abcd1234efgh5678';
    const masked = maskShareToken(token);
    expect(masked).toBe('abcd****5678');
    expect(masked).not.toContain('1234efgh');
  });

  it('collapses short tokens to stars', () => {
    expect(maskShareToken('short')).toBe('****');
    expect(maskShareToken('12345678')).toBe('****');
  });
});

// ─── List (S-05 AC-3: only this tree, masked tokens) ─────

describe('buildShareLinkList', () => {
  it('keeps only rows of the requested tree', () => {
    const rows = [
      link({ id: 'a1' }),
      link({ id: 'b1', treeId: TREE_B, createdAt: '2026-09-02T02:00:00.000Z' }),
      link({ id: 'a2', createdAt: '2026-09-03T02:00:00.000Z' }),
    ];
    const list = buildShareLinkList(rows, TREE_A);
    expect(list.map((row) => row.id)).toEqual(['a2', 'a1']);
  });

  it('masks every token in the output and never emits the full value', () => {
    const token = 'Zm9vYmFyYmF6cXV1eHN5bW9kZW1v';
    const rows = [link({ token }), link({ token, revokedAt: '2026-09-05T00:00:00.000Z' })];
    const list = buildShareLinkList(rows, TREE_A);
    expect(list).toHaveLength(2);
    for (const row of list) {
      expect(row.tokenMasked).toBe('Zm9v****ZW1v');
      expect(JSON.stringify(row)).not.toContain(token);
      expect(Object.keys(row)).not.toContain('token');
    }
  });

  it('sorts newest first and derives state from revokedAt', () => {
    const rows = [
      link({ id: 'old', createdAt: '2026-08-01T00:00:00.000Z' }),
      link({ id: 'new', createdAt: '2026-09-10T00:00:00.000Z', revokedAt: '2026-09-11T00:00:00.000Z' }),
    ];
    const list = buildShareLinkList(rows, TREE_A);
    expect(list[0].id).toBe('new');
    expect(list[0].state).toBe('revoked');
    expect(list[0].revokedAt).toBe('2026-09-11T00:00:00.000Z');
    expect(list[1].state).toBe('active');
  });

  it('serializes dates as ISO strings with null passthrough', () => {
    const summary = formatShareLinkSummary(link({ lastUsedAt: '2026-09-02T03:00:00.000Z' }));
    expect(summary.createdAt).toBe('2026-09-01T02:00:00.000Z');
    expect(summary.lastUsedAt).toBe('2026-09-02T03:00:00.000Z');
    expect(summary.revokedAt).toBeNull();
  });
});

// ─── Revoke effect on the public gate (S-05 AC-3) ────────

describe('resolveShareAccess (revoked not served publicly)', () => {
  it('serves an active link with its tree', () => {
    const row = link();
    const access = resolveShareAccess(row, tree);
    expect('error' in access).toBe(false);
    if (!('error' in access)) {
      expect(access.link.id).toBe('link-1');
      expect(access.tree.name).toBe(tree.name);
    }
  });

  it('answers 410 for a revoked link before any tree lookup matters', () => {
    const row = link({ revokedAt: '2026-09-06T00:00:00.000Z' });
    const revoked = resolveShareAccess(row, tree);
    expect(revoked).toEqual({ error: 'SHARE_REVOKED' });
    // Even a missing tree row must not upgrade or downgrade the stamp.
    expect(resolveShareAccess(row, null)).toEqual({ error: 'SHARE_REVOKED' });
  });

  it('answers 404 for unknown token and unknown tree with the same failure', () => {
    expect(resolveShareAccess(null, tree)).toEqual({ error: 'SHARE_NOT_FOUND' });
    expect(resolveShareAccess(link(), null)).toEqual({ error: 'SHARE_NOT_FOUND' });
  });

  it('maps each failure to the consistent public status', () => {
    expect(SHARE_ACCESS_HTTP.SHARE_NOT_FOUND).toBe(404);
    expect(SHARE_ACCESS_HTTP.SHARE_REVOKED).toBe(410);
  });
});

// ─── Owner-only action (ADR 0002 matrix, S-05 AC-1) ──────

describe('manage_share_links guard shape', () => {
  it('allows owner, refuses editor and viewer', () => {
    expect(canPerformTreeAction('owner', 'manage_share_links')).toBe(true);
    expect(canPerformTreeAction('editor', 'manage_share_links')).toBe(false);
    expect(canPerformTreeAction('viewer', 'manage_share_links')).toBe(false);
  });

  it('keeps state derivation strict on the stamp', () => {
    expect(evaluateShareLinkState({ revokedAt: null })).toBe('active');
    expect(evaluateShareLinkState({ revokedAt: new Date(0) })).toBe('revoked');
  });
});
