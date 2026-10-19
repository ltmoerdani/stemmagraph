import { describe, expect, it } from 'vitest'

import { computeGivenNameTrends, type NameTrendMember } from './given-name-trends'

function member(birthDate: string, givenName: string): NameTrendMember {
  return { birthDate, givenName }
}

describe('computeGivenNameTrends', () => {
  it('kasus 1: input kosong menghasilkan struktur kosong', () => {
    expect(computeGivenNameTrends([])).toEqual({
      names: [],
      decades: [],
      series: [],
      totalNames: 0,
    })
  })

  it('kasus 2: satu nama satu dekade dasar', () => {
    const result = computeGivenNameTrends([
      member('1970-05-10', 'Meri'),
      member('1972-01-02', 'Meri'),
      member('1975-03-04', 'Johan'),
    ])
    expect(result.decades).toEqual(['1970s'])
    expect(result.names).toEqual(['meri', 'johan'])
    expect(result.totalNames).toBe(2)
    expect(result.series[0]).toEqual({
      name: 'meri',
      countsByDecade: { '1970s': 2 },
    })
  })

  it('kasus 3: fold case MERI meri Meri dihitung satu nama', () => {
    const result = computeGivenNameTrends([
      member('1961-01-01', 'MERI'),
      member('1962-02-02', 'meri'),
      member('1963-03-03', 'Meri'),
    ])
    expect(result.names).toEqual(['meri'])
    expect(result.totalNames).toBe(1)
    expect(result.series[0].countsByDecade).toEqual({ '1960s': 3 })
  })

  it('kasus 4: tanda baca pada token dibersihkan', () => {
    const result = computeGivenNameTrends([
      member('1971-04-05', 'Meri.'),
      member('1972-05-06', "O'Brien"),
      member('1973-06-07', 'Anna-Maria Putri'),
    ])
    expect(result.names).toEqual(['annamaria', 'meri', 'obrien'])
    expect(result.totalNames).toBe(3)
  })

  it('kasus 5: guard placeholder @P.N. dan nama kosong dibuang', () => {
    const result = computeGivenNameTrends([
      member('1970-01-01', '@P.N.'),
      member('1971-01-01', '@P.N.@'),
      member('1972-01-01', ''),
      member('1973-01-01', '   '),
      member('1974-01-01', '...'),
      member('1975-01-01', 'Meri'),
    ])
    expect(result.names).toEqual(['meri'])
    expect(result.totalNames).toBe(1)
    expect(result.decades).toEqual(['1970s'])
  })

  it('kasus 6: dedup token per orang, nama ganda sama dihitung sekali', () => {
    const result = computeGivenNameTrends([
      member('1970-06-15', 'Meri Meri'),
      member('1971-06-15', 'Meri'),
    ])
    expect(result.series[0].countsByDecade).toEqual({ '1970s': 2 })
  })

  it('kasus 7: dua dekade terpisah urut kronologis ASC', () => {
    const result = computeGivenNameTrends([
      member('1963-08-09', 'Meri'),
      member('1955-04-04', 'Johan'),
      member('1968-09-09', 'Meri'),
    ])
    expect(result.decades).toEqual(['1950s', '1960s'])
    expect(result.series[0].countsByDecade).toEqual({ '1950s': 0, '1960s': 2 })
    expect(result.series[1].countsByDecade).toEqual({ '1950s': 1, '1960s': 0 })
  })

  it('kasus 8: topN memotong daftar names dan series', () => {
    const members = [
      member('1970-01-01', 'Ayu'),
      member('1970-02-02', 'Budi'),
      member('1970-03-03', 'Citra'),
      member('1971-01-01', 'Ayu'),
      member('1971-02-02', 'Budi'),
    ]
    const result = computeGivenNameTrends(members, { topN: 2 })
    expect(result.names).toEqual(['ayu', 'budi'])
    expect(result.series).toHaveLength(2)
    expect(result.totalNames).toBe(3)
  })

  it('kasus 9: topN 0, negatif, dan di atas 50 di-clamp konsisten rentang 1 sampai 50', () => {
    const members = [
      member('1970-01-01', 'Ayu'),
      member('1970-02-02', 'Budi'),
      member('1970-03-03', 'Citra'),
    ]
    const zero = computeGivenNameTrends(members, { topN: 0 })
    expect(zero.names).toEqual(['ayu'])
    const negative = computeGivenNameTrends(members, { topN: -5 })
    expect(negative.names).toEqual(['ayu'])
    const above = computeGivenNameTrends(members, { topN: 100 })
    expect(above.names).toEqual(['ayu', 'budi', 'citra'])
    const defaults = computeGivenNameTrends(members)
    expect(defaults.names).toEqual(['ayu', 'budi', 'citra'])
  })

  it('kasus 10: countsByDecade berisi nol eksplisit untuk semua decades', () => {
    const result = computeGivenNameTrends([
      member('1950-01-01', 'Meri'),
      member('1960-01-01', 'Johan'),
      member('1970-01-01', 'Meri'),
    ])
    expect(result.decades).toEqual(['1950s', '1960s', '1970s'])
    expect(result.series[0].countsByDecade).toEqual({ '1950s': 1, '1960s': 0, '1970s': 1 })
    expect(result.series[1].countsByDecade).toEqual({ '1950s': 0, '1960s': 1, '1970s': 0 })
  })

  it('kasus 11: tanggal tak valid format dan kalender DILEMPAR Error', () => {
    expect(() => computeGivenNameTrends([member('1970/01/01', 'Meri')])).toThrow(Error)
    expect(() => computeGivenNameTrends([member('1970-13-01', 'Meri')])).toThrow(Error)
    expect(() => computeGivenNameTrends([member('1970-02-30', 'Meri')])).toThrow(Error)
    expect(() => computeGivenNameTrends([member('1971-02-29', 'Meri')])).toThrow(Error)
    expect(() => computeGivenNameTrends([member('1900-02-29', 'Meri')])).toThrow(Error)
    expect(() => computeGivenNameTrends([member('', 'Meri')])).toThrow(Error)
    expect(() => computeGivenNameTrends([member('1972-02-29', 'Meri')])).not.toThrow()
  })

  it('kasus 12: determinisme, dua pemanggilan dan urutan input berbeda hasil identik', () => {
    const members = [
      member('1970-01-01', 'Meri'),
      member('1970-02-02', 'Johan'),
      member('1971-03-03', 'Meri'),
      member('1972-04-04', 'Johan'),
      member('1973-05-05', 'Ayu'),
    ]
    const first = computeGivenNameTrends(members, { topN: 3 })
    const second = computeGivenNameTrends(members, { topN: 3 })
    expect(second).toEqual(first)
    const shuffled = computeGivenNameTrends(
      [members[3], members[0], members[4], members[2], members[1]],
      { topN: 3 },
    )
    expect(shuffled).toEqual(first)
  })

  it('kasus 13: tie total count diurutkan alfabetis ASC', () => {
    const result = computeGivenNameTrends([
      member('1970-01-01', 'Zaki'),
      member('1970-02-02', 'Budi'),
      member('1971-03-03', 'Ayu'),
    ])
    expect(result.names).toEqual(['ayu', 'budi', 'zaki'])
    expect(result.totalNames).toBe(3)
  })
})
