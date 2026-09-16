/**
 * Modul pure consent dispatch (S-06b-B).
 * Logika keputusan endpoint consent: parsing body, pemetaan action ke
 * privacyStatus target, dan replay ledger via reducer pure (applyRecord).
 * Tanpa import eksternal selain sesama modul consent.
 */

import {
  applyRecord,
  createRecord,
  initState,
  type ConsentAction,
  type ConsentRecord,
  type ConsentState,
} from './record';

export interface ConsentBodyInput {
  action?: unknown;
  scope?: unknown;
  note?: unknown;
}

export type ConsentParseResult =
  | { ok: true; action: ConsentAction; scope: string; note?: string }
  | { ok: false; code: string; message: string };

const VALID_ACTIONS: readonly ConsentAction[] = ['grant', 'revoke', 'regrant'];

/**
 * Parse body POST /members/:memberId/consent.
 * action wajib salah satu dari grant/revoke/regrant, scope wajib non-empty,
 * note optional (batas panjang divalidasi createRecord).
 */
export function parseConsentBody(input: ConsentBodyInput): ConsentParseResult {
  const action = input.action;
  if (typeof action !== 'string' || !VALID_ACTIONS.includes(action as ConsentAction)) {
    return {
      ok: false,
      code: 'CONSENT_ACTION_INVALID',
      message: `action wajib salah satu dari: ${VALID_ACTIONS.join(', ')}`,
    };
  }
  const scope = input.scope;
  if (typeof scope !== 'string' || scope.trim().length === 0) {
    return { ok: false, code: 'CONSENT_SCOPE_REQUIRED', message: 'scope wajib diisi' };
  }
  if (input.note !== undefined && typeof input.note !== 'string') {
    return { ok: false, code: 'CONSENT_NOTE_INVALID', message: 'note harus string' };
  }
  const note = input.note as string | undefined;
  return note === undefined
    ? { ok: true, action: action as ConsentAction, scope }
    : { ok: true, action: action as ConsentAction, scope, note };
}

/**
 * privacyStatus target FamilyMember untuk tiap action:
 * grant dan regrant membuat member shared, revoke membuat private.
 */
export function targetPrivacyStatus(action: ConsentAction): 'shared' | 'private' {
  return action === 'revoke' ? 'private' : 'shared';
}

/** Bentuk baris ConsentRecord dari database (chronological ascending). */
export interface ConsentRowInput {
  id: string;
  memberId: string;
  action: string;
  scope: string;
  note: string | null;
  at: Date | string;
}

/**
 * Replay baris ledger consent dari database menjadi ConsentState
 * memakai reducer pure initState + createRecord + applyRecord.
 * Ledger korup (transisi ilegal) melempar Error, endpoint balas 409.
 */
export function replayConsentState(rows: readonly ConsentRowInput[]): ConsentState {
  let state = initState();
  for (const row of rows) {
    state = applyRecord(state, toRecord(row));
  }
  return state;
}

function toRecord(row: ConsentRowInput): ConsentRecord {
  return createRecord(
    row.memberId,
    row.action as ConsentAction,
    row.scope,
    row.at instanceof Date ? row.at.toISOString() : row.at,
    row.note ?? undefined,
    row.id,
  );
}
