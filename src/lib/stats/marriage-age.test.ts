import { describe, expect, it } from 'vitest'
import {
  computeAverageMarriageAge,
  computeMarriageAgeStats,
  type MarriageAgeDate,
  type MarriageAgePair,
} from './marriage-age'

function exact(y: number, m: number, d: number): MarriageAgeDate {
  return { dateKind: 'EXACT', yearStart: y, monthStart: m, dayStart: d }
}

function about(y: number): MarriageAgeDate {
  return { dateKind: 'ABOUT', yearStart: y, monthStart: null, dayStart: null }
}

function range(y1: number): MarriageAgeDate {
  return { dateKind: 'RANGE', yearStart: y1, monthStart: null, dayStart: null, }
}

function pair(
  pairId: string,
  birthA: MarriageAgeDate | null,
  birthB: MarriageAgeDate | null,
  marriage: MarriageAgeDate | null,
): MarriageAgePair {
  return {
    pairId,
    spouseA: { id: `${pairId}-a`, birthDate: birthA },
    spouseB: { id: `${pairId}-b`, birthDate: birthB },
    marriageDate: marriage,
  }
}

describe('computeAverageMarriageAge', () => {
  it('1 pohon kosong mengembalikan null', () => {
    expect(computeAverageMarriageAge([])).toBeNull()
  })

  it('2 nihil pasangan valid mengembalikan null', () => {
    const pairs = [
      pair('p1', exact(1990, 5, 10), exact(1992, 6, 20), null),
      pair('p2', null, null, exact(2010, 1, 1)),
    ]
    expect(computeAverageMarriageAge(pairs)).toBeNull()
    expect(computeMarriageAgeStats(pairs).count).toBe(0)
  })

  it('3 satu pasangan dengan usia pernikahan tepat', () => {
    // Lahir 1990-05-10, menikah 2015-05-10: anniversary tepat, usia penuh 25.
    const pairs = [pair('p1', exact(1990, 5, 10), exact(1992, 6, 20), exact(2015, 5, 10))]
    expect(computeAverageMarriageAge(pairs)).toBe(25)
  })

  it('4 pembulatan 1 desimal pada rata-rata', () => {
    // Usia 25, 25, 26: rata-rata 76/3 = 25.333... -> 25.3.
    const pairs = [
      pair('p1', exact(1990, 1, 1), exact(1991, 1, 1), exact(2015, 1, 1)),
      pair('p2', exact(1990, 1, 1), exact(1991, 1, 1), exact(2015, 1, 2)),
      pair('p3', exact(1989, 1, 1), exact(1991, 1, 1), exact(2015, 1, 1)),
    ]
    expect(computeAverageMarriageAge(pairs)).toBe(25.3)
    expect(computeMarriageAgeStats(pairs).averageExact).toBe(76 / 3)
  })

  it('5 PartialDate satu pihak (ABT dan BET) me-skip pasangan itu saja', () => {
    const pairs = [
      pair('p1', exact(1985, 3, 3), exact(1986, 4, 4), exact(2015, 3, 3)),
      pair('p2', about(1985), exact(1986, 4, 4), exact(2015, 3, 3)),
      pair('p3', exact(1985, 3, 3), range(1985), exact(2015, 3, 3)),
    ]
    // Hanya p1 valid, usia 30.
    expect(computeAverageMarriageAge(pairs)).toBe(30)
    expect(computeMarriageAgeStats(pairs).count).toBe(1)
  })

  it('6 lahir setelah menikah (usia negatif) di-skip', () => {
    const pairs = [
      pair('p1', exact(2000, 1, 1), exact(1999, 1, 1), exact(1998, 1, 1)),
      pair('p2', exact(1990, 6, 15), exact(1992, 6, 15), exact(2010, 6, 15)),
    ]
    // p1 usia -2 (A lahir setelah MARR): skip; p2 usia 20 tetap dihitung.
    expect(computeAverageMarriageAge(pairs)).toBe(20)
    expect(computeMarriageAgeStats(pairs).count).toBe(1)
  })

  it('7 tanggal lahir hilang pada salah satu pihak me-skip pasangan', () => {
    const pairs = [
      pair('p1', exact(1990, 1, 1), null, exact(2012, 1, 1)),
      pair('p2', null, exact(1992, 1, 1), exact(2012, 1, 1)),
      pair('p3', exact(1990, 1, 1), exact(1992, 1, 1), exact(2012, 1, 1)),
    ]
    expect(computeAverageMarriageAge(pairs)).toBe(22)
    expect(computeMarriageAgeStats(pairs).count).toBe(1)
  })

  it('8 urutan input tidak mengubah hasil', () => {
    const base = [
      pair('pa', exact(1990, 1, 1), exact(1991, 1, 1), exact(2015, 1, 1)),
      pair('pb', exact(1985, 2, 2), exact(1986, 2, 2), exact(2010, 2, 2)),
      pair('pc', exact(1995, 3, 3), exact(1996, 3, 3), exact(2020, 3, 3)),
    ]
    const shuffled = [base[2], base[0], base[1]]
    expect(computeAverageMarriageAge(shuffled)).toBe(computeAverageMarriageAge(base))
    expect(computeMarriageAgeStats(shuffled).averageExact).toBe(
      computeMarriageAgeStats(base).averageExact,
    )
  })

  it('9 determinisme: hasil identik antar pemanggilan, sort pairId ascending', () => {
    const pairs = [
      pair('p2', exact(1990, 1, 1), exact(1991, 1, 1), exact(2015, 1, 1)),
      pair('p1', exact(1992, 1, 1), exact(1993, 1, 1), exact(2016, 1, 1)),
      pair('p3', exact(1988, 1, 1), exact(1989, 1, 1), exact(2014, 1, 1)),
    ]
    const first = computeMarriageAgeStats(pairs)
    const second = computeMarriageAgeStats([...pairs].reverse())
    expect(second).toEqual(first)
    // Usia 25, 24, 26: jumlah 75, rata-rata tepat 25.
    expect(first.count).toBe(3)
    expect(first.averageExact).toBe(25)
    expect(first.averageRounded).toBe(25)
  })

  it('10 campuran valid dan skip: count dan hitungan tepat', () => {
    const pairs = [
      pair('p1', exact(1990, 1, 1), exact(1992, 1, 1), exact(2015, 1, 1)),
      pair('p2', about(1990), about(1992), exact(2015, 1, 1)),
      pair('p3', exact(1991, 1, 1), exact(1993, 1, 1), exact(2016, 1, 1)),
      pair('p4', exact(1992, 1, 1), exact(1994, 1, 1), exact(2017, 1, 1)),
      pair('p5', null, null, null),
    ]
    const stats = computeMarriageAgeStats(pairs)
    expect(stats.count).toBe(3)
    // Usia 25, 25, 25: rata-rata 25.0.
    expect(stats.averageExact).toBe(25)
    expect(stats.averageRounded).toBe(25)
  })

  it('11 tanggal MARR hilang me-skip pasangan', () => {
    const pairs = [pair('p1', exact(1990, 1, 1), exact(1992, 1, 1), null)]
    expect(computeAverageMarriageAge(pairs)).toBeNull()
  })

  it('12 dateKind non-EXACT pada MARR (EST, BEF) me-skip pasangan', () => {
    const est: MarriageAgeDate = { dateKind: 'EST', yearStart: 2015, monthStart: null, dayStart: null }
    const bef: MarriageAgeDate = { dateKind: 'BEFORE', yearStart: 2015, monthStart: 1, dayStart: 1 }
    const pairs = [
      pair('p1', exact(1990, 1, 1), exact(1992, 1, 1), est),
      pair('p2', exact(1990, 1, 1), exact(1992, 1, 1), bef),
    ]
    expect(computeAverageMarriageAge(pairs)).toBeNull()
    expect(computeMarriageAgeStats(pairs).count).toBe(0)
  })

  it('13 rata-rata presisi penuh tersimpan, output dibulatkan 1 desimal', () => {
    // Usia 25 dan 26: exact 25.5; usia 25, 26, 24: exact 25, dst.
    const pairs = [
      pair('p1', exact(1990, 1, 1), exact(1991, 1, 1), exact(2015, 1, 1)),
      pair('p2', exact(1990, 1, 1), exact(1991, 1, 1), exact(2016, 1, 1)),
    ]
    const stats = computeMarriageAgeStats(pairs)
    expect(stats.averageExact).toBe(25.5)
    expect(stats.averageRounded).toBe(25.5)
  })
})
