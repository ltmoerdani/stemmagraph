/**
 * Penilaian risiko merge anggota duplikat, logika keputusan pure
 * (v392 Approval Workflow Merge Berisiko fase 1).
 *
 * Modul ini TIDAK menyentuh database dan TIDAK punya dependency: fungsi
 * assessMergeRisk menerima hitungan hasil perencana merge
 * (planRelationshipRewire, planEventReassign di mergeMembers.ts) berupa
 * angka polos plus satu indikator koneksi generasi, lalu memutuskan
 * apakah merge boleh langsung dieksekusi atau wajib menunggu persetujuan
 * owner/editor (NEEDS_APPROVAL).
 *
 * Threshold (salah satu cukup untuk NEEDS_APPROVAL):
 * - relasi yang di-rewire >= MERGE_APPROVAL_REWIRE_THRESHOLD;
 * - relasi internal yang dihapus >= MERGE_APPROVAL_DELETE_THRESHOLD;
 * - facts yang dipindah >= MERGE_APPROVAL_FACTS_THRESHOLD;
 * - primary dan duplikat keduanya terhubung graf generasi
 *   (penggabungan dua cabang keluarga yang hidup).
 *
 * Deterministik: urutan reasons selalu mengikuti urutan konstanta
 * (rewire, delete, facts, generasi), tanpa pengaruh waktu atau acak.
 */

/** Batas rewire: mulai angka ini merge dianggap berisiko. */
export const MERGE_APPROVAL_REWIRE_THRESHOLD = 4;

/** Batas relasi internal terhapus: satu saja sudah berisiko. */
export const MERGE_APPROVAL_DELETE_THRESHOLD = 1;

/** Batas facts pindah: mulai angka ini merge dianggap berisiko. */
export const MERGE_APPROVAL_FACTS_THRESHOLD = 6;

/** Kode alasan kenapa merge masuk daftar butuh persetujuan. */
export type MergeRiskReasonCode =
  | 'RELATION_REWIRE'
  | 'RELATION_DELETE'
  | 'FACTS_MOVED'
  | 'GENERATION_BOTH_CONNECTED';

/** Satu alasan berisiko: kode + angka pemicu (untuk audit dan UI). */
export interface MergeRiskReason {
  code: MergeRiskReasonCode;
  /** Nilai terukur dari plan yang memicu alasan ini. */
  actual: number;
  /** Threshold yang dilanggar (1 untuk indikator boolean). */
  threshold: number;
}

export interface AssessMergeRiskInput {
  /** Jumlah relasi yang akan di-rewire (planRelationshipRewire.rewire). */
  rewireCount: number;
  /** Jumlah relasi internal yang dihapus (planRelationshipRewire.delete). */
  deleteCount: number;
  /** Jumlah facts yang dipindah (planEventReassign + lifeEvent duplikat). */
  movedFactCount: number;
  /** True bila primary DAN duplikat keduanya terhubung graf generasi. */
  bothGenerationsConnected: boolean;
}

export interface MergeRiskAssessment {
  /** True = merge TIDAK dieksekusi, wajib lewat approval owner/editor. */
  needsApproval: boolean;
  /** Kode keputusan; NEEDS_APPROVAL satu-satunya nilai berisiko. */
  risk: 'NEEDS_APPROVAL' | 'LOW';
  /** Daftar alasan terurut deterministik (urutan konstanta threshold). */
  reasons: MergeRiskReason[];
  /** Hitungan plan yang dinilai, ikut disimpan untuk audit. */
  stats: {
    rewireCount: number;
    deleteCount: number;
    movedFactCount: number;
    bothGenerationsConnected: boolean;
  };
}

/**
 * Nilai merge berdasarkan hitungan plan. Tanpa I/O, tanpa Date, tanpa
 * Math.random: input sama selalu menghasilkan output sama.
 */
export function assessMergeRisk(input: AssessMergeRiskInput): MergeRiskAssessment {
  const reasons: MergeRiskReason[] = [];
  if (input.rewireCount >= MERGE_APPROVAL_REWIRE_THRESHOLD) {
    reasons.push({
      code: 'RELATION_REWIRE',
      actual: input.rewireCount,
      threshold: MERGE_APPROVAL_REWIRE_THRESHOLD,
    });
  }
  if (input.deleteCount >= MERGE_APPROVAL_DELETE_THRESHOLD) {
    reasons.push({
      code: 'RELATION_DELETE',
      actual: input.deleteCount,
      threshold: MERGE_APPROVAL_DELETE_THRESHOLD,
    });
  }
  if (input.movedFactCount >= MERGE_APPROVAL_FACTS_THRESHOLD) {
    reasons.push({
      code: 'FACTS_MOVED',
      actual: input.movedFactCount,
      threshold: MERGE_APPROVAL_FACTS_THRESHOLD,
    });
  }
  if (input.bothGenerationsConnected) {
    reasons.push({ code: 'GENERATION_BOTH_CONNECTED', actual: 1, threshold: 1 });
  }
  const needsApproval = reasons.length > 0;
  return {
    needsApproval,
    risk: needsApproval ? 'NEEDS_APPROVAL' : 'LOW',
    reasons,
    stats: {
      rewireCount: input.rewireCount,
      deleteCount: input.deleteCount,
      movedFactCount: input.movedFactCount,
      bothGenerationsConnected: input.bothGenerationsConnected,
    },
  };
}

/**
 * Indikator koneksi generasi: true bila anggota muncul di minimal satu
 * relasi parent-child tree (dia orang tua atau anak dari seseorang).
 * Bukan ukuran kedalaman; cukup untuk menandai bahwa anggota itu hidup
 * di dalam graf generasi, bukan entri lepas.
 */
export function isGenerationConnected(memberId: string, rels: MergeApprovalRelRow[]): boolean {
  return rels.some(
    (r) =>
      (r.type === 'parent' || r.type === 'child') &&
      (r.memberId === memberId || r.relatedId === memberId),
  );
}

/** Bentuk baris relasi minimal untuk indikator koneksi generasi. */
export interface MergeApprovalRelRow {
  id: string;
  memberId: string;
  relatedId: string;
  type: string;
}
