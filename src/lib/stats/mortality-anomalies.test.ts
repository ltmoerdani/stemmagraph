import { describe, expect, it } from 'vitest'

import {
  computeMortalityAnomalies,
  type MortalityPerson,
} from './mortality-anomalies'

function rec(deathDate: string | null): MortalityPerson {
  return { deathDate }
}

function ones(from: number, to: number): MortalityPerson[] {
  const out: MortalityPerson[] = []
  for (let year = from; year <= to; year += 1) {
    out.push(rec(`${year}-06-15`))
  }
  return out
}

describe('computeMortalityAnomalies', () => {
  it('kasus 1: input kosong menghasilkan array kosong', () => {
    expect(computeMortalityAnomalies([])).toEqual([])
  })

  it('kasus 2: semua deathDate null diabaikan, hasil array kosong', () => {
    expect(computeMortalityAnomalies([rec(null), rec(null)])).toEqual([])
  })

  it('kasus 3: satu tahun saja berarti stdev 0, hasil array kosong tanpa NaN', () => {
    const persons = [
      rec('1980-01-05'),
      rec('1980-03-05'),
      rec('1980-07-05'),
    ]
    expect(computeMortalityAnomalies(persons)).toEqual([])
  })

  it('kasus 4: baseline 10 tahun count 1 plus spike 6 di 2010 menghasilkan satu anomali', () => {
    const persons = ones(2000, 2009)
    for (let i = 0; i < 6; i += 1) persons.push(rec('2010-05-05'))
    const result = computeMortalityAnomalies(persons)
    expect(result).toHaveLength(1)
    expect(result[0].year).toBe(2010)
    expect(result[0].deaths).toBe(6)
    expect(result[0].mean).toBe(1.45)
    expect(result[0].stdev).toBe(1.44)
    expect(result[0].zScore).toBe(3.16)
  })

  it('kasus 5: threshold longgar menyaring dua spike z sama, tie diurut year menaik', () => {
    const persons = [
      rec('2000-03-01'),
      rec('2001-03-01'),
      rec('2002-03-01'),
      rec('2003-03-01'),
      rec('2003-04-01'),
      rec('2003-05-01'),
      rec('2003-06-01'),
      rec('2003-07-01'),
      rec('2004-03-01'),
      rec('2005-03-01'),
      rec('2006-03-01'),
      rec('2007-03-01'),
      rec('2007-04-01'),
      rec('2007-05-01'),
      rec('2007-06-01'),
      rec('2007-07-01'),
      rec('2008-03-01'),
      rec('2009-03-01'),
    ]
    const result = computeMortalityAnomalies(persons, { zScoreThreshold: 1.9 })
    expect(result).toHaveLength(2)
    expect(result[0].year).toBe(2003)
    expect(result[1].year).toBe(2007)
    for (const entry of result) {
      expect(entry.deaths).toBe(5)
      expect(entry.mean).toBe(1.8)
      expect(entry.stdev).toBe(1.6)
      expect(entry.zScore).toBe(2)
    }
  })

  it('kasus 6: topN memotong hasil, urutan zScore menurun dipertahankan', () => {
    const persons: MortalityPerson[] = []
    for (let year = 2000; year <= 2029; year += 1) persons.push(rec(`${year}-09-09`))
    for (let i = 0; i < 19; i += 1) persons.push(rec('2000-01-01'))
    for (let i = 0; i < 14; i += 1) persons.push(rec('2010-01-01'))
    for (let i = 0; i < 14; i += 1) persons.push(rec('2020-01-01'))
    const full = computeMortalityAnomalies(persons)
    expect(full).toHaveLength(3)
    expect(full.map(e => e.year)).toEqual([2000, 2010, 2020])
    expect(full[0].deaths).toBe(20)
    expect(full[0].mean).toBe(2.57)
    expect(full[0].stdev).toBe(4.76)
    expect(full[0].zScore).toBe(3.66)
    expect(full[1].zScore).toBe(2.61)
    expect(full[2].zScore).toBe(2.61)
    const trimmed = computeMortalityAnomalies(persons, { topN: 2 })
    expect(trimmed).toHaveLength(2)
    expect(trimmed.map(e => e.year)).toEqual([2000, 2010])
  })

  it('kasus 7: threshold kustom lebih tinggi menyaring spike lemah', () => {
    const persons = ones(2000, 2009)
    for (let i = 0; i < 6; i += 1) persons.push(rec('2010-05-05'))
    expect(
      computeMortalityAnomalies(persons, { zScoreThreshold: 4.0 }),
    ).toEqual([])
    expect(computeMortalityAnomalies(persons, { zScoreThreshold: 3.0 })).toHaveLength(1)
  })

  it('kasus 8: tahun tanpa kematian di tengah rentang tetap masuk baseline zero-filled', () => {
    const persons = [
      rec('2000-01-01'),
      rec('2000-02-01'),
      rec('2004-01-01'),
      rec('2004-02-01'),
      rec('2004-03-01'),
      rec('2004-04-01'),
      rec('2004-05-01'),
      rec('2004-06-01'),
    ]
    const result = computeMortalityAnomalies(persons)
    expect(result).toEqual([])
    const richer = [
      ...persons,
      rec('2005-01-01'),
      rec('2006-01-01'),
      rec('2007-01-01'),
      rec('2008-01-01'),
      rec('2009-01-01'),
    ]
    const widened = computeMortalityAnomalies(richer)
    expect(widened).toHaveLength(1)
    expect(widened[0].year).toBe(2004)
    expect(widened[0].deaths).toBe(6)
    expect(widened[0].mean).toBe(1.3)
    expect(widened[0].stdev).toBe(1.68)
    expect(widened[0].zScore).toBe(2.8)
  })

  it('kasus 9: format bukan YYYY-MM-DD melempar Error', () => {
    expect(() => computeMortalityAnomalies([rec('1980/01/01')])).toThrow(Error)
    expect(() => computeMortalityAnomalies([rec('01-01-1980')])).toThrow(Error)
  })

  it('kasus 10: bulan di luar kalender melempar Error', () => {
    expect(() => computeMortalityAnomalies([rec('1980-13-01')])).toThrow(Error)
    expect(() => computeMortalityAnomalies([rec('1980-00-10')])).toThrow(Error)
  })

  it('kasus 11: tanggal di luar kalender melempar Error termasuk non kabisat', () => {
    expect(() => computeMortalityAnomalies([rec('1981-02-29')])).toThrow(Error)
    expect(() => computeMortalityAnomalies([rec('1900-02-29')])).toThrow(Error)
    expect(() => computeMortalityAnomalies([rec('1980-04-31')])).toThrow(Error)
  })

  it('kasus 12: 29 Februari kabisat valid dan tahun 0000 ditolak', () => {
    expect(() => computeMortalityAnomalies([rec('1980-02-29')])).not.toThrow()
    expect(() => computeMortalityAnomalies([rec('2000-02-29')])).not.toThrow()
    expect(() => computeMortalityAnomalies([rec('0000-01-01')])).toThrow(Error)
    expect(() => computeMortalityAnomalies([rec('10000-01-01')])).toThrow(Error)
  })

  it('kasus 13: tipe selain string dan null melempar Error bukan silent filter', () => {
    const bad = [{ deathDate: 19800101 } as unknown as MortalityPerson]
    expect(() => computeMortalityAnomalies(bad)).toThrow(Error)
  })

  it('kasus 14: null bercampur valid tetap diproses tanpa error', () => {
    const persons = [
      rec(null),
      ...ones(2000, 2005),
      rec('2006-01-01'),
      rec('2006-02-01'),
      rec('2006-03-01'),
      rec('2006-04-01'),
      rec('2006-05-01'),
      rec('2006-06-01'),
      rec('2006-07-01'),
    ]
    const result = computeMortalityAnomalies(persons)
    expect(result).toHaveLength(1)
    expect(result[0].year).toBe(2006)
    expect(result[0].deaths).toBe(7)
  })
})
