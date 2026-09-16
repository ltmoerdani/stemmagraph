// Unit tests for the pure consent event helpers (S-09a-i).
// Covers: the builder for all three ledger actions (grant, revoke,
// regrant), and the validator refusals (unknown action, empty fields,
// invalid timestamps, wrong shapes and keys).

import { describe, expect, it } from 'vitest';
import { buildConsentEvent, consentEventType, validateConsentEvent } from './consent';
import { validateEventPayload } from './index';

const baseInput = {
  consentId: 'rec_01',
  actorId: 'owner-1',
  memberId: 'member-7',
  treeId: 'tree-3',
  action: 'grant' as const,
  occurredAt: '2026-09-17T08:00:00.000Z',
};

describe('buildConsentEvent maps ledger actions to vocabulary', () => {
  it('grant produces CONSENT_GRANTED with the four contract keys', () => {
    const event = buildConsentEvent(baseInput);
    expect(event).toEqual({
      type: 'CONSENT_GRANTED',
      actorUserId: 'owner-1',
      familyTreeId: 'tree-3',
      payload: {
        consentId: 'rec_01',
        memberId: 'member-7',
        action: 'grant',
        occurredAt: '2026-09-17T08:00:00.000Z',
      },
    });
  });

  it('revoke produces CONSENT_REVOKED with action copied verbatim', () => {
    const event = buildConsentEvent({ ...baseInput, action: 'revoke', occurredAt: '2026-09-17T09:30:00.000Z' });
    expect(event.type).toBe('CONSENT_REVOKED');
    expect(event.payload.action).toBe('revoke');
    expect(event.payload.occurredAt).toBe('2026-09-17T09:30:00.000Z');
  });

  it('regrant produces CONSENT_GRANTED, the ledger keeps the fine distinction', () => {
    const event = buildConsentEvent({ ...baseInput, action: 'regrant' });
    expect(event.type).toBe('CONSENT_GRANTED');
    expect(event.payload.action).toBe('regrant');
  });

  it('system actor passes through as null envelope column', () => {
    const event = buildConsentEvent({ ...baseInput, actorId: null });
    expect(event.actorUserId).toBeNull();
  });

  it('consentEventType agrees with the builder mapping', () => {
    expect(consentEventType('grant')).toBe('CONSENT_GRANTED');
    expect(consentEventType('revoke')).toBe('CONSENT_REVOKED');
    expect(consentEventType('regrant')).toBe('CONSENT_GRANTED');
  });

  it('builder payloads pass the store-wide PII validator', () => {
    for (const action of ['grant', 'revoke', 'regrant'] as const) {
      const event = buildConsentEvent({ ...baseInput, action });
      expect(validateEventPayload(event.type, event.payload)).toEqual({ ok: true });
    }
  });
});

describe('validateConsentEvent refusals', () => {
  it('accepts a well-formed payload for every action', () => {
    for (const action of ['grant', 'revoke', 'regrant'] as const) {
      const event = buildConsentEvent({ ...baseInput, action });
      expect(validateConsentEvent(event.payload)).toBe(true);
    }
  });

  it('refuses an action outside the three-value vocabulary', () => {
    const event = buildConsentEvent(baseInput);
    expect(validateConsentEvent({ ...event.payload, action: 'approve' })).toBe(false);
    expect(validateConsentEvent({ ...event.payload, action: '' })).toBe(false);
  });

  it('refuses empty consentId or memberId', () => {
    const event = buildConsentEvent(baseInput);
    expect(validateConsentEvent({ ...event.payload, consentId: '' })).toBe(false);
    expect(validateConsentEvent({ ...event.payload, memberId: '' })).toBe(false);
  });

  it('refuses invalid or unparseable timestamps', () => {
    const event = buildConsentEvent(baseInput);
    expect(validateConsentEvent({ ...event.payload, occurredAt: 'not-a-date' })).toBe(false);
    expect(validateConsentEvent({ ...event.payload, occurredAt: '2026-13-99T99:99:99Z' })).toBe(false);
    expect(validateConsentEvent({ ...event.payload, occurredAt: 123 })).toBe(false);
  });

  it('refuses non-objects, arrays, null, and missing or extra keys', () => {
    expect(validateConsentEvent(null)).toBe(false);
    expect(validateConsentEvent('grant')).toBe(false);
    expect(validateConsentEvent([])).toBe(false);
    const event = buildConsentEvent(baseInput);
    expect(validateConsentEvent({ ...event.payload, note: 'extra' })).toBe(false);
    const missing = { ...event.payload } as Record<string, unknown>;
    delete missing.action;
    expect(validateConsentEvent(missing)).toBe(false);
    expect(validateConsentEvent({ consentId: 'rec_01', memberId: 'member-7' })).toBe(false);
  });
});
