import { describe, expect, it } from 'vitest'
import {
  durationDistribution,
  getMarriageDurationExtremes,
  longestMarriageRecord,
  parseMarriageDurationFamilies,
  shortestMarriageRecord,
} from './marriage-duration'

function d(y: number, m: number, day: number) {
  return { dateKind: 'EXACT', yearStart: y, monthStart: m, dayStart: day }
}
function approx(y: number, m: number, day: number) {
  return { dateKind: 'APPROXIMATE', yearStart: y, monthStart: m, dayStart: day }
}
function fam(familyId: string, marriage: ReturnType<typeof d>, extra: Partial<{ divorce: ReturnType<typeof d>; s1: ReturnType<typeof d>; s2: ReturnType<typeof d> }> = {}) {
  return {
    familyId,
    marriageDate: marriage,
    divorceDate: extra.divorce ?? null,
    spouse1DeathDate: extra.s1 ?? null,
    spouse2DeathDate: extra.s2 ?? null,
  }
}

describe('marriage duration extremes (v331 fase i)', () => {
  it('kasus 1: input kosong, distribusi 7 bucket kosong dan extremes nihil', () => {
    expect(durationDistribution([]).buckets).toHaveLength(7)
    expect(durationDistribution([]).buckets.every((b) => b.count === 0)).toBe(true)
    expect(longestMarriageRecord([])).toBeNull()
    expect(shortestMarriageRecord([])).toBeNull()
    expect(getMarriageDurationExtremes([])).toEqual({ shortest: [], longest: [] })
  })

  it('kasus 2: parser menerima string JSON dan array langsung', () => {
    const payload = JSON.stringify([fam('F1', d(2000, 1, 1))])
    expect(parseMarriageDurationFamilies(payload)).toHaveLength(1)
    expect(parseMarriageDurationFamilies([fam('F1', d(2000, 1, 1))])).toHaveLength(1)
  })

  it('kasus 3: throw payload bukan array', () => {
    expect(() => parseMarriageDurationFamilies('bukan json')).toThrow()
    expect(() => parseMarriageDurationFamilies(42)).toThrow()
    expect(() => parseMarriageDurationFamilies({})).toThrow()
  })

  it('kasus 4: throw elemen bukan objek', () => {
    expect(() => parseMarriageDurationFamilies([null])).toThrow()
    expect(() => parseMarriageDurationFamilies(['x'])).toThrow()
    expect(() => parseMarriageDurationFamilies([5])).toThrow()
  })

  it('kasus 5: throw familyId hilang dan marriageDate hilang', () => {
    expect(() => parseMarriageDurationFamilies([{ marriageDate: d(2000, 1, 1) }])).toThrow()
    expect(() => parseMarriageDurationFamilies([{ familyId: 'F1' }])).toThrow()
  })

  it('kasus 6: marriageDate non-EXACT atau parsial, record dibuang diam dari distribusi dan extremes', () => {
    const rows = [
      fam('F1', approx(2000, 1, 1), { divorce: d(2010, 1, 1) }),
      fam('F2', { dateKind: 'EXACT', yearStart: 2000, monthStart: null, dayStart: 1 }, { divorce: d(2010, 1, 1) }),
    ]
    expect(durationDistribution(rows).buckets.every((b) => b.count === 0)).toBe(true)
    expect(longestMarriageRecord(rows)).toBeNull()
  })

  it('kasus 7: tepi bucket, years 0 masuk 0-9, 60 dan 61 masuk 60+', () => {
    const rows = [
      fam('F0', d(2000, 1, 1), { divorce: d(2000, 7, 1) }),
      fam('F60', d(2000, 1, 1), { divorce: d(2060, 1, 1) }),
      fam('F61', d(2000, 1, 1), { divorce: d(2061, 1, 1) }),
    ]
    const b = durationDistribution(rows).buckets
    expect(b.find((x) => x.band === '0-9')?.count).toBe(1)
    expect(b.find((x) => x.band === '50-59')?.count).toBe(0)
    expect(b.find((x) => x.band === '60+')?.count).toBe(2)
  })

  it('kasus 8: end tepat anniversary menghasilkan years bulat penuh', () => {
    const row = fam('F1', d(2000, 3, 15), { divorce: d(2020, 3, 15) })
    expect(longestMarriageRecord([row])?.years).toBe(20)
  })

  it('kasus 9: end sebelum atau sama dengan MARR bukan kandidat', () => {
    const rows = [
      fam('F1', d(2000, 1, 1), { divorce: d(1999, 1, 1) }),
      fam('F2', d(2000, 1, 1), { s1: d(2000, 1, 1) }),
    ]
    expect(durationDistribution(rows).buckets.every((x) => x.count === 0)).toBe(true)
    expect(longestMarriageRecord(rows)).toBeNull()
  })

  it('kasus 10: DIV lebih besar dari death, endReason tetap death (kandidat terkecil)', () => {
    const row = fam('F1', d(2000, 1, 1), { divorce: d(2015, 1, 1), s1: d(2005, 1, 1), s2: d(2012, 1, 1) })
    expect(longestMarriageRecord([row])?.endReason).toBe('death')
    expect(longestMarriageRecord([row])?.years).toBe(5)
  })

  it('kasus 11: tanpa kandidat end, record digugur; DIV non-EXACT diperlakukan null', () => {
    const rows = [
      fam('F1', d(2000, 1, 1)),
      fam('F2', d(2000, 1, 1), { divorce: approx(2010, 1, 1) }),
    ]
    expect(durationDistribution(rows).buckets.every((x) => x.count === 0)).toBe(true)
    expect(getMarriageDurationExtremes(rows)).toEqual({ shortest: [], longest: [] })
  })

  it('kasus 12: tie-break years sama, familyId terkecil menang di longest', () => {
    const rows = [
      fam('FZ', d(2000, 1, 1), { divorce: d(2020, 1, 1) }),
      fam('FA', d(2000, 1, 1), { divorce: d(2020, 1, 2) }),
    ]
    expect(longestMarriageRecord(rows)?.familyId).toBe('FA')
  })

  it('kasus 13: cap 90 tahun, years 91 digugur dari longest dan extremes', () => {
    const rows = [
      fam('F91', d(1900, 1, 1), { divorce: d(1991, 1, 1) }),
      fam('F30', d(2000, 1, 1), { divorce: d(2030, 1, 1) }),
    ]
    expect(longestMarriageRecord(rows)?.familyId).toBe('F30')
    expect(getMarriageDurationExtremes(rows, 3).longest.map((x) => x.familyId)).toEqual(['F30'])
  })

  it('kasus 14: shortest memakai satuan hari, days 0 digugur', () => {
    const rows = [
      fam('F1', d(2000, 1, 1), { divorce: d(2000, 1, 1) }),
      fam('F2', d(2000, 1, 1), { divorce: d(2000, 1, 11) }),
      fam('F3', d(2000, 1, 1), { divorce: d(2000, 1, 21) }),
    ]
    const sh = shortestMarriageRecord(rows)
    expect(sh?.familyId).toBe('F2')
    expect(sh?.days).toBe(10)
    expect(sh?.years).toBe(0)
  })

  it('kasus 15: top-N tanpa duplikasi familyId di dua kolom, prioritas longest', () => {
    const rows = [
      fam('F1', d(2000, 1, 1), { divorce: d(2030, 1, 1) }),
      fam('F2', d(2000, 1, 1), { divorce: d(2000, 1, 5) }),
      fam('F3', d(2000, 1, 1), { divorce: d(2000, 1, 9) }),
    ]
    const ex = getMarriageDurationExtremes(rows, 2)
    const ids = [...ex.shortest.map((x) => x.familyId), ...ex.longest.map((x) => x.familyId)]
    expect(new Set(ids).size).toBe(ids.length)
    expect(ex.longest[0]?.familyId).toBe('F1')
    expect(ex.shortest.map((x) => x.familyId)).not.toContain('F1')
    expect(ex.shortest.map((x) => x.familyId)).toEqual(['F2', 'F3'])
  })

  it('kasus 16: spesifik endReason divorce persis kandidat terkecil', () => {
    const row = fam('F1', d(2000, 1, 1), { divorce: d(2010, 1, 1), s2: d(2020, 1, 1) })
    expect(longestMarriageRecord([row])?.endReason).toBe('divorce')
  })
})
