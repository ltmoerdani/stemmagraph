/**
 * Divorce rate by marriage cohort (v370 fase i): modul PURE untuk
 * tingkat perceraian per kohort dekade pernikahan, pilar statistik
 * keluarga VISION-stemmagraph. Jangkar: wt_statistic.php
 * getDivorceRateByMarriageCohort() baris 950 sampai 952, delegasi
 * DivorceRepository::divorceRateByMarriageCohort(), return
 * array<int, float> (tab Family). Metodologi kohort selaras evidence
 * ONS cohort (denominator kohort MARR, unit rate per kohort).
 * Rujukan pola, bukan salinan kode. Tanpa import server/, tanpa
 * prisma, tanpa fetch: murni transformasi array menjadi angka.
 *
 * Kontrak: computeDivorceRateByMarriageCohort(records) menerima
 * daftar entri SATU per keluarga
 * { familyId: string; marriageDate: string | null; divorceDate:
 *   string | null }.
 * marriageDate null berarti keluarga tanpa tanggal pernikahan
 * terverifikasi: SAH, masuk penghitung undated, TIDAK masuk
 * denominator kohort, bukan error. divorceDate null pada keluarga
 * bertanggal pernikahan berarti keluarga bertahan: masuk denominator
 * (married), bukan pembilang (divorced). Kohort = dekade pernikahan
 * floor(tahun/10)*10, label string '1950', '1960', dst.
 * divorceDate TANPA marriageDate pada entri yang sama THROW
 * (perceraian tanpa pernikahan tidak valid untuk kohort).
 * divorceDate SEBELUM marriageDate THROW (konsistensi kronologis
 * satu entri). Output:
 *   cohorts: array { cohort, married, divorced, rate } urut ASC
 *   numerik, hanya kohort dengan married >= 1;
 *   rate = divorced / married dibulatkan 2 desimal (pola
 *   survivalFraction v328);
 *   totalMarried: jumlah married semua kohort;
 *   totalDivorced: jumlah divorced semua kohort;
 *   undated: jumlah marriageDate null.
 *
 * Parsing strict ber-index pola v339/v344/v346/v347 (prefiks
 * divorce-rate-by-marriage-cohort): records bukan array, entri bukan
 * objek, familyId bukan string, familyId string kosong, marriageDate
 * tipe salah, divorceDate tipe salah, format bukan YYYY-MM-DD, bulan
 * di luar 1 sampai 12 (termasuk 00 dan 13), tanggal tidak valid
 * kalender, atau 29 Feb non-kabisat DILEMPAR Error ber-index, bukan
 * difilter diam-diam. familyId duplikat lintas entri TIDAK didedupe:
 * semua entri tetap dihitung, konsisten v344 v346 v347.
 *
 * Deterministik: akumulasi married dan divorced per kohort di Map
 * lalu diurut ASC numerik, sehingga urutan input tidak memengaruhi
 * isi output. Nihil randomness, nihil jam sistem, nihil I/O di
 * jalur data.
 */

export interface MarriageCohortRecord {
  familyId: string
  marriageDate: string | null
  divorceDate: string | null
}

export interface DivorceRateByMarriageCohortResult {
  cohorts: {
    cohort: string
    married: number
    divorced: number
    rate: number
  }[]
  totalMarried: number
  totalDivorced: number
  undated: number
}

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/
const ERROR_PREFIX = 'divorce-rate-by-marriage-cohort'

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

function daysInMonth(year: number, month: number): number {
  const lengths = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  if (month === 2 && isLeapYear(year)) return 29
  return lengths[month - 1]
}

function parseStrictIsoDate(raw: unknown, entryIndex: number, field: 'marriageDate' | 'divorceDate'): string {
  const where = `entri index ${entryIndex}`
  if (raw !== null && typeof raw !== 'string') {
    throw new Error(
      `${ERROR_PREFIX}: ${where} ${field} harus string atau null`,
    )
  }
  if (raw === null) return ''
  if (!DATE_PATTERN.test(raw)) {
    throw new Error(
      `${ERROR_PREFIX}: ${where} ${field} format bukan YYYY-MM-DD`,
    )
  }
  const year = Number(raw.slice(0, 4))
  const month = Number(raw.slice(5, 7))
  const day = Number(raw.slice(8, 10))
  if (month < 1 || month > 12) {
    throw new Error(
      `${ERROR_PREFIX}: ${where} ${field} bulan di luar 1 sampai 12`,
    )
  }
  if (day < 1 || day > daysInMonth(year, month)) {
    throw new Error(
      `${ERROR_PREFIX}: ${where} ${field} bukan tanggal kalender valid`,
    )
  }
  return raw
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

export function computeDivorceRateByMarriageCohort(
  records: unknown,
): DivorceRateByMarriageCohortResult {
  if (!Array.isArray(records)) {
    throw new Error(`${ERROR_PREFIX}: input records harus array`)
  }

  const marriedBy = new Map<number, number>()
  const divorcedBy = new Map<number, number>()
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
    const marriage = parseStrictIsoDate(record.marriageDate, index, 'marriageDate')
    const divorce = parseStrictIsoDate(record.divorceDate, index, 'divorceDate')
    if (marriage === '') {
      if (divorce !== '') {
        throw new Error(
          `${ERROR_PREFIX}: entri index ${index} divorceDate tanpa marriageDate tidak valid untuk kohort`,
        )
      }
      undated += 1
      return
    }
    if (divorce !== '' && divorce < marriage) {
      throw new Error(
        `${ERROR_PREFIX}: entri index ${index} divorceDate sebelum marriageDate tidak valid`,
      )
    }
    const cohortStart = Math.floor(Number(marriage.slice(0, 4)) / 10) * 10
    marriedBy.set(cohortStart, (marriedBy.get(cohortStart) ?? 0) + 1)
    if (divorce !== '') {
      divorcedBy.set(cohortStart, (divorcedBy.get(cohortStart) ?? 0) + 1)
    }
  })

  const cohorts = [...marriedBy.keys()]
    .sort((a, b) => a - b)
    .map((cohortStart) => {
      const married = marriedBy.get(cohortStart) as number
      const divorced = divorcedBy.get(cohortStart) ?? 0
      return {
        cohort: String(cohortStart),
        married,
        divorced,
        rate: round2(divorced / married),
      }
    })

  const totalMarried = cohorts.reduce((sum, item) => sum + item.married, 0)
  const totalDivorced = cohorts.reduce((sum, item) => sum + item.divorced, 0)

  return { cohorts, totalMarried, totalDivorced, undated }
}
