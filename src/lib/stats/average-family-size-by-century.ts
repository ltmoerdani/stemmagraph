/**
 * Average family size by century (v371 fase i): modul PURE untuk
 * rata-rata jumlah anak per keluarga per abad pernikahan, pilar
 * statistik keluarga VISION-stemmagraph. Jangkar: wt_statistic.php
 * getAverageFamilySizeByCentury() baris 996 sampai 998, delegasi
 * ChildrenRepository::averageFamilySizeByCentury(), return
 * LineChartPayload (tab Family). Bucketing abad floor(year/100)*100
 * setara pola label v347/v352; rata-rata dibulatkan 2 desimal pola
 * v328/v370. Rujukan pola, bukan salinan kode. Tanpa import
 * server/, tanpa prisma, tanpa fetch: murni transformasi array
 * menjadi angka.
 *
 * Kontrak: computeAverageFamilySizeByCentury(records) menerima
 * daftar entri SATU per keluarga
 * { familyId: string; marriageDate: string | null; childIds:
 *   string[] }.
 * marriageDate null berarti keluarga tanpa tanggal pernikahan
 * terverifikasi: SAH, masuk penghitung undated, TIDAK masuk kohort
 * abad, bukan error. Keluarga tanpa anak (childIds kosong) TETAP
 * masuk denominator abad pernikahannya sehingga rata-rata
 * terpengaruh nol, konsisten penempatan keluarga childless v369 di
 * dalam denominator statistik ukuran. Abad = abad pernikahan
 * floor(tahun/100)*100, label string '1800', '1900', dst.
 * Output:
 *   centuries: array { century, families, totalChildren, average }
 *   urut ASC numerik, hanya abad dengan families >= 1;
 *   average = totalChildren / families dibulatkan 2 desimal (pola
 *   v370);
 *   totalFamilies: jumlah families semua abad (di luar undated);
 *   totalChildren: jumlah anak semua keluarga terdated;
 *   undated: jumlah marriageDate null.
 *
 * Parsing strict ber-index pola v339/v344/v346/v347/v370 (prefiks
 * average-family-size-by-century): records bukan array, entri bukan
 * objek, familyId bukan string, familyId string kosong, marriageDate
 * tipe salah, format bukan YYYY-MM-DD, bulan di luar 1 sampai 12
 * (termasuk 00 dan 13), tanggal tidak valid kalender, 29 Feb
 * non-kabisat, childIds bukan array, atau elemen childIds bukan
 * string DILEMPAR Error ber-index, bukan difilter diam-diam.
 * familyId duplikat lintas entri TIDAK didedupe: semua entri tetap
 * dihitung, konsisten v344 v346 v347.
 *
 * Deterministik: akumulasi families dan children per abad di Map
 * lalu diurut ASC numerik, sehingga urutan input tidak memengaruhi
 * isi output. Nihil randomness, nihil jam sistem, nihil I/O di
 * jalur data.
 */

export interface FamilyCenturyRecord {
  familyId: string
  marriageDate: string | null
  childIds: string[]
}

export interface AverageFamilySizeByCenturyResult {
  centuries: {
    century: string
    families: number
    totalChildren: number
    average: number
  }[]
  totalFamilies: number
  totalChildren: number
  undated: number
}

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/
const ERROR_PREFIX = 'average-family-size-by-century'

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

function daysInMonth(year: number, month: number): number {
  const lengths = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  if (month === 2 && isLeapYear(year)) return 29
  return lengths[month - 1]
}

function parseStrictIsoDate(raw: unknown, entryIndex: number): string {
  const where = `entri index ${entryIndex}`
  if (raw !== null && typeof raw !== 'string') {
    throw new Error(
      `${ERROR_PREFIX}: ${where} marriageDate harus string atau null`,
    )
  }
  if (raw === null) return ''
  if (!DATE_PATTERN.test(raw)) {
    throw new Error(
      `${ERROR_PREFIX}: ${where} marriageDate format bukan YYYY-MM-DD`,
    )
  }
  const year = Number(raw.slice(0, 4))
  const month = Number(raw.slice(5, 7))
  const day = Number(raw.slice(8, 10))
  if (month < 1 || month > 12) {
    throw new Error(
      `${ERROR_PREFIX}: ${where} marriageDate bulan di luar 1 sampai 12`,
    )
  }
  if (day < 1 || day > daysInMonth(year, month)) {
    throw new Error(
      `${ERROR_PREFIX}: ${where} marriageDate bukan tanggal kalender valid`,
    )
  }
  return raw
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

export function computeAverageFamilySizeByCentury(
  records: unknown,
): AverageFamilySizeByCenturyResult {
  if (!Array.isArray(records)) {
    throw new Error(`${ERROR_PREFIX}: input records harus array`)
  }

  const familiesBy = new Map<number, number>()
  const childrenBy = new Map<number, number>()
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
    if (!Array.isArray(record.childIds)) {
      throw new Error(
        `${ERROR_PREFIX}: entri index ${index} childIds harus array`,
      )
    }
    record.childIds.forEach((childId, childIndex) => {
      if (typeof childId !== 'string') {
        throw new Error(
          `${ERROR_PREFIX}: entri index ${index} childIds posisi ${childIndex} harus string`,
        )
      }
    })
    const marriage = parseStrictIsoDate(record.marriageDate, index)
    if (marriage === '') {
      undated += 1
      return
    }
    const centuryStart = Math.floor(Number(marriage.slice(0, 4)) / 100) * 100
    familiesBy.set(centuryStart, (familiesBy.get(centuryStart) ?? 0) + 1)
    childrenBy.set(
      centuryStart,
      (childrenBy.get(centuryStart) ?? 0) + record.childIds.length,
    )
  })

  const centuries = [...familiesBy.keys()]
    .sort((a, b) => a - b)
    .map((centuryStart) => {
      const families = familiesBy.get(centuryStart) as number
      const totalChildren = childrenBy.get(centuryStart) ?? 0
      return {
        century: String(centuryStart),
        families,
        totalChildren,
        average: round2(totalChildren / families),
      }
    })

  const totalFamilies = centuries.reduce((sum, item) => sum + item.families, 0)
  const totalChildren = centuries.reduce(
    (sum, item) => sum + item.totalChildren,
    0,
  )

  return { centuries, totalFamilies, totalChildren, undated }
}
