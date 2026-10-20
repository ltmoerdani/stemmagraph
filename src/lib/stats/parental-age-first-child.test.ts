import { describe, expect, it } from 'vitest'
import {
  computeParentalAgeFirstChildDistribution,
  parseFirstChildRecords,
  type FirstChildRecord,
} from './parental-age-first-child'

/** Tanggal EXACT lengkap dari tiga komponen. */
function d(y: number, m: number, dd: number) {
  return { dateKind: 'EXACT', yearStart: y, monthStart: m, dayStart: dd }
}

interface Ortu {
  id: string
  y: number
  m: number
  d: number
}

/** Ortu dengan tanggal EXACT lengkap. */
function ortu(o: Ortu) {
  return { id: o.id, birthDate: d(o.y, o.m, o.d) }
}

/** Record anak ringkas: child null berarti birthDate null. */
function rec(
  childId: string,
  child: { y: number; m: number; d: number } | null,
  father: Ortu | null,
  mother: Ortu | null,
): FirstChildRecord {
  return {
    childId,
    birthDate: child === null ? null : d(child.y, child.m, child.d),
    father: father === null ? null : ortu(father),
    mother: mother === null ? null : ortu(mother),
  }
}

describe('parental age at first child distribution (v329 fase i)', () => {
  it('kasus 1: input kosong, kedua seri kosong', () => {
    const out = computeParentalAgeFirstChildDistribution([])
    expect(out.father).toEqual({ bands: [], count: 0 })
    expect(out.mother).toEqual({ bands: [], count: 0 })
  })

  it('kasus 2: satu anak dengan father dan mother, band sesuai usia', () => {
    const out = computeParentalAgeFirstChildDistribution([
      rec('c1', { y: 1990, m: 6, d: 15 }, { id: 'f1', y: 1965, m: 3, d: 10 }, { id: 'm1', y: 1968, m: 9, d: 20 }),
    ])
    expect(out.father.count).toBe(1)
    expect(out.father.bands).toEqual([{ label: '25-29', count: 1 }])
    expect(out.mother.count).toBe(1)
    expect(out.mother.bands).toEqual([{ label: '20-24', count: 1 }])
  })

  it('kasus 3: first child bukan urutan input pertama (anak lebih awal di posisi kedua)', () => {
    const out = computeParentalAgeFirstChildDistribution([
      rec('c1', { y: 1995, m: 1, d: 1 }, { id: 'f1', y: 1970, m: 1, d: 1 }, null),
      rec('c0', { y: 1990, m: 1, d: 1 }, { id: 'f1', y: 1970, m: 1, d: 1 }, null),
    ])
    expect(out.father.count).toBe(1)
    expect(out.father.bands).toEqual([{ label: '20-24', count: 1 }])
  })

  it('kasus 4: tanggal lahir sama, tie-break childId ascending', () => {
    const out = computeParentalAgeFirstChildDistribution([
      rec('cz', { y: 1990, m: 5, d: 5 }, { id: 'f1', y: 1960, m: 1, d: 1 }, null),
      rec('ca', { y: 1990, m: 5, d: 5 }, { id: 'f1', y: 1955, m: 1, d: 1 }, null),
    ])
    expect(out.father.count).toBe(1)
    expect(out.father.bands).toEqual([{ label: '35-39', count: 1 }])
  })

  it('kasus 5: father null di semua record, seri father kosong seri mother terisi', () => {
    const out = computeParentalAgeFirstChildDistribution([
      rec('c1', { y: 1990, m: 1, d: 1 }, null, { id: 'm1', y: 1965, m: 1, d: 1 }),
    ])
    expect(out.father).toEqual({ bands: [], count: 0 })
    expect(out.mother.count).toBe(1)
  })

  it('kasus 6: birthDate anak dateKind bukan EXACT diabaikan dari seri', () => {
    const record: FirstChildRecord = {
      childId: 'c1',
      birthDate: { dateKind: 'ABOUT', yearStart: 1990, monthStart: 1, dayStart: 1 },
      father: { id: 'f1', birthDate: d(1965, 1, 1) },
      mother: null,
    }
    const out = computeParentalAgeFirstChildDistribution([record])
    expect(out.father).toEqual({ bands: [], count: 0 })
  })

  it('kasus 7: komponen tanggal parsial (monthStart null) diabaikan', () => {
    const record: FirstChildRecord = {
      childId: 'c1',
      birthDate: { dateKind: 'EXACT', yearStart: 1990, monthStart: null, dayStart: 1 },
      father: null,
      mother: { id: 'm1', birthDate: d(1965, 1, 1) },
    }
    const out = computeParentalAgeFirstChildDistribution([record])
    expect(out.mother).toEqual({ bands: [], count: 0 })
  })

  it('kasus 8: usia negatif (ortu lahir setelah anak) dibuang', () => {
    const out = computeParentalAgeFirstChildDistribution([
      rec('c1', { y: 1960, m: 1, d: 1 }, { id: 'f1', y: 1980, m: 1, d: 1 }, null),
    ])
    expect(out.father).toEqual({ bands: [], count: 0 })
  })

  it('kasus 9: band 5 tahun tepat untuk beberapa usia', () => {
    const out = computeParentalAgeFirstChildDistribution([
      rec('c1', { y: 1990, m: 6, d: 1 }, { id: 'f1', y: 1990, m: 5, d: 1 }, null),
      rec('c2', { y: 1990, m: 6, d: 1 }, { id: 'f2', y: 1985, m: 6, d: 1 }, null),
      rec('c3', { y: 1990, m: 6, d: 1 }, { id: 'f3', y: 1960, m: 6, d: 2 }, null),
      rec('c4', { y: 1990, m: 6, d: 1 }, { id: 'f4', y: 1960, m: 6, d: 1 }, null),
    ])
    expect(out.father.bands).toEqual([
      { label: '0-4', count: 1 },
      { label: '5-9', count: 1 },
      { label: '10-14', count: 0 },
      { label: '15-19', count: 0 },
      { label: '20-24', count: 0 },
      { label: '25-29', count: 1 },
      { label: '30-34', count: 1 },
    ])
    expect(out.father.count).toBe(4)
  })

  it('kasus 10: leading band nol terpangkas', () => {
    const out = computeParentalAgeFirstChildDistribution([
      rec('c1', { y: 2000, m: 1, d: 1 }, { id: 'f1', y: 1950, m: 1, d: 1 }, null),
      rec('c2', { y: 2000, m: 1, d: 1 }, { id: 'f2', y: 1975, m: 1, d: 1 }, null),
    ])
    expect(out.father.bands).toEqual([
      { label: '25-29', count: 1 },
      { label: '30-34', count: 0 },
      { label: '35-39', count: 0 },
      { label: '40-44', count: 0 },
      { label: '45-49', count: 0 },
      { label: '50-54', count: 1 },
    ])
  })

  it('kasus 11: trailing band nol terpangkas', () => {
    const out = computeParentalAgeFirstChildDistribution([
      rec('c1', { y: 2000, m: 1, d: 1 }, { id: 'f1', y: 1999, m: 1, d: 1 }, null),
      rec('c2', { y: 2000, m: 1, d: 1 }, { id: 'f2', y: 1970, m: 1, d: 2 }, null),
    ])
    expect(out.father.bands).toEqual([
      { label: '0-4', count: 1 },
      { label: '5-9', count: 0 },
      { label: '10-14', count: 0 },
      { label: '15-19', count: 0 },
      { label: '20-24', count: 0 },
      { label: '25-29', count: 1 },
    ])
  })

  it('kasus 12: band interior nol dipertahankan', () => {
    const out = computeParentalAgeFirstChildDistribution([
      rec('c1', { y: 2000, m: 1, d: 1 }, { id: 'f1', y: 1998, m: 1, d: 1 }, null),
      rec('c2', { y: 2000, m: 1, d: 1 }, { id: 'f2', y: 1950, m: 1, d: 1 }, null),
    ])
    expect(out.father.bands).toEqual([
      { label: '0-4', count: 1 },
      { label: '5-9', count: 0 },
      { label: '10-14', count: 0 },
      { label: '15-19', count: 0 },
      { label: '20-24', count: 0 },
      { label: '25-29', count: 0 },
      { label: '30-34', count: 0 },
      { label: '35-39', count: 0 },
      { label: '40-44', count: 0 },
      { label: '45-49', count: 0 },
      { label: '50-54', count: 1 },
    ])
  })

  it('kasus 13: dua seri independen penuh', () => {
    const out = computeParentalAgeFirstChildDistribution([
      rec('c1', { y: 1990, m: 1, d: 1 }, { id: 'f1', y: 1950, m: 1, d: 1 }, { id: 'm1', y: 1988, m: 1, d: 1 }),
      rec('c2', { y: 1992, m: 1, d: 1 }, null, { id: 'm2', y: 1940, m: 1, d: 1 }),
    ])
    expect(out.father.bands).toEqual([{ label: '40-44', count: 1 }])
    expect(out.father.count).toBe(1)
    expect(out.mother.bands).toEqual([
      { label: '0-4', count: 1 },
      { label: '5-9', count: 0 },
      { label: '10-14', count: 0 },
      { label: '15-19', count: 0 },
      { label: '20-24', count: 0 },
      { label: '25-29', count: 0 },
      { label: '30-34', count: 0 },
      { label: '35-39', count: 0 },
      { label: '40-44', count: 0 },
      { label: '45-49', count: 0 },
      { label: '50-54', count: 1 },
    ])
    expect(out.mother.count).toBe(2)
  })

  it('kasus 14: parser throw saat input bukan array', () => {
    expect(() => parseFirstChildRecords({})).toThrow(/parental-age-first-child/)
    expect(() => parseFirstChildRecords(42)).toThrow(/payload bukan array/)
  })

  it('kasus 15: parser throw saat elemen bukan objek, pesan ber-index', () => {
    expect(() => parseFirstChildRecords([{ childId: 'c1' }, 42])).toThrow(
      /parental-age-first-child record\[1\]/,
    )
  })

  it('kasus 16: parser throw saat childId hilang', () => {
    expect(() => parseFirstChildRecords([{ father: null, mother: null }])).toThrow(
      /record\[0\].childId: hilang atau bukan string/,
    )
  })
})
