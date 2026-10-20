/**
 * Parental age at first child distribution (v329 fase i): modul PURE
 * untuk histogram usia orang tua saat kelahiran anak pertama, satu
 * seri per sex ortu (father, mother). Jangkar: wt_statistic.php
 * baris 715-724 getTrimmedAgeAtFirstChildDistributions delegasi
 * ParenthoodRepository::ageAtFirstChildDistribution('M') dan ('F')
 * plus HistogramTrim::dropCoZeroEnds.
 *
 * DEFINISI: usia = fullYears anniversary-aware dari tanggal lahir
 * ortu ke tanggal lahir anak, hanya tanggal EXACT lengkap y+m+d
 * (bulan 1-12, hari 1-31) yang dihitung; usia negatif dibuang.
 * First child per ortu: kandidat anak dengan tanggal lahir paling
 * awal, tie-break childId ascending; satu ortu dihitung sekali
 * walau muncul di banyak record anak.
 *
 * Band 5 tahun label 'n-m' (0-4, 5-9, 10-14, dst). Leading dan
 * trailing band ber-count 0 dipangkas semantik HistogramTrim
 * ::dropCoZeroEnds; band interior kosong DIPERTAHANKAN. Seri tanpa
 * data mengembalikan bands array kosong.
 *
 * Parser strict (pola couple-age-gap v318): parseFirstChildRecords
 * LEMPAR Error ber-index dengan prefiks parental-age-first-child
 * saat payload salah; tanggal tidak valid diabaikan per seri, BUKAN
 * throw.
 *
 * Deterministik murni: tanpa I/O, tanpa Date.now, tanpa random.
 */

/** Tanggal terstruktur ala kolom PartialDate (subset yang relevan). */
export interface FirstChildGedDate {
  /** "EXACT" untuk tanggal pasti; kind lain mengecualikan pasangan. */
  dateKind: string
  yearStart: number | null
  monthStart: number | null
  dayStart: number | null
}

/** Referensi orang tua: id wajib string, birthDate boleh null. */
export interface ParentRef {
  id: string
  birthDate: FirstChildGedDate | null
}

/** Record anak: childId wajib, father dan mother nullable. */
export interface FirstChildRecord {
  childId: string
  birthDate: FirstChildGedDate | null
  father: ParentRef | null
  mother: ParentRef | null
}

/** Satu band histogram label 'n-m' beserta jumlah ortu. */
export interface ParentalAgeBand {
  label: string
  count: number
}

/** Satu seri histogram per sex ortu. */
export interface ParentalAgeSeries {
  bands: ParentalAgeBand[]
  count: number
}

/** Distribusi lengkap: dua seri independen father dan mother. */
export interface ParentalAgeFirstChildDistribution {
  father: ParentalAgeSeries
  mother: ParentalAgeSeries
}

/** Tanggal kalender sederhana hasil parsing EXACT. */
interface Ymd {
  y: number
  m: number
  d: number
}

/** Lebar band histogram dalam tahun (kontrak fase i). */
const BAND_SPAN = 5

/** Tanggal EXACT lengkap; bulan 1-12, hari 1-31, komponen tanpa null. */
function exactYmd(date: FirstChildGedDate | null): { y: number; m: number; d: number } | null {
  if (date === null) return null
  if (date.dateKind !== 'EXACT') return null
  const { yearStart, monthStart, dayStart } = date
  if (yearStart === null || monthStart === null || dayStart === null) return null
  if (monthStart < 1 || monthStart > 12) return null
  if (dayStart < 1 || dayStart > 31) return null
  return { y: yearStart, m: monthStart, d: dayStart }
}

/** Umur tahun penuh antara dua tanggal kalender (pola v267 v280). */
function fullYears(from: Ymd, to: Ymd): number {
  let age = to.y - from.y
  if (to.m < from.m || (to.m === from.m && to.d < from.d)) age -= 1
  return age
}

/** Bandingkan dua tanggal kalender; negatif bila a lebih awal. */
function compareYmd(a: Ymd, b: Ymd): number {
  if (a.y !== b.y) return a.y - b.y
  if (a.m !== b.m) return a.m - b.m
  return a.d - b.d
}

/** Kandidat terpilih per ortu: usia saat lahir anak pertamanya. */
interface FirstChildCandidate {
  age: number
  childYmd: Ymd
  childId: string
}

/**
 * First child per ortu untuk satu seri: pilih anak dengan tanggal
 * lahir paling awal, tie-break childId ascending; satu ortu satu
 * entri. Usia negatif dibuang di level kandidat.
 */
function firstChildAges(
  records: FirstChildRecord[],
  side: 'father' | 'mother',
): Map<string, FirstChildCandidate> {
  const chosen = new Map<string, FirstChildCandidate>()
  for (const record of records) {
    const parent = record[side]
    if (parent === null) continue
    const parentYmd = exactYmd(parent.birthDate)
    if (parentYmd === null) continue
    const childYmd = exactYmd(record.birthDate)
    if (childYmd === null) continue
    const age = fullYears(parentYmd, childYmd)
    if (age < 0) continue
    const current = chosen.get(parent.id)
    if (current === undefined) {
      chosen.set(parent.id, { age, childYmd, childId: record.childId })
      continue
    }
    const earlier = compareYmd(childYmd, current.childYmd)
    if (earlier < 0 || (earlier === 0 && record.childId < current.childId)) {
      chosen.set(parent.id, { age, childYmd, childId: record.childId })
    }
  }
  return chosen
}

/**
 * Pangkas leading dan trailing band ber-count 0 semantik HistogramTrim
 * ::dropCoZeroEnds; band interior kosong dipertahankan; seri kosong
 * mengembalikan array kosong.
 */
function dropCoZeroEnds(bands: ParentalAgeBand[]): ParentalAgeBand[] {
  let first = -1
  let last = -1
  for (let i = 0; i < bands.length; i += 1) {
    if (bands[i].count > 0) {
      if (first === -1) first = i
      last = i
    }
  }
  if (first === -1) return []
  return bands.slice(first, last + 1)
}

/** Histogram band 5 tahun dari kandidat satu seri, sudah terpangkas. */
function buildSeries(candidates: Map<string, FirstChildCandidate>): ParentalAgeSeries {
  if (candidates.size === 0) {
    return { bands: [], count: 0 }
  }
  let maxAge = 0
  for (const candidate of candidates.values()) {
    if (candidate.age > maxAge) maxAge = candidate.age
  }
  const counts: number[] = new Array(Math.floor(maxAge / BAND_SPAN) + 1).fill(0)
  for (const candidate of candidates.values()) {
    counts[Math.floor(candidate.age / BAND_SPAN)] += 1
  }
  const bands: ParentalAgeBand[] = counts.map((count, index) => {
    const start = index * BAND_SPAN
    return { label: `${start}-${start + BAND_SPAN - 1}`, count }
  })
  return { bands: dropCoZeroEnds(bands), count: candidates.size }
}

/**
 * Distribusi usia ortu saat kelahiran anak pertama: dua seri
 * independen father dan mother, deterministik dari input.
 */
export function computeParentalAgeFirstChildDistribution(
  records: FirstChildRecord[],
): ParentalAgeFirstChildDistribution {
  return {
    father: buildSeries(firstChildAges(records, 'father')),
    mother: buildSeries(firstChildAges(records, 'mother')),
  }
}

/** Validasi satu ParentRef; null sah, tipe salah LEMPAR Error. */
function assertParent(raw: unknown, index: number, field: string): ParentRef | null {
  if (raw === null || raw === undefined) return null
  if (typeof raw !== 'object') {
    throw new Error(`parental-age-first-child record[${index}].${field}: bukan objek atau null`)
  }
  const ref = raw as Record<string, unknown>
  if (typeof ref.id !== 'string') {
    throw new Error(`parental-age-first-child record[${index}].${field}.id: hilang atau bukan string`)
  }
  return { id: ref.id, birthDate: assertDate(ref.birthDate, index, `${field}.birthDate`) }
}

/** Validasi satu GedDate; null sah, bentuk salah LEMPAR Error. */
function assertDate(raw: unknown, index: number, field: string): FirstChildGedDate | null {
  if (raw === null || raw === undefined) return null
  if (typeof raw !== 'object') {
    throw new Error(`parental-age-first-child record[${index}].${field}: bukan objek atau null`)
  }
  const date = raw as Record<string, unknown>
  for (const part of ['dateKind', 'yearStart', 'monthStart', 'dayStart'] as const) {
    if (!(part in date)) {
      throw new Error(`parental-age-first-child record[${index}].${field}.${part}: hilang`)
    }
  }
  if (typeof date.dateKind !== 'string') {
    throw new Error(`parental-age-first-child record[${index}].${field}.dateKind: bukan string`)
  }
  for (const part of ['yearStart', 'monthStart', 'dayStart'] as const) {
    const value = date[part]
    if (value !== null && typeof value !== 'number') {
      throw new Error(`parental-age-first-child record[${index}].${field}.${part}: bukan number atau null`)
    }
  }
  return {
    dateKind: date.dateKind,
    yearStart: date.yearStart as number | null,
    monthStart: date.monthStart as number | null,
    dayStart: date.dayStart as number | null,
  }
}

/** Validasi satu record anak ber-index. */
function assertRecord(raw: unknown, index: number): FirstChildRecord {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error(`parental-age-first-child record[${index}]: hilang atau bukan objek`)
  }
  const record = raw as Record<string, unknown>
  if (typeof record.childId !== 'string') {
    throw new Error(`parental-age-first-child record[${index}].childId: hilang atau bukan string`)
  }
  return {
    childId: record.childId,
    birthDate: assertDate(record.birthDate, index, 'birthDate'),
    father: assertParent(record.father, index, 'father'),
    mother: assertParent(record.mother, index, 'mother'),
  }
}

/**
 * Parser strict (pola couple-age-gap): menerima array objek atau
 * string JSON berisi array. Payload salah LEMPAR Error ber-index
 * dengan prefiks parental-age-first-child, tidak pernah silent-filter.
 */
export function parseFirstChildRecords(payload: unknown): FirstChildRecord[] {
  let raw: unknown[]
  if (typeof payload === 'string') {
    const parsed: unknown = JSON.parse(payload)
    if (!Array.isArray(parsed)) {
      throw new Error('parental-age-first-child: payload JSON bukan array')
    }
    raw = parsed
  } else {
    if (!Array.isArray(payload)) {
      throw new Error('parental-age-first-child: payload bukan array')
    }
    raw = payload
  }
  return raw.map((item, index) => assertRecord(item, index))
}
