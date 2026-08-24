// Unit tests for the pure activity-feed query layer (P2-6 AC-2, AC-3).
// Covers: honest parsing of ?type= (seven v1 types accepted, anything else
// refused), ?limit= (default 50, clamp 1..100, non-integers refused) and
// ?before= (cursor decode refused on garbage), cursor round-trips, the v1
// visibility scope (member of the tree, or account event about self), and
// defensive row parsing that skips rows failing the P2-2 contract.

import { describe, expect, it } from 'vitest';
import {
  buildAccountActivatedEvent,
  buildAccountPendingCreatedEvent,
  buildInvitationCreatedEvent,
  buildInvitationRevokedEvent,
  type EventEnvelope,
} from '../events';
import { projectEventToFeedItem } from './feed';
import {
  ACCOUNT_EVENT_TYPES,
  decodeFeedCursor,
  encodeFeedCursor,
  FEED_LIMIT_DEFAULT,
  isEventVisibleInFeed,
  parseActivityFeedQuery,
  parseStoredEventRow,
} from './query';

// ─── Helpers ─────────────────────────────────────────────

const OWNER = 'user_owner';
const OTHER = 'user_other';
const TREE = 'tree_1';

function invitationCreatedEnvelope(treeId = TREE, actor = OWNER): EventEnvelope {
  return buildInvitationCreatedEvent({
    actorUserId: actor,
    familyTreeId: treeId,
    invitationId: 'inv_1',
    invitationType: 'personal',
    channel: 'wa',
    grantedRole: 'viewer',
    expiresAt: new Date('2026-09-07T04:00:00.000Z'),
    maxUses: 1,
  });
}

// ─── parseActivityFeedQuery: type ────────────────────────

describe('parseActivityFeedQuery (type)', () => {
  it('accepts each of the seven event types', () => {
    for (const type of ['ACCOUNT_PENDING_CREATED', 'ACCOUNT_ACTIVATED', 'ACCOUNT_DISABLED', 'ACCOUNT_ENABLED', 'INVITATION_CREATED', 'INVITATION_USED', 'INVITATION_REVOKED'] as const) {
      const parsed = parseActivityFeedQuery({ type });
      expect(parsed).toMatchObject({ ok: true, typeFilter: [type] });
    }
  });

  it('defaults to no filter when type is absent', () => {
    const parsed = parseActivityFeedQuery({});
    expect(parsed).toMatchObject({ ok: true, typeFilter: null, limit: FEED_LIMIT_DEFAULT, before: null });
  });

  it('refuses an unknown type with a honest 400 payload', () => {
    const parsed = parseActivityFeedQuery({ type: 'ACCOUNT_DELETED' });
    expect(parsed).toMatchObject({ ok: false, code: 'VALIDATION_ERROR' });
  });

  it('refuses "all" and non-string type values instead of silently ignoring them', () => {
    expect(parseActivityFeedQuery({ type: 'all' })).toMatchObject({ ok: false });
    expect(parseActivityFeedQuery({ type: ['INVITATION_CREATED'] })).toMatchObject({ ok: false });
    expect(parseActivityFeedQuery({ type: 42 })).toMatchObject({ ok: false });
  });
});

// ─── parseActivityFeedQuery: limit ───────────────────────

describe('parseActivityFeedQuery (limit)', () => {
  it('defaults to 50', () => {
    expect(parseActivityFeedQuery({})).toMatchObject({ ok: true, limit: 50 });
  });

  it('clamps below-range and above-range integers into 1..100', () => {
    expect(parseActivityFeedQuery({ limit: '0' })).toMatchObject({ ok: true, limit: 1 });
    expect(parseActivityFeedQuery({ limit: '-25' })).toMatchObject({ ok: true, limit: 1 });
    expect(parseActivityFeedQuery({ limit: '1000' })).toMatchObject({ ok: true, limit: 100 });
    expect(parseActivityFeedQuery({ limit: '20' })).toMatchObject({ ok: true, limit: 20 });
  });

  it('refuses non-integer and non-string limits', () => {
    expect(parseActivityFeedQuery({ limit: 'abc' })).toMatchObject({ ok: false, code: 'VALIDATION_ERROR' });
    expect(parseActivityFeedQuery({ limit: '3.5' })).toMatchObject({ ok: false, code: 'VALIDATION_ERROR' });
    expect(parseActivityFeedQuery({ limit: '' })).toMatchObject({ ok: false, code: 'VALIDATION_ERROR' });
    expect(parseActivityFeedQuery({ limit: 7 })).toMatchObject({ ok: false, code: 'VALIDATION_ERROR' });
  });
});

// ─── Cursor ──────────────────────────────────────────────

describe('feed cursor', () => {
  it('round-trips a projected item through encode and decode', () => {
    const item = projectEventToFeedItem({
      id: 'evt_abc',
      createdAt: new Date('2026-08-24T04:00:00.000Z'),
      envelope: invitationCreatedEnvelope(),
    });
    const cursor = encodeFeedCursor(item);
    expect(typeof cursor).toBe('string');
    expect(decodeFeedCursor(cursor)).toEqual({
      ok: true,
      createdAt: '2026-08-24T04:00:00.000Z',
      id: 'evt_abc',
    });
  });

  it('refuses garbage, dangling groups and non-canonical timestamps', () => {
    expect(decodeFeedCursor('not-a-cursor!')).toEqual({ ok: false });
    expect(decodeFeedCursor('')).toEqual({ ok: false });
    expect(decodeFeedCursor(encodeFeedCursor({ id: 'x', createdAt: '2026-08-24T04:00:00.000Z' }).slice(0, -1) + '!!')).toEqual({ ok: false });
    const tampered = decodeFeedCursor(
      (() => {
        // base64url of "not-an-iso|x": invalid timestamp must be refused
        const raw = 'not-an-iso|x';
        const b64 = Buffer.from(raw, 'utf8').toString('base64');
        return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      })(),
    );
    expect(tampered).toEqual({ ok: false });
  });

  it('parseActivityFeedQuery wires before into the decoded tuple', () => {
    const cursor = encodeFeedCursor({ id: 'evt_zz', createdAt: '2026-08-01T00:00:00.000Z' });
    expect(parseActivityFeedQuery({ before: cursor })).toMatchObject({
      ok: true,
      before: { createdAt: '2026-08-01T00:00:00.000Z', id: 'evt_zz' },
    });
    expect(parseActivityFeedQuery({ before: 'garbage' })).toMatchObject({ ok: false, code: 'INVALID_CURSOR' });
  });
});

// ─── Visibility scope ────────────────────────────────────

describe('isEventVisibleInFeed', () => {
  it('shows a tree event to a member of that tree, viewer role included', () => {
    const viewer = { id: OTHER, treeIds: [TREE, 'tree_2'] };
    expect(isEventVisibleInFeed(invitationCreatedEnvelope(), viewer)).toBe(true);
  });

  it('hides a tree event from a non-member', () => {
    const viewer = { id: OTHER, treeIds: ['tree_2'] };
    expect(isEventVisibleInFeed(invitationCreatedEnvelope(), viewer)).toBe(false);
  });

  it('hides tree events from a viewer with no memberships at all', () => {
    expect(isEventVisibleInFeed(invitationCreatedEnvelope(), { id: OTHER, treeIds: [] })).toBe(false);
  });

  it('shows an account event where the viewer is the subject', () => {
    const event = buildAccountActivatedEvent(OWNER, OTHER);
    expect(isEventVisibleInFeed(event, { id: OTHER, treeIds: [] })).toBe(true);
  });

  it('shows an account event where the viewer is the actor', () => {
    const event = buildAccountActivatedEvent(OWNER, OTHER);
    expect(isEventVisibleInFeed(event, { id: OWNER, treeIds: [] })).toBe(true);
  });

  it('never shows account events about somebody else', () => {
    const event = buildAccountActivatedEvent(OWNER, OTHER);
    expect(isEventVisibleInFeed(event, { id: 'user_third', treeIds: [] })).toBe(false);
    const pending = buildAccountPendingCreatedEvent('user_reg');
    expect(isEventVisibleInFeed(pending, { id: OWNER, treeIds: [] })).toBe(false);
  });

  it('hides an invitation event for a former actor outside the tree scope', () => {
    const event = buildInvitationRevokedEvent({
      actorUserId: OWNER,
      familyTreeId: TREE,
      invitationId: 'inv_1',
      invitationType: 'personal',
    });
    expect(isEventVisibleInFeed(event, { id: OWNER, treeIds: [] })).toBe(false);
  });
});

// ─── Stored row parsing ──────────────────────────────────

describe('parseStoredEventRow', () => {
  it('parses a well-formed row into a projector source', () => {
    const row = {
      id: 'evt_row1',
      type: 'INVITATION_CREATED',
      actorUserId: OWNER,
      familyTreeId: TREE,
      payloadJson: JSON.stringify({
        invitationId: 'inv_1',
        invitationType: 'personal',
        channel: 'wa',
        grantedRole: 'viewer',
        expiresAt: '2026-09-07T04:00:00.000Z',
        maxUses: 1,
      }),
      createdAt: new Date('2026-08-24T04:00:00.000Z'),
    };
    const parsed = parseStoredEventRow(row);
    expect(parsed).not.toBeNull();
    expect(parsed!.envelope.type).toBe('INVITATION_CREATED');
    expect(parsed!.envelope.familyTreeId).toBe(TREE);
  });

  it('skips rows with an unknown type or broken payload JSON', () => {
    expect(parseStoredEventRow({
      id: 'evt_bad1',
      type: 'GEDCOM_IMPORTED',
      actorUserId: null,
      familyTreeId: null,
      payloadJson: '{}',
      createdAt: new Date(),
    })).toBeNull();
    expect(parseStoredEventRow({
      id: 'evt_bad2',
      type: 'ACCOUNT_ACTIVATED',
      actorUserId: OWNER,
      familyTreeId: null,
      payloadJson: '{not json',
      createdAt: new Date(),
    })).toBeNull();
    expect(parseStoredEventRow({
      id: 'evt_bad3',
      type: 'ACCOUNT_ACTIVATED',
      actorUserId: OWNER,
      familyTreeId: null,
      payloadJson: '"just a string"',
      createdAt: new Date(),
    })).toBeNull();
  });

  it('exposes exactly the four account event types for the SQL clause', () => {
    expect([...ACCOUNT_EVENT_TYPES].sort()).toEqual([
      'ACCOUNT_ACTIVATED',
      'ACCOUNT_DISABLED',
      'ACCOUNT_ENABLED',
      'ACCOUNT_PENDING_CREATED',
    ]);
  });
});
