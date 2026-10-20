/**
 * Migration distance distribution (v319 fase i): modul PURE untuk
 * distribusi jarak migrasi lintas generasi, pilar 2 VISION-stemmagraph.
 * Jangkar: wt_statistic.php baris 638 getMigrationDistanceDistribution
 * delegasi ke PlaceDispersionRepository::getMigrationDistanceDistribution.
 * Tanpa import server/, tanpa prisma, tanpa fetch: murni transformasi
 * array pasangan koordinat menjadi distribusi band.
 *
 * RUMUS: haversine dengan radius bumi R = 6371 km, hasil dibulatkan
 * ke integer km terdekat (Math.round). Guard antimeridian otomatis
 * dari rumus haversine, tanpa penanganan khusus tambahan.
 *
 * Dua lapis pemeriksaan, dipisah tegas (pola v308/v318):
 *   - Parser strict LEMPAR Error dengan nama field dan indeks elemen
 *     untuk bentuk payload salah (bukan objek, field hilang, tipe
 *     bukan number). DILARANG silent-filter di level parser.
 *   - Nilai di luar domain geografis (lat di luar [-90, 90], lon di
 *     luar [-180, 180], atau NaN/Infinity) adalah data invalid sah:
 *     di-skip dari distribusi dan dihitung invalidPairs.
 *
 * Semantik output: array kosong tetap mengembalikan keenam band
 * berhitungan 0 (histogram, bukan scalar null), tanpa throw.
 */

/** Satu pasangan titik lokasi origin dan destinasi dalam derajat. */
export interface MigrationDistancePair {
  originLat: number
  originLon: number
  destLat: number
  destLon: number
}

/** Kunci band urut sesuai kontrak; bentuk output stabil. */
export const MIGRATION_DISTANCE_BANDS = [
  '0',
  '1-50',
  '51-200',
  '201-500',
  '501-1000',
  '1000+',
] as const

export type MigrationDistanceBand = (typeof MIGRATION_DISTANCE_BANDS)[number]

export type MigrationDistanceDistribution = Record<MigrationDistanceBand, number>

export interface MigrationDistanceResult {
  bands: MigrationDistanceDistribution
  validPairs: number
  invalidPairs: number
}

/** Radius bumi kontrak, dalam km. */
const EARTH_RADIUS_KM = 6371

function emptyDistribution(): MigrationDistanceDistribution {
  return {
    '0': 0,
    '1-50': 0,
    '51-200': 0,
    '201-500': 0,
    '501-1000': 0,
    '1000+': 0,
  }
}

/** Haversine km, dua titik derajat, hasil bulat integer terdekat. */
export function haversineKmRounded(
  originLat: number,
  originLon: number,
  destLat: number,
  destLon: number,
): number {
  const toRad = Math.PI / 180
  const lat1 = originLat * toRad
  const lat2 = destLat * toRad
  const dLat = (destLat - originLat) * toRad
  const dLon = (destLon - originLon) * toRad
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return Math.round(EARTH_RADIUS_KM * c)
}

/** Band untuk jarak km bulat; batas inklusif kiri eksklusif kanan. */
function bandForKm(km: number): MigrationDistanceBand {
  if (km <= 0) return '0'
  if (km <= 50) return '1-50'
  if (km <= 200) return '51-200'
  if (km <= 500) return '201-500'
  if (km <= 1000) return '501-1000'
  return '1000+'
}

/** Domain geografis sah; NaN/Infinity otomatis gugur di sini. */
function isFiniteCoordinate(lat: number, lon: number): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false
  if (lat < -90 || lat > 90) return false
  if (lon < -180 || lon > 180) return false
  return true
}

/**
 * Distribusi jarak migrasi dari pasangan koordinat tervalidasi parser.
 * Pasangan invalid domain dihitung invalidPairs, tidak masuk bands.
 * Deterministik: iterasi berurutan indeks, tanpa sort maupun paralel.
 */
export function computeMigrationDistanceDistribution(
  pairs: MigrationDistancePair[],
): MigrationDistanceResult {
  const bands = emptyDistribution()
  let validPairs = 0
  let invalidPairs = 0
  for (const pair of pairs) {
    if (
      !isFiniteCoordinate(pair.originLat, pair.originLon) ||
      !isFiniteCoordinate(pair.destLat, pair.destLon)
    ) {
      invalidPairs += 1
      continue
    }
    const km = haversineKmRounded(pair.originLat, pair.originLon, pair.destLat, pair.destLon)
    bands[bandForKm(km)] += 1
    validPairs += 1
  }
  return { bands, validPairs, invalidPairs }
}

/** Validasi satu pasangan; lempar Error dengan indeks dan field. */
function assertPair(raw: unknown, index: number): MigrationDistancePair {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error(`migration distance pair[${index}]: bukan objek`)
  }
  const record = raw as Record<string, unknown>
  const fields = ['originLat', 'originLon', 'destLat', 'destLon'] as const
  for (const field of fields) {
    if (!(field in record)) {
      throw new Error(`migration distance pair[${index}].${field}: hilang`)
    }
    if (typeof record[field] !== 'number') {
      throw new Error(`migration distance pair[${index}].${field}: bukan number`)
    }
  }
  return {
    originLat: record.originLat as number,
    originLon: record.originLon as number,
    destLat: record.destLat as number,
    destLon: record.destLon as number,
  }
}

/**
 * Parser strict payload pasangan lokasi (pola v308/v318). Lempar
 * Error pada bentuk salah dengan indeks dan nama field; TANPA
 * silent-filter. Nilai di luar domain diteruskan: penilaian
 * invalid dilakukan di lapis komputasi, bukan parser.
 */
export function parseMigrationDistancePairs(raw: unknown): MigrationDistancePair[] {
  if (!Array.isArray(raw)) {
    throw new Error('migration distance pairs: payload bukan array')
  }
  return raw.map((item, index) => assertPair(item, index))
}
