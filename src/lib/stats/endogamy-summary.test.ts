/**
 * Test v349 fase i: ringkasan endogami pasangan per union.
 * Mirror kontrak drafts/kontrak-stg-v349-endogamy-summary,
 * minimal 16 kasus (diisi 18), pola v326.
 */
import { describe, expect, it } from 'vitest'
import { analyzeEndogamy } from './endogamy-summary'
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

/* Struktur sepupu pertama: kakek-nenek K dua anak B dan C,
 * masing-masing punya anak (D dan E). D dan E menikah. */
function firstCousinGraph(): FamilyGraph {
  return graph(
    [union('F1', ['D', 'E'])],
    [
      edge('B', 'F0a', ['K']),
      edge('C', 'F0b', ['K']),
      edge('D', 'F1a', ['B']),
      edge('E', 'F1b', ['C']),
    ],
  )
}

describe('analyzeEndogamy', () => {
  it('kasus 1: graph kosong menghasilkan nol tanpa throw', () => {
    const r = analyzeEndogamy(graph())
    expect(r).toEqual({ testable: 0, shared: 0, proportionPct: 0, maxDepth: 4 })
  })

  it('kasus 2: union tanpa 2 spouse dilewati', () => {
    const r = analyzeEndogamy(graph([union('F1', ['A'])]))
    expect(r.testable).toBe(0)
    expect(r.shared).toBe(0)
    expect(r.proportionPct).toBe(0)
  })

  it('kasus 3: union 2 spouse beda tanpa parentage tidak testable', () => {
    const r = analyzeEndogamy(graph([union('F1', ['A', 'B'])]))
    expect(r.testable).toBe(0)
    expect(r.shared).toBe(0)
    expect(r.proportionPct).toBe(0)
  })

  it('kasus 4: sepupu pertama shared lewat kakek dist 1+1=2', () => {
    const r = analyzeEndogamy(firstCousinGraph())
    expect(r.testable).toBe(1)
    expect(r.shared).toBe(1)
    expect(r.proportionPct).toBe(100)
  })

  it('kasus 5: sepupu jauh total 6 > default 4, testable tetap terhitung', () => {
    /* D lewat P lalu K lalu R (dist R = 3); M lewat N lalu O lalu R
     * (dist R = 3). Total 6 > 4, tidak shared. */
    const g = graph(
      [union('F1', ['D', 'M'])],
      [
        edge('P', 'F0a', ['K']),
        edge('K', 'F0b', ['R']),
        edge('D', 'F0c', ['P']),
        edge('N', 'F0d', ['O']),
        edge('O', 'F0e', ['R']),
        edge('M', 'F0f', ['N']),
      ],
    )
    const r = analyzeEndogamy(g)
    expect(r.testable).toBe(1)
    expect(r.shared).toBe(0)
    expect(r.proportionPct).toBe(0)
    expect(r.maxDepth).toBe(4)
  })

  it('kasus 6: saudara kandung menikah, dist 1+1=2 shared', () => {
    const g = graph(
      [union('F1', ['X', 'Y'])],
      [edge('X', 'F0', ['A', 'B']), edge('Y', 'F0', ['A', 'B'])],
    )
    const r = analyzeEndogamy(g)
    expect(r.testable).toBe(1)
    expect(r.shared).toBe(1)
    expect(r.proportionPct).toBe(100)
  })

  it('kasus 7: maxDepth eksplisit 2 dengan pasangan total 3 tidak shared', () => {
    /* X anak A, A anak Z, Y anak Z. X-Y lewat Z: 2+1 = 3 > 2. */
    const g = graph(
      [union('F1', ['X', 'Y'])],
      [edge('X', 'F0a', ['A']), edge('A', 'F0c', ['Z']), edge('Y', 'F0b', ['Z'])],
    )
    const r = analyzeEndogamy(g, { maxDepth: 2 })
    expect(r.testable).toBe(1)
    expect(r.shared).toBe(0)
    expect(r.maxDepth).toBe(2)
  })

  it('kasus 8: maxDepth 0 throw ber-index', () => {
    expect(() => analyzeEndogamy(graph(), { maxDepth: 0 })).toThrow(/endogamy-summary/)
  })

  it('kasus 9: maxDepth -1 throw', () => {
    expect(() => analyzeEndogamy(graph(), { maxDepth: -1 })).toThrow(/maxDepth/)
  })

  it('kasus 10: maxDepth 1.5 pecahan throw', () => {
    expect(() => analyzeEndogamy(graph(), { maxDepth: 1.5 })).toThrow(/maxDepth/)
  })

  it("kasus 11: maxDepth '4' string throw", () => {
    expect(() => analyzeEndogamy(graph(), { maxDepth: '4' as unknown as number })).toThrow(
      /maxDepth/,
    )
  })

  it('kasus 12: dua union testable salah satu shared, 1 dari 3 = 33.3', () => {
    const g = graph(
      [
        union('F1', ['D', 'E']),
        union('F2', ['G', 'H']),
        union('F3', ['I', 'J']),
      ],
      [
        edge('B', 'F0a', ['K']),
        edge('C', 'F0b', ['K']),
        edge('D', 'F1a', ['B']),
        edge('E', 'F1b', ['C']),
        edge('G', 'F2a', ['L']),
        edge('H', 'F2b', ['M']),
        edge('I', 'F3a', ['N']),
        edge('J', 'F3b', ['O']),
      ],
    )
    const r = analyzeEndogamy(g)
    expect(r.testable).toBe(3)
    expect(r.shared).toBe(1)
    expect(r.proportionPct).toBe(33.3)
  })

  it('kasus 13: testable 0 menghasilkan proportionPct 0', () => {
    const r = analyzeEndogamy(graph([union('F1', ['A', 'B'])]))
    expect(r.testable).toBe(0)
    expect(r.proportionPct).toBe(0)
  })

  it('kasus 14: parentEdges siklus A->B->A tidak crash, hasil deterministik', () => {
    const g = graph(
      [union('F1', ['A', 'B'])],
      [edge('A', 'F0a', ['B']), edge('B', 'F0b', ['A'])],
    )
    const r1 = analyzeEndogamy(g)
    const r2 = analyzeEndogamy(g)
    expect(r1).toEqual(r2)
    expect(r1.testable).toBe(1)
    /* dist A(B)=1, dist B(A)=1, total 2 <= 4 -> shared. */
    expect(r1.shared).toBe(1)
  })

  it('kasus 15: child dengan parents duplikat di satu edge, BFS tidak dobel', () => {
    const g = graph(
      [union('F1', ['X', 'Y'])],
      [edge('X', 'F0a', ['A', 'A', 'B']), edge('Y', 'F0b', ['A', 'B', 'B'])],
    )
    const r = analyzeEndogamy(g)
    expect(r.testable).toBe(1)
    expect(r.shared).toBe(1)
    expect(r.proportionPct).toBe(100)
  })

  it('kasus 16: union spouses sama id dilewati tanpa throw', () => {
    const g = graph(
      [union('F1', ['A', 'A'])],
      [edge('A', 'F0', ['B'])],
    )
    const r = analyzeEndogamy(g)
    expect(r.testable).toBe(0)
    expect(r.shared).toBe(0)
    expect(r.proportionPct).toBe(0)
  })

  it('kasus 17: graph.unions string throw ber-index', () => {
    const bad = { personIds: [], unions: 'bukan-array', parentEdges: [] }
    expect(() => analyzeEndogamy(bad as unknown as FamilyGraph)).toThrow(
      /endogamy-summary: graph\.unions/,
    )
  })

  it('kasus 18: spouse id kosong throw', () => {
    const g = graph([union('F1', ['A', ''])], [edge('A', 'F0', ['B'])])
    expect(() => analyzeEndogamy(g)).toThrow(/spouse index 1/)
  })

  it('kasus 19 tambahan: graph null throw', () => {
    expect(() => analyzeEndogamy(null as unknown as FamilyGraph)).toThrow(
      /graph harus objek/,
    )
  })

  it('kasus 20 tambahan: parentEdges elemen bukan objek throw', () => {
    const bad = { personIds: [], unions: [], parentEdges: [42] }
    expect(() => analyzeEndogamy(bad as unknown as FamilyGraph)).toThrow(
      /parentEdges index 0/,
    )
  })
})
