import { describe, expect, it } from 'vitest'
import {
  BIRTH_HEATMAP_PERIOD_SPAN,
  computeBirthHeatmap,
  parseBirthHeatmapEntries,
  type BirthHeatmapPayload,
} from './birth-heatmap'

function fullPipe(raw: unknown): BirthHeatmapPayload {
  return computeBirthHeatmap(parseBirthHeatmapEntries(raw))
}

describe('boundary periode 25 tahun', () => {
  it('tahun 1949 masuk periode 1925-1949', () => {
    const out = fullPipe([{ yearStart: 1949, monthStart: 6 }])
    expect(out.periods).toEqual([{ start: 1925, label: '1925-1949' }])
  })

  it('tahun 1950 masuk periode 1950-1974, span 25 dan tuple months tetap', () => {
    expect(BIRTH_HEATMAP_PERIOD_SPAN).toBe(25)
    const out = fullPipe([{ yearStart: 1950, monthStart: 3 }])
    expect(out.periods).toEqual([{ start: 1950, label: '1950-1974' }])
    expect(out.months).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
  })
})

describe('domain bulan', () => {
  it('bulan 1 masuk matriks kolom pertama', () => {
    const out = fullPipe([{ yearStart: 1960, monthStart: 1 }])
    expect(out.matrix).toEqual([[1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]])
  })

  it('bulan 12 masuk matriks kolom terakhir', () => {
    const out = fullPipe([{ yearStart: 1960, monthStart: 12 }])
    expect(out.matrix).toEqual([[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1]])
  })

  it('bulan 0 invalid, dihitung invalidDates', () => {
    const out = fullPipe([{ yearStart: 1960, monthStart: 0 }])
    expect(out.validDates).toBe(0)
    expect(out.invalidDates).toBe(1)
    expect(out.periods).toEqual([])
  })

  it('bulan 13 invalid, dihitung invalidDates', () => {
    const out = fullPipe([{ yearStart: 1960, monthStart: 13 }])
    expect(out.validDates).toBe(0)
    expect(out.invalidDates).toBe(1)
  })
})

describe('domain tahun', () => {
  it('yearStart null invalid', () => {
    const out = fullPipe([{ yearStart: null, monthStart: 5 }])
    expect(out.invalidDates).toBe(1)
    expect(out.validDates).toBe(0)
  })

  it('monthStart null invalid', () => {
    const out = fullPipe([{ yearStart: 1960, monthStart: null }])
    expect(out.invalidDates).toBe(1)
  })

  it('yearStart 0 invalid (guard BCE)', () => {
    const out = fullPipe([{ yearStart: 0, monthStart: 5 }])
    expect(out.invalidDates).toBe(1)
  })

  it('yearStart negatif invalid (guard BCE)', () => {
    const out = fullPipe([{ yearStart: -50, monthStart: 5 }])
    expect(out.invalidDates).toBe(1)
  })
})

describe('parser strict', () => {
  it('payload bukan array melempar Error', () => {
    expect(() => parseBirthHeatmapEntries({ yearStart: 1960 })).toThrow(Error)
  })

  it('elemen bukan objek melempar Error dengan indeks', () => {
    expect(() => parseBirthHeatmapEntries([{ yearStart: 1960, monthStart: 5 }, 42])).toThrow(
      'entry[1]'
    )
  })

  it('tipe field salah melempar Error dengan nama field di pesan', () => {
    expect(() => parseBirthHeatmapEntries([{ yearStart: '1960', monthStart: 5 }])).toThrow(
      'yearStart'
    )
    expect(() => parseBirthHeatmapEntries([{ yearStart: 1960, monthStart: true }])).toThrow(
      'monthStart'
    )
  })
})

describe('bentuk output', () => {
  it('input kosong tetap payload utuh tanpa throw', () => {
    const out = fullPipe([])
    expect(out).toEqual({
      months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      periods: [],
      matrix: [],
      validDates: 0,
      invalidDates: 0,
    })
  })

  it('semua invalid tetap payload utuh dengan invalidDates N', () => {
    const out = fullPipe([
      { yearStart: null, monthStart: null },
      { yearStart: 1960, monthStart: 0 },
    ])
    expect(out.periods).toEqual([])
    expect(out.matrix).toEqual([])
    expect(out.invalidDates).toBe(2)
  })

  it('multi periode urut ascending by start, baris matrix sejajar periods', () => {
    const out = fullPipe([
      { yearStart: 1960, monthStart: 4 },
      { yearStart: 1901, monthStart: 2 },
      { yearStart: 1999, monthStart: 11 },
    ])
    expect(out.periods.map((p) => p.start)).toEqual([1900, 1950, 1975])
    expect(out.periods.map((p) => p.label)).toEqual(['1900-1924', '1950-1974', '1975-1999'])
    expect(out.matrix).toEqual([
      [0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0],
    ])
    expect(out.validDates).toBe(3)
  })
})

describe('agregat dan determinisme', () => {
  it('hitungan agregat benar untuk kasus campur valid dan invalid', () => {
    const out = fullPipe([
      { yearStart: 1955, monthStart: 7 },
      { yearStart: 1955, monthStart: 7 },
      { yearStart: 1973, monthStart: 7 },
      { yearStart: 1955, monthStart: 2 },
      { yearStart: 1949, monthStart: 7 },
      { yearStart: null, monthStart: 7 },
      { yearStart: 1955, monthStart: 13 },
    ])
    expect(out.validDates).toBe(5)
    expect(out.invalidDates).toBe(2)
    expect(out.periods.map((p) => p.start)).toEqual([1925, 1950])
    expect(out.matrix[1][6]).toBe(3)
    expect(out.matrix[1][1]).toBe(1)
    expect(out.matrix[0][6]).toBe(1)
  })

  it('determinisme: dua run identik meski urutan input diacak', () => {
    const a = [
      { yearStart: 1910, monthStart: 9 },
      { yearStart: 1985, monthStart: 1 },
      { yearStart: 1961, monthStart: 12 },
    ]
    const b = [a[2], a[0], a[1]]
    expect(fullPipe(b)).toEqual(fullPipe(a))
  })
})
