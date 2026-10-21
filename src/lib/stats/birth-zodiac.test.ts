/**
 * Test v335 births-by-zodiac fase i: kasus vitest dari kontrak
 * drafts/kontrak-stg-v335-births-by-zodiac-2026-10-21.md. Test-only,
 * pure: nihil DB, nihil jaringan, nihil jam sistem sehingga
 * deterministik penuh.
 */
import { describe, expect, it } from 'vitest'
import { computeBirthsByZodiac, type BirthZodiacEntry } from './birth-zodiac'

function d(year: number, month: number, day: number): BirthZodiacEntry {
  return { birthDate: { year, month, day } }
}

function labelOf(month: number, day: number): string {
  const result = computeBirthsByZodiac([d(2001, month, day)])
  return result.items[0]?.label ?? ''
}

describe('birth-zodiac fase i', () => {
  it('kasus 1: input kosong menghasilkan payload nol', () => {
    expect(computeBirthsByZodiac([])).toEqual({
      items: [],
      totalDated: 0,
      excludedEmpty: 0,
    })
  })

  it('kasus 2: boundary representatif Aries dan Pisces (3/21, 3/20)', () => {
    expect(labelOf(3, 21)).toBe('Aries')
    expect(labelOf(3, 20)).toBe('Pisces')
  })

  it('kasus 3: boundary Capricorn melintasi tahun baru (12/22, 1/19)', () => {
    expect(labelOf(12, 22)).toBe('Capricorn')
    expect(labelOf(1, 19)).toBe('Capricorn')
  })

  it('kasus 4: boundary Aquarius (1/20, 2/18)', () => {
    expect(labelOf(1, 20)).toBe('Aquarius')
    expect(labelOf(2, 18)).toBe('Aquarius')
  })

  it('kasus 5: boundary Pisces atas (2/19)', () => {
    expect(labelOf(2, 19)).toBe('Pisces')
  })

  it('kasus 6: boundary Sagittarius dan Scorpio (11/22, 11/21)', () => {
    expect(labelOf(11, 22)).toBe('Sagittarius')
    expect(labelOf(11, 21)).toBe('Scorpio')
  })

  it('kasus 7: batas bawah dan atas seluruh 12 rasi tepat satu hari', () => {
    const pasangan: Array<[number, number, string]> = [
      [3, 21, 'Aries'],
      [4, 19, 'Aries'],
      [4, 20, 'Taurus'],
      [5, 20, 'Taurus'],
      [5, 21, 'Gemini'],
      [6, 20, 'Gemini'],
      [6, 21, 'Cancer'],
      [7, 22, 'Cancer'],
      [7, 23, 'Leo'],
      [8, 22, 'Leo'],
      [8, 23, 'Virgo'],
      [9, 22, 'Virgo'],
      [9, 23, 'Libra'],
      [10, 22, 'Libra'],
      [10, 23, 'Scorpio'],
      [11, 21, 'Scorpio'],
      [11, 22, 'Sagittarius'],
      [12, 21, 'Sagittarius'],
      [12, 22, 'Capricorn'],
      [1, 19, 'Capricorn'],
      [1, 20, 'Aquarius'],
      [2, 18, 'Aquarius'],
      [2, 19, 'Pisces'],
      [3, 20, 'Pisces'],
    ]
    const result = computeBirthsByZodiac(pasangan.map(([m, day]) => d(2001, m, day)))
    expect(result.totalDated).toBe(24)
    expect(result.excludedEmpty).toBe(0)
    expect(result.items.map((i) => i.label)).toEqual([
      'Aquarius',
      'Aries',
      'Cancer',
      'Capricorn',
      'Gemini',
      'Leo',
      'Libra',
      'Pisces',
      'Sagittarius',
      'Scorpio',
      'Taurus',
      'Virgo',
    ])
    expect(result.items.every((i) => i.count === 2)).toBe(true)
  })

  it('kasus 8: 29 Februari kabisat 2000 sah dan jatuh Pisces', () => {
    const result = computeBirthsByZodiac([d(2000, 2, 29)])
    expect(result.items).toEqual([{ label: 'Pisces', count: 1 }])
    expect(result.totalDated).toBe(1)
  })

  it('kasus 9: 29 Februari non-kabisat 2001 lempar', () => {
    expect(() => computeBirthsByZodiac([d(2001, 2, 29)])).toThrow(/day/)
  })

  it('kasus 10: 29 Februari abad 1900 lempar (kabisat Gregorian)', () => {
    expect(() => computeBirthsByZodiac([d(1900, 2, 29)])).toThrow(/day/)
  })

  it('kasus 11: agregat beberapa entri urut count desc', () => {
    const result = computeBirthsByZodiac([
      d(1990, 3, 21),
      d(1991, 4, 1),
      d(1992, 4, 10),
      d(1980, 7, 23),
      d(1981, 8, 1),
      d(1970, 8, 23),
    ])
    expect(result.items).toEqual([
      { label: 'Aries', count: 3 },
      { label: 'Leo', count: 2 },
      { label: 'Virgo', count: 1 },
    ])
    expect(result.totalDated).toBe(6)
    expect(result.excludedEmpty).toBe(0)
  })

  it('kasus 12: tie count diurut alphabetical asc berdasar label lowercase', () => {
    const result = computeBirthsByZodiac([
      d(1990, 8, 25),
      d(1991, 9, 1),
      d(1980, 4, 2),
      d(1981, 4, 15),
      d(1970, 5, 5),
    ])
    expect(result.items).toEqual([
      { label: 'Aries', count: 2 },
      { label: 'Virgo', count: 2 },
      { label: 'Taurus', count: 1 },
    ])
  })

  it('kasus 13: urutan input diacak tidak mengubah output', () => {
    const a = [d(1990, 3, 21), d(1991, 4, 1), d(1992, 4, 10)]
    const b = [d(1992, 4, 10), d(1990, 3, 21), d(1991, 4, 1)]
    expect(computeBirthsByZodiac(a)).toEqual(computeBirthsByZodiac(b))
  })

  it('kasus 14: tanggal parsial dan kosong masuk excludedEmpty', () => {
    const result = computeBirthsByZodiac([
      { birthDate: { year: 1990, month: 3 } },
      { birthDate: { year: 1990 } },
      { birthDate: { date: '1990-03-21' } },
      { birthDate: {} },
      {},
      { birthDate: null },
      d(2000, 1, 5),
    ])
    expect(result.items).toEqual([{ label: 'Capricorn', count: 1 }])
    expect(result.totalDated).toBe(1)
    expect(result.excludedEmpty).toBe(6)
  })

  it('kasus 15: input bukan array lempar', () => {
    expect(() => computeBirthsByZodiac('bukan array')).toThrow(/bukan array/)
    expect(() => computeBirthsByZodiac(null)).toThrow(/bukan array/)
  })

  it('kasus 16: entri bukan objek lempar dengan indeks', () => {
    expect(() => computeBirthsByZodiac([d(2000, 1, 1), 'rusak' as unknown as BirthZodiacEntry])).toThrow(
      /entry\[1\].*bukan objek/,
    )
    expect(() => computeBirthsByZodiac([null as unknown as BirthZodiacEntry])).toThrow(/bukan objek/)
    expect(() =>
      computeBirthsByZodiac([[] as unknown as BirthZodiacEntry]),
    ).toThrow(/bukan objek/)
  })

  it('kasus 17: birthDate bukan objek lempar', () => {
    expect(() =>
      computeBirthsByZodiac([
        { birthDate: '1990-03-21' } as unknown as BirthZodiacEntry,
      ]),
    ).toThrow(/birthDate: bukan objek/)
  })

  it('kasus 18: month 0 dan month 13 lempar', () => {
    expect(() => computeBirthsByZodiac([d(2000, 0, 10)])).toThrow(/month/)
    expect(() => computeBirthsByZodiac([d(2000, 13, 10)])).toThrow(/month/)
  })

  it('kasus 19: day 32 Januari dan day 31 April lempar, 30 April sah', () => {
    expect(() => computeBirthsByZodiac([d(2000, 1, 32)])).toThrow(/day/)
    expect(() => computeBirthsByZodiac([d(2000, 4, 31)])).toThrow(/day/)
    expect(() => computeBirthsByZodiac([d(2000, 4, 30)])).not.toThrow()
    expect(() => computeBirthsByZodiac([d(2000, 2, 30)])).toThrow(/day/)
  })

  it('kasus 20: birthDate.date bukan string lempar', () => {
    expect(() =>
      computeBirthsByZodiac([
        { birthDate: { date: 19900321, year: 1990, month: 3, day: 21 } } as unknown as BirthZodiacEntry,
      ]),
    ).toThrow(/date: bukan string/)
  })

  it('kasus 21: label keluar Title Case kanonik, bukan lowercase', () => {
    const result = computeBirthsByZodiac([d(1990, 3, 25)])
    expect(result.items[0]?.label).toBe('Aries')
    expect(result.items[0]?.label).not.toBe('aries')
  })

  it('kasus 22: field pecahan dianggap payload rusak dan lempar', () => {
    expect(() => computeBirthsByZodiac([d(2000, 3.5, 21)])).toThrow(/month.*bukan integer/)
    expect(() => computeBirthsByZodiac([d(2000, 3, 21.5)])).toThrow(/day.*bukan integer/)
  })
})
