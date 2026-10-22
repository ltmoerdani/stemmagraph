import { describe, it, expect } from 'vitest'
import { computeFamilySizeStackedByDecade } from './family-size-stacked-by-decade'

const entry = (referenceYear: number, childIds: string[]) => ({
  referenceYear,
  childIds,
})

describe('computeFamilySizeStackedByDecade', () => {
  it('input kosong menghasilkan bars kosong tanpa throw', () => {
    expect(computeFamilySizeStackedByDecade([]).bars).toEqual([])
  })

  it('satu dekade satu keluarga 2 anak: bar two 1 dan total 1', () => {
    const res = computeFamilySizeStackedByDecade([entry(1952, ['c1', 'c2'])])
    expect(res.bars).toEqual([
      {
        decade: 1950,
        one: 0,
        two: 1,
        three: 0,
        fourPlus: 0,
        childless: 0,
        total: 1,
      },
    ])
  })

  it('multi dekade terurut ASC meski input acak', () => {
    const res = computeFamilySizeStackedByDecade([
      entry(1963, ['a']),
      entry(1951, ['b', 'c', 'd']),
      entry(1968, []),
    ])
    expect(res.bars.map((bar) => bar.decade)).toEqual([1950, 1960])
    expect(res.bars[0].three).toBe(1)
    expect(res.bars[1].one).toBe(1)
    expect(res.bars[1].childless).toBe(1)
  })

  it('segmen fourPlus: keluarga 4, 6, 9 anak semua masuk fourPlus', () => {
    const res = computeFamilySizeStackedByDecade([
      entry(1901, ['a', 'b', 'c', 'd']),
      entry(1905, Array.from({ length: 6 }, (_, i) => `c${i}`)),
      entry(1909, Array.from({ length: 9 }, (_, i) => `c${i}`)),
    ])
    expect(res.bars).toHaveLength(1)
    expect(res.bars[0].fourPlus).toBe(3)
    expect(res.bars[0].one).toBe(0)
    expect(res.bars[0].two).toBe(0)
    expect(res.bars[0].three).toBe(0)
  })

  it('keluarga 0 anak masuk childless dan tidak masuk stack', () => {
    const res = computeFamilySizeStackedByDecade([entry(1975, [])])
    expect(res.bars[0].childless).toBe(1)
    expect(res.bars[0].one).toBe(0)
    expect(res.bars[0].two).toBe(0)
    expect(res.bars[0].three).toBe(0)
    expect(res.bars[0].fourPlus).toBe(0)
    expect(res.bars[0].total).toBe(1)
  })

  it('total = jumlah kelima segmen', () => {
    const res = computeFamilySizeStackedByDecade([
      entry(1920, []),
      entry(1921, ['a']),
      entry(1923, ['a', 'b']),
      entry(1925, ['a', 'b', 'c']),
      entry(1927, ['a', 'b', 'c', 'd']),
      entry(1929, []),
    ])
    const bar = res.bars[0]
    expect(bar.childless).toBe(2)
    expect(bar.one).toBe(1)
    expect(bar.two).toBe(1)
    expect(bar.three).toBe(1)
    expect(bar.fourPlus).toBe(1)
    expect(bar.total).toBe(
      bar.one + bar.two + bar.three + bar.fourPlus + bar.childless,
    )
    expect(bar.total).toBe(6)
  })

  it('dekade kosong tengah dipertahankan dengan semua segmen 0', () => {
    const res = computeFamilySizeStackedByDecade([
      entry(1912, ['a']),
      entry(1944, ['b', 'c']),
    ])
    expect(res.bars).toEqual([
      {
        decade: 1910,
        one: 1,
        two: 0,
        three: 0,
        fourPlus: 0,
        childless: 0,
        total: 1,
      },
      {
        decade: 1920,
        one: 0,
        two: 0,
        three: 0,
        fourPlus: 0,
        childless: 0,
        total: 0,
      },
      {
        decade: 1930,
        one: 0,
        two: 0,
        three: 0,
        fourPlus: 0,
        childless: 0,
        total: 0,
      },
      {
        decade: 1940,
        one: 0,
        two: 1,
        three: 0,
        fourPlus: 0,
        childless: 0,
        total: 1,
      },
    ])
  })

  it('dekade kosong leading dan trailing dipangkas', () => {
    const res = computeFamilySizeStackedByDecade([
      entry(1904, ['a']),
      entry(1950, ['b']),
    ])
    expect(res.bars.map((bar) => bar.decade)).toEqual([1900, 1910, 1920, 1930, 1940, 1950])
    expect(res.bars[0].total).toBe(1)
    expect(res.bars[1].total).toBe(0)
    expect(res.bars[4].total).toBe(0)
    expect(res.bars[5].total).toBe(1)
  })

  it('boundary dekade: 1900 dan 1909 sama-sama dekade 1900, 1910 masuk 1910', () => {
    const res = computeFamilySizeStackedByDecade([
      entry(1900, ['a']),
      entry(1909, ['b']),
      entry(1910, ['c']),
    ])
    expect(res.bars).toHaveLength(2)
    expect(res.bars[0].decade).toBe(1900)
    expect(res.bars[0].total).toBe(2)
    expect(res.bars[1].decade).toBe(1910)
    expect(res.bars[1].total).toBe(1)
  })

  it('tahun negatif dan tahun kecil menghasilkan dekade benar tanpa throw', () => {
    const res = computeFamilySizeStackedByDecade([
      entry(45, ['a']),
      entry(-3, ['b']),
    ])
    expect(res.bars.map((bar) => bar.decade)).toEqual([-10, 0, 10, 20, 30, 40])
    expect(res.bars[0].total).toBe(1)
    expect(res.bars[1].total).toBe(0)
    expect(res.bars[4].total).toBe(0)
    expect(res.bars[5].total).toBe(1)
  })

  it('throw bila input bukan array', () => {
    expect(() => computeFamilySizeStackedByDecade(undefined)).toThrowError(
      /family-size-stacked-by-decade:/,
    )
    expect(() => computeFamilySizeStackedByDecade(null)).toThrowError(
      /family-size-stacked-by-decade:/,
    )
    expect(() => computeFamilySizeStackedByDecade('1950s')).toThrowError(
      /family-size-stacked-by-decade:/,
    )
  })

  it('throw bila entri tidak sah: bukan objek, referenceYear bukan integer berhingga, childIds bukan array of string', () => {
    const prefix = /family-size-stacked-by-decade:/
    expect(() => computeFamilySizeStackedByDecade([42])).toThrowError(prefix)
    expect(() => computeFamilySizeStackedByDecade([null])).toThrowError(prefix)
    expect(() =>
      computeFamilySizeStackedByDecade([entry(1952.5, [])]),
    ).toThrowError(prefix)
    expect(() =>
      computeFamilySizeStackedByDecade([entry(Number.NaN, [])]),
    ).toThrowError(prefix)
    expect(() =>
      computeFamilySizeStackedByDecade([entry(Number.POSITIVE_INFINITY, [])]),
    ).toThrowError(prefix)
    expect(() =>
      computeFamilySizeStackedByDecade([entry('1952' as unknown as number, [])]),
    ).toThrowError(prefix)
    expect(() =>
      computeFamilySizeStackedByDecade([entry(1952, 'abc' as unknown as string[])]),
    ).toThrowError(prefix)
    expect(() =>
      computeFamilySizeStackedByDecade([entry(1952, ['a', 7 as unknown as string])]),
    ).toThrowError(prefix)
  })

  it('determinisme: dua urutan input berbeda menghasilkan bars identik', () => {
    const a = computeFamilySizeStackedByDecade([
      entry(1952, ['a', 'b']),
      entry(1955, ['c']),
      entry(1948, []),
    ])
    const b = computeFamilySizeStackedByDecade([
      entry(1948, []),
      entry(1955, ['c']),
      entry(1952, ['a', 'b']),
    ])
    expect(a.bars).toEqual(b.bars)
  })

  it('beberapa keluarga dalam satu dekade terakumulasi per segmen', () => {
    const res = computeFamilySizeStackedByDecade([
      entry(1980, ['a']),
      entry(1982, ['b', 'c']),
      entry(1984, ['d', 'e']),
      entry(1986, ['f', 'g', 'h', 'i']),
      entry(1988, []),
    ])
    expect(res.bars).toHaveLength(1)
    const bar = res.bars[0]
    expect(bar.decade).toBe(1980)
    expect(bar.one).toBe(1)
    expect(bar.two).toBe(2)
    expect(bar.three).toBe(0)
    expect(bar.fourPlus).toBe(1)
    expect(bar.childless).toBe(1)
    expect(bar.total).toBe(5)
  })
})
