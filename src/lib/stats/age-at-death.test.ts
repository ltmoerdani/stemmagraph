/**
 * Test dedikasi v299: computeAgeAtDeathBands
 * (src/lib/stats/age-at-death.ts). Test-only, pure: nihil DB,
 * nihil jaringan, nihil jam sistem sehingga deterministik penuh.
 * Kasus mengikuti kontrak v299: boundary 9/10 dan 79/80, usia
 * negatif, tanggal rusak, isAlive diabaikan, determinisme urutan,
 * distribusi, konsistensi counted vs jumlah band.
 */

import { describe, expect, it } from 'vitest'
import {
  AGE_AT_DEATH_BAND_KEYS,
  computeAgeAtDeathBands,
  type AgeAtDeathMember,
} from './age-at-death'

function deceased(birthDate: string, deathDate: string): AgeAtDeathMember {
  return { birthDate, deathDate, isAlive: false }
}

function alive(): AgeAtDeathMember {
  return { birthDate: '1980-01-01', deathDate: null, isAlive: true }
}

describe('computeAgeAtDeathBands', () => {
  it('kasus 1: array kosong mengembalikan null', () => {
    expect(computeAgeAtDeathBands([])).toBeNull()
  })

  it('kasus 2: semua anggota hidup diabaikan, hasil nol semua', () => {
    const result = computeAgeAtDeathBands([alive(), alive(), alive()])
    expect(result).not.toBeNull()
    expect(result?.counted).toBe(0)
    expect(result?.skippedMissing).toBe(0)
    expect(result?.skippedPartial).toBe(0)
    expect(Object.values(result?.bands ?? {})).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0])
  })

  it('kasus 3: boundary usia 9 masuk band 0-9 dan 10 masuk 10-19', () => {
    const result = computeAgeAtDeathBands([
      deceased('2000-01-01', '2009-01-01'),
      deceased('2000-01-01', '2010-01-01'),
    ])
    expect(result?.bands['0-9']).toBe(1)
    expect(result?.bands['10-19']).toBe(1)
    expect(result?.counted).toBe(2)
  })

  it('kasus 4: boundary usia 79 masuk band 70-79 dan 80 masuk 80+', () => {
    const result = computeAgeAtDeathBands([
      deceased('1940-06-15', '2020-06-14'),
      deceased('1940-06-15', '2020-06-15'),
    ])
    expect(result?.bands['70-79']).toBe(1)
    expect(result?.bands['80+']).toBe(1)
    expect(result?.counted).toBe(2)
  })

  it('kasus 5: usia negatif (kematian sebelum lahir) masuk skippedPartial', () => {
    const result = computeAgeAtDeathBands(deceased('1990-05-10', '1989-01-01'))
    expect(result?.counted).toBe(0)
    expect(result?.skippedPartial).toBe(1)
    expect(result?.skippedMissing).toBe(0)
  })

  it('kasus 6: birthDate rusak masuk skippedMissing', () => {
    const result = computeAgeAtDeathBands(deceased('01-01-1990', '2020-01-01'))
    expect(result?.counted).toBe(0)
    expect(result?.skippedMissing).toBe(1)
    expect(result?.skippedPartial).toBe(0)
  })

  it('kasus 7: deathDate rusak masuk skippedMissing', () => {
    const result = computeAgeAtDeathBands(deceased('1990-01-01', 'bukan-tanggal'))
    expect(result?.counted).toBe(0)
    expect(result?.skippedMissing).toBe(1)
  })

  it('kasus 8: tanggal kalender tidak valid (31 April dan 29 Feb non kabisat) skippedMissing', () => {
    const result = computeAgeAtDeathBands([
      deceased('1990-04-31', '2020-01-01'),
      deceased('1990-01-01', '2021-02-29'),
    ])
    expect(result?.counted).toBe(0)
    expect(result?.skippedMissing).toBe(2)
  })

  it('kasus 9: isAlive true diabaikan meski kedua tanggal lengkap', () => {
    const result = computeAgeAtDeathBands({
      ...deceased('1950-01-01', '2020-01-01'),
      isAlive: true,
    })
    expect(result?.counted).toBe(0)
    expect(result?.skippedMissing).toBe(0)
    expect(result?.skippedPartial).toBe(0)
  })

  it('kasus 10: deterministik terhadap urutan input', () => {
    const a = deceased('1930-03-03', '2015-07-07')
    const b = deceased('1925-08-08', '2001-02-02')
    const c = deceased('1940-12-12', '2022-11-11')
    expect(computeAgeAtDeathBands([a, b, c])).toEqual(
      computeAgeAtDeathBands([c, a, b]),
    )
  })

  it('kasus 11: distribusi banyak anggota lintas band', () => {
    const result = computeAgeAtDeathBands([
      deceased('2020-01-01', '2023-01-01'),
      deceased('2005-01-01', '2015-01-01'),
      deceased('1990-01-01', '2021-01-01'),
      deceased('1980-01-01', '2018-01-01'),
      deceased('1970-01-01', '2016-01-01'),
      deceased('1960-01-01', '2014-01-01'),
      deceased('1950-01-01', '2012-01-01'),
      deceased('1940-01-01', '2010-01-01'),
      deceased('1930-01-01', '2008-01-01'),
      deceased('1900-01-01', '1985-01-01'),
      alive(),
      deceased('1990-01-01', null),
    ])
    expect(result?.bands['0-9']).toBe(1)
    expect(result?.bands['10-19']).toBe(1)
    expect(result?.bands['20-29']).toBe(0)
    expect(result?.bands['30-39']).toBe(1)
    expect(result?.bands['40-49']).toBe(1)
    expect(result?.bands['50-59']).toBe(1)
    expect(result?.bands['60-69']).toBe(1)
    expect(result?.bands['70-79']).toBe(1)
    expect(result?.bands['80+']).toBe(2)
    expect(result?.counted).toBe(9)
    expect(result?.skippedMissing).toBe(1)
    expect(result?.skippedPartial).toBe(0)
  })

  it('kasus 12: counted konsisten dengan jumlah seluruh nilai band', () => {
    const result = computeAgeAtDeathBands([
      deceased('1930-03-03', '2015-07-07'),
      deceased('1925-08-08', '2001-02-02'),
      deceased('1940-12-12', '2022-11-11'),
      deceased('1990-04-31', '2020-01-01'),
      deceased('1991-01-01', '1988-01-01'),
      alive(),
    ])
    expect(result).not.toBeNull()
    const bandSum = Object.values(result?.bands ?? {}).reduce((x, y) => x + y, 0)
    expect(bandSum).toBe(result?.counted)
    expect(result?.counted).toBe(3)
    expect(result?.skippedMissing).toBe(1)
    expect(result?.skippedPartial).toBe(1)
  })

  it('kasus 13: 29 Februari kabisat valid dan usia 0 tetap terhitung', () => {
    const result = computeAgeAtDeathBands([
      deceased('2000-02-29', '2000-03-01'),
      deceased('2023-05-05', '2023-05-05'),
    ])
    expect(result?.bands['0-9']).toBe(2)
    expect(result?.counted).toBe(2)
  })

  it('kasus 14: kunci band lengkap dan berurutan sesuai kontrak', () => {
    const result = computeAgeAtDeathBands(deceased('1900-01-01', '1999-12-31'))
    expect(Object.keys(result?.bands ?? {})).toEqual([...AGE_AT_DEATH_BAND_KEYS])
  })
})
