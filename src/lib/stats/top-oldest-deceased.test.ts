import { describe, expect, it } from 'vitest'

import { computeTopOldestDeceased, type DeceasedMember } from './top-oldest-deceased'

function m(
  id: string,
  birthDate: string | null,
  deathDate: string | null,
  isAlive = false,
): DeceasedMember {
  return { id, birthDate, deathDate, isAlive }
}

describe('computeTopOldestDeceased', () => {
  it('1. array kosong menghasilkan array kosong tanpa throw', () => {
    expect(computeTopOldestDeceased([], 10)).toEqual([])
  })

  it('2. satu entri meninggal valid menghasilkan satu baris id + ageYears', () => {
    const members = [m('a', '1930-01-01', '2020-01-01')]
    expect(computeTopOldestDeceased(members, 10)).toEqual([{ id: 'a', ageYears: 90 }])
  })

  it('3. peringkat ageYears DESC meski input acak', () => {
    const members = [
      m('a', '1936-05-01', '2016-05-01'),
      m('b', '1946-05-01', '2016-05-01'),
      m('c', '1926-05-01', '2016-05-01'),
    ]
    const result = computeTopOldestDeceased(members, 10)
    expect(result.map((r) => r.id)).toEqual(['c', 'a', 'b'])
    expect(result.map((r) => r.ageYears)).toEqual([90, 80, 70])
  })

  it('4. topN memotong hasil', () => {
    const members = [
      m('a', '1936-05-01', '2016-05-01'),
      m('b', '1946-05-01', '2016-05-01'),
      m('c', '1926-05-01', '2016-05-01'),
      m('d', '1956-05-01', '2016-05-01'),
      m('e', '1966-05-01', '2016-05-01'),
    ]
    const result = computeTopOldestDeceased(members, 3)
    expect(result.map((r) => r.id)).toEqual(['c', 'a', 'b'])
  })

  it('5. topN 0 dan topN negatif menghasilkan array kosong', () => {
    const members = [m('a', '1930-01-01', '2020-01-01')]
    expect(computeTopOldestDeceased(members, 0)).toEqual([])
    expect(computeTopOldestDeceased(members, -1)).toEqual([])
  })

  it('6. entri isAlive true dikecualikan', () => {
    const members = [m('a', '1930-01-01', '2020-01-01', true), m('b', '1935-01-01', '2015-01-01')]
    expect(computeTopOldestDeceased(members, 10)).toEqual([{ id: 'b', ageYears: 80 }])
  })

  it('7. birthDate null dan deathDate null dikecualikan', () => {
    const members = [
      m('a', null, '2020-01-01'),
      m('b', '1930-01-01', null),
      m('c', '1940-01-01', '2020-01-01'),
    ]
    expect(computeTopOldestDeceased(members, 10)).toEqual([{ id: 'c', ageYears: 80 }])
  })

  it('8. format invalid dikecualikan tanpa throw', () => {
    const members = [
      m('a', 'abc', '2020-01-01'),
      m('b', '1930-01-01', '1952/03/10'),
      m('c', '1930-1-1', '2020-01-01'),
      m('d', '1940-01-01', '2020-01-01'),
    ]
    expect(computeTopOldestDeceased(members, 10)).toEqual([{ id: 'd', ageYears: 80 }])
  })

  it('9. tanggal kalender invalid dikecualikan: 1900-02-29 ditolak, 2000-02-29 valid', () => {
    const members = [
      m('a', '1900-02-29', '2020-01-01'),
      m('b', '1930-01-01', '1900-02-29'),
      m('c', '2000-02-29', '2020-02-29'),
    ]
    expect(computeTopOldestDeceased(members, 10)).toEqual([{ id: 'c', ageYears: 20 }])
  })

  it('10. tie ageYears dipecah birthDate ASC (lebih tua lahir duluan)', () => {
    const members = [
      m('x', '1946-05-01', '2016-05-01'),
      m('y', '1946-03-10', '2016-05-01'),
    ]
    expect(computeTopOldestDeceased(members, 10).map((r) => r.id)).toEqual(['y', 'x'])
  })

  it('11. tie ageYears dan birthDate dipecah id ASC leksikograf', () => {
    const members = [
      m('b', '1946-05-01', '2016-05-01'),
      m('a', '1946-05-01', '2016-05-01'),
    ]
    expect(computeTopOldestDeceased(members, 10).map((r) => r.id)).toEqual(['a', 'b'])
  })

  it('12. ulang tahun tepat tanggal kematian: usia baru tercapai', () => {
    const members = [m('a', '1950-03-10', '2020-03-10')]
    expect(computeTopOldestDeceased(members, 10)).toEqual([{ id: 'a', ageYears: 70 }])
  })

  it('13. ulang tahun belum lewat pada tanggal kematian: usia minus satu', () => {
    const members = [m('a', '1950-03-10', '2020-03-09')]
    expect(computeTopOldestDeceased(members, 10)).toEqual([{ id: 'a', ageYears: 69 }])
  })

  it('14. umur 0: lahir dan meninggal tahun sama sebelum ulang tahun pertama', () => {
    const members = [m('a', '2020-05-10', '2020-08-01')]
    expect(computeTopOldestDeceased(members, 10)).toEqual([{ id: 'a', ageYears: 0 }])
  })

  it('15. determinisme: dua urutan input berbeda menghasilkan output identik', () => {
    const a = m('a', '1936-05-01', '2016-05-01')
    const b = m('b', '1926-05-01', '2016-05-01')
    const c = m('c', '1946-05-01', '2016-05-01')
    const d = m('d', '1956-05-01', '2016-05-01')
    const urutanSatu = [a, b, c, d]
    const urutanDua = [d, c, a, b]
    expect(computeTopOldestDeceased(urutanSatu, 10)).toEqual(
      computeTopOldestDeceased(urutanDua, 10),
    )
  })
})
