import { describe, it, expect } from 'vitest'
import {
  computeBirthsByDecade,
  computeCumulativeBirthsByDecade,
} from './births-by-decade'

const entry = (birthDate: string) => ({ birthDate })

describe('computeBirthsByDecade', () => {
  it('input kosong menghasilkan series kosong tanpa throw', () => {
    expect(computeBirthsByDecade([]).series).toEqual([])
    expect(computeCumulativeBirthsByDecade([]).series).toEqual([])
  })

  it('satu dekade: semua entri terkonsolidasi ke satu baris', () => {
    const res = computeBirthsByDecade([
      entry('1952-03-10'),
      entry('1955-07-04'),
      entry('1959-12-31'),
    ])
    expect(res.series).toEqual([{ decade: 1950, count: 3 }])
  })

  it('dua dekade diurutkan ASC meski input acak', () => {
    const res = computeBirthsByDecade([
      entry('1963-05-05'),
      entry('1951-01-01'),
      entry('1968-11-11'),
    ])
    expect(res.series).toEqual([
      { decade: 1950, count: 1 },
      { decade: 1960, count: 2 },
    ])
  })

  it('multi entri dalam satu dekade terakumulasi', () => {
    const res = computeBirthsByDecade([
      entry('1980-02-02'),
      entry('1981-03-03'),
      entry('1984-04-04'),
      entry('1989-06-06'),
      entry('1979-12-31'),
    ])
    expect(res.series).toEqual([
      { decade: 1970, count: 1 },
      { decade: 1980, count: 4 },
    ])
  })

  it('pemangkasan leading: depan rentang adalah dekade terdata pertama, inner zero tetap', () => {
    const res = computeBirthsByDecade([
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
    const res = computeBirthsByDecade([
      entry('1904-06-15'),
      entry('1950-08-09'),
    ])
    const last = res.series[res.series.length - 1]
    expect(last.decade).toBe(1950)
    expect(last.count).toBeGreaterThan(0)
  })

  it('dekade inner ber-count 0 dipertahankan agar gap historis terlihat', () => {
    const res = computeBirthsByDecade([
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

  it('boundary 1899 dan 1900 terpisah ke dekade berbeda', () => {
    const res = computeBirthsByDecade([
      entry('1899-12-31'),
      entry('1900-01-01'),
    ])
    expect(res.series).toEqual([
      { decade: 1890, count: 1 },
      { decade: 1900, count: 1 },
    ])
  })

  it('boundary 1999 dan 2000 terpisah ke dekade berbeda', () => {
    const res = computeBirthsByDecade([
      entry('1999-07-07'),
      entry('2000-01-02'),
      entry('2000-03-04'),
    ])
    expect(res.series).toEqual([
      { decade: 1990, count: 1 },
      { decade: 2000, count: 2 },
    ])
  })

  it('deterministik terhadap urutan input pada kedua fungsi', () => {
    const base = [
      entry('1920-01-01'),
      entry('1925-05-05'),
      entry('1948-02-02'),
      entry('1951-03-03'),
      entry('1951-04-04'),
    ]
    const shuffled = [base[3], base[0], base[4], base[2], base[1]]
    expect(computeBirthsByDecade(shuffled)).toEqual(computeBirthsByDecade(base))
    expect(computeCumulativeBirthsByDecade(shuffled)).toEqual(
      computeCumulativeBirthsByDecade(base),
    )
  })

  it('pemangkasan idempoten: input dalam rentang hasil menghasilkan series sama', () => {
    const base = [
      entry('1901-01-01'),
      entry('1930-06-06'),
      entry('1931-07-07'),
    ]
    const first = computeBirthsByDecade(base).series
    const decades = first.map((s) => s.decade)
    const within = base.filter((e) => {
      const d = Math.floor(Number(e.birthDate.slice(0, 4)) / 10) * 10
      return decades.includes(d)
    })
    expect(computeBirthsByDecade(within).series).toEqual(first)
  })
})

describe('computeCumulativeBirthsByDecade', () => {
  it('running sum benar pada deret dengan dekade inner nol', () => {
    const res = computeCumulativeBirthsByDecade([
      entry('1901-01-01'),
      entry('1905-05-05'),
      entry('1921-09-09'),
    ])
    expect(res.series).toEqual([
      { decade: 1900, cumulative: 2 },
      { decade: 1910, cumulative: 2 },
      { decade: 1920, cumulative: 3 },
    ])
  })

  it('kumulatif naik monoton dan berakhir di total kelahiran', () => {
    const entries = [
      entry('1910-01-01'),
      entry('1912-02-02'),
      entry('1918-03-03'),
      entry('1920-04-04'),
      entry('1924-05-05'),
      entry('1939-06-06'),
      entry('1939-07-07'),
      entry('1939-08-08'),
    ]
    const res = computeCumulativeBirthsByDecade(entries)
    const flat = res.series.map((s) => s.cumulative)
    for (let i = 1; i < flat.length; i += 1) {
      expect(flat[i]).toBeGreaterThanOrEqual(flat[i - 1])
    }
    expect(flat[flat.length - 1]).toBe(entries.length)
    const totalPerDecade = computeBirthsByDecade(entries).series
    expect(res.series[res.series.length - 1].decade).toBe(
      totalPerDecade[totalPerDecade.length - 1].decade,
    )
  })
})

describe('parsing strict', () => {
  const bothFns = [computeBirthsByDecade, computeCumulativeBirthsByDecade]

  it('input bukan array melempar Error ber-prefiks pada kedua fungsi', () => {
    for (const fn of bothFns) {
      for (const bad of [undefined, null, 42, 'x', {}, true]) {
        expect(() => fn(bad)).toThrowError(/^births-by-decade:/)
      }
    }
  })

  it('entri bukan objek melempar Error ber-prefiks', () => {
    for (const fn of bothFns) {
      for (const bad of [null, 7, 'str', true, []]) {
        expect(() => fn([bad as unknown])).toThrowError(/^births-by-decade:/)
      }
    }
  })

  it('birthDate bukan string melempar Error ber-prefiks', () => {
    for (const fn of bothFns) {
      for (const bad of [undefined, null, 123, {}, ['2000-01-01']]) {
        expect(() => fn([{ birthDate: bad } as unknown])).toThrowError(
          /^births-by-decade:/,
        )
      }
    }
  })

  it('format tanggal salah melempar Error ber-prefiks', () => {
    const badFormats = [
      '2000/01/01',
      '2000-1-1',
      '20000101',
      '2000-01',
      '01-01-2000',
      '2000-01-01T00:00:00Z',
      '2000-01-01 ',
      '',
    ]
    for (const fn of bothFns) {
      for (const bad of badFormats) {
        expect(() => fn([entry(bad)])).toThrowError(/^births-by-decade:/)
      }
    }
  })

  it('tanggal kalender invalid melempar Error: 29 Feb non kabisat dan bulan hari di luar jangkauan', () => {
    const invalidDates = [
      '1900-02-29',
      '2001-02-29',
      '2023-02-29',
      '2001-04-31',
      '2001-06-31',
      '2001-13-01',
      '2001-00-10',
      '2001-01-00',
      '2001-01-32',
    ]
    for (const fn of bothFns) {
      for (const bad of invalidDates) {
        expect(() => fn([entry(bad)])).toThrowError(/^births-by-decade:/)
      }
    }
  })

  it('29 Februari kabisat valid: 2000 dan 2004 diterima, pelajaran aturan abad', () => {
    const res = computeBirthsByDecade([
      entry('2000-02-29'),
      entry('2004-02-29'),
    ])
    expect(res.series).toEqual([{ decade: 2000, count: 2 }])
  })
})
