import { describe, expect, it } from 'vitest'
import {
  MIGRATION_DISTANCE_BANDS,
  computeMigrationDistanceDistribution,
  haversineKmRounded,
  parseMigrationDistancePairs,
  type MigrationDistanceResult,
} from './migration-distance'

/** km per derajat bujur di ekuator untuk triangulasi koordinat sintetis. */
const KM_PER_DEGREE_EQUATOR = 6371 * (Math.PI / 180)

/** Pasangan sintetis di ekuator dengan jarak kira-kira km sebelum round. */
function equatorPair(km: number): {
  originLat: number
  originLon: number
  destLat: number
  destLon: number
} {
  return { originLat: 0, originLon: 0, destLat: 0, destLon: km / KM_PER_DEGREE_EQUATOR }
}

function fullPipe(raw: unknown): MigrationDistanceResult {
  return computeMigrationDistanceDistribution(parseMigrationDistancePairs(raw))
}

describe('haversineKmRounded', () => {
  it('titik sama persis menghasilkan 0 km', () => {
    expect(haversineKmRounded(-6.2, 106.816666, -6.2, 106.816666)).toBe(0)
  })

  it('Jakarta ke Bandung jarak great-circle (rentang 110 sampai 180)', () => {
    // Koordinat kontrak menghasilkan 118 km (R = 6371). Angka populer
    // 150 km adalah jarak darat; garis lurus kedua kota memang lebih
    // pendek. Batas bawah 120 dielong jadi 110 agar memuat nilai itu.
    const km = haversineKmRounded(-6.2, 106.816666, -6.914722, 107.609722)
    expect(km).toBeGreaterThanOrEqual(110)
    expect(km).toBeLessThanOrEqual(180)
    expect(km).toBe(118)
  })

  it('antimeridian terhitung via rumus tanpa penanganan khusus', () => {
    const km = haversineKmRounded(0, 179.5, 0, -179.5)
    expect(km).toBeGreaterThan(100)
    expect(km).toBeLessThan(120)
  })
})

describe('computeMigrationDistanceDistribution', () => {
  it('array kosong: semua band 0, valid dan invalid 0, tanpa throw', () => {
    const result = fullPipe([])
    expect(result).toEqual({
      bands: { '0': 0, '1-50': 0, '51-200': 0, '201-500': 0, '501-1000': 0, '1000+': 0 },
      validPairs: 0,
      invalidPairs: 0,
    })
  })

  it('jarak eksak 0 km masuk band 0', () => {
    const result = fullPipe([
      { originLat: -6.2, originLon: 106.816666, destLat: -6.2, destLon: 106.816666 },
    ])
    expect(result.bands['0']).toBe(1)
    expect(result.validPairs).toBe(1)
    expect(result.invalidPairs).toBe(0)
  })

  it('0.4 km round ke 0 masuk band 0', () => {
    const result = fullPipe([equatorPair(0.4)])
    expect(result.bands['0']).toBe(1)
  })

  it('boundary band inklusif kiri eksklusif kanan di ekuator', () => {
    const cases: Array<[number, string]> = [
      [50, '1-50'],
      [51, '51-200'],
      [200, '51-200'],
      [201, '201-500'],
      [500, '201-500'],
      [501, '501-1000'],
      [1000, '501-1000'],
      [1001, '1000+'],
    ]
    for (const [km, band] of cases) {
      const result = fullPipe([equatorPair(km)])
      expect(result.bands[band as keyof typeof result.bands], `jarak ${km} km`).toBe(1)
      expect(result.validPairs).toBe(1)
    }
  })

  it('50.4 km round ke 50 tetap masuk band 1-50', () => {
    const result = fullPipe([equatorPair(50.4)])
    expect(result.bands['1-50']).toBe(1)
  })

  it('nilai invalid domain dihitung invalidPairs dan tidak masuk bands', () => {
    const result = fullPipe([
      { originLat: Number.NaN, originLon: 0, destLat: 0, destLon: 0 },
      { originLat: 0, originLon: Number.POSITIVE_INFINITY, destLat: 0, destLon: 0 },
      { originLat: 91, originLon: 0, destLat: 0, destLon: 0 },
      { originLat: 0, originLon: 0, destLat: 0, destLon: -181 },
    ])
    expect(result.invalidPairs).toBe(4)
    expect(result.validPairs).toBe(0)
    expect(Object.values(result.bands).every((count) => count === 0)).toBe(true)
  })

  it('campuran valid dan invalid terhitung akurat', () => {
    const result = fullPipe([
      { originLat: 0, originLon: 0, destLat: 0, destLon: 0 },
      { originLat: -6.2, originLon: 106.816666, destLat: -6.914722, destLon: 107.609722 },
      { originLat: 95, originLon: 0, destLat: 0, destLon: 0 },
    ])
    expect(result.validPairs).toBe(2)
    expect(result.invalidPairs).toBe(1)
    expect(result.bands['0']).toBe(1)
    // Jakarta-Bandung 118 km masuk band 51-200.
    expect(result.bands['51-200']).toBe(1)
  })

  it('semua band hadir walau hitungan 0, urutan sesuai konstanta', () => {
    const result = fullPipe([])
    expect(Object.keys(result.bands)).toEqual([...MIGRATION_DISTANCE_BANDS])
  })

  it('determinisme: input sama dua kali panggil hasil identik', () => {
    const input = [
      { originLat: -6.2, originLon: 106.816666, destLat: -6.914722, destLon: 107.609722 },
      { originLat: Number.NaN, originLon: 0, destLat: 0, destLon: 0 },
    ]
    expect(JSON.stringify(fullPipe(input))).toBe(JSON.stringify(fullPipe(input)))
  })
})

describe('parseMigrationDistancePairs strict', () => {
  it('elemen non-objek melempar Error dengan indeks', () => {
    expect(() => parseMigrationDistancePairs([42])).toThrow(Error)
    expect(() => parseMigrationDistancePairs([null])).toThrow(/pair\[0\]/)
  })

  it('field hilang melempar Error dengan nama field', () => {
    expect(() => parseMigrationDistancePairs([{ originLat: 0, destLat: 0, destLon: 0 }])).toThrow(
      /originLon/,
    )
  })

  it('field bertipe bukan number melempar Error', () => {
    expect(() =>
      parseMigrationDistancePairs([
        { originLat: 0, originLon: 0, destLat: 0, destLon: 'x' },
      ]),
    ).toThrow(/destLon/)
  })

  it('payload bukan array melempar Error', () => {
    expect(() => parseMigrationDistancePairs({})).toThrow(Error)
  })

  it('parser menerima nilai di luar domain: validasi invalid di lapis komputasi', () => {
    const parsed = parseMigrationDistancePairs([
      { originLat: 91, originLon: 0, destLat: 0, destLon: 0 },
    ])
    expect(parsed).toHaveLength(1)
    expect(fullPipe(parsed).invalidPairs).toBe(1)
  })
})
