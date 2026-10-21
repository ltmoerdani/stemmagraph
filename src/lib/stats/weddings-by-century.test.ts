import { describe, expect, it } from 'vitest'
import {
  computeWeddingsByCentury,
  type WeddingRecord,
} from './weddings-by-century'

function rec(familyId: string, marriageDate: string | null): WeddingRecord {
  return { familyId, marriageDate }
}

describe('computeWeddingsByCentury', () => {
  it('kasus dasar satu abad', () => {
    const result = computeWeddingsByCentury([
      rec('F1', '1540-05-10'),
      rec('F2', '1566-01-02'),
      rec('F3', '1599-12-31'),
    ])
    expect(result.centuries).toEqual([{ century: '1500', count: 3 }])
    expect(result.total).toBe(3)
    expect(result.undated).toBe(0)
  })

  it('multi abad urut ASC numerik dari input acak', () => {
    const result = computeWeddingsByCentury([
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

  it('abad tanpa pernikahan tidak muncul di output', () => {
    const result = computeWeddingsByCentury([
      rec('F1', '1510-02-02'),
      rec('F2', '1730-08-09'),
    ])
    expect(result.centuries).toEqual([
      { century: '1500', count: 1 },
      { century: '1700', count: 1 },
    ])
  })

  it('marriageDate null masuk undated, bukan throw', () => {
    const result = computeWeddingsByCentury([
      rec('F1', null),
      rec('F2', '1622-09-30'),
    ])
    expect(result.undated).toBe(1)
    expect(result.total).toBe(1)
    expect(result.centuries).toEqual([{ century: '1600', count: 1 }])
  })

  it('total tepat sebagai jumlah count semua abad', () => {
    const result = computeWeddingsByCentury([
      rec('F1', '1701-01-01'),
      rec('F2', '1750-06-06'),
      rec('F3', '1802-02-02'),
      rec('F4', null),
    ])
    expect(result.total).toBe(3)
  })

  it('undated tepat untuk banyak null', () => {
    const result = computeWeddingsByCentury([
      rec('F1', null),
      rec('F2', null),
      rec('F3', null),
      rec('F4', '1815-05-05'),
    ])
    expect(result.undated).toBe(3)
    expect(result.total).toBe(1)
  })

  it('familyId duplikat tetap semua dihitung', () => {
    const result = computeWeddingsByCentury([
      rec('F1', '1550-01-01'),
      rec('F1', '1555-02-02'),
      rec('F1', '1560-03-03'),
    ])
    expect(result.centuries).toEqual([{ century: '1500', count: 3 }])
    expect(result.total).toBe(3)
  })

  it('label century adalah String(centuryStart)', () => {
    const result = computeWeddingsByCentury([rec('F1', '1234-04-05')])
    expect(result.centuries[0]?.century).toBe('1200')
    expect(typeof result.centuries[0]?.century).toBe('string')
  })

  it('tahun 2000 masuk abad 2000', () => {
    const result = computeWeddingsByCentury([rec('F1', '2000-01-01')])
    expect(result.centuries).toEqual([{ century: '2000', count: 1 }])
  })

  it('tahun 1999 masuk abad 1900', () => {
    const result = computeWeddingsByCentury([rec('F1', '1999-12-31')])
    expect(result.centuries).toEqual([{ century: '1900', count: 1 }])
  })

  it('input kosong menghasilkan centuries kosong total 0 undated 0', () => {
    const result = computeWeddingsByCentury([])
    expect(result).toEqual({ centuries: [], total: 0, undated: 0 })
  })

  it('urutan input acak menghasilkan output identik', () => {
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
    expect(computeWeddingsByCentury(shuffled)).toEqual(
      computeWeddingsByCentury(base),
    )
  })

  it('input bukan array throw dengan prefiks', () => {
    expect(() => computeWeddingsByCentury('bukan array')).toThrowError(
      /weddings-by-century/,
    )
    expect(() => computeWeddingsByCentury(null)).toThrowError(
      /weddings-by-century/,
    )
    expect(() => computeWeddingsByCentury({})).toThrowError(
      /weddings-by-century/,
    )
  })

  it('entri bukan objek throw ber-index', () => {
    const input = [rec('F1', '1500-01-01'), 42, rec('F2', '1501-01-01')]
    expect(() => computeWeddingsByCentury(input)).toThrowError(
      /weddings-by-century: entri index 1 bukan objek/,
    )
    expect(() => computeWeddingsByCentury([null])).toThrowError(
      /weddings-by-century/,
    )
    expect(() => computeWeddingsByCentury([['F1', '1500-01-01']])).toThrowError(
      /weddings-by-century/,
    )
  })

  it('familyId bukan string throw ber-index', () => {
    const input = [
      rec('F1', '1500-01-01'),
      { familyId: 7, marriageDate: null },
    ]
    expect(() => computeWeddingsByCentury(input)).toThrowError(
      /weddings-by-century: entri index 1 familyId harus string/,
    )
  })

  it('familyId string kosong throw ber-index', () => {
    const input = [rec('', '1500-01-01')]
    expect(() => computeWeddingsByCentury(input)).toThrowError(
      /weddings-by-century: entri index 0 familyId tidak boleh string kosong/,
    )
  })

  it('marriageDate tipe salah throw ber-index', () => {
    expect(() =>
      computeWeddingsByCentury([{ familyId: 'F1', marriageDate: 20200101 }]),
    ).toThrowError(/weddings-by-century: entri index 0/)
    expect(() =>
      computeWeddingsByCentury([{ familyId: 'F1', marriageDate: {} }]),
    ).toThrowError(/weddings-by-century/)
    expect(() =>
      computeWeddingsByCentury([{ familyId: 'F1', marriageDate: ['2020'] }]),
    ).toThrowError(/weddings-by-century/)
  })

  it('format bukan YYYY-MM-DD throw', () => {
    expect(() => computeWeddingsByCentury([rec('F1', '01-01-2020')])).toThrowError(
      /weddings-by-century: entri index 0 marriageDate format bukan YYYY-MM-DD/,
    )
    expect(() => computeWeddingsByCentury([rec('F1', '2020/01/01')])).toThrowError(
      /weddings-by-century/,
    )
  })

  it('bulan 00 dan 13 throw', () => {
    expect(() => computeWeddingsByCentury([rec('F1', '2020-00-10')])).toThrowError(
      /weddings-by-century: entri index 0 marriageDate bulan di luar 1 sampai 12/,
    )
    expect(() => computeWeddingsByCentury([rec('F1', '2020-13-10')])).toThrowError(
      /weddings-by-century: entri index 0 marriageDate bulan di luar 1 sampai 12/,
    )
  })

  it('tanggal tidak valid kalender throw', () => {
    expect(() => computeWeddingsByCentury([rec('F1', '2020-04-31')])).toThrowError(
      /weddings-by-century: entri index 0 marriageDate bukan tanggal kalender valid/,
    )
    expect(() => computeWeddingsByCentury([rec('F1', '2020-01-00')])).toThrowError(
      /weddings-by-century/,
    )
  })

  it('29 Feb kabisat valid dan non-kabisat throw', () => {
    const ok = computeWeddingsByCentury([rec('F1', '2024-02-29')])
    expect(ok.centuries).toEqual([{ century: '2000', count: 1 }])

    const leap400 = computeWeddingsByCentury([rec('F1', '2000-02-29')])
    expect(leap400.total).toBe(1)

    expect(() => computeWeddingsByCentury([rec('F1', '2023-02-29')])).toThrowError(
      /weddings-by-century/,
    )
    expect(() => computeWeddingsByCentury([rec('F1', '1900-02-29')])).toThrowError(
      /weddings-by-century/,
    )
  })

  it('pesan error selalu memuat prefiks weddings-by-century', () => {
    const samples = [
      () => computeWeddingsByCentury(123),
      () => computeWeddingsByCentury([true]),
      () => computeWeddingsByCentury([{ marriageDate: null }]),
      () => computeWeddingsByCentury([rec('F1', '1500-1-1')]),
    ]
    for (const sample of samples) {
      expect(sample).toThrowError(/weddings-by-century/)
    }
  })
})
