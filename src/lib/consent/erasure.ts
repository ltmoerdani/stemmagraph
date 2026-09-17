/**
 * Modul pure alur erasure fase I (S-09b-i).
 * Right to be forgotten untuk orang hidup: UU PDP 27/2022 Pasal 13 dan
 * GDPR Art. 17 memberi subjek data hak penghapusan dengan tenggat pemenuhan
 * 30 hari. State machine REQUESTED, COMPLETED, atau CANCELLED berjalan di
 * sini sebagai fungsi murni tanpa IO, sehingga fase II (wiring endpoint)
 * tinggal memanggil dan memetakan hasilnya.
 * Tanpa import eksternal, konsisten dengan modul consent lain.
 */

export type ErasureStatus = 'REQUESTED' | 'COMPLETED' | 'CANCELLED';

export interface ErasureRequest {
  memberId: string;
  requestedAt: string; // ISO 8601
  dueAt: string; // ISO 8601, requestedAt + 30 hari
  status: ErasureStatus;
  completedAt?: string; // ISO 8601, terisi saat COMPLETED
  cancelledAt?: string; // ISO 8601, terisi saat CANCELLED
}

/**
 * Error domain untuk transisi state machine erasure yang ilegal.
 * Pola sama dengan ConsentLedgerError: validasi input salah pakai Error
 * biasa, pelanggaran aturan transisi pakai error domain agar endpoint
 * fase II bisa memetakan ke kode respons berbeda tanpa menebak pesan.
 */
export class ErasureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ErasureError';
  }
}

/** Tenggat pemenuhan hak penghapusan: 30 hari sejak permintaan (UU PDP, GDPR). */
export const ERASURE_DEADLINE_DAYS = 30;

const ERASURE_DEADLINE_MS = ERASURE_DEADLINE_DAYS * 24 * 60 * 60 * 1000;

function addDeadlineMs(iso: string): string {
  return new Date(Date.parse(iso) + ERASURE_DEADLINE_MS).toISOString();
}

function requireIso(value: string, label: string): void {
  if (Number.isNaN(Date.parse(value))) {
    throw new Error(`${label} bukan timestamp ISO 8601 yang valid: ${String(value)}`);
  }
}

/**
 * dueAt dianggap sah bila tidak melampaui tenggat 30 hari sejak
 * requestedAt. Melebihi itu berarti janji regulasi dilanggar, jadi
 * dilempar sebagai ErasureError agar tidak pernah tersimpan.
 */
export function assertErasureDeadline(requestedAt: string, dueAt: string): void {
  requireIso(requestedAt, 'requestedAt');
  requireIso(dueAt, 'dueAt');
  const spanMs = Date.parse(dueAt) - Date.parse(requestedAt);
  if (spanMs > ERASURE_DEADLINE_MS) {
    throw new ErasureError(
      `dueAt melampaui tenggat: jarak ${spanMs} ms, maksimal ${ERASURE_DEADLINE_MS} ms (${ERASURE_DEADLINE_DAYS} hari)`,
    );
  }
}

/**
 * Buat permintaan erasure baru dengan status REQUESTED.
 * dueAt dihitung tepat requestedAt + 30 hari sesuai UU PDP 27/2022
 * dan GDPR right to erasure. Validasi input pakai Error biasa.
 */
export function createErasureRequest(memberId: string, requestedAt: string): ErasureRequest {
  if (!memberId || memberId.trim().length === 0) {
    throw new Error('memberId wajib diisi');
  }
  requireIso(requestedAt, 'requestedAt');
  const dueAt = addDeadlineMs(requestedAt);
  assertErasureDeadline(requestedAt, dueAt);
  return { memberId, requestedAt, dueAt, status: 'REQUESTED' };
}

/**
 * Selesaikan permintaan erasure. Hanya sah dari status REQUESTED;
 * COMPLETED dan CANCELLED adalah status final yang tidak bisa diputar
 * kembali, pelanggarannya melempar ErasureError. completedAt wajib
 * tidak lebih awal dari requestedAt.
 */
export function completeErasureRequest(
  request: ErasureRequest,
  completedAt: string,
): ErasureRequest {
  if (request.status !== 'REQUESTED') {
    throw new ErasureError(
      `complete ditolak: permintaan member ${request.memberId} sudah ${request.status}`, 
    );
  }
  requireIso(completedAt, 'completedAt');
  if (Date.parse(completedAt) < Date.parse(request.requestedAt)) {
    throw new Error('completedAt tidak boleh lebih awal dari requestedAt');
  }
  return { ...request, status: 'COMPLETED', completedAt };
}

/**
 * Batalkan permintaan erasure (misal subjek menarik permintaannya).
 * Hanya sah dari status REQUESTED; cancel atas permintaan yang sudah
 * COMPLETED jelas kontradiktif dan melempar ErasureError.
 */
export function cancelErasureRequest(
  request: ErasureRequest,
  cancelledAt: string,
): ErasureRequest {
  if (request.status !== 'REQUESTED') {
    throw new ErasureError(
      `cancel ditolak: permintaan member ${request.memberId} sudah ${request.status}`,
    );
  }
  requireIso(cancelledAt, 'cancelledAt');
  if (Date.parse(cancelledAt) < Date.parse(request.requestedAt)) {
    throw new Error('cancelledAt tidak boleh lebih awal dari requestedAt');
  }
  return { ...request, status: 'CANCELLED', cancelledAt };
}

/**
 * Cek apakah permintaan sudah lewat tenggat 30 hari pada titik waktu `at`.
 * Tepat pada dueAt masih dianggap dalam tenggat. Permintaan final
 * (COMPLETED atau CANCELLED) tidak pernah due.
 */
export function isErasureDue(request: ErasureRequest, at: string): boolean {
  if (request.status !== 'REQUESTED') {
    return false;
  }
  requireIso(at, 'at');
  return Date.parse(at) > Date.parse(request.dueAt);
}

export type ErasureFieldAction = 'redact' | 'delete' | 'anonymize';

export interface ErasurePlanItem {
  field: string;
  action: ErasureFieldAction;
  reason: string;
}

export interface ErasurePlan {
  memberId: string;
  scope: 'living-person';
  items: readonly ErasurePlanItem[];
}

/** Fakta keberadaan data pada member; undefined dianggap ada (konservatif). */
export interface ErasureMemberFacts {
  hasName?: boolean;
  hasPhoto?: boolean;
  hasBirthDate?: boolean;
  hasRelations?: boolean;
}

function present(value: boolean | undefined): boolean {
  return value !== false;
}

/**
 * Rencana redaksi untuk orang hidup yang menuntut hak penghapusan.
 * Nama dan tanggal lahir diredaksi, foto dihapus, relasi tetap ada
 * sebagai graf anonim supaya struktur keluarga tidak rusak sekaligus
 * identitas tidak bisa direkonstruksi. Pure function, tanpa IO;
 * fase II yang mengeksekusi plan ini ke storage.
 */
export function computeErasurePlan(
  memberId: string,
  facts: ErasureMemberFacts = {},
): ErasurePlan {
  if (!memberId || memberId.trim().length === 0) {
    throw new Error('memberId wajib diisi');
  }
  const items: ErasurePlanItem[] = [];
  if (present(facts.hasName)) {
    items.push({
      field: 'name',
      action: 'redact',
      reason: 'identifikasi langsung orang hidup',
    });
  }
  if (present(facts.hasPhoto)) {
    items.push({
      field: 'photoUrl',
      action: 'delete',
      reason: 'biometrik visual tidak wajib disimpan setelah penghapusan',
    });
  }
  if (present(facts.hasBirthDate)) {
    items.push({
      field: 'birthDate',
      action: 'redact',
      reason: 'tanggal hidup mengidentifikasi orang hidup',
    });
  }
  if (present(facts.hasRelations)) {
    items.push({
      field: 'relations',
      action: 'anonymize',
      reason: 'relasi tetap sebagai graf anonim tanpa identitas',
    });
  }
  return { memberId, scope: 'living-person', items };
}
