/**
 * Mortality anomalies (v314 fase i): modul PURE untuk deteksi tahun
 * dengan jumlah kematian menyimpang dari baseline sekitarnya via
 * z-score, pilar statistik pohon VISION-stemmagraph. Jangkar:
 * magicsunday/webtrees-statistics getMortalityAnomalies (baris 579,
 * zScoreThreshold 2.0, topN 10, delegasi lifeSpanRepository).
 * Rujukan pola, bukan salinan kode. Tanpa import server/, tanpa
 * prisma, tanpa fetch: murni transformasi array entri menjadi angka.
 *
 * Kontrak: computeMortalityAnomalies(persons, options?) menerima
 * daftar entri { deathDate: string | null } dan menghasilkan daftar
 * tahun anomali { year, deaths, mean, stdev, zScore } dengan mean,
 * stdev, dan zScore dibulatkan 2 desimal. Baseline memakai rentang
 * tahun minimum sampai maksimum kematian yang zero-filled (tahun
 * tanpa kematian tetap masuk), simpangan baku POPULASI (pembagi N).
 * stdev nol atau rentang kosong menghasilkan array kosong, bukan NaN.
 *
 * Parsing strict pola v312: format bukan YYYY-MM-DD valid, bulan
 * atau tanggal di luar kalender (termasuk kabisat), tahun 0000, atau
 * tipe selain string dan null DILEMPAR Error, bukan difilter
 * diam-diam (preseden koreksi QA v308). Person dengan deathDate null
 * diabaikan. Tanggal BCE atau non-Gregorian yang gagal parse juga
 * melempar Error dengan pesan eksplisit.
 *
 * Deterministik: nihil randomness, nihil jam sistem di jalur data.
 */

export interface MortalityPerson {
  deathDate: string | null
}

export interface MortalityAnomaly {
  year: number
  deaths: number
  mean: number
  stdev: number
  zScore: number
}

export interface MortalityAnomaliesOptions {
  zScoreThreshold?: number
  topN?: number
}

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

function daysInMonth(year: number, month: number): number {
  const lengths = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  if (month === 2 && isLeapYear(year)) return 29
  return lengths[month - 1]
}

function parseDeathYear(raw: string): number {
  if (!DATE_PATTERN.test(raw)) {
    throw new Error(
      `Invalid deathDate format: ${JSON.stringify(raw)}, expected strict YYYY-MM-DD (BCE and non-Gregorian dates are out of scope)`,
    )
  }
  const year = Number(raw.slice(0, 4))
  const month = Number(raw.slice(5, 7))
  const day = Number(raw.slice(8, 10))
  const yearValid = year >= 1 && year <= 9999
  const monthValid = month >= 1 && month <= 12
  const dayValid = day >= 1 && day <= daysInMonth(year, month)
  if (!yearValid || !monthValid || !dayValid) {
    throw new Error(`Invalid calendar deathDate: ${raw}`)
  }
  return year
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

export function computeMortalityAnomalies(
  persons: readonly MortalityPerson[],
  options: MortalityAnomaliesOptions = {},
): MortalityAnomaly[] {
  const zScoreThreshold = options.zScoreThreshold ?? 2.0
  const topN = options.topN ?? 10

  const deathsByYear = new Map<number, number>()
  for (const person of persons) {
    if (person.deathDate === null) continue
    if (typeof person.deathDate !== 'string') {
      throw new Error(
        `Invalid deathDate type: ${typeof person.deathDate}, expected string or null`,
      )
    }
    const year = parseDeathYear(person.deathDate)
    deathsByYear.set(year, (deathsByYear.get(year) ?? 0) + 1)
  }

  if (deathsByYear.size === 0) return []

  const years = [...deathsByYear.keys()].sort((a, b) => a - b)
  const minYear = years[0]
  const maxYear = years[years.length - 1]

  const counts: number[] = []
  for (let year = minYear; year <= maxYear; year += 1) {
    counts.push(deathsByYear.get(year) ?? 0)
  }

  const n = counts.length
  const mean = counts.reduce((sum, count) => sum + count, 0) / n
  const variance =
    counts.reduce((sum, count) => sum + (count - mean) ** 2, 0) / n
  const stdev = Math.sqrt(variance)

  if (stdev === 0) return []

  const anomalies: Array<{ year: number; deaths: number; zScore: number }> = []
  for (let index = 0; index < n; index += 1) {
    const zScore = (counts[index] - mean) / stdev
    if (zScore >= zScoreThreshold) {
      anomalies.push({ year: minYear + index, deaths: counts[index], zScore })
    }
  }

  anomalies.sort((a, b) => {
    if (b.zScore !== a.zScore) return b.zScore - a.zScore
    return a.year - b.year
  })

  return anomalies.slice(0, topN).map(anomaly => ({
    year: anomaly.year,
    deaths: anomaly.deaths,
    mean: round2(mean),
    stdev: round2(stdev),
    zScore: round2(anomaly.zScore),
  }))
}
