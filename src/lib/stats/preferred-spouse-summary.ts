/**
 * Preferred spouse summary (v374 GAP #6): modul PURE untuk ringkasan
 * pasangan prefer pada individu multi-pernikahan, pilar statistik
 * keluarga VISION-stemmagraph. Jangkar semantik: webtrees
 * Individual.php getCurrentSpouse() yang mengambil
 * spouseFamilies()->last() lalu family->spouse(this). Asumsi
 * webtrees: FAMS tersimpan urutan kronologis, pasangan prefer adalah
 * pasangan pada family TERAKHIR urutan input. Individu tanpa FAMS
 * tidak punya pasangan prefer. Rujukan pola parser strict:
 * divorce-rate-by-marriage-cohort.ts dan
 * average-family-size-by-century.ts. Rujukan pola, bukan salinan
 * kode. Tanpa import server/, tanpa prisma, tanpa fetch, tanpa Date
 * sistem, tanpa I/O: murni transformasi array menjadi angka.
 *
 * Kontrak: computePreferredSpouseSummary(payload) menerima objek
 * { individuals, families }.
 *   individuals: array { id: string; birthDate: string | null;
 *     fams: string[] }, fams urutan input family (kronologis).
 *   families: array { familyId: string; marriageDate:
 *     string | null; husbandId: string | null; wifeId:
 *     string | null }.
 *
 * Semantik per individu dengan fams:
 *   - family terakhir = fams[fams.length - 1].
 *   - family tidak ditemukan di families, individu tidak terdaftar
 *     sebagai husband/wife di family itu, atau slot pasangan kosong:
 *     preferredSpouseUnresolved, bukan error.
 *   - slot pasangan terisi: preferredSpouseResolved, pasangan prefer
 *     adalah orang di slot seberang.
 * Invariant: resolved + unresolved = individualsWithFams.
 *
 * Output payload:
 *   - individualsTotal: jumlah seluruh individu input.
 *   - individualsWithFams: individu dengan minimal satu fams.
 *   - preferredSpouseResolved / preferredSpouseUnresolved.
 *   - marriageIndexDistribution: pasangan prefer = pernikahan ke-1,
 *     ke-2, ke-3plus; kunci '1', '2', '3plus'; index = panjang fams
 *     individu (family terakhir selalu pernikahan terakhir); hanya
 *     resolved yang masuk distribusi, sehingga jumlah ketiga kunci
 *     = preferredSpouseResolved. Kunci selalu lengkap.
 *   - averageAgeGapAtMarriage: rata-rata selisih usia absolut
 *     individu vs pasangan prefer pada tanggal pernikahan family
 *     terakhir, dibulatkan 2 desimal (pola v370/v371). Hanya
 *     pasangan dengan birthDate individu, birthDate pasangan, dan
 *     marriageDate ketiganya tanggal valid; usia tahun penuh pola
 *     marriage-age (usia negatif atau pernikahan sebelum lahir
 *     di-skip). Tanpa data valid = null.
 *
 * Parsing strict ber-index pola v370/v373 (prefiks
 * preferred-spouse-summary): payload bukan objek, individuals atau
 * families bukan array, entri bukan objek, id atau familyId bukan
 * string atau string kosong, birthDate atau marriageDate tipe salah,
 * format bukan YYYY-MM-DD, bulan di luar 1 sampai 12, tanggal tidak
 * valid kalender termasuk 29 Feb non-kabisat, fams bukan array,
 * elemen fams bukan string atau kosong, husbandId atau wifeId bukan
 * string atau null, id individu duplikat, atau familyId duplikat
 * DILEMPAR Error ber-index, bukan difilter diam-diam. Input kosong
 * valid, menghasilkan payload nol dengan averageAgeGapAtMarriage
 * null.
 *
 * Deterministik: agregasi penghitung murni, urutan input stabil,
 * hasil identik untuk input identik. Nihil randomness, nihil jam
 * sistem, nihil I/O di jalur data.
 */

export interface PreferredSpouseIndividualInput {
  id: string
  birthDate: string | null
  fams: string[]
}

export interface PreferredSpouseFamilyInput {
  familyId: string
  marriageDate: string | null
  husbandId: string | null
  wifeId: string | null
}

export interface PreferredSpouseSummaryPayload {
  individuals: PreferredSpouseIndividualInput[]
  families: PreferredSpouseFamilyInput[]
}

export interface PreferredSpouseSummaryResult {
  individualsTotal: number
  individualsWithFams: number
  preferredSpouseResolved: number
  preferredSpouseUnresolved: number
  marriageIndexDistribution: {
    '1': number
    '2': number
    '3plus': number
  }
  averageAgeGapAtMarriage: number | null
}

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/
const ERROR_PREFIX = 'preferred-spouse-summary'

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

function daysInMonth(year: number, month: number): number {
  const lengths = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  if (month === 2 && isLeapYear(year)) return 29
  return lengths[month - 1]
}

interface Ymd {
  y: number
  m: number
  d: number
}

/** Tanggal ISO strict menjadi tuple kalender; input sudah tervalidasi. */
function toYmd(iso: string): Ymd {
  return {
    y: Number(iso.slice(0, 4)),
    m: Number(iso.slice(5, 7)),
    d: Number(iso.slice(8, 10)),
  }
}

/** Usia tahun penuh dari lahir ke acuan (pola marriage-age v280). */
function fullYears(from: Ymd, to: Ymd): number {
  let age = to.y - from.y
  if (to.m < from.m || (to.m === from.m && to.d < from.d)) age -= 1
  return age
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

/**
 * Tanggal ISO strict pola v370: string YYYY-MM-DD valid kalender atau
 * null. Selain itu lempar Error ber-path.
 */
function parseStrictIsoDate(raw: unknown, path: string): string | null {
  if (raw === null) return null
  if (typeof raw !== 'string') {
    throw new Error(`${ERROR_PREFIX}: ${path} harus string atau null`)
  }
  if (!DATE_PATTERN.test(raw)) {
    throw new Error(`${ERROR_PREFIX}: ${path} format bukan YYYY-MM-DD`)
  }
  const year = Number(raw.slice(0, 4))
  const month = Number(raw.slice(5, 7))
  const day = Number(raw.slice(8, 10))
  if (month < 1 || month > 12) {
    throw new Error(`${ERROR_PREFIX}: ${path} bulan di luar 1 sampai 12`)
  }
  if (day < 1 || day > daysInMonth(year, month)) {
    throw new Error(`${ERROR_PREFIX}: ${path} bukan tanggal kalender valid`)
  }
  return raw
}

/** Slot pasangan string valid atau null; kosong dan salah tipe ditolak. */
function parseSpouseSlot(raw: unknown, path: string): string | null {
  if (raw === null) return null
  if (typeof raw !== 'string') {
    throw new Error(`${ERROR_PREFIX}: ${path} harus string atau null`)
  }
  if (raw.length === 0) {
    throw new Error(`${ERROR_PREFIX}: ${path} tidak boleh string kosong`)
  }
  return raw
}

export function computePreferredSpouseSummary(
  payload: unknown,
): PreferredSpouseSummaryResult {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    throw new Error(`${ERROR_PREFIX}: payload harus objek`)
  }
  const envelope = payload as Record<string, unknown>
  if (!Array.isArray(envelope.individuals)) {
    throw new Error(`${ERROR_PREFIX}: individuals harus array`)
  }
  if (!Array.isArray(envelope.families)) {
    throw new Error(`${ERROR_PREFIX}: families harus array`)
  }

  const families = new Map<string, PreferredSpouseFamilyInput>()
  envelope.families.forEach((entry, index) => {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
      throw new Error(`${ERROR_PREFIX}: families index ${index} bukan objek`)
    }
    const record = entry as Record<string, unknown>
    if (typeof record.familyId !== 'string') {
      throw new Error(`${ERROR_PREFIX}: families index ${index} familyId harus string`)
    }
    if (record.familyId.length === 0) {
      throw new Error(`${ERROR_PREFIX}: families index ${index} familyId tidak boleh string kosong`)
    }
    if (families.has(record.familyId)) {
      throw new Error(`${ERROR_PREFIX}: families index ${index} familyId duplikat`)
    }
    const family: PreferredSpouseFamilyInput = {
      familyId: record.familyId,
      marriageDate: parseStrictIsoDate(
        record.marriageDate,
        `families index ${index} marriageDate`,
      ),
      husbandId: parseSpouseSlot(
        record.husbandId,
        `families index ${index} husbandId`,
      ),
      wifeId: parseSpouseSlot(record.wifeId, `families index ${index} wifeId`),
    }
    families.set(family.familyId, family)
  })

  const individuals: PreferredSpouseIndividualInput[] = []
  const birthByIndividual = new Map<string, string | null>()
  envelope.individuals.forEach((entry, index) => {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
      throw new Error(`${ERROR_PREFIX}: individuals index ${index} bukan objek`)
    }
    const record = entry as Record<string, unknown>
    if (typeof record.id !== 'string') {
      throw new Error(`${ERROR_PREFIX}: individuals index ${index} id harus string`)
    }
    if (record.id.length === 0) {
      throw new Error(`${ERROR_PREFIX}: individuals index ${index} id tidak boleh string kosong`)
    }
    if (birthByIndividual.has(record.id)) {
      throw new Error(`${ERROR_PREFIX}: individuals index ${index} id duplikat`)
    }
    if (!Array.isArray(record.fams)) {
      throw new Error(`${ERROR_PREFIX}: individuals index ${index} fams harus array`)
    }
    const fams: string[] = []
    record.fams.forEach((famId, famIndex) => {
      if (typeof famId !== 'string') {
        throw new Error(
          `${ERROR_PREFIX}: individuals index ${index} fams posisi ${famIndex} harus string`,
        )
      }
      if (famId.length === 0) {
        throw new Error(
          `${ERROR_PREFIX}: individuals index ${index} fams posisi ${famIndex} tidak boleh string kosong`,
        )
      }
      fams.push(famId)
    })
    const birthDate = parseStrictIsoDate(
      record.birthDate,
      `individuals index ${index} birthDate`,
    )
    individuals.push({ id: record.id, birthDate, fams })
    birthByIndividual.set(record.id, birthDate)
  })

  const individualsTotal = individuals.length
  let individualsWithFams = 0
  let preferredSpouseResolved = 0
  let preferredSpouseUnresolved = 0
  const marriageIndexDistribution = {
    '1': 0,
    '2': 0,
    '3plus': 0,
  }
  const ageGaps: number[] = []

  individuals.forEach((individual) => {
    if (individual.fams.length === 0) return
    individualsWithFams += 1

    const lastFamId = individual.fams[individual.fams.length - 1]
    const family = families.get(lastFamId)
    if (family === undefined) {
      preferredSpouseUnresolved += 1
      return
    }

    let spouseId: string | null = null
    if (family.husbandId === individual.id && family.wifeId !== null) {
      spouseId = family.wifeId
    } else if (family.wifeId === individual.id && family.husbandId !== null) {
      spouseId = family.husbandId
    }
    if (spouseId === null || spouseId === individual.id) {
      preferredSpouseUnresolved += 1
      return
    }

    preferredSpouseResolved += 1
    const ordinal = individual.fams.length
    if (ordinal === 1) {
      marriageIndexDistribution['1'] += 1
    } else if (ordinal === 2) {
      marriageIndexDistribution['2'] += 1
    } else {
      marriageIndexDistribution['3plus'] += 1
    }

    const marriageIso = family.marriageDate
    const individualIso = individual.birthDate
    const spouseIso = birthByIndividual.get(spouseId)
    if (spouseIso === undefined) {
      // Pasangan tidak terdaftar sebagai individu: tanpa birthDate.
      return
    }
    if (marriageIso === null || individualIso === null || spouseIso === null) {
      return
    }
    const marriage = toYmd(marriageIso)
    const ageIndividual = fullYears(toYmd(individualIso), marriage)
    const ageSpouse = fullYears(toYmd(spouseIso), marriage)
    if (ageIndividual < 0 || ageSpouse < 0) {
      // Pernikahan sebelum lahir pada salah satu pihak di-skip,
      return
    }
    ageGaps.push(Math.abs(ageIndividual - ageSpouse))
  })

  let averageAgeGapAtMarriage: number | null = null
  if (ageGaps.length > 0) {
    const sum = ageGaps.reduce((total, gap) => total + gap, 0)
    averageAgeGapAtMarriage = round2(sum / ageGaps.length)
  }

  return {
    individualsTotal,
    individualsWithFams,
    preferredSpouseResolved,
    preferredSpouseUnresolved,
    marriageIndexDistribution,
    averageAgeGapAtMarriage,
  }
}
