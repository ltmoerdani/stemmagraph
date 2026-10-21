/**
 * Ancestor count distribution (v337 fase i): modul PURE histogram
 * agregat jumlah leluhur dikenal per individu.
 * Jangkar: wt_statistic.php baris 1067 getAncestorCountDistribution
 * delegasi kinshipRepository->ancestorCountDistribution, doc comment
 * histogram of known-ancestor counts per individual, 4-generation
 * walk, 3-wide buckets.
 *
 * DEFINISI: input array entri { personId: string, ancestors: string[] }.
 * ancestors adalah daftar id leluhur dikenal per individu, maksimal
 * 4 generasi sudah disaring sisi data, modul tidak berjalan graf dan
 * menerima counts jadi. Duplikat id dalam satu entri didedupe pola
 * children-per-family Set. totalKnownAncestors = union unik leluhur
 * lintas semua entri.
 *
 * Bucket 3-wide: 0-3, 4-7, 8-11, 12-15. Slot teoretis generasi 1-4
 * ada 15, jadi 15 masuk bucket 12-15; lebih dari 15 tetap di bucket
 * sama (clamp walk 4 generasi). buckets SELALU 4 entri urut naik,
 * count boleh 0.
 *
 * Parser strict: payload bukan array, entri bukan objek, personId
 * hilang atau bukan string, ancestors hilang atau bukan array, atau
 * elemen ancestors bukan string LEMPAR Error ber-index dengan
 * prefiks ancestor-count-distribution, tidak pernah silent-filter.
 *
 * Deterministik murni: tanpa I/O, tanpa Date.now, tanpa random,
 * tanpa em dash.
 */

/** Satu baris histogram: label bucket plus jumlah individu. */
export interface AncestorCountBucket {
  label: string
  count: number
}

/** Hasil lengkap distribusi jumlah leluhur. */
export interface AncestorCountDistributionResult {
  buckets: AncestorCountBucket[]
  totalPersons: number
  totalKnownAncestors: number
}

/** Label bucket urut naik, selalu 4 entri. */
const BUCKET_LABELS = ['0-3', '4-7', '8-11', '12-15'] as const

/**
 * Indeks bucket untuk satu individu: 3-wide, count di atas 15
 * tetap jatuh ke bucket terakhir (clamp walk 4 generasi).
 */
function bucketIndex(knownCount: number): number {
  if (knownCount <= 3) return 0
  if (knownCount <= 7) return 1
  if (knownCount <= 11) return 2
  return 3
}

/**
 * Validasi satu entri ber-index; bentuk salah LEMPAR Error.
 * personId wajib string, ancestors wajib array of string.
 */
function assertEntry(
  raw: unknown,
  index: number,
): { personId: string, ancestors: string[] } {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error(`ancestor-count-distribution entry[${index}]: hilang atau bukan objek`)
  }
  const entry = raw as Record<string, unknown>
  if (typeof entry.personId !== 'string') {
    throw new Error(`ancestor-count-distribution entry[${index}].personId: hilang atau bukan string`)
  }
  if (!Array.isArray(entry.ancestors)) {
    throw new Error(`ancestor-count-distribution entry[${index}].ancestors: hilang atau bukan array`)
  }
  const ancestors = entry.ancestors.map((id, position) => {
    if (typeof id !== 'string') {
      throw new Error(`ancestor-count-distribution entry[${index}].ancestors[${position}]: hilang atau bukan string`)
    }
    return id
  })
  return { personId: entry.personId, ancestors }
}

/**
 * Histogram agregat jumlah leluhur dikenal per individu. Dedupe
 * per entri pakai Set, totalKnownAncestors union unik lintas
 * entri. Output deterministik, buckets selalu 4 entri urut naik.
 */
export function computeAncestorCountDistribution(
  payload: unknown,
): AncestorCountDistributionResult {
  if (!Array.isArray(payload)) {
    throw new Error('ancestor-count-distribution: payload bukan array')
  }

  const bucketCounts = [0, 0, 0, 0]
  const allKnownAncestors = new Set<string>()

  for (let index = 0; index < payload.length; index += 1) {
    const entry = assertEntry(payload[index], index)
    const perEntry = new Set(entry.ancestors)
    for (const id of perEntry) allKnownAncestors.add(id)
    bucketCounts[bucketIndex(perEntry.size)] += 1
  }

  const buckets: AncestorCountBucket[] = BUCKET_LABELS.map((label, position) => ({
    label,
    count: bucketCounts[position],
  }))

  return {
    buckets,
    totalPersons: payload.length,
    totalKnownAncestors: allKnownAncestors.size,
  }
}
