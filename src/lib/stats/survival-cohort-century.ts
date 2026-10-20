/**
 * Survival cohort century (v328 fase i): modul PURE untuk kurva
 * kelangsungan hidup per kohort ABAD kelahiran, pilar deret
 * demografi VISION-stemmagraph. Jangkar: magicsunday/webtrees-statistics
 * LifeSpanRepository baris 856 (tab Life span, kurva per abad
 * kelahiran). Metodologi kohort mengikuti lx tables Human Mortality
 * Database. Tanpa import server/, tanpa prisma, tanpa fetch, tanpa
 * jaringan: murni transformasi array member menjadi angka.
 *
 * Kontrak: computeSurvivalCohortCentury(members) mengelompokkan
 * anggota per abad kelahiran. Kunci kohort "1800s", "1900s", dst
 * dari floor(birthYear/100)*100. Tahun kecil (0000 sampai 0099)
 * jatuh ke kohort "0s"; aturan floor ini konsisten juga sebagai
 * lower bound bila suatu saat mempersoalkan tahun BCE negatif.
 * Kohort tanpa anggota tidak masuk output; century ASC; grid umur ASC.
 *
 * Grid umur dinamis per kohort: 0,10,20,... kelipatan 10 sampai
 * titik kelipatan 10 terbesar yang masih <= umur maksimum kohort
 * (pola survival-curve.ts, bedanya batas atas mengikuti kohort).
 * Kohort tanpa satu pun kematian memakai grid satu titik [0].
 *
 * Semantik selamat pada tanda umur A (whole years anniversary-aware,
 * pola v301/v307: belum ulang tahun tahun itu tidak naik):
 *   meninggal sebelum umur A = tidak selamat pada A;
 *   hidup, atau meninggal pada atau sesudah umur A = selamat pada A.
 *
 * Catatan metodologi jujur (censored right): anggota yang masih
 * hidup dihitung selamat di SEMUA titik grid. Data tidak memberi
 * tahu apakah mereka nanti mencapai umur tinggi, sehingga fraksi
 * survival berpotensi dioverestimasi di umur tinggi. Pilihan ini
 * konsisten dengan jangkar Life span dan realita data silsilah yang
 * tidak memiliki tanggal kematian untuk anggota hidup.
 *
 * Parsing strict YYYY-MM-DD pola v301/v307: format salah atau
 * tanggal tidak valid kalender (termasuk kabisat, 1900-02-29 gugur,
 * 2000-02-29 sah) DILEMPAR Error, TANPA silent-filter.
 * deathDate sebelum birthDate DIBUANG dari kohort (pola v310).
 *
 * Deterministik murni: nihil randomness, nihil I/O, nihil jam
 * sistem di jalur data. Agregasi hitung per kunci abad sehingga
 * urutan input tidak memengaruhi output. survivalFraction
 * dibulatkan 2 desimal; cohortSize integer.
 */

export interface SurvivalCohortMember {
  birthDate: string
  deathDate: string | null
}

export interface SurvivalCenturyPoint {
  age: number
  aliveCount: number
  survivalFraction: number
}

export interface SurvivalCenturyCohort {
  century: string
  cohortSize: number
  survivorsAtAges: SurvivalCenturyPoint[]
}

interface ParsedDate {
  iso: string
  year: number
  month: number
  day: number
  serial: number
}

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

/** Step grid umur: kelipatan 10 (pola survival-curve.ts). */
const AGE_STEP = 10

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
  centuryStart: number
  ageAtDeath: number | null
}

export function computeSurvivalCohortCentury(
  members: SurvivalCohortMember[],
): SurvivalCenturyCohort[] {
  const entries: CohortEntry[] = []
  for (const member of members) {
    const birth = parseStrictIsoDate(member.birthDate, 'birthDate')
    const centuryStart = Math.floor(birth.year / 100) * 100
    if (member.deathDate === null || member.deathDate === undefined) {
      entries.push({ centuryStart, ageAtDeath: null })
      continue
    }
    const death = parseStrictIsoDate(member.deathDate, 'deathDate')
    if (death.serial < birth.serial) {
      continue
    }
    entries.push({ centuryStart, ageAtDeath: wholeYearsAt(birth, death) })
  }

  const grouped = new Map<number, Array<number | null>>()
  for (const entry of entries) {
    let cohort = grouped.get(entry.centuryStart)
    if (!cohort) {
      cohort = []
      grouped.set(entry.centuryStart, cohort)
    }
    cohort.push(entry.ageAtDeath)
  }

  const centuryKeys = [...grouped.keys()].sort((a, b) => a - b)

  const results: SurvivalCenturyCohort[] = []
  for (const key of centuryKeys) {
    const cohort = grouped.get(key) ?? []
    const cohortSize = cohort.length
    if (cohortSize === 0) {
      continue
    }
    let maxAgeAtDeath = 0
    for (const ageAtDeath of cohort) {
      if (ageAtDeath !== null && ageAtDeath > maxAgeAtDeath) {
        maxAgeAtDeath = ageAtDeath
      }
    }
    const topAge = Math.floor(maxAgeAtDeath / AGE_STEP) * AGE_STEP
    const survivorsAtAges: SurvivalCenturyPoint[] = []
    for (let age = 0; age <= topAge; age += AGE_STEP) {
      const aliveCount = cohort.reduce(
        (count, ageAtDeath) =>
          ageAtDeath === null || ageAtDeath >= age ? count + 1 : count,
        0,
      )
      survivorsAtAges.push({ age, aliveCount, survivalFraction: round2(aliveCount / cohortSize) })
    }
    results.push({
      century: `${key}s`,
      cohortSize,
      survivorsAtAges,
    })
  }

  return results
}
