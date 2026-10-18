import { describe, expect, it } from 'vitest';
import type { FamilyGraph, ParentEdge } from '../genealogy/family-graph';
import { mostInfluentialAncestors } from './most-influential-ancestors';

const edge = (
  child: string,
  fam: string,
  parents: string[],
): ParentEdge => ({ child, fam, parents });

const graphOf = (
  personIds: string[],
  parentEdges: ParentEdge[],
): FamilyGraph => ({ personIds, unions: [], parentEdges });

describe('mostInfluentialAncestors', () => {
  it('kasus 1: satu leluhur satu anak hitung 1', () => {
    const graph = graphOf(
      ['p1', 'c1'],
      [edge('c1', 'f1', ['p1'])],
    );

    expect(mostInfluentialAncestors(graph)).toEqual([
      { personId: 'p1', descendantCount: 1 },
    ]);
  });

  it('kasus 2: rantai 3 generasi leluhur puncak menghitung semua turunan transitif', () => {
    const graph = graphOf(
      ['gp', 'p', 'c'],
      [edge('p', 'f1', ['gp']), edge('c', 'f2', ['p'])],
    );

    expect(mostInfluentialAncestors(graph)).toEqual([
      { personId: 'gp', descendantCount: 2 },
      { personId: 'p', descendantCount: 1 },
    ]);
  });

  it('kasus 3: pasangan dengan anak bersama sama-sama kandidat count sama', () => {
    const graph = graphOf(
      ['ayah', 'ibu', 'c1'],
      [edge('c1', 'f1', ['ayah', 'ibu'])],
    );

    expect(mostInfluentialAncestors(graph)).toEqual([
      { personId: 'ayah', descendantCount: 1 },
      { personId: 'ibu', descendantCount: 1 },
    ]);
  });

  it('kasus 4: pedigree collapse kakek lewat 2 jalur dihitung sekali per orang', () => {
    // Kakek gp punya anak a dan b. Anak a punya anak x, anak b punya
    // anak y. x dan y menikah lalu punya anak z, sehingga z terjangkau
    // dari gp lewat dua jalur sekaligus.
    const graph = graphOf(
      ['gp', 'a', 'b', 'x', 'y', 'z'],
      [
        edge('a', 'f1', ['gp']),
        edge('b', 'f2', ['gp']),
        edge('x', 'f3', ['a']),
        edge('y', 'f4', ['b']),
        edge('z', 'f5', ['x', 'y']),
      ],
    );

    expect(mostInfluentialAncestors(graph)).toEqual([
      { personId: 'gp', descendantCount: 5 },
      { personId: 'a', descendantCount: 2 },
      { personId: 'b', descendantCount: 2 },
      { personId: 'x', descendantCount: 1 },
      { personId: 'y', descendantCount: 1 },
    ]);
  });

  it('kasus 5: count sama tie-break personId ASC', () => {
    const graph = graphOf(
      ['z9', 'a1', 'k1', 'm1'],
      [edge('k1', 'f1', ['z9']), edge('m1', 'f2', ['a1'])],
    );

    expect(mostInfluentialAncestors(graph).map((r) => r.personId)).toEqual([
      'a1',
      'z9',
    ]);
  });

  it('kasus 6: urutan descendantCount DESC benar', () => {
    const graph = graphOf(
      ['besar', 'kecil', 'b1', 'b2', 'b3', 'k1'],
      [
        edge('b1', 'f1', ['besar']),
        edge('b2', 'f2', ['besar']),
        edge('b3', 'f3', ['besar']),
        edge('k1', 'f4', ['kecil']),
      ],
    );

    expect(mostInfluentialAncestors(graph)).toEqual([
      { personId: 'besar', descendantCount: 3 },
      { personId: 'kecil', descendantCount: 1 },
    ]);
  });

  it('kasus 7: topN memotong hasil', () => {
    const graph = graphOf(
      ['p1', 'p2', 'p3', 'c1', 'c2', 'c3'],
      [
        edge('c1', 'f1', ['p1']),
        edge('c2', 'f2', ['p2']),
        edge('c3', 'f3', ['p3']),
      ],
    );

    expect(mostInfluentialAncestors(graph, 2)).toEqual([
      { personId: 'p1', descendantCount: 1 },
      { personId: 'p2', descendantCount: 1 },
    ]);
  });

  it('kasus 8: topN 0 dan negatif mengembalikan array kosong', () => {
    const graph = graphOf(['p1', 'c1'], [edge('c1', 'f1', ['p1'])]);

    expect(mostInfluentialAncestors(graph, 0)).toEqual([]);
    expect(mostInfluentialAncestors(graph, -3)).toEqual([]);
  });

  it('kasus 9: graph tanpa parentEdge mengembalikan hasil kosong', () => {
    const graph = graphOf(['p1', 'p2', 'p3'], []);

    expect(mostInfluentialAncestors(graph)).toEqual([]);
  });

  it('kasus 10: orang tanpa anak dikecualikan dari hasil', () => {
    const graph = graphOf(
      ['p1', 'c1', 'c2', 'lajang'],
      [edge('c1', 'f1', ['p1']), edge('c2', 'f2', ['p1'])],
    );

    expect(mostInfluentialAncestors(graph)).toEqual([
      { personId: 'p1', descendantCount: 2 },
    ]);
  });

  it('kasus 11: remarriage anak tercatat di 2 union tetap dihitung sekali', () => {
    // Orang tua p1 menikah dua kali; anak c1 tercatat di kedua FAM,
    // anak d1 hanya di union kedua. Dedup membuat count tetap 2.
    const graph = graphOf(
      ['p1', 'c1', 'd1'],
      [
        edge('c1', 'fam-a', ['p1']),
        edge('c1', 'fam-b', ['p1']),
        edge('d1', 'fam-b', ['p1']),
      ],
    );

    expect(mostInfluentialAncestors(graph)).toEqual([
      { personId: 'p1', descendantCount: 2 },
    ]);
  });

  it('kasus 12: dua kali panggilan hasil identik (determinisme)', () => {
    const graph = graphOf(
      ['gp', 'p', 'c'],
      [edge('p', 'f1', ['gp']), edge('c', 'f2', ['p'])],
    );

    const first = mostInfluentialAncestors(graph);
    const second = mostInfluentialAncestors(graph);

    expect(second).toEqual(first);
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
  });

  it('kasus 13: tanpa argumen topN default 10 memotong rantai panjang', () => {
    const ids = Array.from({ length: 13 }, (_, i) => `p${i + 1}`);
    const edges = ids.slice(0, 12).map((parent, i) =>
      edge(ids[i + 1], `f${i + 1}`, [parent]),
    );
    const graph = graphOf(ids, edges);

    const result = mostInfluentialAncestors(graph);

    expect(result).toHaveLength(10);
    expect(result[0]).toEqual({ personId: 'p1', descendantCount: 12 });
    expect(result[9]).toEqual({ personId: 'p10', descendantCount: 3 });
  });
});
