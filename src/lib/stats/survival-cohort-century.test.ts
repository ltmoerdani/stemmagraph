import { describe, expect, it } from 'vitest'

import { computeSurvivalCohortCentury, type SurvivalCohortMember } from './survival-cohort-century'

function member(birthDate: string, deathDate: string | null): SurvivalCohortMember {
  return { birthDate, deathDate }
}

describe('computeSurvivalCohortCentury', () => {
  it('kasus 1: input kosong menghasilkan array kosong', () => {
    expect(computeSurvivalCohortCentury([])).toEqual([])
  })

  it('kasus 2: satu kohort tunggal 1800s dengan campuran meninggal dan hidup', () => {
    const members = [
      member('1850-05-10', '1880-05-10'), // umur 30
      member('1855-01-01', '1900-06-01'), // umur 45
      member('1860-03-03', null), // hidup
    ]
    const result = computeSurvivalCohortCentury(members)
    expect(result).toHaveLength(1)
    expect(result[0].century).toBe('1800s')
    expect(result[0].cohortSize).toBe(3)
    expect(result[0].survivorsAtAges.map(p => p.age)).toEqual([0, 10, 20, 30, 40])
    expect(result[0].survivorsAtAges[0]).toEqual({ age: 0, aliveCount: 3, survivalFraction: 1 })
    expect(result[0].survivorsAtAges[3]).toEqual({ age: 30, aliveCount: 3, survivalFraction: 1 })
    expect(result[0].survivorsAtAges[4]).toEqual({ age: 40, aliveCount: 2, survivalFraction: 0.67 })
  })

  it('kasus 3: dua kohort abad beda tetap ASC meski input terbalik', () => {
    const members = [
      member('1820-06-15', '1850-06-15'), // 1800s, umur 30
      member('1750-01-01', '1800-01-01'), // 1700s, umur 50
    ]
    const result = computeSurvivalCohortCentury(members)
    expect(result.map(c => c.century)).toEqual(['1700s', '1800s'])
    expect(result[0].cohortSize).toBe(1)
    expect(result[0].survivorsAtAges.map(p => p.age)).toEqual([0, 10, 20, 30, 40, 50])
    expect(result[1].cohortSize).toBe(1)
    expect(result[1].survivorsAtAges.map(p => p.age)).toEqual([0, 10, 20, 30])
  })

  it('kasus 4: boundary abad 1899 vs 1900 vs 2000', () => {
    const members = [
      member('1899-12-31', null),
      member('1900-01-01', null),
      member('2000-01-01', null),
    ]
    const result = computeSurvivalCohortCentury(members)
    expect(result.map(c => c.century)).toEqual(['1800s', '1900s', '2000s'])
    expect(result.map(c => c.cohortSize)).toEqual([1, 1, 1])
    for (const cohort of result) {
      expect(cohort.survivorsAtAges).toEqual([{ age: 0, aliveCount: 1, survivalFraction: 1 }])
    }
  })

  it('kasus 5: kematian sebelum birthDate dibuang dari kohort', () => {
    const members = [
      member('1900-05-05', '1899-01-01'), // dibuang
      member('1901-01-01', null),
    ]
    const result = computeSurvivalCohortCentury(members)
    expect(result).toHaveLength(1)
    expect(result[0].century).toBe('1900s')
    expect(result[0].cohortSize).toBe(1)
    expect(result[0].survivorsAtAges[0]).toEqual({ age: 0, aliveCount: 1, survivalFraction: 1 })
  })

  it('kasus 6: format salah dilempar Error tanpa silent-filter', () => {
    expect(() => computeSurvivalCohortCentury([member('1900/01/01', null)])).toThrowError(
      /Invalid birthDate format/,
    )
    expect(() => computeSurvivalCohortCentury([member('1900-01-01', 'not-a-date')])).toThrowError(
      /Invalid deathDate format/,
    )
    expect(() => computeSurvivalCohortCentury([member('1900-1-1', null)])).toThrowError(
      /Invalid birthDate format/,
    )
  })

  it('kasus 7: 2000-02-29 kabisat sah', () => {
    const result = computeSurvivalCohortCentury([member('2000-02-29', null)])
    expect(result).toHaveLength(1)
    expect(result[0].century).toBe('2000s')
    expect(result[0].cohortSize).toBe(1)
    expect(result[0].survivorsAtAges[0]).toEqual({ age: 0, aliveCount: 1, survivalFraction: 1 })
  })

  it('kasus 8: 1900-02-29 dilempar Error, bukan kabisat', () => {
    expect(() => computeSurvivalCohortCentury([member('1900-02-29', null)])).toThrowError(
      /Invalid calendar birthDate/,
    )
  })

  it('kasus 9: hidup dihitung selamat di semua titik grid (censored right)', () => {
    const members = [
      member('1800-01-01', '1890-01-01'), // umur 90, memperpanjang grid
      member('1805-06-01', null), // hidup
    ]
    const result = computeSurvivalCohortCentury(members)
    expect(result).toHaveLength(1)
    expect(result[0].century).toBe('1800s')
    expect(result[0].cohortSize).toBe(2)
    expect(result[0].survivorsAtAges.map(p => p.age)).toEqual([
      0, 10, 20, 30, 40, 50, 60, 70, 80, 90,
    ])
    for (const point of result[0].survivorsAtAges) {
      expect(point.aliveCount).toBe(2)
      expect(point.survivalFraction).toBe(1)
    }
  })

  it('kasus 10: anniversary boundary, belum ulang tahun tidak naik', () => {
    const members = [
      member('1850-06-15', '1860-06-14'), // 9, belum ulang tahun ke-10
      member('1851-03-01', '1861-03-01'), // 10, tepat ulang tahun ke-10
    ]
    const result = computeSurvivalCohortCentury(members)
    expect(result).toHaveLength(1)
    expect(result[0].cohortSize).toBe(2)
    expect(result[0].survivorsAtAges[1]).toEqual({ age: 10, aliveCount: 1, survivalFraction: 0.5 })
  })

  it('kasus 11: grid umur ASC kelipatan 10 sampai maksimum kohort', () => {
    const members = [
      member('1800-01-01', '1823-01-01'), // 23
      member('1801-01-01', '1848-02-01'), // 47
      member('1802-01-01', '1883-01-01'), // 81
    ]
    const result = computeSurvivalCohortCentury(members)
    expect(result).toHaveLength(1)
    const ages = result[0].survivorsAtAges.map(p => p.age)
    expect(ages).toEqual([0, 10, 20, 30, 40, 50, 60, 70, 80])
    for (let i = 1; i < ages.length; i += 1) {
      expect(ages[i] - ages[i - 1]).toBe(10)
    }
    expect(result[0].survivorsAtAges.map(p => p.aliveCount)).toEqual([3, 3, 3, 2, 2, 1, 1, 1, 1])
  })

  it('kasus 12: urutan input acak menghasilkan output identik', () => {
    const members = [
      member('1890-04-04', '1950-04-04'),
      member('1920-08-09', '2001-08-09'),
      member('1955-02-02', null),
      member('1930-07-07', '1999-01-01'),
      member('1885-12-12', '1970-12-12'),
    ]
    const shuffled = [
      member('1930-07-07', '1999-01-01'),
      member('1885-12-12', '1970-12-12'),
      member('1955-02-02', null),
      member('1890-04-04', '1950-04-04'),
      member('1920-08-09', '2001-08-09'),
    ]
    expect(computeSurvivalCohortCentury(shuffled)).toEqual(computeSurvivalCohortCentury(members))
  })

  it('kasus 13: survivalFraction dibulatkan 2 desimal', () => {
    const members = [
      member('1800-01-01', '1815-01-01'), // 15
      member('1800-01-01', '1845-06-01'), // 45
      member('1800-03-01', '1850-03-01'), // 50
    ]
    const result = computeSurvivalCohortCentury(members)
    expect(result).toHaveLength(1)
    expect(result[0].survivorsAtAges[3]).toEqual({ age: 30, aliveCount: 2, survivalFraction: 0.67 })
    expect(result[0].survivorsAtAges[4]).toEqual({ age: 40, aliveCount: 2, survivalFraction: 0.67 })
    expect(result[0].survivorsAtAges[5]).toEqual({ age: 50, aliveCount: 1, survivalFraction: 0.33 })
  })

  it('kasus 14: kohort kosong nihil di output', () => {
    // Seluruh anggota terbuang sehingga tak ada kohort tersisa.
    expect(computeSurvivalCohortCentury([member('1900-05-05', '1899-01-01')])).toEqual([])
    // Abad tanpa anggota tidak muncul di antara dua kohort yang ada.
    const result = computeSurvivalCohortCentury([
      member('1850-01-01', '1860-01-01'),
      member('2050-01-01', null),
    ])
    expect(result.map(c => c.century)).toEqual(['1800s', '2000s'])
    expect(result.map(c => c.century)).not.toContain('1900s')
  })

  it('kasus 15: kematian tepat hari lahir tetap masuk, umur 0, grid satu titik', () => {
    const result = computeSurvivalCohortCentury([member('1900-05-05', '1900-05-05')])
    expect(result).toHaveLength(1)
    expect(result[0].century).toBe('1900s')
    expect(result[0].cohortSize).toBe(1)
    expect(result[0].survivorsAtAges).toEqual([{ age: 0, aliveCount: 1, survivalFraction: 1 }])
  })
})
