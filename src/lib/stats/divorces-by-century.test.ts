import { describe, expect, it } from 'vitest'
import {
  computeDivorcesByCentury,
  type DivorceRecord,
} from './divorces-by-century'

function rec(familyId: string, divorceDate: string | null): DivorceRecord {
  return { familyId, divorceDate }
}

describe('computeDivorcesByCentury', () => {
  it('kasus dasar satu abad', () => {
    const result = computeDivorcesByCentury([
      rec('F1', '1540-05-10'),
      rec('F2', '1566-01-02'),
      rec('F3', '1599-12-31'),
    ])
    expect(result.centuries).toEqual([{ century: '1500', count: 3 }])
    expect(result.total).toBe(3)
    expect(result.undated).toBe(0)
  })

  it('multi abad urut ASC numerik dari input acak', () => {
    const result = computeDivorcesByCentury([
      rec('F1', '1850-06-15'),
      rec('F2', '1720-03-01'),
      rec('F3', '1490-07-20'),
      rec('F4', '1999-11-11'),
      rec('F5', '1744-04-04'),
    ])
    expect(result.centuries.map((c) => c.century)).toEqual([
      '1400',
      '1700',
      '1800',
      '1900',
    ])
    expect(result.centuries.map((c) => c.count)).toEqual([1, 2, 1, 1])
  })

  it('urutan input diacak menghasilkan output identik', () => {
    const base = [
      rec('F1', '1520-01-01'),
      rec('F2', '1888-08-08'),
      rec('F3', '1611-11-11'),
      rec('F4', '1990-09-19'),
      rec('F5', null),
    ]
    const shuffled = [
      rec('F4', '1990-09-19'),
      rec('F1', '1520-01-01'),
      rec('F5', null),
      rec('F3', '1611-11-11'),
      rec('F2', '1888-08-08'),
    ]
    expect(computeDivorcesByCentury(shuffled)).toEqual(
      computeDivorcesByCentury(base),
    )
  })

  it('abad tanpa perceraian tidak muncul di output', () => {
    const result = computeDivorcesByCentury([
      rec('F1', '1510-02-02'),
      rec('F2', '1730-08-09'),
    ])
    expect(result.centuries).toEqual([
      { century: '1500', count: 1 },
      { century: '1700', count: 1 },
    ])
  })

  it('input kosong menghasilkan centuries kosong total 0 undated 0', () => {
    const result = computeDivorcesByCentury([])
    expect(result).toEqual({ centuries: [], total: 0, undated: 0 })
  })

  it('semua divorceDate null hanya menghasilkan undated', () => {
    const result = computeDivorcesByCentury([
      rec('F1', null),
      rec('F2', null),
      rec('F3', null),
    ])
    expect(result.centuries).toEqual([])
    expect(result.total).toBe(0)
    expect(result.undated).toBe(3)
  })

  it('campuran dated dan undated dihitung terpisah', () => {
    const result = computeDivorcesByCentury([
      rec('F1', null),
      rec('F2', '1622-09-30'),
      rec('F3', null),
      rec('F4', '1815-05-05'),
    ])
    expect(result.undated).toBe(2)
    expect(result.total).toBe(2)
    expect(result.centuries).toEqual([
      { century: '1600', count: 1 },
      { century: '1800', count: 1 },
    ])
  })

  it('familyId duplikat tetap semua dihitung dua kali', () => {
    const result = computeDivorcesByCentury([
      rec('F1', '1550-01-01'),
      rec('F1', '1560-03-03'),
      rec('F2', '1850-07-07'),
    ])
    expect(result.centuries).toEqual([
      { century: '1500', count: 2 },
      { century: '1800', count: 1 },
    ])
    expect(result.total).toBe(3)
  })

  it('label century adalah string centuryStart', () => {
    const result = computeDivorcesByCentury([rec('F1', '1234-04-05')])
    expect(result.centuries[0]?.century).toBe('1200')
    expect(typeof result.centuries[0]?.century).toBe('string')
  })

  it('tahun 2000 masuk abad 2000 dan 1999 masuk abad 1900', () => {
    const result = computeDivorcesByCentury([
      rec('F1', '2000-01-01'),
      rec('F2', '1999-12-31'),
    ])
    expect(result.centuries).toEqual([
      { century: '1900', count: 1 },
      { century: '2000', count: 1 },
    ])
  })

  it('input bukan array throw dengan prefiks', () => {
    expect(() => computeDivorcesByCentury('bukan array')).toThrowError(
      /divorces-by-century/,
    )
    expect(() => computeDivorcesByCentury(null)).toThrowError(
      /divorces-by-century/,
    )
    expect(() => computeDivorcesByCentury({})).toThrowError(
      /divorces-by-century/,
    )
  })

  it('entri bukan objek throw ber-index', () => {
    const input = [rec('F1', '1500-01-01'), 42, rec('F2', '1501-01-01')]
    expect(() => computeDivorcesByCentury(input)).toThrowError(
      /divorces-by-century: entri index 1 bukan objek/,
    )
    expect(() => computeDivorcesByCentury([null])).toThrowError(
      /divorces-by-century/,
    )
    expect(() => computeDivorcesByCentury([['F1', '1500-01-01']])).toThrowError(
      /divorces-by-century/,
    )
  })

  it('familyId bukan string dan string kosong throw ber-index', () => {
    expect(() =>
      computeDivorcesByCentury([
        rec('F1', '1500-01-01'),
        { familyId: 7, divorceDate: null },
      ]),
    ).toThrowError(/divorces-by-century: entri index 1 familyId harus string/)
    expect(() => computeDivorcesByCentury([rec('', '1500-01-01')])).toThrowError(
      /divorces-by-century: entri index 0 familyId tidak boleh string kosong/,
    )
  })

  it('divorceDate tipe salah throw ber-index', () => {
    expect(() =>
      computeDivorcesByCentury([{ familyId: 'F1', divorceDate: 20200101 }]),
    ).toThrowError(/divorces-by-century: entri index 0/)
    expect(() =>
      computeDivorcesByCentury([{ familyId: 'F1', divorceDate: {} }]),
    ).toThrowError(/divorces-by-century/)
    expect(() =>
      computeDivorcesByCentury([{ familyId: 'F1', divorceDate: ['2020'] }]),
    ).toThrowError(/divorces-by-century/)
  })

  it('format bukan YYYY-MM-DD throw ber-index', () => {
    expect(() =>
      computeDivorcesByCentury([rec('F1', '01-01-2020')]),
    ).toThrowError(
      /divorces-by-century: entri index 0 divorceDate format bukan YYYY-MM-DD/,
    )
    expect(() =>
      computeDivorcesByCentury([rec('F1', '2020/01/01')]),
    ).toThrowError(/divorces-by-century/)
    expect(() =>
      computeDivorcesByCentury([rec('F1', '1500-1-1')]),
    ).toThrowError(/divorces-by-century/)
  })

  it('bulan 00 dan 13 throw', () => {
    expect(() =>
      computeDivorcesByCentury([rec('F1', '2020-00-10')]),
    ).toThrowError(
      /divorces-by-century: entri index 0 divorceDate bulan di luar 1 sampai 12/,
    )
    expect(() =>
      computeDivorcesByCentury([rec('F1', '2020-13-10')]),
    ).toThrowError(
      /divorces-by-century: entri index 0 divorceDate bulan di luar 1 sampai 12/,
    )
  })

  it('29 Feb kabisat sah dan non-kabisat throw', () => {
    const ok = computeDivorcesByCentury([rec('F1', '2024-02-29')])
    expect(ok.centuries).toEqual([{ century: '2000', count: 1 }])

    const leap400 = computeDivorcesByCentury([rec('F1', '2000-02-29')])
    expect(leap400.total).toBe(1)

    expect(() =>
      computeDivorcesByCentury([rec('F1', '2023-02-29')]),
    ).toThrowError(/divorces-by-century/)
    expect(() =>
      computeDivorcesByCentury([rec('F1', '1900-02-29')]),
    ).toThrowError(/divorces-by-century/)
  })

  it('tanggal kalender invalid throw: 31 Feb dan 31 April', () => {
    expect(() =>
      computeDivorcesByCentury([rec('F1', '2020-02-31')]),
    ).toThrowError(
      /divorces-by-century: entri index 0 divorceDate bukan tanggal kalender valid/,
    )
    expect(() =>
      computeDivorcesByCentury([rec('F1', '2020-04-31')]),
    ).toThrowError(
      /divorces-by-century: entri index 0 divorceDate bukan tanggal kalender valid/,
    )
    expect(() =>
      computeDivorcesByCentury([rec('F1', '2020-01-00')]),
    ).toThrowError(/divorces-by-century/)
  })

  it('tahun batas 4 digit: 0001 masuk abad 0 dan 9999 masuk abad 9900', () => {
    const result = computeDivorcesByCentury([
      rec('F1', '0001-01-01'),
      rec('F2', '9999-12-31'),
    ])
    expect(result.centuries).toEqual([
      { century: '0', count: 1 },
      { century: '9900', count: 1 },
    ])
    expect(result.total).toBe(2)
  })

  it('pesan error selalu memuat prefiks divorces-by-century', () => {
    const samples = [
      () => computeDivorcesByCentury(123),
      () => computeDivorcesByCentury([true]),
      () => computeDivorcesByCentury([{ divorceDate: null }]),
    ]
    for (const sample of samples) {
      expect(sample).toThrowError(/divorces-by-century/)
    }
  })
})
