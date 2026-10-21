/**
 * Death causes top-N (v332 fase i): modul PURE untuk frekuensi
 * penyebab kematian (2 CAUS di bawah 1 DEAT) lintas pohon.
 * Jangkar: wt_statistic.php baris 1195-1217 getTopDeathCauses
 * delegasi DeathCauseRepository::top($limit) plus countDistinct,
 * case-folded.
 *
 * DEFINISI: input array item { cause: string }, satu entri per
 * kematian ber-CAUS. Normalisasi case-folded pola jangkar PHP:
 * trim, lowercase, collapse whitespace beruntun jadi satu spasi.
 * String kosong atau whitespace saja dibuang diam dan dihitung di
 * excludedEmpty.
 *
 * Output deterministik: items urut count desc, tie-break
 * alphabetical asc locale-independent, dipotong limit.
 * distinctCount = jumlah normalized unik dari totalValid.
 *
 * Parser strict (pola parental-age-first-child v329): input bukan
 * array, elemen bukan objek, atau cause hilang bukan string
 * LEMPAR Error ber-index dengan prefiks death-causes-topn.
 * limit wajib integer >= 1 selain itu LEMPAR Error, tanpa default.
 *
 * Deterministik murni: tanpa I/O, tanpa Date.now, tanpa random.
 */

/** Satu baris hasil: penyebab kematian ternormalisasi plus jumlah. */
export interface DeathCauseRow {
  cause: string
  count: number
}

/** Hasil lengkap top-N penyebab kematian. */
export interface DeathCausesTopnResult {
  items: DeathCauseRow[]
  distinctCount: number
  totalValid: number
  excludedEmpty: number
}

/**
 * Normalisasi case-folded pola jangkar PHP: trim, lowercase,
 * collapse whitespace beruntun jadi satu spasi.
 */
function normalizeCause(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, ' ')
}

/** Validasi limit: integer >= 1 selain itu lempar Error. */
function assertLimit(limit: number): void {
  if (typeof limit !== 'number' || !Number.isInteger(limit) || limit < 1) {
    throw new Error('death-causes-topn: limit wajib integer >= 1')
  }
}

/** Validasi satu item cause ber-index; bentuk salah LEMPAR Error. */
function assertItem(raw: unknown, index: number): string {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error(`death-causes-topn item[${index}]: hilang atau bukan objek`)
  }
  const item = raw as Record<string, unknown>
  if (typeof item.cause !== 'string') {
    throw new Error(`death-causes-topn item[${index}].cause: hilang atau bukan string`)
  }
  return item.cause
}

/**
 * Parser strict: menerima array objek. Payload salah LEMPAR Error
 * ber-index dengan prefiks death-causes-topn, tidak pernah
 * silent-filter.
 */
export function parseDeathCauses(payload: unknown): string[] {
  if (!Array.isArray(payload)) {
    throw new Error('death-causes-topn: payload bukan array')
  }
  return payload.map((item, index) => assertItem(item, index))
}

/**
 * Top-N penyebab kematian: agregasi frekuensi case-folded,
 * urutan count desc tie-break alphabetical asc, potong limit.
 */
export function deathCausesTopn(input: unknown, limit: number): DeathCausesTopnResult {
  assertLimit(limit)
  const causes = parseDeathCauses(input)

  const counts = new Map<string, number>()
  let totalValid = 0
  let excludedEmpty = 0
  for (const raw of causes) {
    const cause = normalizeCause(raw)
    if (cause === '') {
      excludedEmpty += 1
      continue
    }
    counts.set(cause, (counts.get(cause) ?? 0) + 1)
    totalValid += 1
  }

  const items: DeathCauseRow[] = Array.from(counts.entries())
    .map(([cause, count]) => ({ cause, count }))
    .sort((a, b) => {
      if (a.count !== b.count) return b.count - a.count
      if (a.cause < b.cause) return -1
      if (a.cause > b.cause) return 1
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
