/**
 * Death pyramid per birth century (v330 fase i): modul PURE untuk
 * piramida umur kematian, satu seri per sex (female, male) per
 * kohort abad kelahiran. Jangkar: wt_statistic.php baris 527-535
 * getDeathsByCenturyAgeBandSex delegasi LifeSpanRepository
 * ::deathsByCenturyAgeBandSex, pakan widget population pyramid
 * tab LifeSpan.
 *
 * DEFINISI: umur = fullYears anniversary-aware dari birthDate ke
 * deathDate, hanya tanggal EXACT lengkap y+m+d yang dihitung;
 * bentuk parsial, non-EXACT, atau umur negatif dibuang diam.
 * Kohort = abad kelahiran floor(birthYear/100)*100.
 *
 * Band 10 tahun label 'n-m' (0-9, 10-19, dst) naik. Guard
 * MIN_SAMPLES 10: TOTAL sampel kohort (female plus male, sex U
 * tidak dihitung) di bawah ambang membuang kohort utuh, bukan
 * per baris band. Baris band keluaran adalah rentang trim:
 * band kosong di ujung awal dan akhir dibuang, band kosong
 * interior dipertahankan apa adanya (0/0).
 * sex U masuk counter excludedUnknownSex, tidak masuk seri.
 *
 * Parser strict (pola v308 sampai v329): parseDeathPyramidPersons
 * LEMPAR Error ber-index dengan prefiks death-pyramid saat payload
 * salah; tanggal tidak valid diabaikan per orang, BUKAN throw.
 *
 * Deterministik murni: tanpa I/O, tanpa Date.now, tanpa random.
 */

/** Tanggal terstruktur ala kolom PartialDate (subset relevan). */
export interface DeathPyramidGedDate {
  /** "EXACT" untuk tanggal pasti; kind lain mengecualikan orang. */
  dateKind: string
  yearStart: number | null
  monthStart: number | null
  dayStart: number | null
}

/** Satu orang: tanggal lahir, tanggal wafat, sex F M U. */
export interface DeathPyramidPerson {
  birthDate: DeathPyramidGedDate | null
  deathDate: DeathPyramidGedDate | null
  sex: 'F' | 'M' | 'U'
}

/** Satu baris band piramida label 'n-m' per seri sex. */
export interface DeathPyramidBand {
  band: string
  female: number
  male: number
}

/** Satu kohort abad kelahiran beserta baris band lolos guard. */
export interface DeathPyramidCohort {
  century: number
  bands: DeathPyramidBand[]
  excludedUnknownSex: number
}

/** Hasil akhir: daftar kohort terurut naik. */
export interface DeathPyramidResult {
  cohorts: DeathPyramidCohort[]
}

/** Tanggal kalender sederhana hasil parsing EXACT. */
interface Ymd {
  y: number
  m: number
  d: number
}

/** Lebar band piramida dalam tahun (kontrak fase i). */
const BAND_SPAN = 10

/**
 * Ambang minimum sampel PER KOHORT: total female plus male dari
 * semua band (sex U tidak dihitung). Guard tampilan, bukan turunan
 * ambang standar lembaga (lihat catatan riset di bawah).
 */
const MIN_SAMPLES = 10

/** Tanggal EXACT lengkap; bulan 1-12, hari 1-31, komponen tanpa null. */
function exactYmd(date: DeathPyramidGedDate | null): Ymd | null {
  if (date === null) return null
  if (date.dateKind !== 'EXACT') return null
  const { yearStart, monthStart, dayStart } = date
  if (yearStart === null || monthStart === null || dayStart === null) return null
  if (monthStart < 1 || monthStart > 12) return null
  if (dayStart < 1 || dayStart > 31) return null
  return { y: yearStart, m: monthStart, d: dayStart }
}

/** Umur tahun penuh antara dua tanggal kalender (pola v267 v329). */
function fullYears(from: Ymd, to: Ymd): number {
  let age = to.y - from.y
  if (to.m < from.m || (to.m === from.m && to.d < from.d)) age -= 1
  return age
}

/** Akumulator per kohort: hitungan umur per seri plus counter U. */
interface CohortAcc {
  female: Map<number, number>
  male: Map<number, number>
  unknown: number
  maxAge: number
}

/**
 * Piramida kematian per kohort abad kelahiran: band 10 tahun,
 * seri female dan male independen, guard MIN_SAMPLES per TOTAL
 * sampel kohort (female plus male), trim hanya band kosong di
 * ujung awal dan akhir, output terurut naik per kohort dan per
 * band. Band kosong interior ikut terpush.
 *
 * Catatan riset 1: piramida resmi lembaga statistik (Census
 * International Data Base, Eurostat demo_pjangroup, UN WPP 2024)
 * berbasis PERIOD (kematian dalam window waktu), sedangkan
 * dimensi abad kelahiran di modul ini ekstensi genealogis yang
 * menganalogikan analisis kohort klasik; jangan diklaim setara
 * standar lembaga.
 * Catatan riset 2: MIN_SAMPLES 10 adalah guard keterbacaan
 * tampilan agar piramida tak berisik di sampel kecil, bukan
 * turunan ambang statistik standar lembaga mana pun.
 */
export function computeDeathPyramid(persons: DeathPyramidPerson[]): DeathPyramidResult {
  const cohorts = new Map<number, CohortAcc>()
  for (const person of persons) {
    const birth = exactYmd(person.birthDate)
    if (birth === null) continue
    const death = exactYmd(person.deathDate)
    if (death === null) continue
    const age = fullYears(birth, death)
    if (age < 0) continue
    const century = Math.floor(birth.y / 100) * 100
    let acc = cohorts.get(century)
    if (acc === undefined) {
      acc = { female: new Map(), male: new Map(), unknown: 0, maxAge: 0 }
      cohorts.set(century, acc)
    }
    if (age > acc.maxAge) acc.maxAge = age
    if (person.sex === 'F') {
      acc.female.set(age, (acc.female.get(age) ?? 0) + 1)
    } else if (person.sex === 'M') {
      acc.male.set(age, (acc.male.get(age) ?? 0) + 1)
    } else {
      acc.unknown += 1
    }
  }
  const result: DeathPyramidCohort[] = []
  const centuries = [...cohorts.keys()].sort((a, b) => a - b)
  for (const century of centuries) {
    const acc = cohorts.get(century)
    if (acc === undefined) continue
    // Guard PER KOHORT: total sampel F+M dari semua band; sex U
    // tidak dihitung. Di bawah ambang: kohort utuh dibuang.
    let totalSamples = 0
    for (const value of acc.female.values()) totalSamples += value
    for (const value of acc.male.values()) totalSamples += value
    if (totalSamples < MIN_SAMPLES) continue
    const bandCount = Math.floor(acc.maxAge / BAND_SPAN) + 1
    const bands: DeathPyramidBand[] = []
    for (let i = 0; i < bandCount; i += 1) {
      const start = i * BAND_SPAN
      let female = 0
      let male = 0
      for (let age = start; age < start + BAND_SPAN; age += 1) {
        female += acc.female.get(age) ?? 0
        male += acc.male.get(age) ?? 0
      }
      bands.push({ band: `${start}-${start + BAND_SPAN - 1}`, female, male })
    }
    // Trim hanya ujung: band kosong leading dan trailing dibuang,
    // band interior kosong (0/0) dipertahankan apa adanya. Pas
    // firstIdx dan lastIdx pasti ada karena totalSamples >= 10.
    const firstIdx = bands.findIndex((b) => b.female + b.male >= 1)
    const lastIdx = bands.findLastIndex((b) => b.female + b.male >= 1)
    result.push({
      century,
      bands: bands.slice(firstIdx, lastIdx + 1),
      excludedUnknownSex: acc.unknown,
    })
  }
  return { cohorts: result }
}

/** Validasi satu GedDate; null sah, bentuk salah LEMPAR Error. */
function assertDate(raw: unknown, index: number, field: string): DeathPyramidGedDate | null {
  if (raw === null || raw === undefined) return null
  if (typeof raw !== 'object') {
    throw new Error(`death-pyramid person[${index}].${field}: bukan objek atau null`)
  }
  const date = raw as Record<string, unknown>
  for (const part of ['dateKind', 'yearStart', 'monthStart', 'dayStart'] as const) {
    if (!(part in date)) {
      throw new Error(`death-pyramid person[${index}].${field}.${part}: hilang`)
    }
  }
  if (typeof date.dateKind !== 'string') {
    throw new Error(`death-pyramid person[${index}].${field}.dateKind: bukan string`)
  }
  for (const part of ['yearStart', 'monthStart', 'dayStart'] as const) {
    const value = date[part]
    if (value !== null && typeof value !== 'number') {
      throw new Error(`death-pyramid person[${index}].${field}.${part}: bukan number atau null`)
    }
  }
  return {
    dateKind: date.dateKind,
    yearStart: date.yearStart as number | null,
    monthStart: date.monthStart as number | null,
    dayStart: date.dayStart as number | null,
  }
}

/** Validasi satu orang ber-index; sex wajib F M U. */
function assertPerson(raw: unknown, index: number): DeathPyramidPerson {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error(`death-pyramid person[${index}]: hilang atau bukan objek`)
  }
  const person = raw as Record<string, unknown>
  if (!('birthDate' in person)) {
    throw new Error(`death-pyramid person[${index}].birthDate: hilang`)
  }
  if (!('deathDate' in person)) {
    throw new Error(`death-pyramid person[${index}].deathDate: hilang`)
  }
  if (typeof person.sex !== 'string' || !['F', 'M', 'U'].includes(person.sex)) {
    throw new Error(`death-pyramid person[${index}].sex: bukan F M U`)
  }
  return {
    birthDate: assertDate(person.birthDate, index, 'birthDate'),
    deathDate: assertDate(person.deathDate, index, 'deathDate'),
    sex: person.sex as 'F' | 'M' | 'U',
  }
}

/**
 * Parser strict (pola couple-age-gap v318): menerima array objek
 * atau string JSON berisi array. Payload salah LEMPAR Error
 * ber-index dengan prefiks death-pyramid, tidak pernah silent-filter
 * di level struktur.
 */
export function parseDeathPyramidPersons(payload: unknown): DeathPyramidPerson[] {
  let raw: unknown[]
  if (typeof payload === 'string') {
    const parsed: unknown = JSON.parse(payload)
    if (!Array.isArray(parsed)) {
      throw new Error('death-pyramid: payload JSON bukan array')
    }
    raw = parsed
  } else {
    if (!Array.isArray(payload)) {
      throw new Error('death-pyramid: payload bukan array')
    }
    raw = payload
  }
  return raw.map((item, index) => assertPerson(item, index))
}
