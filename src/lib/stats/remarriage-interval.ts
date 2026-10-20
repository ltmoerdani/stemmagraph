/**
 * Remarriage interval (v327 fase i): modul PURE untuk statistik
 * demografis keluarga, pilar 2 VISION-stemmagraph. Jangkar riset:
 * wt_statistic.php baris 869 getRemarriageIntervalDistribution
 * (band bulan kurang dari 6 sampai 60+). Saudara divorce-widowhood.ts
 * (v325) dan consanguinity.ts (v326).
 *
 * METRIK: jarak bulan penuh antara kematian pasangan (DEAT spouse u1)
 * dan pernikahan berikutnya survivor (MARR u2). Berbeda dari v325
 * widowhood interval yang mengukur kematian ke kematian.
 *
 * DEFINISI (kontrak drafts/kontrak-stg-v327-remarriage-interval):
 * - Rantai per person: union tempat person jadi spouse, hanya MARR
 *   EXACT, urut tuple kalender MARR (tie: urutan input).
 * - Interval antara dua union berurutan u1 lalu u2 pada rantai yang
 *   sama, survivor = person. Syarat: spouse lain di u1 punya DEAT
 *   EXACT.
 * - Bulan penuh tuple-based: (y2-y1)*12 + (m2-m1), kurangi 1 bila
 *   d2 < d1 (anniversary belum tercapai), minimum 0.
 * - MARR u2 sama atau lebih awal dari DEAT pasangan u1: masuk
 *   counter anomalies, tidak masuk band, rantai tetap jalan.
 * - Band: '<6', '6-11', '12-23', '24-35', '36-47', '48-59', '60+'.
 * - personsWithChains = person unik dengan minimal satu interval
 *   valid atau anomali.
 * - Deterministik: agregasi per kunci band dan Set person, urutan
 *   input acak hasil identik. Input kosong valid, TIDAK throw.
 */

/** Tanggal terstruktur ala kolom PartialDate (subset yang relevan). */
export interface StdDate {
  /** "EXACT" untuk tanggal pasti; kind lain ekuivalen null di hitungan. */
  dateKind: string
  yearStart: number | null
  monthStart: number | null
  dayStart: number | null
}

export interface RemarriageSpouseInput {
  id: string
  sex: 'M' | 'F'
  deathDate: StdDate | null
}

export interface RemarriageUnionInput {
  unionId: string
  marriageDate: StdDate | null
  spouses: RemarriageSpouseInput[]
}

export interface RemarriageBandRow {
  /** Label band kontrak: '<6', '6-11', '12-23', '24-35', '36-47', '48-59', '60+'. */
  band: string
  count: number
}

export interface RemarriageIntervalPayload {
  /** 7 band urut kontrak, selalu lengkap. */
  bands: RemarriageBandRow[]
  /** Jumlah interval valid masuk band. */
  survivorsTotal: number
  /** MARR u2 sama atau lebih awal dari DEAT pasangan u1. */
  anomalies: number
  /** Person unik dengan minimal satu interval valid atau anomali. */
  personsWithChains: number
}

interface Ymd {
  y: number
  m: number
  d: number
}

/** Tanggal EXACT dengan komponen kalender lengkap; selain itu null. */
function exactYmd(date: StdDate | null): Ymd | null {
  if (date === null) return null
  if (date.dateKind !== 'EXACT') return null
  const { yearStart, monthStart, dayStart } = date
  if (yearStart === null || monthStart === null || dayStart === null) return null
  return { y: yearStart, m: monthStart, d: dayStart }
}

/** Perbandingan tuple kalender: -1 a lebih awal, 1 a lebih akhir, 0 sama. */
function compareYmd(a: Ymd, b: Ymd): number {
  if (a.y !== b.y) return a.y < b.y ? -1 : 1
  if (a.m !== b.m) return a.m < b.m ? -1 : 1
  if (a.d !== b.d) return a.d < b.d ? -1 : 1
  return 0
}

/**
 * Bulan penuh dari from ke to: (y2-y1)*12 + (m2-m1), dikurangi 1
 * bila day to lebih kecil dari day from (anniversary belum tercapai),
 * minimum 0.
 */
function fullMonths(from: Ymd, to: Ymd): number {
  let months = (to.y - from.y) * 12 + (to.m - from.m)
  if (to.d < from.d) months -= 1
  if (months < 0) months = 0
  return months
}

/** Validasi satu objek StdDate; lempar Error dengan jalur field. */
function assertStdDate(raw: unknown, path: string): StdDate {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new Error(`${path}: bukan objek atau null`)
  }
  const rec = raw as Record<string, unknown>
  if (rec.dateKind === undefined) {
    throw new Error(`${path}.dateKind: hilang`)
  }
  if (typeof rec.dateKind !== 'string') {
    throw new Error(`${path}.dateKind: bukan string`)
  }
  const out: StdDate = { dateKind: rec.dateKind, yearStart: null, monthStart: null, dayStart: null }
  for (const field of ['yearStart', 'monthStart', 'dayStart'] as const) {
    const value = rec[field]
    if (value === undefined) {
      throw new Error(`${path}.${field}: hilang`)
    }
    if (value !== null && typeof value !== 'number') {
      throw new Error(`${path}.${field}: bukan number atau null`)
    }
    out[field] = value
  }
  return out
}

/** Validasi satu spouse; lempar Error dengan indeks union dan spouse. */
function assertSpouse(raw: unknown, ui: number, si: number): RemarriageSpouseInput {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new Error(`unions[${ui}].spouses[${si}]: bukan objek`)
  }
  const rec = raw as Record<string, unknown>
  if (rec.id === undefined) {
    throw new Error(`unions[${ui}].spouses[${si}].id: hilang`)
  }
  if (typeof rec.id !== 'string') {
    throw new Error(`unions[${ui}].spouses[${si}].id: bukan string`)
  }
  if (rec.sex !== 'M' && rec.sex !== 'F') {
    throw new Error(`unions[${ui}].spouses[${si}].sex: bukan M atau F`)
  }
  return {
    id: rec.id,
    sex: rec.sex,
    deathDate: rec.deathDate === null ? null : assertStdDate(rec.deathDate, `unions[${ui}].spouses[${si}].deathDate`),
  }
}

/** Validasi satu union; lempar Error dengan indeks dan nama field. */
function assertUnion(raw: unknown, index: number): RemarriageUnionInput {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new Error(`unions[${index}]: bukan objek`)
  }
  const rec = raw as Record<string, unknown>
  if (rec.unionId === undefined) {
    throw new Error(`unions[${index}].unionId: hilang`)
  }
  if (typeof rec.unionId !== 'string') {
    throw new Error(`unions[${index}].unionId: bukan string`)
  }
  if (!Array.isArray(rec.spouses)) {
    throw new Error(`unions[${index}].spouses: bukan array`)
  }
  return {
    unionId: rec.unionId,
    marriageDate: rec.marriageDate === null ? null : assertStdDate(rec.marriageDate, `unions[${index}].marriageDate`),
    spouses: rec.spouses.map((sp, si) => assertSpouse(sp, index, si)),
  }
}

/**
 * Parser strict payload union. LEMPAR Error pada bentuk salah dengan
 * indeks dan nama field; TANPA silent-filter.
 */
export function parseRemarriageUnions(raw: unknown): RemarriageUnionInput[] {
  if (!Array.isArray(raw)) {
    throw new Error('unions: payload bukan array')
  }
  return raw.map((item, index) => assertUnion(item, index))
}

const BAND_LABELS = ['<6', '6-11', '12-23', '24-35', '36-47', '48-59', '60+'] as const

function bandOf(months: number): string {
  if (months < 6) return '<6'
  if (months < 12) return '6-11'
  if (months < 24) return '12-23'
  if (months < 36) return '24-35'
  if (months < 48) return '36-47'
  if (months < 60) return '48-59'
  return '60+'
}

/**
 * Hitung distribusi band jarak remarriage dari union tervalidasi.
 * Payload utuh dikembalikan apa pun isi input; input kosong
 * menghasilkan bands 7 entri nol tanpa throw.
 */
export function computeRemarriageIntervals(unions: RemarriageUnionInput[]): RemarriageIntervalPayload {
  const bands: RemarriageBandRow[] = BAND_LABELS.map((band) => ({ band, count: 0 }))
  const bandIndex = new Map<string, number>(BAND_LABELS.map((b, i) => [b, i]))
  let survivorsTotal = 0
  let anomalies = 0
  const chainedPersons = new Set<string>()

  // Kumpulkan rantai per person: union ber-MARR EXACT berisi person.
  // Struktur: personId -> array {union, marr, spousesLain, indexInput}.
  interface ChainEntry {
    union: RemarriageUnionInput
    marr: Ymd
    index: number
  }
  const chains = new Map<string, ChainEntry[]>()

  unions.forEach((union, index) => {
    const marr = exactYmd(union.marriageDate)
    if (marr === null) return
    union.spouses.forEach((spouse) => {
      const list = chains.get(spouse.id) ?? []
      list.push({ union, marr, index })
      chains.set(spouse.id, list)
    })
  })

  // Urutkan tiap rantai: tuple MARR menaik, tie urutan input.
  for (const list of chains.values()) {
    list.sort((a, b) => {
      const c = compareYmd(a.marr, b.marr)
      if (c !== 0) return c
      return a.index - b.index
    })
  }

  // Telusuri pasangan union berurutan per person.
  for (const [personId, list] of chains) {
    for (let i = 0; i + 1 < list.length; i += 1) {
      const u1 = list[i]
      const u2 = list[i + 1]
      const other = u1.union.spouses.find((sp) => sp.id !== personId)
      if (other === undefined) continue
      const deat = exactYmd(other.deathDate)
      if (deat === null) continue
      const months = fullMonths(deat, u2.marr)
      // MARR u2 sama atau lebih awal dari DEAT: anomali, rantai jalan.
      if (compareYmd(u2.marr, deat) <= 0) {
        anomalies += 1
        chainedPersons.add(personId)
        continue
      }
      const band = bandOf(months)
      bands[bandIndex.get(band) as number].count += 1
      survivorsTotal += 1
      chainedPersons.add(personId)
    }
  }

  return {
    bands,
    survivorsTotal,
    anomalies,
    personsWithChains: chainedPersons.size,
  }
}
