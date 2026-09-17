/**
 * Modul pure wiring alur erasure fase III (S-09b-iii).
 * Jembatan antara state machine erasure (S-09b-i) dan lapisan endpoint:
 * membungkus pembuatan permintaan, mereplay baris event ledger menjadi
 * status erasure terkini, dan memetakan error domain ke bentuk respons.
 * Tanpa IO: tanpa database, tanpa HTTP, tanpa import server. Endpoint
 * fase berikutnya tinggal memanggil dan menangkap hasil mapErasureError.
 * Tanpa import eksternal, konsisten dengan modul consent lain.
 */

import {
  cancelErasureRequest,
  completeErasureRequest,
  createErasureRequest,
  ErasureError,
  type ErasureRequest,
} from './erasure';

/** Tipe event erasure yang dikenali di ledger. */
export type ErasureEventType = 'erasure.requested' | 'erasure.completed' | 'erasure.cancelled';

/** Satu baris event erasure pada ledger; payloadJson sudah berupa string JSON. */
export interface ErasureEventRow {
  type: ErasureEventType;
  payloadJson: string;
}

/**
 * Bentuk error terpetakan untuk respons endpoint. ErasureError berarti
 * pelanggaran aturan transisi sehingga 409, Error validasi input 400,
 * dan sisanya 500 sebagai penanda kesalahan internal.
 */
export interface MappedErasureError {
  status: 409 | 400 | 500;
  code: 'ERASURE_CONFLICT' | 'ERASURE_VALIDATION' | 'ERASURE_INTERNAL';
  message: string;
}

/**
 * Buat permintaan erasure baru pada titik waktu nowIso. Murni
 * penerusan ke createErasureRequest, jadi dueAt dijamin tepat 30 hari
 * sesuai UU PDP 27/2022 dan GDPR. Input kosong atau timestamp tidak
 * valid dilempar sebagai Error biasa (mapErasureError jadikan 400).
 */
export function requestErasure(memberId: string, nowIso: string): ErasureRequest {
  return createErasureRequest(memberId, nowIso);
}

/**
 * Replay barisan event erasure dari ledger menjadi status terkini.
 * Baris dibaca berurutan sesuai array; setiap tipe diteruskan ke
 * transisi state machine S-09b-i sehingga aturan status final dan
 * timestamp tidak bisa dilanggar. Pelanggaran transisi (completed
 * sebelum requested, requested ganda, cancel atas completed) melempar
 * ErasureError, payload tidak valid melempar Error biasa, dan keduanya
 * bisa dipetakan lewat mapErasureError. Array kosong menghasilkan null
 * karena memang belum ada permintaan.
 */
export function erasureStateFromEvents(rows: readonly ErasureEventRow[]): ErasureRequest | null {
  let state: ErasureRequest | null = null;
  for (const row of rows) {
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(row.payloadJson) as Record<string, unknown>;
    } catch {
      throw new Error(`payloadJson event ${row.type} bukan JSON valid`);
    }
    if (row.type === 'erasure.requested') {
      if (state !== null) {
        throw new ErasureError(
          `requested ditolak: permintaan member ${state.memberId} sudah ada dengan status ${state.status}`,
        );
      }
      state = createErasureRequest(
        String(payload.memberId ?? ''),
        String(payload.requestedAt ?? ''),
      );
    } else if (row.type === 'erasure.completed') {
      if (state === null) {
        throw new ErasureError('completed ditolak: belum ada permintaan erasure untuk member ini');
      }
      state = completeErasureRequest(state, String(payload.completedAt ?? ''));
    } else if (row.type === 'erasure.cancelled') {
      if (state === null) {
        throw new ErasureError('cancelled ditolak: belum ada permintaan erasure untuk member ini');
      }
      state = cancelErasureRequest(state, String(payload.cancelledAt ?? ''));
    } else {
      throw new Error(`tipe event erasure tidak dikenal: ${String(row.type)}`);
    }
  }
  return state;
}

/**
 * Petakan error apa pun dari alur erasure ke bentuk respons endpoint.
 * ErasureError adalah pelanggaran transisi (409), Error biasa adalah
 * kegagalan validasi input (400), dan nilai bukan Error adalah kondisi
 * tak terduga (500) dengan pesan generik supaya detail internal tidak
 * bocor ke pemanggil.
 */
export function mapErasureError(error: unknown): MappedErasureError {
  if (error instanceof ErasureError) {
    return { status: 409, code: 'ERASURE_CONFLICT', message: error.message };
  }
  if (error instanceof Error) {
    return { status: 400, code: 'ERASURE_VALIDATION', message: error.message };
  }
  return { status: 500, code: 'ERASURE_INTERNAL', message: 'kesalahan internal pada alur erasure' };
}
