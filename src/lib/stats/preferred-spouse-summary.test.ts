import { describe, expect, it } from 'vitest'
import {
  computePreferredSpouseSummary,
  type PreferredSpouseFamilyInput,
  type PreferredSpouseIndividualInput,
} from './preferred-spouse-summary'

function ind(
  id: string,
  birthDate: string | null,
  fams: string[],
): PreferredSpouseIndividualInput {
  return { id, birthDate, fams }
}

function fam(
  familyId: string,
  marriageDate: string | null,
  husbandId: string | null,
  wifeId: string | null,
): PreferredSpouseFamilyInput {
  return { familyId, marriageDate, husbandId, wifeId }
}

describe('computePreferredSpouseSummary', () => {
  it('kasus 1 input kosong: payload nol, averageAgeGapAtMarriage null', () => {
    const result = computePreferredSpouseSummary({ individuals: [], families: [] })
    expect(result.individualsTotal).toBe(0)
    expect(result.individualsWithFams).toBe(0)
    expect(result.preferredSpouseResolved).toBe(0)
    expect(result.preferredSpouseUnresolved).toBe(0)
    expect(result.marriageIndexDistribution).toEqual({ '1': 0, '2': 0, '3plus': 0 })
    expect(result.averageAgeGapAtMarriage).toBeNull()
  })

  it('kasus 2 individu tanpa FAMS tidak masuk withFams', () => {
    const result = computePreferredSpouseSummary({
      individuals: [ind('I1', '1980-01-01', [])],
      families: [],
    })
    expect(result.individualsTotal).toBe(1)
    expect(result.individualsWithFams).toBe(0)
    expect(result.preferredSpouseResolved).toBe(0)
    expect(result.preferredSpouseUnresolved).toBe(0)
    expect(result.marriageIndexDistribution).toEqual({ '1': 0, '2': 0, '3plus': 0 })
    expect(result.averageAgeGapAtMarriage).toBeNull()
  })

  it('kasus 3 satu FAMS terisi: resolved, distribusi kunci 1', () => {
    const result = computePreferredSpouseSummary({
      individuals: [
        ind('I1', '1980-01-01', ['F1']),
        ind('I2', '1982-05-05', ['F1']),
      ],
      families: [fam('F1', '2005-06-01', 'I1', 'I2')],
    })
    expect(result.individualsWithFams).toBe(2)
    expect(result.preferredSpouseResolved).toBe(2)
    expect(result.preferredSpouseUnresolved).toBe(0)
    expect(result.marriageIndexDistribution).toEqual({ '1': 2, '2': 0, '3plus': 0 })
  })

  it('kasus 4 multi FAMS: pasangan prefer dari family terakhir (mirror getCurrentSpouse)', () => {
    const result = computePreferredSpouseSummary({
      individuals: [ind('I1', '1970-01-01', ['F1', 'F2'])],
      families: [
        fam('F1', '1990-01-01', 'I1', 'I2'),
        fam('F2', '2000-01-01', 'I1', 'I3'),
      ],
    })
    expect(result.preferredSpouseResolved).toBe(1)
    expect(result.marriageIndexDistribution).toEqual({ '1': 0, '2': 1, '3plus': 0 })
  })

  it('kasus 5 family terakhir tidak ada di families: unresolved', () => {
    const result = computePreferredSpouseSummary({
      individuals: [ind('I1', '1970-01-01', ['F1', 'F9'])],
      families: [fam('F1', '1990-01-01', 'I1', 'I2')],
    })
    expect(result.individualsWithFams).toBe(1)
    expect(result.preferredSpouseResolved).toBe(0)
    expect(result.preferredSpouseUnresolved).toBe(1)
    expect(result.marriageIndexDistribution).toEqual({ '1': 0, '2': 0, '3plus': 0 })
  })

  it('kasus 6 individu tidak terdaftar di family terakhir: unresolved', () => {
    const result = computePreferredSpouseSummary({
      individuals: [ind('I1', '1970-01-01', ['F1'])],
      families: [fam('F1', '1990-01-01', 'I2', 'I3')],
    })
    expect(result.preferredSpouseUnresolved).toBe(1)
    expect(result.preferredSpouseResolved).toBe(0)
  })

  it('kasus 7 slot pasangan kosong di family terakhir: unresolved', () => {
    const result = computePreferredSpouseSummary({
      individuals: [ind('I1', '1970-01-01', ['F1'])],
      families: [fam('F1', '1990-01-01', 'I1', null)],
    })
    expect(result.preferredSpouseUnresolved).toBe(1)
    expect(result.preferredSpouseResolved).toBe(0)
  })

  it('kasus 8 invariant resolved plus unresolved sama dengan individualsWithFams', () => {
    const result = computePreferredSpouseSummary({
      individuals: [
        ind('I1', '1970-01-01', ['F1']),
        ind('I2', '1971-01-01', ['F2']),
        ind('I3', '1972-01-01', []),
        ind('I4', '1973-01-01', ['F3', 'F4']),
      ],
      families: [
        fam('F1', '1990-01-01', 'I1', 'I2'),
        fam('F4', '2000-01-01', 'I4', null),
      ],
    })
    expect(result.individualsWithFams).toBe(3)
    expect(result.preferredSpouseResolved).toBe(1)
    expect(result.preferredSpouseUnresolved).toBe(2)
    expect(result.preferredSpouseResolved + result.preferredSpouseUnresolved).toBe(
      result.individualsWithFams,
    )
  })

  it('kasus 9 tiga pernikahan masuk bucket 3plus', () => {
    const result = computePreferredSpouseSummary({
      individuals: [ind('I1', '1960-01-01', ['F1', 'F2', 'F3'])],
      families: [
        fam('F1', '1980-01-01', 'I1', 'I2'),
        fam('F2', '1990-01-01', 'I1', 'I3'),
        fam('F3', '2000-01-01', 'I1', 'I4'),
      ],
    })
    expect(result.marriageIndexDistribution).toEqual({ '1': 0, '2': 0, '3plus': 1 })
    expect(result.preferredSpouseResolved).toBe(1)
  })

  it('kasus 10 age gap tahun penuh lalu rata-rata dua pasangan dibulatkan 2 desimal', () => {
    const result = computePreferredSpouseSummary({
      individuals: [
        ind('I1', '1980-01-15', ['F1']),
        ind('I2', '1983-07-15', ['F1']),
        ind('I3', '1970-01-15', ['F2']),
        ind('I4', '1983-01-15', ['F2']),
      ],
      families: [
        fam('F1', '2005-01-15', 'I1', 'I2'),
        fam('F2', '2005-01-15', 'I3', 'I4'),
      ],
    })
    expect(result.averageAgeGapAtMarriage).toBe(8.5)
  })

  it('kasus 11 age gap null saat salah satu tanggal null', () => {
    const result = computePreferredSpouseSummary({
      individuals: [
        ind('I1', null, ['F1']),
        ind('I2', '1983-07-15', ['F1']),
      ],
      families: [fam('F1', '2005-01-15', 'I1', 'I2')],
    })
    expect(result.preferredSpouseResolved).toBe(2)
    expect(result.averageAgeGapAtMarriage).toBeNull()
  })

  it('kasus 12 age gap null saat pasangan tidak terdaftar sebagai individu', () => {
    const result = computePreferredSpouseSummary({
      individuals: [ind('I1', '1980-01-15', ['F1'])],
      families: [fam('F1', '2005-01-15', 'I1', 'I2')],
    })
    expect(result.preferredSpouseResolved).toBe(1)
    expect(result.averageAgeGapAtMarriage).toBeNull()
  })

  it('kasus 13 age gap pakai nilai absolut dan skip usia negatif', () => {
    const gapAbsolut = computePreferredSpouseSummary({
      individuals: [
        ind('I1', '1990-01-15', ['F1']),
        ind('I2', '1980-01-15', ['F1']),
      ],
      families: [fam('F1', '2005-01-15', 'I1', 'I2')],
    })
    expect(gapAbsolut.averageAgeGapAtMarriage).toBe(10)

    const gapNegatif = computePreferredSpouseSummary({
      individuals: [
        ind('I3', '2010-01-15', ['F2']),
        ind('I4', '1980-01-15', ['F2']),
      ],
      families: [fam('F2', '2005-01-15', 'I3', 'I4')],
    })
    expect(gapNegatif.averageAgeGapAtMarriage).toBeNull()
  })

  it('kasus 14 payload bukan objek dan field salah tipe dilempar', () => {
    expect(() => computePreferredSpouseSummary(null)).toThrow()
    expect(() => computePreferredSpouseSummary([])).toThrow()
    expect(() => computePreferredSpouseSummary({})).toThrow()
    expect(() =>
      computePreferredSpouseSummary({ individuals: 'x', families: [] }),
    ).toThrow()
    expect(() =>
      computePreferredSpouseSummary({
        individuals: [ind('I1', 'bukan-tanggal', [])],
        families: [],
      }),
    ).toThrow()
    expect(() =>
      computePreferredSpouseSummary({
        individuals: [{ id: '', birthDate: null, fams: [] }],
        families: [],
      }),
    ).toThrow()
    expect(() =>
      computePreferredSpouseSummary({
        individuals: [ind('I1', '2001-02-29', [])],
        families: [],
      }),
    ).toThrow()
  })

  it('kasus 15 id individu dan familyId duplikat dilempar', () => {
    expect(() =>
      computePreferredSpouseSummary({
        individuals: [ind('I1', null, []), ind('I1', null, [])],
        families: [],
      }),
    ).toThrow()
    expect(() =>
      computePreferredSpouseSummary({
        individuals: [],
        families: [fam('F1', null, null, null), fam('F1', null, null, null)],
      }),
    ).toThrow()
  })

  it('kasus 16 tanggal tidak valid kalender dan format salah dilempar', () => {
    expect(() =>
      computePreferredSpouseSummary({
        individuals: [],
        families: [fam('F1', '2005-13-01', null, null)],
      }),
    ).toThrow()
    expect(() =>
      computePreferredSpouseSummary({
        individuals: [],
        families: [fam('F1', '20050101', null, null)],
      }),
    ).toThrow()
    expect(() =>
      computePreferredSpouseSummary({
        individuals: [],
        families: [fam('F1', 20050101, null, null)],
      }),
    ).toThrow()
  })

  it('kasus 17 determinisme dua kali run identik', () => {
    const input = {
      individuals: [
        ind('I1', '1980-01-01', ['F1', 'F2']),
        ind('I2', '1982-05-05', ['F1']),
        ind('I3', '1983-07-15', ['F2']),
      ],
      families: [
        fam('F1', '2005-01-15', 'I1', 'I2'),
        fam('F2', '2010-01-15', 'I1', 'I3'),
      ],
    }
    const a = computePreferredSpouseSummary(input)
    const b = computePreferredSpouseSummary(input)
    expect(a).toEqual(b)
  })

  it('kasus 18 spousal self slot: individu mencatat dirinya sebagai pasangan tetap resolved namun tanpa age gap bila tak ada data lawan', () => {
    const result = computePreferredSpouseSummary({
      individuals: [ind('I1', '1980-01-01', ['F1'])],
      families: [fam('F1', '2005-01-15', 'I1', 'I1')],
    })
    expect(result.preferredSpouseUnresolved).toBe(1)
    expect(result.preferredSpouseResolved).toBe(0)
  })
})
