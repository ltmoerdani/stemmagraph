// Pure event-store contracts for P2-2 (append-only event store).
//
// This module is intentionally free of I/O: no database, no HTTP, no React.
// It defines the v1 event vocabulary, the payload contract, the builders the
// server uses to state a fact, the PII validator every payload must pass, and
// the projections that derive P2-1 notifications from an emitted event. The
// binding design record is docs/decisions/0003-event-store.md.

// ─── Event vocabulary (v1) ───────────────────────────────
//
// Exactly four event types ship in v1, all scoped to account administration.
// Adding a type is a contract change: bump the vocabulary here, extend the
// exhaustive switch in the projectors, and record it in the ADR.

export const EVENT_TYPES = [
  'ACCOUNT_PENDING_CREATED',
  'ACCOUNT_ACTIVATED',
  'ACCOUNT_DISABLED',
  'ACCOUNT_ENABLED',
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export function isEventType(value: unknown): value is EventType {
  return typeof value === 'string' && (EVENT_TYPES as readonly string[]).includes(value);
}

// ─── Payload contract (v1) ───────────────────────────────
//
// Every v1 payload carries exactly one technical key: subjectUserId, the id
// of the account the fact is about. No contact detail, no display name, no
// free-form text. The actor and the family tree are envelope columns, not
// payload keys, so they can be indexed and filtered without parsing JSON.
//
// Known payload keys per type (exhaustive):
//   ACCOUNT_PENDING_CREATED  subjectUserId (the registrant, self-registered)
//   ACCOUNT_ACTIVATED        subjectUserId (the account an owner approved)
//   ACCOUNT_DISABLED         subjectUserId (the account an owner disabled)
//   ACCOUNT_ENABLED          subjectUserId (the account an owner restored)
//
// Anything beyond the keys above is rejected by validateEventPayload.

export interface EventPayload {
  /** Technical id of the account the fact is about. Never contact data. */
  subjectUserId: string;
}

export interface AccountEventEnvelope {
  type: EventType;
  /** Account that performed the action, or null for system actions. */
  actorUserId: string | null;
  /** Family tree the fact is scoped to, or null for installation-wide facts. */
  familyTreeId: string | null;
  payload: EventPayload;
}

// ─── Builders ────────────────────────────────────────────
//
// One builder per event type. The server never assembles an envelope by
// hand, so every emitted event passes through the contract below.

/** A registration was created and is waiting for owner activation. */
export function buildAccountPendingCreatedEvent(subjectUserId: string): AccountEventEnvelope {
  return { type: 'ACCOUNT_PENDING_CREATED', actorUserId: subjectUserId, familyTreeId: null, payload: { subjectUserId } };
}

/** An owner approved a registration; the account is now usable. */
export function buildAccountActivatedEvent(actorUserId: string, subjectUserId: string): AccountEventEnvelope {
  return { type: 'ACCOUNT_ACTIVATED', actorUserId, familyTreeId: null, payload: { subjectUserId } };
}

/** An owner disabled an account. */
export function buildAccountDisabledEvent(actorUserId: string, subjectUserId: string): AccountEventEnvelope {
  return { type: 'ACCOUNT_DISABLED', actorUserId, familyTreeId: null, payload: { subjectUserId } };
}

/** An owner restored a previously disabled account. */
export function buildAccountEnabledEvent(actorUserId: string, subjectUserId: string): AccountEventEnvelope {
  return { type: 'ACCOUNT_ENABLED', actorUserId, familyTreeId: null, payload: { subjectUserId } };
}

// ─── PII validator ───────────────────────────────────────
//
// The event store is an audit log that outlives consent withdrawals, so it
// must hold the minimum needed to reconstruct facts. Technical user ids are
// allowed; third-party contact data (phone numbers, messaging handles,
// emails) is refused. The list is normalized (lowercase, separators
// stripped) before comparison so "phone_number" and "PhoneNumber" are caught
// as "phonenumber".

const FORBIDDEN_PAYLOAD_KEYS = [
  'phone',
  'phonenumber',
  'number',
  'wa',
  'whatsapp',
  'nomor',
  'email',
] as const;

const KNOWN_PAYLOAD_KEYS = ['subjectuserid'] as const;

export type PayloadValidation =
  | { ok: true }
  | { ok: false; reason: string };

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[\s_-]/g, '');
}

/**
 * Checks a payload object against the v1 contract.
 *
 * Refused: third-party contact keys (see FORBIDDEN_PAYLOAD_KEYS), unknown
 * keys outside the documented contract, and empty values (empty string,
 * null, undefined), which would smuggle optional fields into the store.
 */
export function validateEventPayload(payload: unknown): PayloadValidation {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    return { ok: false, reason: 'payload must be a plain object' };
  }
  for (const [key, value] of Object.entries(payload)) {
    const normalized = normalizeKey(key);
    if ((FORBIDDEN_PAYLOAD_KEYS as readonly string[]).includes(normalized)) {
      return { ok: false, reason: `payload key "${key}" is refused: contact data of third parties must not enter the event store` };
    }
    if (!(KNOWN_PAYLOAD_KEYS as readonly string[]).includes(normalized)) {
      return { ok: false, reason: `payload key "${key}" is not part of the v1 contract` };
    }
    if (typeof value !== 'string' || value === '') {
      return { ok: false, reason: `payload key "${key}" must be a non-empty string` };
    }
  }
  return { ok: true };
}

// ─── Canonical JSON ──────────────────────────────────────
//
// Builders construct payloads with a single key, so JSON.stringify is
// canonical by construction. These helpers keep serialization and parsing
// in one place for the round-trip guarantee tested below.

export function serializeEventPayload(payload: EventPayload): string {
  return JSON.stringify(payload);
}

export function parseEventPayload(json: string): unknown {
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

// ─── Projections to P2-1 notifications ───────────────────
//
// The Notification table is a projection, not a second log. The server
// writes the fact first (appendEvent), then derives notification rows from
// the returned event object. Display data (email, name) comes from the
// user record, never from the event payload.

import {
  buildAccountActivatedNotification,
  buildAccountPendingCreatedNotification,
  type AccountNotificationDraft,
  type PendingAccountSubject,
} from '../account-states/index';

/**
 * Fans a PENDING_CREATED event out to every active owner.
 * The subject supplies display data (email, name) from the user record;
 * subjectUserId is read from the event payload so the projection cannot
 * drift from the logged fact.
 */
export function projectPendingCreatedNotifications(
  event: AccountEventEnvelope,
  activeOwners: readonly { id: string }[],
  subject: PendingAccountSubject,
): AccountNotificationDraft[] {
  if (event.type !== 'ACCOUNT_PENDING_CREATED') {
    throw new Error(`projectPendingCreatedNotifications expects ACCOUNT_PENDING_CREATED, got ${event.type}`);
  }
  if (event.payload.subjectUserId !== subject.id) {
    throw new Error('subject.id does not match event.payload.subjectUserId');
  }
  return activeOwners.map((owner) =>
    buildAccountPendingCreatedNotification(owner.id, {
      id: event.payload.subjectUserId,
      email: subject.email,
      name: subject.name,
    }),
  );
}

/**
 * Derives the in-app notification for the activated account from the event.
 * Used for both ACCOUNT_ACTIVATED and ACCOUNT_ENABLED: P2-1 notifies the
 * user with ACCOUNT_ACTIVATED in both cases, and that external behavior
 * stays unchanged.
 */
export function projectAccountActivatedNotification(
  event: AccountEventEnvelope,
): AccountNotificationDraft {
  if (event.type !== 'ACCOUNT_ACTIVATED' && event.type !== 'ACCOUNT_ENABLED') {
    throw new Error(`projectAccountActivatedNotification expects ACCOUNT_ACTIVATED or ACCOUNT_ENABLED, got ${event.type}`);
  }
  return buildAccountActivatedNotification(event.payload.subjectUserId);
}
