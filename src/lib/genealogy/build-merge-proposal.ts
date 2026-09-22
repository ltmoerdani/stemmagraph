/**
 * Pembangun payload change proposal tipe merge_person (pure, tanpa I/O).
 * GOAL v149-i STG merge proposal, pilar 3 dedup engine, gap 1.11 VISION.
 *
 * Pola mengikuti analisis merge FamilySearch: satu record dipilih sebagai
 * survivor, record duplikat menjadi sumber salinan. Constraint per pasangan:
 * hasil merge wajib punya tepat satu kelahiran dan relasi tanpa ganda,
 * jadi resourcePlan mengunci arah salinan dari duplicate ke survivor.
 *
 * Payload mengikuti kontrak change proposal (src/lib/changes):
 * targetType 'member', free text hanya reasonNote lewat validateReasonNote.
 * Jejak keputusan reviewer opsional divalidasi ulang lewat
 * applyReviewerDecision agar tidak ada keputusan di luar ACCEPT/REJECT/SKIP.
 */

import { validateReasonNote } from '../changes';
import { applyReviewerDecision, type ReviewerDecisionRecord } from './dedup-review-list';

/** Tipe proposal khusus merge dua orang. */
export const MERGE_PROPOSAL_TYPE = 'merge_person' as const;

/**
 * Constraint resource per pasangan merge.
 * source selalu duplicate, target selalu survivor: salinan satu arah.
 */
export const MERGE_RESOURCE_CONSTRAINT = {
  BIRTH_SINGLE: 'KEEP_SINGLE_BIRTH',
  RELATIONSHIP_UNIQUE: 'MERGE_UNIQUE_RELATIONSHIPS',
} as const;

export interface MergeResourcePlanEntry {
  source: 'duplicate';
  target: 'survivor';
  constraint: (typeof MERGE_RESOURCE_CONSTRAINT)[keyof typeof MERGE_RESOURCE_CONSTRAINT];
}

export interface MergeResourcePlan {
  birth: MergeResourcePlanEntry;
  relationship: MergeResourcePlanEntry;
}

export interface MergeProposalInput {
  /** Record yang dipertahankan setelah merge. */
  survivorId: string;
  /** Record duplikat yang isinya disalin lalu digantungkan. */
  duplicateId: string;
  /** Alasan merge, bebas teks maksimal 500 karakter (validateReasonNote). */
  reason: string;
  /** Jejak keputusan reviewer yang mendasari merge ini, opsional. */
  decisions?: readonly ReviewerDecisionRecord[];
}

export interface MergeProposalFields {
  survivorId: string;
  duplicateId: string;
  resourcePlan: MergeResourcePlan;
}

export interface MergeProposalPayload {
  type: typeof MERGE_PROPOSAL_TYPE;
  targetType: 'member';
  /** Proposal menunjuk record survivor; duplicate ikut di dalam fields. */
  targetId: string;
  fields: MergeProposalFields;
  reasonNote: string;
  decisions: ReviewerDecisionRecord[];
}

/**
 * Rencana sumber daya default: kelahiran tunggal dan relasi unik,
 * keduanya menyalin dari duplicate ke survivor. Deterministik, tanpa input.
 */
export function defaultMergeResourcePlan(): MergeResourcePlan {
  return {
    birth: {
      source: 'duplicate',
      target: 'survivor',
      constraint: MERGE_RESOURCE_CONSTRAINT.BIRTH_SINGLE,
    },
    relationship: {
      source: 'duplicate',
      target: 'survivor',
      constraint: MERGE_RESOURCE_CONSTRAINT.RELATIONSHIP_UNIQUE,
    },
  };
}

function requireId(value: string, label: string): string {
  if (typeof value !== 'string') {
    throw new Error(`${label} harus string`);
  }
  const trimmed = value.trim();
  if (trimmed === '') {
    throw new Error(`${label} tidak boleh kosong`);
  }
  return trimmed;
}

/**
 * Membangun payload change proposal merge_person dari satu pasangan
 * duplikat. Pure: tanpa efek samping, hasil deterministik, melempar Error
 * dengan pesan validator bila input melanggar kontrak.
 */
export function buildMergeProposal(input: MergeProposalInput): MergeProposalPayload {
  const survivorId = requireId(input.survivorId, 'survivorId');
  const duplicateId = requireId(input.duplicateId, 'duplicateId');
  if (survivorId === duplicateId) {
    throw new Error('survivorId dan duplicateId harus berbeda');
  }

  const reason = validateReasonNote(input.reason);
  if (!reason.ok) {
    throw new Error(reason.reason);
  }

  // Validasi ulang tiap record lewat kontrak review agar keputusan liar
  // (di luar ACCEPT/REJECT/SKIP) tertolak sejak pembangunan payload.
  const decisions = (input.decisions ?? []).map((record) =>
    applyReviewerDecision(record.pairId, record.decision),
  );

  return {
    type: MERGE_PROPOSAL_TYPE,
    targetType: 'member',
    targetId: survivorId,
    fields: {
      survivorId,
      duplicateId,
      resourcePlan: defaultMergeResourcePlan(),
    },
    reasonNote: reason.value,
    decisions,
  };
}
