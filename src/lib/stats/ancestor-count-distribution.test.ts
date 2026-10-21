/**
 * Test v337 ancestor-count-distribution fase i: 17 kasus vitest
 * dari kontrak 45eb5f6
 * (drafts/kontrak-stg-v337-ancestor-count-distribution-2026-10-21.md).
 */
import { describe, expect, it } from 'vitest'
import { computeAncestorCountDistribution } from './ancestor-count-distribution'

/** Helper: buat ancestors ['a1'..'aN']. */
function ids(n: number, prefix = 'a'): string[] {
  return Array.from({ length: n }, (_, i) => `${prefix}${i + 1}`)
}

describe('ancestor-count-distribution fase i', () => {
  it('kasus 1: input kosong menghasilkan buckets 4 entri count 0 dan total nol', () => {
    expect(computeAncestorCountDistribution([])).toEqual({
      buckets: [
        { label: '0-3', count: 0 },
        { label: '4-7', count: 0 },
        { label: '8-11', count: 0 },
        { label: '12-15', count: 0 },
      ],
      totalPersons: 0,
      totalKnownAncestors: 0,
    })
  })

  it('kasus 2: distribusi dasar lintas bucket', () => {
    const result = computeAncestorCountDistribution([
      { personId: 'p1', ancestors: ids(2, 'a') },
      { personId: 'p2', ancestors: ids(5, 'b') },
      { personId: 'p3', ancestors: ids(9, 'c') },
      { personId: 'p4', ancestors: ids(13, 'd') },
    ])
    expect(result.buckets.map((b) => b.count)).toEqual([1, 1, 1, 1])
    expect(result.totalPersons).toBe(4)
    expect(result.totalKnownAncestors).toBe(29)
  })

  it('kasus 3: dedupe duplikat ancestors dalam satu entri', () => {
    const result = computeAncestorCountDistribution([
      { personId: 'p1', ancestors: ['a1', 'a1', 'a2', 'a2', 'a3', 'a1'] },
    ])
    expect(result.buckets[0]).toEqual({ label: '0-3', count: 1 })
    expect(result.totalKnownAncestors).toBe(3)
  })

  it('kasus 4: individu tanpa leluhur masuk bucket 0-3', () => {
    const result = computeAncestorCountDistribution([
      { personId: 'p1', ancestors: [] },
    ])
    expect(result.buckets[0]).toEqual({ label: '0-3', count: 1 })
    expect(result.totalKnownAncestors).toBe(0)
  })

  it('kasus 5: 15 leluhur penuh 4 generasi masuk bucket 12-15', () => {
    const result = computeAncestorCountDistribution([
      { personId: 'p1', ancestors: ids(15) },
    ])
    expect(result.buckets[3]).toEqual({ label: '12-15', count: 1 })
    expect(result.totalKnownAncestors).toBe(15)
  })

  it('kasus 6: 16 leluhur tetap di bucket 12-15 (clamp walk 4 generasi)', () => {
    const result = computeAncestorCountDistribution([
      { personId: 'p1', ancestors: ids(16) },
    ])
    expect(result.buckets[3]).toEqual({ label: '12-15', count: 1 })
    expect(result.totalKnownAncestors).toBe(16)
  })

  it('kasus 7: totalKnownAncestors union unik lintas entri', () => {
    const result = computeAncestorCountDistribution([
      { personId: 'p1', ancestors: ['a1', 'a2', 'a3'] },
      { personId: 'p2', ancestors: ['a3', 'a4'] },
      { personId: 'p3', ancestors: ['a4', 'a3'] },
    ])
    expect(result.totalKnownAncestors).toBe(4)
    expect(result.totalPersons).toBe(3)
  })

  it('kasus 8: throw input bukan array', () => {
    expect(() => computeAncestorCountDistribution('bukan array')).toThrowError(
      'ancestor-count-distribution: payload bukan array',
    )
  })

  it('kasus 9: throw entri bukan objek', () => {
    expect(() =>
      computeAncestorCountDistribution([{ personId: 'p1', ancestors: [] }, 42]),
    ).toThrowError('ancestor-count-distribution entry[1]: hilang atau bukan objek')
  })

  it('kasus 10: throw personId hilang', () => {
    expect(() => computeAncestorCountDistribution([{ ancestors: [] }])).toThrowError(
      'ancestor-count-distribution entry[0].personId: hilang atau bukan string',
    )
  })

  it('kasus 11: throw personId bukan string', () => {
    expect(() =>
      computeAncestorCountDistribution([{ personId: 7, ancestors: [] }]),
    ).toThrowError('ancestor-count-distribution entry[0].personId: hilang atau bukan string')
  })

  it('kasus 12: throw ancestors hilang', () => {
    expect(() => computeAncestorCountDistribution([{ personId: 'p1' }])).toThrowError(
      'ancestor-count-distribution entry[0].ancestors: hilang atau bukan array',
    )
  })

  it('kasus 13: throw ancestors bukan array', () => {
    expect(() =>
      computeAncestorCountDistribution([{ personId: 'p1', ancestors: 'a1' }]),
    ).toThrowError('ancestor-count-distribution entry[0].ancestors: hilang atau bukan array')
  })

  it('kasus 14: throw elemen ancestors bukan string dengan posisi ter-index', () => {
    expect(() =>
      computeAncestorCountDistribution([
        { personId: 'p1', ancestors: ['a1'] },
        { personId: 'p2', ancestors: ['a1', null] },
      ]),
    ).toThrowError(
      'ancestor-count-distribution entry[1].ancestors[1]: hilang atau bukan string',
    )
  })

  it('kasus 15: buckets selalu 4 entri urut naik, count integer non-negatif', () => {
    const result = computeAncestorCountDistribution([
      { personId: 'p1', ancestors: ids(12) },
      { personId: 'p2', ancestors: [] },
    ])
    expect(result.buckets).toHaveLength(4)
    expect(result.buckets.map((b) => b.label)).toEqual(['0-3', '4-7', '8-11', '12-15'])
    for (const bucket of result.buckets) {
      expect(Number.isInteger(bucket.count)).toBe(true)
      expect(bucket.count).toBeGreaterThanOrEqual(0)
    }
  })

  it('kasus 16: personId duplikat lintas entri tetap dihitung sebagai individu terpisah', () => {
    const result = computeAncestorCountDistribution([
      { personId: 'p1', ancestors: ['a1'] },
      { personId: 'p1', ancestors: ['a1', 'a2'] },
    ])
    expect(result.totalPersons).toBe(2)
    expect(result.totalKnownAncestors).toBe(2)
    expect(result.buckets[0].count).toBe(2)
  })

  it('kasus 17: semua pesan throw memakai prefiks ancestor-count-distribution', () => {
    const badInputs: unknown[] = [
      null,
      ['bukan objek'],
      [{ ancestors: [] }],
      [{ personId: 'p1', ancestors: 'x' }],
      [{ personId: 'p1', ancestors: [1] }],
    ]
    for (const bad of badInputs) {
      expect(() => computeAncestorCountDistribution(bad)).toThrowError(
        /^ancestor-count-distribution/,
      )
    }
  })
})
