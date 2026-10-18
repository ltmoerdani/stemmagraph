/**
 * Age at death bands (v299 fase i): modul PURE untuk distribusi usia
 * kematian per dekade di atas data anggota, pilar 2 VISION-stemmagraph.
 * Tanpa import server/, tanpa prisma, tanpa fetch, tanpa jaringan:
 * murni transformasi array member menjadi angka.
 *
 * Kontrak: computeAgeAtDeathBands(members) menerima daftar member
 * { birthDate, deathDate, isAlive } dan mengembalikan hasil agregat
 * atau null bila array kosong (null-guard pola v267). Band dekade
 * tetap: 0-9, 10-19, 20-29, 30-39, 40-49, 50-59, 60-69, 70-79, 80+.
 *
 * Semantik output:
 *   Member isAlive true diabaikan sepenuhnya (tidak counted, tidak
 *   skipped). Member meninggal dengan birthDate atau deathDate null
 *   atau gagal parse YMD masuk skippedMissing. Usia negatif (kematian
 *   sebelum lahir) masuk skippedPartial. Sisanya masuk band dekade
 *   sesuai usia penuh (anniversary belum lewat: kurang 1).
 *
 * Parsing tanggal lokal: strict YYYY-MM-DD dengan tahun 4 digit dan
 * validasi kalender Gregorian termasuk kabisat, pola yang sama dengan
 * age-groups.ts (v269). Parser lokal kecil agar modul self-contained
 * dan add-only; nihil dependency baru.
 *
 * Deterministik: nihil randomness, nihil jam sistem di jalur data,
 * agregasi per member sehingga urutan input tidak mengubah hasil.
 * Semua key band selalu hadir di output (nilai 0 bila kosong) supaya
 * konsumen tidak perlu cek key satu per satu.
 */

export interface AgeAtDeathMember {
  birthDate: string | null
  deathDate: string | null
  isAlive: boolean
}

export interface AgeAtDeathBandsResult {
  bands: Record<string, number>
  counted: number
  skippedMissing: number
  skippedPartial: number
}

export const AGE_AT_DEATH_BAND_KEYS = [
  '0-9',
  '10-19',
  '20-29',
  '30-39',
  '40-49',
  '50-59',
  '60-69',
  '70-79',
  '80+',
] as const

export type AgeAtDeathBandKey = (typeof AGE_AT_DEATH_BAND_KEYS)[number]

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

function fullYearsAt(birth: Ymd, death: Ymd): number {
  let age = death.y - birth.y
  if (death.m < birth.m || (death.m === birth.m && death.d < birth.d)) {
    age -= 1
  }
  return age
}

function bandOf(age: number): AgeAtDeathBandKey {
  if (age >= 80) return '80+'
  const lo = Math.floor(age / 10) * 10
  return `${lo}-${lo + 9}` as AgeAtDeathBandKey
}

export function computeAgeAtDeathBands(
  members: AgeAtDeathMember[],
): AgeAtDeathBandsResult | null {
  if (members.length === 0) return null

  const bands = {} as Record<string, number>
  for (const key of AGE_AT_DEATH_BAND_KEYS) {
    bands[key] = 0
  }

  let counted = 0
  let skippedMissing = 0
  let skippedPartial = 0

  for (const member of members) {
    if (member.isAlive) continue

    const birth = parseYmd(member.birthDate)
    if (!birth) {
      skippedMissing += 1
      continue
    }

    const death = parseYmd(member.deathDate)
    if (!death) {
      skippedMissing += 1
      continue
    }

    const age = fullYearsAt(birth, death)
    if (age < 0) {
      skippedPartial += 1
      continue
    }

    bands[bandOf(age)] += 1
    counted += 1
  }

  return { bands, counted, skippedMissing, skippedPartial }
}
