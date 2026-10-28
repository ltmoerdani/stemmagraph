import { describe, it, expect } from 'vitest';
import {
  actionsForStatus,
  isAdminUser,
  describeNotification,
} from './adminView';
import { ACCOUNT_STATUSES, type AccountStatus } from './index';

describe('actionsForStatus', () => {
  it.each(ACCOUNT_STATUSES as readonly AccountStatus[])(
    'only offers actions the state machine allows from %s',
    (status) => {
      const actions = actionsForStatus(status);
      expect(actions.length).toBeGreaterThan(0);
      // Every offered action must differ from the source status.
      for (const action of actions) {
        const target = action === 'disable' ? 'disabled' : 'active';
        expect(target).not.toBe(status);
      }
    },
  );

  it('offers activate and disable for a pending account', () => {
    expect(actionsForStatus('pending')).toEqual(['activate', 'disable']);
  });

  it('offers only disable for an active account', () => {
    expect(actionsForStatus('active')).toEqual(['disable']);
  });

  it('offers only enable for a disabled account', () => {
    expect(actionsForStatus('disabled')).toEqual(['enable']);
  });
});

describe('isAdminUser (AC-5d gate)', () => {
  it('accepts an active owner', () => {
    expect(isAdminUser({ role: 'owner', status: 'active' })).toBe(true);
  });

  it('rejects null and undefined users', () => {
    expect(isAdminUser(null)).toBe(false);
    expect(isAdminUser(undefined)).toBe(false);
  });

  it('rejects members regardless of status', () => {
    expect(isAdminUser({ role: 'member', status: 'active' })).toBe(false);
    expect(isAdminUser({ role: 'member', status: 'pending' })).toBe(false);
  });

  it('rejects owners who are not active', () => {
    expect(isAdminUser({ role: 'owner', status: 'pending' })).toBe(false);
    expect(isAdminUser({ role: 'owner', status: 'disabled' })).toBe(false);
  });

  it('rejects users without role or status fields', () => {
    expect(isAdminUser({})).toBe(false);
    expect(isAdminUser({ role: 'owner' })).toBe(false);
    expect(isAdminUser({ status: 'active' })).toBe(false);
  });
});

describe('describeNotification', () => {
  it('describes ACCOUNT_PENDING_CREATED with name and email from the payload', () => {
    const d = describeNotification('ACCOUNT_PENDING_CREATED', {
      pendingUserId: 'u1',
      name: 'Siti',
      email: 'siti@example.com',
    });
    expect(d.key).toBe('notifications.items.pendingCreated');
    expect(d.values).toEqual({ name: 'Siti', email: 'siti@example.com' });
  });

  it('falls back to ? when the pending payload is malformed', () => {
    const d = describeNotification('ACCOUNT_PENDING_CREATED', 'not-an-object');
    expect(d.values).toEqual({ name: '?', email: '?' });
  });

  it('describes ACCOUNT_ACTIVATED without interpolation values', () => {
    const d = describeNotification('ACCOUNT_ACTIVATED', null);
    expect(d.key).toBe('notifications.items.activated');
    expect(d.values).toEqual({});
  });

  it('names the raw type for unknown notification types', () => {
    const d = describeNotification('SOMETHING_ELSE', null);
    expect(d.key).toBe('notifications.items.unknown');
    expect(d.values).toEqual({ type: 'SOMETHING_ELSE' });
  });

  it('describes ERASURE_OWNER_NOTICE requested with action and evidence (v421b AC3)', () => {
    const d = describeNotification('ERASURE_OWNER_NOTICE', {
      memberId: 'm1',
      action: 'requested',
      eventType: 'erasure.requested',
      evidence: 'req_1',
    });
    expect(d.key).toBe('notifications.items.erasureRequested');
    expect(d.values).toEqual({ action: 'requested', evidence: 'req_1' });
  });

  it('describes ERASURE_OWNER_NOTICE cancelled with action and evidence (v421b AC3)', () => {
    const d = describeNotification('ERASURE_OWNER_NOTICE', {
      memberId: 'm1',
      action: 'cancelled',
      eventType: 'erasure.cancelled',
      evidence: 'req_2',
    });
    expect(d.key).toBe('notifications.items.erasureCancelled');
    expect(d.values).toEqual({ action: 'cancelled', evidence: 'req_2' });
  });

  it('describes ERASURE_OWNER_NOTICE purged with action and evidence (v421b AC3)', () => {
    const d = describeNotification('ERASURE_OWNER_NOTICE', {
      memberId: 'm1',
      action: 'purged',
      eventType: 'erasure.purged',
      evidence: 'req_3',
    });
    expect(d.key).toBe('notifications.items.erasurePurged');
    expect(d.values).toEqual({ action: 'purged', evidence: 'req_3' });
  });

  it('falls back to unknown when the erasure payload is not an object (v421b AC3)', () => {
    const d = describeNotification('ERASURE_OWNER_NOTICE', 'not-an-object');
    expect(d.key).toBe('notifications.items.unknown');
    expect(d.values).toEqual({ type: 'ERASURE_OWNER_NOTICE' });
  });

  it('falls back to unknown when the erasure action is not a legal value (v421b AC3)', () => {
    const d = describeNotification('ERASURE_OWNER_NOTICE', {
      memberId: 'm1',
      action: 'exploded',
      eventType: 'erasure.requested',
      evidence: 'req_1',
    });
    expect(d.key).toBe('notifications.items.unknown');
    expect(d.values).toEqual({ type: 'ERASURE_OWNER_NOTICE' });
  });

  it('falls back to unknown when evidence is missing or empty (v421b AC3)', () => {
    const missing = describeNotification('ERASURE_OWNER_NOTICE', {
      memberId: 'm1',
      action: 'requested',
      eventType: 'erasure.requested',
    });
    expect(missing.key).toBe('notifications.items.unknown');

    const empty = describeNotification('ERASURE_OWNER_NOTICE', {
      memberId: 'm1',
      action: 'requested',
      eventType: 'erasure.requested',
      evidence: '',
    });
    expect(empty.key).toBe('notifications.items.unknown');
  });
});
