/**
 * Divorces by century (v347 fase i): modul PURE untuk distribusi
 * perceraian per abad, pilar statistik keluarga VISION-stemmagraph.
 * Jangkar: Statistic.php getDivorcesByCentury() baris 913 sampai 916,
 * delegasi DivorceRepository::divorcesByCentury(), distribusi keluarga
 * dengan perceraian per abad (tab Family). Simetris dengan modul
 * weddings-by-century v346 (centuryStart string). Rujukan pola, bukan
 * salinan kode. Tanpa import server/, tanpa prisma, tanpa fetch: murni
 * transformasi array menjadi angka.
 *
 * Kontrak: computeDivorcesByCentury(records) menerima daftar entri
 * SATU per keluarga { familyId: string; divorceDate: string | null }.
 * divorceDate null berarti keluarga tanpa tanggal perceraian
 * terverifikasi: SAH, masuk penghitung undated, bukan error. Abad
 * dihitung floor(tahun/100)*100, label string '1500', '1600', dst.
 * Output:
 *   centuries: array { century, count } urut ASC numerik centuryStart,
 *   hanya abad dengan count >= 1 yang muncul (kohort nihil tidak masuk
 *   output pola v328);
 *   total: jumlah count semua abad;
 *   undated: jumlah divorceDate null.
 *
 * Parsing strict ber-index pola v339/v344/v346 (prefiks
 * divorces-by-century): records bukan array, entri bukan objek,
 * familyId bukan string, familyId string kosong, divorceDate tipe
 * salah, format bukan YYYY-MM-DD, bulan di luar 1 sampai 12 (termasuk
 * 00 dan 13), tanggal tidak valid kalender, atau 29 Feb non-kabisat
 * DILEMPAR Error ber-index, bukan difilter diam-diam. familyId
 * duplikat lintas entri TIDAK didedupe: semua entri tetap dihitung,
 * konsisten v344 v346.
 *
 * Deterministik: akumulasi count per centuryStart di Map lalu
 * diurut ASC numerik, sehingga urutan input tidak memengaruhi isi
 * output. Nihil randomness, nihil jam sistem, nihil I/O di jalur
 * data.
 */

export interface DivorceRecord {
  familyId: string
  divorceDate: string | null
}

export interface DivorcesByCenturyResult {
  centuries: { century: string, count: number }[]
  total: number
  undated: number
}

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/
const ERROR_PREFIX = 'divorces-by-century'

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

function daysInMonth(year: number, month: number): number {
  const lengths = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  if (month === 2 && isLeapYear(year)) return 29
  return lengths[month - 1]
}

function parseStrictIsoDateYear(raw: unknown, entryIndex: number): number {
  const where = `entri index ${entryIndex}`
  if (typeof raw !== 'string') {
    throw new Error(`${ERROR_PREFIX}: ${where} divorceDate harus string atau null`)
  }
  if (!DATE_PATTERN.test(raw)) {
    throw new Error(
      `${ERROR_PREFIX}: ${where} divorceDate format bukan YYYY-MM-DD`,
    )
  }
  const year = Number(raw.slice(0, 4))
  const month = Number(raw.slice(5, 7))
  const day = Number(raw.slice(8, 10))
  if (month < 1 || month > 12) {
    throw new Error(
      `${ERROR_PREFIX}: ${where} divorceDate bulan di luar 1 sampai 12`,
    )
  }
  if (day < 1 || day > daysInMonth(year, month)) {
    throw new Error(
      `${ERROR_PREFIX}: ${where} divorceDate bukan tanggal kalender valid`,
    )
  }
  return year
}

export function computeDivorcesByCentury(
  records: unknown,
): DivorcesByCenturyResult {
  if (!Array.isArray(records)) {
    throw new Error(`${ERROR_PREFIX}: input records harus array`)
  }

  const counts = new Map<number, number>()
  let undated = 0

  records.forEach((entry, index) => {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
      throw new Error(`${ERROR_PREFIX}: entri index ${index} bukan objek`)
    }
    const record = entry as Record<string, unknown>
    if (typeof record.familyId !== 'string') {
      throw new Error(
        `${ERROR_PREFIX}: entri index ${index} familyId harus string`,
      )
    }
    if (record.familyId.length === 0) {
      throw new Error(
        `${ERROR_PREFIX}: entri index ${index} familyId tidak boleh string kosong`,
      )
    }
    if (record.divorceDate === null) {
      undated += 1
      return
    }
    const year = parseStrictIsoDateYear(record.divorceDate, index)
    const centuryStart = Math.floor(year / 100) * 100
    counts.set(centuryStart, (counts.get(centuryStart) ?? 0) + 1)
  })

  const centuries = [...counts.keys()]
    .sort((a, b) => a - b)
    .map((centuryStart) => ({
      century: String(centuryStart),
      count: counts.get(centuryStart) as number,
    }))

  const total = centuries.reduce((sum, item) => sum + item.count, 0)

  return { centuries, total, undated }
}
