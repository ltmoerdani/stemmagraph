/**
 * Place dispersion summary (v372 fase i): modul PURE untuk sebaran
 * jumlah nilai PLAC berbeda per orang, pilar statistik Places
 * VISION-stemmagraph. Jangkar: wt_statistic.php baris 589
 * dispersionSummary() delegasi PlaceDispersionRepository::
 * dispersionSummary(), return PlaceDispersionSummary { average,
 * sampled, distribution }. Rujukan pola, bukan salinan kode.
 *
 * Kontrak: computePlaceDispersionSummary(entries) menerima daftar
 * entri SATU per orang { personId: string; places: string[] }.
 * places adalah kumpulan nilai PLAC level-1 dari seluruh event orang
 * itu (parsing GEDCOM bukan scope modul ini).
 *
 * Normalisasi per orang: setiap nilai di-trim; string kosong atau
 * whitespace-only di-skip secara sah (bukan error, konsisten perilaku
 * skip nilai kosong di repository PHP); dedup case-sensitive via Set
 * (Berlin dan berlin dihitung dua, keputusan jangkar yang memilih
 * sederhana dan dapat diprediksi). distinct = 0 berarti orang tanpa
 * tempat valid: SAH, dikeluarkan dari sampled, totalPlaces, dan
 * distribution tanpa menarik average ke nol, bukan error.
 *
 * Output:
 *   average: totalPlaces / sampled dibulatkan 2 desimal (pola
 *   v370/v371); sampled 0 menghasilkan 0;
 *   sampled: jumlah orang dengan distinct >= 1;
 *   totalPlaces: jumlah seluruh distinct orang tersampel;
 *   distribution: selalu memuat kelima kunci '1', '2', '3', '4',
 *   '5+' berhitungan 0 sebagai dasar sehingga sumbu kontinu (pre-seed
 *   pola jangkar); distinct >= 5 masuk '5+', selain itu kunci
 *   string(distinct).
 *
 * Parsing strict ber-index pola v339/v344/v346/v371 (prefiks
 * place-dispersion-summary): records bukan array, entri bukan objek,
 * personId bukan string, personId string kosong, places bukan array,
 * atau elemen places bukan string DILEMPAR Error ber-index, bukan
 * difilter diam-diam. Duplikat personId lintas entri TIDAK didedupe:
 * semua entri dihitung sampel terpisah, konsisten keputusan v371.
 *
 * Deterministik terhadap urutan input; tanpa import server/, tanpa
 * prisma, tanpa fetch, tanpa Date, tanpa I/O: murni transformasi
 * array menjadi angka.
 */

/** Satu entri per orang: seluruh nilai PLAC level-1 milik orang itu. */
export interface PlaceEntry {
  personId: string
  places: string[]
}

/** Ringkasan sebaran jumlah tempat berbeda per orang. */
export interface PlaceDispersionSummaryResult {
  average: number
  sampled: number
  totalPlaces: number
  distribution: Record<string, number>
}

const ERROR_PREFIX = 'place-dispersion-summary'
const MAX_DISTINCT_BUCKET = 5

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

export function computePlaceDispersionSummary(
  records: unknown,
): PlaceDispersionSummaryResult {
  if (!Array.isArray(records)) {
    throw new Error(`${ERROR_PREFIX}: input harus array`)
  }

  const distribution: Record<string, number> = {
    '1': 0,
    '2': 0,
    '3': 0,
    '4': 0,
    '5+': 0,
  }

  let sampled = 0
  let totalPlaces = 0

  for (let index = 0; index < records.length; index += 1) {
    const entry: unknown = records[index]
    if (!isRecord(entry)) {
      throw new Error(`${ERROR_PREFIX}: entri index ${index} harus objek`)
    }

    const rawPersonId: unknown = entry.personId
    if (typeof rawPersonId !== 'string') {
      throw new Error(`${ERROR_PREFIX}: entri index ${index} personId harus string`)
    }
    if (rawPersonId === '') {
      throw new Error(`${ERROR_PREFIX}: entri index ${index} personId tidak boleh string kosong`)
    }

    const rawPlaces: unknown = entry.places
    if (!Array.isArray(rawPlaces)) {
      throw new Error(`${ERROR_PREFIX}: entri index ${index} places harus array`)
    }

    const uniquePlaces = new Set<string>()
    for (let pIndex = 0; pIndex < rawPlaces.length; pIndex += 1) {
      const rawPlace: unknown = rawPlaces[pIndex]
      if (typeof rawPlace !== 'string') {
        throw new Error(
          `${ERROR_PREFIX}: entri index ${index} elemen places index ${pIndex} harus string`,
        )
      }

      const place = rawPlace.trim()
      if (place === '') {
        continue
      }

      uniquePlaces.add(place)
    }

    const distinct = uniquePlaces.size
    if (distinct === 0) {
      continue
    }

    sampled += 1
    totalPlaces += distinct

    const bucket = distinct >= MAX_DISTINCT_BUCKET ? '5+' : String(distinct)
    distribution[bucket] += 1
  }

  const average = sampled === 0 ? 0 : round2(totalPlaces / sampled)

  return { average, sampled, totalPlaces, distribution }
}
