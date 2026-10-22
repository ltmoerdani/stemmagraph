import { describe, expect, it } from 'vitest'
import {
  computeDivorceRateByMarriageCohort,
  type MarriageCohortRecord,
} from './divorce-rate-by-marriage-cohort'

function rec(
  familyId: string,
  marriageDate: string | null,
  divorceDate: string | null,
): MarriageCohortRecord {
  return { familyId, marriageDate, divorceDate }
}

describe('computeDivorceRateByMarriageCohort', () => {
  it('distribusi dasar multi kohort urut ASC', () => {
    const result = computeDivorceRateByMarriageCohort([
      rec('f1', '1965-06-01', null),
      rec('f2', '1972-03-15', '1980-01-10'),
      rec('f3', '1968-11-30', '1975-05-05'),
      rec('f4', '1975-07-04', null),
    ])
    expect(result.cohorts.map((c) => c.cohort)).toEqual(['1960', '1970'])
    expect(result.cohorts[0]).toEqual({
      cohort: '1960',
      married: 2,
      divorced: 1,
      rate: 0.5,
    })
    expect(result.cohorts[1]).toEqual({
      cohort: '1970',
      married: 2,
      divorced: 1,
      rate: 0.5,
    })
    expect(result.totalMarried).toBe(4)
    expect(result.totalDivorced).toBe(2)
    expect(result.undated).toBe(0)
  })

  it('urutan input diacak output identik (determinisme)', () => {
    const input = [
      rec('f1', '1951-01-01', '1955-06-01'),
      rec('f2', '1999-12-31', null),
      rec('f3', '1955-05-05', '1960-01-01'),
      rec('f4', '1990-06-15', '1995-03-03'),
    ]
    const a = computeDivorceRateByMarriageCohort(input)
    const b = computeDivorceRateByMarriageCohort([...input].reverse())
    expect(a).toEqual(b)
  })

  it('kohort tunggal', () => {
    const result = computeDivorceRateByMarriageCohort([
      rec('f1', '2001-02-02', null),
      rec('f2', '2003-04-04', '2009-09-09'),
    ])
    expect(result.cohorts).toHaveLength(1)
    expect(result.cohorts[0].cohort).toBe('2000')
    expect(result.cohorts[0].married).toBe(2)
    expect(result.cohorts[0].divorced).toBe(1)
    expect(result.cohorts[0].rate).toBe(0.5)
  })

  it('input kosong', () => {
    const result = computeDivorceRateByMarriageCohort([])
    expect(result.cohorts).toEqual([])
    expect(result.totalMarried).toBe(0)
    expect(result.totalDivorced).toBe(0)
    expect(result.undated).toBe(0)
  })

  it('semua marriageDate null hanya undated', () => {
    const result = computeDivorceRateByMarriageCohort([
      rec('f1', null, null),
      rec('f2', null, null),
    ])
    expect(result.cohorts).toEqual([])
    expect(result.undated).toBe(2)
    expect(result.totalMarried).toBe(0)
  })

  it('campuran dated undated dan bertahan: divorceDate null masuk denominator', () => {
    const result = computeDivorceRateByMarriageCohort([
      rec('f1', '1980-01-01', null),
      rec('f2', '1981-02-01', '1985-03-01'),
      rec('f3', null, null),
      rec('f4', '1982-03-01', '1986-04-01'),
    ])
    expect(result.undated).toBe(1)
    expect(result.cohorts[0]).toMatchObject({ cohort: '1980', married: 3, divorced: 2 })
    expect(result.cohorts[0].rate).toBe(0.67)
  })

  it('familyId duplikat tetap dihitung dua kali', () => {
    const result = computeDivorceRateByMarriageCohort([
      rec('dup', '1970-05-05', '1975-05-05'),
      rec('dup', '1970-06-06', null),
    ])
    expect(result.cohorts[0].married).toBe(2)
    expect(result.cohorts[0].divorced).toBe(1)
  })

  it('rate benar 1 dari 4 = 0.25 dan 1 dari 3 = 0.33 pembulatan 2 desimal', () => {
    const r1 = computeDivorceRateByMarriageCohort([
      rec('f1', '1950-01-01', null),
      rec('f2', '1951-01-01', null),
      rec('f3', '1952-01-01', null),
      rec('f4', '1953-01-01', '1954-01-01'),
    ])
    expect(r1.cohorts[0].rate).toBe(0.25)
    const r2 = computeDivorceRateByMarriageCohort([
      rec('g1', '1960-01-01', null),
      rec('g2', '1961-01-01', '1963-01-01'),
      rec('g3', '1962-01-01', null),
    ])
    expect(r2.cohorts[0].rate).toBe(0.33)
  })

  it('kohort rate 0 dan kohort rate 1', () => {
    const result = computeDivorceRateByMarriageCohort([
      rec('f1', '1940-01-01', null),
      rec('f2', '1941-01-01', null),
      rec('f3', '1945-01-01', '1946-01-01'),
    ])
    expect(result.cohorts[0]).toMatchObject({ cohort: '1940', rate: 0 })
    expect(result.cohorts[1]).toMatchObject({ cohort: '1940', married: 1, divorced: 1, rate: 1 })
    expect(result.cohorts).toHaveLength(1)
  })

  it('divorceDate tanpa marriageDate throw', () => {
    expect(() =>
      computeDivorceRateByMarriageCohort([rec('f1', null, '1980-01-01')]),
    ).toThrowError(/divorceDate tanpa marriageDate/)
  })

  it('divorceDate sebelum marriageDate throw', () => {
    expect(() =>
      computeDivorceRateByMarriageCohort([
        rec('f1', '1980-05-05', '1979-01-01'),
      ]),
    ).toThrowError(/sebelum marriageDate/)
  })

  it('divorceDate sama dengan marriageDate SAH', () => {
    const result = computeDivorceRateByMarriageCohort([
      rec('f1', '1980-05-05', '1980-05-05'),
    ])
    expect(result.cohorts[0].divorced).toBe(1)
  })

  it('throw records bukan array', () => {
    expect(() => computeDivorceRateByMarriageCohort('bukan')).toThrowError(/harus array/)
  })

  it('throw entri bukan objek', () => {
    expect(() =>
      computeDivorceRateByMarriageCohort([42]),
    ).toThrowError(/bukan objek/)
    expect(() =>
      computeDivorceRateByMarriageCohort([null]),
    ).toThrowError(/bukan objek/)
    expect(() =>
      computeDivorceRateByMarriageCohort([['x']]),
    ).toThrowError(/bukan objek/)
  })

  it('throw familyId kosong atau tipe salah', () => {
    expect(() =>
      computeDivorceRateByMarriageCohort([rec('', '1980-01-01', null)]),
    ).toThrowError(/familyId tidak boleh string kosong/)
    expect(() =>
      computeDivorceRateByMarriageCohort([
        { familyId: 7, marriageDate: '1980-01-01', divorceDate: null },
      ]),
    ).toThrowError(/familyId harus string/)
  })

  it('throw marriageDate tipe salah', () => {
    expect(() =>
      computeDivorceRateByMarriageCohort([
        { familyId: 'f1', marriageDate: 1980, divorceDate: null },
      ]),
    ).toThrowError(/marriageDate harus string atau null/)
  })

  it('throw marriageDate format salah', () => {
    expect(() =>
      computeDivorceRateByMarriageCohort([rec('f1', '1980/01/01', null)]),
    ).toThrowError(/format bukan YYYY-MM-DD/)
  })

  it('throw divorceDate tipe salah dan format salah', () => {
    expect(() =>
      computeDivorceRateByMarriageCohort([
        { familyId: 'f1', marriageDate: '1980-01-01', divorceDate: 99 },
      ]),
    ).toThrowError(/divorceDate harus string atau null/)
    expect(() =>
      computeDivorceRateByMarriageCohort([
        { familyId: 'f1', marriageDate: '1980-01-01', divorceDate: '01-01-1980' },
      ]),
    ).toThrowError(/format bukan YYYY-MM-DD/)
  })

  it('throw bulan 00 dan 13 kedua tanggal', () => {
    expect(() =>
      computeDivorceRateByMarriageCohort([rec('f1', '1980-00-10', null)]),
    ).toThrowError(/bulan di luar 1 sampai 12/)
    expect(() =>
      computeDivorceRateByMarriageCohort([rec('f1', '1980-13-10', null)]),
    ).toThrowError(/bulan di luar 1 sampai 12/)
    expect(() =>
      computeDivorceRateByMarriageCohort([rec('f1', '1980-05-05', '1980-00-10')]),
    ).toThrowError(/bulan di luar 1 sampai 12/)
    expect(() =>
      computeDivorceRateByMarriageCohort([rec('f1', '1980-05-05', '1980-13-10')]),
    ).toThrowError(/bulan di luar 1 sampai 12/)
  })

  it('29 Feb kabisat SAH non-kabisat throw', () => {
    expect(() =>
      computeDivorceRateByMarriageCohort([rec('f1', '1980-02-29', null)]),
    ).not.toThrow()
    expect(() =>
      computeDivorceRateByMarriageCohort([rec('f1', '1979-02-29', null)]),
    ).toThrowError(/bukan tanggal kalender valid/)
    expect(() =>
      computeDivorceRateByMarriageCohort([rec('f1', '1980-05-05', '2000-02-29')]),
    ).not.toThrow()
    expect(() =>
      computeDivorceRateByMarriageCohort([rec('f1', '1980-05-05', '1900-02-29')]),
    ).toThrowError(/bukan tanggal kalender valid/)
  })

  it('tanggal kalender invalid throw 31 Feb dan 31 April', () => {
    expect(() =>
      computeDivorceRateByMarriageCohort([rec('f1', '1981-02-31', null)]),
    ).toThrowError(/bukan tanggal kalender valid/)
    expect(() =>
      computeDivorceRateByMarriageCohort([rec('f1', '1980-05-05', '1985-04-31')]),
    ).toThrowError(/bukan tanggal kalender valid/)
  })

  it('dekade boundary 1900 dan 1909 masuk 1900, 1910 pindah 1910', () => {
    const result = computeDivorceRateByMarriageCohort([
      rec('f1', '1900-01-01', null),
      rec('f2', '1909-12-31', null),
      rec('f3', '1910-01-01', null),
    ])
    expect(result.cohorts.map((c) => c.cohort)).toEqual(['1900', '1910'])
    expect(result.cohorts[0].married).toBe(2)
    expect(result.cohorts[1].married).toBe(1)
  })

  it('tahun batas 4 digit 0001 dekade 0 label 0, 9999 dekade 9990', () => {
    const result = computeDivorceRateByMarriageCohort([
      rec('f1', '0001-01-01', null),
      rec('f2', '9999-12-31', null),
    ])
    expect(result.cohorts.map((c) => c.cohort)).toEqual(['0', '9990'])
  })
})
