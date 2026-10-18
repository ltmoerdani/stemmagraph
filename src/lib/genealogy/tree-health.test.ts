/**
 * Dedikasi testfile GOAL v292 fase i. Pola family-graph.test.ts.
 * Jangkar kasus 13: Wikipedia EN Pedigree collapse (addendum 1):
 * anak dua sepupu pertama maksimal 6 kakek buyut berbeda dari 8
 * slot generasi 3.
 */

import { describe, expect, it } from 'vitest';

import {
  computeGenerationDepth,
  computePedigreeCompleteness,
} from './tree-health';
import {
  buildFamilyGraph,
  type IndiInput,
} from './family-graph';

describe('computeGenerationDepth', () => {
  it('t1: node tunggal depth 0 dua arah', () => {
    const graph = buildFamilyGraph([{ id: 'A' }]);
    expect(computeGenerationDepth(graph, 'A')).toEqual({
      ancestral: 0,
      descendant: 0,
    });
  });

  it('t2: tiga generasi, C ancestral 2, GF1 descendant 2', () => {
    const indis: IndiInput[] = [
      { id: 'GF1', fams: ['F1'] },
      { id: 'GM1', fams: ['F1'] },
      { id: 'GF2', fams: ['F2'] },
      { id: 'GM2', fams: ['F2'] },
      { id: 'F', fams: ['F3'], famc: [{ fam: 'F1' }, { fam: 'F2' }] },
      { id: 'M', fams: ['F3'] },
      { id: 'C', famc: [{ fam: 'F3' }] },
    ];
    const graph = buildFamilyGraph(indis);
    expect(computeGenerationDepth(graph, 'C')).toEqual({
      ancestral: 2,
      descendant: 0,
    });
    expect(computeGenerationDepth(graph, 'GF1')).toEqual({
      ancestral: 0,
      descendant: 2,
    });
  });

  it('t3: loop A-B-A selesai tanpa hangus via visited set', () => {
    const indis: IndiInput[] = [
      { id: 'A', fams: ['FL'], famc: [{ fam: 'FL' }] },
      { id: 'B', fams: ['FL'] },
    ];
    const graph = buildFamilyGraph(indis);
    const d = computeGenerationDepth(graph, 'A');
    // A leluhur dirinya via edge loop (ancestral 1, B); turunnya
    // kembali ke A yang sudah di visited, jadi descendant 0.
    expect(d.ancestral).toBe(1);
    expect(d.descendant).toBe(0);
  });

  it('t4: depth struktural menghitung anak adopsi', () => {
    const indis: IndiInput[] = [
      { id: 'P1', fams: ['F1'] },
      { id: 'P2', fams: ['F1'] },
      { id: 'C', famc: [{ fam: 'F1', pedi: 'adopted' }] },
    ];
    const graph = buildFamilyGraph(indis);
    expect(computeGenerationDepth(graph, 'C').ancestral).toBe(1);
  });

  it('t5: descendant depth anak dari dua pernikahan', () => {
    const indis: IndiInput[] = [
      { id: 'P', fams: ['F1', 'F2'] },
      { id: 'X1', fams: ['F1'] },
      { id: 'X2', fams: ['F2'] },
      { id: 'S1', famc: [{ fam: 'F1' }] },
      { id: 'S2', famc: [{ fam: 'F2' }] },
    ];
    const graph = buildFamilyGraph(indis);
    expect(computeGenerationDepth(graph, 'P').descendant).toBe(1);
  });

  it('t6: graph kosong depth 0', () => {
    const graph = buildFamilyGraph([]);
    expect(computeGenerationDepth(graph, 'X')).toEqual({
      ancestral: 0,
      descendant: 0,
    });
  });

  it('t7: root nihil aman depth 0', () => {
    const graph = buildFamilyGraph([{ id: 'A' }]);
    expect(computeGenerationDepth(graph, 'NOPE')).toEqual({
      ancestral: 0,
      descendant: 0,
    });
  });
});

describe('computePedigreeCompleteness', () => {
  const fullThree = (): IndiInput[] => [
    { id: 'GG1', fams: ['FG1'] },
    { id: 'GG2', fams: ['FG1'] },
    { id: 'GG3', fams: ['FG2'] },
    { id: 'GG4', fams: ['FG2'] },
    { id: 'GG5', fams: ['FG3'] },
    { id: 'GG6', fams: ['FG3'] },
    { id: 'GG7', fams: ['FG4'] },
    { id: 'GG8', fams: ['FG4'] },
    { id: 'GF1', fams: ['F1'], famc: [{ fam: 'FG1' }] },
    { id: 'GM1', fams: ['F1'], famc: [{ fam: 'FG2' }] },
    { id: 'GF2', fams: ['F2'], famc: [{ fam: 'FG3' }] },
    { id: 'GM2', fams: ['F2'], famc: [{ fam: 'FG4' }] },
    { id: 'F', fams: ['F3'], famc: [{ fam: 'F1' }, { fam: 'F2' }] },
    { id: 'M', fams: ['F3'] },
    { id: 'C', famc: [{ fam: 'F3' }] },
  ];

  it('t8: tiga generasi lengkap fraction 1 per generasi', () => {
    const graph = buildFamilyGraph(fullThree());
    const rows = computePedigreeCompleteness(graph, 'C', 3);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toEqual({ generation: 1, known: 2, total: 2, fraction: 1 });
    expect(rows[1]).toEqual({ generation: 2, known: 4, total: 4, fraction: 1 });
    expect(rows[2]).toEqual({ generation: 3, known: 8, total: 8, fraction: 1 });
  });

  it('t9: satu sisi orang tua fraction 0,5 generasi 1', () => {
    const indis: IndiInput[] = [
      { id: 'P1', fams: ['F1'] },
      { id: 'C', famc: [{ fam: 'F1' }] },
    ];
    const graph = buildFamilyGraph(indis);
    const rows = computePedigreeCompleteness(graph, 'C', 1);
    expect(rows[0]).toEqual({ generation: 1, known: 1, total: 2, fraction: 0.5 });
  });

  it('t10: anak adopsi tidak masuk pedigree darah', () => {
    const indis: IndiInput[] = [
      { id: 'P1', fams: ['F1'] },
      { id: 'P2', fams: ['F1'] },
      { id: 'C', famc: [{ fam: 'F1', pedi: 'adopted' }] },
    ];
    const graph = buildFamilyGraph(indis);
    const rows = computePedigreeCompleteness(graph, 'C', 1);
    expect(rows[0].known).toBe(0);
    expect(rows[0].fraction).toBe(0);
  });

  it('t11: maxGenerations 0 array kosong', () => {
    const graph = buildFamilyGraph([{ id: 'A' }]);
    expect(computePedigreeCompleteness(graph, 'A', 0)).toEqual([]);
  });

  it('t12: generasi kosong fraction 0 dan invariant known/total', () => {
    const graph = buildFamilyGraph([{ id: 'A' }]);
    const rows = computePedigreeCompleteness(graph, 'A', 3);
    expect(rows[0]).toEqual({ generation: 1, known: 0, total: 2, fraction: 0 });
    expect(rows[2]).toEqual({ generation: 3, known: 0, total: 8, fraction: 0 });
    for (const row of rows) {
      expect(Number.isInteger(row.known)).toBe(true);
      expect(Number.isInteger(row.total)).toBe(true);
      expect(row.known).toBeGreaterThanOrEqual(0);
      expect(row.fraction).toBe(row.known / row.total);
    }
  });

  it('t13: pedigree collapse anak dua sepupu pertama, generasi 3 known 6 dari 8', () => {
    // UDA dan ADE bersaudara kandung (ortu KK1, KN1). F anak UDA,
    // M anak ADE, jadi F dan M sepupu pertama. Kakek buyut C:
    // KK1, KN1 (dipakai dua kali, dihitung sekali), KI1, KI2
    // (ortu IBU), KM1, KM2 (ortu MTA) = 6 unik dari 8 slot.
    const indis: IndiInput[] = [
      { id: 'KK1', fams: ['FS'] },
      { id: 'KN1', fams: ['FS'] },
      { id: 'KI1', fams: ['FI'] },
      { id: 'KI2', fams: ['FI'] },
      { id: 'KM1', fams: ['FMM'] },
      { id: 'KM2', fams: ['FMM'] },
      { id: 'UDA', fams: ['FP'], famc: [{ fam: 'FS' }] },
      { id: 'IBU', fams: ['FP'], famc: [{ fam: 'FI' }] },
      { id: 'ADE', fams: ['FM'], famc: [{ fam: 'FS' }] },
      { id: 'MTA', fams: ['FM'], famc: [{ fam: 'FMM' }] },
      { id: 'F', fams: ['FC'], famc: [{ fam: 'FP' }] },
      { id: 'M', fams: ['FC'], famc: [{ fam: 'FM' }] },
      { id: 'C', famc: [{ fam: 'FC' }] },
    ];
    const graph = buildFamilyGraph(indis);
    const rows = computePedigreeCompleteness(graph, 'C', 3);
    expect(rows[0]).toEqual({ generation: 1, known: 2, total: 2, fraction: 1 });
    expect(rows[1]).toEqual({ generation: 2, known: 4, total: 4, fraction: 1 });
    expect(rows[2].total).toBe(8);
    expect(rows[2].known).toBe(6);
    expect(rows[2].fraction).toBe(0.75);
  });

  it('t14: tanpa collapse struktur sama fraction 1 di generasi 3', () => {
    // Kontrol t13: ganti ADE dengan orang tua sendiri, kembali 8.
    const indis: IndiInput[] = [
      { id: 'KK1', fams: ['FS'] },
      { id: 'KN1', fams: ['FS'] },
      { id: 'KI1', fams: ['FI'] },
      { id: 'KI2', fams: ['FI'] },
      { id: 'KM1', fams: ['FMM'] },
      { id: 'KM2', fams: ['FMM'] },
      { id: 'KO1', fams: ['FO'] },
      { id: 'KO2', fams: ['FO'] },
      { id: 'UDA', fams: ['FP'], famc: [{ fam: 'FS' }] },
      { id: 'IBU', fams: ['FP'], famc: [{ fam: 'FI' }] },
      { id: 'ADE', fams: ['FM'], famc: [{ fam: 'FO' }] },
      { id: 'MTA', fams: ['FM'], famc: [{ fam: 'FMM' }] },
      { id: 'F', fams: ['FC'], famc: [{ fam: 'FP' }] },
      { id: 'M', fams: ['FC'], famc: [{ fam: 'FM' }] },
      { id: 'C', famc: [{ fam: 'FC' }] },
    ];
    const graph = buildFamilyGraph(indis);
    const rows = computePedigreeCompleteness(graph, 'C', 3);
    expect(rows[2].known).toBe(8);
    expect(rows[2].fraction).toBe(1);
  });
});
