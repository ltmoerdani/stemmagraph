// Unit tests for the pure activity-feed projector (P2-6 AC-1, P2-5 fence).
// Covers: the complete mapping of the seven rendered event types into
// FeedItem, the P2-5 fence that keeps CHANGE_* facts out of the feed until
// the deferred feed-item decision, param minimization for invitation facts
// (channel, invitationType, result, time, invitation id only; never phone
// numbers, share text or tokens), kind grouping, i18n keys, timestamp
// normalization, the type filter builder, and newest-first sorting with id
// tie-break. Every case is pure: fixtures are envelopes from the P2-2
// builders, no I/O anywhere.

import { describe, expect, it } from 'vitest';
import {
  buildAccountActivatedEvent,
  buildAccountDisabledEvent,
  buildAccountEnabledEvent,
  buildAccountPendingCreatedEvent,
  buildChangeProposedEvent,
  buildInvitationCreatedEvent,
  buildInvitationRevokedEvent,
  buildInvitationUsedEvent,
  EVENT_TYPES,
  type EventEnvelope,
} from '../events';
import {
  applyFeedTypeFilter,
  FEED_KINDS,
  FEED_RENDERED_EVENT_TYPES,
  FEED_TYPES_BY_KIND,
  FEED_TYPE_SELECTIONS,
  feedKindOfEventType,
  isFeedRenderedEventType,
  isFeedTypeSelection,
  projectEventToFeedItem,
  projectFeedItems,
  resolveFeedTypeFilter,
  sortFeedItemsNewestFirst,
  type FeedSourceEvent,
} from './feed';

// ─── Helpers ─────────────────────────────────────────────

const T0 = new Date('2026-08-24T04:00:00.000Z');

function source(id: string, envelope: EventEnvelope, createdAt: Date = T0): FeedSourceEvent {
  return { id, createdAt, envelope };
}

function invitationCreatedEnvelope(): EventEnvelope {
  return buildInvitationCreatedEvent({
    actorUserId: 'user_owner',
    familyTreeId: 'tree_1',
    invitationId: 'inv_123',
    invitationType: 'personal',
    channel: 'wa',
    grantedRole: 'viewer',
    expiresAt: new Date('2026-09-07T04:00:00.000Z'),
    maxUses: 3,
  });
}

function invitationUsedEnvelope(result: 'success' | 'failure'): EventEnvelope {
  return buildInvitationUsedEvent({
    actorUserId: result === 'success' ? 'user_new' : null,
    familyTreeId: 'tree_1',
    invitationId: 'inv_123',
    invitationType: 'family',
    result,
    reason: result === 'failure' ? 'INVITATION_EXPIRED' : undefined,
    subjectUserId: result === 'success' ? 'user_new' : null,
  });
}

// ─── projectEventToFeedItem: account facts ───────────────

describe('projectEventToFeedItem (account facts)', () => {
  it('maps ACCOUNT_PENDING_CREATED with empty params and null actor passthrough', () => {
    const envelope = buildAccountPendingCreatedEvent('user_reg');
    const item = projectEventToFeedItem(source('evt_a', envelope));
    expect(item).toEqual({
      id: 'evt_a',
      kind: 'account',
      type: 'ACCOUNT_PENDING_CREATED',
      createdAt: '2026-08-24T04:00:00.000Z',
      actorUserId: 'user_reg',
      familyTreeId: null,
      i18nKey: 'activityFeed.items.accountPendingCreated',
      params: {},
    });
  });

  it('maps ACCOUNT_ACTIVATED, keeping the owner as actor', () => {
    const envelope = buildAccountActivatedEvent('user_owner', 'user_reg');
    const item = projectEventToFeedItem(source('evt_b', envelope));
    expect(item.type).toBe('ACCOUNT_ACTIVATED');
    expect(item.kind).toBe('account');
    expect(item.actorUserId).toBe('user_owner');
    expect(item.familyTreeId).toBeNull();
    expect(item.params).toEqual({});
  });

  it('maps ACCOUNT_DISABLED with empty params', () => {
    const item = projectEventToFeedItem(source('evt_c', buildAccountDisabledEvent('user_owner', 'user_x')));
    expect(item.type).toBe('ACCOUNT_DISABLED');
    expect(item.i18nKey).toBe('activityFeed.items.accountDisabled');
    expect(item.params).toEqual({});
  });

  it('maps ACCOUNT_ENABLED with empty params', () => {
    const item = projectEventToFeedItem(source('evt_d', buildAccountEnabledEvent('user_owner', 'user_x')));
    expect(item.type).toBe('ACCOUNT_ENABLED');
    expect(item.i18nKey).toBe('activityFeed.items.accountEnabled');
    expect(item.params).toEqual({});
  });

  it('normalizes a createdAt given as a preformatted ISO string', () => {
    const item = projectEventToFeedItem({
      id: 'evt_e',
      createdAt: '2026-08-01T10:30:00.000Z',
      envelope: buildAccountPendingCreatedEvent('user_reg'),
    });
    expect(item.createdAt).toBe('2026-08-01T10:30:00.000Z');
  });
});

// ─── projectEventToFeedItem: invitation facts ────────────

describe('projectEventToFeedItem (invitation facts)', () => {
  it('maps INVITATION_CREATED to channel, invitationType and invitation id only', () => {
    const item = projectEventToFeedItem(source('evt_f', invitationCreatedEnvelope()));
    expect(item.kind).toBe('invitation');
    expect(item.familyTreeId).toBe('tree_1');
    expect(item.params).toEqual({
      invitationId: 'inv_123',
      invitationType: 'personal',
      channel: 'wa',
    });
  });

  it('drops expiresAt, maxUses and grantedRole from INVITATION_CREATED params', () => {
    const item = projectEventToFeedItem(source('evt_g', invitationCreatedEnvelope()));
    const serialized = JSON.stringify(item.params);
    expect(serialized).not.toContain('expiresAt');
    expect(serialized).not.toContain('maxUses');
    expect(serialized).not.toContain('grantedRole');
    expect(Object.keys(item.params).sort()).toEqual(['channel', 'invitationId', 'invitationType']);
  });

  it('maps INVITATION_USED success to the outcome without subjectUserId', () => {
    const item = projectEventToFeedItem(source('evt_h', invitationUsedEnvelope('success')));
    expect(item.params).toEqual({
      invitationId: 'inv_123',
      invitationType: 'family',
      result: 'success',
    });
  });

  it('maps INVITATION_USED failure to the outcome without reason or subjectUserId', () => {
    const item = projectEventToFeedItem(source('evt_i', invitationUsedEnvelope('failure')));
    expect(item.params).toEqual({
      invitationId: 'inv_123',
      invitationType: 'family',
      result: 'failure',
    });
    expect(JSON.stringify(item.params)).not.toContain('INVITATION_EXPIRED');
  });

  it('maps INVITATION_REVOKED to invitation id and type only', () => {
    const envelope = buildInvitationRevokedEvent({
      actorUserId: 'user_owner',
      familyTreeId: 'tree_1',
      invitationId: 'inv_123',
      invitationType: 'personal',
    });
    const item = projectEventToFeedItem(source('evt_j', envelope));
    expect(item.i18nKey).toBe('activityFeed.items.invitationRevoked');
    expect(item.params).toEqual({ invitationId: 'inv_123', invitationType: 'personal' });
  });

  it('never lets smuggled contact data or a token reach invitation params', () => {
    const envelope = invitationCreatedEnvelope();
    const smuggled = envelope.payload as unknown as Record<string, unknown>;
    smuggled['recipientPhone'] = '+62 812-3456-789';
    smuggled['token'] = 'tok_secret_value';
    smuggled['message'] = 'You are invited, please click';
    const item = projectEventToFeedItem(source('evt_k', envelope));
    const serialized = JSON.stringify(item);
    expect(serialized).not.toContain('812');
    expect(serialized).not.toContain('tok_secret_value');
    expect(serialized).not.toContain('please click');
    expect(Object.keys(item.params).sort()).toEqual(['channel', 'invitationId', 'invitationType']);
  });
});

// ─── Defensive mapping ───────────────────────────────────

describe('projectEventToFeedItem (defensive)', () => {
  it('throws on an event type outside the v1 vocabulary', () => {
    const envelope = {
      type: 'GEDCOM_IMPORTED',
      actorUserId: null,
      familyTreeId: null,
      payload: {},
    } as unknown as EventEnvelope;
    expect(() => projectEventToFeedItem(source('evt_l', envelope))).toThrow(/unknown event type/);
  });

  // Pins the living-person fence documented in the module header: future
  // tree events that touch a living person's record may only reach the
  // feed after a privacy gate, and until such a type is deliberately
  // added to the allowlist the projector refuses it outright.
  it('refuses future person-record events instead of projecting them', () => {
    const envelope = {
      type: 'PERSON_RECORD_UPDATED',
      actorUserId: 'user_owner',
      familyTreeId: 'tree_1',
      payload: { personId: 'p_1', name: 'Living Relative', birthDate: '1990-01-01' },
    } as unknown as EventEnvelope;
    expect(() => projectEventToFeedItem(source('evt_m', envelope))).toThrow(/unknown event type/);
  });
});

// ─── Kind grouping ───────────────────────────────────────

describe('kind grouping', () => {
  it('groups the four account types under account', () => {
    for (const type of FEED_TYPES_BY_KIND.account) {
      expect(feedKindOfEventType(type)).toBe('account');
    }
    expect(FEED_TYPES_BY_KIND.account).toHaveLength(4);
  });

  it('groups the three invitation types under invitation', () => {
    for (const type of FEED_TYPES_BY_KIND.invitation) {
      expect(feedKindOfEventType(type)).toBe('invitation');
    }
    expect(FEED_TYPES_BY_KIND.invitation).toHaveLength(3);
  });

  it('partitions the seven rendered types exactly once', () => {
    const grouped = [...FEED_TYPES_BY_KIND.account, ...FEED_TYPES_BY_KIND.invitation];
    expect(grouped).toHaveLength(FEED_RENDERED_EVENT_TYPES.length);
    expect(new Set(grouped)).toEqual(new Set(FEED_RENDERED_EVENT_TYPES));
    expect(FEED_KINDS).toEqual(['account', 'invitation']);
  });

  it('keeps the CHANGE_* fence: known to the store, not rendered here', () => {
    expect(EVENT_TYPES).toHaveLength(10);
    expect(FEED_RENDERED_EVENT_TYPES).toHaveLength(7);
    for (const type of EVENT_TYPES) {
      if ((String(type) as string).startsWith('CHANGE_')) {
        expect(isFeedRenderedEventType(type)).toBe(false);
      } else {
        expect(isFeedRenderedEventType(type)).toBe(true);
      }
    }
  });
});

// ─── i18n keys ───────────────────────────────────────────

describe('i18n keys', () => {
  it('gives every rendered type a distinct key under activityFeed.items', () => {
    const envelopeByType: Record<(typeof FEED_RENDERED_EVENT_TYPES)[number], EventEnvelope> = {
      ACCOUNT_PENDING_CREATED: buildAccountPendingCreatedEvent('user_reg'),
      ACCOUNT_ACTIVATED: buildAccountActivatedEvent('user_owner', 'user_reg'),
      ACCOUNT_DISABLED: buildAccountDisabledEvent('user_owner', 'user_x'),
      ACCOUNT_ENABLED: buildAccountEnabledEvent('user_owner', 'user_x'),
      INVITATION_CREATED: invitationCreatedEnvelope(),
      INVITATION_USED: invitationUsedEnvelope('success'),
      INVITATION_REVOKED: buildInvitationRevokedEvent({
        actorUserId: 'user_owner',
        familyTreeId: 'tree_1',
        invitationId: 'inv_123',
        invitationType: 'personal',
      }),
    };
    const keys = FEED_RENDERED_EVENT_TYPES.map((type) =>
      projectEventToFeedItem(source(`evt_${type}`, envelopeByType[type])).i18nKey,
    );
    expect(keys.every((key) => key.startsWith('activityFeed.items.'))).toBe(true);
    expect(new Set(keys).size).toBe(FEED_RENDERED_EVENT_TYPES.length);
  });

  it('drops a CHANGE_PROPOSED envelope in projectFeedItems instead of throwing', () => {
    const changeEnvelope = buildChangeProposedEvent({
      actorUserId: 'user_editor',
      familyTreeId: 'tree_1',
      proposalId: 'prop_1',
      targetType: 'member',
    });
    const items = projectFeedItems([
      source('evt_p1', invitationCreatedEnvelope(), new Date('2026-08-24T05:00:00.000Z')),
      source('evt_p2', changeEnvelope, new Date('2026-08-24T06:00:00.000Z')),
    ]);
    expect(items.map((item) => item.id)).toEqual(['evt_p1']);
    expect(() => projectEventToFeedItem(source('evt_p2', changeEnvelope))).toThrow(
      /event type is not rendered in the feed/,
    );
  });
});

// ─── Type filter builder ─────────────────────────────────

describe('type filter builder', () => {
  it('accepts all plus the seven event types and refuses anything else', () => {
    for (const selection of FEED_TYPE_SELECTIONS) {
      expect(isFeedTypeSelection(selection)).toBe(true);
    }
    expect(isFeedTypeSelection('ACCOUNT_DELETED')).toBe(false);
    expect(isFeedTypeSelection('')).toBe(false);
    expect(isFeedTypeSelection(undefined)).toBe(false);
    expect(isFeedTypeSelection(42)).toBe(false);
  });

  it('resolves "all" to a null filter and a type to a single-entry list', () => {
    expect(resolveFeedTypeFilter('all')).toBeNull();
    expect(resolveFeedTypeFilter('INVITATION_USED')).toEqual(['INVITATION_USED']);
  });

  it('applies the resolved filter and keeps everything on null', () => {
    const items = projectFeedItems([
      source('evt_n1', buildAccountPendingCreatedEvent('user_reg'), new Date('2026-08-24T05:00:00.000Z')),
      source('evt_n2', invitationCreatedEnvelope(), new Date('2026-08-24T04:00:00.000Z')),
    ]);
    expect(applyFeedTypeFilter(items, resolveFeedTypeFilter('INVITATION_CREATED')).map((item) => item.id)).toEqual([
      'evt_n2',
    ]);
    expect(applyFeedTypeFilter(items, resolveFeedTypeFilter('all')).map((item) => item.id)).toEqual([
      'evt_n1',
      'evt_n2',
    ]);
  });
});

// ─── Sorting ─────────────────────────────────────────────

describe('sortFeedItemsNewestFirst', () => {
  it('sorts newest first and breaks timestamp ties by id descending', () => {
    const items = [
      projectEventToFeedItem(source('evt_z', buildAccountPendingCreatedEvent('u'), new Date('2026-08-24T04:00:00.000Z'))),
      projectEventToFeedItem(source('evt_y', invitationCreatedEnvelope(), new Date('2026-08-25T04:00:00.000Z'))),
      projectEventToFeedItem(source('evt_x', buildAccountEnabledEvent('o', 'u'), new Date('2026-08-24T04:00:00.000Z'))),
    ];
    const sorted = sortFeedItemsNewestFirst(items);
    expect(sorted.map((item) => item.id)).toEqual(['evt_y', 'evt_z', 'evt_x']);
  });

  it('projectFeedItems returns projected sources already sorted', () => {
    const sorted = projectFeedItems([
      source('evt_s1', buildAccountPendingCreatedEvent('u'), new Date('2026-08-20T04:00:00.000Z')),
      source('evt_s2', invitationCreatedEnvelope(), new Date('2026-08-22T04:00:00.000Z')),
    ]);
    expect(sorted.map((item) => item.id)).toEqual(['evt_s2', 'evt_s1']);
  });
});
