/**
 * Zonasi kandidat duplikasi untuk halaman review.
 * Modul pure: tanpa import eksternal selain tipe dari ./dedup-detect.
 *
 * Zona:
 * - KUAT: skor >= 80 (kandidat layak merge langsung)
 * - REVIEW: skor 60 sampai 79 (perlu keputusan reviewer)
 * - Di bawah 60: diabaikan
 */

import type { DedupCandidate } from "./dedup-detect";

export const STRONG_THRESHOLD = 80;
export const REVIEW_MIN_SCORE = 60;

export interface DedupReviewList {
  strong: DedupCandidate[];
  review: DedupCandidate[];
}

export type ReviewerDecision = "ACCEPT" | "REJECT" | "SKIP";

export interface ReviewerDecisionRecord {
  pairId: string;
  decision: ReviewerDecision;
}

const VALID_DECISIONS: readonly ReviewerDecision[] = ["ACCEPT", "REJECT", "SKIP"];

/**
 * Membagi kandidat ke zona kuat dan review.
 * Urutan dalam tiap zona mengikuti urutan input (stabil, deterministik).
 */
export function buildDedupReviewList(candidates: DedupCandidate[]): DedupReviewList {
  const strong: DedupCandidate[] = [];
  const review: DedupCandidate[] = [];

  for (const candidate of candidates) {
    if (candidate.score >= STRONG_THRESHOLD) {
      strong.push(candidate);
    } else if (candidate.score >= REVIEW_MIN_SCORE) {
      review.push(candidate);
    }
    // Di bawah 60 diabaikan.
  }

  return { strong, review };
}

/**
 * Mencatat keputusan reviewer atas satu pasangan duplikat.
 * Pure: mengembalikan record keputusan, tanpa efek samping.
 * ACCEPT berarti merge, REJECT berarti bukan duplikat, SKIP berarti tunda.
 */
export function applyReviewerDecision(
  pairId: string,
  decision: ReviewerDecision,
): ReviewerDecisionRecord {
  if (!VALID_DECISIONS.includes(decision)) {
    throw new Error(`Keputusan reviewer tidak valid: ${String(decision)}`);
  }
  return { pairId, decision };
}

/**
 * Ringkasan antrean review, tanpa efek samping.
 */
export function reviewQueueSummary(list: DedupReviewList): {
  strongCount: number;
  reviewCount: number;
  total: number;
} {
  const strongCount = list.strong.length;
  const reviewCount = list.review.length;
  return { strongCount, reviewCount, total: strongCount + reviewCount };
}
