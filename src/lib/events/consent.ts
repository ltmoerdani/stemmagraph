// Pure consent event helpers (S-09a-i, ADR 0012).
//
// This module bridges the consent ledger (src/lib/consent, S-06a) and the
// event vocabulary (./index). It stays free of I/O: no database, no HTTP,
// no server import. The server wires these functions into appendEvent in
// a later task; nothing here may reach past the pure boundary.

import type { ConsentEventAction, ConsentEventPayload, EventEnvelope } from './index';

/** The event type a consent action maps to (regrant is a grant again). */
export function consentEventType(action: ConsentEventAction): 'CONSENT_GRANTED' | 'CONSENT_REVOKED' {
  return action === 'revoke' ? 'CONSENT_REVOKED' : 'CONSENT_GRANTED';
}

export interface ConsentEventInput {
  /** Id of the consent ledger row (ConsentRecord.id) this fact derives from. */
  consentId: string;
  /** Account that recorded the decision; null when the system recorded it. */
  actorId: string | null;
  /** Technical id of the member the decision is about. */
  memberId: string;
  /** Family tree the member belongs to; the envelope column, not payload. */
  treeId: string;
  action: ConsentEventAction;
  /** ISO timestamp copied from the ledger row (record.at). */
  occurredAt: string;
}

/**
 * Build the envelope for one consent fact. The payload carries the four
 * contract keys only; the ledger's free-text note and scope string stay in
 * the ConsentRecord table and never enter the audit store, mirroring how
 * change-review snapshots stay out of the store (ADR 0009, ADR 0012).
 */
export function buildConsentEvent(input: ConsentEventInput): EventEnvelope {
  const payload: ConsentEventPayload = {
    consentId: input.consentId,
    memberId: input.memberId,
    action: input.action,
    occurredAt: input.occurredAt,
  };
  return {
    type: consentEventType(input.action),
    actorUserId: input.actorId,
    familyTreeId: input.treeId,
    payload,
  };
}

const VALID_CONSENT_ACTIONS: readonly string[] = ['grant', 'revoke', 'regrant'];

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

/**
 * Strict structural check for a consent event payload (S-09a-i).
 * Returns true only when the value is a plain object carrying exactly the
 * four contract keys, the ids are non-empty strings, action is one of
 * grant/revoke/regrant, and occurredAt parses as a timestamp. Anything
 * else is refused: unknown keys, empty ids, unknown actions, and
 * unparseable or non-string timestamps.
 */
export function validateConsentEvent(payload: unknown): boolean {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    return false;
  }
  const keys = Object.keys(payload).sort();
  if (keys.length !== 4) return false;
  if (keys.join(',') !== 'action,consentId,memberId,occurredAt') return false;
  const candidate = payload as Partial<ConsentEventPayload>;
  if (!isNonEmptyString(candidate.consentId)) return false;
  if (!isNonEmptyString(candidate.memberId)) return false;
  if (!isNonEmptyString(candidate.action)) return false;
  if (!VALID_CONSENT_ACTIONS.includes(candidate.action)) return false;
  if (!isNonEmptyString(candidate.occurredAt)) return false;
  if (Number.isNaN(Date.parse(candidate.occurredAt))) return false;
  return true;
}
