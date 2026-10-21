/**
 * Test v333 occupations-topn fase i: 16 kasus vitest dari kontrak
 * d232ddf (drafts/kontrak-stg-v333-occupations-topn-2026-10-21.md).
 */
import { describe, expect, it } from 'vitest'
import { parseOccupations, topOccupations } from './top-occupations'

describe('top-occupations fase i', () => {
  it('kasus 1: input kosong menghasilkan hasil nol', () => {
    expect(topOccupations([], 5)).toEqual({
      items: [],
      distinctCount: 0,
      totalValid: 0,
      excludedEmpty: 0,
    })
  })

  it('kasus 2: hitungan dasar menggabungkan label sama', () => {
    const result = topOccupations(
      [{ occupation: 'Farmer' }, { occupation: 'Teacher' }, { occupation: 'Farmer' }],
      5,
    )
    expect(result.items).toEqual([
      { occupation: 'farmer', count: 2 },
      { occupation: 'teacher', count: 1 },
    ])
    expect(result.totalValid).toBe(3)
  })

  it('kasus 3: merge case-folding menggabungkan ejaan beda kapital', () => {
    const result = topOccupations(
      [{ occupation: 'Blacksmith' }, { occupation: 'BLACKSMITH' }, { occupation: 'blacksmith' }],
      5,
    )
    expect(result.items).toEqual([{ occupation: 'blacksmith', count: 3 }])
    expect(result.distinctCount).toBe(1)
  })

  it('kasus 4: collapse whitespace beruntun jadi satu spasi', () => {
    const result = topOccupations(
      [
        { occupation: 'Farm   hand' },
        { occupation: 'Farm \t hand' },
        { occupation: 'farm hand' },
      ],
      5,
    )
    expect(result.items).toEqual([{ occupation: 'farm hand', count: 3 }])
    expect(result.distinctCount).toBe(1)
  })

  it('kasus 5: tie-break alphabetical asc saat count sama', () => {
    const result = topOccupations(
      [{ occupation: 'Weaver' }, { occupation: 'Baker' }, { occupation: 'Cooper' }],
      5,
    )
    expect(result.items.map((row) => row.occupation)).toEqual(['baker', 'cooper', 'weaver'])
  })

  it('kasus 6: urutan count desc didahulukan di atas alphabetical', () => {
    const result = topOccupations(
      [{ occupation: 'Zookeeper' }, { occupation: 'Zookeeper' }, { occupation: 'Astronomer' }],
      5,
    )
    expect(result.items).toEqual([
      { occupation: 'zookeeper', count: 2 },
      { occupation: 'astronomer', count: 1 },
    ])
  })

  it('kasus 7: limit memotong tepat sesuai peringkat', () => {
    const result = topOccupations(
      [
        { occupation: 'Farmer' },
        { occupation: 'Farmer' },
        { occupation: 'Farmer' },
        { occupation: 'Miller' },
        { occupation: 'Miller' },
        { occupation: 'Tanner' },
      ],
      2,
    )
    expect(result.items).toEqual([
      { occupation: 'farmer', count: 3 },
      { occupation: 'miller', count: 2 },
    ])
    expect(result.distinctCount).toBe(3)
  })

  it('kasus 8: limit lebih besar dari jumlah label unik mengembalikan semua', () => {
    const result = topOccupations([{ occupation: 'Baker' }, { occupation: 'Smith' }], 10)
    expect(result.items).toEqual([
      { occupation: 'baker', count: 1 },
      { occupation: 'smith', count: 1 },
    ])
    expect(result.distinctCount).toBe(2)
  })

  it('kasus 9: limit nol melempar Error', () => {
    expect(() => topOccupations([], 0)).toThrow(/limit wajib integer >= 1/)
  })

  it('kasus 10: limit bukan integer melempar Error', () => {
    expect(() => topOccupations([], 1.5)).toThrow(/limit wajib integer >= 1/)
    expect(() => topOccupations([], Number.NaN)).toThrow(/limit wajib integer >= 1/)
  })

  it('kasus 11: input bukan array melempar Error', () => {
    expect(() => topOccupations('bukan array', 5)).toThrow(/payload bukan array/)
    expect(() => topOccupations(null, 5)).toThrow(/payload bukan array/)
    expect(() => topOccupations(undefined, 5)).toThrow(/payload bukan array/)
  })

  it('kasus 12: elemen bukan objek melempar Error ber-index', () => {
    expect(() => topOccupations([{ occupation: 'Farmer' }, 42], 5)).toThrow(
      /item\[1\]: hilang atau bukan objek/,
    )
  })

  it('kasus 13: occupation hilang melempar Error ber-index', () => {
    expect(() => topOccupations([{}], 5)).toThrow(/item\[0\]\.occupation: hilang atau bukan string/)
  })

  it('kasus 14: occupation bukan string melempar Error ber-index', () => {
    expect(() => topOccupations([{ occupation: 123 }], 5)).toThrow(
      /item\[0\]\.occupation: hilang atau bukan string/,
    )
  })

  it('kasus 15: string kosong dan whitespace dibuang masuk excludedEmpty', () => {
    const result = topOccupations(
      [{ occupation: '' }, { occupation: '   ' }, { occupation: '\t' }, { occupation: 'Farmer' }],
      5,
    )
    expect(result.items).toEqual([{ occupation: 'farmer', count: 1 }])
    expect(result.excludedEmpty).toBe(3)
    expect(result.totalValid).toBe(1)
  })

  it('kasus 16: distinctCount menghitung label unik dari totalValid', () => {
    const result = topOccupations(
      [
        { occupation: 'Farmer' },
        { occupation: 'FARMER' },
        { occupation: 'Smith' },
        { occupation: 'Smith' },
        { occupation: 'Smith' },
        { occupation: '' },
      ],
      5,
    )
    expect(result.distinctCount).toBe(2)
    expect(result.totalValid).toBe(5)
    expect(result.excludedEmpty).toBe(1)
  })

  it('kasus tambahan: parser strict parseOccupations konsisten dengan topOccupations', () => {
    expect(parseOccupations([{ occupation: ' Farmer ' }])).toEqual([' Farmer '])
    expect(() => parseOccupations({})).toThrow(/payload bukan array/)
  })
})
