import { describe, expect, it } from 'vitest'
import { computeRemarriageIntervals, parseRemarriageUnions } from './remarriage-interval'
import type { RemarriageUnionInput, StdDate } from './remarriage-interval'

function d(y: number, m: number, day: number): StdDate {
  return { dateKind: 'EXACT', yearStart: y, monthStart: m, dayStart: day }
}

function nd(y: number, m: number, day: number): StdDate {
  return { dateKind: 'ABOUT', yearStart: y, monthStart: m, dayStart: day }
}

function union(
  unionId: string,
  marr: StdDate | null,
  spouses: Array<{ id: string, sex: 'M' | 'F', death: StdDate | null }>,
): RemarriageUnionInput {
  return {
    unionId,
    marriageDate: marr,
    spouses: spouses.map((s) => ({ id: s.id, sex: s.sex, deathDate: s.death })),
  }
}

describe('remarriage interval v327 fase i', () => {
  it('1. input kosong: bands 7 entri nol tanpa throw', () => {
    const out = computeRemarriageIntervals([])
    expect(out.bands).toHaveLength(7)
    expect(out.bands.map((b) => b.band)).toEqual(['<6', '6-11', '12-23', '24-35', '36-47', '48-59', '60+'])
    expect(out.bands.every((b) => b.count === 0)).toBe(true)
    expect(out.survivorsTotal).toBe(0)
    expect(out.anomalies).toBe(0)
    expect(out.personsWithChains).toBe(0)
  })

  it('2. satu union: nihil rantai', () => {
    const out = computeRemarriageIntervals([
      union('u1', d(1990, 5, 10), [
        { id: 'p1', sex: 'M', death: null },
        { id: 'p2', sex: 'F', death: null },
      ]),
    ])
    expect(out.survivorsTotal).toBe(0)
    expect(out.personsWithChains).toBe(0)
  })

  it('3. rantai normal band 6-11', () => {
    const out = computeRemarriageIntervals([
      union('u1', d(1980, 1, 10), [
        { id: 'p1', sex: 'M', death: d(1985, 3, 15) },
        { id: 'p2', sex: 'F', death: null },
      ]),
      union('u2', d(1985, 12, 1), [
        { id: 'p2', sex: 'F', death: null },
        { id: 'p3', sex: 'M', death: null },
      ]),
    ])
    // DEAT p1 1985-03-15 ke MARR 1985-12-01: 8 bulan penuh.
    expect(out.bands.find((b) => b.band === '6-11')?.count).toBe(1)
    expect(out.survivorsTotal).toBe(1)
    expect(out.anomalies).toBe(0)
    expect(out.personsWithChains).toBe(1)
  })

  it('4. rantai band 60+', () => {
    const out = computeRemarriageIntervals([
      union('u1', d(1970, 1, 1), [
        { id: 'w1', sex: 'F', death: d(1970, 6, 1) },
        { id: 'm1', sex: 'M', death: null },
      ]),
      union('u2', d(2030, 6, 2), [
        { id: 'm1', sex: 'M', death: null },
        { id: 'w2', sex: 'F', death: null },
      ]),
    ])
    expect(out.bands.find((b) => b.band === '60+')?.count).toBe(1)
    expect(out.survivorsTotal).toBe(1)
  })

  it('5. dua rantai beda person', () => {
    const unions = [
      union('a1', d(1980, 1, 1), [
        { id: 'f1', sex: 'F', death: d(1980, 7, 1) },
        { id: 'm1', sex: 'M', death: null },
      ]),
      union('a2', d(1981, 2, 1), [
        { id: 'm1', sex: 'M', death: null },
        { id: 'f9', sex: 'F', death: null },
      ]),
      union('b1', d(1990, 1, 1), [
        { id: 'f2', sex: 'F', death: d(1990, 7, 1) },
        { id: 'm2', sex: 'M', death: null },
      ]),
      union('b2', d(1991, 2, 1), [
        { id: 'm2', sex: 'M', death: null },
        { id: 'f8', sex: 'F', death: null },
      ]),
    ]
    const out = computeRemarriageIntervals(unions)
    expect(out.survivorsTotal).toBe(2)
    expect(out.personsWithChains).toBe(2)
  })

  it('6. MARR non-EXACT gugur dari rantai', () => {
    const out = computeRemarriageIntervals([
      union('u1', d(1980, 1, 1), [
        { id: 'f1', sex: 'F', death: d(1980, 7, 1) },
        { id: 'm1', sex: 'M', death: null },
      ]),
      union('u2', nd(1981, 2, 1), [
        { id: 'm1', sex: 'M', death: null },
        { id: 'f9', sex: 'F', death: null },
      ]),
    ])
    expect(out.survivorsTotal).toBe(0)
    expect(out.personsWithChains).toBe(0)
  })

  it('7. DEAT non-EXACT gugur syarat', () => {
    const out = computeRemarriageIntervals([
      union('u1', d(1980, 1, 1), [
        { id: 'f1', sex: 'F', death: nd(1980, 7, 1) },
        { id: 'm1', sex: 'M', death: null },
      ]),
      union('u2', d(1981, 2, 1), [
        { id: 'm1', sex: 'M', death: null },
        { id: 'f9', sex: 'F', death: null },
      ]),
    ])
    expect(out.survivorsTotal).toBe(0)
  })

  it('8. anomali MARR sebelum DEAT masuk counter, tidak masuk band', () => {
    const out = computeRemarriageIntervals([
      union('u1', d(1980, 1, 1), [
        { id: 'f1', sex: 'F', death: d(1985, 7, 1) },
        { id: 'm1', sex: 'M', death: null },
      ]),
      union('u2', d(1984, 2, 1), [
        { id: 'm1', sex: 'M', death: null },
        { id: 'f9', sex: 'F', death: null },
      ]),
    ])
    expect(out.anomalies).toBe(1)
    expect(out.survivorsTotal).toBe(0)
    expect(out.personsWithChains).toBe(1)
  })

  it('9. satu person dua rantai beruntun', () => {
    const out = computeRemarriageIntervals([
      union('u1', d(1970, 1, 1), [
        { id: 'f1', sex: 'F', death: d(1970, 7, 1) },
        { id: 'm1', sex: 'M', death: null },
      ]),
      union('u2', d(1972, 1, 1), [
        { id: 'm1', sex: 'M', death: null },
        { id: 'f2', sex: 'F', death: d(1972, 7, 1) },
      ]),
      union('u3', d(1974, 1, 1), [
        { id: 'm1', sex: 'M', death: null },
        { id: 'f3', sex: 'F', death: null },
      ]),
    ])
    // Dua interval: u1->u2 dan u2->u3, keduanya 24 bulan penuh (1972-07-01
    // ke 1974-01-01 = 18 bulan; 1970-07-01 ke 1972-01-01 = 18 bulan).
    expect(out.survivorsTotal).toBe(2)
    expect(out.personsWithChains).toBe(1)
    expect(out.bands.find((b) => b.band === '12-23')?.count).toBe(2)
  })

  it('10. boundary tepat 6 bulan masuk 6-11, tepat 60 masuk 60+', () => {
    const six = [
      union('u1', d(1980, 1, 15), [
        { id: 'f1', sex: 'F', death: d(1980, 7, 15) },
        { id: 'm1', sex: 'M', death: null },
      ]),
      union('u2', d(1981, 1, 15), [
        { id: 'm1', sex: 'M', death: null },
        { id: 'f9', sex: 'F', death: null },
      ]),
    ]
    const outSix = computeRemarriageIntervals(six)
    expect(outSix.bands.find((b) => b.band === '6-11')?.count).toBe(1)
    const sixty = [
      union('v1', d(1970, 1, 1), [
        { id: 'f2', sex: 'F', death: d(1970, 6, 1) },
        { id: 'm2', sex: 'M', death: null },
      ]),
      union('v2', d(1975, 6, 1), [
        { id: 'm2', sex: 'M', death: null },
        { id: 'f8', sex: 'F', death: null },
      ]),
    ]
    const outSixty = computeRemarriageIntervals(sixty)
    expect(outSixty.bands.find((b) => b.band === '60+')?.count).toBe(1)
  })

  it('11. survivorsTotal dan anomalies konsisten dengan band', () => {
    const unions = [
      union('u1', d(1980, 1, 1), [
        { id: 'f1', sex: 'F', death: d(1980, 2, 1) },
        { id: 'm1', sex: 'M', death: null },
      ]),
      union('u2', d(1980, 9, 1), [
        { id: 'm1', sex: 'M', death: null },
        { id: 'f9', sex: 'F', death: null },
      ]),
      union('u3', d(1990, 1, 1), [
        { id: 'f2', sex: 'F', death: d(1990, 3, 1) },
        { id: 'm2', sex: 'M', death: null },
      ]),
      union('u4', d(1991, 6, 1), [
        { id: 'm2', sex: 'M', death: null },
        { id: 'f8', sex: 'F', death: null },
      ]),
      union('u5', d(2000, 1, 1), [
        { id: 'f3', sex: 'F', death: d(2005, 1, 1) },
        { id: 'm3', sex: 'M', death: null },
      ]),
      union('u6', d(2001, 1, 1), [
        { id: 'm3', sex: 'M', death: null },
        { id: 'f7', sex: 'F', death: null },
      ]),
    ]
    const out = computeRemarriageIntervals(unions)
    // m1: 1980-02-01 ke 1980-09-01 = 7 bulan -> 6-11.
    // m2: 1990-03-01 ke 1991-06-01 = 15 bulan -> 12-23.
    // m3: MARR 2001-01-01 sebelum DEAT 2005-01-01 -> anomali.
    expect(out.survivorsTotal).toBe(2)
    expect(out.anomalies).toBe(1)
    expect(out.bands.reduce((acc, b) => acc + b.count, 0)).toBe(out.survivorsTotal)
  })

  it('12. personsWithChains hitung person unik', () => {
    const out = computeRemarriageIntervals([
      union('u1', d(1980, 1, 1), [
        { id: 'f1', sex: 'F', death: d(1980, 7, 1) },
        { id: 'm1', sex: 'M', death: null },
      ]),
      union('u2', d(1981, 1, 1), [
        { id: 'm1', sex: 'M', death: null },
        { id: 'f2', sex: 'F', death: d(1981, 7, 1) },
      ]),
      union('u3', d(1982, 1, 1), [
        { id: 'f2', sex: 'F', death: null },
        { id: 'm9', sex: 'M', death: null },
      ]),
    ])
    // Hanya m1 yang punya interval; DEAT pasangan f2 (m1) null jadi
    // rantai f2 tidak membentuk interval (kontrak butir 3). 1 person.
    expect(out.personsWithChains).toBe(1)
  })

  it('13. urutan input diacak hasil identik', () => {
    const a = computeRemarriageIntervals([
      union('u1', d(1980, 1, 1), [
        { id: 'f1', sex: 'F', death: d(1980, 7, 1) },
        { id: 'm1', sex: 'M', death: null },
      ]),
      union('u2', d(1981, 2, 1), [
        { id: 'm1', sex: 'M', death: null },
        { id: 'f9', sex: 'F', death: null },
      ]),
      union('u3', d(1990, 1, 1), [
        { id: 'f2', sex: 'F', death: d(1990, 7, 1) },
        { id: 'm2', sex: 'M', death: null },
      ]),
      union('u4', d(1991, 2, 1), [
        { id: 'm2', sex: 'M', death: null },
        { id: 'f8', sex: 'F', death: null },
      ]),
    ])
    const b = computeRemarriageIntervals([
      union('u4', d(1991, 2, 1), [
        { id: 'm2', sex: 'M', death: null },
        { id: 'f8', sex: 'F', death: null },
      ]),
      union('u1', d(1980, 1, 1), [
        { id: 'f1', sex: 'F', death: d(1980, 7, 1) },
        { id: 'm1', sex: 'M', death: null },
      ]),
      union('u3', d(1990, 1, 1), [
        { id: 'f2', sex: 'F', death: d(1990, 7, 1) },
        { id: 'm2', sex: 'M', death: null },
      ]),
      union('u2', d(1981, 2, 1), [
        { id: 'm1', sex: 'M', death: null },
        { id: 'f9', sex: 'F', death: null },
      ]),
    ])
    expect(a).toEqual(b)
  })

  it('14. survivor tanpa pernikahan berikutnya nihil', () => {
    const out = computeRemarriageIntervals([
      union('u1', d(1980, 1, 1), [
        { id: 'f1', sex: 'F', death: d(1980, 7, 1) },
        { id: 'm1', sex: 'M', death: d(1999, 1, 1) },
      ]),
    ])
    expect(out.survivorsTotal).toBe(0)
    expect(out.anomalies).toBe(0)
    expect(out.personsWithChains).toBe(0)
  })

  it('15. parser strict: bukan array lempar Error', () => {
    expect(() => parseRemarriageUnions({})).toThrow()
    expect(() => parseRemarriageUnions([{ unionId: 'x' }])).toThrow(/spouses/)
    expect(() => parseRemarriageUnions([{ unionId: 'x', marriageDate: null, spouses: [{ id: 1, sex: 'M', deathDate: null }] }])).toThrow(/id/)
  })
})
