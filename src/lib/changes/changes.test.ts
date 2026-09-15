// Unit tests for the pure changes module (P2-5 AC-2).
// Covers: the closed three-state vocabulary, note bounds (reason
// mandatory, decision optional but never empty), the snapshot contract per
// target type including the consent and technical key refusals, canonical
// JSON key-order insensitivity, every legal and illegal state transition
// through the owner gate, the permanent distinct anti-re-proposal guard,
// and the narrow auto-accept policy (default off, editors never).

import { describe, expect, it } from 'vitest';
import {
  AUTO_ACCEPT_DEFAULT,
  CHANGE_ACTIONS,
  CHANGE_DISTINCT_BLOCKED_CODE,
  CHANGE_STATES,
  CHANGE_TARGET_TYPES,
  DECISION_NOTE_MAX_LENGTH,
  MEMBER_PROPOSAL_FIELDS,
  REASON_NOTE_MAX_LENGTH,
  canonicalizeSnapshotJson,
  isChangeDecisionAction,
  isChangeState,
  isChangeTargetType,
  reviewAutoAccept,
  reviewChangeDecision,
  reviewNewProposal,
  validateDecisionNote,
  validateReasonNote,
  validateTargetSnapshot,
} from './index';

describe('change state vocabulary', () => {
  it('accepts exactly pending, rejected, distinct and refuses a fourth', () => {
    for (const state of ['pending', 'rejected', 'distinct']) expect(isChangeState(state)).toBe(true);
    expect(isChangeState('accepted')).toBe(false);
    expect(isChangeState('')).toBe(false);
    expect(isChangeState(42)).toBe(false);
    expect(CHANGE_STATES).toEqual(['pending', 'rejected', 'distinct']);
  });

  it('accepts exactly member and relationship as target types', () => {
    expect(CHANGE_TARGET_TYPES).toEqual(['member', 'relationship']);
    expect(isChangeTargetType('member')).toBe(true);
    expect(isChangeTargetType('relationship')).toBe(true);
    expect(isChangeTargetType('tree')).toBe(false);
  });

  it('accepts exactly accept, reject, distinct as decision actions', () => {
    expect(CHANGE_ACTIONS).toEqual(['accept', 'reject', 'distinct']);
    expect(isChangeDecisionAction('accept')).toBe(true);
    expect(isChangeDecisionAction('merge')).toBe(false);
  });
});

describe('validateReasonNote', () => {
  it('trims and accepts non-empty prose within the cap', () => {
    expect(validateReasonNote('  grandmother birth year off by one  ')).toEqual({
      ok: true,
      value: 'grandmother birth year off by one',
    });
    expect(validateReasonNote('x'.repeat(REASON_NOTE_MAX_LENGTH)).ok).toBe(true);
  });

  it('refuses empty, whitespace-only, oversized, and non-string input', () => {
    expect(validateReasonNote('')).toEqual({ ok: false, reason: 'reasonNote must not be empty' });
    expect(validateReasonNote('   ').ok).toBe(false);
    expect(validateReasonNote('x'.repeat(REASON_NOTE_MAX_LENGTH + 1)).ok).toBe(false);
    expect(validateReasonNote(7).ok).toBe(false);
  });
});

describe('validateDecisionNote', () => {
  it('treats null and undefined as absent and trims present prose', () => {
    expect(validateDecisionNote(null)).toEqual({ ok: true, value: '' });
    expect(validateDecisionNote(undefined)).toEqual({ ok: true, value: '' });
    expect(validateDecisionNote(' not the same person ')).toEqual({ ok: true, value: 'not the same person' });
  });

  it('refuses empty strings, oversized prose, and non-strings', () => {
    expect(validateDecisionNote('')).toEqual({ ok: false, reason: 'decisionNote must not be empty when provided' });
    expect(validateDecisionNote('  ').ok).toBe(false);
    expect(validateDecisionNote('x'.repeat(DECISION_NOTE_MAX_LENGTH + 1)).ok).toBe(false);
    expect(validateDecisionNote({}).ok).toBe(false);
  });
});

describe('validateTargetSnapshot', () => {
  it('accepts every documented member field and JSON scalar or null values', () => {
    const snapshot: Record<string, unknown> = { name: 'Siti', isAlive: true, generation: 2, deathDate: null };
    expect(validateTargetSnapshot('member', snapshot)).toEqual({ ok: true });
    for (const field of MEMBER_PROPOSAL_FIELDS) {
      expect(validateTargetSnapshot('member', { [field]: 'value' }).ok).toBe(true);
    }
  });

  it('refuses unknown member fields, the anti-smuggling rule for non-target PII', () => {
    const refusal = validateTargetSnapshot('member', { name: 'Siti', secondPersonPhone: '0812' });
    expect(refusal).toEqual({
      ok: false,
      reason: 'field "secondPersonPhone" is not part of the member proposal contract',
    });
  });

  it('refuses privacyStatus: a proposal never touches consent', () => {
    expect(validateTargetSnapshot('member', { privacyStatus: 'shared' })).toEqual({
      ok: false,
      reason: 'field "privacyStatus" is not part of the member proposal contract',
    });
  });

  it('refuses technical keys (id, treeId) and non-object payloads', () => {
    expect(validateTargetSnapshot('member', { id: 'x' }).ok).toBe(false);
    expect(validateTargetSnapshot('member', { treeId: 'x' }).ok).toBe(false);
    expect(validateTargetSnapshot('member', 'not an object').ok).toBe(false);
    expect(validateTargetSnapshot('member', null).ok).toBe(false);
    expect(validateTargetSnapshot('member', []).ok).toBe(false);
  });

  it('accepts the relationship triple and refuses member-only fields on it', () => {
    expect(validateTargetSnapshot('relationship', { memberId: 'a', relatedId: 'b', type: 'parent' })).toEqual({ ok: true });
    expect(validateTargetSnapshot('relationship', { name: 'Siti' }).ok).toBe(false);
    expect(validateTargetSnapshot('relationship', { nested: { deep: 1 } }).ok).toBe(false);
  });
});

describe('canonicalizeSnapshotJson', () => {
  it('makes key order irrelevant for equality, nested and top level', () => {
    const a = canonicalizeSnapshotJson({ name: 'Siti', birthDate: '1950-01-01', extra: { b: 1, a: 2 } });
    const b = canonicalizeSnapshotJson({ extra: { a: 2, b: 1 }, birthDate: '1950-01-01', name: 'Siti' });
    expect(a).toBe(b);
    expect(canonicalizeSnapshotJson({ a: 1 })).not.toBe(canonicalizeSnapshotJson({ a: 2 }));
    expect(canonicalizeSnapshotJson(null)).toBe('null');
  });
});

describe('reviewChangeDecision (the owner gate)', () => {
  it('allows an owner to accept, reject, or mark distinct a pending proposal', () => {
    for (const action of ['accept', 'reject', 'distinct'] as const) {
      expect(reviewChangeDecision({ state: 'pending', deciderIsTreeOwner: true, action })).toEqual({ allowed: true });
    }
  });

  it('refuses a non-owner for every action, with the honest code', () => {
    const review = reviewChangeDecision({ state: 'pending', deciderIsTreeOwner: false, action: 'accept' });
    expect(review).toEqual({ allowed: false, code: 'CHANGE_DECIDER_NOT_OWNER' });
  });

  it('treats rejected and distinct as terminal for everyone, owner included', () => {
    for (const state of ['rejected', 'distinct'] as const) {
      expect(reviewChangeDecision({ state, deciderIsTreeOwner: true, action: 'reject' })).toEqual({
        allowed: false,
        code: 'CHANGE_ALREADY_DECIDED',
      });
      expect(reviewChangeDecision({ state, deciderIsTreeOwner: false, action: 'accept' }).allowed).toBe(false);
    }
  });
});

describe('reviewNewProposal (anti-re-proposal guard)', () => {
  const distinctRow = {
    targetType: 'member' as const,
    targetId: 'member-1',
    afterJson: JSON.stringify({ name: 'Siti', birthDate: '1950-01-01' }),
  };

  it('blocks the same afterJson on a distinct target, key order aside', () => {
    const sameContentDifferentOrder = JSON.stringify({ birthDate: '1950-01-01', name: 'Siti' });
    const review = reviewNewProposal({
      targetType: 'member',
      targetId: 'member-1',
      afterJson: sameContentDifferentOrder,
      distinctProposals: [distinctRow],
    });
    expect(review).toEqual({ allowed: false, code: CHANGE_DISTINCT_BLOCKED_CODE });
  });

  it('allows different content on the same target and any content elsewhere', () => {
    expect(
      reviewNewProposal({
        targetType: 'member',
        targetId: 'member-1',
        afterJson: JSON.stringify({ name: 'Siti', birthDate: '1951-01-01' }),
        distinctProposals: [distinctRow],
      }),
    ).toEqual({ allowed: true });
    expect(
      reviewNewProposal({
        targetType: 'member',
        targetId: 'member-2',
        afterJson: distinctRow.afterJson,
        distinctProposals: [distinctRow],
      }),
    ).toEqual({ allowed: true });
    expect(
      reviewNewProposal({ targetType: 'member', targetId: 'member-1', afterJson: '{}', distinctProposals: [] }),
    ).toEqual({ allowed: true });
  });

  it('ignores distinct rows of the other target type', () => {
    const review = reviewNewProposal({
      targetType: 'relationship',
      targetId: 'member-1',
      afterJson: distinctRow.afterJson,
      distinctProposals: [distinctRow],
    });
    expect(review).toEqual({ allowed: true });
  });
});

describe('reviewAutoAccept (narrow policy)', () => {
  it('defaults off: owner without the opt-in still waits for the gate', () => {
    expect(AUTO_ACCEPT_DEFAULT).toBe(false);
    expect(reviewAutoAccept({ proposerTreeRole: 'owner', autoAcceptOptIn: false })).toBe(false);
  });

  it('fires only for a tree owner with the opt-in active', () => {
    expect(reviewAutoAccept({ proposerTreeRole: 'owner', autoAcceptOptIn: true })).toBe(true);
  });

  it('never fires for an editor or viewer, flag on or off', () => {
    for (const role of ['editor', 'viewer'] as const) {
      expect(reviewAutoAccept({ proposerTreeRole: role, autoAcceptOptIn: true })).toBe(false);
      expect(reviewAutoAccept({ proposerTreeRole: role, autoAcceptOptIn: false })).toBe(false);
    }
  });
});
