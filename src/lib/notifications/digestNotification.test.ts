// Unit tests for the pure digest_sent notification builder (v387).
// Covers: the draft shape, the window label (endAt minus one day),
// payload counts, PII-free payload, and determinism.

import { describe, expect, it } from 'vitest';
import {
  buildDigestSentNotification,
  DIGEST_SENT_NOTIFICATION_TYPE,
} from './digestNotification';

const WINDOW = {
  startAt: new Date('2026-08-17T00:00:00Z'),
  endAt: new Date('2026-08-24T00:00:00Z'),
};

const DIGEST = {
  subject: 'Stemmagraph weekly digest 2026-08-17 to 2026-08-23: Rina',
  treeCount: 2,
  reminderCount: 3,
};

describe('buildDigestSentNotification', () => {
  it('builds one draft with the digest_sent type', () => {
    const draft = buildDigestSentNotification('user-1', DIGEST, WINDOW);
    expect(draft.userId).toBe('user-1');
    expect(draft.type).toBe(DIGEST_SENT_NOTIFICATION_TYPE);
  });

  it('labels the window as its inclusive day range (endAt minus one day)', () => {
    const draft = buildDigestSentNotification('user-1', DIGEST, WINDOW);
    const payload = JSON.parse(draft.payloadJson);
    expect(payload.windowStart).toBe('2026-08-17');
    expect(payload.windowEnd).toBe('2026-08-23');
  });

  it('carries subject and counts, and nothing else sensitive', () => {
    const draft = buildDigestSentNotification('user-1', DIGEST, WINDOW);
    const payload = JSON.parse(draft.payloadJson);
    expect(payload.subject).toBe(DIGEST.subject);
    expect(payload.treeCount).toBe(2);
    expect(payload.reminderCount).toBe(3);
    expect(draft.payloadJson).not.toContain('@');
    expect(draft.payloadJson).not.toContain('token');
    expect(draft.payloadJson).not.toContain('email');
  });

  it('is deterministic for the same inputs', () => {
    expect(buildDigestSentNotification('user-1', DIGEST, WINDOW)).toEqual(
      buildDigestSentNotification('user-1', DIGEST, WINDOW),
    );
  });
});
