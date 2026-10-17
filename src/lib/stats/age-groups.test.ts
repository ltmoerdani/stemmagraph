/**
 * Test dedikasi v269: computeAgeGroupsPBB (src/lib/stats/age-groups.ts).
 * Test-only, pure: nihil DB, nihil jaringan. Semua kasus memakai now
 * terinjeksi (2026-06-15 UTC) agar hasil deterministik penuh.
 */

import { describe, expect, it } from 'vitest'
import {
  AGE_GROUPS_PBB,
  computeAgeGroupsPBB,
  type AgeGroupKey,
  type AgeGroupsMember,
} from './age-groups'

const NOW = new Date('2026-06-15T00:00:00Z')

function member(birthDate: string, isAlive = true): AgeGroupsMember {
  return { birthDate, isAlive }
}

const groups = (members: AgeGroupsMember[], now: Date = NOW) => computeAgeGroupsPBB(members, now)

function expectEmpty(r: Record<AgeGroupKey, number>) {
  expect(r).toEqual({ 'children-0-14': 0, 'adults-15-64': 0, 'seniors-65+': 0 })
}

describe('computeAgeGroupsPBB (v269 fase i)', () => {
  it('array kosong menghasilkan semua kelompok nol', () => {
    expectEmpty(groups([]))
  })

  it('kunci kelompok eksak sesuai AGE_GROUPS_PBB', () => {
    expect(Object.keys(groups([])).sort()).toEqual([...AGE_GROUPS_PBB].sort())
  })

  it('partisi isAlive: hanya living terhitung, deceased nihil', () => {
    const r = groups([member('1980-01-01', true), member('1980-01-01', false)])
    expect(r).toEqual({ 'children-0-14': 0, 'adults-15-64': 1, 'seniors-65+': 0 })
  })

  it('boundary eksak 14/15: umur 14 children, umur 15 adults', () => {
    const r = groups([member('2011-06-16'), member('2011-06-15')])
    expect(r['children-0-14']).toBe(1)
    expect(r['adults-15-64']).toBe(1)
    expect(r['seniors-65+']).toBe(0)
  })
  it('boundary eksak 64/65: umur 64 adults, umur 65 seniors', () => {
    const r = groups([member('1962-06-15'), member('1961-06-14')])
    expect(r['children-0-14']).toBe(0)
    expect(r['adults-15-64']).toBe(1)
    expect(r['seniors-65+']).toBe(1)
  })

  it('anak berumur tepat 10 tahun masuk children', () => {
    const r = groups([member('2016-06-15')])
    expect(r['children-0-14']).toBe(1)
    expect(r['adults-15-64']).toBe(0)
  })

  it('kabisat sah: lahir 2024-02-29 terparse dan masuk children', () => {
    const r = groups([member('2024-02-29')])
    expect(r['children-0-14']).toBe(1)
  })

  it('kabisat tolak: lahir 2023-02-29 gagal parse, keluar semua kelompok', () => {
    expectEmpty(groups([member('2023-02-29')]))
  })

  it('anniversary rule: ulang tahun belum lewat kurang 1 tahun, tepat hari tercapai', () => {
    const r = groups([member('2011-06-16')])
    expect(r['children-0-14']).toBe(1)
    const r2 = groups([member('2011-06-15')])
    expect(r2['adults-15-64']).toBe(1)
    const r3 = groups([member('2011-06-14')])
    expect(r3['adults-15-64']).toBe(1)
  })

  it('birth masa depan keluar semua kelompok, bukan children', () => {
    expectEmpty(groups([member('2027-01-01')]))
  })

  it('deceased dengan birthDate sah tidak masuk kelompok mana pun', () => {
    expectEmpty(groups([member('1940-01-01', false)]))
  })

  it('birthDate bentuk rusak dan kosong keluar semua kelompok', () => {
    expectEmpty(
      groups([
        member(''),
        member('   '),
        member('2010-2-5'),
        member('2010-13-01'),
        member('2010-00-10'),
        member('bukan tanggal'),
        member(null as unknown as string),
        member(undefined as unknown as string),
      ]),
    )
  })

  it('determinisme: injeksi now sama menghasilkan hasil identik', () => {
    const members = [member('2011-06-15'), member('1962-06-15'), member('1961-06-14')]
    expect(groups(members)).toEqual(groups(members))
    expect(groups(members, new Date('2026-06-15T23:59:59Z'))).toEqual(groups(members))
  })

  it('invarian urutan input: hasil tidak bergantung urutan', () => {
    const a = [member('2011-06-15'), member('1962-06-15'), member('1961-06-14')]
    const b = [member('1961-06-14'), member('2011-06-15'), member('1962-06-15')]
    expect(groups(a)).toEqual(groups(b))
  })

  it('agregat campur: tiga kelompok terisi sekaligus benar', () => {
    const r = groups([
      member('2020-01-01'),
      member('1990-03-10'),
      member('1950-07-04'),
      member('1948-11-30'),
      member('1961-06-14'),
      member('2001-06-16'),
    ])
    expect(r).toEqual({ 'children-0-14': 1, 'adults-15-64': 2, 'seniors-65+': 3 })
  })

  it('invarian non-negatif: nilai semua kelompok selalu >= 0', () => {
    const r = groups([member('2027-01-01'), member(''), member('1980-01-01')])
    for (const key of AGE_GROUPS_PBB) {
      expect(r[key]).toBeGreaterThanOrEqual(0)
    }
  })
})
