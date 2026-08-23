// Unit tests for the pure event-store module (P2-2 AC-2).
// Covers: the four event builders, the PII validator refusals, the
// exhaustiveness of the v1 union, canonical JSON round-trips, rejection of
// empty or unknown payload fields, and the notification projections.

import { describe, expect, it } from 'vitest';
import {
  EVENT_TYPES,
  buildAccountActivatedEvent,
  buildAccountDisabledEvent,
  buildAccountEnabledEvent,
  buildAccountPendingCreatedEvent,
  buildInvitationCreatedEvent,
  buildInvitationRevokedEvent,
  buildInvitationUsedEvent,
  isEventType,
  parseEventPayload,
  projectAccountActivatedNotification,
  projectPendingCreatedNotifications,
  serializeEventPayload,
  validateEventPayload,
} from './index';

describe('builders produce contract-shaped envelopes', () => {
  it('ACCOUNT_PENDING_CREATED: registrant is the actor, no family tree', () => {
    const event = buildAccountPendingCreatedEvent('user-1');
    expect(event).toEqual({
      type: 'ACCOUNT_PENDING_CREATED',
      actorUserId: 'user-1',
      familyTreeId: null,
      payload: { subjectUserId: 'user-1' },
    });
  });

  it('ACCOUNT_ACTIVATED: owner acts on the subject account', () => {
    const event = buildAccountActivatedEvent('owner-1', 'user-2');
    expect(event.type).toBe('ACCOUNT_ACTIVATED');
    expect(event.actorUserId).toBe('owner-1');
    expect(event.payload.subjectUserId).toBe('user-2');
    expect(event.familyTreeId).toBeNull();
  });

  it('ACCOUNT_DISABLED: owner acts on the subject account', () => {
    const event = buildAccountDisabledEvent('owner-1', 'user-3');
    expect(event).toEqual({
      type: 'ACCOUNT_DISABLED',
      actorUserId: 'owner-1',
      familyTreeId: null,
      payload: { subjectUserId: 'user-3' },
    });
  });

  it('ACCOUNT_ENABLED: owner acts on the subject account', () => {
    const event = buildAccountEnabledEvent('owner-1', 'user-4');
    expect(event.type).toBe('ACCOUNT_ENABLED');
    expect(event.actorUserId).toBe('owner-1');
    expect(event.payload.subjectUserId).toBe('user-4');
  });
});

describe('PII validator refuses third-party contact keys', () => {
  const refused = (payload: Record<string, string>) =>
    expect(validateEventPayload('ACCOUNT_DISABLED', payload).ok).toBe(false);

  it('refuses "phone"', () => refused({ subjectUserId: 'u1', phone: '+6281234567890' }));
  it('refuses "phoneNumber" and normalized variants', () => {
    refused({ subjectUserId: 'u1', phoneNumber: '+6281234567890' });
    refused({ subjectUserId: 'u1', phone_number: '+6281234567890' });
    refused({ subjectUserId: 'u1', 'Phone Number': '+6281234567890' });
  });
  it('refuses "number"', () => refused({ subjectUserId: 'u1', number: '+6281234567890' }));
  it('refuses "wa"', () => refused({ subjectUserId: 'u1', wa: '+6281234567890' }));
  it('refuses "nomor"', () => refused({ subjectUserId: 'u1', nomor: '081234567890' }));
  it('refuses "email"', () => refused({ subjectUserId: 'u1', email: 'third.party@example.com' }));

  it('accepts technical user ids', () => {
    expect(validateEventPayload('ACCOUNT_ACTIVATED', { subjectUserId: 'user-1' }).ok).toBe(true);
  });

  it('refuses recipient contact keys on invitation payloads too (P2-3)', () => {
    const base = { invitationId: 'inv-1', invitationType: 'family' };
    for (const key of ['recipientPhone', 'recipient_phone', 'recipientEmail', 'recipient', 'penerima', 'contact', 'contactDetail']) {
      const verdict = validateEventPayload('INVITATION_REVOKED', { ...base, [key]: '081234567890' });
      expect(verdict.ok, `key "${key}" must be refused`).toBe(false);
    }
  });
});

describe('validator rejects empty or unknown fields', () => {
  it('refuses empty string values', () => {
    const result = validateEventPayload('ACCOUNT_PENDING_CREATED', { subjectUserId: '' });
    expect(result.ok).toBe(false);
  });

  it('refuses null and undefined values', () => {
    expect(validateEventPayload('ACCOUNT_PENDING_CREATED', { subjectUserId: null }).ok).toBe(false);
    expect(validateEventPayload('ACCOUNT_PENDING_CREATED', { subjectUserId: undefined }).ok).toBe(false);
  });

  it('refuses keys outside the account contract', () => {
    expect(validateEventPayload('ACCOUNT_ACTIVATED', { subjectUserId: 'u1', note: 'hello' }).ok).toBe(false);
  });

  it('refuses non-object payloads', () => {
    expect(validateEventPayload('ACCOUNT_DISABLED', 'nope').ok).toBe(false);
    expect(validateEventPayload('ACCOUNT_DISABLED', [1, 2]).ok).toBe(false);
    expect(validateEventPayload('ACCOUNT_DISABLED', null).ok).toBe(false);
  });
});

describe('invitation builders produce contract-shaped envelopes (P2-3)', () => {
  it('INVITATION_CREATED records the policy stamps, tree in the envelope', () => {
    const event = buildInvitationCreatedEvent({
      actorUserId: 'owner-1',
      familyTreeId: 'tree-1',
      invitationId: 'inv-1',
      invitationType: 'family',
      channel: 'manual',
      grantedRole: 'editor',
      expiresAt: new Date('2026-08-31T12:00:00.000Z'),
      maxUses: 20,
    });
    expect(event.type).toBe('INVITATION_CREATED');
    expect(event.actorUserId).toBe('owner-1');
    expect(event.familyTreeId).toBe('tree-1');
    expect(event.payload).toEqual({
      invitationId: 'inv-1',
      invitationType: 'family',
      channel: 'manual',
      grantedRole: 'editor',
      expiresAt: '2026-08-31T12:00:00.000Z',
      maxUses: 20,
    });
    expect(validateEventPayload(event.type, event.payload).ok).toBe(true);
  });

  it('INVITATION_USED success names the consuming account, no reason key', () => {
    const event = buildInvitationUsedEvent({
      actorUserId: 'user-9',
      familyTreeId: 'tree-1',
      invitationId: 'inv-1',
      invitationType: 'personal',
      result: 'success',
      subjectUserId: 'user-9',
    });
    expect(event.payload).toEqual({
      invitationId: 'inv-1',
      invitationType: 'personal',
      result: 'success',
      subjectUserId: 'user-9',
    });
    expect('reason' in event.payload).toBe(false);
    expect(validateEventPayload(event.type, event.payload).ok).toBe(true);
  });

  it('INVITATION_USED failure carries the honest reason and null subject', () => {
    const event = buildInvitationUsedEvent({
      actorUserId: null,
      familyTreeId: 'tree-1',
      invitationId: 'inv-1',
      invitationType: 'family',
      result: 'failure',
      reason: 'INVITATION_EXPIRED',
      subjectUserId: null,
    });
    expect(event.actorUserId).toBeNull();
    expect(event.payload).toEqual({
      invitationId: 'inv-1',
      invitationType: 'family',
      result: 'failure',
      reason: 'INVITATION_EXPIRED',
      subjectUserId: null,
    });
    expect(validateEventPayload(event.type, event.payload).ok).toBe(true);
  });

  it('INVITATION_REVOKED carries only the two technical keys', () => {
    const event = buildInvitationRevokedEvent({
      actorUserId: 'owner-1',
      familyTreeId: 'tree-1',
      invitationId: 'inv-2',
      invitationType: 'personal',
    });
    expect(event.payload).toEqual({ invitationId: 'inv-2', invitationType: 'personal' });
    expect(validateEventPayload(event.type, event.payload).ok).toBe(true);
  });

  it('validator pins each invitation type to its own key set', () => {
    const revokedShape = { invitationId: 'inv-1', invitationType: 'personal' };
    expect(validateEventPayload('INVITATION_REVOKED', revokedShape).ok).toBe(true);
    // CREATED-only and USED-only keys are refused on REVOKED.
    expect(validateEventPayload('INVITATION_REVOKED', { ...revokedShape, channel: 'manual' }).ok).toBe(false);
    expect(validateEventPayload('INVITATION_REVOKED', { ...revokedShape, result: 'success' }).ok).toBe(false);
    expect(validateEventPayload('INVITATION_CREATED', { ...revokedShape, channel: 'wa', grantedRole: 'viewer', expiresAt: '2026-08-31T12:00:00.000Z', maxUses: 1 }).ok).toBe(true);
    expect(validateEventPayload('INVITATION_CREATED', { ...revokedShape, channel: 'wa', grantedRole: 'viewer', expiresAt: '2026-08-31T12:00:00.000Z', maxUses: Number.NaN }).ok).toBe(false);
  });

  it('validator enforces the reason rule on INVITATION_USED', () => {
    const base = { invitationId: 'inv-1', invitationType: 'family', subjectUserId: null };
    expect(validateEventPayload('INVITATION_USED', { ...base, result: 'failure' }).ok).toBe(false);
    expect(validateEventPayload('INVITATION_USED', { ...base, result: 'success' }).ok).toBe(true);
    expect(
      validateEventPayload('INVITATION_USED', { ...base, result: 'success', reason: 'INVITATION_EXPIRED' }).ok,
    ).toBe(false);
    expect(validateEventPayload('INVITATION_USED', { ...base, result: 'maybe', reason: 'X' }).ok).toBe(false);
    // A non-null subjectUserId stays a plain non-empty string.
    expect(
      validateEventPayload('INVITATION_USED', { invitationId: 'inv-1', invitationType: 'family', result: 'success', subjectUserId: 'user-9' }).ok,
    ).toBe(true);
  });
});

describe('exhaustiveness of the event union', () => {
  it('EVENT_TYPES holds exactly the seven shipped types, no duplicates', () => {
    expect([...EVENT_TYPES]).toEqual([
      'ACCOUNT_PENDING_CREATED',
      'ACCOUNT_ACTIVATED',
      'ACCOUNT_DISABLED',
      'ACCOUNT_ENABLED',
      'INVITATION_CREATED',
      'INVITATION_USED',
      'INVITATION_REVOKED',
    ]);
    expect(new Set(EVENT_TYPES).size).toBe(7);
  });

  it('isEventType accepts members and refuses anything else', () => {
    for (const type of EVENT_TYPES) expect(isEventType(type)).toBe(true);
    expect(isEventType('ACCOUNT_DELETED')).toBe(false);
    expect(isEventType('INVITATION_DELETED')).toBe(false);
    expect(isEventType('')).toBe(false);
    expect(isEventType(42)).toBe(false);
  });
});

describe('canonical JSON round-trip', () => {
  it('builder payloads survive serialize/parse without drift', () => {
    for (const event of [
      buildAccountPendingCreatedEvent('user-1'),
      buildAccountActivatedEvent('owner-1', 'user-2'),
      buildAccountDisabledEvent('owner-1', 'user-3'),
      buildAccountEnabledEvent('owner-1', 'user-4'),
    ]) {
      const roundTripped = parseEventPayload(serializeEventPayload(event.payload));
      expect(roundTripped).toEqual(event.payload);
    }
  });

  it('parseEventPayload returns null for broken JSON', () => {
    expect(parseEventPayload('{not json')).toBeNull();
  });
});

describe('projections from an emitted event', () => {
  it('PENDING_CREATED fans out one draft per active owner with P2-1 shape', () => {
    const event = buildAccountPendingCreatedEvent('user-9');
    const drafts = projectPendingCreatedNotifications(
      event,
      [{ id: 'owner-1' }, { id: 'owner-2' }],
      { id: 'user-9', email: 'nine@example.com', name: 'Nine' },
    );
    expect(drafts).toHaveLength(2);
    expect(drafts[0]).toEqual({
      userId: 'owner-1',
      type: 'ACCOUNT_PENDING_CREATED',
      payloadJson: JSON.stringify({ pendingUserId: 'user-9', email: 'nine@example.com', name: 'Nine' }),
    });
  });

  it('PENDING_CREATED projection refuses a subject that does not match the event', () => {
    const event = buildAccountPendingCreatedEvent('user-9');
    expect(() =>
      projectPendingCreatedNotifications(event, [{ id: 'owner-1' }], {
        id: 'user-8',
        email: 'eight@example.com',
        name: 'Eight',
      }),
    ).toThrow(/does not match/);
  });

  it('ACTIVATED and ENABLED both project to the P2-1 activated notification', () => {
    expect(projectAccountActivatedNotification(buildAccountActivatedEvent('owner-1', 'user-2'))).toEqual({
      userId: 'user-2',
      type: 'ACCOUNT_ACTIVATED',
      payloadJson: JSON.stringify({}),
    });
    expect(projectAccountActivatedNotification(buildAccountEnabledEvent('owner-1', 'user-4'))).toEqual({
      userId: 'user-4',
      type: 'ACCOUNT_ACTIVATED',
      payloadJson: JSON.stringify({}),
    });
  });

  it('activated projection refuses other event types', () => {
    expect(() =>
      projectAccountActivatedNotification(buildAccountDisabledEvent('owner-1', 'user-3')),
    ).toThrow(/expects ACCOUNT_ACTIVATED or ACCOUNT_ENABLED/);
  });
});
