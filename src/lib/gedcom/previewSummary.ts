/**
 * v417 fase 1: pemetaan hasil pipeline dry-run ke ringkasan respons
 * preview GEDCOM.
 *
 * Satu fungsi murni agar angka di body JSON punya satu sumber kebenaran
 * dan bisa diuji unit tanpa server. Tidak ada efek samping.
 *
 * Modul PURE: tanpa DB, tanpa server, tanpa filesystem.
 */
import type { MergePlan, MergePlanEntry } from './importMergePlan';

export interface PreviewSummary {
  /** Jumlah entri merge plan (INDI + FAM yang bisa dinilai). */
  total: number;
  new: number;
  matchCandidate: number;
  skipped: number;
  /** Jumlah baris tertolak import-gate. */
  gateRejectCount: number;
  /** Anggota rencana import yang tersarankan living. */
  livingAffected: number;
}

function countByStatus(
  entries: MergePlanEntry[],
): { new: number; matchCandidate: number; skipped: number } {
  let newCount = 0;
  let matchCount = 0;
  let skippedCount = 0;
  for (const entry of entries) {
    if (entry.status === 'NEW') newCount += 1;
    else if (entry.status === 'MATCH_CANDIDATE') matchCount += 1;
    else skippedCount += 1;
  }
  return { new: newCount, matchCandidate: matchCount, skipped: skippedCount };
}

export function buildPreviewSummary(
  mergePlan: MergePlan,
  gateRejectCount: number,
  livingAffected: number,
): PreviewSummary {
  const counts = countByStatus(mergePlan.entries);
  return {
    total: mergePlan.entries.length,
    new: counts.new,
    matchCandidate: counts.matchCandidate,
    skipped: counts.skipped,
    gateRejectCount,
    livingAffected,
  };
}
