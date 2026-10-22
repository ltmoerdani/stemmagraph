import { describe, expect, it } from 'vitest'

import { computeFamilyIslands } from './family-islands'
import type { ParentageEdge } from './family-islands'

function e(childId: string, parentId: string): ParentageEdge {
  return { childId, parentId }
}

function chain(nodes: number): ParentageEdge[] {
  const edges: ParentageEdge[] = []
  for (let i = 0; i < nodes - 1; i += 1) {
    edges.push(e(`n${i + 1}`, `n${i}`))
  }
  return edges
}

describe('computeFamilyIslands v358 fase i', () => {
  it('kasus 1: edges kosong, islandCount 0, distribution kosong, largest 0', () => {
    const result = computeFamilyIslands([])
    expect(result.islandCount).toBe(0)
    expect(result.largestIslandSize).toBe(0)
    expect(result.distribution).toEqual([])
    expect(result.nodeCount).toBe(0)
  })

  it('kasus 2: satu pulau dua node', () => {
    const result = computeFamilyIslands([e('b', 'a')])
    expect(result.islandCount).toBe(1)
    expect(result.largestIslandSize).toBe(2)
    expect(result.distribution).toEqual([{ size: 2, count: 1 }])
    expect(result.nodeCount).toBe(2)
  })

  it('kasus 3: satu pulau rantai 4 node', () => {
    const result = computeFamilyIslands(chain(4))
    expect(result.islandCount).toBe(1)
    expect(result.largestIslandSize).toBe(4)
    expect(result.distribution).toEqual([{ size: 4, count: 1 }])
    expect(result.nodeCount).toBe(4)
  })

  it('kasus 4: dua pulau terpisah', () => {
    const result = computeFamilyIslands([e('b', 'a'), e('d', 'c')])
    expect(result.islandCount).toBe(2)
    expect(result.largestIslandSize).toBe(2)
    expect(result.distribution).toEqual([{ size: 2, count: 2 }])
    expect(result.nodeCount).toBe(4)
  })

  it('kasus 5: rantai konektivitas transitif 5 node satu pulau', () => {
    const result = computeFamilyIslands(chain(5))
    expect(result.islandCount).toBe(1)
    expect(result.largestIslandSize).toBe(5)
    expect(result.nodeCount).toBe(5)
  })

  it('kasus 6: diamond parentage, satu pulau 4 node', () => {
    const result = computeFamilyIslands([
      e('p1', 'g'),
      e('p2', 'g'),
      e('c', 'p1'),
      e('c', 'p2'),
    ])
    expect(result.islandCount).toBe(1)
    expect(result.largestIslandSize).toBe(4)
    expect(result.distribution).toEqual([{ size: 4, count: 1 }])
    expect(result.nodeCount).toBe(4)
  })

  it('kasus 7: anak bersama dua ortu menyatukan dua keluarga asal jadi satu pulau', () => {
    const result = computeFamilyIslands([
      e('ayah', 'kakekAyah'),
      e('ibu', 'kakekIbu'),
      e('anak', 'ayah'),
      e('anak', 'ibu'),
    ])
    expect(result.islandCount).toBe(1)
    expect(result.largestIslandSize).toBe(5)
    expect(result.distribution).toEqual([{ size: 5, count: 1 }])
    expect(result.nodeCount).toBe(5)
  })

  it('kasus 8: edge duplikat didedupe, hasil tetap satu pulau dua node', () => {
    const result = computeFamilyIslands([e('b', 'a'), e('b', 'a')])
    expect(result.islandCount).toBe(1)
    expect(result.largestIslandSize).toBe(2)
    expect(result.nodeCount).toBe(2)
    expect(result.distribution).toEqual([{ size: 2, count: 1 }])
  })

  it('kasus 9: edge berlawanan arah dianggap satu edge tak berarah', () => {
    const result = computeFamilyIslands([e('b', 'a'), e('a', 'b')])
    expect(result.islandCount).toBe(1)
    expect(result.largestIslandSize).toBe(2)
    expect(result.nodeCount).toBe(2)
  })

  it('kasus 10: urutan input acak tetap deterministik', () => {
    const edgesA = [
      e('anak', 'ayah'),
      e('anak', 'ibu'),
      e('ayah', 'kakekAyah'),
      e('ibu', 'kakekIbu'),
    ]
    const edgesB = [
      e('ibu', 'kakekIbu'),
      e('anak', 'ayah'),
      e('ayah', 'kakekAyah'),
      e('anak', 'ibu'),
    ]
    expect(computeFamilyIslands(edgesA)).toEqual(computeFamilyIslands(edgesB))
  })

  it('kasus 11: childId string kosong melempar Error ber-index 0', () => {
    expect(() => computeFamilyIslands([e('', 'a')])).toThrowError(
      /family-islands\[0\]/,
    )
  })

  it('kasus 12: parentId string kosong melempar Error ber-index 0', () => {
    expect(() => computeFamilyIslands([e('a', '')])).toThrowError(
      /family-islands\[0\]/,
    )
  })

  it('kasus 13: entri bukan objek melempar Error ber-index', () => {
    const edges = ['bukan objek'] as unknown as ParentageEdge[]
    expect(() => computeFamilyIslands(edges)).toThrowError(
      /family-islands\[0\]/,
    )
  })

  it('kasus 14: edges bukan array melempar Error', () => {
    const edges = 'bukan array' as unknown as ParentageEdge[]
    expect(() => computeFamilyIslands(edges)).toThrowError(
      /family-islands\[0\]/,
    )
  })

  it('kasus 15: pulau ukuran 3 dan ukuran 2, distribution ascending', () => {
    const result = computeFamilyIslands([
      e('n2', 'n1'),
      e('n3', 'n2'),
      e('b', 'a'),
    ])
    expect(result.islandCount).toBe(2)
    expect(result.largestIslandSize).toBe(3)
    expect(result.distribution).toEqual([
      { size: 2, count: 1 },
      { size: 3, count: 1 },
    ])
    expect(result.nodeCount).toBe(5)
  })

  it('kasus 16: 200 node satu rantai, satu pulau nodeCount 200', () => {
    const result = computeFamilyIslands(chain(200))
    expect(result.islandCount).toBe(1)
    expect(result.largestIslandSize).toBe(200)
    expect(result.distribution).toEqual([{ size: 200, count: 1 }])
    expect(result.nodeCount).toBe(200)
  })

  it('kasus 17: childId bukan string melempar Error ber-index 0', () => {
    const edges = [{ childId: 123, parentId: 'a' }] as unknown as ParentageEdge[]
    expect(() => computeFamilyIslands(edges)).toThrowError(
      /family-islands\[0\]/,
    )
  })

  it('kasus 18: parentId bukan string melempar Error ber-index 0', () => {
    const edges = [{ childId: 'a', parentId: null }] as unknown as ParentageEdge[]
    expect(() => computeFamilyIslands(edges)).toThrowError(
      /family-islands\[0\]/,
    )
  })

  it('kasus 19: entri tidak valid pada index 1 dilaporkan ber-index 1', () => {
    const edges = [e('b', 'a'), { childId: '', parentId: 'x' }] as ParentageEdge[]
    expect(() => computeFamilyIslands(edges)).toThrowError(
      /family-islands\[1\]/,
    )
  })
})
