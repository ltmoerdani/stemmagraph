import { describe, expect, it } from 'vitest'
import {
  computeMarriageAgeExtremes,
  type MarriageAgeExtremesPair,
} from './marriage-age-extremes'

function d(y: number, m: number, day: number) {
  return { dateKind: 'EXACT', yearStart: y, monthStart: m, dayStart: day }
}
function about(y: number, m: number, day: number) {
  return { dateKind: 'ABOUT', yearStart: y, monthStart: m, dayStart: day }
}
function spouse(id: string, sex: string, birth: ReturnType<typeof d> | ReturnType<typeof about> | null) {
  return { id, sex, birthDate: birth }
}
function pair(
  pairId: string,
  a: ReturnType<typeof spouse>,
  b: ReturnType<typeof spouse>,
  marriage: ReturnType<typeof d> | ReturnType<typeof about> | null,
): MarriageAgeExtremesPair {
  return { pairId, spouseA: a, spouseB: b, marriageDate: marriage }
}

describe('marriage age extremes (v362 fase i)', () => {
  it('kasus 1: input kosong, empat kuadran null dan count nol', () => {
    expect(computeMarriageAgeExtremes([])).toEqual({
      youngestMale: null,
      oldestMale: null,
      youngestFemale: null,
      oldestFemale: null,
      validSpouseCount: { male: 0, female: 0 },
    })
  })

  it('kasus 2: happy path, empat kuadran terisi dan count benar', () => {
    const rows = [
      pair('P1', spouse('I-m1', 'M', d(1990, 5, 10)), spouse('I-f1', 'F', d(1992, 3, 20)), d(2015, 6, 1)),
      pair('P2', spouse('I-m2', 'M', d(1980, 1, 2)), spouse('I-f2', 'F', d(2000, 12, 31)), d(2020, 8, 15)),
    ]
    const r = computeMarriageAgeExtremes(rows)
    expect(r.youngestMale).toEqual({ xref: 'I-m1', pairId: 'P1', age: 25 })
    expect(r.oldestMale).toEqual({ xref: 'I-m2', pairId: 'P2', age: 40 })
    expect(r.youngestFemale).toEqual({ xref: 'I-f2', pairId: 'P2', age: 19 })
    expect(r.oldestFemale).toEqual({ xref: 'I-f1', pairId: 'P1', age: 23 })
    expect(r.validSpouseCount).toEqual({ male: 2, female: 2 })
  })

  it('kasus 3: birth parsial (bulan null), spouse itu skip dan pasangannya tetap dinilai', () => {
    const rows = [
      pair('P1', spouse('I-m1', 'M', { dateKind: 'EXACT', yearStart: 1990, monthStart: null, dayStart: 10 }), spouse('I-f1', 'F', d(1992, 3, 20)), d(2015, 6, 1)),
    ]
    const r = computeMarriageAgeExtremes(rows)
    expect(r.youngestMale).toBeNull()
    expect(r.youngestFemale).toEqual({ xref: 'I-f1', pairId: 'P1', age: 23 })
    expect(r.validSpouseCount).toEqual({ male: 0, female: 1 })
  })

  it('kasus 4: birth non-EXACT (ABOUT) menggugurkan spouse itu saja', () => {
    const rows = [
      pair('P1', spouse('I-m1', 'M', about(1990, 5, 10)), spouse('I-f1', 'F', d(1992, 3, 20)), d(2015, 6, 1)),
    ]
    const r = computeMarriageAgeExtremes(rows)
    expect(r.youngestMale).toBeNull()
    expect(r.oldestFemale).toEqual({ xref: 'I-f1', pairId: 'P1', age: 23 })
    expect(r.validSpouseCount).toEqual({ male: 0, female: 1 })
  })

  it('kasus 5: birth null (hilang), spouse skip dan pasangannya tetap dinilai', () => {
    const rows = [
      pair('P1', spouse('I-m1', 'M', null), spouse('I-f1', 'F', d(1992, 3, 20)), d(2015, 6, 1)),
    ]
    const r = computeMarriageAgeExtremes(rows)
    expect(r.youngestMale).toBeNull()
    expect(r.youngestFemale).toEqual({ xref: 'I-f1', pairId: 'P1', age: 23 })
  })

  it('kasus 6: usia negatif (lahir setelah menikah), spouse digugur sendirian', () => {
    const rows = [
      pair('P1', spouse('I-m1', 'M', d(2020, 1, 1)), spouse('I-f1', 'F', d(1992, 3, 20)), d(2015, 6, 1)),
    ]
    const r = computeMarriageAgeExtremes(rows)
    expect(r.youngestMale).toBeNull()
    expect(r.oldestFemale).toEqual({ xref: 'I-f1', pairId: 'P1', age: 23 })
    expect(r.validSpouseCount).toEqual({ male: 0, female: 1 })
  })

  it('kasus 7: marriageDate non-EXACT atau null, kedua spouse pasangan itu skip', () => {
    const rows = [
      pair('P1', spouse('I-m1', 'M', d(1990, 5, 10)), spouse('I-f1', 'F', d(1992, 3, 20)), about(2015, 6, 1)),
      pair('P2', spouse('I-m2', 'M', d(1985, 7, 7)), spouse('I-f2', 'F', d(1990, 9, 9)), null),
      pair('P3', spouse('I-m3', 'M', d(1988, 8, 8)), spouse('I-f3', 'F', d(1991, 2, 2)), d(2012, 2, 2)),
    ]
    const r = computeMarriageAgeExtremes(rows)
    expect(r.youngestMale).toEqual({ xref: 'I-m3', pairId: 'P3', age: 23 })
    expect(r.oldestFemale).toEqual({ xref: 'I-f3', pairId: 'P3', age: 21 })
    expect(r.validSpouseCount).toEqual({ male: 1, female: 1 })
  })

  it('kasus 8: pemisahan sex, kandidat M tidak menodai kuadran F dan sebaliknya', () => {
    const rows = [
      pair('P1', spouse('I-m1', 'M', d(1990, 1, 1)), spouse('I-m2', 'M', d(1995, 1, 1)), d(2015, 1, 1)),
    ]
    const r = computeMarriageAgeExtremes(rows)
    expect(r.youngestMale).toEqual({ xref: 'I-m2', pairId: 'P1', age: 20 })
    expect(r.oldestMale).toEqual({ xref: 'I-m1', pairId: 'P1', age: 25 })
    expect(r.youngestFemale).toBeNull()
    expect(r.oldestFemale).toBeNull()
    expect(r.validSpouseCount).toEqual({ male: 2, female: 0 })
  })

  it('kasus 9: tie-break age sama, pairId ascending menang di youngest dan oldest', () => {
    const rows = [
      pair('PZ', spouse('I-m1', 'M', d(1990, 1, 1)), spouse('I-f1', 'F', d(1990, 1, 1)), d(2010, 1, 1)),
      pair('PB', spouse('I-m2', 'M', d(1990, 1, 1)), spouse('I-f2', 'F', d(1990, 1, 1)), d(2010, 1, 1)),
    ]
    const r = computeMarriageAgeExtremes(rows)
    expect(r.youngestMale).toEqual({ xref: 'I-m2', pairId: 'PB', age: 20 })
    expect(r.oldestMale).toEqual({ xref: 'I-m2', pairId: 'PB', age: 20 })
    expect(r.youngestFemale?.pairId).toBe('PB')
  })

  it('kasus 10: tie-break pairId sama, xref ascending menang', () => {
    const rows = [
      pair('P1', spouse('I-z', 'M', d(1990, 1, 1)), spouse('I-a', 'M', d(1990, 1, 1)), d(2010, 1, 1)),
    ]
    const r = computeMarriageAgeExtremes(rows)
    expect(r.youngestMale?.xref).toBe('I-a')
    expect(r.oldestMale?.xref).toBe('I-a')
  })

  it('kasus 11: satu orang multi-pernikahan jadi kandidat terpisah di tiap entry', () => {
    const rows = [
      pair('P2', spouse('I-m1', 'M', d(1980, 1, 1)), spouse('I-f1', 'F', d(1985, 1, 1)), d(2000, 1, 1)),
      pair('P1', spouse('I-m1', 'M', d(1980, 1, 1)), spouse('I-f2', 'F', d(1990, 1, 1)), d(2020, 1, 1)),
    ]
    const r = computeMarriageAgeExtremes(rows)
    expect(r.youngestMale).toEqual({ xref: 'I-m1', pairId: 'P2', age: 20 })
    expect(r.oldestMale).toEqual({ xref: 'I-m1', pairId: 'P1', age: 40 })
    expect(r.validSpouseCount.male).toBe(2)
    expect(r.validSpouseCount.female).toBe(2)
  })

  it('kasus 12: boundary anniversary tepas hari menghasilkan tahun penuh', () => {
    const rows = [
      pair('P1', spouse('I-m1', 'M', d(1990, 5, 10)), spouse('I-f1', 'F', d(1990, 5, 10)), d(2010, 5, 10)),
      pair('P2', spouse('I-m2', 'M', d(1990, 5, 11)), spouse('I-f2', 'F', d(1990, 5, 11)), d(2010, 5, 10)),
    ]
    const r = computeMarriageAgeExtremes(rows)
    expect(r.youngestMale).toEqual({ xref: 'I-m2', pairId: 'P2', age: 19 })
    expect(r.oldestMale).toEqual({ xref: 'I-m1', pairId: 'P1', age: 20 })
    expect(r.youngestFemale).toEqual({ xref: 'I-f2', pairId: 'P2', age: 19 })
  })

  it('kasus 13: usia nol (menikah di hari lahir) tetap valid', () => {
    const rows = [
      pair('P1', spouse('I-f1', 'F', d(2000, 1, 1)), spouse('I-m1', 'M', d(2000, 1, 1)), d(2000, 1, 1)),
    ]
    const r = computeMarriageAgeExtremes(rows)
    expect(r.youngestMale).toEqual({ xref: 'I-m1', pairId: 'P1', age: 0 })
    expect(r.oldestFemale).toEqual({ xref: 'I-f1', pairId: 'P1', age: 0 })
    expect(r.validSpouseCount).toEqual({ male: 1, female: 1 })
  })

  it('kasus 14: sex selain M dan F tidak masuk kuadran maupun count', () => {
    const rows = [
      pair('P1', spouse('I-x1', 'X', d(1990, 1, 1)), spouse('I-u1', 'U', d(1990, 1, 1)), d(2010, 1, 1)),
    ]
    const r = computeMarriageAgeExtremes(rows)
    expect(r.youngestMale).toBeNull()
    expect(r.oldestMale).toBeNull()
    expect(r.youngestFemale).toBeNull()
    expect(r.oldestFemale).toBeNull()
    expect(r.validSpouseCount).toEqual({ male: 0, female: 0 })
  })

  it('kasus 15: komponen tanggal di luar rentang (bulan 13, hari 32) digugur', () => {
    const rows = [
      pair('P1', spouse('I-m1', 'M', { dateKind: 'EXACT', yearStart: 1990, monthStart: 13, dayStart: 1 }), spouse('I-f1', 'F', { dateKind: 'EXACT', yearStart: 1990, monthStart: 1, dayStart: 32 }), d(2010, 1, 1)),
      pair('P2', spouse('I-m2', 'M', d(1990, 1, 1)), spouse('I-f2', 'F', d(1990, 12, 31)), { dateKind: 'EXACT', yearStart: 2010, monthStart: 13, dayStart: 1 }),
    ]
    const r = computeMarriageAgeExtremes(rows)
    expect(r.youngestMale).toBeNull()
    expect(r.oldestFemale).toBeNull()
    expect(r.validSpouseCount).toEqual({ male: 0, female: 0 })
  })

  it('kasus 16: urutan input acak tidak mengubah hasil (determinisme)', () => {
    const rows = [
      pair('P3', spouse('I-m1', 'M', d(1970, 1, 1)), spouse('I-f1', 'F', d(1975, 1, 1)), d(1990, 1, 1)),
      pair('P1', spouse('I-m2', 'M', d(1980, 1, 1)), spouse('I-f2', 'F', d(1985, 1, 1)), d(2000, 1, 1)),
      pair('P2', spouse('I-m3', 'M', d(1975, 1, 1)), spouse('I-f3', 'F', d(1980, 1, 1)), d(1995, 1, 1)),
    ]
    const a = computeMarriageAgeExtremes(rows)
    const b = computeMarriageAgeExtremes([...rows].reverse())
    expect(a).toEqual(b)
    expect(a.oldestMale).toEqual({ xref: 'I-m2', pairId: 'P1', age: 20 })
    expect(a.youngestFemale).toEqual({ xref: 'I-f2', pairId: 'P1', age: 15 })
  })
})
