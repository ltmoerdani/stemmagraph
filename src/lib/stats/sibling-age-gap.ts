/**
 * Sibling age gap (v344 fase i): modul PURE untuk distribusi jarak
 * tahun antar saudara berurutan, pilar statistik pohon
 * VISION-stemmagraph. Jangkar: wt_statistic.php baris 976 sampai 985
 * getSiblingAgeGapDistribution() yang mendelegasikan ke
 * childrenRepository->siblingAgeGapDistribution(), doc comment
 * jangkar resmi "Distribution of gaps (years) between consecutive
 * siblings". Rujukan pola, bukan salinan kode. Tanpa import
 * server/, tanpa prisma, tanpa fetch: murni transformasi array
 * keluarga menjadi angka.
 *
 * Kontrak: computeSiblingAgeGap(families, options?) menerima daftar
 * keluarga { familyId: string; children: { id: string; birthDate:
 * string }[] } dan menghasilkan:
 *   gapsByYears: peta kunci string tahun gap ('0', '1', '2', ...)
 *   dari pasangan KONSEKUTIF anak terurut birthDate ascending; gap
 *   = selisih komponen tahun kalender, bukan selisih hari; gap 0
 *   kembar tahun sama masuk kunci '0';
 *   totalPairs: jumlah seluruh pasangan konsekutif terhitung;
 *   familiesCounted: jumlah keluarga UNIK penyumbang minimal satu
 *   pasangan (familyId duplikat tetap dihitung gap-nya);
 *   maxGap: gap terbesar terhitung, NULL saat nihil pasangan.
 *
 * options.maxGapCap integer >= 1 default 30: gap di atas cap tetap
 * masuk totalPairs TAPI bucket-nya digabung ke kunci literal
 * `>=${maxGapCap}` (misal '>=30'), mirror semangat histogram
 * jangkar agar output bounded.
 *
 * Parsing strict ber-index pola v339 (prefiks sibling-age-gap):
 * families bukan array, entri bukan objek, familyId bukan string,
 * children bukan array, anak bukan objek, id bukan string,
 * birthDate bukan string, format bukan YYYY-MM-DD, bulan di luar
 * 1 sampai 12, tanggal tidak valid kalender (termasuk 29 Feb
 * non-kabisat), atau maxGapCap bukan integer >= 1 DILEMPAR Error
 * ber-index, bukan difilter diam-diam. Keluarga dengan anak dated
 * kurang dari 2 di-skip tanpa error (nihil gap terhitung).
 *
 * Deterministik: nihil randomness, nihil jam sistem di jalur data.
 * Akumulasi di peta sehingga urutan input families tidak
 * memengaruhi nilai output.
 */

export interface SiblingAgeGapSibling {
  id: string
  birthDate: string
}

export interface SiblingAgeGapFamily {
  familyId: string
  children: SiblingAgeGapSibling[]
}

export interface SiblingAgeGapResult {
  gapsByYears: Record<string, number>
  totalPairs: number
  familiesCounted: number
  maxGap: number | null
}

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/
const ERROR_PREFIX = 'sibling-age-gap'
const DEFAULT_MAX_GAP_CAP = 30

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

function daysInMonth(year: number, month: number): number {
  const lengths = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  if (month === 2 && isLeapYear(year)) return 29
  return lengths[month - 1]
}

function parseStrictIsoDateYear(
  raw: unknown,
  familyIndex: number,
  childIndex: number,
): number {
  const where = `keluarga index ${familyIndex} anak index ${childIndex}`
  if (typeof raw !== 'string') {
    throw new Error(`${ERROR_PREFIX}: ${where} birthDate harus string`)
  }
  if (!DATE_PATTERN.test(raw)) {
    throw new Error(
      `${ERROR_PREFIX}: ${where} birthDate format bukan YYYY-MM-DD`,
    )
  }
  const year = Number(raw.slice(0, 4))
  const month = Number(raw.slice(5, 7))
  const day = Number(raw.slice(8, 10))
  if (month < 1 || month > 12) {
    throw new Error(
      `${ERROR_PREFIX}: ${where} birthDate bulan di luar 1 sampai 12`,
    )
  }
  if (day < 1 || day > daysInMonth(year, month)) {
    throw new Error(
      `${ERROR_PREFIX}: ${where} birthDate bukan tanggal kalender valid`,
    )
  }
  return year
}

export function computeSiblingAgeGap(
  families: unknown,
  options?: { maxGapCap?: number },
): SiblingAgeGapResult {
  if (!Array.isArray(families)) {
    throw new Error(`${ERROR_PREFIX}: input families harus array`)
  }

  let maxGapCap = DEFAULT_MAX_GAP_CAP
  if (options !== undefined && options.maxGapCap !== undefined) {
    const cap = options.maxGapCap
    if (!Number.isInteger(cap) || cap < 1) {
      throw new Error(`${ERROR_PREFIX}: maxGapCap harus integer >= 1`)
    }
    maxGapCap = cap
  }

  const gapsByYears: Record<string, number> = {}
  const contributingFamilies = new Set<string>()
  let totalPairs = 0
  let maxGap: number | null = null

  families.forEach((family, familyIndex) => {
    if (typeof family !== 'object' || family === null || Array.isArray(family)) {
      throw new Error(
        `${ERROR_PREFIX}: keluarga index ${familyIndex} bukan objek`,
      )
    }
    const record = family as Record<string, unknown>
    if (typeof record.familyId !== 'string') {
      throw new Error(
        `${ERROR_PREFIX}: keluarga index ${familyIndex} familyId harus string`,
      )
    }
    if (!Array.isArray(record.children)) {
      throw new Error(
        `${ERROR_PREFIX}: keluarga index ${familyIndex} children harus array`,
      )
    }

    const datedChildren = record.children.map((child, childIndex) => {
      if (typeof child !== 'object' || child === null || Array.isArray(child)) {
        throw new Error(
          `${ERROR_PREFIX}: keluarga index ${familyIndex} anak index ${childIndex} bukan objek`,
        )
      }
      const entry = child as Record<string, unknown>
      if (typeof entry.id !== 'string') {
        throw new Error(
          `${ERROR_PREFIX}: keluarga index ${familyIndex} anak index ${childIndex} id harus string`,
        )
      }
      return {
        id: entry.id,
        birthDate: entry.birthDate,
        year: parseStrictIsoDateYear(entry.birthDate, familyIndex, childIndex),
      }
    })

    if (datedChildren.length < 2) return

    datedChildren.sort((a, b) => {
      if (a.birthDate < b.birthDate) return -1
      if (a.birthDate > b.birthDate) return 1
      return 0
    })

    for (let i = 0; i < datedChildren.length - 1; i += 1) {
      const gap = datedChildren[i + 1].year - datedChildren[i].year
      const key = gap > maxGapCap ? `>=${maxGapCap}` : String(gap)
      gapsByYears[key] = (gapsByYears[key] ?? 0) + 1
      totalPairs += 1
      if (maxGap === null || gap > maxGap) maxGap = gap
    }
    contributingFamilies.add(record.familyId)
  })

  return {
    gapsByYears,
    totalPairs,
    familiesCounted: contributingFamilies.size,
    maxGap,
  }
}
