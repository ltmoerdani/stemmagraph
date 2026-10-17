/**
 * Age groups PBB (v269 fase i): modul PURE untuk partisi kelompok umur
 * standar PBB di atas data anggota hidup, pilar 2 VISION-stemmagraph.
 * Tanpa import server/, tanpa prisma, tanpa fetch, tanpa jaringan:
 * murni transformasi array member menjadi angka.
 *
 * Ambang eksak standar PBB (terverifikasi wake 17 Okt 2026 via dua
 * acuan terbuka): dependents 0-14 tahun, working-age 15-64 tahun,
 * 65 tahun ke atas. Referensi: World Bank indikator SP.POP.DPND dan
 * SP.POP.DPND.OL (metadata resmi, sumber data UN Population Division
 * WPP), artikel publik Dependency_ratio yang merujuk esa.un.org/unpd/wpp.
 *
 * Kontrak: computeAgeGroupsPBB(members) sesuai signature wajib;
 * parameter kedua now opsional (default jam sistem) sehingga
 * pemanggilan satu argumen tetap valid. Injeksi now dipakai test
 * untuk determinisme penuh.
 *
 * Parsing tanggal lokal: strict YYYY-MM-DD dengan tahun 4 digit dan
 * validasi kalender (bulan 01-12, hari sesuai panjang bulan Gregorian
 * termasuk kabisat). Pola parser lokal kecil dipakai ulang dari
 * living-stats.ts (v267) karena util existing tidak cocok untuk
 * bentuk ini; nihil dependency baru.
 *
 * Semantik output:
 *   HANYA member LIVING dengan birthDate terparse yang masuk kelompok.
 *   Deceased, birthDate gagal parse, dan umur negatif (birth di masa
 *   depan) keluar dari semua kelompok. Nilai tidak pernah negatif.
 *   Umur = tahun penuh (anniversary belum lewat: kurang 1).
 *
 * Deterministik: nihil randomness, nihil jam tersembunyi di jalur data
 * (now eksplisit bila diinjeksi), urutan input tidak mengubah hasil.
 */

export interface AgeGroupsMember {
  birthDate: string
  isAlive: boolean
}

export const AGE_GROUPS_PBB = ['children-0-14', 'adults-15-64', 'seniors-65+'] as const

export type AgeGroupKey = (typeof AGE_GROUPS_PBB)[number]

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

/** Parser lokal strict: YYYY-MM-DD, tahun 4 digit, kalender Gregorian. */
function parseLocalYmd(input: string | null | undefined): Ymd | null {
  if (input === null || input === undefined) return null
  const match = YMD_RE.exec(String(input).trim())
  if (!match) return null
  const y = Number(match[1])
  const m = Number(match[2])
  const d = Number(match[3])
  if (m < 1 || m > 12) return null
  if (d < 1 || d > daysInMonth(y, m)) return null
  return { y, m, d }
}

/** Komponen kalender dari Date dalam UTC agar bebas offset zona waktu. */
function utcYmd(date: Date): Ymd {
  return { y: date.getUTCFullYear(), m: date.getUTCMonth() + 1, d: date.getUTCDate() }
}

/** Umur tahun penuh antara dua tanggal kalender (anniversary belum lewat: kurang 1). */
function fullYears(from: Ymd, to: Ymd): number {
  let age = to.y - from.y
  if (to.m < from.m || (to.m === from.m && to.d < from.d)) age -= 1
  return age
}

function emptyGroups(): Record<AgeGroupKey, number> {
  return { 'children-0-14': 0, 'adults-15-64': 0, 'seniors-65+': 0 }
}

function groupForAge(age: number): AgeGroupKey | null {
  if (age < 0) return null
  if (age <= 14) return 'children-0-14'
  if (age <= 64) return 'adults-15-64'
  return 'seniors-65+'
}

export function computeAgeGroupsPBB(
  members: AgeGroupsMember[],
  now: Date = new Date(),
): Record<AgeGroupKey, number> {
  const ref = utcYmd(now)
  const groups = emptyGroups()

  for (const member of members) {
    if (!member.isAlive) continue
    const birth = parseLocalYmd(member.birthDate)
    if (birth === null) continue
    const key = groupForAge(fullYears(birth, ref))
    if (key !== null) groups[key] += 1
  }

  return groups
}
