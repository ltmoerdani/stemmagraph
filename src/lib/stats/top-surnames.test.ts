import { describe, expect, it } from 'vitest'

import { computeTopSurnames, type SurnameMember } from './top-surnames'

function member(birthDate: string, surname: string): SurnameMember {
  return { birthDate, surname }
}

describe('computeTopSurnames', () => {
  it('kasus 1: input kosong menghasilkan surnames kosong dan window null', () => {
    expect(computeTopSurnames([])).toEqual({
      surnames: [],
      totalSurnames: 0,
      window: null,
    })
  })

  it('kasus 2: distribusi dasar multi marga urut count DESC', () => {
    const result = computeTopSurnames([
      member('1970-05-10', 'Simatupang'),
      member('1972-01-02', 'Simatupang'),
      member('1975-03-04', 'Simatupang'),
      member('1971-02-03', 'Harahap'),
      member('1976-04-05', 'Harahap'),
      member('1977-05-06', 'Nababan'),
    ])
    expect(result.surnames).toEqual([
      { surname: 'simatupang', count: 3 },
      { surname: 'harahap', count: 2 },
      { surname: 'nababan', count: 1 },
    ])
    expect(result.totalSurnames).toBe(3)
  })

  it('kasus 3: tie count diurutkan alfabetis ASC', () => {
    const result = computeTopSurnames([
      member('1970-01-01', 'Zulkarnain'),
      member('1970-02-02', 'Batubara'),
      member('1971-03-03', 'Aritonang'),
    ])
    expect(result.surnames).toEqual([
      { surname: 'aritonang', count: 1 },
      { surname: 'batubara', count: 1 },
      { surname: 'zulkarnain', count: 1 },
    ])
    expect(result.totalSurnames).toBe(3)
  })

  it('kasus 4: topN default 10 memotong lebih dari sepuluh marga', () => {
    const members: SurnameMember[] = []
    for (let i = 1; i <= 12; i += 1) {
      const label = i < 10 ? `0${i}` : `${i}`
      members.push(member(`1970-01-${label}`, `Marga${label}`))
    }
    const result = computeTopSurnames(members)
    expect(result.surnames).toHaveLength(10)
    expect(result.totalSurnames).toBe(12)
  })

  it('kasus 5: clamp topN 0 menjadi 1', () => {
    const result = computeTopSurnames([
      member('1970-01-01', 'Harahap'),
      member('1971-01-01', 'Simatupang'),
    ], { topN: 0 })
    expect(result.surnames).toEqual([{ surname: 'harahap', count: 1 }])
    expect(result.totalSurnames).toBe(2)
  })

  it('kasus 6: clamp topN 999 menjadi 50', () => {
    const members: SurnameMember[] = []
    for (let i = 1; i <= 60; i += 1) {
      const label = `${i}`.padStart(2, '0')
      const year = 1970 + Math.floor((i - 1) / 28)
      const day = `${((i - 1) % 28) + 1}`.padStart(2, '0')
      members.push(member(`${year}-01-${day}`, `Marga${label}`))
    }
    const result = computeTopSurnames(members, { topN: 999 })
    expect(result.surnames).toHaveLength(50)
    expect(result.totalSurnames).toBe(60)
  })

  it('kasus 7: normalisasi trim dan fold case', () => {
    const result = computeTopSurnames([
      member('1961-01-01', '  Harahap  '),
      member('1962-02-02', 'HARAHAP'),
      member('1963-03-03', 'harahap'),
    ])
    expect(result.surnames).toEqual([{ surname: 'harahap', count: 3 }])
    expect(result.totalSurnames).toBe(1)
  })

  it('kasus 8: aksen dihapus, varian aksen sama dengan bentuk polos', () => {
    const result = computeTopSurnames([
      member('1970-01-01', 'S\u00edma'),
      member('1971-01-01', 'S\u012bma'),
      member('1972-01-01', 'sima'),
    ])
    expect(result.surnames).toEqual([{ surname: 'sima', count: 3 }])
    expect(result.totalSurnames).toBe(1)
  })

  it('kasus 9: tanda baca dan apostrof dihapus', () => {
    const result = computeTopSurnames([
      member('1971-04-05', "O'Brien"),
      member('1972-05-06', 'obrien'),
      member('1973-06-07', 'Van-der-Berg'),
    ])
    expect(result.surnames).toEqual([
      { surname: 'obrien', count: 2 },
      { surname: 'vanderberg', count: 1 },
    ])
    expect(result.totalSurnames).toBe(2)
  })

  it('kasus 10: placeholder @P.N. dan hasil kosong gugur tanpa error', () => {
    const result = computeTopSurnames([
      member('1970-01-01', '@P.N.'),
      member('1971-01-01', '@a@'),
      member('1972-01-01', ''),
      member('1973-01-01', '   '),
      member('1974-01-01', '...'),
      member('1975-01-01', 'Harahap'),
    ])
    expect(result.surnames).toEqual([{ surname: 'harahap', count: 1 }])
    expect(result.totalSurnames).toBe(1)
    expect(result.window).toEqual({ decade: '1970s', count: 1 })
  })

  it('kasus 11: format birthDate salah dilempar berprefiks top-surnames', () => {
    expect(() => computeTopSurnames([member('1970-13-01', 'Harahap')])).toThrowError(/top-surnames/)
    expect(() => computeTopSurnames([member('abc', 'Harahap')])).toThrowError(/top-surnames/)
    expect(() => computeTopSurnames([member('1970-1-1', 'Harahap')])).toThrowError(/top-surnames/)
  })

  it('kasus 12: kalender invalid termasuk 29 Feb non kabisat dilempar', () => {
    expect(() => computeTopSurnames([member('1970-02-30', 'Harahap')])).toThrowError(/top-surnames/)
    expect(() => computeTopSurnames([member('1971-02-29', 'Harahap')])).toThrowError(/top-surnames/)
    expect(() => computeTopSurnames([member('1970-00-10', 'Harahap')])).toThrowError(/top-surnames/)
    expect(() => computeTopSurnames([member('1970-01-00', 'Harahap')])).toThrowError(/top-surnames/)
    expect(() => computeTopSurnames([member('1972-02-29', 'Harahap')])).not.toThrow()
  })

  it('kasus 13: birthDate null atau tipe salah dilempar kontrak anchored strict', () => {
    expect(() => computeTopSurnames([{ birthDate: null, surname: 'Harahap' } as unknown as SurnameMember])).toThrowError(/top-surnames/)
    expect(() => computeTopSurnames([{ birthDate: 19700101, surname: 'Harahap' } as unknown as SurnameMember])).toThrowError(/top-surnames/)
    expect(() => computeTopSurnames([{ surname: 'Harahap' } as unknown as SurnameMember])).toThrowError(/top-surnames/)
  })

  it('kasus 14: window dekade agregat tertinggi', () => {
    const result = computeTopSurnames([
      member('1951-01-01', 'Harahap'),
      member('1970-01-02', 'Harahap'),
      member('1971-02-02', 'Simatupang'),
      member('1973-03-03', 'Nababan'),
      member('1975-04-04', 'Harahap'),
    ])
    expect(result.window).toEqual({ decade: '1970s', count: 4 })
  })

  it('kasus 15: tie window memilih dekade lebih awal', () => {
    const result = computeTopSurnames([
      member('1951-01-01', 'Harahap'),
      member('1955-01-01', 'Simatupang'),
      member('1971-01-01', 'Nababan'),
      member('1979-01-01', 'Siregar'),
    ])
    expect(result.window).toEqual({ decade: '1950s', count: 2 })
  })

  it('kasus 15b: tie window deterministik lintas urutan input (regresi insertion-order Map)', () => {
    const base: SurnameMember[] = [
      member('1951-01-01', 'A'),
      member('1955-01-01', 'B'),
      member('1971-01-01', 'C'),
      member('1979-01-01', 'D'),
    ]
    const asc = computeTopSurnames(base)
    const desc = computeTopSurnames([...base].reverse())
    expect(asc.window).toEqual({ decade: '1950s', count: 2 })
    expect(desc.window).toEqual(asc.window)
  })

  it('kasus 16: semua valid memastikan window non-null', () => {
    const result = computeTopSurnames([member('1999-12-31', 'Harahap')])
    expect(result.window).toEqual({ decade: '1990s', count: 1 })
    expect(result.surnames).toEqual([{ surname: 'harahap', count: 1 }])
    expect(result.totalSurnames).toBe(1)
  })

  it('kasus 17: determinisme dua urutan input hasil identik', () => {
    const members: SurnameMember[] = [
      member('1970-01-01', 'Harahap'),
      member('1971-02-02', 'Simatupang'),
      member('1972-03-03', 'Harahap'),
      member('1975-04-04', 'Nababan'),
      member('1976-05-05', 'Simatupang'),
    ]
    const first = computeTopSurnames(members, { topN: 2 })
    const shuffled = computeTopSurnames(
      [members[3], members[0], members[4], members[2], members[1]],
      { topN: 2 },
    )
    expect(shuffled).toEqual(first)
  })
})
