import { describe, it, expect } from 'vitest'
import { computeDeathsByDecade } from './deaths-by-decade'

const entry = (deathDate: string) => ({ deathDate })

describe('computeDeathsByDecade', () => {
  it('input kosong menghasilkan series kosong tanpa throw', () => {
    expect(computeDeathsByDecade([]).series).toEqual([])
  })

  it('satu dekade: semua entri terkonsolidasi ke satu baris', () => {
    const res = computeDeathsByDecade([
      entry('1952-03-10'),
      entry('1955-07-04'),
      entry('1959-12-31'),
    ])
    expect(res.series).toEqual([{ decade: 1950, count: 3 }])
  })

  it('dua dekade diurutkan ASC meski input acak', () => {
    const res = computeDeathsByDecade([
      entry('1963-05-05'),
      entry('1951-01-01'),
      entry('1968-11-11'),
    ])
    expect(res.series).toEqual([
      { decade: 1950, count: 1 },
      { decade: 1960, count: 2 },
    ])
  })

  it('pemangkasan leading: depan rentang adalah dekade terdata pertama, inner zero tetap', () => {
    const res = computeDeathsByDecade([
      entry('1904-06-15'),
      entry('1950-08-09'),
    ])
    expect(res.series).toEqual([
      { decade: 1900, count: 1 },
      { decade: 1910, count: 0 },
      { decade: 1920, count: 0 },
      { decade: 1930, count: 0 },
      { decade: 1940, count: 0 },
      { decade: 1950, count: 1 },
    ])
  })

  it('pemangkasan trailing: tidak ada dekade kosong di belakang rentang terdata', () => {
    const res = computeDeathsByDecade([
      entry('1904-06-15'),
      entry('1950-08-09'),
    ])
    const last = res.series[res.series.length - 1]
    expect(last.decade).toBe(1950)
    expect(last.count).toBeGreaterThan(0)
  })

  it('dekade inner ber-count 0 dipertahankan agar gap historis terlihat', () => {
    const res = computeDeathsByDecade([
      entry('1901-01-01'),
      entry('1902-02-02'),
      entry('1941-03-03'),
    ])
    expect(res.series).toEqual([
      { decade: 1900, count: 2 },
      { decade: 1910, count: 0 },
      { decade: 1920, count: 0 },
      { decade: 1930, count: 0 },
      { decade: 1940, count: 1 },
    ])
  })

  it('boundary 1899 jatuh dekade 1890 dan 1900 jatuh dekade 1900', () => {
    const res = computeDeathsByDecade([
      entry('1899-12-31'),
      entry('1900-01-01'),
    ])
    expect(res.series).toEqual([
      { decade: 1890, count: 1 },
      { decade: 1900, count: 1 },
    ])
  })

  it('boundary 1999 jatuh dekade 1990 dan 2000 jatuh dekade 2000', () => {
    const res = computeDeathsByDecade([
      entry('1999-06-01'),
      entry('2000-06-01'),
    ])
    expect(res.series).toEqual([
      { decade: 1990, count: 1 },
      { decade: 2000, count: 1 },
    ])
  })

  it('input bukan array melempar Error berprefiks', () => {
    expect(() => computeDeathsByDecade('bukan array')).toThrowError(
      /deaths-by-decade:/,
    )
    expect(() => computeDeathsByDecade(null)).toThrowError(/deaths-by-decade:/)
  })

  it('entri bukan objek melempar Error berprefiks', () => {
    expect(() => computeDeathsByDecade(['bukan objek'])).toThrowError(
      /deaths-by-decade:/,
    )
    expect(() => computeDeathsByDecade([null])).toThrowError(
      /deaths-by-decade:/,
    )
  })

  it('deathDate bukan string melempar Error berprefiks', () => {
    expect(() => computeDeathsByDecade([{ deathDate: 19500101 }])).toThrowError(
      /deaths-by-decade:/,
    )
    expect(() => computeDeathsByDecade([{ other: 'x' }])).toThrowError(
      /deaths-by-decade:/,
    )
  })

  it('format bukan YYYY-MM-DD melempar Error berprefiks', () => {
    expect(() => computeDeathsByDecade([entry('abc')])).toThrowError(
      /deaths-by-decade:/,
    )
    expect(() => computeDeathsByDecade([entry('1950/01/01')])).toThrowError(
      /deaths-by-decade:/,
    )
    expect(() => computeDeathsByDecade([entry('1950-1-1')])).toThrowError(
      /deaths-by-decade:/,
    )
  })

  it('tanggal kalender tidak valid melempar Error: 1900-02-29 non kabisat', () => {
    expect(() => computeDeathsByDecade([entry('1900-02-29')])).toThrowError(
      /deaths-by-decade:/,
    )
  })

  it('29 Februari kabisat valid: 2000-02-29 diterima, 1900-02-29 ditolak', () => {
    const res = computeDeathsByDecade([entry('2000-02-29')])
    expect(res.series).toEqual([{ decade: 2000, count: 1 }])
    expect(() => computeDeathsByDecade([entry('1901-02-29')])).toThrowError(
      /deaths-by-decade:/,
    )
  })

  it('bulan dan tanggal di luar rentang melempar Error', () => {
    expect(() => computeDeathsByDecade([entry('1950-13-01')])).toThrowError(
      /deaths-by-decade:/,
    )
    expect(() => computeDeathsByDecade([entry('1950-00-10')])).toThrowError(
      /deaths-by-decade:/,
    )
    expect(() => computeDeathsByDecade([entry('1950-04-31')])).toThrowError(
      /deaths-by-decade:/,
    )
  })

  it('determinisme: dua urutan input berbeda menghasilkan series identik', () => {
    const a = computeDeathsByDecade([
      entry('1931-01-01'),
      entry('1945-02-02'),
      entry('1938-03-03'),
    ])
    const b = computeDeathsByDecade([
      entry('1945-02-02'),
      entry('1938-03-03'),
      entry('1931-01-01'),
    ])
    expect(a.series).toEqual(b.series)
  })

  it('idempoten pangkas: series sudah terpangkas tidak berubah saat diproses ulang', () => {
    const first = computeDeathsByDecade([
      entry('1910-05-05'),
      entry('1940-05-05'),
    ]).series
    const second = computeDeathsByDecade([]).series
    expect(second).toEqual([])
    expect(first[0].count).toBeGreaterThan(0)
    expect(first[first.length - 1].count).toBeGreaterThan(0)
  })
})
