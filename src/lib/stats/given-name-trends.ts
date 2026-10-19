/**
 * Tren nama depan per dekade kelahiran (v311 fase i): modul PURE untuk
 * deret demografi Stemmagraph, pilar VISION-stemmagraph. Jangkar:
 * magicsunday/webtrees-statistics GivenNameTrendsRepository::countByDecade.
 * Tanpa import server/, tanpa prisma, tanpa fetch, tanpa jaringan:
 * murni transformasi array member menjadi angka.
 *
 * Kontrak: computeGivenNameTrends(members, opts?) menghitung frekuensi
 * nama depan per dekade kelahiran. Nama depan = token pertama dari
 * givenName, fold case lowercase, tanda baca dihapus, guard token
 * placeholder @P.N. dan hasil kosong dibuang. Satu orang menyumbang
 * paling banyak satu token sehingga nama ganda sama terhitung sekali.
 *
 * Parsing birthDate strict YYYY-MM-DD pola v301: tanggal tidak valid
 * secara kalender (termasuk kabisat) atau format salah DILEMPAR Error.
 * Kunci dekade "1970s" dst = floor(tahun/10)*10.
 *
 * names urut total count DESC, tie alfabetis ASC, dipotong topN
 * (default 10, clamp ke rentang 1 sampai 50). decades urut kronologis
 * ASC. series hanya memuat names terpilih dengan countsByDecade lengkap
 * atas semua decades, pasangan tanpa data bernilai 0 eksplisit.
 * totalNames = jumlah nama unik valid SEBELUM pemotongan topN.
 *
 * Deterministik penuh: nihil randomness, nihil jam sistem di jalur
 * data, urutan input tidak memengaruhi hasil (agregasi per kunci lalu
 * sortir total dan alfabetis).
 */

export interface NameTrendMember {
  birthDate: string
  givenName: string
}

export interface NameDecadeCell {
  name: string
  decade: string
  count: number
}

export interface NameTrendsResult {
  names: string[]
  decades: string[]
  series: Array<{ name: string, countsByDecade: Record<string, number> }>
  totalNames: number
}

export interface GivenNameTrendsOptions {
  /** Jumlah nama teratas pada output. Default 10, clamp ke rentang 1 sampai 50. */
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

function parseStrictIsoDate(raw: string): number {
  if (typeof raw !== 'string' || !DATE_PATTERN.test(raw)) {
    throw new Error(`Invalid birthDate format: ${JSON.stringify(raw)}, expected strict YYYY-MM-DD`)
  }
  const year = Number(raw.slice(0, 4))
  const month = Number(raw.slice(5, 7))
  const day = Number(raw.slice(8, 10))
  const monthValid = month >= 1 && month <= 12
  const dayValid = day >= 1 && day <= daysInMonth(year, month)
  if (!monthValid || !dayValid) {
    throw new Error(`Invalid calendar birthDate: ${raw}`)
  }
  return year
}

/**
 * Ekstraksi token nama depan satu orang. Token pertama dari split
 * spasi, fold case lowercase, tanda baca dihapus. Guard: token
 * placeholder @P.N. (diawali @) dan hasil kosong dibuang (null).
 * Dedup per orang terjadi secara alami: satu orang paling banyak
 * menyumbang satu token.
 */
function extractGivenToken(raw: string): string | null {
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  if (trimmed.length === 0) return null
  const firstToken = trimmed.split(/\s+/)[0]
  if (firstToken.startsWith('@')) return null
  const cleaned = firstToken.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')
  if (cleaned.length === 0) return null
  return cleaned
}

function clampTopN(raw: number | undefined): number {
  const value = typeof raw === 'number' && Number.isFinite(raw) ? Math.floor(raw) : DEFAULT_TOP_N
  if (value < MIN_TOP_N) return MIN_TOP_N
  if (value > MAX_TOP_N) return MAX_TOP_N
  return value
}

export function computeGivenNameTrends(
  members: NameTrendMember[],
  opts?: GivenNameTrendsOptions,
): NameTrendsResult {
  const topN = clampTopN(opts?.topN)

  // count per pasangan nama plus dekade; totals per nama.
  const pairCounts = new Map<string, Map<string, number>>()
  for (const member of members) {
    const token = extractGivenToken(member.givenName)
    if (token === null) continue
    const year = parseStrictIsoDate(member.birthDate)
    const decadeStart = Math.floor(year / 10) * 10
    const decadeKey = `${decadeStart}s`
    let byDecade = pairCounts.get(token)
    if (!byDecade) {
      byDecade = new Map()
      pairCounts.set(token, byDecade)
    }
    byDecade.set(decadeKey, (byDecade.get(decadeKey) ?? 0) + 1)
  }

  // Decades kronologis ASC berdasar angka awal dekade.
  const decadeSet = new Set<string>()
  for (const byDecade of pairCounts.values()) {
    for (const decadeKey of byDecade.keys()) decadeSet.add(decadeKey)
  }
  const decades = Array.from(decadeSet).sort(
    (a, b) => Number(a.slice(0, -1)) - Number(b.slice(0, -1)),
  )

  // Names urut total count DESC, tie alfabetis ASC.
  const totals = new Map<string, number>()
  for (const [name, byDecade] of pairCounts) {
    let total = 0
    for (const count of byDecade.values()) total += count
    totals.set(name, total)
  }
  const allNames = Array.from(totals.keys()).sort((a, b) => {
    const diff = (totals.get(b) ?? 0) - (totals.get(a) ?? 0)
    if (diff !== 0) return diff
    return a < b ? -1 : a > b ? 1 : 0
  })

  const totalNames = allNames.length
  const names = allNames.slice(0, topN)

  const series = names.map((name) => {
    const byDecade = pairCounts.get(name) ?? new Map<string, number>()
    const countsByDecade: Record<string, number> = {}
    for (const decadeKey of decades) {
      countsByDecade[decadeKey] = byDecade.get(decadeKey) ?? 0
    }
    return { name, countsByDecade }
  })

  return { names, decades, series, totalNames }
}
