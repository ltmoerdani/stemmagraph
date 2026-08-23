// Unit tests for the pure invitations module (P2-3 AC-3).
// Covers: token entropy and format, every state transition including the
// exact expiry boundary, the maxUses clamp, the personal single-use rule,
// the anti-PII validator (one refusal per forbidden key), the full ADR 0002
// permission matrix per action and role, the tree last-owner guard, and
// exhaustiveness of the exported unions.

import { describe, expect, it } from 'vitest';
import {
  FAMILY_DEFAULT_MAX_USES,
  FAMILY_MAX_USES_MAX,
  FAMILY_MAX_USES_MIN,
  INVITATION_STATES,
  INVITATION_TTL_HOURS,
  PERSONAL_MAX_USES,
  TOKEN_MIN_ENTROPY_BITS,
  TREE_ACTION_MATRIX,
  TREE_ACTIONS,
  TREE_ROLES,
  buildInvitationContext,
  canPerformTreeAction,
  clampMaxUses,
  computeExpiresAt,
  initialMaxUses,
  invitationFailureCode,
  invitationState,
  isValidGrantedRole,
  maskInvitationToken,
  remainingUses,
  reviewTreeMembershipChange,
  validateInvitationPayload,
  type InvitationLike,
  type TreeAction,
  type TreeRole,
} from './index';
import { TOKEN_ENTROPY_BITS, generateInvitationToken } from './token';

// ─── Fixtures ────────────────────────────────────────────

const NOW = new Date('2026-08-24T12:00:00.000Z');

function makeInvitation(overrides: Partial<InvitationLike> = {}): InvitationLike {
  return {
    type: 'family',
    maxUses: 20,
    usedCount: 0,
    expiresAt: new Date(NOW.getTime() + INVITATION_TTL_HOURS.family * 3_600_000),
    revokedAt: null,
    ...overrides,
  };
}

// ─── Token generator ─────────────────────────────────────

describe('generateInvitationToken', () => {
  it('produces URL-safe base64url characters only', () => {
    for (let i = 0; i < 50; i++) {
      expect(generateInvitationToken()).toMatch(/^[A-Za-z0-9_-]+$/);
    }
  });

  it('never repeats across a 200-token sample', () => {
    const seen = new Set(Array.from({ length: 200 }, () => generateInvitationToken()));
    expect(seen.size).toBe(200);
  });

  it('carries at least the 128-bit entropy floor', () => {
    expect(TOKEN_ENTROPY_BITS).toBeGreaterThanOrEqual(TOKEN_MIN_ENTROPY_BITS);
    // A 256-bit token in base64url is 43 unpadded characters: a concrete
    // format check so shortening the constant trips a test.
    expect(generateInvitationToken()).toHaveLength(43);
  });
});

// ─── State machine ───────────────────────────────────────

describe('invitationState', () => {
  it('reports active for a fresh invitation of each type', () => {
    expect(invitationState(makeInvitation({ type: 'family' }), NOW)).toBe('active');
    expect(invitationState(makeInvitation({ type: 'personal', maxUses: 1 }), NOW)).toBe('active');
  });

  it('treats exactly expiresAt as already expired (inclusive boundary)', () => {
    const atBoundary = makeInvitation({ expiresAt: NOW });
    expect(invitationState(atBoundary, NOW)).toBe('expired');
  });

  it('stays active one millisecond before expiry', () => {
    const almost = makeInvitation({ expiresAt: new Date(NOW.getTime() + 1) });
    expect(invitationState(almost, NOW)).toBe('active');
  });

  it('revoked wins over every other state', () => {
    const revokedAndDead = makeInvitation({
      revokedAt: NOW,
      usedCount: 20,
      expiresAt: new Date(NOW.getTime() - 1),
    });
    expect(invitationState(revokedAndDead, NOW)).toBe('revoked');
  });

  it('expired wins over exhausted', () => {
    const dead = makeInvitation({ usedCount: 20, expiresAt: new Date(NOW.getTime() - 1) });
    expect(invitationState(dead, NOW)).toBe('expired');
  });

  it('marks a family invitation exhausted at usedCount equal to maxUses', () => {
    expect(invitationState(makeInvitation({ usedCount: 20 }), NOW)).toBe('exhausted');
    expect(invitationState(makeInvitation({ usedCount: 19 }), NOW)).toBe('active');
  });

  it('consumes a personal invitation after one successful use', () => {
    expect(invitationState(makeInvitation({ type: 'personal', maxUses: 1, usedCount: 1 }), NOW)).toBe('consumed');
    expect(invitationState(makeInvitation({ type: 'personal', maxUses: 1, usedCount: 0 }), NOW)).toBe('active');
  });

  it('maps dead states to honest failure codes and active to null', () => {
    expect(invitationFailureCode('expired')).toBe('INVITATION_EXPIRED');
    expect(invitationFailureCode('revoked')).toBe('INVITATION_REVOKED');
    expect(invitationFailureCode('exhausted')).toBe('INVITATION_EXHAUSTED');
    expect(invitationFailureCode('consumed')).toBe('INVITATION_EXHAUSTED');
    expect(invitationFailureCode('active')).toBeNull();
  });

  it('floors remaining uses at zero for overshot rows', () => {
    expect(remainingUses(makeInvitation({ usedCount: 25 }))).toBe(0);
    expect(remainingUses(makeInvitation({ usedCount: 7 }))).toBe(13);
  });
});

// ─── Policy constants: TTL, clamp, granted role ──────────

describe('policy constants and clamps', () => {
  it('keeps the ADR 0004 TTLs: personal 48h, family 7d', () => {
    expect(INVITATION_TTL_HOURS.personal).toBe(48);
    expect(INVITATION_TTL_HOURS.family).toBe(168);
    const created = computeExpiresAt('personal', NOW);
    expect(created.getTime() - NOW.getTime()).toBe(48 * 3_600_000);
  });

  it('clamps maxUses below the minimum up to 1', () => {
    expect(clampMaxUses(0)).toBe(FAMILY_MAX_USES_MIN);
    expect(clampMaxUses(-5)).toBe(FAMILY_MAX_USES_MIN);
  });

  it('clamps maxUses above the ceiling down to 100', () => {
    expect(clampMaxUses(150)).toBe(FAMILY_MAX_USES_MAX);
  });

  it('falls back to the default for non-numeric input', () => {
    expect(clampMaxUses(undefined)).toBe(FAMILY_DEFAULT_MAX_USES);
    expect(clampMaxUses('many')).toBe(FAMILY_DEFAULT_MAX_USES);
    expect(clampMaxUses(Number.NaN)).toBe(FAMILY_DEFAULT_MAX_USES);
  });

  it('passes through in-range values and truncates non-integers', () => {
    expect(clampMaxUses(20)).toBe(20);
    expect(clampMaxUses(20.9)).toBe(20);
  });

  it('forces personal invitations to a single use regardless of request', () => {
    expect(initialMaxUses('personal', 50)).toBe(PERSONAL_MAX_USES);
    expect(initialMaxUses('family')).toBe(FAMILY_DEFAULT_MAX_USES);
    expect(initialMaxUses('family', 5)).toBe(5);
  });

  it('accepts only viewer for personal and viewer or editor for family', () => {
    expect(isValidGrantedRole('personal', 'viewer')).toBe(true);
    expect(isValidGrantedRole('personal', 'editor')).toBe(false);
    expect(isValidGrantedRole('family', 'editor')).toBe(true);
    expect(isValidGrantedRole('family', 'owner')).toBe(false);
    expect(isValidGrantedRole('family', 'admin')).toBe(false);
  });
});

// ─── Anti-PII validator and context builder ──────────────

describe('validateInvitationPayload', () => {
  it('refuses every recipient contact key, one by one', () => {
    const forbidden = [
      'phone',
      'phoneNumber',
      'phone_number',
      'number',
      'wa',
      'whatsapp',
      'nomor',
      'email',
      'recipient',
      'recipientPhone',
      'recipient_email',
      'penerima',
      'contact',
      'contactDetail',
    ];
    for (const key of forbidden) {
      const verdict = validateInvitationPayload({ [key]: '0812' });
      expect(verdict.ok, `key "${key}" must be refused`).toBe(false);
    }
  });

  it('accepts the inviter technical userId and display name', () => {
    expect(
      validateInvitationPayload({ inviterUserId: 'user-1', inviterName: 'Raka Wijaya' }).ok,
    ).toBe(true);
  });

  it('refuses keys outside the P2-3 contract', () => {
    expect(validateInvitationPayload({ secretNote: 'hello' }).ok).toBe(false);
  });

  it('refuses non-object payloads and empty values', () => {
    expect(validateInvitationPayload('family').ok).toBe(false);
    expect(validateInvitationPayload(null).ok).toBe(false);
    expect(validateInvitationPayload([[1]]).ok).toBe(false);
    expect(validateInvitationPayload({ treeName: '' }).ok).toBe(false);
  });
});

describe('buildInvitationContext and masking', () => {
  it('builds the minimal public context with no contact data', () => {
    const context = buildInvitationContext({
      invitation: makeInvitation({ usedCount: 2, maxUses: 20 }),
      treeName: 'Keluarga Besar Soetomo',
      inviterName: 'Raka Wijaya',
      now: NOW,
    });
    expect(context).toEqual({
      type: 'family',
      treeName: 'Keluarga Besar Soetomo',
      inviterName: 'Raka Wijaya',
      expiresAt: makeInvitation().expiresAt.toISOString(),
      remainingUses: 18,
    });
    expect(validateInvitationPayload(context).ok).toBe(true);
  });

  it('masks every token surface after creation', () => {
    const token = 'abcdefghij0123456789ABCDEFGHIJ';
    expect(maskInvitationToken(token)).toBe(`abcd****${token.slice(-4)}`);
    expect(maskInvitationToken(token)).not.toContain(token.slice(4, -4));
    expect(maskInvitationToken('short')).toBe('****');
  });
});

// ─── Tree permission matrix (ADR 0002) ───────────────────

describe('canPerformTreeAction', () => {
  const expected: Record<TreeAction, readonly TreeRole[]> = {
    view_tree: ['owner', 'editor', 'viewer'],
    create_member: ['owner', 'editor'],
    edit_member: ['owner', 'editor'],
    delete_member: ['owner'],
    create_relationship: ['owner', 'editor'],
    delete_relationship: ['owner'],
    update_tree: ['owner'],
    delete_tree: ['owner'],
    manage_invitations: ['owner'],
    manage_membership: ['owner'],
  };

  it('matches the ADR 0002 matrix for every action and role', () => {
    for (const action of TREE_ACTIONS) {
      for (const role of TREE_ROLES) {
        expect(
          canPerformTreeAction(role, action),
          `${role} on ${action}`,
        ).toBe(expected[action].includes(role));
      }
    }
    expect(TREE_ACTION_MATRIX).toEqual(expected);
  });

  it('lets a viewer read but never write, and an owner do everything', () => {
    expect(canPerformTreeAction('viewer', 'view_tree')).toBe(true);
    expect(canPerformTreeAction('viewer', 'create_member')).toBe(false);
    expect(canPerformTreeAction('editor', 'delete_member')).toBe(false);
    for (const action of TREE_ACTIONS) {
      expect(canPerformTreeAction('owner', action)).toBe(true);
    }
  });
});

// ─── Tree last-owner guard ───────────────────────────────

describe('reviewTreeMembershipChange', () => {
  it('refuses demoting the only active tree owner', () => {
    const decision = reviewTreeMembershipChange({
      targetTreeRole: 'owner',
      nextTreeRole: 'editor',
      otherActiveTreeOwnerCount: 0,
    });
    expect(decision).toEqual({ allowed: false, code: 'TREE_LAST_OWNER_GUARD' });
  });

  it('refuses removing the only active tree owner', () => {
    const decision = reviewTreeMembershipChange({
      targetTreeRole: 'owner',
      nextTreeRole: null,
      otherActiveTreeOwnerCount: 0,
    });
    expect(decision.allowed).toBe(false);
  });

  it('allows the same owner-change when another active owner remains', () => {
    const decision = reviewTreeMembershipChange({
      targetTreeRole: 'owner',
      nextTreeRole: 'viewer',
      otherActiveTreeOwnerCount: 1,
    });
    expect(decision.allowed).toBe(true);
  });

  it('never guards non-owner targets', () => {
    const decision = reviewTreeMembershipChange({
      targetTreeRole: 'editor',
      nextTreeRole: null,
      otherActiveTreeOwnerCount: 0,
    });
    expect(decision.allowed).toBe(true);
  });
});

// ─── Union exhaustiveness ────────────────────────────────

describe('exported unions are exhaustive and closed', () => {
  it('lists every invitation state and tree role with no extras', () => {
    expect(INVITATION_STATES).toEqual(['active', 'expired', 'exhausted', 'revoked', 'consumed']);
    expect(TREE_ROLES).toEqual(['owner', 'editor', 'viewer']);
    expect(TREE_ACTIONS).toHaveLength(10);
  });

  it('covers every tree action in the matrix (compile-time exhaustive)', () => {
    const matrix: Record<TreeAction, readonly TreeRole[]> = TREE_ACTION_MATRIX;
    expect(Object.keys(matrix).sort()).toEqual([...TREE_ACTIONS].sort());
  });
});
