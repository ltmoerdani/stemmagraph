import { describe, expect, it } from 'vitest'
import {
  computeMultipleBirthRate,
  parseFamilyBirthGroups,
  type FamilyBirth,
  type FamilyBirthGroup,
} from './multiple-birth-rate'

/** Birth lengkap satu baris; null => parsial/undated. */
function b(year: number | null, month: number | null, day: number | null): FamilyBirth {
  return { birthYear: year, birthMonth: month, birthDay: day }
}

function fam(familyId: string, ...births: FamilyBirth[]): FamilyBirthGroup {
  return { familyId, births }
}

/** Tuple [y, m, d]; null pada komponen mana pun berarti parsial. */
type Ymd = [number | null, number | null, number | null]

function groupOf(familyId: string, members: Ymd[]): FamilyBirthGroup {
  return fam(familyId, ...members.map(([y, m, d]) => b(y, m, d)))
}

describe('parseFamilyBirthGroups', () => {
  it('payload bukan array: lempar Error menyebut payload', () => {
    expect(() => parseFamilyBirthGroups({})).toThrow(/payload/)
  })

  it('elemen bukan objek: lempar Error dengan indeks family', () => {
    expect(() => parseFamilyBirthGroups([42])).toThrow(/family\[0\]/)
  })

  it('familyId bukan string: lempar Error dengan nama field', () => {
    expect(() => parseFamilyBirthGroups([{ familyId: 7, births: [] }])).toThrow(
      /family\[0\]\.familyId/,
    )
  })

  it('births bukan array: lempar Error dengan nama field', () => {
    expect(() => parseFamilyBirthGroups([{ familyId: 'F1', births: 'x' }])).toThrow(
      /family\[0\]\.births/,
    )
  })

  it('field tanggal bukan number/null: lempar Error dengan indeks ganda', () => {
    const payload = [groupOf('F1', [[2000, 1, 1]]), groupOf('F2', [[2000, 'x', 1]])]
    expect(() => parseFamilyBirthGroups(payload)).toThrow(
      /family\[1\]\.births\[0\]\.birthMonth/,
    )
  })

  it('payload valid: struktur lolos parser utuh', () => {
    const payload = [groupOf('F1', [[1999, 12, 31], [1999, 12, 31]])]
    expect(parseFamilyBirthGroups(payload)).toEqual(payload)
  })
})

describe('computeMultipleBirthRate', () => {
  it('input kosong: payload utuh tanpa throw', () => {
    expect(computeMultipleBirthRate([])).toEqual({
      centuries: [],
      series: [],
      totalBirths: 0,
      datedBirths: 0,
      multipleBirths: 0,
    })
  })

  it('pasangan kembar tepat 0 hari: multiplicity 2, count 2', () => {
    const result = computeMultipleBirthRate([
      groupOf('F1', [[1980, 5, 10], [1980, 5, 10]]),
    ])
    expect(result.multipleBirths).toBe(2)
    expect(result.series).toEqual([
      { multiplicity: 2, cells: [{ centuryStart: 1900, sharePct: 100, count: 2 }] },
    ])
  })

  it('pasangan berjarak 1 hari tetap kembar', () => {
    const result = computeMultipleBirthRate([
      groupOf('F1', [[1980, 5, 10], [1980, 5, 11]]),
    ])
    expect(result.multipleBirths).toBe(2)
    expect(result.series).toHaveLength(1)
    expect(result.series[0].multiplicity).toBe(2)
  })

  it('berjarak 2 hari: GUGUR, bukan multiple birth', () => {
    const result = computeMultipleBirthRate([
      groupOf('F1', [[1980, 5, 10], [1980, 5, 12]]),
    ])
    expect(result.multipleBirths).toBe(0)
    expect(result.series).toEqual([])
    expect(result.datedBirths).toBe(2)
  })

  it('lintas tengah malam 31 Des ke 1 Jan: selisih 1 hari, sah kembar', () => {
    const result = computeMultipleBirthRate([
      groupOf('F1', [[1999, 12, 31], [2000, 1, 1]]),
    ])
    expect(result.multipleBirths).toBe(2)
    // Lintas abad: abad anggota PERTAMA lahir (1999 => 1900). Base
    // dated abad 1900 hanya 1 birth (birth 2000 masuk abadnya),
    // sehingga share 2/1*100 = 200: konsekuensi aritmetika kontrak.
    expect(result.series[0].cells).toEqual([
      { centuryStart: 1900, sharePct: 200, count: 2 },
    ])
  })

  it('triplet transitif: A-B kembar, B-C kembar, A-C berjarak 2', () => {
    const result = computeMultipleBirthRate([
      groupOf('F1', [[1980, 5, 10], [1980, 5, 11], [1980, 5, 12]]),
    ])
    expect(result.multipleBirths).toBe(3)
    expect(result.series).toHaveLength(1)
    expect(result.series[0].multiplicity).toBe(3)
    expect(result.series[0].cells[0].count).toBe(3)
  })

  it('multiplicity 4: empat birth berantai berjarak 1 hari', () => {
    const result = computeMultipleBirthRate([
      fam('F1', b(2001, 3, 1), b(2001, 3, 2), b(2001, 3, 3), b(2001, 3, 4)),
    ])
    expect(result.series).toEqual([
      { multiplicity: 4, cells: [{ centuryStart: 2000, sharePct: 100, count: 4 }] },
    ])
  })

  it('tanggal parsial SAH dan dihitung undated', () => {
    const result = computeMultipleBirthRate([
      groupOf('F1', [[1980, 5, null], [1980, 5, 10]]),
      groupOf('F2', [[null, 5, 10]]),
    ])
    expect(result.totalBirths).toBe(3)
    expect(result.datedBirths).toBe(1)
    expect(result.multipleBirths).toBe(0)
    expect(result.series).toEqual([])
  })

  it('sharePct dibulatkan 1 desimal', () => {
    // 2 multiple births dari 7 dated births: 2/7*100 = 28.571 => 28.6
    // setelah pembulatan 1 desimal.
    const result = computeMultipleBirthRate([
      groupOf('F1', [[1980, 1, 1], [1980, 1, 1]]),
      groupOf('F2', [[1981, 1, 1]]),
      groupOf('F3', [[1982, 1, 1]]),
      groupOf('F4', [[1983, 1, 1]]),
      groupOf('F5', [[1984, 1, 1]]),
      groupOf('F6', [[1985, 1, 1]]),
    ])
    expect(result.datedBirths).toBe(7)
    expect(result.series[0].cells[0].sharePct).toBe(28.6)
  })

  it('multi-abad: cells hanya count > 0, urut centuryStart ascending', () => {
    const result = computeMultipleBirthRate([
      groupOf('F1', [[1850, 1, 1], [1850, 1, 1]]),
      groupOf('F2', [[2050, 1, 1], [2050, 1, 1]]),
      groupOf('F3', [[1950, 1, 1]]),
    ])
    expect(result.centuries).toEqual([
      { start: 1800, label: '1800-1899' },
      { start: 1900, label: '1900-1999' },
      { start: 2000, label: '2000-2099' },
    ])
    expect(result.series[0].cells.map((cell) => cell.centuryStart)).toEqual([1800, 2000])
  })

  it('determinisme: urutan array input tidak mengubah output', () => {
    const a = groupOf('F1', [[1980, 5, 10], [1980, 5, 11]])
    const c = groupOf('F3', [[1850, 1, 1], [1850, 1, 1]])
    const forward = computeMultipleBirthRate([a, c])
    const backward = computeMultipleBirthRate([c, a])
    expect(backward).toEqual(forward)
    // Nilai absolut ikut diverifikasi, bukan hanya relasi.
    expect(forward.series.map((entry) => entry.multiplicity)).toEqual([2])
  })

  it('family berbeda dengan birth bersamaan: TIDAK digabung', () => {
    const result = computeMultipleBirthRate([
      groupOf('F1', [[1980, 5, 10]]),
      groupOf('F2', [[1980, 5, 10]]),
    ])
    expect(result.multipleBirths).toBe(0)
    expect(result.series).toEqual([])
  })

  it('multiplicity 3 di dua abad berbeda masuk satu series', () => {
    const result = computeMultipleBirthRate([
      groupOf('F1', [[1900, 1, 1], [1900, 1, 1], [1900, 1, 2]]),
      groupOf('F2', [[2000, 1, 1], [2000, 1, 1], [2000, 1, 2]]),
    ])
    expect(result.series).toEqual([
      {
        multiplicity: 3,
        cells: [
          { centuryStart: 1900, sharePct: 100, count: 3 },
          { centuryStart: 2000, sharePct: 100, count: 3 },
        ],
      },
    ])
  })

  it('label abad memakai format start-start+99', () => {
    const result = computeMultipleBirthRate([groupOf('F1', [[2000, 1, 1]])])
    expect(result.centuries).toEqual([{ start: 2000, label: '2000-2099' }])
  })

  it('totalBirths mencakup semua birth termasuk undated', () => {
    const result = computeMultipleBirthRate([
      groupOf('F1', [[1980, 5, 10], [1980, 5, 10], [null, null, null]]),
    ])
    expect(result.totalBirths).toBe(3)
    expect(result.datedBirths).toBe(2)
    expect(result.multipleBirths).toBe(2)
  })
})
