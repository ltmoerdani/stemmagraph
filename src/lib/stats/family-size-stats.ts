/**
 * v287 fase i: statistik ukuran keluarga (family size stats), pure.
 *
 * Kontrak KUKUH pm Ardi 18 Okt 2026: input abstrak { childIds: string[] }[]
 * tanpa DB, tanpa prisma, tanpa wiring UI. Jumlah anak keluarga = panjang
 * array childIds (GEDCOM 7 term CHIL, kardinalitas {0:M} berulang).
 *
 * Aturan kontrak:
 * - Entry rusak (childIds bukan array) di-skip dan masuk excludedCount
 *   (pola v283), bukan diam-diam.
 * - null bila families kosong atau nihil entry valid.
 * - average dan median dibulatkan 1 desimal (Math.round(x*10)/10,
 *   pola v267 v278). Median standar: ganjil nilai tengah, genap rata
 *   dua nilai tengah.
 * - Bucket: zero = 0, oneToTwo = 1 sampai 2, threeToFour = 3 sampai 4,
 *   fivePlus >= 5.
 * - Deterministik: urutan input tidak mengubah hasil agregat.
 */

/** Entry keluarga abstrak: hanya daftar id anak yang dipakai. */
export interface FamilySizeInput {
  childIds: string[]
}

/** Distribusi ukuran keluarga per bucket. */
export interface FamilySizeDistribution {
  zero: number
  oneToTwo: number
  threeToFour: number
  fivePlus: number
}

/** Hasil agregat statistik ukuran keluarga. */
export interface FamilySizeStats {
  average: number
  median: number
  max: number
  distribution: FamilySizeDistribution
  familyCount: number
  excludedCount: number
}

/** Pembulatan 1 desimal pola v267 v278. */
function round1(x: number): number {
  return Math.round(x * 10) / 10
}

/**
 * Hitung statistik ukuran keluarga dari daftar keluarga abstrak.
 * Menghasilkan null bila families kosong atau nihil entry valid.
 */
export function computeFamilySizeStats(
  families: FamilySizeInput[],
): FamilySizeStats | null {
  if (!Array.isArray(families) || families.length === 0) return null

  const sizes: number[] = []
  let excludedCount = 0

  for (const family of families) {
    if (family === null || typeof family !== 'object' || !Array.isArray(family.childIds)) {
      excludedCount += 1
      continue
    }
    sizes.push(family.childIds.length)
  }

  if (sizes.length === 0) return null

  // Salin lalu urutkan: median dan urutan penjumlahan jadi independen
  // dari urutan input (deterministik).
  const sorted = [...sizes].sort((a, b) => a - b)
  const familyCount = sorted.length
  const total = sorted.reduce((sum, n) => sum + n, 0)
  const average = round1(total / familyCount)

  const mid = Math.floor(familyCount / 2)
  const median =
    familyCount % 2 === 0
      ? round1((sorted[mid - 1] + sorted[mid]) / 2)
      : round1(sorted[mid])

  const distribution: FamilySizeDistribution = {
    zero: 0,
    oneToTwo: 0,
    threeToFour: 0,
    fivePlus: 0,
  }
  let max = 0
  for (const size of sorted) {
    if (size === 0) distribution.zero += 1
    else if (size <= 2) distribution.oneToTwo += 1
    else if (size <= 4) distribution.threeToFour += 1
    else distribution.fivePlus += 1
    if (size > max) max = size
  }

  return { average, median, max, distribution, familyCount, excludedCount }
}
