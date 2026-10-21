/**
 * Death causes by sex (v334 fase i): modul PURE untuk frekuensi
 * penyebab kematian (2 CAUS di bawah 1 DEAT) dipecah per sex.
 * Perluasan alami v332 death-causes-topn (1a5502d), kalibrasi
 * eksternal WHO Global Health Estimates: top penyebab kematian
 * berbeda per sex. Banding WHO opsional, top-N andalkan data
 * pohon sendiri.
 *
 * DEFINISI: input array item { cause: string, sex: string },
 * satu entri per kematian ber-CAUS. Normalisasi cause case-folded
 * pola jangkar v332: trim, lowercase, collapse whitespace beruntun
 * jadi satu spasi. Sex: trim lalu uppercase; sex selain F dan M
 * (termasuk sex kosong atau whitespace) masuk seri U.
 *
 * Cause kosong atau whitespace saja dibuang diam dan dihitung di
 * excludedEmpty; entri dengan keduanya kosong dihitung excludedEmpty
 * saja (keputusan buang ditentukan cause, bukan dua-duanya).
 *
 * TIGA seri independen F, M, U SELALU ada di output walau kosong.
 * Setiap seri: items urut count desc, tie-break alphabetical asc
 * locale-independent, dipotong limit yang sama, plus totalValid
 * per seri. distinctCount = cause normalized unik LINTAS seri.
 * totalValid global = entri yang masuk hitung.
 *
 * Parser strict (pola v332): input bukan array, elemen bukan
 * objek, cause hilang bukan string, atau sex hilang bukan string
 * LEMPAR Error ber-index dengan prefiks death-causes-by-sex.
 * limit wajib integer >= 1 selain itu LEMPAR Error, tanpa default.
 *
 * Deterministik murni: tanpa I/O, tanpa Date.now, tanpa random.
 */

/** Satu baris hasil: penyebab kematian ternormalisasi plus jumlah. */
export interface DeathCauseRow {
  cause: string
  count: number
}

/** Satu seri sex: top-N items plus total entri valid seri itu. */
export interface DeathCausesBySexSeries {
  items: DeathCauseRow[]
  totalValid: number
}

/** Hasil lengkap top-N penyebab kematian dipecah per sex. */
export interface DeathCausesBySexResult {
  series: {
    F: DeathCausesBySexSeries
    M: DeathCausesBySexSeries
    U: DeathCausesBySexSeries
  }
  distinctCount: number
  totalValid: number
  excludedEmpty: number
}

/** Kunci seri yang selalu hadir di output. */
const SERIES_KEYS = ['F', 'M', 'U'] as const
type SeriesKey = (typeof SERIES_KEYS)[number]

/**
 * Normalisasi cause case-folded pola jangkar v332: trim, lowercase,
 * collapse whitespace beruntun jadi satu spasi.
 */
function normalizeCause(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, ' ')
}

/** Normalisasi sex: trim lalu uppercase. */
function normalizeSex(raw: string): string {
  return raw.trim().toUpperCase()
}

/** Petakan sex ternormalisasi ke kunci seri: F dan M apa adanya, lainnya U. */
function seriesKeyOf(sex: string): SeriesKey {
  return sex === 'F' || sex === 'M' ? sex : 'U'
}

/** Validasi limit: integer >= 1 selain itu lempar Error. */
function assertLimit(limit: number): void {
  if (typeof limit !== 'number' || !Number.isInteger(limit) || limit < 1) {
    throw new Error('death-causes-by-sex: limit wajib integer >= 1')
  }
}

/** Validasi satu item cause plus sex ber-index; bentuk salah LEMPAR Error. */
function assertItem(raw: unknown, index: number): { cause: string; sex: string } {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error(`death-causes-by-sex item[${index}]: hilang atau bukan objek`)
  }
  const item = raw as Record<string, unknown>
  if (typeof item.cause !== 'string') {
    throw new Error(`death-causes-by-sex item[${index}].cause: hilang atau bukan string`)
  }
  if (typeof item.sex !== 'string') {
    throw new Error(`death-causes-by-sex item[${index}].sex: hilang atau bukan string`)
  }
  return { cause: item.cause, sex: item.sex }
}

/**
 * Parser strict: menerima array objek berpasangan cause plus sex.
 * Payload salah LEMPAR Error ber-index dengan prefiks
 * death-causes-by-sex, tidak pernah silent-filter.
 */
export function parseDeathCausesBySex(payload: unknown): Array<{ cause: string; sex: string }> {
  if (!Array.isArray(payload)) {
    throw new Error('death-causes-by-sex: payload bukan array')
  }
  return payload.map((item, index) => assertItem(item, index))
}

/**
 * Top-N penyebab kematian per sex: agregasi frekuensi case-folded
 * dalam tiga seri independen F, M, U, urutan count desc tie-break
 * alphabetical asc, tiap seri dipotong limit yang sama.
 */
export function deathCausesBySex(input: unknown, limit: number): DeathCausesBySexResult {
  assertLimit(limit)
  const entries = parseDeathCausesBySex(input)

  const counts: Record<SeriesKey, Map<string, number>> = {
    F: new Map(),
    M: new Map(),
    U: new Map(),
  }
  const totals: Record<SeriesKey, number> = { F: 0, M: 0, U: 0 }
  let totalValid = 0
  let excludedEmpty = 0

  for (const entry of entries) {
    const cause = normalizeCause(entry.cause)
    if (cause === '') {
      excludedEmpty += 1
      continue
    }
    const key = seriesKeyOf(normalizeSex(entry.sex))
    counts[key].set(cause, (counts[key].get(cause) ?? 0) + 1)
    totals[key] += 1
    totalValid += 1
  }

  const buildSeries = (key: SeriesKey): DeathCausesBySexSeries => ({
    items: Array.from(counts[key].entries())
      .map(([cause, count]) => ({ cause, count }))
      .sort((a, b) => {
        if (a.count !== b.count) return b.count - a.count
        if (a.cause < b.cause) return -1
        if (a.cause > b.cause) return 1
        return 0
      })
      .slice(0, limit),
    totalValid: totals[key],
  })

  const distinct = new Set<string>()
  for (const key of SERIES_KEYS) {
    for (const cause of counts[key].keys()) {
      distinct.add(cause)
    }
  }

  return {
    series: {
      F: buildSeries('F'),
      M: buildSeries('M'),
      U: buildSeries('U'),
    },
    distinctCount: distinct.size,
    totalValid,
    excludedEmpty,
  }
}
