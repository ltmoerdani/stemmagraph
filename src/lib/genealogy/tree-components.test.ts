/**
 * Dedikasi testfile GOAL v294 fase i. Pola tree-health.test.ts.
 * Jangkar kasus: putusan PM riset 079, komponen dihitung atas graf
 * relasi FAM saja; putusan PM salvase 18 Okt menyempurnakan bacaan
 * relasi: ParentEdge (FAMC) dan UnionNode.spouses (FAMS) keduanya
 * menyambung individu, pasangan tanpa anak satu komponen.
 */

import { describe, expect, it } from 'vitest';

import { computeConnectedComponents } from './tree-components';
import {
  buildFamilyGraph,
  type IndiInput,
} from './family-graph';

function memberSets(graph: ReturnType<typeof buildFamilyGraph>): string[][] {
  return computeConnectedComponents(graph).components.map((c) =>
    [...c.members].sort(),
  );
}

describe('computeConnectedComponents', () => {
  it('t1: personIds kosong, semua hasil nol', () => {
    const graph = buildFamilyGraph([]);
    expect(computeConnectedComponents(graph)).toEqual({
      components: [],
      componentCount: 0,
      largestSize: 0,
      largestFraction: 0,
    });
  });

  it('t2: satu orang tanpa edge, satu komponen size 1 fraksi 1', () => {
    const graph = buildFamilyGraph([{ id: 'A' }]);
    const result = computeConnectedComponents(graph);
    expect(result.componentCount).toBe(1);
    expect(result.components[0]).toEqual({ members: ['A'], size: 1 });
    expect(result.largestSize).toBe(1);
    expect(result.largestFraction).toBe(1);
  });

  it('t3: keluarga inti 2 ortu 1 anak, satu komponen size 3', () => {
    const indis: IndiInput[] = [
      { id: 'GF', fams: ['F1'] },
      { id: 'GM', fams: ['F1'] },
      { id: 'C', famc: [{ fam: 'F1' }] },
    ];
    const graph = buildFamilyGraph(indis);
    const result = computeConnectedComponents(graph);
    expect(result.componentCount).toBe(1);
    expect(result.largestSize).toBe(3);
    expect(memberSets(graph)).toEqual([['C', 'GF', 'GM']]);
  });

  it('t4: dua keluarga lepas, dua komponen urut size desc', () => {
    const indis: IndiInput[] = [
      { id: 'P1', fams: ['F1'] },
      { id: 'P2', fams: ['F1'] },
      { id: 'C1', famc: [{ fam: 'F1' }] },
      { id: 'Q1', fams: ['F2'] },
      { id: 'Q2', fams: ['F2'] },
      { id: 'C2', famc: [{ fam: 'F2' }] },
    ];
    const graph = buildFamilyGraph(indis);
    const result = computeConnectedComponents(graph);
    expect(result.componentCount).toBe(2);
    expect(result.largestSize).toBe(3);
    expect(memberSets(graph)).toEqual([
      ['C1', 'P1', 'P2'],
      ['C2', 'Q1', 'Q2'],
    ]);
  });

  it('t5: remarriage, anak dari dua FAM ortu sama menyatu', () => {
    const indis: IndiInput[] = [
      { id: 'A', fams: ['F1', 'F2'] },
      { id: 'B', fams: ['F1', 'F2'] },
      { id: 'C', famc: [{ fam: 'F1' }] },
      { id: 'D', famc: [{ fam: 'F2' }] },
    ];
    const graph = buildFamilyGraph(indis);
    const result = computeConnectedComponents(graph);
    expect(result.componentCount).toBe(1);
    expect(result.largestSize).toBe(4);
    expect(memberSets(graph)).toEqual([['A', 'B', 'C', 'D']]);
  });

  it('t6: menantu sepupu, DAG leluhur duplikat tetap satu komponen', () => {
    const indis: IndiInput[] = [
      { id: 'GP1', fams: ['F1'] },
      { id: 'GP2', fams: ['F1'] },
      { id: 'P1', famc: [{ fam: 'F1' }], fams: ['F3'] },
      { id: 'P2', famc: [{ fam: 'F1' }], fams: ['F4'] },
      { id: 'C1', famc: [{ fam: 'F3' }], fams: ['F5'] },
      { id: 'C2', famc: [{ fam: 'F4' }], fams: ['F5'] },
      { id: 'E', famc: [{ fam: 'F5' }] },
    ];
    const graph = buildFamilyGraph(indis);
    const result = computeConnectedComponents(graph);
    expect(result.componentCount).toBe(1);
    expect(result.largestSize).toBe(7);
    expect(result.largestFraction).toBe(1);
  });

  it('t7: tie size sama, urut anggota pertama asc', () => {
    // Tiga keluarga inti size 3 semua; deklarasi keluarga C lebih
    // dulu, tie-break memaksa urutan A, B, C.
    const indis: IndiInput[] = [
      { id: 'Cf', fams: ['FC'] },
      { id: 'Cm', fams: ['FC'] },
      { id: 'Cc', famc: [{ fam: 'FC' }] },
      { id: 'Af', fams: ['FA'] },
      { id: 'Am', fams: ['FA'] },
      { id: 'Ac', famc: [{ fam: 'FA' }] },
      { id: 'Bf', fams: ['FB'] },
      { id: 'Bm', fams: ['FB'] },
      { id: 'Bc', famc: [{ fam: 'FB' }] },
    ];
    const graph = buildFamilyGraph(indis);
    const result = computeConnectedComponents(graph);
    expect(result.componentCount).toBe(3);
    expect(result.components.map((c) => c.size)).toEqual([3, 3, 3]);
    expect(result.components.map((c) => c.members[0])).toEqual([
      'Af',
      'Bf',
      'Cf',
    ]);
  });

  it('t8: anak angkat PEDI adopted tetap sisi sah', () => {
    const indis: IndiInput[] = [
      { id: 'F', fams: ['F1'] },
      { id: 'M', fams: ['F1'] },
      { id: 'C', famc: [{ fam: 'F1', pedi: 'adopted' }] },
    ];
    const graph = buildFamilyGraph(indis);
    const result = computeConnectedComponents(graph);
    expect(result.componentCount).toBe(1);
    expect(result.largestSize).toBe(3);
  });

  it('t9: person yatim tanpa FAMC, komponen sendirian', () => {
    const indis: IndiInput[] = [
      { id: 'A', fams: ['F1'] },
      { id: 'B', fams: ['F1'] },
      { id: 'C', famc: [{ fam: 'F1' }] },
      { id: 'Z' },
    ];
    const graph = buildFamilyGraph(indis);
    const result = computeConnectedComponents(graph);
    expect(result.componentCount).toBe(2);
    // Urutan members mengikuti penemuan BFS: dari A menyusul C
    // (edge FAMC), baru B dicapai lewat C.
    expect(result.components).toEqual([
      { members: ['A', 'C', 'B'], size: 3 },
      { members: ['Z'], size: 1 },
    ]);
    expect(result.largestFraction).toBe(0.75);
  });

  it('t10: fraksi eksak 3 dari 5', () => {
    const indis: IndiInput[] = [
      { id: 'P1', fams: ['F1'] },
      { id: 'P2', fams: ['F1'] },
      { id: 'C1', famc: [{ fam: 'F1' }] },
      { id: 'D' },
      { id: 'E' },
    ];
    const graph = buildFamilyGraph(indis);
    const result = computeConnectedComponents(graph);
    expect(result.largestSize).toBe(3);
    expect(result.largestFraction).toBe(0.6);
  });

  it('t11: rantai 3 generasi, depth tak pengaruhi size', () => {
    const indis: IndiInput[] = [
      { id: 'G', fams: ['F1'] },
      { id: 'P', famc: [{ fam: 'F1' }], fams: ['F2'] },
      { id: 'C1', famc: [{ fam: 'F2' }] },
      { id: 'C2', famc: [{ fam: 'F2' }] },
    ];
    const graph = buildFamilyGraph(indis);
    const result = computeConnectedComponents(graph);
    expect(result.componentCount).toBe(1);
    expect(result.largestSize).toBe(4);
  });

  it('t12: determinisme, input sama output deep-equal dua kali', () => {
    const indis: IndiInput[] = [
      { id: 'P1', fams: ['F1'] },
      { id: 'P2', fams: ['F1'] },
      { id: 'C1', famc: [{ fam: 'F1' }] },
      { id: 'Q1', fams: ['F2'] },
    ];
    const graph = buildFamilyGraph(indis);
    expect(computeConnectedComponents(graph)).toEqual(
      computeConnectedComponents(graph),
    );
  });

  it('t13: pasangan FAMS tanpa FAMC satu komponen (putusan PM)', () => {
    // Sisi pasangan dibaca dari UnionNode.spouses (putusan PM
    // salvase 18 Okt): semantik GEDCOM FAM menyatukan HUSB WIFE
    // CHIL dalam satu record, kontrak v294 menyebut relasi
    // pasangan, sehingga pasangan tanpa anak tetap satu komponen.
    const indis: IndiInput[] = [
      { id: 'H', fams: ['F1'] },
      { id: 'W', fams: ['F1'] },
    ];
    const graph = buildFamilyGraph(indis);
    const result = computeConnectedComponents(graph);
    expect(result.componentCount).toBe(1);
    expect(memberSets(graph)).toEqual([['H', 'W']]);
    expect(result.largestSize).toBe(2);
    expect(result.largestFraction).toBe(1);
  });

  it('t14: invarian, tanpa dobel, size integer positif, jumlah sama total', () => {
    const indis: IndiInput[] = [
      { id: 'P1', fams: ['F1'] },
      { id: 'P2', fams: ['F1'] },
      { id: 'C1', famc: [{ fam: 'F1' }] },
      { id: 'Q1', fams: ['F2'] },
      { id: 'Q2', fams: ['F2'] },
      { id: 'Q3', famc: [{ fam: 'F2' }] },
      { id: 'Z' },
    ];
    const graph = buildFamilyGraph(indis);
    const result = computeConnectedComponents(graph);
    const allMembers = result.components.flatMap((c) => c.members);
    expect(new Set(allMembers).size).toBe(allMembers.length);
    expect(new Set(allMembers)).toEqual(new Set(graph.personIds));
    const totalSize = result.components.reduce((acc, c) => acc + c.size, 0);
    expect(totalSize).toBe(graph.personIds.length);
    for (const component of result.components) {
      expect(Number.isInteger(component.size)).toBe(true);
      expect(component.size).toBeGreaterThan(0);
      expect(component.size).toBe(component.members.length);
    }
  });

  it('t15: urutan input tidak mengubah partisi, count, dan fraksi', () => {
    const a: IndiInput[] = [
      { id: 'P1', fams: ['F1'] },
      { id: 'P2', fams: ['F1'] },
      { id: 'C1', famc: [{ fam: 'F1' }] },
      { id: 'Q1', fams: ['F2'] },
      { id: 'Q2', fams: ['F2'] },
    ];
    const b: IndiInput[] = [
      { id: 'Q2', fams: ['F2'] },
      { id: 'C1', famc: [{ fam: 'F1' }] },
      { id: 'P2', fams: ['F1'] },
      { id: 'Q1', fams: ['F2'] },
      { id: 'P1', fams: ['F1'] },
    ];
    const ra = computeConnectedComponents(buildFamilyGraph(a));
    const rb = computeConnectedComponents(buildFamilyGraph(b));
    expect(rb.componentCount).toBe(ra.componentCount);
    expect(rb.largestSize).toBe(ra.largestSize);
    expect(rb.largestFraction).toBe(ra.largestFraction);
    expect(memberSets(buildFamilyGraph(b))).toEqual(
      memberSets(buildFamilyGraph(a)),
    );
  });
});
