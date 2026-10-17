/**
 * Test dedikasi v282 fase i: computeGenerations (src/lib/stats/generations.ts).
 * Test-only, pure: nihil DB, nihil jaringan, nihil jam nyata.
 *
 * 12 kasus kontrak kukuh v282 (18 Okt 2026): kosong; satu founder; rantai
 * linear; dua root terpisah; anak dua orang tua ambil maks; diamond;
 * komponen diskontinu; siklus diputus deterministik tanpa hang; rantai
 * panjang 10; urutan input acak identik; dua jalur ambil maks; campuran
 * valid dan orphan.
 */
import { describe, expect, it } from 'vitest';
import { computeGenerations, type GenerationEdge } from './generations';

function edge(childId: string, parentId: string): GenerationEdge {
  return { childId, parentId };
}

describe('v282 computeGenerations fase i', () => {
  it('kasus 1: nihil edge menghasilkan objek kosong dan count 0', () => {
    expect(computeGenerations([])).toEqual({
      depthByMember: {},
      generationCount: 0,
    });
  });

  it('kasus 2: satu founder depth 1, anaknya depth 2', () => {
    const r = computeGenerations([edge('c1', 'p1')]);
    expect(r.depthByMember).toEqual({ c1: 2, p1: 1 });
    expect(r.generationCount).toBe(2);
  });

  it('kasus 3: rantai linear 4 anggota depth bertingkat', () => {
    const r = computeGenerations([
      edge('c1', 'p1'),
      edge('c2', 'c1'),
      edge('c3', 'c2'),
    ]);
    expect(r.depthByMember).toEqual({ c1: 2, c2: 3, c3: 4, p1: 1 });
    expect(r.generationCount).toBe(4);
  });

  it('kasus 4: dua root terpisah masing-masing depth 1, count 2', () => {
    const r = computeGenerations([edge('a1', 'r1'), edge('b1', 'r2')]);
    expect(r.depthByMember).toEqual({ a1: 2, b1: 2, r1: 1, r2: 1 });
    expect(r.generationCount).toBe(2);
  });

  it('kasus 5: anak dua orang tua ambil depth maksimum', () => {
    const r = computeGenerations([
      edge('c', 'p1'),
      edge('c', 'p2'),
      edge('p2', 'gp'),
    ]);
    expect(r.depthByMember).toEqual({ c: 3, gp: 1, p1: 1, p2: 2 });
    expect(r.generationCount).toBe(3);
  });

  it('kasus 6: diamond dua jalur bertemu tetap depth 3', () => {
    const r = computeGenerations([
      edge('p1', 'gp'),
      edge('p2', 'gp'),
      edge('c', 'p1'),
      edge('c', 'p2'),
    ]);
    expect(r.depthByMember).toEqual({ c: 3, gp: 1, p1: 2, p2: 2 });
    expect(r.generationCount).toBe(3);
  });

  it('kasus 7: komponen diskontinu dihitung independen, count maks global', () => {
    const r = computeGenerations([
      edge('a1', 'r1'),
      edge('a2', 'a1'),
      edge('b1', 'r2'),
    ]);
    expect(r.depthByMember).toEqual({ a1: 2, a2: 3, b1: 2, r1: 1, r2: 1 });
    expect(r.generationCount).toBe(3);
  });

  it('kasus 8: siklus dua anggota diputus deterministik tanpa hang', () => {
    const r = computeGenerations([edge('c', 'p'), edge('p', 'c')]);
    // Pemutusan parentId ascending: edge {child p, parent c} gugur karena
    // parent c terkecil, sisa edge {child c, parent p}: p founder depth 1,
    // c depth 2. Proses berhingga, nihil infinite loop.
    expect(r.depthByMember).toEqual({ c: 2, p: 1 });
    expect(r.generationCount).toBe(2);
  });

  it('kasus 9: rantai panjang 10 menghasilkan count 10', () => {
    const edges: GenerationEdge[] = [];
    for (let i = 2; i <= 10; i += 1) {
      edges.push(edge(`n${i}`, `n${i - 1}`));
    }
    const r = computeGenerations(edges);
    expect(r.generationCount).toBe(10);
    expect(r.depthByMember.n1).toBe(1);
    expect(r.depthByMember.n10).toBe(10);
  });

  it('kasus 10: urutan input acak identik hasilnya', () => {
    const sorted = [
      edge('c', 'p1'),
      edge('c', 'p2'),
      edge('p1', 'gp'),
      edge('p2', 'gp'),
    ];
    const shuffled = [sorted[3], sorted[0], sorted[2], sorted[1]];
    const rSorted = computeGenerations(sorted);
    const rShuffled = computeGenerations(shuffled);
    expect(rShuffled).toEqual(rSorted);
    expect(rShuffled.generationCount).toBe(3);
  });

  it('kasus 11: dua jalur beda panjang ambil jalur terpanjang', () => {
    const r = computeGenerations([
      edge('x', 'r'),
      edge('c', 'x'),
      edge('c', 'r'),
    ]);
    // r depth 1, x depth 2, c ambil maks(2,1) + 1 = 3.
    expect(r.depthByMember).toEqual({ c: 3, r: 1, x: 2 });
    expect(r.generationCount).toBe(3);
  });

  it('kasus 12: campuran rantai valid dan pasangan orphan terpisah', () => {
    const r = computeGenerations([
      edge('p', 'gp'),
      edge('c', 'p'),
      edge('oC', 'oP'),
    ]);
    expect(r.depthByMember).toEqual({
      c: 3,
      gp: 1,
      oC: 2,
      oP: 1,
      p: 2,
    });
    expect(r.generationCount).toBe(3);
  });
});
