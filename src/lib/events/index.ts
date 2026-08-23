// Pure event-store contracts for P2-2 (append-only event store).
//
// This module is intentionally free of I/O: no database, no HTTP, no React.
// It defines the v1 event vocabulary, the payload contract, the builders the
// server uses to state a fact, the PII validator every payload must pass, and
// the projections that derive P2-1 notifications from an emitted event. The
// binding design record is docs/decisions/0003-event-store.md.

// ─── Event vocabulary (v1 + P2-3) ────────────────────────
//
// Seven event types ship after P2-3: the four account administration
// facts from v1 plus the three invitation lifecycle facts. Adding a type
// is a contract change: bump the vocabulary here, extend the exhaustive
// switch in the projectors, and record it in the ADR (0003 for v1, 0004
// for invitations).

export const EVENT_TYPES = [
  'ACCOUNT_PENDING_CREATED',
  'ACCOUNT_ACTIVATED',
  'ACCOUNT_DISABLED',
  'ACCOUNT_ENABLED',
  'INVITATION_CREATED',
  'INVITATION_USED',
  'INVITATION_REVOKED',
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export function isEventType(value: unknown): value is EventType {
  return typeof value === 'string' && (EVENT_TYPES as readonly string[]).includes(value);
}

// ─── Payload contract (v1 + P2-3) ────────────────────────
//
// Every account payload carries exactly one technical key: subjectUserId,
// the id of the account the fact is about. Invitation payloads carry the
// invitation's technical ids and policy stamps; the recipient's contact
// data is refused everywhere. The actor and the family tree are envelope
// columns, not payload keys, so they can be indexed and filtered without
// parsing JSON.
//
// Known payload keys per type (exhaustive):
//   ACCOUNT_PENDING_CREATED  subjectUserId (the registrant, self-registered)
//   ACCOUNT_ACTIVATED        subjectUserId (the account an owner approved)
//   ACCOUNT_DISABLED         subjectUserId (the account an owner disabled)
//   ACCOUNT_ENABLED          subjectUserId (the account an owner restored)
//   INVITATION_CREATED       invitationId, invitationType, channel,
//                            grantedRole, expiresAt, maxUses
//   INVITATION_USED          invitationId, invitationType, result,
//                            reason (failure code), subjectUserId (nullable)
//   INVITATION_REVOKED       invitationId, invitationType
//
// Anything beyond the keys above is rejected by validateEventPayload.

import type { InvitationType, TreeRole } from '../invitations';

export interface AccountEventPayload {
  /** Technical id of the account the fact is about. Never contact data. */
  subjectUserId: string;
}

/** An owner minted an invitation link for one tree (P2-3, ADR 0004). */
export interface InvitationCreatedPayload {
  invitationId: string;
  invitationType: InvitationType;
  /** How the owner plans to hand the link over: manual, wa, email. Data only. */
  channel: string;
  grantedRole: TreeRole;
  /** ISO timestamp; mirrors the invitation row's expiresAt. */
  expiresAt: string;
  maxUses: number;
}

/**
 * A registration attempt met an invitation token (P2-3, ADR 0004).
 * result "failure" carries the honest reason code (for example
 * INVITATION_EXPIRED) and a null subjectUserId: no account was created.
 * result "success" carries the id of the account that consumed the link.
 */
export interface InvitationUsedPayload {
  invitationId: string;
  invitationType: InvitationType;
  result: 'success' | 'failure';
  reason?: string;
  subjectUserId: string | null;
}

/** An owner revoked a live invitation (P2-3, ADR 0004). */
export interface InvitationRevokedPayload {
  invitationId: string;
  invitationType: InvitationType;
}

export type EventPayload =
  | AccountEventPayload
  | InvitationCreatedPayload
  | InvitationUsedPayload
  | InvitationRevokedPayload;

export interface EventEnvelope {
  type: EventType;
  /** Account that performed the action, or null for system actions. */
  actorUserId: string | null;
  /** Family tree the fact is scoped to, or null for installation-wide facts. */
  familyTreeId: string | null;
  payload: EventPayload;
}

export interface AccountEventEnvelope {
  type: Extract<EventType, 'ACCOUNT_PENDING_CREATED' | 'ACCOUNT_ACTIVATED' | 'ACCOUNT_DISABLED' | 'ACCOUNT_ENABLED'>;
  actorUserId: string | null;
  familyTreeId: null;
  payload: AccountEventPayload;
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

// ─── Invitation builders (P2-3, ADR 0004) ────────────────
//
// familyTreeId is the invitation's tree, read from the invitation row by
// the caller and recorded in the envelope column, never in the payload.

export interface InvitationCreatedEventInput {
  actorUserId: string;
  familyTreeId: string;
  invitationId: string;
  invitationType: InvitationType;
  channel: string;
  grantedRole: TreeRole;
  expiresAt: Date;
  maxUses: number;
}

/** An owner minted an invitation link for one tree. */
export function buildInvitationCreatedEvent(input: InvitationCreatedEventInput): EventEnvelope {
  return {
    type: 'INVITATION_CREATED',
    actorUserId: input.actorUserId,
    familyTreeId: input.familyTreeId,
    payload: {
      invitationId: input.invitationId,
      invitationType: input.invitationType,
      channel: input.channel,
      grantedRole: input.grantedRole,
      expiresAt: input.expiresAt.toISOString(),
      maxUses: input.maxUses,
    },
  };
}

export interface InvitationUsedEventInput {
  /**
   * The registrant on success (the new account), null on failure: a dead
   * token never has an actor account to name.
   */
  actorUserId: string | null;
  familyTreeId: string;
  invitationId: string;
  invitationType: InvitationType;
  result: 'success' | 'failure';
  /** Honest reason code, required on failure, absent on success. */
  reason?: string;
  subjectUserId: string | null;
}

/** A registration attempt met an invitation token, successfully or not. */
export function buildInvitationUsedEvent(input: InvitationUsedEventInput): EventEnvelope {
  const payload: InvitationUsedPayload = {
    invitationId: input.invitationId,
    invitationType: input.invitationType,
    result: input.result,
    subjectUserId: input.subjectUserId,
  };
  if (input.result === 'failure') {
    payload.reason = input.reason ?? 'INVITATION_REJECTED';
  }
  return {
    type: 'INVITATION_USED',
    actorUserId: input.actorUserId,
    familyTreeId: input.familyTreeId,
    payload,
  };
}

export interface InvitationRevokedEventInput {
  actorUserId: string;
  familyTreeId: string;
  invitationId: string;
  invitationType: InvitationType;
}

/** An owner revoked a live invitation. */
export function buildInvitationRevokedEvent(input: InvitationRevokedEventInput): EventEnvelope {
  return {
    type: 'INVITATION_REVOKED',
    actorUserId: input.actorUserId,
    familyTreeId: input.familyTreeId,
    payload: {
      invitationId: input.invitationId,
      invitationType: input.invitationType,
    },
  };
}

// ─── PII validator ───────────────────────────────────────
//
// The event store is an audit log that outlives consent withdrawals, so it
// must hold the minimum needed to reconstruct facts. Technical user ids are
// allowed; third-party contact data (phone numbers, messaging handles,
// emails) is refused. The list is normalized (lowercase, separators
// stripped) before comparison so "phone_number" and "PhoneNumber" are caught
// as "phonenumber". P2-3 extends the refusal to recipient-specific contact
// keys: an invitation must never log who received the link, only that the
// link exists and what happened to it.

const FORBIDDEN_PAYLOAD_KEYS = [
  'phone',
  'phonenumber',
  'number',
  'wa',
  'whatsapp',
  'nomor',
  'email',
  'recipient',
  'recipientphone',
  'recipientemail',
  'recipientname',
  'penerima',
  'contact',
  'contactdetail',
] as const;

/** Allowed payload keys per event type, normalized (lowercase, separators stripped). */
const KNOWN_PAYLOAD_KEYS_BY_TYPE: Readonly<Record<EventType, readonly string[]>> = {
  ACCOUNT_PENDING_CREATED: ['subjectuserid'],
  ACCOUNT_ACTIVATED: ['subjectuserid'],
  ACCOUNT_DISABLED: ['subjectuserid'],
  ACCOUNT_ENABLED: ['subjectuserid'],
  INVITATION_CREATED: ['invitationid', 'invitationtype', 'channel', 'grantedrole', 'expiresat', 'maxuses'],
  INVITATION_USED: ['invitationid', 'invitationtype', 'result', 'reason', 'subjectuserid'],
  INVITATION_REVOKED: ['invitationid', 'invitationtype'],
};

export type PayloadValidation =
  | { ok: true }
  | { ok: false; reason: string };

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[\s_-]/g, '');
}

/**
 * Checks a payload object against the contract for the given event type.
 *
 * Refused: third-party contact keys (see FORBIDDEN_PAYLOAD_KEYS), unknown
 * keys outside the documented contract, and empty values (empty string,
 * null, undefined), which would smuggle optional fields into the store.
 * One documented exception: INVITATION_USED carries a nullable
 * subjectUserId, because a failed attempt creates no account.
 * Semantic rule: reason is required when result is "failure" and refused
 * when result is "success", so the audit log cannot drift from the fact.
 */
export function validateEventPayload(type: EventType, payload: unknown): PayloadValidation {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    return { ok: false, reason: 'payload must be a plain object' };
  }
  const knownKeys = KNOWN_PAYLOAD_KEYS_BY_TYPE[type];
  const nullableSubject = type === 'INVITATION_USED';
  let hasReason = false;
  for (const [key, value] of Object.entries(payload)) {
    const normalized = normalizeKey(key);
    if ((FORBIDDEN_PAYLOAD_KEYS as readonly string[]).includes(normalized)) {
      return { ok: false, reason: `payload key "${key}" is refused: contact data of third parties must not enter the event store` };
    }
    if (!knownKeys.includes(normalized)) {
      return { ok: false, reason: `payload key "${key}" is not part of the ${type} contract` };
    }
    if (normalized === 'subjectuserid' && nullableSubject && value === null) {
      continue;
    }
    if (typeof value !== 'string' && typeof value !== 'number') {
      return { ok: false, reason: `payload key "${key}" must be a non-empty string or number` };
    }
    if (typeof value === 'string' && value === '') {
      return { ok: false, reason: `payload key "${key}" must not be empty` };
    }
    if (typeof value === 'number' && !Number.isFinite(value)) {
      return { ok: false, reason: `payload key "${key}" must be a finite number` };
    }
    if (normalized === 'reason') hasReason = true;
  }
  if (type === 'INVITATION_USED') {
    const resultValue = (payload as { result?: unknown }).result;
    if (resultValue !== 'success' && resultValue !== 'failure') {
      return { ok: false, reason: 'payload key "result" must be "success" or "failure"' };
    }
    if (resultValue === 'failure' && !hasReason) {
      return { ok: false, reason: 'payload key "reason" is required when result is "failure"' };
    }
    if (resultValue === 'success' && hasReason) {
      return { ok: false, reason: 'payload key "reason" must be omitted when result is "success"' };
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
