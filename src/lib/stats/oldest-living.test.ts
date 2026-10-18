import { describe, expect, it } from 'vitest'

import { computeOldestLiving, type OldestLivingMember } from './oldest-living'

const NOW = new Date(Date.UTC(2026, 9, 19))

function m(id: string, birthDate: string | null, isAlive = true): OldestLivingMember {
  return { id, birthDate, isAlive }
}

describe('computeOldestLiving', () => {
  it('1. array kosong menghasilkan array kosong', () => {
    expect(computeOldestLiving([], 10, NOW)).toEqual([])
  })

  it('2. semua anggota meninggal menghasilkan array kosong', () => {
    const members = [m('a', '1930-01-01', false), m('b', '1935-06-15', false)]
    expect(computeOldestLiving(members, 10, NOW)).toEqual([])
  })

  it('3. birthDate null dikecualikan dari kandidat', () => {
    const members = [m('a', null), m('b', '1940-03-10')]
    expect(computeOldestLiving(members, 10, NOW)).toEqual([{ id: 'b', ageYears: 86 }])
  })

  it('4. birthDate invalid dikecualikan (kalender dan format)', () => {
    const members = [
      m('a', '1930-02-30'),
      m('b', '1930-13-01'),
      m('c', '1930/01/02'),
      m('d', '30-01-1930'),
      m('e', '1940-03-10'),
    ]
    expect(computeOldestLiving(members, 10, NOW)).toEqual([{ id: 'e', ageYears: 86 }])
  })

  it('5. umur tepat ulang tahun masuk usia baru', () => {
    const members = [m('a', '1950-10-19')]
    expect(computeOldestLiving(members, 10, NOW)).toEqual([{ id: 'a', ageYears: 76 }])
  })

  it('6. belum ulang tahun mengurangi satu tahun', () => {
    const members = [m('a', '1950-10-20')]
    expect(computeOldestLiving(members, 10, NOW)).toEqual([{ id: 'a', ageYears: 75 }])
  })

  it('7. kelahiran kabisat 29 Feb dihitung anniversary-aware', () => {
    const members = [m('a', '1928-02-29')]
    expect(computeOldestLiving(members, 10, NOW)).toEqual([{ id: 'a', ageYears: 98 }])
    const beforeLeapDay = new Date(Date.UTC(2025, 1, 28))
    expect(computeOldestLiving(members, 10, beforeLeapDay)).toEqual([{ id: 'a', ageYears: 96 }])
  })

  it('8. urutan hasil ageYears DESC', () => {
    const members = [m('a', '1936-05-01'), m('b', '1946-05-01'), m('c', '1926-05-01')]
    const result = computeOldestLiving(members, 10, NOW)
    expect(result.map((r) => r.id)).toEqual(['c', 'a', 'b'])
    expect(result.map((r) => r.ageYears)).toEqual([100, 90, 80])
  })

  it('9. tie umur dipecah birthDate ASC (lebih tua lahir duluan)', () => {
    const members = [m('x', '1946-05-01'), m('y', '1946-03-10')]
    expect(computeOldestLiving(members, 10, NOW).map((r) => r.id)).toEqual(['y', 'x'])
  })

  it('10. tie penuh dipecah id ASC leksikograf', () => {
    const members = [m('b', '1946-05-01'), m('a', '1946-05-01')]
    expect(computeOldestLiving(members, 10, NOW).map((r) => r.id)).toEqual(['a', 'b'])
  })

  it('11. topN default 10 memotong 12 kandidat', () => {
    const members = Array.from({ length: 12 }, (_, i) =>
      m(`p${String(i + 1).padStart(2, '0')}`, `${1936 - i}-05-01`),
    )
    const result = computeOldestLiving(members, undefined, NOW)
    expect(result).toHaveLength(10)
    expect(result[0]).toEqual({ id: 'p12', ageYears: 101 })
    expect(result[9]).toEqual({ id: 'p03', ageYears: 92 })
  })

  it('12. topN 0 dan negatif menghasilkan array kosong', () => {
    const members = [m('a', '1940-03-10')]
    expect(computeOldestLiving(members, 0, NOW)).toEqual([])
    expect(computeOldestLiving(members, -1, NOW)).toEqual([])
    expect(computeOldestLiving(members, -5, NOW)).toEqual([])
  })

  it('13. topN 1 hanya mengambil yang tertua', () => {
    const members = [m('a', '1936-05-01'), m('b', '1926-05-01'), m('c', '1946-05-01')]
    expect(computeOldestLiving(members, 1, NOW)).toEqual([{ id: 'b', ageYears: 100 }])
  })
})
