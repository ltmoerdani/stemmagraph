/**
 * Test death causes by sex (v334 fase i): 18 kasus kontrak,
 * mirror pola v332 v333. Semua deterministik, tanpa I/O.
 */
import { describe, expect, it } from 'vitest'

import { deathCausesBySex } from './death-causes-by-sex'

describe('deathCausesBySex', () => {
  it('input kosong: tiga seri kosong, counter nol', () => {
    expect(deathCausesBySex([], 5)).toEqual({
      series: {
        F: { items: [], totalValid: 0 },
        M: { items: [], totalValid: 0 },
        U: { items: [], totalValid: 0 },
      },
      distinctCount: 0,
      totalValid: 0,
      excludedEmpty: 0,
    })
  })

  it('hitungan dasar per sex', () => {
    const result = deathCausesBySex(
      [
        { cause: 'flu', sex: 'F' },
        { cause: 'flu', sex: 'F' },
        { cause: 'flu', sex: 'M' },
        { cause: 'covid', sex: 'M' },
      ],
      5,
    )
    expect(result.series.F).toEqual({ items: [{ cause: 'flu', count: 2 }], totalValid: 2 })
    expect(result.series.M.items).toEqual([
      { cause: 'covid', count: 1 },
      { cause: 'flu', count: 1 },
    ])
    expect(result.series.M.totalValid).toBe(2)
    expect(result.series.U).toEqual({ items: [], totalValid: 0 })
    expect(result.totalValid).toBe(4)
    expect(result.distinctCount).toBe(2)
    expect(result.excludedEmpty).toBe(0)
  })

  it('merge case-folding cause: trim lowercase collapse whitespace', () => {
    const result = deathCausesBySex(
      [
        { cause: 'Flu', sex: 'F' },
        { cause: 'flu ', sex: 'F' },
        { cause: '  FLU  ', sex: 'F' },
        { cause: 'flu\t biasa', sex: 'F' },
      ],
      5,
    )
    expect(result.series.F).toEqual({
      items: [{ cause: 'flu biasa', count: 1 }, { cause: 'flu', count: 3 }].sort((a, b) =>
        a.cause < b.cause ? -1 : 1,
      ),
      totalValid: 4,
    })
    expect(result.distinctCount).toBe(2)
    expect(result.series.F.items[0].count).toBe(3)
  })

  it('sex lowercase naik ke uppercase seri F', () => {
    const result = deathCausesBySex([{ cause: 'flu', sex: 'f' }], 5)
    expect(result.series.F.totalValid).toBe(1)
    expect(result.series.F.items).toEqual([{ cause: 'flu', count: 1 }])
    expect(result.series.U.totalValid).toBe(0)
  })

  it('sex kosong atau whitespace masuk seri U', () => {
    const result = deathCausesBySex(
      [
        { cause: 'flu', sex: '' },
        { cause: 'flu', sex: '   ' },
        { cause: 'flu', sex: 'x' },
      ],
      5,
    )
    expect(result.series.U).toEqual({ items: [{ cause: 'flu', count: 3 }], totalValid: 3 })
    expect(result.series.F.totalValid).toBe(0)
    expect(result.series.M.totalValid).toBe(0)
    expect(result.excludedEmpty).toBe(0)
  })

  it('cause kosong atau whitespace masuk excludedEmpty, seri tetap kosong', () => {
    const result = deathCausesBySex(
      [
        { cause: '', sex: 'F' },
        { cause: '   ', sex: 'M' },
      ],
      5,
    )
    expect(result.excludedEmpty).toBe(2)
    expect(result.totalValid).toBe(0)
    expect(result.series.F.items).toEqual([])
    expect(result.series.M.items).toEqual([])
    expect(result.series.U.items).toEqual([])
    expect(result.distinctCount).toBe(0)
  })

  it('cause dan sex kosong sekaligus dihitung sekali di excludedEmpty', () => {
    const result = deathCausesBySex([{ cause: '', sex: '' }], 5)
    expect(result.excludedEmpty).toBe(1)
    expect(result.totalValid).toBe(0)
    expect(result.distinctCount).toBe(0)
  })

  it('tie-break alphabetical asc locale-independent per seri', () => {
    const result = deathCausesBySex(
      [
        { cause: 'bronkitis', sex: 'F' },
        { cause: 'Asma', sex: 'F' },
        { cause: ' anemia', sex: 'F' },
      ],
      5,
    )
    expect(result.series.F.items.map((row) => row.cause)).toEqual(['anemia', 'asma', 'bronkitis'])
  })

  it('urutan count desc per seri', () => {
    const result = deathCausesBySex(
      [
        { cause: 'z', sex: 'M' },
        { cause: 'z', sex: 'M' },
        { cause: 'z', sex: 'M' },
        { cause: 'y', sex: 'M' },
        { cause: 'y', sex: 'M' },
        { cause: 'x', sex: 'M' },
      ],
      5,
    )
    expect(result.series.M.items.map((row) => row.cause)).toEqual(['z', 'y', 'x'])
    expect(result.series.M.items.map((row) => row.count)).toEqual([3, 2, 1])
  })

  it('limit memotong tiap seri independen dengan limit sama', () => {
    const result = deathCausesBySex(
      [
        { cause: 'a1', sex: 'F' },
        { cause: 'a2', sex: 'F' },
        { cause: 'a3', sex: 'F' },
        { cause: 'b1', sex: 'M' },
        { cause: 'b2', sex: 'M' },
        { cause: 'c1', sex: 'x' },
      ],
      2,
    )
    expect(result.series.F.items).toHaveLength(2)
    expect(result.series.M.items).toHaveLength(2)
    expect(result.series.U.items).toHaveLength(1)
    expect(result.series.F.totalValid).toBe(3)
    expect(result.distinctCount).toBe(6)
  })

  it('limit nol throw', () => {
    expect(() => deathCausesBySex([], 0)).toThrow(/death-causes-by-sex/)
  })

  it('limit bukan integer throw', () => {
    expect(() => deathCausesBySex([], 1.5)).toThrow(/death-causes-by-sex/)
    expect(() => deathCausesBySex([], Number.NaN)).toThrow(/death-causes-by-sex/)
  })

  it('input bukan array throw', () => {
    expect(() => deathCausesBySex('bukan array', 1)).toThrow(/death-causes-by-sex: payload bukan array/)
    expect(() => deathCausesBySex(null, 1)).toThrow(/death-causes-by-sex: payload bukan array/)
  })

  it('elemen bukan objek throw ber-index', () => {
    expect(() => deathCausesBySex([{ cause: 'flu', sex: 'F' }, 42], 1)).toThrow(
      /death-causes-by-sex item\[1\]/,
    )
  })

  it('cause hilang throw ber-index', () => {
    expect(() => deathCausesBySex([{ sex: 'F' }], 1)).toThrow(/item\[0\]\.cause/)
  })

  it('sex hilang throw ber-index', () => {
    expect(() => deathCausesBySex([{ cause: 'flu' }], 1)).toThrow(/item\[0\]\.sex/)
  })

  it('sex bukan string throw ber-index', () => {
    expect(() => deathCausesBySex([{ cause: 'flu', sex: 3 }], 1)).toThrow(/item\[0\]\.sex/)
  })

  it('distinctCount dihitung lintas seri cause normalized unik', () => {
    const result = deathCausesBySex(
      [
        { cause: 'Flu', sex: 'F' },
        { cause: 'flu', sex: 'M' },
        { cause: 'FLU', sex: '' },
        { cause: 'covid', sex: 'F' },
        { cause: 'covid', sex: 'M' },
      ],
      5,
    )
    expect(result.distinctCount).toBe(2)
    expect(result.totalValid).toBe(5)
  })
})
