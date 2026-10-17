/**
 * Test dedikasi v278: computeDependencyRatio (src/lib/stats/dependency-ratio.ts).
 * Test-only, pure: nihil DB, nihil jaringan. Semua kasus memakai now
 * terinjeksi (2026-06-15 UTC) agar hasil deterministik penuh.
 * Boundary konsisten age-groups.test.ts v269: 14 dan 65 masuk beban,
 * 15 dan 64 masuk working-age.
 */

import { describe, expect, it } from 'vitest'
import {
  AGE_GROUPS_PBB,
  computeAgeGroupsPBB,
  type AgeGroupsMember,
} from './age-groups'
import { computeDependencyRatio } from './dependency-ratio'

const NOW = new Date('2026-06-15T00:00:00Z')

function member(birthDate: string, isAlive = true): AgeGroupsMember {
  return { birthDate, isAlive }
}

const ratio = (members: AgeGroupsMember[], now: Date = NOW) => computeDependencyRatio(members, now)

/** Empat member acuan: 2 beban (umur 14 dan 65) dan 2 working-age (umur 15 dan 64). */
const BALANCED = [
  member('2011-06-16'), // umur 14, beban
  member('2011-06-15'), // umur 15, working-age
  member('1962-06-15'), // umur 64, working-age
  member('1961-06-14'), // umur 65, beban
]

describe('computeDependencyRatio (v278 fase i)', () => {
  it('pohon kosong: null, bukan 0', () => {
    expect(ratio([])).toBeNull()
  })

  it('tanpa working-age: hanya beban, null bukan angka', () => {
    expect(ratio([member('2011-06-16'), member('1961-06-14')])).toBeNull()
    expect(ratio([member('2011-06-16')])).toBeNull()
    expect(ratio([member('1961-06-14')])).toBeNull()
  })

  it('hanya bayi: beban tanpa working-age, null', () => {
    expect(ratio([member('2026-06-10'), member('2026-06-11')])).toBeNull()
  })

  it('rasio seimbang: 2 beban dan 2 working-age tepat 100.0', () => {
    expect(ratio(BALANCED)).toBe(100.0)
  })

  it('boundary 14/15 konsisten v269: umur 14 beban, umur 15 working-age', () => {
    expect(ratio([member('2011-06-16'), member('2011-06-15')])).toBe(100.0)
  })

  it('boundary 64/65 konsisten v269: umur 64 working-age, umur 65 beban', () => {
    expect(ratio([member('1962-06-15'), member('1961-06-14')])).toBe(100.0)
  })

  it('pembulatan 1 desimal bulat: 1 working-age 2 beban = 200.0', () => {
    expect(ratio([member('2011-06-16'), member('1961-06-14'), member('2011-06-15')])).toBe(200.0)
  })

  it('pembulatan 1 desimal fraksional: 7 beban 3 working-age = 233.3', () => {
    const dependents = [
      member('2015-06-15'), // umur 11
      member('2014-06-16'), // umur 11
      member('2013-06-15'), // umur 13
      member('1960-06-15'), // umur 66
      member('1960-06-16'), // umur 65
      member('1959-06-15'), // umur 67
      member('1961-06-14'), // umur 65
    ]
    const workers = [
      member('1990-01-01'),
      member('1990-01-02'),
      member('1990-01-03'),
    ]
    expect(ratio([...dependents, ...workers])).toBe(233.3)
  })

  it('beban nol: 2 working-age tanpa beban = 0.0, bukan null', () => {
    expect(ratio([member('1990-01-01'), member('1990-01-02')])).toBe(0.0)
  })

  it('deceased diabaikan: tidak masuk pembilang maupun penyebut', () => {
    expect(ratio([member('1980-01-01', false), member('2011-06-15')])).toBe(0.0)
    expect(ratio([member('1961-06-14', false), member('2011-06-15'), member('2011-06-16')])).toBe(100.0)
  })

  it('birthDate rusak diabaikan: gagal parse keluar dari semua kelompok', () => {
    expect(ratio([member('not-a-date'), member('2011-06-15')])).toBe(0.0)
    expect(ratio([member('2023-02-29'), member('2011-06-15'), member('2011-06-16')])).toBe(100.0)
  })

  it('birth masa depan diabaikan: keluar semua kelompok', () => {
    expect(ratio([member('2027-01-01'), member('2011-06-15'), member('1962-06-15')])).toBe(0.0)
  })

  it('urutan input tidak mengubah hasil', () => {
    expect(ratio([...BALANCED])).toBe(ratio([...BALANCED].reverse()))
  })

  it('pemanggilan satu argumen valid: now default jam sistem', () => {
    const r = computeDependencyRatio([{ birthDate: '1990-01-01', isAlive: true }])
    expect(r === null || typeof r === 'number').toBe(true)
  })

  it('anti-regresi modul acuan: AGE_GROUPS_PBB dan computeAgeGroupsPBB baseline utuh', () => {
    expect(AGE_GROUPS_PBB.length).toBe(3)
    expect(computeAgeGroupsPBB([], NOW)).toEqual({
      'children-0-14': 0,
      'adults-15-64': 0,
      'seniors-65+': 0,
    })
  })
})
