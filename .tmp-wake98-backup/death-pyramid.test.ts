import { describe, expect, it } from 'vitest'
import {
  computeDeathPyramid,
  parseDeathPyramidPersons,
  type DeathPyramidPerson,
} from './death-pyramid'

/** Tanggal EXACT lengkap dari tiga komponen. */
function d(y: number, m: number, dd: number) {
  return { dateKind: 'EXACT', yearStart: y, monthStart: m, dayStart: dd }
}

/** Tanggal parsial: tahun saja. */
function yOnly(y: number) {
  return { dateKind: 'EXACT', yearStart: y, monthStart: null, dayStart: null }
}

/** Tanggal non-EXACT. */
function approx(y: number) {
  return { dateKind: 'ABOUT', yearStart: y, monthStart: null, dayStart: null }
}

/** Orang ringkas. */
function person(
  birth: { y: number; m: number; dd: number },
  death: { y: number; m: number; dd: number },
  sex: 'F' | 'M' | 'U' = 'F',
): DeathPyramidPerson {
  return {
    birthDate: d(birth.y, birth.m, birth.dd),
    deathDate: d(death.y, death.m, death.dd),
    sex,
  }
}

/** N orang identik dalam satu kohort. */
function nPeople(
  birthYear: number,
  deathYear: number,
  sex: 'F' | 'M' | 'U',
  n: number,
): DeathPyramidPerson[] {
  return Array.from({ length: n }, () =>
    person({ y: birthYear, m: 1, dd: 1 }, { y: deathYear, m: 1, dd: 1 }, sex),
  )
}

describe('death-pyramid fase i (v330)', () => {
  it('kasus 1: input kosong menghasilkan cohorts kosong', () => {
    expect(computeDeathPyramid([])).toEqual({ cohorts: [] })
  })

  it('kasus 2: band tepat 10 tahun dengan label n-m', () => {
    const persons: DeathPyramidPerson[] = [
      ...nPeople(1900, 1905, 'F', 6),
      ...nPeople(1900, 1915, 'F', 6),
    ]
    const r = computeDeathPyramid(persons)
    expect(r.cohorts).toHaveLength(1)
    expect(r.cohorts[0]!.century).toBe(1900)
    expect(r.cohorts[0]!.bands.map((b) => b.band)).toEqual(['0-9', '10-19'])
    expect(r.cohorts[0]!.bands[0]!.female).toBe(6)
  })

  it('kasus 3: umur tepat anniversary, ulang tahun belum lewat dikurangi satu', () => {
    const persons = [person({ y: 1900, m: 5, dd: 10 }, { y: 1960, m: 5, dd: 9 }, 'F')]
    // ulang tahun ke-60 belum lewat, umur 59, satu sampel di band 50-59
    // namun 1 sampel di bawah guard sehingga baris dibuang
    const r = computeDeathPyramid(persons)
    expect(r.cohorts).toEqual([])
  })

  it('kasus 4: umur negatif dibuang', () => {
    const r = computeDeathPyramid([person({ y: 1900, m: 5, dd: 5 }, { y: 1900, m: 1, dd: 1 })])
    expect(r.cohorts).toEqual([])
  })

  it('kasus 5: tanggal non-EXACT dibuang', () => {
    const p: DeathPyramidPerson = {
      birthDate: approx(1900),
      deathDate: d(1960, 1, 1),
      sex: 'F',
    }
    const r = computeDeathPyramid([p])
    expect(r.cohorts).toEqual([])
  })

  it('kasus 6: komponen parsial dibuang', () => {
    const p: DeathPyramidPerson = {
      birthDate: yOnly(1900),
      deathDate: d(1960, 1, 1),
      sex: 'F',
    }
    const r = computeDeathPyramid([p])
    expect(r.cohorts).toEqual([])
  })

  it('kasus 7: sex U masuk excludedUnknownSex, tidak masuk seri', () => {
    const persons: DeathPyramidPerson[] = [
      ...nPeople(1850, 1880, 'U', 12),
      ...nPeople(1850, 1880, 'F', 10),
    ]
    const r = computeDeathPyramid(persons)
    expect(r.cohorts[0]!.excludedUnknownSex).toBe(12)
    expect(r.cohorts[0]!.bands).toHaveLength(1)
    expect(r.cohorts[0]!.bands[0]!.female).toBe(10)
    expect(r.cohorts[0]!.bands[0]!.male).toBe(0)
  })

  it('kasus 8: dua seri F M independen, baris di bawah guard dibuang', () => {
    const persons: DeathPyramidPerson[] = [
      person({ y: 1900, m: 1, dd: 1 }, { y: 1975, m: 1, dd: 1 }, 'F'),
      person({ y: 1900, m: 1, dd: 1 }, { y: 1975, m: 1, dd: 1 }, 'M'),
    ]
    const r = computeDeathPyramid(persons)
    expect(r.cohorts).toEqual([])
  })

  it('kasus 9: kohort abad kelahiran floor dan urut naik', () => {
    const persons: DeathPyramidPerson[] = [
      ...nPeople(1899, 1960, 'F', 10),
      ...nPeople(1901, 1960, 'F', 10),
    ]
    const r = computeDeathPyramid(persons)
    expect(r.cohorts.map((c) => c.century)).toEqual([1800, 1900])
  })

  it('kasus 10: guard MIN_SAMPLES 10, tepat 10 lolos, 9 dibuang', () => {
    const below = computeDeathPyramid(nPeople(1900, 1960, 'F', 9))
    expect(below.cohorts).toEqual([])
    const exact = computeDeathPyramid(nPeople(1900, 1960, 'F', 10))
    expect(exact.cohorts[0]!.bands).toHaveLength(1)
    expect(exact.cohorts[0]!.bands[0]!.female).toBe(10)
  })

  it('kasus 11: band interior kosong dipertahankan, trim hanya ujung', () => {
    const persons: DeathPyramidPerson[] = [
      ...nPeople(1900, 1955, 'F', 10),
      ...nPeople(1900, 1985, 'M', 10),
    ]
    const r = computeDeathPyramid(persons)
    expect(r.cohorts[0]!.bands.map((b) => b.band)).toEqual(['50-59', '60-69', '70-79', '80-89'])
  })

  it('kasus 12: throw bukan array, JSON array diterima', () => {
    expect(() => parseDeathPyramidPersons({})).toThrow(/payload bukan array/)
    expect(() => parseDeathPyramidPersons('{"a":1}')).toThrow(/payload JSON bukan array/)
    expect(parseDeathPyramidPersons('[]')).toHaveLength(0)
  })

  it('kasus 13: throw elemen bukan objek', () => {
    expect(() => parseDeathPyramidPersons([42])).toThrow(/person\[0\]: hilang atau bukan objek/)
  })

  it('kasus 14: throw sex invalid', () => {
    expect(() =>
      parseDeathPyramidPersons([{ birthDate: null, deathDate: null, sex: 'X' }]),
    ).toThrow(/sex: bukan F M U/)
  })

  it('kasus 15: urutan band naik lintas kohort dengan gabungan seri', () => {
    const persons: DeathPyramidPerson[] = [
      ...nPeople(1900, 1930, 'F', 10),
      ...nPeople(1800, 1930, 'M', 10),
    ]
    const r = computeDeathPyramid(persons)
    expect(r.cohorts.map((c) => c.century)).toEqual([1800, 1900])
    // Koreksi aritmetika PM: 1800-01-01 wafat 1930-01-01 umur penuh tepat 130 tahun, band benar '130-139'.
    expect(r.cohorts[0]!.bands[0]!.band).toBe('130-139')
  })

  it('kasus 16: JSON string payload diterima penuh', () => {
    const json = JSON.stringify(nPeople(1900, 1960, 'F', 3))
    expect(parseDeathPyramidPersons(json)).toHaveLength(3)
  })

  it('kasus 17: field tanggal hilang lempar Error', () => {
    expect(() => parseDeathPyramidPersons([{ sex: 'F' }])).toThrow(/birthDate: hilang/)
    expect(() =>
      parseDeathPyramidPersons([{ birthDate: null, sex: 'F' }]),
    ).toThrow(/deathDate: hilang/)
  })
})
