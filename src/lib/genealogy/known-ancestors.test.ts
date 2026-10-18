/**
 * Dedikasi testfile GOAL v296 known-ancestors distribution. Pola
 * mirror generation-length.test.ts (v295): vitest, import langsung
 * modul pure plus buildFamilyGraph, tanpa mock server. Kasus
 * mengikuti kontrak v296: root tanpa ortu, rantai linear 3
 * generasi, pedigree collapse first-touch, ortu unknown slot tetap
 * terhitung, batas maxGenerations, default 8, 0 dan 21 ditolak,
 * maxGenerations non integer ditolak, rootId nihil ditolak,
 * fraction 4 desimal eksak, total slot 2^g eksak, dua ortu penuh,
 * dan determinisme dua pemanggilan deep-equal.
 */

import { describe, expect, it } from 'vitest';

import { computeKnownAncestorsDistribution } from './known-ancestors';
import {
  buildFamilyGraph,
  type IndiInput,
} from './family-graph';

function chain(length: number): ReturnType<typeof buildFamilyGraph> {
  const indis: IndiInput[] = [];
  for (let i = 0; i < length; i += 1) {
    const indi: IndiInput = { id: `p${i}` };
    if (i > 0) {
      indi.fams = [`F${i}`];
    }
    if (i < length - 1) {
      indi.famc = [{ fam: `F${i + 1}` }];
    }
    indis.push(indi);
  }
  return buildFamilyGraph(indis);
}

describe('computeKnownAncestorsDistribution', () => {
  it('t1: root pohon 1 orang tanpa ortu, generations kosong', () => {
    const graph = buildFamilyGraph([{ id: 'solo' }]);
    const result = computeKnownAncestorsDistribution(graph, 'solo');
    expect(result.rootId).toBe('solo');
    expect(result.generations).toEqual([]);
    expect(result.totalKnown).toBe(0);
  });

  it('t2: rantai linear 3 generasi, fraction 0.5 0.25 0.125', () => {
    const graph = chain(4);
    const result = computeKnownAncestorsDistribution(graph, 'p0');
    expect(result.generations).toHaveLength(3);
    expect(result.generations[0]).toEqual({ generation: 1, known: 1, total: 2, fraction: 0.5 });
    expect(result.generations[1]).toEqual({ generation: 2, known: 1, total: 4, fraction: 0.25 });
    expect(result.generations[2]).toEqual({ generation: 3, known: 1, total: 8, fraction: 0.125 });
    expect(result.totalKnown).toBe(3);
  });

  it('t3: pedigree collapse, leluhur sama dua jalur dihitung sekali di generasi terdekat', () => {
    const graph = buildFamilyGraph([
      { id: 'GP', fams: ['F3', 'F4'] },
      { id: 'GM', fams: ['F3'] },
      { id: 'GM2', fams: ['F4'] },
      { id: 'P1', fams: ['F1'], famc: [{ fam: 'F3' }] },
      { id: 'P2', fams: ['F1'], famc: [{ fam: 'F4' }] },
      { id: 'C', famc: [{ fam: 'F1' }] },
    ]);
    const result = computeKnownAncestorsDistribution(graph, 'C');
    expect(result.generations[0]).toEqual({ generation: 1, known: 2, total: 2, fraction: 1 });
    expect(result.generations[1]).toEqual({ generation: 2, known: 3, total: 4, fraction: 0.75 });
    expect(result.totalKnown).toBe(5);
  });

  it('t4: satu ortu unknown, slot tetap terhitung total', () => {
    const graph = buildFamilyGraph([
      { id: 'C', famc: [{ fam: 'F1' }] },
      { id: 'P1', fams: ['F1'] },
    ]);
    const result = computeKnownAncestorsDistribution(graph, 'C');
    expect(result.generations).toEqual([
      { generation: 1, known: 1, total: 2, fraction: 0.5 },
    ]);
    expect(result.totalKnown).toBe(1);
  });

  it('t5: maxGenerations membatasi kedalaman', () => {
    const graph = chain(5);
    const result = computeKnownAncestorsDistribution(graph, 'p0', 2);
    expect(result.maxGenerations).toBe(2);
    expect(result.generations).toHaveLength(2);
    expect(result.totalKnown).toBe(2);
  });

  it('t6: default maxGenerations 8', () => {
    const graph = chain(3);
    const result = computeKnownAncestorsDistribution(graph, 'p0');
    expect(result.maxGenerations).toBe(8);
  });

  it('t7: maxGenerations 0 ditolak error VALIDATION', () => {
    const graph = chain(2);
    expect(() => computeKnownAncestorsDistribution(graph, 'p0', 0)).toThrow(/VALIDATION/);
  });

  it('t8: maxGenerations 21 ditolak error VALIDATION', () => {
    const graph = chain(2);
    expect(() => computeKnownAncestorsDistribution(graph, 'p0', 21)).toThrow(/VALIDATION/);
  });

  it('t9: maxGenerations non integer ditolak error VALIDATION', () => {
    const graph = chain(2);
    expect(() => computeKnownAncestorsDistribution(graph, 'p0', 2.5)).toThrow(/VALIDATION/);
  });

  it('t10: rootId tidak ada di personIds ditolak error VALIDATION', () => {
    const graph = chain(2);
    expect(() => computeKnownAncestorsDistribution(graph, 'hantu')).toThrow(/VALIDATION/);
  });

  it('t11: fraction 4 desimal eksak, 1 per 16 = 0.0625', () => {
    const graph = chain(5);
    const result = computeKnownAncestorsDistribution(graph, 'p0', 4);
    expect(result.generations[3]).toEqual({
      generation: 4,
      known: 1,
      total: 16,
      fraction: 0.0625,
    });
  });

  it('t12: total slot 2^g eksak per generasi', () => {
    const graph = chain(5);
    const result = computeKnownAncestorsDistribution(graph, 'p0', 4);
    expect(result.generations.map((entry) => entry.total)).toEqual([2, 4, 8, 16]);
    expect(result.generations.map((entry) => entry.generation)).toEqual([1, 2, 3, 4]);
  });

  it('t13: dua ortu lengkap, fraction 1 di generasi pertama', () => {
    const graph = buildFamilyGraph([
      { id: 'C', famc: [{ fam: 'F1' }] },
      { id: 'P1', fams: ['F1'] },
      { id: 'P2', fams: ['F1'] },
    ]);
    const result = computeKnownAncestorsDistribution(graph, 'C');
    expect(result.generations).toEqual([
      { generation: 1, known: 2, total: 2, fraction: 1 },
    ]);
    expect(result.totalKnown).toBe(2);
  });

  it('t14: determinisme, dua pemanggilan deep-equal', () => {
    const graph = buildFamilyGraph([
      { id: 'GP', fams: ['F3', 'F4'] },
      { id: 'GM', fams: ['F3'] },
      { id: 'P1', fams: ['F1'], famc: [{ fam: 'F3' }] },
      { id: 'P2', fams: ['F1'], famc: [{ fam: 'F4' }] },
      { id: 'C', famc: [{ fam: 'F1' }] },
    ]);
    const first = computeKnownAncestorsDistribution(graph, 'C', 6);
    const second = computeKnownAncestorsDistribution(graph, 'C', 6);
    expect(first).toEqual(second);
    expect(first).not.toBe(second);
  });
});
