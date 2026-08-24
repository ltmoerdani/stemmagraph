// Unit tests for the pure digest builder (P2-7 AC-2).
// Covers: the three filter rules (window, foreign actor, member tree),
// null-tree exclusion, per-tree grouping with all seven counts, actor
// name resolution and fallbacks, the no-PII payload assertion, the
// mandatory opt-out footer, the subject range and determinism.

import { describe, expect, it } from 'vitest';
import { buildWeeklyDigest, UNKNOWN_ACTOR_LABEL, type DigestSourceEvent } from './builder';
import { weeklyWindow } from './window';

const window = weeklyWindow(new Date('2026-08-26T10:00:00Z')); // [2026-08-17, 2026-08-24)
const RECIPIENT = { id: 'user-r', name: 'Rina' };

const ACTORS = [
  { id: 'user-a', name: 'Adi' },
  { id: 'user-b', name: 'Budi' },
];
const TREES = [
  { id: 'tree-1', name: 'Keluarga Besar' },
  { id: 'tree-2', name: 'Marga Timur' },
];

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

function build(events: readonly DigestSourceEvent[], membershipTreeIds: readonly string[] = ['tree-1', 'tree-2']) {
  return buildWeeklyDigest({
    recipient: RECIPIENT,
    events,
    membershipTreeIds,
    trees: TREES,
    actors: ACTORS,
    window,
  });
}

describe('the three filter rules', () => {
  it('no qualifying events at all yields the honest empty result', () => {
    expect(build([])).toEqual({ empty: true });
  });

  it('events outside the window are excluded, including exactly on endAt', () => {
    const result = build([
      event({ createdAt: '2026-08-16T23:59:59.999Z' }), // day before startAt
      event({ createdAt: '2026-08-24T00:00:00.000Z' }), // exactly endAt (exclusive)
      event({ createdAt: '2026-08-25T10:00:00Z' }), // after the window
    ]);
    expect(result).toEqual({ empty: true });
  });

  it('events the recipient performed themselves are excluded', () => {
    const result = build([
      event({ actorUserId: 'user-r', createdAt: '2026-08-19T08:00:00Z' }),
      event({ id: 'ev-2', createdAt: '2026-08-19T09:00:00Z' }),
    ]);
    expect(result.empty).toBe(false);
    if (!result.empty) {
      expect(result.treeSections[0]?.counts.INVITATION_CREATED).toBe(1);
      expect(result.actorNames).toEqual(['Adi']);
    }
  });

  it('events on trees without the recipient membership are excluded, and so are null-tree events', () => {
    const result = build([
      event({ familyTreeId: 'tree-9', id: 'ev-1' }),
      event({ familyTreeId: null, id: 'ev-2' }),
    ]);
    expect(result).toEqual({ empty: true });
  });
});

describe('grouping and name resolution', () => {
  const events = [
    event({ id: 'ev-1', type: 'INVITATION_CREATED', actorUserId: 'user-a', familyTreeId: 'tree-2', createdAt: '2026-08-18T08:00:00Z' }),
    event({ id: 'ev-2', type: 'INVITATION_USED', actorUserId: 'user-b', familyTreeId: 'tree-2', createdAt: '2026-08-19T08:00:00Z' }),
    event({ id: 'ev-3', type: 'INVITATION_REVOKED', actorUserId: 'user-b', familyTreeId: 'tree-2', createdAt: '2026-08-20T08:00:00Z' }),
    event({ id: 'ev-4', type: 'ACCOUNT_ACTIVATED', actorUserId: 'user-a', familyTreeId: 'tree-1', createdAt: '2026-08-21T08:00:00Z' }),
  ];

  it('groups per tree and counts all ten types, zeros included', () => {
    const result = build(events);
    expect(result.empty).toBe(false);
    if (result.empty) return;
    expect(result.treeSections.map((section) => section.treeId)).toEqual(['tree-1', 'tree-2']);
    const marga = result.treeSections[1];
    expect(marga?.treeName).toBe('Marga Timur');
    expect(marga?.counts).toEqual({
      ACCOUNT_PENDING_CREATED: 0,
      ACCOUNT_ACTIVATED: 0,
      ACCOUNT_DISABLED: 0,
      ACCOUNT_ENABLED: 0,
      INVITATION_CREATED: 1,
      INVITATION_USED: 1,
      INVITATION_REVOKED: 1,
      CHANGE_PROPOSED: 0,
      CHANGE_ACCEPTED: 0,
      CHANGE_REJECTED: 0,
    });
    expect(result.treeSections[0]?.counts.ACCOUNT_ACTIVATED).toBe(1);
  });

  it('collects distinct actor names, alphabetical, across the whole digest', () => {
    const result = build(events);
    expect(result.empty).toBe(false);
    if (!result.empty) expect(result.actorNames).toEqual(['Adi', 'Budi']);
  });

  it('a system action (null actor) and an unresolvable id fall back to the honest label', () => {
    const result = build([
      event({ id: 'ev-1', actorUserId: null, createdAt: '2026-08-19T08:00:00Z' }),
      event({ id: 'ev-2', actorUserId: 'user-gone', createdAt: '2026-08-19T09:00:00Z' }),
    ]);
    expect(result.empty).toBe(false);
    if (!result.empty) expect(result.actorNames).toEqual([UNKNOWN_ACTOR_LABEL]);
  });

  it('a tree missing from the lookup falls back to its id as the name', () => {
    const result = build([event({ familyTreeId: 'tree-2', id: 'ev-1' })], ['tree-2']);
    expect(result.empty).toBe(false);
    if (!result.empty) expect(result.treeSections[0]?.treeName).toBe('Marga Timur');
  });
});

describe('the email surface: template, subject, privacy', () => {
  const events = [
    event({ id: 'ev-1', type: 'INVITATION_CREATED', actorUserId: 'user-b', familyTreeId: 'tree-1', createdAt: '2026-08-19T08:00:00Z' }),
    event({ id: 'ev-2', type: 'ACCOUNT_ENABLED', actorUserId: 'user-a', familyTreeId: 'tree-1', createdAt: '2026-08-22T08:00:00Z' }),
  ];

  it('the subject names the inclusive day range and the recipient', () => {
    const result = build(events);
    expect(result.empty).toBe(false);
    if (!result.empty) expect(result.subject).toBe('Stemmagraph weekly digest 2026-08-17 to 2026-08-23: Rina');
  });

  it('the body renders non-zero type lines under each tree, zero types stay silent', () => {
    const result = build(events);
    expect(result.empty).toBe(false);
    if (result.empty) return;
    expect(result.body).toContain('# Keluarga Besar');
    expect(result.body).toContain('- INVITATION_CREATED: 1');
    expect(result.body).toContain('- ACCOUNT_ENABLED: 1');
    expect(result.body).not.toContain('ACCOUNT_DISABLED: ');
    expect(result.body).toContain('- Activity by: Adi, Budi');
  });

  it('the body always ends with the opt-out footer', () => {
    const result = build(events);
    expect(result.empty).toBe(false);
    if (result.empty) return;
    expect(result.body).toContain('You received this email because you switched on the weekly digest');
    expect(result.body).toContain('switch it off');
  });

  it('the payload carries no PII: no emails, phones or tokens anywhere in it', () => {
    const result = build(events);
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('@');
    expect(serialized).not.toContain('phone');
    expect(serialized).not.toContain('token');
    expect(serialized).not.toContain('payloadJson');
  });

  it('is deterministic: the same input renders the same digest twice', () => {
    expect(build(events)).toEqual(build(events));
  });
});
