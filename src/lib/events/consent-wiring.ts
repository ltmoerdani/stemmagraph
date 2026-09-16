// Pure consent event wiring helpers (S-09a-ii, ADR 0012).
//
// S-09a-i shipped the vocabulary, the builder, and the payload validator.
// This module adds the two pieces the endpoint layer needs to turn a
// committed ledger row into an audit fact plus an owner notification,
// while staying free of I/O: no database, no HTTP, no server import.
// The server supplies the sink (the appendEvent gate plus the
// Notification table) and this module supplies the order and the
// checks: validate the payload, append the fact, then derive the
// notification drafts from the event itself so the projection cannot
// drift from what was logged.

import type { ConsentRecord } from '../consent/record';
import { buildConsentEvent, validateConsentEvent } from './consent';
import type { EventEnvelope } from './index';

/** Notification shape handed to the persistence layer; id, readAt, and createdAt belong to the store. */
export interface ConsentNotificationDraft {
  userId: string;
  type: 'CONSENT_GRANTED' | 'CONSENT_REVOKED';
  payloadJson: string;
}

/** Audience for the notification fan-out. */
export interface ConsentNotificationAudience {
  treeOwners: readonly { id: string }[];
}

/**
 * Derives in-app notifications for the tree's owners from one consent
 * event. The actor already knows the decision they just recorded, so
 * they are excluded, mirroring the change-review fan-out. The draft
 * payload copies the event's own four contract keys, so the
 * notification can never carry more than the audit fact. An envelope
 * that is not a consent fact, is not scoped to a tree, or fails the
 * S-09a-i payload validator is refused outright: the projection would
 * otherwise silently log nothing while claiming the owners were told.
 */
export function projectConsentNotifications(
  event: EventEnvelope,
  audience: ConsentNotificationAudience,
): ConsentNotificationDraft[] {
  if (event.type !== 'CONSENT_GRANTED' && event.type !== 'CONSENT_REVOKED') {
    throw new Error(`projectConsentNotifications expects CONSENT_GRANTED or CONSENT_REVOKED, got ${event.type}`);
  }
  if (event.familyTreeId === null) {
    throw new Error('consent events are always scoped to a tree, got null familyTreeId');
  }
  if (!validateConsentEvent(event.payload)) {
    throw new Error('projectConsentNotifications refuses an envelope whose payload fails validateConsentEvent');
  }
  const payloadJson = JSON.stringify(event.payload);
  return audience.treeOwners
    .filter((owner) => owner.id !== event.actorUserId)
    .map((owner) => ({ userId: owner.id, type: event.type, payloadJson }));
}

/**
 * The outbound side of the wiring. The server binds these to the real
 * event store gate (server/events.ts appendEvent) and the Notification
 * table; tests bind them to spies. Keeping the calls behind this
 * interface is what lets the whole flow be exercised without a
 * listening server.
 */
export interface ConsentEventSink {
  appendEvent(envelope: EventEnvelope): Promise<unknown>;
  createNotifications(drafts: readonly ConsentNotificationDraft[]): Promise<unknown>;
}

/** The ledger row plus the envelope columns the fact needs. */
export interface ConsentEmitInput {
  /** The committed ConsentRecord; consentId and occurredAt derive from it. */
  record: Pick<ConsentRecord, 'id' | 'memberId' | 'action' | 'at'>;
  /** Family tree the member belongs to; the envelope column, not payload. */
  treeId: string;
  /** Account that recorded the decision; null when the system recorded it. */
  actorId: string | null;
  /** Owner audience for the notification fan-out. */
  owners: readonly { id: string }[];
}

/** What one successful emission produced; returned for logging and tests. */
export interface ConsentEmitSuccess {
  ok: true;
  event: EventEnvelope;
  drafts: ConsentNotificationDraft[];
}

/** What a failed emission reports; the error is carried, never swallowed silently. */
export interface ConsentEmitFailure {
  ok: false;
  error: unknown;
}

export type ConsentEmitResult = ConsentEmitSuccess | ConsentEmitFailure;

/**
 * Turns one committed consent ledger row into an audit fact and owner
 * notifications, in that order. The payload is validated before the
 * append is attempted: a row that cannot produce a contract-clean
 * payload (empty id, unknown action, unparseable timestamp) throws here
 * and never reaches the store, and no notification is derived. An
 * empty audience skips the notification write entirely; the fact is
 * still appended.
 */
export async function emitConsentEvent(
  input: ConsentEmitInput,
  sink: ConsentEventSink,
): Promise<ConsentEmitSuccess> {
  const event = buildConsentEvent({
    consentId: input.record.id,
    actorId: input.actorId,
    memberId: input.record.memberId,
    treeId: input.treeId,
    action: input.record.action,
    occurredAt: input.record.at,
  });
  if (!validateConsentEvent(event.payload)) {
    throw new Error(
      `consent event refused by validateConsentEvent for ledger row ${String(input.record.id)} (action ${String(input.record.action)})`,
    );
  }
  await sink.appendEvent(event);
  const drafts = projectConsentNotifications(event, { treeOwners: input.owners });
  if (drafts.length > 0) {
    await sink.createNotifications(drafts);
  }
  return { ok: true, event, drafts };
}

/**
 * The resilience boundary the endpoint calls. The ledger row is already
 * the source of truth once the transaction commits, so a failed
 * emission must never fail the POST: this wrapper catches anything the
 * flow above throws or rejects and reports it as a failure result for
 * the caller to log. AC wording it satisfies: a failed emit must not
 * fail the consent POST.
 */
export async function safeEmitConsentEvent(
  input: ConsentEmitInput,
  sink: ConsentEventSink,
): Promise<ConsentEmitResult> {
  try {
    return await emitConsentEvent(input, sink);
  } catch (error) {
    return { ok: false, error };
  }
}
