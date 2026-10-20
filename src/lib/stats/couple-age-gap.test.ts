import { describe, expect, it } from 'vitest'
import {
  COUPLE_AGE_GAP_BANDS,
  computeCoupleAgeGapDistribution,
  parseCoupleAgeGapPairs,
  type CoupleAgeGapDistribution,
  type CoupleAgeGapPair,
} from './couple-age-gap'

/** Pasangan EXACT lengkap; komponen bebas karena gap dihitung per tahun. */
function pair(
  pairId: string,
  yearA: number | null,
  yearB: number | null,
  opts: { kindA?: string; kindB?: string; dropMonthA?: boolean } = {},
): CoupleAgeGapPair {
  return {
    pairId,
    spouseA: {
      id: `A-${pairId}`,
      birthDate:
        yearA === null
          ? null
          : {
              dateKind: opts.kindA ?? 'EXACT',
              yearStart: yearA,
              monthStart: opts.dropMonthA === true ? null : 3,
              dayStart: 14,
            },
    },
    spouseB: {
      id: `B-${pairId}`,
      birthDate:
        yearB === null
          ? null
          : {
              dateKind: opts.kindB ?? 'EXACT',
              yearStart: yearB,
              monthStart: 7,
              dayStart: 2,
            },
    },
  }
}

function expectAllZeroExcept(
  dist: CoupleAgeGapDistribution,
  band: (typeof COUPLE_AGE_GAP_BANDS)[number],
  field: 'left' | 'right' | 'equal',
  value: number,
): void {
  for (const key of COUPLE_AGE_GAP_BANDS) {
    for (const f of ['left', 'right', 'equal'] as const) {
      const expected = key === band && f === field ? value : 0
      expect(dist[key][f]).toBe(expected)
    }
  }
}

describe('computeCoupleAgeGapDistribution v318 fase i', () => {
  it('array kosong menghasilkan 6 band semua nol, BUKAN null', () => {
    const dist = computeCoupleAgeGapDistribution([])
    expect(Object.keys(dist)).toEqual([...COUPLE_AGE_GAP_BANDS])
    expectAllZeroExcept(dist, '0-2', 'left', 0)
  })

  it('suami lebih tua gap 1 masuk band 0-2 left', () => {
    const dist = computeCoupleAgeGapDistribution([pair('p1', 1980, 1981)])
    expectAllZeroExcept(dist, '0-2', 'left', 1)
  })

  it('istri lebih tua gap 4 masuk band 3-5 right', () => {
    const dist = computeCoupleAgeGapDistribution([pair('p1', 1984, 1980)])
    expectAllZeroExcept(dist, '3-5', 'right', 1)
  })

  it('boundary tepat 2: suami lebih tua band 0-2 left', () => {
    const dist = computeCoupleAgeGapDistribution([pair('p1', 1980, 1982)])
    expectAllZeroExcept(dist, '0-2', 'left', 1)
  })

  it('boundary tepat 3: band 3-5 left', () => {
    const dist = computeCoupleAgeGapDistribution([pair('p1', 1980, 1983)])
    expectAllZeroExcept(dist, '3-5', 'left', 1)
  })

  it('boundary tepat 10: band 6-10 left', () => {
    const dist = computeCoupleAgeGapDistribution([pair('p1', 1980, 1990)])
    expectAllZeroExcept(dist, '6-10', 'left', 1)
  })

  it('boundary tepat 11: band 11-15 right', () => {
    const dist = computeCoupleAgeGapDistribution([pair('p1', 1991, 1980)])
    expectAllZeroExcept(dist, '11-15', 'right', 1)
  })

  it('boundary tepat 20: band 16-20 right', () => {
    const dist = computeCoupleAgeGapDistribution([pair('p1', 2000, 1980)])
    expectAllZeroExcept(dist, '16-20', 'right', 1)
  })

  it('boundary tepat 21: band 21+ left', () => {
    const dist = computeCoupleAgeGapDistribution([pair('p1', 1980, 2001)])
    expectAllZeroExcept(dist, '21+', 'left', 1)
  })

  it('equal: tahun lahir sama masuk band 0-2 field equal, bukan left/right', () => {
    const dist = computeCoupleAgeGapDistribution([pair('p1', 1985, 1985)])
    expectAllZeroExcept(dist, '0-2', 'equal', 1)
  })

  it('pasangan dengan birthDate null di-skip', () => {
    const dist = computeCoupleAgeGapDistribution([pair('p1', null, 1985)])
    expectAllZeroExcept(dist, '0-2', 'left', 0)
  })

  it('pasangan dengan dateKind ABOUT di-skip, pasangan EXACT lain tetap dihitung', () => {
    const dist = computeCoupleAgeGapDistribution([pair('p1', 1980, 1983, { kindB: 'ABOUT' }), pair('p2', 1970, 1972)])
    expectAllZeroExcept(dist, '0-2', 'left', 1)
  })

  it('pasangan dengan komponen bulan null di-skip', () => {
    const dist = computeCoupleAgeGapDistribution([pair('p1', 1980, 1983, { dropMonthA: true })])
    expectAllZeroExcept(dist, '0-2', 'left', 0)
  })

  it('pasangan dengan yearStart 0 di-skip (guard BCE/domain)', () => {
    const dist = computeCoupleAgeGapDistribution([pair('p1', 0, 1983)])
    expectAllZeroExcept(dist, '0-2', 'left', 0)
  })

  it('deterministik: urutan input diacak hasil sama', () => {
    const input = [pair('p3', 1980, 1983), pair('p1', 1991, 1980), pair('p2', 1985, 1985)]
    const shuffled = [input[2], input[0], input[1]]
    expect(computeCoupleAgeGapDistribution(shuffled)).toEqual(computeCoupleAgeGapDistribution(input))
  })

  it('agregasi campuran dua band sekaligus', () => {
    const input = [pair('p1', 1980, 1982), pair('p2', 2000, 1980), pair('p3', 1970, 1995)]
    const dist = computeCoupleAgeGapDistribution(input)
    expect(dist['0-2'].left).toBe(1)
    expect(dist['16-20'].right).toBe(1)
    expect(dist['21+'].left).toBe(1)
  })
})

describe('parseCoupleAgeGapPairs strict parser v318', () => {
  it('menerima array objek valid', () => {
    const pairs = parseCoupleAgeGapPairs([
      { pairId: 'p1', spouseA: { id: 'a', birthDate: null }, spouseB: { id: 'b', birthDate: null } },
    ])
    expect(pairs).toHaveLength(1)
    expect(pairs[0].pairId).toBe('p1')
  })

  it('menerima string JSON valid', () => {
    const json = JSON.stringify([
      { pairId: 'p1', spouseA: { id: 'a', birthDate: { dateKind: 'EXACT', yearStart: 1980, monthStart: 1, dayStart: 1 } }, spouseB: { id: 'b', birthDate: null } },
    ])
    const pairs = parseCoupleAgeGapPairs(json)
    expect(pairs[0].spouseA.birthDate?.yearStart).toBe(1980)
  })

  it('LEMPAR saat payload bukan array', () => {
    expect(() => parseCoupleAgeGapPairs({ nope: true })).toThrow(/bukan array/)
  })

  it('LEMPAR saat pairId hilang (indeks dan field disebut)', () => {
    const bad = [{ spouseA: { id: 'a', birthDate: null }, spouseB: { id: 'b', birthDate: null } }]
    expect(() => parseCoupleAgeGapPairs(bad)).toThrow(/pair\[0\]\.pairId/)
  })

  it('LEMPAR saat birthDate.dateKind hilang (indeks dan field disebut)', () => {
    const bad = [
      { pairId: 'p1', spouseA: { id: 'a', birthDate: { yearStart: 1980, monthStart: 1, dayStart: 1 } }, spouseB: { id: 'b', birthDate: null } },
    ]
    expect(() => parseCoupleAgeGapPairs(bad)).toThrow(/pair\[0\]\.spouseA\.birthDate\.dateKind: hilang/)
  })

  it('LEMPAR saat yearStart tipe salah (bukan number atau null)', () => {
    const bad = [
      { pairId: 'p1', spouseA: { id: 'a', birthDate: { dateKind: 'EXACT', yearStart: '1980', monthStart: 1, dayStart: 1 } }, spouseB: { id: 'b', birthDate: null } },
    ]
    expect(() => parseCoupleAgeGapPairs(bad)).toThrow(/yearStart: bukan number/)
  })

  it('LEMPAR JSON string bukan array', () => {
    expect(() => parseCoupleAgeGapPairs('{"x":1}')).toThrow(/bukan array/)
  })
})
