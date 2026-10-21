/**
 * Births by decade (v352 fase i): modul PURE untuk agregasi kelahiran
 * per dekade, pilar statistik pohon VISION-stemmagraph. Jangkar:
 * wt_statistic.php getBirthsByDecade (baris 497) dan
 * getCumulativeBirthsByDecade (baris 509). Rujukan pola, bukan
 * salinan kode. Tanpa import apa pun, tanpa I/O, tanpa Date.now,
 * tanpa random: murni transformasi array entri menjadi angka.
 *
 * Kontrak:
 *   computeBirthsByDecade(entries) mengelompokkan count kelahiran
 *   per dekade (dekade = floor(tahun / 10) * 10), decade integer
 *   kelipatan 10 terurut ASC. Dekade kosong di depan (leading) dan
 *   di belakang (trailing) rentang terdata DIPANGKAS; dekade kosong
 *   di TENGAH (inner) DIPERTAHANKAN bernilai 0 agar gap historis
 *   terlihat, mengikuti semantik jangkar. Input kosong menghasilkan
 *   series kosong tanpa throw.
 *
 *   computeCumulativeBirthsByDecade(entries) menghitung running sum
 *   pada deret terpangkas yang sama sehingga kumulatif naik monoton.
 *
 * Parsing strict pola v338-v351 (prefiks births-by-decade): input
 * bukan array, entri bukan objek, birthDate bukan string, format
 * bukan YYYY-MM-DD, atau tanggal tidak valid secara kalender
 * (termasuk 1900-02-29; 2000-02-29 valid karena 2000 kabisat)
 * DILEMPAR Error ber-prefiks, bukan difilter diam-diam. Validasi
 * kalender memakai Date.UTC dan pembacaan balik komponen UTC agar
 * deterministik di zona waktu berapa pun.
 *
 * Deterministik: urutan input tidak memengaruhi output karena
 * akumulasi dilakukan per kunci dekade sebelum pembentukan series.
 */

export interface BirthsByDecadeResult {
  series: Array<{ decade: number; count: number }>
}

export interface CumulativeBirthsByDecadeResult {
  series: Array<{ decade: number; cumulative: number }>
}

const ERROR_PREFIX = 'births-by-decade:'
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

/**
 * Validasi input dan akumulasi count kelahiran per dekade.
 * Melempar Error ber-prefiks births-by-decade: untuk setiap
 * pelanggaran kontrak input.
 */
function countBirthsPerDecade(entries: unknown): Map<number, number> {
  if (!Array.isArray(entries)) {
    throw new Error(`${ERROR_PREFIX} input harus array`)
  }

  const counts = new Map<number, number>()

  for (const entry of entries) {
    if (entry === null || typeof entry !== 'object') {
      throw new Error(`${ERROR_PREFIX} entri harus objek`)
    }

    const record = entry as Record<string, unknown>
    const birthDate = record.birthDate

    if (typeof birthDate !== 'string') {
      throw new Error(`${ERROR_PREFIX} birthDate harus string`)
    }

    const match = DATE_PATTERN.exec(birthDate)

    if (match === null) {
      throw new Error(`${ERROR_PREFIX} format tanggal harus YYYY-MM-DD`)
    }

    const year = Number(match[1])
    const month = Number(match[2])
    const day = Number(match[3])
    const utc = new Date(Date.UTC(year, month - 1, day))

    if (
      utc.getUTCFullYear() !== year ||
      utc.getUTCMonth() !== month - 1 ||
      utc.getUTCDate() !== day
    ) {
      throw new Error(`${ERROR_PREFIX} tanggal kalender tidak valid: ${birthDate}`)
    }

    const decade = Math.floor(year / 10) * 10
    counts.set(decade, (counts.get(decade) ?? 0) + 1)
  }

  return counts
}

/**
 * Bangun series penuh dekade ASC dari dekade terdata terkecil sampai
 * terbesar, dekade kosong inner bernilai 0, lalu pangkas dekade
 * ber-count 0 di ujung depan dan belakang. Idempoten: memangkas
 * series yang sudah terpangkas menghasilkan series yang sama.
 */
function buildTrimmedSeries(
  counts: Map<number, number>,
): Array<{ decade: number; count: number }> {
  const observed = Array.from(counts.keys()).sort((a, b) => a - b)

  if (observed.length === 0) {
    return []
  }

  const first = observed[0]
  const last = observed[observed.length - 1]
  const series: Array<{ decade: number; count: number }> = []

  for (let decade = first; decade <= last; decade += 10) {
    series.push({ decade, count: counts.get(decade) ?? 0 })
  }

  while (series.length > 0 && series[0].count === 0) {
    series.shift()
  }

  while (series.length > 0 && series[series.length - 1].count === 0) {
    series.pop()
  }

  return series
}

/**
 * Hitung count kelahiran per dekade. Dekade leading dan trailing
 * ber-count 0 dipangkas, dekade inner ber-count 0 dipertahankan.
 */
export function computeBirthsByDecade(entries: unknown): BirthsByDecadeResult {
  const counts = countBirthsPerDecade(entries)
  return { series: buildTrimmedSeries(counts) }
}

/**
 * Hitung running sum kelahiran per dekade pada deret terpangkas yang
 * sama, kumulatif naik monoton.
 */
export function computeCumulativeBirthsByDecade(
  entries: unknown,
): CumulativeBirthsByDecadeResult {
  const counts = countBirthsPerDecade(entries)
  const trimmed = buildTrimmedSeries(counts)
  let running = 0
  const series = trimmed.map(({ decade, count }) => {
    running += count
    return { decade, cumulative: running }
  })
  return { series }
}
