/**
 * Modul eksekutor purge erasure fase II (STG v122-ii).
 * Mengeksekusi redaksi data pribadi subjek (PII) FamilyMember berdasarkan plan
 * dan state erasure yang direplay dari ledger, lengkap dengan pencatatan event
 * audit dan idempoten (purge kedua kali pada state yang sama tidak mengubah apa pun).
 * Bebas em dash, sesuai standar Anti-AI.
 */

import {
  erasureStateFromEvents,
  mapErasureError,
  type ErasureEventRow,
  type MappedErasureError,
} from './erasure-wiring';
import {
  buildErasurePurgePlan,
  applyErasurePurgePlan,
  isErasurePurgeDue,
  assertErasurePurgeAllowed,
  ERASURE_PURGE_FIELDS,
  type ErasurePurgePlan,
} from './erasure-purge-plan';
import { ErasureError } from './erasure';

export interface MemberPurgeableData {
  id: string;
  email?: string | null;
  phone?: string | null;
  photoUrl?: string | null;
  currentLocation?: string | null;
  notes?: string | null;
  [key: string]: unknown;
}

export interface ErasurePurgeExecuteDeps {
  listEvents(memberId: string): Promise<ErasureEventRow[]>;
  getMember(memberId: string): Promise<MemberPurgeableData | null>;
  updateMember(memberId: string, updated: MemberPurgeableData): Promise<void>;
  appendEvent(row: ErasureEventRow): Promise<void>;
  nowIso(): string;
}

export interface ErasurePurgeExecuteResult {
  success: boolean;
  purged: boolean;
  plan?: ErasurePurgePlan;
  message?: string;
  error?: MappedErasureError;
}

/**
 * Eksekusi purge untuk member tertentu.
 * Membaca event ledger, menyusun state, memeriksa status COMPLETED dan due,
 * menyusun plan, menerapkan plan ke data member, mencatat audit event, dan
 * memastikan idempoten (jika semua field PII sudah null dan status COMPLETED,
 * purge dianggap selesai dan tidak menulis ulang event atau data).
 */
export async function executeErasurePurge(
  memberId: string,
  deps: ErasurePurgeExecuteDeps,
): Promise<ErasurePurgeExecuteResult> {
  try {
    if (!memberId || memberId.trim().length === 0) {
      throw new Error('memberId wajib diisi');
    }

    const rows = await deps.listEvents(memberId);
    const state = erasureStateFromEvents(rows);

    if (!state) {
      throw new ErasureError('purge ditolak: belum ada permintaan erasure untuk member ini');
    }

    if (state.status !== 'COMPLETED') {
      throw new ErasureError(`purge ditolak: status permintaan erasure adalah ${state.status}`);
    }

    if (!state.completedAt || !state.dueAt) {
      throw new Error('completedAt dan dueAt wajib terisi pada status COMPLETED');
    }

    assertErasurePurgeAllowed({
      requestedAt: state.requestedAt,
      completedAt: state.completedAt,
      dueAt: state.dueAt,
    });

    const now = deps.nowIso();
    const due = isErasurePurgeDue(state.dueAt, now);
    if (!due) {
      return {
        success: true,
        purged: false,
        message: 'tenggat purge belum tercapai',
      };
    }

    const member = await deps.getMember(memberId);
    if (!member) {
      throw new Error(`member dengan id ${memberId} tidak ditemukan`);
    }

    const alreadyPurged = ERASURE_PURGE_FIELDS.every(
      (field) => member[field] === null || member[field] === undefined,
    );

    const plan = buildErasurePurgePlan({
      memberId: state.memberId,
      completedAt: state.completedAt,
      dueAt: state.dueAt,
    });

    if (alreadyPurged) {
      return {
        success: true,
        purged: false,
        plan,
        message: 'data member sudah ter-purge sebelumnya (idempoten)',
      };
    }

    const updatedMember = applyErasurePurgePlan(member, plan);
    await deps.updateMember(memberId, updatedMember);

    const auditPayload = JSON.stringify({
      memberId,
      purgedAt: now,
      fields: plan.fields,
    });

    await deps.appendEvent({
      type: 'erasure.completed',
      payloadJson: auditPayload,
    });

    return {
      success: true,
      purged: true,
      plan,
      message: 'purge PII berhasil dieksekusi',
    };
  } catch (err) {
    return {
      success: false,
      purged: false,
      error: mapErasureError(err),
    };
  }
}
