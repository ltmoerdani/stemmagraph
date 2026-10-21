/**
 * Test v332 death-causes-topn fase i: 16 kasus vitest dari kontrak
 * e6c8e7e (drafts/kontrak-stg-v332-death-causes-topn-2026-10-21.md).
 */
import { describe, expect, it } from 'vitest'
import { deathCausesTopn, parseDeathCauses } from './death-causes-topn'

describe('death-causes-topn fase i', () => {
  it('kasus 1: input kosong menghasilkan hasil nol', () => {
    expect(deathCausesTopn([], 5)).toEqual({
      items: [],
      distinctCount: 0,
      totalValid: 0,
      excludedEmpty: 0,
    })
  })

  it('kasus 2: hitungan dasar menggabungkan label sama', () => {
    const result = deathCausesTopn(
      [{ cause: 'Heart disease' }, { cause: 'Stroke' }, { cause: 'Heart disease' }],
      5,
    )
    expect(result.items).toEqual([
      { cause: 'heart disease', count: 2 },
      { cause: 'stroke', count: 1 },
    ])
    expect(result.totalValid).toBe(3)
  })

  it('kasus 3: merge case-folding menggabungkan ejaan beda kapital', () => {
    const result = deathCausesTopn(
      [{ cause: 'Cancer' }, { cause: 'CANCER' }, { cause: 'cancer' }],
      5,
    )
    expect(result.items).toEqual([{ cause: 'cancer', count: 3 }])
    expect(result.distinctCount).toBe(1)
  })

  it('kasus 4: collapse whitespace beruntun jadi satu spasi', () => {
    const result = deathCausesTopn(
      [{ cause: 'Heart   disease' }, { cause: 'Heart \t disease' }, { cause: 'Heart disease' }],
      5,
    )
    expect(result.items).toEqual([{ cause: 'heart disease', count: 3 }])
    expect(result.distinctCount).toBe(1)
  })

  it('kasus 5: tie-break alphabetical asc saat count sama', () => {
    const result = deathCausesTopn(
      [{ cause: 'Stroke' }, { cause: 'Cancer' }, { cause: 'Anemia' }],
      5,
    )
    expect(result.items.map((row) => row.cause)).toEqual(['anemia', 'cancer', 'stroke'])
  })

  it('kasus 6: urutan count desc didahulukan di atas alphabetical', () => {
    const result = deathCausesTopn(
      [{ cause: 'Zebra' }, { cause: 'Zebra' }, { cause: 'Alpha' }],
      5,
    )
    expect(result.items.map((row) => row.cause)).toEqual(['zebra', 'alpha'])
  })

  it('kasus 7: limit memotong tepat sesuai posisi', () => {
    const result = deathCausesTopn(
      [
        { cause: 'A' },
        { cause: 'A' },
        { cause: 'A' },
        { cause: 'B' },
        { cause: 'B' },
        { cause: 'C' },
      ],
      2,
    )
    expect(result.items).toEqual([
      { cause: 'a', count: 3 },
      { cause: 'b', count: 2 },
    ])
  })

  it('kasus 8: limit nol lempar Error', () => {
    expect(() => deathCausesTopn([{ cause: 'x' }], 0)).toThrow(Error)
  })

  it('kasus 9: limit bukan integer lempar Error', () => {
    expect(() => deathCausesTopn([{ cause: 'x' }], 1.5)).toThrow(Error)
    expect(() => deathCausesTopn([{ cause: 'x' }], Number.NaN)).toThrow(Error)
  })

  it('kasus 10: input bukan array lempar Error', () => {
    expect(() => deathCausesTopn('bukan array', 3)).toThrow(/payload bukan array/)
  })

  it('kasus 11: elemen bukan objek lempar Error ber-index', () => {
    expect(() => deathCausesTopn([{ cause: 'x' }, 'rusak'], 3)).toThrow(/item\[1\]/)
  })

  it('kasus 12: cause hilang lempar Error ber-index', () => {
    expect(() => deathCausesTopn([{}], 3)).toThrow(/item\[0\]\.cause/)
  })

  it('kasus 13: cause bukan string lempar Error ber-index', () => {
    expect(() => deathCausesTopn([{ cause: 42 }], 3)).toThrow(/item\[0\]\.cause.*bukan string/)
  })

  it('kasus 14: string kosong dan whitespace dibuang masuk excludedEmpty', () => {
    const result = deathCausesTopn([{ cause: '' }, { cause: '   ' }, { cause: 'Fever' }], 5)
    expect(result.items).toEqual([{ cause: 'fever', count: 1 }])
    expect(result.excludedEmpty).toBe(2)
    expect(result.totalValid).toBe(1)
  })

  it('kasus 15: distinctCount tepat dari label normalized unik', () => {
    const result = deathCausesTopn(
      [{ cause: 'X' }, { cause: 'x ' }, { cause: '  x' }, { cause: 'Y' }],
      5,
    )
    expect(result.distinctCount).toBe(2)
    expect(result.totalValid).toBe(4)
  })

  it('kasus 16: limit melebihi jumlah label unik kembalikan semua', () => {
    const result = deathCausesTopn([{ cause: 'A' }, { cause: 'B' }], 99)
    expect(result.items).toHaveLength(2)
    expect(result.distinctCount).toBe(2)
  })

  it('kasus 17: deterministik terhadap urutan input', () => {
    const forward = deathCausesTopn(
      [{ cause: 'P' }, { cause: 'Q' }, { cause: 'P' }],
      5,
    )
    const backward = deathCausesTopn(
      [{ cause: 'P' }, { cause: 'Q' }, { cause: 'P' }].slice().reverse(),
      5,
    )
    expect(forward).toEqual(backward)
  })

  it('kasus 18: parseDeathCauses meneruskan cause mentah sebagai array string', () => {
    expect(parseDeathCauses([{ cause: 'A' }, { cause: 'b' }])).toEqual(['A', 'b'])
  })
})
