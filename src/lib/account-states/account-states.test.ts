// Unit tests for the pure account-state module (P2-1 AC-6).
// Covers: legal and illegal status transitions, the last-owner guard,
// self-disable refusal, the bootstrap rule, and notification draft builders.

import { describe, expect, it } from 'vitest';
import {
  bootstrapAccountState,
  buildAccountActivatedNotification,
  buildAccountPendingCreatedNotification,
  canTransition,
  isAccountRole,
  isAccountStatus,
  reviewDisableAction,
} from './index';

describe('canTransition: legal transitions', () => {
  it('pending -> active is allowed (owner activates a registration)', () => {
    expect(canTransition('pending', 'active')).toBe(true);
  });

  it('active -> disabled is allowed (owner disables an account)', () => {
    expect(canTransition('active', 'disabled')).toBe(true);
  });

  it('pending -> disabled is allowed (owner rejects a registration outright)', () => {
    expect(canTransition('pending', 'disabled')).toBe(true);
  });

  it('disabled -> active is allowed (owner re-enables an account)', () => {
    expect(canTransition('disabled', 'active')).toBe(true);
  });
});

describe('canTransition: illegal transitions', () => {
  it('same-state transitions are refused', () => {
    expect(canTransition('pending', 'pending')).toBe(false);
    expect(canTransition('active', 'active')).toBe(false);
    expect(canTransition('disabled', 'disabled')).toBe(false);
  });

  it('active -> pending is refused (accounts never fall back to pending)', () => {
    expect(canTransition('active', 'pending')).toBe(false);
  });

  it('disabled -> pending is refused', () => {
    expect(canTransition('disabled', 'pending')).toBe(false);
  });
});

describe('bootstrapAccountState', () => {
  it('the first account on an empty user table is born active with role owner', () => {
    expect(bootstrapAccountState(0)).toEqual({
      status: 'active',
      role: 'owner',
      isFirstUser: true,
    });
  });

  it('every later registration is born pending with role member', () => {
    expect(bootstrapAccountState(1)).toEqual({
      status: 'pending',
      role: 'member',
      isFirstUser: false,
    });
    expect(bootstrapAccountState(42)).toEqual({
      status: 'pending',
      role: 'member',
      isFirstUser: false,
    });
  });
});

describe('reviewDisableAction: last-owner guard and self-disable', () => {
  const base = {
    actorId: 'owner-1',
    targetId: 'user-2',
    targetRole: 'member' as const,
    targetStatus: 'active' as const,
    otherActiveOwnerCount: 1,
  };

  it('an owner may not disable their own account', () => {
    const decision = reviewDisableAction({ ...base, targetId: 'owner-1' });
    expect(decision).toEqual({ allowed: false, code: 'SELF_DISABLE_FORBIDDEN' });
  });

  it('disabling the only active owner is refused with LAST_OWNER_GUARD', () => {
    const decision = reviewDisableAction({
      ...base,
      targetId: 'owner-2',
      targetRole: 'owner',
      otherActiveOwnerCount: 0,
    });
    expect(decision).toEqual({ allowed: false, code: 'LAST_OWNER_GUARD' });
  });

  it('disabling an active owner is allowed when another active owner remains', () => {
    const decision = reviewDisableAction({
      ...base,
      targetId: 'owner-2',
      targetRole: 'owner',
      otherActiveOwnerCount: 1,
    });
    expect(decision).toEqual({ allowed: true });
  });

  it('disabling a pending owner does not trip the active-owner guard', () => {
    const decision = reviewDisableAction({
      ...base,
      targetRole: 'owner',
      targetStatus: 'pending',
      otherActiveOwnerCount: 0,
    });
    expect(decision).toEqual({ allowed: true });
  });
});

describe('notification draft builders', () => {
  it('ACCOUNT_PENDING_CREATED carries the waiting account identity for one owner', () => {
    const draft = buildAccountPendingCreatedNotification('owner-1', {
      id: 'user-9',
      email: 'beta@example.com',
      name: 'Beta',
    });
    expect(draft.userId).toBe('owner-1');
    expect(draft.type).toBe('ACCOUNT_PENDING_CREATED');
    expect(JSON.parse(draft.payloadJson)).toEqual({
      pendingUserId: 'user-9',
      email: 'beta@example.com',
      name: 'Beta',
    });
  });

  it('ACCOUNT_ACTIVATED targets the activated user with an empty payload', () => {
    const draft = buildAccountActivatedNotification('user-9');
    expect(draft.userId).toBe('user-9');
    expect(draft.type).toBe('ACCOUNT_ACTIVATED');
    expect(JSON.parse(draft.payloadJson)).toEqual({});
  });
});

describe('domain value guards', () => {
  it('isAccountStatus and isAccountRole accept known values only', () => {
    expect(isAccountStatus('pending')).toBe(true);
    expect(isAccountStatus('banned')).toBe(false);
    expect(isAccountRole('owner')).toBe(true);
    expect(isAccountRole('admin')).toBe(false);
  });
});
