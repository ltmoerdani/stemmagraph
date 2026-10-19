import { describe, expect, it } from 'vitest'

import { computeSurvivalCurve, SURVIVAL_AGES, type SurvivalMember } from './survival-curve'

function member(birthDate: string, deathDate: string | null): SurvivalMember {
  return { birthDate, deathDate }
}

describe('computeSurvivalCurve', () => {
  it('kasus 1: input kosong menghasilkan array kosong', () => {
    expect(computeSurvivalCurve([])).toEqual([])
  })

  it('kasus 2: satu kohort dasar dengan campuran meninggal dan hidup', () => {
    const members = [
      member('1970-05-10', '2000-05-10'), // umur 30
      member('1975-01-01', null), // hidup
      member('1972-03-03', '2010-03-04'), // umur 38
    ]
    const result = computeSurvivalCurve(members)
    expect(result).toHaveLength(1)
    expect(result[0].decade).toBe('1970s')
    expect(result[0].cohortSize).toBe(3)
    expect(result[0].survivorsAtAges).toHaveLength(11)
    expect(result[0].survivorsAtAges[0]).toEqual({ age: 0, aliveCount: 3, survivalFraction: 1 })
    expect(result[0].survivorsAtAges[3]).toEqual({ age: 30, aliveCount: 3, survivalFraction: 1 })
    expect(result[0].survivorsAtAges[4]).toEqual({ age: 40, aliveCount: 1, survivalFraction: 0.33 })
    expect(result[0].survivorsAtAges[10]).toEqual({ age: 100, aliveCount: 1, survivalFraction: 0.33 })
  })

  it('kasus 3: kelahiran lintas dekade masuk kohort dekade terpisah urut ASC', () => {
    const members = [
      member('1963-08-09', null),
      member('1955-04-04', null),
    ]
    const result = computeSurvivalCurve(members)
    expect(result.map(cohort => cohort.decade)).toEqual(['1950s', '1960s'])
    expect(result[0].cohortSize).toBe(1)
    expect(result[1].cohortSize).toBe(1)
  })

  it('kasus 4: meninggal muda selamat di umur 0 tapi tidak di umur tinggi', () => {
    const result = computeSurvivalCurve([member('1980-01-01', '1985-06-15')])
    expect(result[0].survivorsAtAges[0].survivalFraction).toBe(1)
    expect(result[0].survivorsAtAges[1].survivalFraction).toBe(0)
    expect(result[0].survivorsAtAges[1].aliveCount).toBe(0)
    expect(result[0].survivorsAtAges[10].survivalFraction).toBe(0)
  })

  it('kasus 5: anggota hidup dihitung selamat di semua titik (censored right)', () => {
    const result = computeSurvivalCurve([member('1961-11-30', null)])
    for (const point of result[0].survivorsAtAges) {
      expect(point.aliveCount).toBe(1)
      expect(point.survivalFraction).toBe(1)
    }
  })

  it('kasus 6: boundary ulang tahun, tepat hari ulang tahun naik, sehari sebelum tidak', () => {
    const onBirthday = computeSurvivalCurve([member('1960-07-20', '1970-07-20')])
    expect(onBirthday[0].survivorsAtAges[1]).toEqual({ age: 10, aliveCount: 1, survivalFraction: 1 })
    expect(onBirthday[0].survivorsAtAges[2]).toEqual({ age: 20, aliveCount: 0, survivalFraction: 0 })

    const dayBefore = computeSurvivalCurve([member('1960-07-20', '1970-07-19')])
    expect(dayBefore[0].survivorsAtAges[1]).toEqual({ age: 10, aliveCount: 0, survivalFraction: 0 })
  })

  it('kasus 7: deathDate sebelum birthDate dibuang dari kohort', () => {
    const onlyInvalid = computeSurvivalCurve([member('1970-01-10', '1970-01-05')])
    expect(onlyInvalid).toEqual([])

    const mixed = computeSurvivalCurve([
      member('1970-01-10', '1970-01-05'),
      member('1970-06-01', null),
    ])
    expect(mixed).toHaveLength(1)
    expect(mixed[0].cohortSize).toBe(1)
  })

  it('kasus 8: tanggal kalender tidak valid dilempar Error', () => {
    expect(() => computeSurvivalCurve([member('1990-02-30', null)])).toThrow(Error)
    expect(() => computeSurvivalCurve([member('2001-04-31', null)])).toThrow(Error)
  })

  it('kasus 9: format salah dilempar Error', () => {
    expect(() => computeSurvivalCurve([member('20/03/1990', null)])).toThrow(Error)
    expect(() => computeSurvivalCurve([member('1990-3-5', null)])).toThrow(Error)
    expect(() => computeSurvivalCurve([member('1990-01-01', '2000.05.05')])).toThrow(Error)
  })

  it('kasus 10: fraction umur 0 = 1 dan monoton tidak naik di seluruh grid', () => {
    const result = computeSurvivalCurve([
      member('1940-01-01', '1945-06-01'), // umur 5
      member('1942-05-05', '1997-05-05'), // umur 55
      member('1944-12-24', null),
    ])
    const fractions = result[0].survivorsAtAges.map(point => point.survivalFraction)
    expect(fractions[0]).toBe(1)
    for (let i = 1; i < fractions.length; i += 1) {
      expect(fractions[i]).toBeLessThanOrEqual(fractions[i - 1])
    }
  })

  it('kasus 11: dua pemanggilan dengan urutan input beda hasil identik (determinisme)', () => {
    const members = [
      member('1971-02-03', '1999-02-02'),
      member('1976-06-08', null),
      member('1979-09-09', '2060-09-09'),
      member('1973-12-31', null),
    ]
    const first = computeSurvivalCurve(members)
    const second = computeSurvivalCurve([...members].reverse())
    expect(first).toEqual(second)
  })

  it('kasus 12: kohort tunggal satu anggota, hidup fraction 1 semua titik, meninggal 45 nol mulai 50', () => {
    const alive = computeSurvivalCurve([member('1980-02-02', null)])
    expect(alive[0].cohortSize).toBe(1)
    expect(alive[0].survivorsAtAges.every(point => point.survivalFraction === 1)).toBe(true)

    const died45 = computeSurvivalCurve([member('1980-02-02', '2025-02-02')])
    expect(died45[0].survivorsAtAges[4].survivalFraction).toBe(1)
    expect(died45[0].survivorsAtAges[5].survivalFraction).toBe(0)
  })

  it('kasus 13: opsi cohortDecade false menggabungkan semua dekade ke satu kohort all', () => {
    const result = computeSurvivalCurve(
      [member('1955-04-04', null), member('1963-08-09', '2003-08-10')],
      { cohortDecade: false },
    )
    expect(result).toHaveLength(1)
    expect(result[0].decade).toBe('all')
    expect(result[0].cohortSize).toBe(2)
  })

  it('grid umur tetap 11 titik 0 sampai 100 step 10', () => {
    expect(SURVIVAL_AGES).toEqual([0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100])
  })
})
