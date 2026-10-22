import { describe, expect, it } from 'vitest'
import {
  computeMarriagesByDecades,
  type MarriageRecord,
} from './marriages-by-decade'

function rec(familyId: string, marriageDate: string | null): MarriageRecord {
  return { familyId, marriageDate }
}

describe('computeMarriagesByDecades', () => {
  it('distribusi dasar multi dekade urut ASC', () => {
    const result = computeMarriagesByDecades([
      rec('F1', '1972-05-10'),
      rec('F2', '1954-01-02'),
      rec('F3', '1999-12-31'),
      rec('F4', '1958-07-19'),
    ])
    expect(result.decades).toEqual([
      { decade: '1950s', count: 2 },
      { decade: '1970s', count: 1 },
      { decade: '1990s', count: 1 },
    ])
    expect(result.total).toBe(4)
    expect(result.undated).toBe(0)
  })

  it('urutan input diacak menghasilkan output identik', () => {
    const base = [
      rec('F1', '1950-01-01'),
      rec('F2', '1988-08-08'),
      rec('F3', '1961-11-11'),
      rec('F4', '1990-09-19'),
      rec('F5', null),
    ]
    const shuffled = [
      rec('F4', '1990-09-19'),
      rec('F1', '1950-01-01'),
      rec('F5', null),
      rec('F3', '1961-11-11'),
      rec('F2', '1988-08-08'),
    ]
    expect(computeMarriagesByDecades(shuffled)).toEqual(
      computeMarriagesByDecades(base),
    )
  })

  it('dekade tunggal', () => {
    const result = computeMarriagesByDecades([
      rec('F1', '1941-02-03'),
      rec('F2', '1945-06-07'),
      rec('F3', '1949-12-30'),
    ])
    expect(result.decades).toEqual([{ decade: '1940s', count: 3 }])
    expect(result.total).toBe(3)
  })

  it('input kosong menghasilkan decades kosong total 0 undated 0', () => {
    const result = computeMarriagesByDecades([])
    expect(result).toEqual({ decades: [], total: 0, undated: 0 })
  })

  it('semua null menghasilkan decades kosong total 0 undated N', () => {
    const result = computeMarriagesByDecades([
      rec('F1', null),
      rec('F2', null),
      rec('F3', null),
    ])
    expect(result).toEqual({ decades: [], total: 0, undated: 3 })
  })

  it('batas dekade 1969 masuk 1960s dan 1970 masuk 1970s', () => {
    const result = computeMarriagesByDecades([
      rec('F1', '1969-12-31'),
      rec('F2', '1970-01-01'),
    ])
    expect(result.decades).toEqual([
      { decade: '1960s', count: 1 },
      { decade: '1970s', count: 1 },
    ])
  })

  it('mixed null dan dated', () => {
    const result = computeMarriagesByDecades([
      rec('F1', null),
      rec('F2', '1935-04-04'),
      rec('F3', null),
      rec('F4', '1939-05-05'),
    ])
    expect(result.decades).toEqual([{ decade: '1930s', count: 2 }])
    expect(result.total).toBe(2)
    expect(result.undated).toBe(2)
  })

  it('familyId duplikat tetap dihitung dua kali', () => {
    const result = computeMarriagesByDecades([
      rec('F1', '1955-01-01'),
      rec('F1', '1957-02-02'),
    ])
    expect(result.decades).toEqual([{ decade: '1950s', count: 2 }])
    expect(result.total).toBe(2)
  })

  it('total tepat sebagai jumlah count semua dekade', () => {
    const result = computeMarriagesByDecades([
      rec('F1', '1901-01-01'),
      rec('F2', '1949-06-06'),
      rec('F3', '1952-02-02'),
      rec('F4', '1998-03-03'),
    ])
    expect(result.decades.map((d) => d.count)).toEqual([1, 1, 1, 1])
    expect(result.total).toBe(4)
  })

  it('dekade tanpa pernikahan tidak muncul di output', () => {
    const result = computeMarriagesByDecades([
      rec('F1', '1910-02-02'),
      rec('F2', '1970-08-09'),
    ])
    expect(result.decades).toEqual([
      { decade: '1910s', count: 1 },
      { decade: '1970s', count: 1 },
    ])
  })

  it('label decade string dengan sufiks s', () => {
    const result = computeMarriagesByDecades([rec('F1', '1983-04-05')])
    expect(result.decades[0]?.decade).toBe('1980s')
    expect(typeof result.decades[0]?.decade).toBe('string')
  })

  it('input bukan array throw dengan prefiks', () => {
    expect(() => computeMarriagesByDecades('bukan array')).toThrowError(
      /marriages-by-decade/,
    )
    expect(() => computeMarriagesByDecades(null)).toThrowError(
      /marriages-by-decade/,
    )
    expect(() => computeMarriagesByDecades({})).toThrowError(
      /marriages-by-decade/,
    )
  })

  it('entri bukan objek throw ber-index', () => {
    const input = [rec('F1', '1950-01-01'), 42]
    expect(() => computeMarriagesByDecades(input)).toThrowError(
      /marriages-by-decade: entri index 1 bukan objek/,
    )
    expect(() => computeMarriagesByDecades([null])).toThrowError(
      /marriages-by-decade/,
    )
    expect(() => computeMarriagesByDecades([['F1', '1950-01-01']])).toThrowError(
      /marriages-by-decade/,
    )
  })

  it('familyId bukan string throw ber-index', () => {
    const input = [
      rec('F1', '1950-01-01'),
      { familyId: 7, marriageDate: null },
    ]
    expect(() => computeMarriagesByDecades(input)).toThrowError(
      /marriages-by-decade: entri index 1 familyId harus string/,
    )
  })

  it('familyId string kosong throw ber-index', () => {
    const input = [rec('', '1950-01-01')]
    expect(() => computeMarriagesByDecades(input)).toThrowError(
      /marriages-by-decade: entri index 0 familyId tidak boleh string kosong/,
    )
  })

  it('marriageDate tipe salah throw ber-index', () => {
    expect(() =>
      computeMarriagesByDecades([{ familyId: 'F1', marriageDate: 19500101 }]),
    ).toThrowError(/marriages-by-decade: entri index 0/)
    expect(() =>
      computeMarriagesByDecades([{ familyId: 'F1', marriageDate: {} }]),
    ).toThrowError(/marriages-by-decade/)
    expect(() =>
      computeMarriagesByDecades([{ familyId: 'F1', marriageDate: ['1950'] }]),
    ).toThrowError(/marriages-by-decade/)
  })

  it('format salah abc dan 1970-1-1 throw', () => {
    expect(() => computeMarriagesByDecades([rec('F1', 'abc')])).toThrowError(
      /marriages-by-decade: entri index 0 marriageDate format bukan YYYY-MM-DD/,
    )
    expect(() => computeMarriagesByDecades([rec('F1', '1970-1-1')])).toThrowError(
      /marriages-by-decade: entri index 0 marriageDate format bukan YYYY-MM-DD/,
    )
  })

  it('bulan 00 dan 13 throw', () => {
    expect(() => computeMarriagesByDecades([rec('F1', '1970-00-10')])).toThrowError(
      /marriages-by-decade: entri index 0 marriageDate bulan di luar 1 sampai 12/,
    )
    expect(() => computeMarriagesByDecades([rec('F1', '1970-13-10')])).toThrowError(
      /marriages-by-decade: entri index 0 marriageDate bulan di luar 1 sampai 12/,
    )
  })

  it('30 Feb throw', () => {
    expect(() => computeMarriagesByDecades([rec('F1', '2024-02-30')])).toThrowError(
      /marriages-by-decade: entri index 0 marriageDate bukan tanggal kalender valid/,
    )
  })

  it('29 Feb kabisat valid dan non-kabisat throw', () => {
    const ok = computeMarriagesByDecades([rec('F1', '2024-02-29')])
    expect(ok.decades).toEqual([{ decade: '2020s', count: 1 }])

    const leap400 = computeMarriagesByDecades([rec('F1', '2000-02-29')])
    expect(leap400.total).toBe(1)

    expect(() => computeMarriagesByDecades([rec('F1', '2023-02-29')])).toThrowError(
      /marriages-by-decade/,
    )
    expect(() => computeMarriagesByDecades([rec('F1', '1900-02-29')])).toThrowError(
      /marriages-by-decade/,
    )
  })

  it('pesan error selalu memuat prefiks marriages-by-decade', () => {
    const samples = [
      () => computeMarriagesByDecades(123),
      () => computeMarriagesByDecades([true]),
      () => computeMarriagesByDecades([{ marriageDate: null }]),
      () => computeMarriagesByDecades([rec('F1', '1950-31-01')]),
    ]
    for (const sample of samples) {
      expect(sample).toThrowError(/marriages-by-decade/)
    }
  })
})
