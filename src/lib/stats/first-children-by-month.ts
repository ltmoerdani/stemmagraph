/**
 * First children by month (v345 fase i): modul PURE untuk
 * distribusi bulan kelahiran anak pertama di tiap keluarga,
 * pilar statistik pohon VISION-stemmagraph. Jangkar:
 * wt_statistic.php baris 1052 sampai 1059
 * getFirstChildrenByMonth() yang mendelegasikan ke
 * childrenRepository->firstChildrenByMonth(), doc comment jangkar
 * resmi "First-children by localised month name"; mirror
 * translateMonthKeys baris 1264: bulan nihil di-nol-kan via ?? 0.
 * Rujukan pola, bukan salinan kode. Tanpa import server/, tanpa
 * prisma, tanpa fetch: murni transformasi array menjadi angka.
 *
 * Kontrak: computeFirstChildrenByMonth(records) menerima daftar
 * entri SATU per anak { familyId: string; child: { id: string;
 * birthDate: string } }; pemilihan anak pertama dilakukan modul:
 * dalam tiap familyId anak pertama = birthDate PALING AWAL (string
 * ISO YYYY-MM-DD urut leksikografis valid untuk tanggal Gregorian
 * tahun 4 digit); tie birthDate identik dalam satu keluarga ambil
 * entri pertama ditemui, sisanya diabaikan tanpa error. Output:
 *   firstChildrenByMonth: 12 angka, indeks 0 Januari sampai 11
 *   Desember, bulan tanpa anak pertama bernilai 0;
 *   total: jumlah seluruh anak pertama terhitung, sama dengan
 *   familiesCounted (satu per keluarga);
 *   peakMonth: indeks bulan count tertinggi, tie pilih indeks
 *   terkecil, NULL saat total 0; peakCount count bulan itu, 0 saat
 *   total 0 (pola nullable v339);
 *   familiesCounted: jumlah familyId UNIK penyumbang satu anak
 *   pertama.
 *
 * Parsing strict ber-index pola v339/v344 (prefiks
 * first-children-by-month): records bukan array, entri bukan
 * objek, familyId bukan string, child bukan objek, id bukan
 * string, birthDate bukan string, format bukan YYYY-MM-DD, bulan
 * di luar 1 sampai 12 (termasuk 00 dan 13), tanggal tidak valid
 * kalender, atau 29 Feb non-kabisat DILEMPAR Error ber-index,
 * bukan difilter diam-diam.
 *
 * Deterministik: akumulasi anak pertama per keluarga via
 * pembanding tanggal, sehingga urutan input records hanya
 * berpengaruh pada id mana yang menang tie tanggal identik, bukan
 * pada distribusi bulan. Nihil randomness, nihil jam sistem,
 * nihil I/O di jalur data.
 */

export interface FirstChildrenRecord {
  familyId: string
  child: {
    id: string
    birthDate: string
  }
}

export interface FirstChildrenByMonthResult {
  firstChildrenByMonth: number[]
  total: number
  peakMonth: number | null
  peakCount: number
  familiesCounted: number
}

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/
const ERROR_PREFIX = 'first-children-by-month'
const MONTH_COUNT = 12

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

function daysInMonth(year: number, month: number): number {
  const lengths = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  if (month === 2 && isLeapYear(year)) return 29
  return lengths[month - 1]
}

function parseStrictIsoDateMonth(raw: unknown, entryIndex: number): number {
  const where = `entri index ${entryIndex}`
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
  if (month < 1 || month > MONTH_COUNT) {
    throw new Error(
      `${ERROR_PREFIX}: ${where} birthDate bulan di luar 1 sampai 12`,
    )
  }
  if (day < 1 || day > daysInMonth(year, month)) {
    throw new Error(
      `${ERROR_PREFIX}: ${where} birthDate bukan tanggal kalender valid`,
    )
  }
  return month
}

export function computeFirstChildrenByMonth(
  records: unknown,
): FirstChildrenByMonthResult {
  if (!Array.isArray(records)) {
    throw new Error(`${ERROR_PREFIX}: input records harus array`)
  }

  const firstByFamily = new Map<string, { id: string, birthDate: string }>()

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
    if (
      typeof record.child !== 'object' ||
      record.child === null ||
      Array.isArray(record.child)
    ) {
      throw new Error(`${ERROR_PREFIX}: entri index ${index} child bukan objek`)
    }
    const child = record.child as Record<string, unknown>
    if (typeof child.id !== 'string') {
      throw new Error(`${ERROR_PREFIX}: entri index ${index} id harus string`)
    }
    const birthDate = child.birthDate
    parseStrictIsoDateMonth(birthDate, index)

    const existing = firstByFamily.get(record.familyId)
    if (existing === undefined || birthDate < existing.birthDate) {
      firstByFamily.set(record.familyId, { id: child.id, birthDate })
    }
  })

  const firstChildrenByMonth = new Array<number>(MONTH_COUNT).fill(0)
  for (const first of firstByFamily.values()) {
    const month = Number(first.birthDate.slice(5, 7))
    firstChildrenByMonth[month - 1] += 1
  }

  let total = 0
  let peakMonth: number | null = null
  let peakCount = 0
  for (let month = 0; month < MONTH_COUNT; month += 1) {
    total += firstChildrenByMonth[month]
    if (firstChildrenByMonth[month] > peakCount) {
      peakCount = firstChildrenByMonth[month]
      peakMonth = month
    }
  }

  return {
    firstChildrenByMonth,
    total,
    peakMonth,
    peakCount,
    familiesCounted: firstByFamily.size,
  }
}
