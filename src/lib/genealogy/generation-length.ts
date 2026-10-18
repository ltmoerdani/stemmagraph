/**
 * Pure average-generation-length module untuk GOAL v295 fase i.
 *
 * Tanpa import apa pun kecuali tipe dari family-graph (yang juga
 * pure). Metrik: computeAverageGenerationLength menghitung panjang
 * generasi rata-rata dari pasangan ortu-anak pada graph. Untuk tiap
 * ParentEdge dan tiap ortu di edge.parents, bila tahun lahir anak
 * dan ortu keduanya number, length = birthYear(child) dikurangi
 * birthYear(parent). Satu anak dengan dua ortu menghasilkan dua
 * kontribusi terpisah (preseden parentEdges buildFamilyGraph).
 *
 * Pasangan dengan tahun lahir anak atau ortu nihil (undefined,
 * null, NaN) digugurkan dari rata-rata dan dihitung di
 * skippedMissing. Length negatif (anak tercatat lebih tua dari
 * ortu, data anomali) tetap masuk rata-rata, data-driven tanpa
 * penyembunyian, dan dihitung di negativeCount agar konsumen bisa
 * menilai kualitas data.
 *
 * Definisi generation length adalah definisi internal [inferensi],
 * TIDAK diklaim sebagai formula standar webtrees; jangkar metrik
 * "average generation length" tab Tree health terverifikasi di
 * README MagicSunday/webtrees-statistics (wake-41 dan wake-42).
 * Pembulatan 1 desimal konsisten pola v287 family-size average.
 */

import type { FamilyGraph } from './family-graph';

export interface GenerationLengthResult {
  pairCount: number;
  skippedMissing: number;
  negativeCount: number;
  minYears: number | null;
  maxYears: number | null;
  averageYears: number | null;
}

type BirthYears = Map<string, number | null | undefined>;

function isKnownYear(value: number | null | undefined): value is number {
  return typeof value === 'number' && !Number.isNaN(value);
}

/**
 * Rata-rata panjang generasi graph penuh. Graph tanpa edge atau
 * seluruh pasangan gugur menghasilkan averageYears, minYears, dan
 * maxYears null; skippedMissing tetap terisi. Hasil deterministik
 * terhadap urutan edge karena penjumlahan tidak bergantung urutan.
 * min dan max memakai nilai mentah sebelum pembulatan; hanya
 * averageYears yang dibulatkan 1 desimal.
 */
export function computeAverageGenerationLength(
  graph: FamilyGraph,
  birthYears: BirthYears,
): GenerationLengthResult {
  const lengths: number[] = [];
  let skippedMissing = 0;
  let negativeCount = 0;

  for (const edge of graph.parentEdges) {
    const childYear = birthYears.get(edge.child);
    if (!isKnownYear(childYear)) {
      skippedMissing += edge.parents.length;
      continue;
    }
    for (const parent of edge.parents) {
      const parentYear = birthYears.get(parent);
      if (!isKnownYear(parentYear)) {
        skippedMissing += 1;
        continue;
      }
      const length = childYear - parentYear;
      if (length < 0) {
        negativeCount += 1;
      }
      lengths.push(length);
    }
  }

  const pairCount = lengths.length;
  if (pairCount === 0) {
    return {
      pairCount,
      skippedMissing,
      negativeCount,
      minYears: null,
      maxYears: null,
      averageYears: null,
    };
  }

  const total = lengths.reduce((sum, value) => sum + value, 0);
  const minYears = Math.min(...lengths);
  const maxYears = Math.max(...lengths);
  const averageYears = Math.round((total / pairCount) * 10) / 10;

  return {
    pairCount,
    skippedMissing,
    negativeCount,
    minYears,
    maxYears,
    averageYears,
  };
}
