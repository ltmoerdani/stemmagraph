/**
 * Modul pure consent record (S-06a).
 * Append-only ledger persetujuan member, tanpa import eksternal.
 */

export type ConsentAction = 'grant' | 'revoke' | 'regrant';

export interface ConsentRecord {
  id: string;
  memberId: string;
  action: ConsentAction;
  scope: string;
  note?: string;
  at: string; // ISO 8601
}

export interface ConsentState {
  records: ConsentRecord[];
  granted: boolean;
}

/**
 * Error domain untuk transisi ledger ilegal (S-06e). Dilempar applyRecord
 * saat record menyalahi aturan transisi atau urutan timestamp. Endpoint
 * memetakannya ke 409 CONSENT_INVALID_TRANSITION; pemisahan dari Error
 * biasa membuat validasi input dan kegagalan infrastruktur bisa dipetakan
 * ke kode respons berbeda tanpa menebak isi pesan.
 */
export class ConsentLedgerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConsentLedgerError';
  }
}

const NOTE_MAX_LENGTH = 280;
const VALID_ACTIONS: readonly ConsentAction[] = ['grant', 'revoke', 'regrant'];

function generateId(): string {
  return `rec_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Buat record consent baru.
 * Validasi di sini: note maksimal 280 karakter, action harus dikenal,
 * `at` harus bisa diparse sebagai ISO 8601.
 */
export function createRecord(
  memberId: string,
  action: ConsentAction,
  scope: string,
  at: string,
  note?: string,
  id?: string,
): ConsentRecord {
  if (!memberId || memberId.trim().length === 0) {
    throw new Error('memberId wajib diisi');
  }
  if (!scope || scope.trim().length === 0) {
    throw new Error('scope wajib diisi');
  }
  if (!VALID_ACTIONS.includes(action)) {
    throw new Error(`action tidak dikenal: ${String(action)}`);
  }
  if (Number.isNaN(Date.parse(at))) {
    throw new Error(`at bukan timestamp ISO 8601 yang valid: ${String(at)}`);
  }
  if (note !== undefined && note.length > NOTE_MAX_LENGTH) {
    throw new Error(
      `note melebihi batas: ${note.length} karakter, maksimal ${NOTE_MAX_LENGTH}`,
    );
  }

  const record: ConsentRecord = {
    id: id ?? generateId(),
    memberId,
    action,
    scope,
    at,
  };
  if (note !== undefined) {
    record.note = note;
  }
  return record;
}

/**
 * Terapkan record ke state (append-only, immutable).
 * Validasi:
 * - revoke ditolak bila belum ada grant aktif tercatat
 * - regrant hanya boleh bila sebelumnya revoked
 * - timestamp record harus lebih besar dari record terakhir member yang sama (monotonic)
 */
export function applyRecord(state: ConsentState, record: ConsentRecord): ConsentState {
  if (record.action === 'revoke' && !state.granted) {
    throw new ConsentLedgerError(
      `revoke ditolak: belum ada grant tercatat untuk member ${record.memberId}`,
    );
  }

  if (record.action === 'regrant') {
    const hasHistory = state.records.some((r) => r.memberId === record.memberId);
    if (state.granted || !hasHistory) {
      throw new ConsentLedgerError(
        `regrant ditolak: member ${record.memberId} tidak sedang dalam status revoked`,
      );
    }
  }

  const lastForSameMember = [...state.records]
    .reverse()
    .find((r) => r.memberId === record.memberId);

  if (lastForSameMember) {
    const lastMs = Date.parse(lastForSameMember.at);
    const nextMs = Date.parse(record.at);
    if (Number.isNaN(lastMs) || Number.isNaN(nextMs) || nextMs <= lastMs) {
      throw new ConsentLedgerError(
        `timestamp tidak monotonic: record baru (${record.at}) harus lebih baru dari record terakhir member ${record.memberId} (${lastForSameMember.at})`,
      );
    }
  }

  const granted = record.action !== 'revoke';
  return {
    records: [...state.records, record],
    granted,
  };
}

export function initState(): ConsentState {
  return { records: [], granted: false };
}
