/**
 * Survival curve kohort kelahiran (v307 fase i): modul PURE untuk kurva
 * kelangsungan hidup per dekade kelahiran, pilar deret demografi
 * VISION-stemmagraph. Jangkar: magicsunday/webtrees-statistics tab
 * Life span. Tanpa import server/, tanpa prisma, tanpa fetch, tanpa
 * jaringan: murni transformasi array member menjadi angka.
 *
 * Kontrak: computeSurvivalCurve(members, opts?) mengelompokkan anggota
 * per dekade kelahiran (kunci "1970s", default). opts.cohortDecade
 * false menggabungkan seluruh anggota ke satu kohort "all". Kohort
 * tanpa anggota tidak masuk output; decade ASC; grid umur ASC.
 *
 * Semantik selamat pada tanda umur A (whole years anniversary-aware,
 * pola v301: belum ulang tahun tahun itu tidak naik):
 *   meninggal sebelum umur A = tidak selamat pada A;
 *   hidup, atau meninggal pada atau sesudah umur A = selamat pada A.
 *
 * Catatan metodologi jujur (censored right): anggota yang masih hidup
 * dihitung selamat di SEMUA titik grid. Data tidak memberi tahu apakah
 * mereka nanti mencapai umur tertinggi kohort lain, sehingga fraksi
 * survival berpotensi dioverestimasi di umur tinggi. Pilihan ini
 * konsisten dengan jangkar Life span dan realita data silsilah yang
 * tidak memiliki tanggal kematian untuk anggota hidup.
 *
 * Parsing strict YYYY-MM-DD pola v301: tanggal tidak valid secara
 * kalender (termasuk kabisat) atau format salah DILEMPAR Error.
 * deathDate sebelum birthDate DIBUANG dari kohort (pola v310).
 *
 * Deterministik: nihil randomness, nihil jam sistem di jalur data.
 * Agregasi hitung per kunci dekade sehingga urutan input tidak
 * memengaruhi output. survivalFraction dibulatkan 2 desimal.
 */

export interface SurvivalMember {
  birthDate: string
  deathDate: string | null
}

export interface SurvivalPoint {
  age: number
  aliveCount: number
  survivalFraction: number
}

export interface SurvivalCohortResult {
  decade: string
  cohortSize: number
  survivorsAtAges: SurvivalPoint[]
}

export interface SurvivalCurveOptions {
  /** true (default): kohort per dekade kelahiran ("1970s"). false: satu kohort "all". */
  cohortDecade?: boolean
}

interface ParsedDate {
  iso: string
  year: number
  month: number
  day: number
  serial: number
}

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

/** Grid tanda umur tetap: 0 sampai 100 step 10 (11 titik). */
export const SURVIVAL_AGES: readonly number[] = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]

const SINGLE_COHORT_KEY = 'all'

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

function daysInMonth(year: number, month: number): number {
  const lengths = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  if (month === 2 && isLeapYear(year)) return 29
  return lengths[month - 1]
}

function parseStrictIsoDate(raw: string, field: 'birthDate' | 'deathDate'): ParsedDate {
  if (typeof raw !== 'string' || !DATE_PATTERN.test(raw)) {
    throw new Error(`Invalid ${field} format: ${JSON.stringify(raw)}, expected strict YYYY-MM-DD`)
  }
  const year = Number(raw.slice(0, 4))
  const month = Number(raw.slice(5, 7))
  const day = Number(raw.slice(8, 10))
  const monthValid = month >= 1 && month <= 12
  const dayValid = day >= 1 && day <= daysInMonth(year, month)
  if (!monthValid || !dayValid) {
    throw new Error(`Invalid calendar ${field}: ${raw}`)
  }
  const serial = Date.UTC(year, month - 1, day)
  return { iso: raw, year, month, day, serial }
}

/** Umur penuh anniversary-aware: belum ulang tahun tahun itu tidak naik (pola v301). */
function wholeYearsAt(birth: ParsedDate, at: ParsedDate): number {
  const years = at.year - birth.year
  const reachedAnniversary =
    at.month > birth.month || (at.month === birth.month && at.day >= birth.day)
  return reachedAnniversary ? years : years - 1
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

interface CohortEntry {
  decadeStart: number
  ageAtDeath: number | null
}

export function computeSurvivalCurve(
  members: SurvivalMember[],
  opts?: SurvivalCurveOptions,
): SurvivalCohortResult[] {
  const groupByDecade = opts?.cohortDecade !== false

  const entries: CohortEntry[] = []
  for (const member of members) {
    const birth = parseStrictIsoDate(member.birthDate, 'birthDate')
    const decadeStart = Math.floor(birth.year / 10) * 10
    if (member.deathDate === null || member.deathDate === undefined) {
      entries.push({ decadeStart, ageAtDeath: null })
      continue
    }
    const death = parseStrictIsoDate(member.deathDate, 'deathDate')
    if (death.serial < birth.serial) {
      continue
    }
    entries.push({ decadeStart, ageAtDeath: wholeYearsAt(birth, death) })
  }

  const cohorts = new Map<number, Array<number | null>>()
  for (const entry of entries) {
    let cohort = cohorts.get(entry.decadeStart)
    if (!cohort) {
      cohort = []
      cohorts.set(entry.decadeStart, cohort)
    }
    cohort.push(entry.ageAtDeath)
  }

  const sortedDecades = [...cohorts.keys()].sort((a, b) => a - b)

  const results: SurvivalCohortResult[] = []
  for (const decadeStart of sortedDecades) {
    const cohort = cohorts.get(decadeStart) ?? []
    const cohortSize = cohort.length
    if (cohortSize === 0) {
      continue
    }
    const survivorsAtAges: SurvivalPoint[] = SURVIVAL_AGES.map(age => {
      const aliveCount = cohort.reduce(
        (count, ageAtDeath) =>
          ageAtDeath === null || ageAtDeath >= age ? count + 1 : count,
        0,
      )
      return { age, aliveCount, survivalFraction: round2(aliveCount / cohortSize) }
    })
    results.push({
      decade: groupByDecade ? `${decadeStart}s` : SINGLE_COHORT_KEY,
      cohortSize,
      survivorsAtAges,
    })
  }

  return results
}
