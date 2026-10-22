/**
 * Family size stacked by decade (v369 fase i): modul PURE untuk pivot
 * ukuran keluarga per dekade, pilar statistik pohon VISION-stemmagraph.
 * Jangkar: wt_statistic.php getFamilySizeStackedByDecade (baris 987),
 * StackedBarPayload satu bar per dekade dengan segmen stack 1/2/3/4+
 * anak. Rujukan pola, bukan salinan kode. Tanpa import apa pun,
 * tanpa I/O, tanpa Date, tanpa random: murni transformasi array entri
 * menjadi angka.
 *
 * Kontrak:
 *   computeFamilySizeStackedByDecade(entries) menerima array entri
 *   { referenceYear: number, childIds: string[] }. referenceYear adalah
 *   tahun acuan keluarga (mis. tahun pernikahan orang tua) dari lapisan
 *   data atas; childIds adalah daftar id anak (GEDCOM 7 term CHIL,
 *   pola v287). Dekade = floor(referenceYear / 10) * 10.
 *
 *   Segmen per bar mengikuti jangkar: one = 1 anak, two = 2, three = 3,
 *   fourPlus = >= 4 anak. Keluarga 0 anak tidak masuk segmen stack;
 *   dihitung terpisah sebagai childless per bar (adaptasi konsisten
 *   bucket zero v287). total = one + two + three + fourPlus + childless.
 *
 *   Bars terurut decade ASC. Dekade kosong di depan (leading) dan di
 *   belakang (trailing) rentang terdata DIPANGKAS; dekade kosong di
 *   TENGAH (inner) DIPERTAHANKAN dengan semua segmen 0 agar gap
 *   historis terlihat, pola births-by-decade v352. Dekade berisi
 *   keluarga childless saja tetap terdata sehingga tidak dianggap
 *   kosong. Input kosong menghasilkan bars kosong tanpa throw.
 *
 * Parsing strict pola v367 (prefiks family-size-stacked-by-decade):
 * input bukan array, entri bukan objek, referenceYear bukan integer
 * berhingga, childIds bukan array of string DILEMPAR Error
 * ber-prefiks, bukan difilter diam-diam.
 *
 * Deterministik: urutan input tidak memengaruhi output karena
 * agregasi dilakukan per kunci dekade sebelum pembentukan series.
 */

export interface FamilySizeStackedBar {
  decade: number
  one: number
  two: number
  three: number
  fourPlus: number
  childless: number
  total: number
}

export interface FamilySizeStackedByDecadeResult {
  bars: Array<FamilySizeStackedBar>
}

interface DecadeBucket {
  one: number
  two: number
  three: number
  fourPlus: number
  childless: number
}

const ERROR_PREFIX = 'family-size-stacked-by-decade:'

function emptyBucket(): DecadeBucket {
  return { one: 0, two: 0, three: 0, fourPlus: 0, childless: 0 }
}

/**
 * Validasi input dan akumulasi keluarga per segmen ukuran pada
 * dekade masing-masing. Melempar Error ber-prefiks
 * family-size-stacked-by-decade untuk setiap pelanggaran kontrak
 * input.
 */
function aggregatePerDecade(entries: unknown): Map<number, DecadeBucket> {
  if (!Array.isArray(entries)) {
    throw new Error(`${ERROR_PREFIX} input harus array`)
  }

  const buckets = new Map<number, DecadeBucket>()

  for (const entry of entries) {
    if (entry === null || typeof entry !== 'object') {
      throw new Error(`${ERROR_PREFIX} entri harus objek`)
    }

    const record = entry as Record<string, unknown>
    const referenceYear = record.referenceYear
    const childIds = record.childIds

    if (typeof referenceYear !== 'number' || !Number.isInteger(referenceYear)) {
      throw new Error(
        `${ERROR_PREFIX} referenceYear harus integer berhingga: ${String(referenceYear)}`,
      )
    }

    if (!Array.isArray(childIds)) {
      throw new Error(`${ERROR_PREFIX} childIds harus array`)
    }

    for (const childId of childIds) {
      if (typeof childId !== 'string') {
        throw new Error(`${ERROR_PREFIX} childIds harus berisi string saja`)
      }
    }

    const decade = Math.floor(referenceYear / 10) * 10
    const bucket = buckets.get(decade) ?? emptyBucket()

    switch (childIds.length) {
      case 0:
        bucket.childless += 1
        break
      case 1:
        bucket.one += 1
        break
      case 2:
        bucket.two += 1
        break
      case 3:
        bucket.three += 1
        break
      default:
        bucket.fourPlus += 1
        break
    }

    buckets.set(decade, bucket)
  }

  return buckets
}

/**
 * Bangun bars penuh dekade ASC dari dekade terdata terkecil sampai
 * terbesar, dekade kosong inner bernilai 0 di semua segmen, lalu
 * pangkas dekade tanpa terdata di ujung depan dan belakang. Idempoten:
 * memangkas bars yang sudah terpangkas menghasilkan bars yang sama.
 */
function buildTrimmedBars(buckets: Map<number, DecadeBucket>): Array<FamilySizeStackedBar> {
  const observed = Array.from(buckets.keys()).sort((a, b) => a - b)

  if (observed.length === 0) {
    return []
  }

  const first = observed[0]
  const last = observed[observed.length - 1]
  const bars: Array<FamilySizeStackedBar> = []

  for (let decade = first; decade <= last; decade += 10) {
    const bucket = buckets.get(decade) ?? emptyBucket()
    bars.push({
      decade,
      one: bucket.one,
      two: bucket.two,
      three: bucket.three,
      fourPlus: bucket.fourPlus,
      childless: bucket.childless,
      total: bucket.one + bucket.two + bucket.three + bucket.fourPlus + bucket.childless,
    })
  }

  while (bars.length > 0 && bars[0].total === 0) {
    bars.shift()
  }

  while (bars.length > 0 && bars[bars.length - 1].total === 0) {
    bars.pop()
  }

  return bars
}

/**
 * Pivot ukuran keluarga per dekade: stack 1/2/3/4+ anak plus
 * childless terpisah. Dekade leading dan trailing tanpa terdata
 * dipangkas, dekade inner tanpa terdata dipertahankan kosong.
 */
export function computeFamilySizeStackedByDecade(
  entries: unknown,
): FamilySizeStackedByDecadeResult {
  const buckets = aggregatePerDecade(entries)
  return { bars: buildTrimmedBars(buckets) }
}
