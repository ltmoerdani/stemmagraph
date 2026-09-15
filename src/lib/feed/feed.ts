// Pure activity-feed projection for P2-6 (application layer over the P2-2
// event store, ADR 0006).
//
// This module is intentionally free of I/O: no database, no HTTP, no React.
// It projects an EventEnvelope into a FeedItem, the display-shaped record
// the dashboard renders. The projection doubles as the consent fence:
// invitation items keep only the channel, the invitation type, the outcome,
// the time and the invitation id. Phone numbers, share message text and
// invitation tokens never pass through: params are rebuilt from whitelisted
// fields per event type, never copied from the raw payload, so even a
// legacy row that smuggled contact data into its payload cannot leak it
// into a feed item.
//
// Living-person fence (consent clause R-74.6, filter T0e): the v1 payload
// vocabulary above carries no living-person data, only account facts and
// minimized invitation facts. Future tree events that touch a living
// person's record MUST pass the privacy gate before they may be projected
// into a feed item. The fence is the explicit type allowlist in this file:
// a new event type only reaches the feed after it is added here on
// purpose, with its own minimization review and consent filter. The tests
// pin this by feeding a hypothetical person-record event to the projector
// and asserting it is refused, not rendered.

import {
  EVENT_TYPES,
  isEventType,
  type EventEnvelope,
  type EventPayload,
  type EventType,
  type InvitationCreatedPayload,
  type InvitationRevokedPayload,
  type InvitationUsedPayload,
} from '../events';

// ─── Kinds and grouping ──────────────────────────────────
//
// Two coarse groups ship in v1: account administration facts (installation
// wide, subject in the payload) and invitation lifecycle facts (scoped to
// one tree). The grouping drives UI section headers and lets tests assert
// the vocabulary stays partitioned.

export type FeedKind = 'account' | 'invitation';

export const FEED_KINDS: readonly FeedKind[] = ['account', 'invitation'];

const ACCOUNT_FEED_TYPES = [
  'ACCOUNT_PENDING_CREATED',
  'ACCOUNT_ACTIVATED',
  'ACCOUNT_DISABLED',
  'ACCOUNT_ENABLED',
] as const satisfies readonly EventType[];

const INVITATION_FEED_TYPES = [
  'INVITATION_CREATED',
  'INVITATION_USED',
  'INVITATION_REVOKED',
] as const satisfies readonly EventType[];

export const FEED_TYPES_BY_KIND: Readonly<Record<FeedKind, readonly EventType[]>> = {
  account: ACCOUNT_FEED_TYPES,
  invitation: INVITATION_FEED_TYPES,
};

// ─── Rendered-event fence (P2-5, ADR 0009) ───────────────
//
// The event vocabulary grew three change-review types, but the feed keeps
// rendering exactly the seven account and invitation facts: whether a
// CHANGE_* fact deserves a feed item is a separate product decision, and
// until it is made the projector must refuse them the same way it refuses
// any unlisted type. Everything downstream (projection, filters, i18n
// keys) consults this list instead of the raw vocabulary.

/** Event types the feed renders; CHANGE_* stays out pending its own decision. */
export const FEED_RENDERED_EVENT_TYPES: readonly FeedRenderedEventType[] = [
  ...ACCOUNT_FEED_TYPES,
  ...INVITATION_FEED_TYPES,
];
export type FeedRenderedEventType = (typeof ACCOUNT_FEED_TYPES)[number] | (typeof INVITATION_FEED_TYPES)[number];

/** True when the feed projects the type; false for CHANGE_* and anything unknown. */
export function isFeedRenderedEventType(type: EventType): type is FeedRenderedEventType {
  return (FEED_RENDERED_EVENT_TYPES as readonly string[]).includes(type);
}

/** Coarse group of an event type. Throws on values outside the v1 vocabulary. */
export function feedKindOfEventType(type: EventType): FeedKind {
  if ((ACCOUNT_FEED_TYPES as readonly string[]).includes(type)) return 'account';
  if ((INVITATION_FEED_TYPES as readonly string[]).includes(type)) return 'invitation';
  throw new Error(`unknown event type: ${String(type)}`);
}

// ─── FeedItem contract ───────────────────────────────────
//
// Everything the localized label needs, nothing more. i18nKey points into
// the activityFeed object added to common.json (ID and EN in full parity).
// params carries only interpolation values the label template uses.

export interface FeedItem {
  /** Event row id. Doubles as the stable React key and cursor tie-break. */
  readonly id: string;
  /** Coarse group: account or invitation. */
  readonly kind: FeedKind;
  /** Exact event type from the v1 vocabulary. */
  readonly type: EventType;
  /** ISO timestamp of the stored fact. */
  readonly createdAt: string;
  /** Account that performed the action, null for system actions. */
  readonly actorUserId: string | null;
  /** Tree the fact is scoped to, null for installation-wide facts. */
  readonly familyTreeId: string | null;
  /** Key under activityFeed.items in common.json. */
  readonly i18nKey: string;
  /** Minimal interpolation params. Rebuilt per type, never copied. */
  readonly params: Readonly<Record<string, string>>;
}

/** A stored event row reduced to what the pure projector needs. */
export interface FeedSourceEvent {
  readonly id: string;
  readonly createdAt: Date | string;
  readonly envelope: EventEnvelope;
}

const I18N_KEY_BY_TYPE: Readonly<Record<FeedRenderedEventType, string>> = {
  ACCOUNT_PENDING_CREATED: 'activityFeed.items.accountPendingCreated',
  ACCOUNT_ACTIVATED: 'activityFeed.items.accountActivated',
  ACCOUNT_DISABLED: 'activityFeed.items.accountDisabled',
  ACCOUNT_ENABLED: 'activityFeed.items.accountEnabled',
  INVITATION_CREATED: 'activityFeed.items.invitationCreated',
  INVITATION_USED: 'activityFeed.items.invitationUsed',
  INVITATION_REVOKED: 'activityFeed.items.invitationRevoked',
};

function toIsoTimestamp(value: Date | string): string {
  if (value instanceof Date) return value.toISOString();
  return new Date(value).toISOString();
}

// ─── Param minimization ──────────────────────────────────
//
// The exhaustive switch below is the whitelist. Account facts need no
// interpolation at all. Invitation facts keep the invitation id, the
// invitation type and, where the fact is about it, the channel or the
// outcome. subjectUserId, reason, expiresAt, maxUses, grantedRole and any
// key not named here are dropped on the floor.

function buildFeedParams(type: FeedRenderedEventType, payload: EventPayload): Readonly<Record<string, string>> {
  switch (type) {
    case 'ACCOUNT_PENDING_CREATED':
    case 'ACCOUNT_ACTIVATED':
    case 'ACCOUNT_DISABLED':
    case 'ACCOUNT_ENABLED':
      return {};
    case 'INVITATION_CREATED': {
      const invitation = payload as InvitationCreatedPayload;
      return {
        invitationId: invitation.invitationId,
        invitationType: invitation.invitationType,
        channel: invitation.channel,
      };
    }
    case 'INVITATION_USED': {
      const invitation = payload as InvitationUsedPayload;
      return {
        invitationId: invitation.invitationId,
        invitationType: invitation.invitationType,
        result: invitation.result,
      };
    }
    case 'INVITATION_REVOKED': {
      const invitation = payload as InvitationRevokedPayload;
      return {
        invitationId: invitation.invitationId,
        invitationType: invitation.invitationType,
      };
    }
    default:
      throw new Error(`unknown event type: ${String(type)}`);
  }
}

// ─── Projector ───────────────────────────────────────────

/** Projects one stored event into its display-shaped feed item. */
export function projectEventToFeedItem(source: FeedSourceEvent): FeedItem {
  const { type, actorUserId, familyTreeId, payload } = source.envelope;
  // The rendered-event fence: CHANGE_* facts are known to the store but
  // deliberately unrendered here (ADR 0009); anything else unlisted is
  // refused the same way it always was.
  if (!isFeedRenderedEventType(type)) {
    throw new Error(
      isEventType(type)
        ? `event type is not rendered in the feed: ${String(type)}`
        : `unknown event type: ${String(type)}`,
    );
  }
  return {
    id: source.id,
    kind: feedKindOfEventType(type),
    type,
    createdAt: toIsoTimestamp(source.createdAt),
    actorUserId,
    familyTreeId,
    i18nKey: I18N_KEY_BY_TYPE[type],
    params: buildFeedParams(type, payload),
  };
}

/** Projects many stored events and sorts them newest first (id desc on ties). */
export function projectFeedItems(sources: readonly FeedSourceEvent[]): FeedItem[] {
  // The rendered-event fence runs before projection: CHANGE_* rows (and
  // any type outside the fence) are dropped here, never thrown on.
  const rendered = sources.filter((source) => isFeedRenderedEventType(source.envelope.type));
  return sortFeedItemsNewestFirst(rendered.map(projectEventToFeedItem));
}

/** Newest first, stable, id descending on identical timestamps. */
export function sortFeedItemsNewestFirst(items: readonly FeedItem[]): FeedItem[] {
  return [...items].sort((a, b) => {
    if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1;
    if (a.id !== b.id) return a.id < b.id ? 1 : -1;
    return 0;
  });
}

// ─── Type filter builder ─────────────────────────────────
//
// One selection shape serves the query string (?type=) and the dashboard
// dropdown: "all" or a single event type. Unknown values are refused by
// isFeedTypeSelection so the endpoint can answer 400 honestly instead of
// silently ignoring the filter.

export type FeedTypeSelection = 'all' | EventType;

/** True for "all" plus the seven v1 event types, false for anything else. */
export function isFeedTypeSelection(value: unknown): value is FeedTypeSelection {
  return value === 'all' || isEventType(value);
}

/**
 * Resolves a selection into the concrete type list to keep.
 * null means keep everything; the endpoint treats it as no filter.
 */
export function resolveFeedTypeFilter(selection: FeedTypeSelection): readonly EventType[] | null {
  if (selection === 'all') return null;
  return [selection];
}

/** Applies a resolved filter to projected items. A null filter keeps all. */
export function applyFeedTypeFilter(
  items: readonly FeedItem[],
  types: readonly EventType[] | null,
): FeedItem[] {
  if (types === null) return [...items];
  const keep = new Set(types);
  return items.filter((item) => keep.has(item.type));
}

/** The full selection list for UI dropdowns: "all" plus the seven types. */
export const FEED_TYPE_SELECTIONS: readonly FeedTypeSelection[] = ['all', ...EVENT_TYPES];
