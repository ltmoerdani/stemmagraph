/**
 * Test sibling age gap (v344 fase i): 21 kasus sesuai checklist
 * kontrak bagian 5, pola gaya test v339/v343.
 */
import { describe, expect, it } from 'vitest'
import { computeSiblingAgeGap } from './sibling-age-gap'

const fam = (familyId: string, dates: string[]) => ({
  familyId,
  children: dates.map((birthDate, i) => ({ id: `${familyId}-c${i}`, birthDate })),
})

describe('computeSiblingAgeGap', () => {
  it('kasus 1: dasar satu keluarga 3 anak, gap konsekutif benar', () => {
    const r = computeSiblingAgeGap([fam('F1', ['1990-01-01', '1992-06-15', '1995-03-20'])])
    expect(r.gapsByYears).toEqual({ '2': 1, '3': 1 })
    expect(r.totalPairs).toBe(2)
    expect(r.familiesCounted).toBe(1)
    expect(r.maxGap).toBe(3)
  })

  it('kasus 2: gap 0 kembar tahun sama masuk kunci 0', () => {
    const r = computeSiblingAgeGap([fam('F1', ['1990-03-10', '1990-11-05'])])
    expect(r.gapsByYears).toEqual({ '0': 1 })
    expect(r.totalPairs).toBe(1)
    expect(r.maxGap).toBe(0)
  })

  it('kasus 3: multi keluarga terakumulasi lintas bucket', () => {
    const r = computeSiblingAgeGap([
      fam('F1', ['1990-01-01', '1991-01-01']),
      fam('F2', ['1980-05-05', '1980-05-06', '1983-05-05']),
    ])
    expect(r.gapsByYears).toEqual({ '0': 1, '1': 1, '3': 1 })
    expect(r.totalPairs).toBe(3)
    expect(r.familiesCounted).toBe(2)
    expect(r.maxGap).toBe(3)
  })

  it('kasus 4: keluarga 1 anak di-skip tanpa error', () => {
    const r = computeSiblingAgeGap([fam('F1', ['1990-01-01'])])
    expect(r.gapsByYears).toEqual({})
    expect(r.totalPairs).toBe(0)
    expect(r.familiesCounted).toBe(0)
    expect(r.maxGap).toBeNull()
  })

  it('kasus 5: children kosong di-skip, hasil kosong', () => {
    const r = computeSiblingAgeGap([fam('F1', [])])
    expect(r.gapsByYears).toEqual({})
    expect(r.totalPairs).toBe(0)
    expect(r.familiesCounted).toBe(0)
    expect(r.maxGap).toBeNull()
  })

  it('kasus 6: input families kosong hasil kosong dengan maxGap null', () => {
    const r = computeSiblingAgeGap([])
    expect(r).toEqual({ gapsByYears: {}, totalPairs: 0, familiesCounted: 0, maxGap: null })
  })

  it('kasus 7: urutan input families diacak hasil identik', () => {
    const a = [fam('F1', ['1990-01-01', '1993-01-01']), fam('F2', ['1985-01-01', '1986-01-01'])]
    const b = [a[1], a[0]]
    expect(computeSiblingAgeGap(a)).toEqual(computeSiblingAgeGap(b))
  })

  it('kasus 8: urutan anak acak di dalam keluarga tetap diurutkan', () => {
    const urut = computeSiblingAgeGap([fam('F1', ['1990-01-01', '1992-01-01'])])
    const acak = computeSiblingAgeGap([fam('F1', ['1992-01-01', '1990-01-01'])])
    expect(acak).toEqual(urut)
    expect(acak.gapsByYears).toEqual({ '2': 1 })
  })

  it('kasus 9: maxGapCap custom menggabungkan ke kunci >=N', () => {
    const r = computeSiblingAgeGap(
      [fam('F1', ['1990-01-01', '1995-01-01', '1998-01-01'])],
      { maxGapCap: 4 },
    )
    expect(r.gapsByYears).toEqual({ '>=4': 1, '3': 1 })
    expect(r.totalPairs).toBe(2)
    expect(r.maxGap).toBe(5)
  })

  it('kasus 10: maxGapCap default 30 menggabungkan ke >=30', () => {
    const r = computeSiblingAgeGap([fam('F1', ['1960-01-01', '1995-06-01'])])
    expect(r.gapsByYears).toEqual({ '>=30': 1 })
    expect(r.totalPairs).toBe(1)
    expect(r.maxGap).toBe(35)
  })

  it('kasus 11: gap tepat pada cap tetap pakai kunci angka', () => {
    const r = computeSiblingAgeGap([fam('F1', ['1960-01-01', '1990-01-01'])])
    expect(r.gapsByYears).toEqual({ '30': 1 })
  })

  it('kasus 12: maxGapCap invalid throw prefiks sibling-age-gap', () => {
    expect(() => computeSiblingAgeGap([], { maxGapCap: 0 })).toThrow(/sibling-age-gap/)
    expect(() => computeSiblingAgeGap([], { maxGapCap: 1.5 })).toThrow(/sibling-age-gap/)
    expect(() => computeSiblingAgeGap([], { maxGapCap: -2 })).toThrow(/sibling-age-gap/)
  })

  it('kasus 13: families duplikat tetap dihitung, familiesCounted unik', () => {
    const f = fam('F1', ['1990-01-01', '1992-01-01'])
    const r = computeSiblingAgeGap([f, { ...f, children: [...f.children] }])
    expect(r.gapsByYears).toEqual({ '2': 2 })
    expect(r.totalPairs).toBe(2)
    expect(r.familiesCounted).toBe(1)
  })

  it('kasus 14: input bukan array throw ber-index', () => {
    expect(() => computeSiblingAgeGap('bukan')).toThrow(/sibling-age-gap/)
    expect(() => computeSiblingAgeGap(null)).toThrow(/sibling-age-gap/)
  })

  it('kasus 15: entri keluarga bukan objek throw dengan index keluarga', () => {
    expect(() => computeSiblingAgeGap([fam('F1', ['1990-01-01', '1991-01-01']), 42]))
      .toThrow(/keluarga index 1/)
    expect(() => computeSiblingAgeGap([null])).toThrow(/keluarga index 0/)
  })

  it('kasus 16: familyId bukan string throw ber-index', () => {
    expect(() => computeSiblingAgeGap([{ familyId: 7, children: [] }]))
      .toThrow(/keluarga index 0 familyId/)
  })

  it('kasus 17: children bukan array throw ber-index', () => {
    expect(() => computeSiblingAgeGap([{ familyId: 'F1', children: 'x' }]))
      .toThrow(/keluarga index 0 children/)
  })

  it('kasus 18: anak bukan objek dan id bukan string throw ber-index', () => {
    expect(() => computeSiblingAgeGap([fam('F1', ['1990-01-01', '1991-01-01']), null]))
      .toThrow(/keluarga index 1/)
    expect(() =>
      computeSiblingAgeGap([
        { familyId: 'F1', children: [{ id: 1, birthDate: '1990-01-01' }, { id: 'b', birthDate: '1991-01-01' }] },
      ]),
    ).toThrow(/anak index 0 id/)
  })

  it('kasus 19: birthDate bukan string dan format salah throw ber-index', () => {
    expect(() =>
      computeSiblingAgeGap([{ familyId: 'F1', children: [{ id: 'a', birthDate: 19900101 }, { id: 'b', birthDate: '1991-01-01' }] }]),
    ).toThrow(/anak index 0 birthDate/)
    expect(() => computeSiblingAgeGap([fam('F1', ['1990/01/01', '1991-01-01'])]))
      .toThrow(/anak index 0 birthDate format/)
  })

  it('kasus 20: bulan 00 dan 13 throw, 29 Feb kabisat valid non-kabisat throw', () => {
    expect(() => computeSiblingAgeGap([fam('F1', ['1990-00-10', '1991-01-01'])])).toThrow(/bulan/)
    expect(() => computeSiblingAgeGap([fam('F1', ['1990-13-10', '1991-01-01'])])).toThrow(/bulan/)
    expect(() =>
      computeSiblingAgeGap([fam('F1', ['2000-02-29', '2001-01-01'])]),
    ).not.toThrow()
    expect(() => computeSiblingAgeGap([fam('F1', ['1900-02-29', '1901-01-01'])])).toThrow(/kalender/)
  })

  it('kasus 21: totalPairs dan maxGap lintas campuran cap dan gap 0', () => {
    const r = computeSiblingAgeGap([
      fam('A', ['1980-01-01', '1980-12-31', '2015-01-01']),
      fam('B', ['1970-05-05', '1971-05-05']),
    ])
    expect(r.gapsByYears).toEqual({ '0': 1, '1': 1, '>=30': 1 })
    expect(r.totalPairs).toBe(3)
    expect(r.familiesCounted).toBe(2)
    expect(r.maxGap).toBe(35)
  })
})
