/**
 * Deaths by decade (v365 fase i): modul PURE untuk agregasi kematian
 * per dekade, pilar statistik pohon VISION-stemmagraph. Jangkar:
 * wt_statistic.php getDeathsByDecade delegasi LifeSpanRepository::deathsByDecade,
 * keluarga getBirthsByDecade (baris 497) dan getCumulativeBirthsByDecade
 * (baris 509) dari kontrak v352. Rujukan pola, bukan salinan kode.
 * Tanpa import apa pun, tanpa I/O, tanpa Date.now, tanpa random:
 * murni transformasi array entri menjadi angka.
 *
 * Kontrak:
 *   computeDeathsByDecade(entries) mengelompokkan count kematian
 *   per dekade (dekade = floor(tahun / 10) * 10), decade integer
 *   kelipatan 10 terurut ASC. Dekade kosong di depan (leading) dan
 *   di belakang (trailing) rentang terdata DIPANGKAS; dekade kosong
 *   di TENGAH (inner) DIPERTAHANKAN bernilai 0 agar gap historis
 *   terlihat, mengikuti semantik jangkar. Input kosong menghasilkan
 *   series kosong tanpa throw.
 *
 * Parsing strict pola v338-v365 (prefiks deaths-by-decade): input
 * bukan array, entri bukan objek, deathDate bukan string, format
 * bukan YYYY-MM-DD, atau tanggal tidak valid secara kalender
 * (termasuk 1900-02-29; 2000-02-29 valid karena 2000 kabisat)
 * DILEMPAR Error ber-prefiks, bukan difilter diam-diam. Validasi
 * kalender memakai Date.UTC dan pembacaan balik komponen UTC agar
 * deterministik di zona waktu berapa pun.
 *
 * Deterministik: urutan input tidak memengaruhi output karena
 * akumulasi dilakukan per kunci dekade sebelum pembentukan series.
 */

export interface DeathsByDecadeResult {
  series: Array<{ decade: number; count: number }>
}

const ERROR_PREFIX = 'deaths-by-decade:'
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

/**
 * Validasi input dan akumulasi count kematian per dekade.
 * Melempar Error ber-prefiks deaths-by-decade: untuk setiap
 * pelanggaran kontrak input.
 */
function countDeathsPerDecade(entries: unknown): Map<number, number> {
  if (!Array.isArray(entries)) {
    throw new Error(`${ERROR_PREFIX} input harus array`)
  }

  const counts = new Map<number, number>()

  for (const entry of entries) {
    if (entry === null || typeof entry !== 'object') {
      throw new Error(`${ERROR_PREFIX} entri harus objek`)
    }

    const record = entry as Record<string, unknown>
    const deathDate = record.deathDate

    if (typeof deathDate !== 'string') {
      throw new Error(`${ERROR_PREFIX} deathDate harus string`)
    }

    const match = DATE_PATTERN.exec(deathDate)

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
      throw new Error(`${ERROR_PREFIX} tanggal kalender tidak valid: ${deathDate}`)
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
 * Hitung count kematian per dekade. Dekade leading dan trailing
 * ber-count 0 dipangkas, dekade inner ber-count 0 dipertahankan.
 */
export function computeDeathsByDecade(entries: unknown): DeathsByDecadeResult {
  const counts = countDeathsPerDecade(entries)
  return { series: buildTrimmedSeries(counts) }
}
