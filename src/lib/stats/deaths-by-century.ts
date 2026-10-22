/**
 * Deaths by century (v366 fase i): modul PURE untuk distribusi
 * kematian per abad, pilar statistik demografi VISION-stemmagraph.
 * Jangkar: wt_statistic.php getDeathsByCentury() baris 430 sampai
 * 433, delegasi EventRepository::eventsByCentury('DEAT'), tab Life
 * span. Simetris dengan divorces-by-century v347 dan
 * weddings-by-century v346 (centuryStart string, undated counter).
 * Rujukan pola, bukan salinan kode. Tanpa import server/, tanpa
 * prisma, tanpa fetch: murni transformasi array menjadi angka.
 *
 * Kontrak: computeDeathsByCentury(records) menerima daftar entri
 * SATU per orang { personId: string; deathDate: string | null }.
 * deathDate null berarti orang tanpa tanggal kematian terverifikasi:
 * SAH, masuk penghitung undated, bukan error. Abad dihitung
 * floor(tahun/100)*100, label string '1500', '1600', dst. Output:
 *   centuries: array { century, count } urut ASC numerik centuryStart,
 *   hanya abad dengan count >= 1 yang muncul (kohor nihil tidak masuk
 *   output pola v328);
 *   total: jumlah count semua abad;
 *   undated: jumlah deathDate null.
 *
 * Parsing strict ber-index pola v339/v346/v365 (prefiks pesan
 * deaths-by-century:): records bukan array, entri bukan objek,
 * personId bukan string, personId string kosong, deathDate tipe
 * selain string dan null, format bukan YYYY-MM-DD, bulan di luar
 * 1 sampai 12 (termasuk 00 dan 13), tanggal tidak valid kalender,
 * atau 29 Feb non-kabisat DILEMPAR Error ber-prefiks, bukan
 * difilter diam-diam. 29 Feb kabisat (2000-02-29) VALID. personId
 * duplikat lintas entri TIDAK didedupe: semua entri tetap dihitung,
 * konsisten v344 v346.
 *
 * Deterministik: akumulasi count per centuryStart di Map lalu
 * diurut ASC numerik, sehingga urutan input tidak memengaruhi isi
 * output. Nihil randomness, nihil jam sistem, nihil I/O di jalur
 * data.
 */

export interface DeathRecord {
  personId: string
  deathDate: string | null
}

export interface DeathsByCenturyResult {
  centuries: { century: string, count: number }[]
  total: number
  undated: number
}

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/
const ERROR_PREFIX = 'deaths-by-century'

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

function daysInMonth(year: number, month: number): number {
  const lengths = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  if (month === 2 && isLeapYear(year)) return 29
  return lengths[month - 1]
}

/**
 * Validasi satu tanggal kematian dan kembalikan centuryStart.
 * Melempar Error ber-prefiks deaths-by-century: untuk setiap
 * pelanggaran kontrak format atau kalender.
 */
function centuryStartOf(deathDate: string): number {
  const match = DATE_PATTERN.exec(deathDate)

  if (match === null) {
    throw new Error(`${ERROR_PREFIX}: format tanggal harus YYYY-MM-DD`)
  }

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])

  if (month < 1 || month > 12) {
    throw new Error(`${ERROR_PREFIX}: bulan harus 1 sampai 12`)
  }

  if (day < 1 || day > daysInMonth(year, month)) {
    throw new Error(`${ERROR_PREFIX}: tanggal tidak valid secara kalender`)
  }

  return Math.floor(year / 100) * 100
}

/**
 * Agregasi distribusi kematian per abad dari daftar entri satu per
 * orang. Lihat dokumentasi modul untuk kontrak lengkap.
 */
export function computeDeathsByCentury(records: unknown): DeathsByCenturyResult {
  if (!Array.isArray(records)) {
    throw new Error(`${ERROR_PREFIX}: records harus array`)
  }

  const counts = new Map<number, number>()
  let undated = 0

  for (const record of records) {
    if (record === null || typeof record !== 'object') {
      throw new Error(`${ERROR_PREFIX}: entri harus objek`)
    }

    const entry = record as Record<string, unknown>
    const personId = entry.personId

    if (typeof personId !== 'string') {
      throw new Error(`${ERROR_PREFIX}: personId harus string`)
    }

    if (personId === '') {
      throw new Error(`${ERROR_PREFIX}: personId tidak boleh string kosong`)
    }

    const deathDate = entry.deathDate

    if (deathDate === null) {
      undated += 1
      continue
    }

    if (typeof deathDate !== 'string') {
      throw new Error(`${ERROR_PREFIX}: deathDate harus string atau null`)
    }

    const centuryStart = centuryStartOf(deathDate)
    counts.set(centuryStart, (counts.get(centuryStart) ?? 0) + 1)
  }

  const centuries = [...counts.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([centuryStart, count]) => ({ century: String(centuryStart), count }))

  const total = centuries.reduce((sum, row) => sum + row.count, 0)

  return { centuries, total, undated }
}
