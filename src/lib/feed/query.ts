// Pure query-layer helpers for the activity-feed endpoint (P2-6 AC-2,
// AC-3). Parses and validates the query string (?type= ?limit= ?before=),
// encodes and decodes the pagination cursor, and decides feed visibility
// per the v1 scope. Free of I/O on purpose: the endpoint stays a thin
// shell over these decisions, and every rule here is unit-testable.
//
// v1 scope (ADR 0006, consistent with the ADR 0002 role matrix):
//   (a) events scoped to a tree the viewer is a TreeMember of, any role
//       may read (viewer included)
//   (b) account events that concern the viewer: payload.subjectUserId or
//       actorUserId equals the viewer id
// Account events about somebody else never enter the feed. Invitation
// events outside the viewer's trees stay out too, even when the viewer
// once acted on them: membership, recorded now, is the ticket.

import {
  EVENT_TYPES,
  isEventType,
  parseEventPayload,
  type AccountEventPayload,
  type EventEnvelope,
  type EventType,
} from '../events';
import { feedKindOfEventType, isFeedRenderedEventType, type FeedItem } from './feed';

// ─── Limits ──────────────────────────────────────────────

export const FEED_LIMIT_DEFAULT = 50;
export const FEED_LIMIT_MIN = 1;
export const FEED_LIMIT_MAX = 100;

// ─── Cursor ──────────────────────────────────────────────
//
// The cursor is the (createdAt, id) tuple of the last item on the page,
// base64url-encoded with a "|" separator. Pagination is keyset style: the
// next page returns events strictly older than the tuple, so re-reading a
// cursor is idempotent and a new event landing between two pages can
// neither duplicate nor skip rows.

const CURSOR_SEPARATOR = '|';
const B64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

function base64UrlEncode(text: string): string {
  let out = '';
  for (let i = 0; i < text.length; i += 3) {
    const b0 = text.charCodeAt(i);
    const b1 = i + 1 < text.length ? text.charCodeAt(i + 1) : undefined;
    const b2 = i + 2 < text.length ? text.charCodeAt(i + 2) : undefined;
    out += B64_ALPHABET[b0 >> 2]!;
    out += B64_ALPHABET[((b0 & 0x3) << 4) | ((b1 ?? 0) >> 4)]!;
    if (b1 === undefined) break;
    out += B64_ALPHABET[((b1 & 0x0f) << 2) | ((b2 ?? 0) >> 6)]!;
    if (b2 === undefined) break;
    out += B64_ALPHABET[b2 & 0x3f]!;
  }
  return out;
}

function base64UrlDecode(text: string): string | null {
  const bits: number[] = [];
  for (const ch of text) {
    const value = B64_ALPHABET.indexOf(ch);
    if (value === -1) return null;
    bits.push(value);
  }
  let out = '';
  for (let i = 0; i < bits.length; i += 4) {
    const n0 = bits[i]!;
    const n1 = bits[i + 1];
    const n2 = bits[i + 2];
    const n3 = bits[i + 3];
    if (n1 === undefined) return null; // a dangling 6-bit group encodes nothing
    out += String.fromCharCode((n0 << 2) | (n1 >> 4));
    if (n2 === undefined) break;
    out += String.fromCharCode(((n1 & 0x0f) << 4) | (n2 >> 2));
    if (n3 === undefined) break;
    out += String.fromCharCode(((n2 & 0x03) << 6) | n3!);
  }
  return out;
}

/** Encodes a page's last item into an opaque pagination cursor. */
export function encodeFeedCursor(item: Pick<FeedItem, 'id' | 'createdAt'>): string {
  return base64UrlEncode(`${item.createdAt}${CURSOR_SEPARATOR}${item.id}`);
}

export type FeedCursor =
  | { ok: true; createdAt: string; id: string }
  | { ok: false };

/** Decodes a cursor back into its (createdAt, id) tuple, or refuses it. */
export function decodeFeedCursor(value: string): FeedCursor {
  const decoded = base64UrlDecode(value);
  if (decoded === null) return { ok: false };
  const separatorAt = decoded.indexOf(CURSOR_SEPARATOR);
  if (separatorAt <= 0) return { ok: false };
  const createdAt = decoded.slice(0, separatorAt);
  const id = decoded.slice(separatorAt + CURSOR_SEPARATOR.length);
  if (id === '') return { ok: false };
  const asDate = new Date(createdAt);
  if (Number.isNaN(asDate.getTime())) return { ok: false };
  if (asDate.toISOString() !== createdAt) return { ok: false };
  return { ok: true, createdAt, id };
}

// ─── Query parsing ───────────────────────────────────────

export interface ActivityFeedQueryInput {
  type?: unknown;
  limit?: unknown;
  before?: unknown;
}

export type ActivityFeedQuery =
  | {
      ok: true;
      typeFilter: EventType[] | null;
      limit: number;
      before: { createdAt: string; id: string } | null;
    }
  | { ok: false; code: 'VALIDATION_ERROR' | 'INVALID_CURSOR'; message: string };

/**
 * Parses the query string honestly:
 *   - type: one of the seven v1 EVENT_TYPES, or absent for no filter.
 *     Anything else (including "all") is a 400, never a silent ignore.
 *   - limit: integer, clamped into 1..100, default 50.
 *   - before: a cursor from a previous response, or absent.
 */
export function parseActivityFeedQuery(input: ActivityFeedQueryInput): ActivityFeedQuery {
  let typeFilter: EventType[] | null = null;
  if (input.type !== undefined) {
    if (typeof input.type !== 'string' || !isEventType(input.type)) {
      return { ok: false, code: 'VALIDATION_ERROR', message: 'Unknown activity type filter' };
    }
    typeFilter = [input.type];
  }

  let limit = FEED_LIMIT_DEFAULT;
  if (input.limit !== undefined) {
    if (typeof input.limit !== 'string' || input.limit.trim() === '') {
      return { ok: false, code: 'VALIDATION_ERROR', message: 'limit must be an integer between 1 and 100' };
    }
    const parsed = Number(input.limit.trim());
    if (!Number.isInteger(parsed)) {
      return { ok: false, code: 'VALIDATION_ERROR', message: 'limit must be an integer between 1 and 100' };
    }
    limit = Math.min(FEED_LIMIT_MAX, Math.max(FEED_LIMIT_MIN, parsed));
  }

  let before: { createdAt: string; id: string } | null = null;
  if (input.before !== undefined) {
    if (typeof input.before !== 'string' || input.before === '') {
      return { ok: false, code: 'INVALID_CURSOR', message: 'before must be a cursor from a previous response' };
    }
    const cursor = decodeFeedCursor(input.before);
    if (!cursor.ok) {
      return { ok: false, code: 'INVALID_CURSOR', message: 'before must be a cursor from a previous response' };
    }
    before = { createdAt: cursor.createdAt, id: cursor.id };
  }

  return { ok: true, typeFilter, limit, before };
}

// ─── Visibility ──────────────────────────────────────────

/** The viewer reduced to what the scope rules need: id plus member trees. */
export interface FeedViewer {
  readonly id: string;
  readonly treeIds: readonly string[];
}

/**
 * True when the event is inside the viewer's v1 scope:
 * a tree event of a tree they are a member of (any role), or an account
 * event that concerns them as subject or actor. Pure; the endpoint feeds
 * it the viewer's TreeMember tree ids.
 */
export function isEventVisibleInFeed(event: EventEnvelope, viewer: FeedViewer): boolean {
  if (event.familyTreeId !== null && viewer.treeIds.includes(event.familyTreeId)) return true;
  // The fence keeps this total: a CHANGE_* fact with no tree (impossible
  // today) reads as not-account instead of throwing (ADR 0009).
  if (!isFeedRenderedEventType(event.type) || feedKindOfEventType(event.type) !== 'account') return false;
  const payload = event.payload as AccountEventPayload;
  return payload.subjectUserId === viewer.id || event.actorUserId === viewer.id;
}

// ─── Row projection ──────────────────────────────────────

/** A raw Event row straight from the store, before projection. */
export interface StoredFeedEventRow {
  readonly id: string;
  readonly type: string;
  readonly actorUserId: string | null;
  readonly familyTreeId: string | null;
  readonly payloadJson: string;
  readonly createdAt: Date | string;
}

/**
 * Parses one stored row into a FeedSourceEvent for the projector.
 * Returns null when the row's type or payload fails the P2-2 contract
 * (only possible for rows written outside the gate): a broken row is
 * skipped, never surfaced and never leaked.
 */
export function parseStoredEventRow(row: StoredFeedEventRow): { id: string; createdAt: Date | string; envelope: EventEnvelope } | null {
  if (!isEventType(row.type)) return null;
  const payload = parseEventPayload(row.payloadJson);
  if (payload === null || typeof payload !== 'object') return null;
  return {
    id: row.id,
    createdAt: row.createdAt,
    envelope: {
      type: row.type,
      actorUserId: row.actorUserId,
      familyTreeId: row.familyTreeId,
      payload: payload as EventEnvelope['payload'],
    },
  };
}

/**
 * The account event types, for the endpoint's subject-user clause. The
 * rendered-event fence runs first: CHANGE_* types are in the vocabulary
 * but feedKindOfEventType refuses them by design (ADR 0009).
 */
export const ACCOUNT_EVENT_TYPES: readonly EventType[] = EVENT_TYPES.filter(
  (type) => isFeedRenderedEventType(type) && feedKindOfEventType(type) === 'account',
);
