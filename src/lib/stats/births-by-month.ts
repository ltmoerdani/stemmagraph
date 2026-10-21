/**
 * Births by month (v339 fase i): modul PURE untuk agregasi kelahiran
 * per bulan kalender dan identifikasi bulan puncak kelahiran, pilar
 * statistik pohon VISION-stemmagraph. Jangkar: magicsunday/
 * webtrees-statistics getBirthsByMonth (baris 381,
 * translateMonthKeys(eventRepository->eventsByMonth('BIRT'))),
 * pasangan simetris death-seasonality v312 (getDeathsByMonth baris
 * 422). Rujukan pola, bukan salinan kode. Tanpa import server/,
 * tanpa prisma, tanpa fetch: murni transformasi array entri menjadi
 * angka.
 *
 * Kontrak: computeBirthsByMonth(entries) menerima daftar entri
 * { birthDate: string } (dated-only) dan menghasilkan:
 *   birthsByMonth: 12 angka, indeks 0 = Januari sampai 11 = Desember;
 *   total: jumlah seluruh kelahiran terhitung;
 *   peakMonth: indeks bulan dengan count tertinggi, tie memilih
 *   indeks terkecil; peakCount: count pada bulan tersebut; keduanya
 *   NULL saat total 0 (pola nullable jangkar).
 *
 * Parsing strict ber-index pola v338 (prefiks births-by-month):
 * input bukan array, entri bukan objek, birthDate hilang atau bukan
 * string, format bukan YYYY-MM-DD, bulan di luar 1 sampai 12, atau
 * tanggal tidak valid secara kalender (termasuk 29 Feb non-kabisat)
 * DILEMPAR Error ber-index, bukan difilter diam-diam (preseden
 * koreksi QA v308). Tanggal BCE atau non-Gregorian yang gagal parse
 * juga melempar Error dengan pesan eksplisit; dukungan penuhnya di
 * luar scope fase i.
 *
 * Deterministik: nihil randomness, nihil jam sistem di jalur data.
 * Akumulasi dilakukan per indeks bulan sehingga urutan input tidak
 * memengaruhi output.
 */

export interface BirthsByMonthRecord {
  birthDate: string
}

export interface BirthsByMonthResult {
  birthsByMonth: number[]
  total: number
  peakMonth: number | null
  peakCount: number | null
}

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/
const ERROR_PREFIX = 'births-by-month'

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

function daysInMonth(year: number, month: number): number {
  const lengths = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  if (month === 2 && isLeapYear(year)) return 29
  return lengths[month - 1]
}

function parseStrictIsoDateMonth(raw: unknown, index: number): number {
  if (typeof raw !== 'string') {
    throw new Error(
      `${ERROR_PREFIX}: entri index ${index} birthDate harus string`,
    )
  }
  if (!DATE_PATTERN.test(raw)) {
    throw new Error(
      `${ERROR_PREFIX}: entri index ${index} birthDate format bukan YYYY-MM-DD`,
    )
  }
  const year = Number(raw.slice(0, 4))
  const month = Number(raw.slice(5, 7))
  const day = Number(raw.slice(8, 10))
  if (month < 1 || month > 12) {
    throw new Error(
      `${ERROR_PREFIX}: entri index ${index} birthDate bulan di luar 1 sampai 12`,
    )
  }
  if (day < 1 || day > daysInMonth(year, month)) {
    throw new Error(
      `${ERROR_PREFIX}: entri index ${index} birthDate bukan tanggal kalender valid`,
    )
  }
  return month
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function computeBirthsByMonth(entries: unknown): BirthsByMonthResult {
  if (!Array.isArray(entries)) {
    throw new Error(`${ERROR_PREFIX}: input harus array`)
  }

  const birthsByMonth: number[] = new Array<number>(12).fill(0)
  for (let index = 0; index < entries.length; index += 1) {
    const entry: unknown = entries[index]
    if (!isRecord(entry)) {
      throw new Error(`${ERROR_PREFIX}: entri index ${index} harus objek`)
    }
    const month = parseStrictIsoDateMonth(entry.birthDate, index)
    birthsByMonth[month - 1] += 1
  }

  const total = birthsByMonth.reduce((sum, count) => sum + count, 0)

  let peakMonth: number | null = null
  let peakCount: number | null = null
  if (total > 0) {
    let bestIndex = 0
    for (let i = 1; i < birthsByMonth.length; i += 1) {
      if (birthsByMonth[i] > birthsByMonth[bestIndex]) bestIndex = i
    }
    peakMonth = bestIndex
    peakCount = birthsByMonth[bestIndex]
  }

  return { birthsByMonth, total, peakMonth, peakCount }
}
