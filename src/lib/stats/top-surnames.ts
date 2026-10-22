/**
 * Frekuensi marga teratas (v363 fase i): modul PURE untuk deret demografi
 * Stemmagraph, pilar VISION-stemmagraph. Jangkar: magicsunday/
 * webtrees-statistics TopSurnamesRepository, keluarga modul sama dengan
 * given-name-trends v311 yang sudah merged. Tanpa import server/, tanpa
 * prisma, tanpa fetch, tanpa I/O: murni transformasi array member.
 *
 * Kontrak: computeTopSurnames(members, opts?) menghitung frekuensi marga
 * dinormalisasi plus window dekade agregat. Satu entri PER ORANG
 * { birthDate, surname }. Normalisasi surname: trim, fold case lowercase,
 * aksen dihapus (normalize NFD, strip range Mn), tanda baca dihapus.
 * Guard: placeholder @P.N. (diawali @) dan hasil kosong dibuang tanpa
 * error, orang itu gugur dari frekuensi.
 *
 * Parsing birthDate strict YYYY-MM-DD pola v311: format salah atau
 * tanggal tidak valid kalender (termasuk 29 Feb non-kabisat) DILEMPAR
 * Error ber-prefiks 'top-surnames'. birthDate WAJIB valid.
 *
 * Output: surnames urut count DESC, tie alfabetis ASC, dipotong topN
 * (default 10, clamp 1 sampai 50). totalSurnames = jumlah marga unik
 * valid SEBELUM pemotongan. window = dekade frekuensi marga agregat
 * tertinggi (floor(tahun/10)*10, label '1970s'), tie dekade lebih awal
 * menang, null saat tidak ada entri valid.
 *
 * Deterministik penuh: nihil randomness, nihil jam sistem di jalur data,
 * urutan input tidak memengaruhi hasil (agregasi Map per kunci lalu
 * sortir eksplisit, termasuk kandidat window yang diurut dekade ASC
 * sebelum pemilihan max sehingga tie selalu jatuh ke dekade terawal).
 */

export interface SurnameMember {
  birthDate: string
  surname: string
}

export interface SurnameEntry {
  surname: string
  count: number
}

export interface TopSurnamesResult {
  surnames: SurnameEntry[]
  totalSurnames: number
  window: { decade: string, count: number } | null
}

export interface TopSurnamesOptions {
  /** Jumlah marga teratas pada output. Default 10, clamp ke rentang 1 sampai 50. */
  topN?: number
}

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/
const DEFAULT_TOP_N = 10
const MIN_TOP_N = 1
const MAX_TOP_N = 50

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

function daysInMonth(year: number, month: number): number {
  const lengths = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  if (month === 2 && isLeapYear(year)) return 29
  return lengths[month - 1]
}

function parseStrictIsoDate(raw: unknown): number {
  if (typeof raw !== 'string' || !DATE_PATTERN.test(raw)) {
    throw new Error(`top-surnames: invalid birthDate format: ${JSON.stringify(raw)}, expected strict YYYY-MM-DD`)
  }
  const year = Number(raw.slice(0, 4))
  const month = Number(raw.slice(5, 7))
  const day = Number(raw.slice(8, 10))
  const monthValid = month >= 1 && month <= 12
  const dayValid = day >= 1 && day <= daysInMonth(year, month)
  if (!monthValid || !dayValid) {
    throw new Error(`top-surnames: invalid calendar birthDate: ${raw}`)
  }
  return year
}

/**
 * Normalisasi satu surname: trim, guard placeholder @P.N. (diawali @),
 * aksen dihapus via NFD plus strip range Mn, fold case lowercase, tanda
 * baca dihapus. Hasil kosong dibuang (null) tanpa error.
 */
function normalizeSurname(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  if (trimmed.length === 0) return null
  if (trimmed.startsWith('@')) return null
  const noAccent = trimmed.normalize('NFD').replace(/\p{M}/gu, '')
  const cleaned = noAccent.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')
  if (cleaned.length === 0) return null
  return cleaned
}

function clampTopN(raw: number | undefined): number {
  const value = typeof raw === 'number' && Number.isFinite(raw) ? Math.floor(raw) : DEFAULT_TOP_N
  if (value < MIN_TOP_N) return MIN_TOP_N
  if (value > MAX_TOP_N) return MAX_TOP_N
  return value
}

export function computeTopSurnames(
  members: SurnameMember[],
  opts?: TopSurnamesOptions,
): TopSurnamesResult {
  const topN = clampTopN(opts?.topN)

  const surnameCounts = new Map<string, number>()
  const decadeCounts = new Map<number, number>()
  for (const member of members) {
    const surname = normalizeSurname(member.surname)
    if (surname === null) continue
    const year = parseStrictIsoDate(member.birthDate)
    surnameCounts.set(surname, (surnameCounts.get(surname) ?? 0) + 1)
    const decadeStart = Math.floor(year / 10) * 10
    decadeCounts.set(decadeStart, (decadeCounts.get(decadeStart) ?? 0) + 1)
  }

  const allSurnames = Array.from(surnameCounts.keys()).sort((a, b) => {
    const diff = (surnameCounts.get(b) ?? 0) - (surnameCounts.get(a) ?? 0)
    if (diff !== 0) return diff
    return a < b ? -1 : a > b ? 1 : 0
  })
  const surnames = allSurnames.slice(0, topN).map(surname => ({
    surname,
    count: surnameCounts.get(surname) ?? 0,
  }))

  // Window dekade agregat tertinggi. Kandidat diurut dekade ASC dulu,
  // lalu strict greater-than: tie count selalu jatuh ke dekade lebih
  // awal, independen urutan input (deterministik).
  let window: TopSurnamesResult['window'] = null
  const decadeCandidates = Array.from(decadeCounts.entries()).sort((a, b) => a[0] - b[0])
  for (const [decadeStart, count] of decadeCandidates) {
    if (window === null || count > window.count) {
      window = { decade: `${decadeStart}s`, count }
    }
  }

  return { surnames, totalSurnames: allSurnames.length, window }
}
