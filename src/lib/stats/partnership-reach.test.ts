import { describe, expect, it } from 'vitest'

import { computePartnershipReach } from './partnership-reach'
import type { PartnershipPair } from './partnership-reach'

function p(pairId: string, a: string, b: string): PartnershipPair {
  return { pairId, a, b }
}

describe('computePartnershipReach', () => {
  it('kasus 1: happy path rantai tunggal empat orang', () => {
    const result = computePartnershipReach([
      p('m1', 'a', 'b'),
      p('m2', 'b', 'c'),
      p('m3', 'c', 'd'),
    ])
    expect(result.componentCount).toBe(1)
    expect(result.largestGroup).not.toBeNull()
    expect(result.largestGroup?.members).toEqual(['a', 'b', 'c', 'd'])
    expect(result.largestGroup?.edges).toBe(3)
    expect(result.largestGroup?.hubId).toBe('b')
    expect(result.largestGroup?.hubDegree).toBe(2)
  })

  it('kasus 2: komponen dua orang ditolak ambang 3', () => {
    const result = computePartnershipReach([p('m1', 'a', 'b')])
    expect(result.largestGroup).toBeNull()
    expect(result.componentCount).toBe(0)
  })

  it('kasus 3: dua komponen lolos, terbesar menang', () => {
    const result = computePartnershipReach([
      p('m1', 'a', 'b'),
      p('m2', 'b', 'c'),
      p('m3', 'x', 'y'),
    ])
    expect(result.componentCount).toBe(1)
    expect(result.largestGroup?.members).toEqual(['a', 'b', 'c'])
  })

  it('kasus 4: tie komponen sama besar pilih xref terkecil', () => {
    const result = computePartnershipReach([
      p('m1', 'z', 'y'),
      p('m2', 'y', 'x'),
      p('m3', 'c', 'b'),
      p('m4', 'b', 'a'),
    ])
    expect(result.componentCount).toBe(2)
    expect(result.largestGroup?.members).toEqual(['a', 'b', 'c'])
  })

  it('kasus 5: edges hitung benar pada graf bintang', () => {
    const result = computePartnershipReach([
      p('m1', 'hub', 's1'),
      p('m2', 'hub', 's2'),
      p('m3', 'hub', 's3'),
      p('m4', 'hub', 's4'),
    ])
    expect(result.largestGroup?.members).toEqual(['hub', 's1', 's2', 's3', 's4'])
    expect(result.largestGroup?.edges).toBe(4)
  })

  it('kasus 6: hub pilih degree tertinggi', () => {
    const result = computePartnershipReach([
      p('m1', 'hub', 's1'),
      p('m2', 'hub', 's2'),
      p('m3', 's1', 's3'),
    ])
    expect(result.largestGroup?.hubId).toBe('hub')
    expect(result.largestGroup?.hubDegree).toBe(2)
  })

  it('kasus 7: hub tie degree pilih id terkecil', () => {
    const result = computePartnershipReach([
      p('m1', 'b', 'a'),
      p('m2', 'b', 'c'),
      p('m3', 'd', 'a'),
      p('m4', 'd', 'c'),
    ])
    expect(result.largestGroup?.hubDegree).toBe(2)
    expect(result.largestGroup?.hubId).toBe('a')
  })

  it('kasus 8: longestChain rantai lurus penuh', () => {
    const result = computePartnershipReach([
      p('m1', 'a', 'b'),
      p('m2', 'b', 'c'),
      p('m3', 'c', 'd'),
    ])
    expect(result.largestGroup?.longestChain).toEqual(['a', 'b', 'c', 'd'])
  })

  it('kasus 9: cabang Y, chain pilih diameter', () => {
    const result = computePartnershipReach([
      p('m1', 'a', 'b'),
      p('m2', 'b', 'c'),
      p('m3', 'c', 'd'),
      p('m4', 'c', 'e'),
    ])
    const chain = result.largestGroup?.longestChain
    expect(chain?.length).toBe(4)
    expect(chain?.[0]).toBe('a')
    expect(chain?.[3]).toBe('d')
    expect(chain?.[3]).toBe('d')
  })

  it('kasus 10: normalisasi orientasi, mirror input sama hasil chain', () => {
    const base = [
      p('m1', 'a', 'b'),
      p('m2', 'b', 'c'),
      p('m3', 'c', 'd'),
    ]
    const mirrored = [
      p('m1', 'd', 'c'),
      p('m2', 'c', 'b'),
      p('m3', 'b', 'a'),
    ]
    const one = computePartnershipReach(base)
    const two = computePartnershipReach(mirrored)
    expect(one.largestGroup?.longestChain).toEqual(two.largestGroup?.longestChain)
  })

  it('kasus 11: determinisme urutan input acak', () => {
    const ordered = [
      p('m1', 'a', 'b'),
      p('m2', 'b', 'c'),
      p('m3', 'c', 'd'),
      p('m4', 'd', 'e'),
    ]
    const shuffled = [ordered[3], ordered[0], ordered[2], ordered[1]]
    const one = computePartnershipReach(ordered)
    const two = computePartnershipReach(shuffled)
    expect(two).toEqual(one)
  })

  it('kasus 12: parser throw pair bukan objek dengan prefiks index', () => {
    expect(() =>
      computePartnershipReach([p('m1', 'a', 'b'), null as unknown as PartnershipPair]),
    ).toThrowError(/^partnership-reach\[1\]/)
  })

  it('kasus 13: parser throw a sama dengan b', () => {
    expect(() => computePartnershipReach([p('m1', 'a', 'a')])).toThrowError(
      /^partnership-reach\[0\]/,
    )
  })

  it('kasus 14: parser throw duplikat pairId', () => {
    expect(() =>
      computePartnershipReach([p('m1', 'a', 'b'), p('m1', 'c', 'd')]),
    ).toThrowError(/^partnership-reach\[1\]/)
  })

  it('kasus 15: parser throw field bukan string', () => {
    expect(() =>
      computePartnershipReach([
        { pairId: 1, a: 'a', b: 'b' } as unknown as PartnershipPair,
      ]),
    ).toThrowError(/^partnership-reach\[0\]/)
  })

  it('kasus 16: dedupe edge ganda hitung satu', () => {
    const result = computePartnershipReach([
      p('m1', 'a', 'b'),
      p('m2', 'b', 'a'),
      p('m3', 'b', 'c'),
    ])
    expect(result.largestGroup?.members).toEqual(['a', 'b', 'c'])
    expect(result.largestGroup?.edges).toBe(2)
  })

  it('kasus 17: input kosong tanpa throw', () => {
    const result = computePartnershipReach([])
    expect(result.largestGroup).toBeNull()
    expect(result.componentCount).toBe(0)
  })

  it('kasus 18: componentCount hitung semua komponen lolos ambang', () => {
    const result = computePartnershipReach([
      p('m1', 'a', 'b'),
      p('m2', 'b', 'c'),
      p('m3', 'x', 'y'),
      p('m4', 'y', 'z'),
      p('m5', 'z', 'w'),
      p('m6', 'p', 'q'),
    ])
    expect(result.componentCount).toBe(2)
    expect(result.largestGroup?.members).toEqual(['w', 'x', 'y', 'z'])
  })
})
