/**
 * Dedikasi testfile GOAL v295 fase i. Pola mirror tree-health.test.ts
 * (v292): vitest, import langsung modul pure, tanpa mock server.
 * Kasus mengikuti kontrak v295: happy path dua generasi, rantai tiga
 * generasi, dua ortu satu anak, ortu tanpa tahun (skipped), semua
 * gugur, graph kosong, anak lebih tua (negativeCount), min max
 * distribusi lebar, pembulatan 1 desimal, determinisme shuffle, dan
 * tahun lahir negatif (sebelum Masehi).
 */

import { describe, expect, it } from 'vitest';

import { computeAverageGenerationLength } from './generation-length';
import {
  buildFamilyGraph,
  type IndiInput,
} from './family-graph';

function yearsMap(entries: Record<string, number | null | undefined>) {
  return new Map<string, number | null | undefined>(
    Object.entries(entries),
  );
}

describe('computeAverageGenerationLength', () => {
  it('t1: dasar satu anak dua ortu, dua kontribusi', () => {
    const indis: IndiInput[] = [
      { id: 'P1', fams: ['F1'] },
      { id: 'P2', fams: ['F1'] },
      { id: 'C', famc: [{ fam: 'F1' }] },
    ];
    const graph = buildFamilyGraph(indis);
    const result = computeAverageGenerationLength(
      graph,
      yearsMap({ P1: 1940, P2: 1942, C: 1965 }),
    );
    expect(result.pairCount).toBe(2);
    expect(result.skippedMissing).toBe(0);
    expect(result.negativeCount).toBe(0);
    expect(result.minYears).toBe(23);
    expect(result.maxYears).toBe(25);
    expect(result.averageYears).toBe(24);
  });

  it('t2: happy path dua generasi GF1 ke F ke C', () => {
    const indis: IndiInput[] = [
      { id: 'GF1', fams: ['F1'] },
      { id: 'GM1', fams: ['F1'] },
      { id: 'F', fams: ['F2'], famc: [{ fam: 'F1' }] },
      { id: 'M', fams: ['F2'] },
      { id: 'C', famc: [{ fam: 'F2' }] },
    ];
    const graph = buildFamilyGraph(indis);
    const result = computeAverageGenerationLength(
      graph,
      yearsMap({ GF1: 1920, GM1: 1922, F: 1948, M: 1950, C: 1975 }),
    );
    expect(result.pairCount).toBe(4);
    // Kontribusi 28, 26, 27, 25: total 106 dari 4 pasangan.
    expect(result.averageYears).toBe(26.5);
    expect(result.negativeCount).toBe(0);
    expect(result.skippedMissing).toBe(0);
  });

  it('t3: rantai tiga generasi berantai rata merata', () => {
    const indis: IndiInput[] = [
      { id: 'A', fams: ['F1'] },
      { id: 'B', fams: ['F2'], famc: [{ fam: 'F1' }] },
      { id: 'C', fams: ['F3'], famc: [{ fam: 'F2' }] },
      { id: 'D', famc: [{ fam: 'F3' }] },
    ];
    const graph = buildFamilyGraph(indis);
    const result = computeAverageGenerationLength(
      graph,
      yearsMap({ A: 1900, B: 1930, C: 1960, D: 1990 }),
    );
    expect(result.pairCount).toBe(3);
    expect(result.minYears).toBe(30);
    expect(result.maxYears).toBe(30);
    expect(result.averageYears).toBe(30);
  });

  it('t4: anak dua ortu dihitung dua edge terpisah', () => {
    const indis: IndiInput[] = [
      { id: 'P1', fams: ['F1'] },
      { id: 'P2', fams: ['F1'] },
      { id: 'C', famc: [{ fam: 'F1' }] },
    ];
    const graph = buildFamilyGraph(indis);
    const result = computeAverageGenerationLength(
      graph,
      yearsMap({ P1: 1950, P2: 1970, C: 1995 }),
    );
    // Dua ortu satu anak: dua kontribusi, 45 dan 25.
    expect(result.pairCount).toBe(2);
    expect(result.minYears).toBe(25);
    expect(result.maxYears).toBe(45);
    expect(result.averageYears).toBe(35);
  });

  it('t5: satu ortu tanpa tahun gugur, average dari edge valid', () => {
    const indis: IndiInput[] = [
      { id: 'P1', fams: ['F1'] },
      { id: 'P2', fams: ['F1'] },
      { id: 'C', famc: [{ fam: 'F1' }] },
    ];
    const graph = buildFamilyGraph(indis);
    const result = computeAverageGenerationLength(
      graph,
      yearsMap({ P1: null, P2: 1940, C: 1965 }),
    );
    expect(result.pairCount).toBe(1);
    expect(result.skippedMissing).toBe(1);
    expect(result.averageYears).toBe(25);
  });

  it('t6: anak tanpa tahun, dua ortu, dua guguran', () => {
    const indis: IndiInput[] = [
      { id: 'P1', fams: ['F1'] },
      { id: 'P2', fams: ['F1'] },
      { id: 'C', famc: [{ fam: 'F1' }] },
    ];
    const graph = buildFamilyGraph(indis);
    const result = computeAverageGenerationLength(
      graph,
      yearsMap({ P1: 1940, P2: undefined, C: null }),
    );
    expect(result.pairCount).toBe(0);
    expect(result.skippedMissing).toBe(2);
    expect(result.negativeCount).toBe(0);
    expect(result.averageYears).toBeNull();
    expect(result.minYears).toBeNull();
    expect(result.maxYears).toBeNull();
  });

  it('t7: semua edge gugur karena seluruh tahun null', () => {
    const indis: IndiInput[] = [
      { id: 'P1', fams: ['F1'] },
      { id: 'P2', fams: ['F1'] },
      { id: 'C', famc: [{ fam: 'F1' }] },
    ];
    const graph = buildFamilyGraph(indis);
    const result = computeAverageGenerationLength(
      graph,
      yearsMap({ P1: null, P2: null, C: null }),
    );
    expect(result.pairCount).toBe(0);
    expect(result.skippedMissing).toBe(2);
    expect(result.negativeCount).toBe(0);
    expect(result.averageYears).toBeNull();
  });

  it('t8: graph kosong tanpa edge menghasilkan null semua', () => {
    const graph = buildFamilyGraph([{ id: 'A' }]);
    const result = computeAverageGenerationLength(
      graph,
      yearsMap({ A: 1990 }),
    );
    expect(result.pairCount).toBe(0);
    expect(result.skippedMissing).toBe(0);
    expect(result.negativeCount).toBe(0);
    expect(result.averageYears).toBeNull();
    expect(result.minYears).toBeNull();
    expect(result.maxYears).toBeNull();
  });

  it('t9: anak lebih tua, length negatif masuk rata-rata', () => {
    const indis: IndiInput[] = [
      { id: 'P', fams: ['F1'] },
      { id: 'C', famc: [{ fam: 'F1' }] },
    ];
    const graph = buildFamilyGraph(indis);
    const result = computeAverageGenerationLength(
      graph,
      yearsMap({ P: 1950, C: 1945 }),
    );
    expect(result.pairCount).toBe(1);
    expect(result.negativeCount).toBe(1);
    expect(result.minYears).toBe(-5);
    expect(result.maxYears).toBe(-5);
    expect(result.averageYears).toBe(-5);
  });

  it('t10: distribusi lebar, min dan max nilai mentah benar', () => {
    const indis: IndiInput[] = [
      { id: 'P1', fams: ['F1'] },
      { id: 'P2', fams: ['F1'] },
      { id: 'C', famc: [{ fam: 'F1' }] },
    ];
    const graph = buildFamilyGraph(indis);
    const result = computeAverageGenerationLength(
      graph,
      yearsMap({ P1: 1900, P2: 1950, C: 1990 }),
    );
    expect(result.pairCount).toBe(2);
    expect(result.minYears).toBe(40);
    expect(result.maxYears).toBe(90);
    expect(result.averageYears).toBe(65);
  });

  it('t11: pembulatan 1 desimal pada rata-rata berulang desimal', () => {
    const indis: IndiInput[] = [
      { id: 'P1', fams: ['F1'] },
      { id: 'P2', fams: ['F1'] },
      { id: 'C1', famc: [{ fam: 'F1' }] },
      { id: 'P3', fams: ['F2'] },
      { id: 'C2', famc: [{ fam: 'F2' }] },
    ];
    const graph = buildFamilyGraph(indis);
    // Kontribusi 25, 26, 26: total 77 dari 3 pasangan, 25.666
    // dibulatkan 25.7.
    const result = computeAverageGenerationLength(
      graph,
      yearsMap({ P1: 1965, P2: 1964, C1: 1990, P3: 1964, C2: 1990 }),
    );
    expect(result.pairCount).toBe(3);
    expect(result.averageYears).toBe(25.7);
    expect(result.minYears).toBe(25);
    expect(result.maxYears).toBe(26);
  });

  it('t12: determinisme, shuffle urutan input hasil identik', () => {
    const indisA: IndiInput[] = [
      { id: 'P1', fams: ['F1'] },
      { id: 'P2', fams: ['F1'] },
      { id: 'C', famc: [{ fam: 'F1' }] },
      { id: 'GF', fams: ['F2'] },
      { id: 'M', fams: ['F2'], famc: [{ fam: 'F1' }] },
    ];
    const indisB = [...indisA].reverse();
    const years = yearsMap({ P1: 1930, P2: 1932, C: 1960, GF: 1905, M: 1958 });
    const resultA = computeAverageGenerationLength(
      buildFamilyGraph(indisA),
      years,
    );
    const resultB = computeAverageGenerationLength(
      buildFamilyGraph(indisB),
      years,
    );
    expect(resultA).toEqual(resultB);
    expect(resultA.pairCount).toBe(4);
  });

  it('t13: tahun lahir negatif sebelum Masehi tetap terhitung', () => {
    const indis: IndiInput[] = [
      { id: 'P', fams: ['F1'] },
      { id: 'C', famc: [{ fam: 'F1' }] },
    ];
    const graph = buildFamilyGraph(indis);
    const result = computeAverageGenerationLength(
      graph,
      yearsMap({ P: -50, C: -25 }),
    );
    expect(result.pairCount).toBe(1);
    expect(result.averageYears).toBe(25);
    expect(result.negativeCount).toBe(0);
  });

  it('t14: NaN digugurkan ke skippedMissing tanpa ke avg', () => {
    const indis: IndiInput[] = [
      { id: 'P1', fams: ['F1'] },
      { id: 'P2', fams: ['F1'] },
      { id: 'C', famc: [{ fam: 'F1' }] },
    ];
    const graph = buildFamilyGraph(indis);
    const result = computeAverageGenerationLength(
      graph,
      yearsMap({ P1: Number.NaN, P2: 1940, C: 1965 }),
    );
    expect(result.pairCount).toBe(1);
    expect(result.skippedMissing).toBe(1);
    expect(result.averageYears).toBe(25);
  });
});
