// Unit tests for the v387 reminder section of the digest builder.
// Covers: reminders alone make the digest non-empty, the plaintext
// section renders after the tree sections and before the footer,
// birthday vs wedding line shapes, today wording, the empty-reminders
// backward compatibility, and the no-PII payload assertion.

import { describe, expect, it } from 'vitest';
import {
  buildWeeklyDigest,
  type DigestReminder,
  type DigestSourceEvent,
} from './builder';
import { weeklyWindow } from './window';

const window = weeklyWindow(new Date('2026-08-26T10:00:00Z')); // [2026-08-17, 2026-08-24)
const RECIPIENT = { id: 'user-r', name: 'Rina' };
const ACTORS = [{ id: 'user-a', name: 'Adi' }];
const TREES = [{ id: 'tree-1', name: 'Keluarga Besar' }];

function event(overrides: Partial<DigestSourceEvent>): DigestSourceEvent {
  return {
    id: 'ev-1',
    type: 'INVITATION_CREATED',
    actorUserId: 'user-a',
    familyTreeId: 'tree-1',
    createdAt: '2026-08-19T08:00:00Z',
    ...overrides,
  };
}

const REMINDERS: DigestReminder[] = [
  { kind: 'birthday', displayName: 'Budi', nextDate: '2026-08-25', daysUntil: 1, yearsCompleted: 40 },
  { kind: 'wedding', displayName: 'Adi & Rina', nextDate: '2026-08-24', daysUntil: 0, yearsCompleted: 10 },
];

function buildWith(reminders: DigestReminder[], events: DigestSourceEvent[] = []) {
  return buildWeeklyDigest({
    recipient: RECIPIENT,
    events,
    membershipTreeIds: ['tree-1'],
    trees: TREES,
    actors: ACTORS,
    window,
    reminders,
  });
}

describe('the reminders section (v387)', () => {
  it('reminders alone make the digest non-empty', () => {
    const result = buildWith(REMINDERS, []);
    expect(result.empty).toBe(false);
    if (!result.empty) expect(result.reminders).toEqual(REMINDERS);
  });

  it('no reminders and no events still yields the honest empty result', () => {
    expect(buildWith([], [])).toEqual({ empty: true });
  });

  it('events without reminders keep the legacy shape: reminders defaults to empty', () => {
    const result = buildWeeklyDigest({
      recipient: RECIPIENT,
      events: [event({})],
      membershipTreeIds: ['tree-1'],
      trees: TREES,
      actors: ACTORS,
      window,
    });
    expect(result.empty).toBe(false);
    if (!result.empty) expect(result.reminders).toEqual([]);
  });

  it('renders the Reminders section between tree sections and the footer', () => {
    const result = buildWith(REMINDERS, [event({})]);
    expect(result.empty).toBe(false);
    if (result.empty) return;
    const treeIdx = result.body.indexOf('# Keluarga Besar');
    const remIdx = result.body.indexOf('# Reminders');
    const footerIdx = result.body.indexOf('You received this email because you switched on the weekly digest');
    expect(treeIdx).toBeGreaterThanOrEqual(0);
    expect(remIdx).toBeGreaterThan(treeIdx);
    expect(footerIdx).toBeGreaterThan(remIdx);
  });

  it('birthday lines read today/in-N-days with the turning age', () => {
    const result = buildWith([REMINDERS[0] as DigestReminder], []);
    expect(result.empty).toBe(false);
    if (!result.empty) {
      expect(result.body).toContain('- birthday: Budi on 2026-08-25 (in 1 days, turning 40)');
    }
  });

  it('wedding lines read today wording and years married', () => {
    const result = buildWith([REMINDERS[1] as DigestReminder], []);
    expect(result.empty).toBe(false);
    if (!result.empty) {
      expect(result.body).toContain('- wedding: Adi & Rina on 2026-08-24 (today, 10 years married)');
    }
  });

  it('carries no PII: no emails, phones or tokens anywhere in it', () => {
    const result = buildWith(REMINDERS, [event({})]);
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('@');
    expect(serialized).not.toContain('phone');
    expect(serialized).not.toContain('token');
    expect(serialized).not.toContain('payloadJson');
  });

  it('is deterministic: the same input renders the same digest twice', () => {
    expect(buildWith(REMINDERS, [event({})])).toEqual(buildWith(REMINDERS, [event({})]));
  });
});
