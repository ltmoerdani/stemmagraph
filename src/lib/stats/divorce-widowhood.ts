/**
 * Divorce cohort rate dan widowhood interval (v325 fase i): modul
 * PURE untuk statistik demografis keluarga, pilar 2 VISION-stemmagraph.
 * Jangkar: webtrees-statistics tab Family kartu divorce cohort rate
 * dan widowhood interval (README baris 139). Saudara marriage-age.ts
 * (v280) dan marriage-months.ts (v283).
 *
 * BAGIAN 1 (divorce cohort rate): kohort dekade dari tahun pernikahan
 * EXACT, dek = floor(year/10)*10, label "1950s". Denominator = semua
 * union dengan marriageDate EXACT pada dekade itu apa pun status akhir;
 * numerator = union yang juga punya divorceDate EXACT. ratePct =
 * numerator/denominator*100 dibulatkan 1 desimal.
 *
 * BAGIAN 2 (widowhood interval): union berpasangan tepat 2 spouse,
 * keduanya deathDate EXACT dan sex berbeda (satu M satu F). Interval =
 * tahun penuh antara kematian yang lebih dulu dan kematian pasangan,
 * dihitung via selisih tuple tahun-bulan-hari (anniversary belum
 * tercapai: kurangi 1), nilai absolut. Interval milik sex survivor
 * (yang mati lebih dulu). Tanggal kematian sama persis: pasangan
 * GUGUR karena tidak deterministik siapa yang lebih dulu.
 *
 * Parser strict (pola v308-v324): parseFamilyUnions LEMPAR Error
 * dengan nama field dan indeks saat payload salah bentuk, TANPA
 * silent-filter di level parser.
 *
 * Deterministik: tanpa jam sistem, tanpa randomness, agregasi per
 * kunci (dekade, sex) sehingga urutan input tidak mengubah output.
 */

/** Tanggal terstruktur ala kolom PartialDate (subset yang relevan). */
export interface StdDate {
  /** "EXACT" untuk tanggal pasti; kind lain ekuivalen null di hitungan. */
  dateKind: string
  yearStart: number | null
  monthStart: number | null
  dayStart: number | null
}

export interface FamilyUnionSpouse {
  id: string
  sex: 'M' | 'F'
  deathDate: StdDate | null
}

export interface FamilyUnionInput {
  unionId: string
  marriageDate: StdDate | null
  divorceDate: StdDate | null
  spouses: FamilyUnionSpouse[]
}

export interface DivorceDecadeRow {
  decadeStart: number
  label: string
  denominator: number
  divorces: number
  ratePct: number
}

export interface WidowhoodSurvivorRow {
  sex: 'M' | 'F'
  count: number
  /** Median interval tahun penuh, round 1 desimal; null bila nihil. */
  medianYears: number | null
  /** Interval terurut menaik. */
  intervals: number[]
}

export interface DivorceWidowhoodPayload {
  decades: DivorceDecadeRow[]
  widowhood: { survivors: WidowhoodSurvivorRow[] }
  totalUnions: number
  exactMarriages: number
  divorces: number
  widowhoodPairs: number
}

interface Ymd {
  y: number
  m: number
  d: number
}

/**
 * Tanggal EXACT dengan komponen kalender lengkap. dateKind selain
 * EXACT atau komponen null menghasilkan null (pola v280 marriage-age).
 */
function exactYmd(date: StdDate | null): Ymd | null {
  if (date === null) return null
  if (date.dateKind !== 'EXACT') return null
  const { yearStart, monthStart, dayStart } = date
  if (yearStart === null || monthStart === null || dayStart === null) return null
  return { y: yearStart, m: monthStart, d: dayStart }
}

/** Perbandingan tuple kalender: -1 saat a lebih awal, 1 saat a lebih akhir, 0 sama. */
function compareYmd(a: Ymd, b: Ymd): number {
  if (a.y !== b.y) return a.y < b.y ? -1 : 1
  if (a.m !== b.m) return a.m < b.m ? -1 : 1
  if (a.d !== b.d) return a.d < b.d ? -1 : 1
  return 0
}

/**
 * Tahun penuh dari from ke to (pola v267 living-stats): anniversary
 * belum tercapai pada tanggal to, hasil dikurangi 1.
 */
function fullYears(from: Ymd, to: Ymd): number {
  let years = to.y - from.y
  if (to.m < from.m || (to.m === from.m && to.d < from.d)) years -= 1
  return years
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
function assertSpouse(raw: unknown, ui: number, si: number): FamilyUnionSpouse {
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
function assertUnion(raw: unknown, index: number): FamilyUnionInput {
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
    divorceDate: rec.divorceDate === null ? null : assertStdDate(rec.divorceDate, `unions[${index}].divorceDate`),
    spouses: rec.spouses.map((sp, si) => assertSpouse(sp, index, si)),
  }
}

/**
 * Parser strict payload union. LEMPAR Error pada bentuk salah dengan
 * indeks dan nama field; TANPA silent-filter.
 */
export function parseFamilyUnions(raw: unknown): FamilyUnionInput[] {
  if (!Array.isArray(raw)) {
    throw new Error('unions: payload bukan array')
  }
  return raw.map((item, index) => assertUnion(item, index))
}

/**
 * Hitung divorce cohort rate per dekade dan widowhood interval per
 * sex survivor dari union yang sudah tervalidasi. Payload utuh
 * dikembalikan apa pun isi input; input kosong menghasilkan decades
 * dan survivors kosong tanpa throw.
 */
export function computeDivorceWidowhood(unions: FamilyUnionInput[]): DivorceWidowhoodPayload {
  // Agregasi dekade per kunci sehingga urutan input tak mengubah hasil.
  const byDecade = new Map<number, { denominator: number; divorces: number }>()
  let exactMarriages = 0
  let divorces = 0

  for (const union of unions) {
    const marriage = exactYmd(union.marriageDate)
    const divorce = exactYmd(union.divorceDate)
    if (divorce !== null) divorces += 1
    if (marriage === null) continue
    exactMarriages += 1
    const decadeStart = Math.floor(marriage.y / 10) * 10
    const cell = byDecade.get(decadeStart) ?? { denominator: 0, divorces: 0 }
    cell.denominator += 1
    if (divorce !== null) cell.divorces += 1
    byDecade.set(decadeStart, cell)
  }

  const decades: DivorceDecadeRow[] = [...byDecade.entries()]
    .filter(([, cell]) => cell.denominator > 0)
    .sort((a, b) => a[0] - b[0])
    .map(([decadeStart, cell]) => ({
      decadeStart,
      label: `${decadeStart}s`,
      denominator: cell.denominator,
      divorces: cell.divorces,
      ratePct: Math.round((cell.divorces / cell.denominator) * 1000) / 10,
    }))

  // Widowhood: interval milik sex survivor (yang mati lebih dulu).
  const bySex = new Map<'M' | 'F', number[]>()
  let widowhoodPairs = 0

  for (const union of unions) {
    if (union.spouses.length !== 2) continue
    const [a, b] = union.spouses
    if (a.sex === b.sex) continue
    const deathA = exactYmd(a.deathDate)
    const deathB = exactYmd(b.deathDate)
    if (deathA === null || deathB === null) continue
    const cmp = compareYmd(deathA, deathB)
    if (cmp === 0) continue
    const earlier = cmp < 0 ? { spouse: a, death: deathA } : { spouse: b, death: deathB }
    const later = cmp < 0 ? deathB : deathA
    const interval = Math.abs(fullYears(earlier.death, later))
    const list = bySex.get(earlier.spouse.sex) ?? []
    list.push(interval)
    bySex.set(earlier.spouse.sex, list)
    widowhoodPairs += 1
  }

  const survivors: WidowhoodSurvivorRow[] = (['M', 'F'] as const)
    .filter((sex) => bySex.has(sex))
    .map((sex) => {
      const intervals = [...(bySex.get(sex) ?? [])].sort((x, y) => x - y)
      const n = intervals.length
      let median: number | null = null
      if (n > 0) {
        const mid = Math.floor(n / 2)
        const rawMedian = n % 2 === 1 ? intervals[mid] : (intervals[mid - 1] + intervals[mid]) / 2
        median = Math.round(rawMedian * 10) / 10
      }
      return { sex, count: n, medianYears: median, intervals }
    })

  return {
    decades,
    widowhood: { survivors },
    totalUnions: unions.length,
    exactMarriages,
    divorces,
    widowhoodPairs,
  }
}

/** Pipeline penuh: validasi strict lalu hitung. */
export function divorceWidowhoodFromRaw(raw: unknown): DivorceWidowhoodPayload {
  return computeDivorceWidowhood(parseFamilyUnions(raw))
}
