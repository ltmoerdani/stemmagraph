/**
 * Age at divorce trimmed histogram (v355 fase i): modul PURE untuk
 * distribusi usia saat bercerai per band 5 tahun, pilar 2
 * VISION-stemmagraph. Saudara modul age-at-death.ts (v299) dan
 * marriage-age.ts (v280). Tanpa import eksternal, tanpa I/O, tanpa
 * Date.now, tanpa jaringan: murni transformasi array entries menjadi
 * dua peta histogram (husband untuk sex M, wife untuk sex F).
 *
 * Kontrak: computeAgeAtDivorceDistributions(entries) mengembalikan
 * { husband, wife, excludedInvalid, excludedNegative, excludedOtherSex }.
 * Kedua seri selalu punya set key identik (union bucket tersisa) dengan
 * urutan bucket naik.
 *
 * Semantik output:
 *   - Entry bukan objek atau field bertipe salah: LEMPAR Error
 *     ber-prefiks age-at-divorce dengan index entry (parser strict
 *     pola v308). Kegagalan bentuk adalah bug pemanggil, bukan data.
 *   - Tanggal (birthDate atau divorceDate) null atau gagal pola EXACT
 *     YYYY-MM-DD kalender Gregorian termasuk kabisat: record dibuang
 *     ke excludedInvalid, BUKAN throw (data riil sering rusak).
 *   - divorceDate sebelum birthDate (usia negatif): excludedNegative
 *     (preseden child-mortality).
 *   - sex selain M dan F: excludedOtherSex, tidak masuk seri mana pun.
 *   - Sisanya masuk bucket 5 tahun sesuai usia penuh anniversary-aware
 *     (anniversary belum lewat: kurang 1, pola marriage-age).
 *
 * Co-trim (semantik HistogramTrim::dropCoZeroEnds di wt_statistic.php
 * baris 935): dari ujung awal, selama KEDUA seri bernilai nol pada
 * bucket terdepan, bucket dibuang dari kedua-duanya; lakukan sama dari
 * ujung akhir; bucket nol interior dipertahankan; bucket dengan satu
 * seri nol tetap dipertahankan bila pasangannya bukan nol. Input
 * kosong atau semua record gugur menghasilkan kedua seri {} tanpa
 * throw.
 *
 * Deterministik: nihil randomness, nihil jam sistem di jalur data,
 * agregasi hitung integer sehingga urutan input tidak mengubah hasil.
 */

export interface AgeAtDivorceEntry {
  sex: string
  birthDate: string | null
  divorceDate: string | null
}

export interface AgeAtDivorceDistributionsResult {
  husband: Record<string, number>
  wife: Record<string, number>
  excludedInvalid: number
  excludedNegative: number
  excludedOtherSex: number
}

export const AGE_AT_DIVORCE_BUCKET_KEYS = [
  '0-4',
  '5-9',
  '10-14',
  '15-19',
  '20-24',
  '25-29',
  '30-34',
  '35-39',
  '40-44',
  '45-49',
  '50-54',
  '55-59',
  '60-64',
  '65-69',
  '70-74',
  '75-79',
  '80+',
] as const

export type AgeAtDivorceBucketKey = (typeof AGE_AT_DIVORCE_BUCKET_KEYS)[number]

interface Ymd {
  y: number
  m: number
  d: number
}

const YMD_RE = /^(\d{4})-(\d{2})-(\d{2})$/

function isLeapYear(y: number): boolean {
  return y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0)
}

function daysInMonth(y: number, m: number): number {
  const lengths = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  if (m === 2 && isLeapYear(y)) return 29
  return lengths[m - 1]
}

/** Parse strict EXACT YYYY-MM-DD termasuk validasi kalender Gregorian. */
function parseYmd(value: string | null): Ymd | null {
  if (value === null) return null
  const match = YMD_RE.exec(value)
  if (!match) return null
  const y = Number(match[1])
  const m = Number(match[2])
  const d = Number(match[3])
  if (m < 1 || m > 12) return null
  if (d < 1 || d > daysInMonth(y, m)) return null
  return { y, m, d }
}

/** Usia tahun penuh anniversary-aware (anniversary belum lewat: kurang 1). */
function fullYearsAt(birth: Ymd, event: Ymd): number {
  let age = event.y - birth.y
  if (event.m < birth.m || (event.m === birth.m && event.d < birth.d)) {
    age -= 1
  }
  return age
}

function bucketOf(age: number): AgeAtDivorceBucketKey {
  if (age >= 80) return '80+'
  const lo = Math.floor(age / 5) * 5
  return `${lo}-${lo + 4}` as AgeAtDivorceBucketKey
}

/**
 * Parser strict pola v308: bentuk entry salah LEMPAR Error ber-prefiks
 * age-at-divorce ber-index. Field tipe salah juga melempar.
 */
function requireEntryShape(entry: unknown, index: number): AgeAtDivorceEntry {
  if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
    throw new Error(`age-at-divorce: entries[${index}] harus objek record`)
  }
  const rec = entry as Record<string, unknown>
  if (typeof rec.sex !== 'string') {
    throw new Error(`age-at-divorce: entries[${index}].sex harus string`)
  }
  if (rec.birthDate !== null && typeof rec.birthDate !== 'string') {
    throw new Error(
      `age-at-divorce: entries[${index}].birthDate harus string atau null`,
    )
  }
  if (rec.divorceDate !== null && typeof rec.divorceDate !== 'string') {
    throw new Error(
      `age-at-divorce: entries[${index}].divorceDate harus string atau null`,
    )
  }
  return {
    sex: rec.sex,
    birthDate: rec.birthDate as string | null,
    divorceDate: rec.divorceDate as string | null,
  }
}

/**
 * Co-trim semantik HistogramTrim::dropCoZeroEnds: buang bucket dari
 * kedua ujung selama nilai KEDUA seri nol di bucket itu. Mengembalikan
 * sub-daftar keys tersisa, urut naik, minimal satu bucket bila ada
 * nilai bukan nol; daftar kosong bila kedua seri kosong merata.
 */
function dropCoZeroEnds(keys: readonly string[], a: Record<string, number>, b: Record<string, number>): string[] {
  let start = 0
  let end = keys.length - 1
  while (start <= end && a[keys[start]] === 0 && b[keys[start]] === 0) {
    start += 1
  }
  while (end >= start && a[keys[end]] === 0 && b[keys[end]] === 0) {
    end -= 1
  }
  return keys.slice(start, end + 1)
}

export function computeAgeAtDivorceDistributions(
  entries: AgeAtDivorceEntry[],
): AgeAtDivorceDistributionsResult {
  const husbandFull = {} as Record<string, number>
  const wifeFull = {} as Record<string, number>
  for (const key of AGE_AT_DIVORCE_BUCKET_KEYS) {
    husbandFull[key] = 0
    wifeFull[key] = 0
  }

  let excludedInvalid = 0
  let excludedNegative = 0
  let excludedOtherSex = 0

  for (let i = 0; i < entries.length; i += 1) {
    const entry = requireEntryShape(entries[i], i)

    if (entry.sex !== 'M' && entry.sex !== 'F') {
      excludedOtherSex += 1
      continue
    }

    const birth = parseYmd(entry.birthDate)
    const divorce = parseYmd(entry.divorceDate)
    if (birth === null || divorce === null) {
      excludedInvalid += 1
      continue
    }

    const age = fullYearsAt(birth, divorce)
    if (age < 0) {
      excludedNegative += 1
      continue
    }

    const bucket = bucketOf(age)
    if (entry.sex === 'M') {
      husbandFull[bucket] += 1
    } else {
      wifeFull[bucket] += 1
    }
  }

  const keptKeys = dropCoZeroEnds(AGE_AT_DIVORCE_BUCKET_KEYS, husbandFull, wifeFull)

  const husband = {} as Record<string, number>
  const wife = {} as Record<string, number>
  for (const key of keptKeys) {
    husband[key] = husbandFull[key]
    wife[key] = wifeFull[key]
  }

  return { husband, wife, excludedInvalid, excludedNegative, excludedOtherSex }
}
