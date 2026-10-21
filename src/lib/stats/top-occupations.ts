/**
 * Occupations top-N (v333 fase i): modul PURE untuk frekuensi
 * pekerjaan (1 OCCU per individu) lintas pohon.
 * Jangkar: wt_statistic.php baris 1157-1169 getTopOccupations
 * delegasi OccupationRepository::top($limit) plus countDistinct,
 * case-folded.
 *
 * DEFINISI: input array item { occupation: string }, satu entri
 * per individu ber-OCCU. Normalisasi case-folded pola jangkar PHP:
 * trim, lowercase, collapse whitespace beruntun jadi satu spasi.
 * String kosong atau whitespace saja dibuang diam dan dihitung di
 * excludedEmpty.
 *
 * Output deterministik: items urut count desc, tie-break
 * alphabetical asc locale-independent, dipotong limit.
 * distinctCount = jumlah normalized unik dari totalValid.
 * Keputusan kontrak v333: label output pakai bentuk normalisasi
 * lowercase (deviasi dari first-seen original casing jangkar PHP,
 * kandidat fase ii).
 *
 * Parser strict (pola death-causes-topn v332): input bukan array,
 * elemen bukan objek, atau occupation hilang bukan string LEMPAR
 * Error ber-index dengan prefiks top-occupations. limit wajib
 * integer >= 1 selain itu LEMPAR Error, tanpa default.
 *
 * Deterministik murni: tanpa I/O, tanpa Date.now, tanpa random.
 */

/** Satu baris hasil: pekerjaan ternormalisasi plus jumlah. */
export interface TopOccupationRow {
  occupation: string
  count: number
}

/** Hasil lengkap top-N pekerjaan. */
export interface TopOccupationsResult {
  items: TopOccupationRow[]
  distinctCount: number
  totalValid: number
  excludedEmpty: number
}

/**
 * Normalisasi case-folded pola jangkar PHP: trim, lowercase,
 * collapse whitespace beruntun jadi satu spasi.
 */
function normalizeOccupation(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, ' ')
}

/** Validasi limit: integer >= 1 selain itu lempar Error. */
function assertLimit(limit: number): void {
  if (typeof limit !== 'number' || !Number.isInteger(limit) || limit < 1) {
    throw new Error('top-occupations: limit wajib integer >= 1')
  }
}

/** Validasi satu item occupation ber-index; bentuk salah LEMPAR Error. */
function assertItem(raw: unknown, index: number): string {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error(`top-occupations item[${index}]: hilang atau bukan objek`)
  }
  const item = raw as Record<string, unknown>
  if (typeof item.occupation !== 'string') {
    throw new Error(`top-occupations item[${index}].occupation: hilang atau bukan string`)
  }
  return item.occupation
}

/**
 * Parser strict: menerima array objek. Payload salah LEMPAR Error
 * ber-index dengan prefiks top-occupations, tidak pernah
 * silent-filter.
 */
export function parseOccupations(payload: unknown): string[] {
  if (!Array.isArray(payload)) {
    throw new Error('top-occupations: payload bukan array')
  }
  return payload.map((item, index) => assertItem(item, index))
}

/**
 * Top-N pekerjaan: agregasi frekuensi case-folded, urutan count
 * desc tie-break alphabetical asc, potong limit.
 */
export function topOccupations(input: unknown, limit: number): TopOccupationsResult {
  assertLimit(limit)
  const occupations = parseOccupations(input)

  const counts = new Map<string, number>()
  let totalValid = 0
  let excludedEmpty = 0
  for (const raw of occupations) {
    const occupation = normalizeOccupation(raw)
    if (occupation === '') {
      excludedEmpty += 1
      continue
    }
    counts.set(occupation, (counts.get(occupation) ?? 0) + 1)
    totalValid += 1
  }

  const items: TopOccupationRow[] = Array.from(counts.entries())
    .map(([occupation, count]) => ({ occupation, count }))
    .sort((a, b) => {
      if (a.count !== b.count) return b.count - a.count
      if (a.occupation < b.occupation) return -1
      if (a.occupation > b.occupation) return 1
      return 0
    })
    .slice(0, limit)

  return {
    items,
    distinctCount: counts.size,
    totalValid,
    excludedEmpty,
  }
}
