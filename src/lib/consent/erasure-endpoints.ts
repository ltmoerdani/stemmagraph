/**
 * Modul PURE endpoint erasure untuk Stemmagraph (S-09b-vi-i).
 * Tanpa IO: tanpa database, tanpa Express, tanpa import server.
 * Menyediakan fungsi parse action, plan request, summarize state,
 * dan decision cancel dengan pemetaan error yang konsisten.
 */

import {
  erasureStateFromEvents,
  mapErasureError,
} from './erasure-wiring';
import {
  ERASURE_DUE_DAYS,
  buildErasureRequestEvent,
  buildErasureCancelEvent,
  type ErasureRouteRow,
  type ErasureRouteConflictResponse,
  type ErasureRouteNotFoundResponse,
} from './erasure-routes';

export { ERASURE_DUE_DAYS };

export type ErasureSummaryState = 'none' | 'requested' | 'completed' | 'cancelled';

export interface ErasureSummaryResult {
  state: ErasureSummaryState;
  dueAt: string | null;
}

export type ErasureCancelDecision =
  | { kind: 'ok'; event: ErasureRouteRow }
  | { kind: 'conflict'; response: ErasureRouteConflictResponse }
  | { kind: 'not-found'; response: ErasureRouteNotFoundResponse };

/**
 * Parse body request POST erasure untuk mendeteksi aksi cancel.
 * Mengembalikan { action: 'cancel' } jika valid, atau null.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseErasureAction(body: unknown): { action: 'cancel' } | null {
  if (!isRecord(body)) {
    return null;
  }
  if (body.action === 'cancel') {
    return { action: 'cancel' };
  }
  return null;
}

/**
 * Buat rencana request erasure baru beserta event ledger pembungkusnya.
 */
export function planErasureRequest(memberId: string, nowIso: string): { event: ErasureRouteRow } {
  const baseEvent = buildErasureRequestEvent(memberId, nowIso);
  const event: ErasureRouteRow = {
    type: baseEvent.type,
    payloadJson: baseEvent.payloadJson,
    createdAt: new Date(nowIso),
  };
  return { event };
}

/**
 * Rekonstruksi ringkasan status erasure dari barisan event ledger.
 * Menghasilkan state (none, requested, completed, cancelled) dan dueAt.
 */
export function summarizeErasure(rows: readonly ErasureRouteRow[]):
  ErasureSummaryResult {
  const state = erasureStateFromEvents(rows);
  if (state === null) {
    return { state: 'none', dueAt: null };
  }
  const lowerStatus = state.status.toLowerCase() as ErasureSummaryState;
  return {
    state: lowerStatus,
    dueAt: state.dueAt,
  };
}

/**
 * Ambil keputusan dan bangun event cancel bila sah, atau kembalikan
 * respons error terpetakan (conflict / not-found) menggunakan
 * erasureWriteOutcome dan mapErasureError.
 */
export function decideErasureCancel(
  rows: readonly ErasureRouteRow[],
  nowIso: string,
): ErasureCancelDecision {
  try {
    const state = erasureStateFromEvents(rows);
    if (state === null) {
      return {
        kind: 'not-found',
        response: { status: 404, code: 'ERASURE_NOT_FOUND' },
      };
    }
    if (state.status !== 'REQUESTED') {
      return {
        kind: 'conflict',
        response: {
          status: 409,
          code: 'ERASURE_CONFLICT',
          message: `cancel ditolak: permintaan sudah ${state.status}`,
        },
      };
    }
    const cancelEvent = buildErasureCancelEvent(state.memberId, nowIso);
    const event: ErasureRouteRow = {
      type: cancelEvent.type,
      payloadJson: cancelEvent.payloadJson,
      createdAt: new Date(nowIso),
    };
    return { kind: 'ok', event };
  } catch (error) {
    const mapped = mapErasureError(error);
    return {
      kind: 'conflict',
      response: {
        status: 409,
        code: 'ERASURE_CONFLICT',
        message: mapped.message,
      },
    };
  }
}
