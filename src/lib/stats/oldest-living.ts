/**
 * Oldest living (v301 fase i, modul PURE): peringkat anggota hidup
 * tertua berdasarkan umur penuh tahun anniversary-aware.
 *
 * Tanpa import eksternal, tanpa import dari src lain, tanpa side effect:
 * murni transformasi array input menjadi array terurut deterministik.
 * Waktu query diinjeksi lewat parameter now (default new Date() dievaluasi
 * satu kali di awal pemanggilan) demi determinisme test.
 *
 * Parser strict YYYY-MM-DD pola src/lib/stats/living-stats.ts: pola 4-2-2
 * digit, validasi kalender Gregorian termasuk tahun kabisat (2026-02-30
 * ditolak), trim di depan dan belakang, tanpa fallback format lain.
 *
 * Kandidat: isAlive true DAN birthDate terparse valid. Umur = tahun penuh:
 * year(now) minus year(lahir), dikurangi 1 bila ulang tahun belum lewat
 * pada tahun query (perbandingan bulan lalu hari). Ulang tahun tepat hari
 * query masuk usia baru. Komponen now diekstrak dengan accessor UTC agar
 * bebas offset zona waktu, konsisten dengan modul statistik lain di sini.
 *
 * Urutan: ageYears DESC, tie birthDate ASC (lebih tua lahir duluan),
 * lalu id ASC leksikograf. topN default 10; topN <= 0 menghasilkan array
 * kosong; topN memotong hasil. Wiring UI dan label i18n menyusul di FASE II.
 */

export interface OldestLivingMember {
  id: string
  /** Tanggal lahir YYYY-MM-DD; null berarti tidak diketahui dan dikecualikan. */
  birthDate: string | null
  isAlive: boolean
}

export interface OldestLivingEntry {
  id: string
  /** Umur penuh tahun pada tanggal query (anniversary-aware). */
  ageYears: number
}

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
function parseBirthYmd(input: string | null | undefined): Ymd | null {
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

/** Umur penuh tahun pada hari query; ulang tahun tepat hari = usia baru. */
function ageOn(birth: Ymd, now: Ymd): number {
  let age = now.y - birth.y
  const birthdayPassed = birth.m < now.m || (birth.m === now.m && birth.d <= now.d)
  if (!birthdayPassed) age -= 1
  return age
}

export function computeOldestLiving(
  members: OldestLivingMember[],
  topN: number = 10,
  now: Date = new Date(),
): OldestLivingEntry[] {
  if (topN <= 0) return []
  const nowYmd: Ymd = {
    y: now.getUTCFullYear(),
    m: now.getUTCMonth() + 1,
    d: now.getUTCDate(),
  }
  const ranked: Array<{ id: string; birth: Ymd; ageYears: number }> = []
  for (const member of members) {
    if (!member.isAlive) continue
    const birth = parseBirthYmd(member.birthDate)
    if (!birth) continue
    ranked.push({ id: member.id, birth, ageYears: ageOn(birth, nowYmd) })
  }
  ranked.sort((a, b) => {
    if (a.ageYears !== b.ageYears) return b.ageYears - a.ageYears
    if (a.birth.y !== b.birth.y) return a.birth.y - b.birth.y
    if (a.birth.m !== b.birth.m) return a.birth.m - b.birth.m
    if (a.birth.d !== b.birth.d) return a.birth.d - b.birth.d
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  })
  return ranked.slice(0, topN).map((entry) => ({ id: entry.id, ageYears: entry.ageYears }))
}
