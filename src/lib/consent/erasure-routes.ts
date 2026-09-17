/**
 * Modul pure route-contract erasure untuk Stemmagraph (S-09b-iv-i).
 * Tanpa IO: tanpa database, tanpa HTTP, tanpa import server.
 * Hanya import dari modul consent tetangga (erasure dan erasure-wiring).
 */

import {
  erasureStateFromEvents,
  mapErasureError,
  type ErasureEventRow,
  type MappedErasureError,
} from './erasure-wiring';
import {
  ERASURE_DEADLINE_DAYS,
  createErasureRequest,
  type ErasureRequest,
} from './erasure';

/** GDPR Art 12 satu bulan, opsi ICO 28 hari lebih konservatif. */
export const ERASURE_DUE_DAYS = ERASURE_DEADLINE_DAYS;

export interface ErasureRouteRow {
  type: ErasureEventRow['type'];
  payloadJson: string;
  createdAt: Date;
}

export interface ErasureRouteSuccessResponse {
  status: 200 | 201;
  request: ErasureRequest;
}

export interface ErasureRouteNotFoundResponse {
  status: 404;
  code: 'ERASURE_NOT_FOUND';
}

export type ErasureRouteGetResponse =
  | ErasureRouteSuccessResponse
  | ErasureRouteNotFoundResponse;

export interface ErasureRouteConflictResponse {
  status: 409;
  code: 'ERASURE_CONFLICT';
  message: string;
}

export type ErasureRouteWriteResponse =
  | ErasureRouteSuccessResponse
  | ErasureRouteConflictResponse;

function toWiringRows(rows: readonly ErasureRouteRow[]): ErasureEventRow[] {
  return rows.map((row) => ({ type: row.type, payloadJson: row.payloadJson }));
}

/**
 * Event erasure.requested baru: payloadJson JSON valid berisi memberId,
 * requestedAt, dan dueAt tepat now + 30 hari (ISO).
 */
export function buildErasureRequestEvent(memberId: string, nowIso: string): ErasureEventRow {
  const request = createErasureRequest(memberId, nowIso);
  return {
    type: 'erasure.requested',
    payloadJson: JSON.stringify({
      memberId: request.memberId,
      requestedAt: request.requestedAt,
      dueAt: request.dueAt,
    }),
  };
}

/**
 * Event erasure.cancelled: payloadJson JSON valid berisi memberId dan
 * cancelledAt sesuai titik waktu pembatalan.
 */
export function buildErasureCancelEvent(memberId: string, nowIso: string): ErasureEventRow {
  return {
    type: 'erasure.cancelled',
    payloadJson: JSON.stringify({
      memberId,
      cancelledAt: nowIso,
    }),
  };
}

/**
 * Respons GET erasure: replay rows berurutan lewat erasureStateFromEvents.
 * State ada berarti 200 dengan request hasil rekonstruksi, nihil berarti
 * 404 ERASURE_NOT_FOUND, dan rows yang melanggar aturan replay dipetakan
 * 409 ERASURE_CONFLICT lewat mapErasureError.
 */
export function erasureGetResponse(rows: readonly ErasureRouteRow[]): ErasureRouteGetResponse {
  try {
    const state = erasureStateFromEvents(toWiringRows(rows));
    if (state === null) {
      return { status: 404, code: 'ERASURE_NOT_FOUND' };
    }
    return { status: 200, request: state };
  } catch (error) {
    const mapped = mapErasureError(error);
    return { status: 409, code: 'ERASURE_CONFLICT', message: mapped.message };
  }
}

/**
 * Hasil write endpoint erasure. rows sudah memuat event baru yang
 * ditempelkan pemanggil (buildErasureRequestEvent atau
 * buildErasureCancelEvent), lalu state direplay dulu. Transisi invalid
 * (requested ganda, cancel tanpa request, cancel atas COMPLETED)
 * membuat replay gagal dan dipetakan 409 ERASURE_CONFLICT konsisten
 * dengan mapErasureError. Request baru sah saat state sebelumnya nihil
 * sehingga hasil replay REQUESTED (201), cancel sah saat REQUESTED
 * sehingga hasil replay CANCELLED (200).
 */
export function erasureWriteOutcome(
  rows: readonly ErasureRouteRow[],
  action: 'request' | 'cancel',
): ErasureRouteWriteResponse {
  let state: ErasureRequest | null;
  try {
    state = erasureStateFromEvents(toWiringRows(rows));
  } catch (error) {
    const mapped: MappedErasureError = mapErasureError(error);
    return { status: 409, code: 'ERASURE_CONFLICT', message: mapped.message };
  }

  if (action === 'request') {
    if (state === null || state.status !== 'REQUESTED') {
      return {
        status: 409,
        code: 'ERASURE_CONFLICT',
        message: 'request ditolak: tidak menghasilkan permintaan erasure baru',
      };
    }
    return { status: 201, request: state };
  }

  if (state === null) {
    return {
      status: 409,
      code: 'ERASURE_CONFLICT',
      message: 'cancel ditolak: belum ada permintaan erasure untuk member ini',
    };
  }
  if (state.status !== 'CANCELLED') {
    return {
      status: 409,
      code: 'ERASURE_CONFLICT',
      message: `cancel ditolak: permintaan member ${state.memberId} sudah ${state.status}`,
    };
  }
  return { status: 200, request: state };
}
