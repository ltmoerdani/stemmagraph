/**
 * Test v326 fase i: konsanguinitas pasangan per union.
 * Mirror kontrak 7aecaf9, minimal 14 kasus, pola v324 v325.
 */
import { describe, expect, it } from 'vitest'
import { analyzeConsanguinity } from './consanguinity'
import type { FamilyGraph, ParentEdge, UnionNode } from '../genealogy/family-graph'

function union(fam: string, spouses: string[]): UnionNode {
  return { fam, spouses }
}

function edge(child: string, fam: string, parents: string[]): ParentEdge {
  return { child, fam, parents }
}

function graph(
  unions: UnionNode[] = [],
  parentEdges: ParentEdge[] = [],
  personIds: string[] = [],
): FamilyGraph {
  return { personIds, unions, parentEdges }
}

describe('analyzeConsanguinity', () => {
  it('kasus 1: graph kosong menghasilkan nol tanpa throw', () => {
    const r = analyzeConsanguinity(graph())
    expect(r.unionsEvaluated).toBe(0)
    expect(r.unionsSkipped).toBe(0)
    expect(r.unionsWithCommonAncestor).toBe(0)
    expect(r.proportionPct).toBe(0)
    expect(r.degreeCounts).toEqual([])
  })

  it('kasus 2: union satu spouse digugur ke skipped', () => {
    const r = analyzeConsanguinity(graph([union('F1', ['A'])]))
    expect(r.unionsEvaluated).toBe(0)
    expect(r.unionsSkipped).toBe(1)
  })

  it('kasus 3: union tiga spouse digugur ke skipped', () => {
    const r = analyzeConsanguinity(graph([union('F1', ['A', 'B', 'C'])]))
    expect(r.unionsEvaluated).toBe(0)
    expect(r.unionsSkipped).toBe(1)
  })

  it('kasus 4: pasangan tanpa leluhur bersama, dengan nol', () => {
    const g = graph(
      [union('F1', ['A', 'B'])],
      [edge('X', 'F9', ['A', 'B'])],
    )
    const r = analyzeConsanguinity(g)
    expect(r.unionsEvaluated).toBe(1)
    expect(r.unionsWithCommonAncestor).toBe(0)
    expect(r.proportionPct).toBe(0)
    expect(r.degreeCounts).toEqual([])
  })

  it('kasus 5: saudara kandung k=2', () => {
    const g = graph(
      [union('F1', ['A', 'B'])],
      [edge('A', 'F0', ['F', 'M']), edge('B', 'F0', ['F', 'M'])],
    )
    const r = analyzeConsanguinity(g)
    expect(r.unionsWithCommonAncestor).toBe(1)
    expect(r.degreeCounts).toEqual([{ k: 2, count: 1 }])
  })

  it('kasus 6: sepupu pertama k=4', () => {
    const g = graph(
      [union('F1', ['A', 'B'])],
      [
        edge('A', 'F1a', ['P1']),
        edge('B', 'F1b', ['P2']),
        edge('P1', 'F1c', ['GF', 'GM']),
        edge('P2', 'F1d', ['GF', 'GM']),
      ],
    )
    const r = analyzeConsanguinity(g)
    expect(r.unionsWithCommonAncestor).toBe(1)
    expect(r.degreeCounts).toEqual([{ k: 4, count: 1 }])
  })

  it('kasus 7: ortu dan anak k=1', () => {
    const g = graph(
      [union('F1', ['P', 'C'])],
      [edge('C', 'F0', ['P'])],
    )
    const r = analyzeConsanguinity(g)
    expect(r.degreeCounts).toEqual([{ k: 1, count: 1 }])
  })

  it('kasus 8: paman keponakan k=3 (U dan S saudara, N anak S)', () => {
    const g = graph(
      [union('F1', ['U', 'N'])],
      [
        edge('N', 'F0', ['S']),
        edge('S', 'F0b', ['G1', 'G2']),
        edge('U', 'F0c', ['G1', 'G2']),
      ],
    )
    const r = analyzeConsanguinity(g)
    expect(r.degreeCounts).toEqual([{ k: 3, count: 1 }])
  })

  it('kasus 9: dua jalur common ancestor ambil k minimum', () => {
    const g = graph(
      [union('F1', ['A', 'B'])],
      [
        edge('A', 'F9a', ['GF', 'GM']),
        edge('B', 'F9b', ['GF', 'GM']),
        edge('A', 'F9c', ['X']),
        edge('B', 'F9d', ['X']),
      ],
    )
    const r = analyzeConsanguinity(g)
    // Jalur GF/GM memberi k=4, jalur X memberi k=2, minimum = 2.
    expect(r.degreeCounts).toEqual([{ k: 2, count: 1 }])
  })

  it('kasus 10: remarriage dua union pasangan sama dihitung terpisah', () => {
    const g = graph(
      [union('F1', ['A', 'B']), union('F2', ['B', 'A'])],
      [edge('A', 'F0', ['F', 'M']), edge('B', 'F0', ['F', 'M'])],
    )
    const r = analyzeConsanguinity(g)
    expect(r.unionsEvaluated).toBe(2)
    expect(r.unionsWithCommonAncestor).toBe(2)
    expect(r.degreeCounts).toEqual([{ k: 2, count: 2 }])
    expect(r.proportionPct).toBe(100)
  })

  it('kasus 11: proportionPct pembulatan 1 desimal (1 dari 3 = 33.3)', () => {
    const g = graph([
      union('F1', ['A', 'B']),
      union('F2', ['C', 'D']),
      union('F3', ['E', 'G']),
    ])
    // Hanya A,B saudara kandung; C,D dan E,G tanpa leluhur.
    g.parentEdges.push(edge('A', 'F0', ['F', 'M']), edge('B', 'F0', ['F', 'M']))
    const r = analyzeConsanguinity(g)
    expect(r.unionsEvaluated).toBe(3)
    expect(r.unionsWithCommonAncestor).toBe(1)
    expect(r.proportionPct).toBe(33.3)
  })

  it('kasus 12: degreeCounts urut k menaik (k=2 saudara, k=4 sepupu)', () => {
    const g = graph([
      union('F1', ['A', 'B']),
      union('F2', ['C', 'D']),
    ])
    g.parentEdges.push(
      edge('A', 'Fa', ['F1x', 'F1y']),
      edge('B', 'Fb', ['F1x', 'F1y']),
      edge('C', 'Fc', ['P1']),
      edge('D', 'Fd', ['P2']),
      edge('P1', 'Fg', ['GF', 'GM']),
      edge('P2', 'Fh', ['GF', 'GM']),
    )
    const r = analyzeConsanguinity(g)
    expect(r.degreeCounts).toEqual([
      { k: 2, count: 1 },
      { k: 4, count: 1 },
    ])
  })

  it('kasus 13: unionsSkipped benar pada campuran union valid dan tidak', () => {
    const g = graph([
      union('F1', ['A']),
      union('F2', ['B', 'C', 'D']),
      union('F3', ['E', 'F']),
      union('F4', ['E', 'E']),
    ])
    const r = analyzeConsanguinity(g)
    expect(r.unionsEvaluated).toBe(1)
    expect(r.unionsSkipped).toBe(3)
  })

  it('kasus 14: graph tanpa edge ortu, union valid tapi k tidak ada', () => {
    const r = analyzeConsanguinity(graph([union('F1', ['A', 'B'])]))
    expect(r.unionsEvaluated).toBe(1)
    expect(r.unionsWithCommonAncestor).toBe(0)
    expect(r.degreeCounts).toEqual([])
    expect(r.proportionPct).toBe(0)
  })

  it('kasus 15: union dengan personIds kosong tetap dievaluasi', () => {
    const r = analyzeConsanguinity(
      graph(
        [union('F1', ['A', 'B'])],
        [edge('A', 'F0', ['F']), edge('B', 'F0', ['F'])],
      ),
    )
    expect(r.degreeCounts).toEqual([{ k: 2, count: 1 }])
  })
})
