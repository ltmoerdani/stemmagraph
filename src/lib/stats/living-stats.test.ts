/**
 * Test dedikasi v267: computeLivingStats (src/lib/stats/living-stats.ts).
 * Test-only, pure: nihil DB, nihil jaringan. Semua kasus memakai now
 * terinjeksi (2026-06-15 UTC) agar hasil deterministik penuh.
 */

import { describe, expect, it } from 'vitest'
import { AGE_BUCKETS, computeLivingStats, type LivingStatsMember } from './living-stats'

const NOW = new Date('2026-06-15T00:00:00Z')

function living(birthDate: string, generation = 2): LivingStatsMember {
  return { birthDate, deathDate: null, isAlive: true, generation }
}

function deceased(birthDate: string, deathDate: string | null, generation = 3): LivingStatsMember {
  return { birthDate, deathDate, isAlive: false, generation }
}

const stats = (members: LivingStatsMember[]) => computeLivingStats(members, NOW)

describe('computeLivingStats (v267 fase i)', () => {
  it('array kosong menghasilkan semua nol dan avgLifespanYears null', () => {
    expect(stats([])).toEqual({
      total: 0,
      living: 0,
      deceased: 0,
      unknownBirthDate: 0,
      generations: { min: 0, max: 0 },
      avgLifespanYears: null,
      ageBuckets: { '0-17': 0, '18-30': 0, '31-45': 0, '46-60': 0, '61-75': 0, '76+': 0 },
    })
  })

  it('satu living terhitung sebagai total dan living, deceased nol', () => {
    const r = stats([living('1980-01-01')])
    expect(r.total).toBe(1)
    expect(r.living).toBe(1)
    expect(r.deceased).toBe(0)
    expect(r.unknownBirthDate).toBe(0)
  })

  it('kasus campur: living dan deceased terpisah benar', () => {
    const r = stats([
      living('1980-01-01'),
      deceased('1920-01-01', '2000-01-01'),
      deceased('1930-05-20', null),
    ])
    expect(r.total).toBe(3)
    expect(r.living).toBe(1)
    expect(r.deceased).toBe(2)
  })

  it('unknownBirthDate akurat: living dan deceased tanpa lahir sah masuk hitungan', () => {
    const r = stats([
      living(''),
      living('lahir saat perang kemerdekaan'),
      deceased(null as unknown as string, '2000-01-01'),
      deceased('   ', '2000-01-01'),
      living('1980-01-01'),
    ])
    expect(r.unknownBirthDate).toBe(4)
    expect(r.total).toBe(5)
    expect(r.avgLifespanYears).toBeNull()
  })

  it('bentuk tanggal mustahil gagal parse tanpa melempar error', () => {
    const r = stats([
      living('1945-13-01'),
      living('2023-02-29'),
      living('45-03-15'),
      living('1945-03'),
      living('19450315'),
    ])
    expect(r.unknownBirthDate).toBe(5)
    expect(r.ageBuckets['0-17']).toBe(0)
  })

  it('avgLifespanYears dua deceased terparse: rata-rata 1 desimal', () => {
    const r = stats([
      deceased('1920-01-01', '2000-01-01'),
      deceased('1930-05-20', '2010-01-10'),
    ])
    expect(r.avgLifespanYears).toBe(79.5)
  })

  it('avgLifespanYears pembulatan 1 desimal pada tiga sampel', () => {
    const r = stats([
      deceased('1920-01-01', '2000-01-01'),
      deceased('1930-05-20', '2010-01-10'),
      deceased('1930-01-01', '2001-01-01'),
    ])
    expect(r.avgLifespanYears).toBe(76.7)
  })

  it('deceased tanpa deathDate atau deathDate rusak tidak masuk rata-rata', () => {
    const r = stats([
      deceased('1920-01-01', null),
      deceased('1921-01-01', ''),
      deceased('1922-01-01', 'dimakamkan tahun 2000'),
      deceased('1923-01-01', '1920-01-01'),
      deceased('1924-01-01', '2004-01-01'),
    ])
    expect(r.avgLifespanYears).toBe(80)
  })

  it('ageBuckets fixture enam rentang umur terisi benar', () => {
    const r = stats([
      living('2016-03-01'),
      living('2001-02-10'),
      living('1986-03-10'),
      living('1970-11-01'),
      living('1955-01-20'),
      living('1940-04-02'),
    ])
    expect(r.ageBuckets).toEqual({
      '0-17': 1,
      '18-30': 1,
      '31-45': 1,
      '46-60': 1,
      '61-75': 1,
      '76+': 1,
    })
    expect(Object.keys(r.ageBuckets)).toEqual([...AGE_BUCKETS])
  })

  it('umur tepat batas bucket: 17 vs 18 dan 75 vs 76', () => {
    const r = stats([
      living('2008-06-16'),
      living('2008-06-15'),
      living('1950-06-16'),
      living('1950-06-15'),
    ])
    expect(r.ageBuckets['0-17']).toBe(1)
    expect(r.ageBuckets['18-30']).toBe(1)
    expect(r.ageBuckets['61-75']).toBe(1)
    expect(r.ageBuckets['76+']).toBe(1)
  })

  it('deceased tidak masuk ageBuckets walau birthDate terparse', () => {
    const r = stats([deceased('1930-01-01', '2000-01-01')])
    expect(r.ageBuckets['76+']).toBe(0)
    expect(r.unknownBirthDate).toBe(0)
  })

  it('generations min dan max benar dari campuran generasi', () => {
    const r = stats([
      living('1980-01-01', 4),
      deceased('1920-01-01', '2000-01-01', 1),
      living('2010-01-01', 5),
      living('1950-01-01', 2),
    ])
    expect(r.generations).toEqual({ min: 1, max: 5 })
  })

  it('deterministik: urutan input diacak tidak mengubah hasil', () => {
    const members = [
      living('2016-03-01', 4),
      deceased('1920-01-01', '2000-01-01', 1),
      living('1986-03-10', 3),
      living('1940-04-02', 2),
      living('tanggal tak sah', 2),
      deceased('1930-05-20', '2010-01-10', 3),
    ]
    const first = stats(members)
    const shuffled = [...members].reverse()
    expect(stats(shuffled)).toEqual(first)
  })

  it('umur living negatif (lahir di masa depan) tidak masuk bucket dan bukan unknown', () => {
    const r = stats([living('2030-01-01')])
    expect(r.unknownBirthDate).toBe(0)
    expect(Object.values(r.ageBuckets).reduce((a, b) => a + b, 0)).toBe(0)
    expect(r.living).toBe(1)
  })
})
