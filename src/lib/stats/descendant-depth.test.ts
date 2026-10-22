import { describe, expect, it } from 'vitest'

import { computeDescendantDepth } from './descendant-depth'
import type { DescendantEdge } from './descendant-depth'

function e(childId: string, parentId: string): DescendantEdge {
  return { childId, parentId }
}

function chain(nodes: number): DescendantEdge[] {
  const edges: DescendantEdge[] = []
  for (let i = 0; i < nodes - 1; i += 1) {
    edges.push(e(`n${i + 1}`, `n${i}`))
  }
  return edges
}

describe('computeDescendantDepth v357 fase i', () => {
  it('kasus 1: edges kosong, distribution tunggal depth 0 count 0, capped false', () => {
    const result = computeDescendantDepth([])
    expect(result.maxDepth).toBe(0)
    expect(result.distribution).toEqual([{ depth: 0, count: 0 }])
    expect(result.capped).toBe(false)
    expect(result.nodeCount).toBe(0)
  })

  it('kasus 2: satu pasangan parent-child, parent depth 1 child depth 0', () => {
    const result = computeDescendantDepth([e('b', 'a')])
    expect(result.maxDepth).toBe(1)
    expect(result.nodeCount).toBe(2)
    expect(result.capped).toBe(false)
    expect(result.distribution).toEqual([
      { depth: 0, count: 1 },
      { depth: 1, count: 1 },
    ])
  })

  it('kasus 3: rantai tiga generasi, puncak depth 2', () => {
    const result = computeDescendantDepth([e('b', 'a'), e('c', 'b')])
    expect(result.maxDepth).toBe(2)
    expect(result.nodeCount).toBe(3)
    expect(result.distribution).toEqual([
      { depth: 0, count: 1 },
      { depth: 1, count: 1 },
      { depth: 2, count: 1 },
    ])
  })

  it('kasus 4: rantai empat generasi dengan maxDepth 3, puncak clamp capped true', () => {
    const result = computeDescendantDepth([e('b', 'a'), e('c', 'b'), e('d', 'c')], {
      maxDepth: 3,
    })
    expect(result.maxDepth).toBe(3)
    expect(result.capped).toBe(true)
    expect(result.distribution).toEqual([
      { depth: 0, count: 1 },
      { depth: 1, count: 1 },
      { depth: 2, count: 1 },
      { depth: 3, count: 1 },
    ])
  })

  it('kasus 5: pedigree collapse dua jalur beda panjang ambil terpanjang', () => {
    // d anak dari c (rantai panjang) sekaligus anak dari a (jalur pendek)
    const result = computeDescendantDepth([
      e('b', 'a'),
      e('c', 'b'),
      e('d', 'c'),
      e('d', 'a'),
    ])
    expect(result.maxDepth).toBe(3)
    expect(result.distribution).toEqual([
      { depth: 0, count: 1 },
      { depth: 1, count: 1 },
      { depth: 2, count: 1 },
      { depth: 3, count: 1 },
    ])
  })

  it('kasus 6: diamond dua jalur sama panjang', () => {
    const result = computeDescendantDepth([
      e('b', 'a'),
      e('c', 'a'),
      e('d', 'b'),
      e('d', 'c'),
    ])
    expect(result.maxDepth).toBe(2)
    expect(result.distribution).toEqual([
      { depth: 0, count: 1 },
      { depth: 1, count: 2 },
      { depth: 2, count: 1 },
    ])
  })

  it('kasus 7: multi-child ambil maksimum', () => {
    const result = computeDescendantDepth([e('b', 'a'), e('c', 'a'), e('d', 'b')])
    expect(result.maxDepth).toBe(2)
    expect(result.distribution).toEqual([
      { depth: 0, count: 2 },
      { depth: 1, count: 1 },
      { depth: 2, count: 1 },
    ])
  })

  it('kasus 8: node hanya parent tanpa parent sendiri masuk histogram', () => {
    const result = computeDescendantDepth([e('b', 'a')])
    expect(result.nodeCount).toBe(2)
    const depthOne = result.distribution.find((entry) => entry.depth === 1)
    expect(depthOne?.count).toBe(1)
  })

  it('kasus 9: edge duplikat didedupe sebelum analisis', () => {
    const result = computeDescendantDepth([e('b', 'a'), e('b', 'a'), e('b', 'a')])
    expect(result.nodeCount).toBe(2)
    expect(result.distribution).toEqual([
      { depth: 0, count: 1 },
      { depth: 1, count: 1 },
    ])
  })

  it('kasus 10: siklus dua node clamp capped true', () => {
    const result = computeDescendantDepth([e('b', 'a'), e('a', 'b')])
    expect(result.capped).toBe(true)
    expect(result.maxDepth).toBe(100)
    expect(result.nodeCount).toBe(2)
    const deepest = result.distribution.find((entry) => entry.depth === 100)
    expect(deepest?.count).toBe(2)
  })

  it('kasus 11: siklus tiga node clamp capped true', () => {
    const result = computeDescendantDepth([e('b', 'a'), e('c', 'b'), e('a', 'c')])
    expect(result.capped).toBe(true)
    expect(result.maxDepth).toBe(100)
    expect(result.nodeCount).toBe(3)
  })

  it('kasus 12: rantai sah 101 node tepat menyentuh cap, capped true', () => {
    const result = computeDescendantDepth(chain(101))
    expect(result.maxDepth).toBe(100)
    expect(result.capped).toBe(true)
    expect(result.nodeCount).toBe(101)
    const deepest = result.distribution.find((entry) => entry.depth === 100)
    expect(deepest?.count).toBe(1)
  })

  it('kasus 13: rantai 150 node clamp di cap 100', () => {
    const result = computeDescendantDepth(chain(150))
    expect(result.maxDepth).toBe(100)
    expect(result.capped).toBe(true)
    expect(result.nodeCount).toBe(150)
    expect(result.distribution).toHaveLength(101)
    const deepest = result.distribution.find((entry) => entry.depth === 100)
    expect(deepest?.count).toBe(50)
  })

  it('kasus 14: maxDepth kustom 3 mengubah titik clamp', () => {
    const result = computeDescendantDepth(chain(5), { maxDepth: 3 })
    expect(result.maxDepth).toBe(3)
    expect(result.capped).toBe(true)
    expect(result.distribution).toEqual([
      { depth: 0, count: 1 },
      { depth: 1, count: 1 },
      { depth: 2, count: 1 },
      { depth: 3, count: 2 },
    ])
  })

  it('kasus 15: maxDepth 0 dilempar Error ber-index', () => {
    expect(() => computeDescendantDepth([], { maxDepth: 0 })).toThrowError(
      'descendant-depth[options]: maxDepth wajib integer >= 1',
    )
  })

  it('kasus 16: childId string kosong dilempar Error ber-index', () => {
    expect(() => computeDescendantDepth([e('', 'a')])).toThrowError(
      'descendant-depth[0]: childId dan parentId wajib string tak kosong',
    )
  })

  it('kasus 17: entri bukan objek dilempar Error ber-index', () => {
    expect(() => computeDescendantDepth([null as unknown as DescendantEdge])).toThrowError(
      'descendant-depth[0]: edge bukan objek',
    )
  })

  it('kasus 18: determinisme, urutan input diacak tidak mengubah hasil', () => {
    const edges = [
      e('b', 'a'),
      e('c', 'a'),
      e('d', 'b'),
      e('d', 'c'),
      e('f', 'd'),
      e('g', 'e'),
      e('e', 'c'),
    ]
    const shuffled = [...edges].reverse()
    const first = computeDescendantDepth(edges)
    const second = computeDescendantDepth(shuffled)
    expect(first).toEqual(second)
    expect(first.maxDepth).toBe(3)
    expect(first.distribution).toEqual([
      { depth: 0, count: 2 },
      { depth: 1, count: 2 },
      { depth: 2, count: 2 },
      { depth: 3, count: 1 },
    ])
  })
})
