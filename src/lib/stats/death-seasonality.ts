/**
 * Death seasonality (v312 fase i): modul PURE untuk agregasi kematian
 * per bulan kalender dan skor puncak kematian musim dingin, pilar
 * statistik pohon VISION-stemmagraph. Jangkar: magicsunday/
 * webtrees-statistics getDeathsByMonth (baris 422) dan
 * getDeathWinterPeakScore (baris 564, nullable). Rujukan pola, bukan
 * salinan kode. Tanpa import server/, tanpa prisma, tanpa fetch:
 * murni transformasi array entri menjadi angka.
 *
 * Kontrak: computeDeathSeasonality(records) menerima daftar entri
 * { deathDate: string } dan menghasilkan:
 *   deathsByMonth: 12 angka, indeks 0 = Januari sampai 11 = Desember;
 *   total: jumlah seluruh kematian terhitung;
 *   winterPeakScore: share kematian Des-Jan-Feb (belahan utara)
 *   dibagi baseline seragam 0.25, sehingga share 0.25 = 1.0 netral.
 *   Distribusi flat antar 12 bulan atau total nol menghasilkan NULL
 *   (jangkar nullable), tanpa angka.
 *
 * Parsing strict YYYY-MM-DD pola v301 (PartialDate): format salah,
 * bulan di luar 1 sampai 12, atau tanggal tidak valid secara kalender
 * (termasuk kabisat) DILEMPAR Error, bukan difilter diam-diam
 * (preseden koreksi QA v308). Tanggal BCE atau non-Gregorian yang
 * gagal parse juga melempar Error dengan pesan eksplisit; dukungan
 * penuhnya di luar scope fase i.
 *
 * Deterministik: nihil randomness, nihil jam sistem di jalur data.
 * Akumulasi dilakukan per indeks bulan sehingga urutan input tidak
 * memengaruhi output. winterPeakScore dibulatkan 4 desimal.
 */

export interface DeathRecord {
  deathDate: string
}

export interface DeathSeasonalityResult {
  deathsByMonth: number[]
  total: number
  winterPeakScore: number | null
}

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

/** Baseline seragam 3 bulan musim dingin dari 12 bulan. */
const WINTER_BASELINE = 0.25

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
    throw new Error(
      `Invalid deathDate format: ${JSON.stringify(raw)}, expected strict YYYY-MM-DD (BCE and non-Gregorian dates are out of scope)`,
    )
  }
  const year = Number(raw.slice(0, 4))
  const month = Number(raw.slice(5, 7))
  const day = Number(raw.slice(8, 10))
  const monthValid = month >= 1 && month <= 12
  const dayValid = day >= 1 && day <= daysInMonth(year, month)
  if (!monthValid || !dayValid) {
    throw new Error(`Invalid calendar deathDate: ${raw}`)
  }
  return month
}

function round4(value: number): number {
  return Math.round(value * 10000) / 10000
}

export function computeDeathSeasonality(
  records: readonly DeathRecord[],
): DeathSeasonalityResult {
  const deathsByMonth: number[] = new Array<number>(12).fill(0)
  for (const record of records) {
    const month = parseStrictIsoDate(record.deathDate)
    deathsByMonth[month - 1] += 1
  }

  const total = deathsByMonth.reduce((sum, count) => sum + count, 0)

  let winterPeakScore: number | null = null
  if (total > 0) {
    const isFlat = deathsByMonth.every(count => count === deathsByMonth[0])
    if (!isFlat) {
      const winterDeaths = deathsByMonth[11] + deathsByMonth[0] + deathsByMonth[1]
      winterPeakScore = round4(winterDeaths / total / WINTER_BASELINE)
    }
  }

  return { deathsByMonth, total, winterPeakScore }
}
