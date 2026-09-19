/**
 * Modul pure purge-plan executor erasure fase I (STG v122-i).
 * Setelah permintaan erasure berstatus COMPLETED (lihat erasure.ts), data
 * pribadi subjek wajib direduksi sebelum tenggat 30 hari berakhir. Modul ini
 * menyusun rencana redaksi (purge plan) dan menerapkannya ke objek member
 * sebagai fungsi murni tanpa IO, sehingga fase II (wiring endpoint dan
 * persistence) tinggal memanggil dan menyimpan hasilnya.
 * Tanpa import eksternal, konsisten dengan modul consent lain.
 */

import { ErasureError } from './erasure';

/**
 * Daftar field PII FamilyMember yang jadi target redaksi fase ini.
 * Urutan tetap dan dipakai persis seperti ini di plan; field identitas
 * dasar (name, birthDate, gender, isAlive, privacyStatus) BUKAN target
 * purge fase ini dan tidak boleh tersentuh.
 */
export const ERASURE_PURGE_FIELDS = [
  'email',
  'phone',
  'photoUrl',
  'currentLocation',
  'notes',
] as const;

export type ErasurePurgeField = (typeof ERASURE_PURGE_FIELDS)[number];

/** Rencana redaksi satu member: apa yang dihapus, kapan, dan tenggatnya. */
export interface ErasurePurgePlan {
  memberId: string;
  completedAt: string; // ISO 8601
  dueAt: string; // ISO 8601, requestedAt + 30 hari
  fields: string[]; // urutan tetap, tanpa duplikat
}

function requireIso(value: string, label: string): void {
  if (Number.isNaN(Date.parse(value))) {
    throw new Error(`${label} bukan timestamp ISO 8601 yang valid: ${String(value)}`);
  }
}

/**
 * Susun rencana redaksi untuk member yang erasure-nya selesai.
 * fields selalu berisi tepat 5 field PII target dengan urutan tetap.
 * Input invalid (memberId kosong, timestamp rusak) dilempar sebagai
 * Error biasa, konsisten dengan pola erasure.ts.
 */
export function buildErasurePurgePlan(state: {
  memberId: string;
  completedAt: string;
  dueAt: string;
}): ErasurePurgePlan {
  if (!state.memberId || state.memberId.trim().length === 0) {
    throw new Error('memberId wajib diisi');
  }
  requireIso(state.completedAt, 'completedAt');
  requireIso(state.dueAt, 'dueAt');
  return {
    memberId: state.memberId,
    completedAt: state.completedAt,
    dueAt: state.dueAt,
    fields: [...ERASURE_PURGE_FIELDS],
  };
}

/**
 * Terapkan rencana redaksi ke objek member. Mengembalikan salinan baru;
 * objek asli tidak pernah diubah. Hanya field yang tercantum di plan dan
 * termasuk daftar target purge yang di-null-kan, sisanya dibiarkan utuh.
 * Plan yang menargetkan field di luar daftar ditolak dengan Error biasa
 * agar identitas dasar member tidak mungkin terhapus tak sengaja.
 */
export function applyErasurePurgePlan<T>(member: T, plan: ErasurePurgePlan): T {
  if (!Array.isArray(plan.fields) || plan.fields.length === 0) {
    throw new Error('plan.fields wajib berisi daftar field target purge');
  }
  const allowed = new Set<string>(ERASURE_PURGE_FIELDS);
  for (const field of plan.fields) {
    if (!allowed.has(field)) {
      throw new Error(`field ${String(field)} bukan target purge fase ini`);
    }
  }
  const copy = { ...(member as Record<string, unknown>) } as Record<string, unknown>;
  for (const field of plan.fields) {
    copy[field] = null;
  }
  return copy as unknown as T;
}

/**
 * Cek apakah tenggat redaksi sudah jatuh tempo. Tepat pada dueAt sudah
 * dianggap due karena janji regulasi berlaku sampai batas waktu itu,
 * bukan sesudahnya. Kedua nilai wajib ISO 8601 valid.
 */
export function isErasurePurgeDue(dueAt: string, nowIso: string): boolean {
  requireIso(dueAt, 'dueAt');
  requireIso(nowIso, 'nowIso');
  return Date.parse(nowIso) >= Date.parse(dueAt);
}

/**
 * Gerbang transisi COMPLETED untuk purge: sah bila tenggat dueAt sudah
 * lewat ATAU completedAt tidak lebih awal dari requestedAt. Melanggar
 * keduanya berarti redaksi dicatat sebelum waktunya, dilempar sebagai
 * ErasureError agar endpoint fase II bisa memetakannya ke respons 409.
 * Timestamp rusak tetap Error biasa sesuai pola erasure.ts.
 */
export function assertErasurePurgeAllowed(state: {
  requestedAt: string;
  completedAt: string;
  dueAt: string;
}): void {
  requireIso(state.requestedAt, 'requestedAt');
  requireIso(state.completedAt, 'completedAt');
  requireIso(state.dueAt, 'dueAt');
  const deadlinePassed = Date.parse(state.dueAt) <= Date.parse(state.completedAt);
  const completedNotEarly = Date.parse(state.completedAt) >= Date.parse(state.requestedAt);
  if (!deadlinePassed && !completedNotEarly) {
    throw new ErasureError(
      'purge ditolak: dueAt belum lewat dan completedAt lebih awal dari requestedAt',
    );
  }
}
