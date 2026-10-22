/**
 * Top oldest deceased (v368 fase i, modul PURE): peringkat anggota
 * meninggal dengan umur kematian tertua, Top-N.
 *
 * Tanpa import eksternal, tanpa import dari src lain, tanpa side effect:
 * murni transformasi array input menjadi array terurut deterministik.
 * Tidak butuh parameter now karena rentang lahir-meninggal self-contained.
 *
 * Parser strict YYYY-MM-DD pola src/lib/stats/oldest-living.ts (mirror):
 * pola 4-2-2 digit, validasi kalender Gregorian termasuk tahun kabisat
 * (1900-02-29 ditolak, 2000-02-29 valid), trim di depan dan belakang,
 * tanpa fallback format lain.
 *
 * Kandidat: isAlive false DAN birthDate terparse valid DAN deathDate
 * terparse valid. Entri dengan tanggal null, format salah, atau tanggal
 * kalender invalid DIKECUALIKAN tanpa throw, konsisten pola v301.
 *
 * Umur kematian = tahun penuh anniversary-aware antara lahir dan
 * meninggal: death.y minus birth.y, dikurangi 1 bila ulang tahun belum
 * tercapai pada tanggal kematian; ulang tahun tepat tanggal kematian
 * masuk usia baru. Komponen tanggal dibaca dari hasil parser lokal
 * (bukan Date), bebas zona waktu.
 *
 * Urutan: ageYears DESC, tie birthDate ASC (lebih tua lahir duluan),
 * lalu id ASC leksikograf. topN default 10; topN <= 0 menghasilkan array
 * kosong; topN memotong hasil. Wiring UI dan label i18n menyusul di FASE II.
 */

export interface DeceasedMember {
  id: string
  /** Tanggal lahir YYYY-MM-DD; null berarti tidak diketahui dan dikecualikan. */
  birthDate: string | null
  /** Tanggal meninggal YYYY-MM-DD; null berarti tidak diketahui dan dikecualikan. */
  deathDate: string | null
  isAlive: boolean
}

export interface OldestDeceasedEntry {
  id: string
  /** Umur penuh tahun pada tanggal kematian (anniversary-aware). */
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
function parseYmd(input: string | null | undefined): Ymd | null {
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

/** Umur penuh tahun pada tanggal kematian; ulang tahun tepat hari = usia baru. */
function ageAtDeath(birth: Ymd, death: Ymd): number {
  let age = death.y - birth.y
  const birthdayPassed = birth.m < death.m || (birth.m === death.m && birth.d <= death.d)
  if (!birthdayPassed) age -= 1
  return age
}

export function computeTopOldestDeceased(
  members: DeceasedMember[],
  topN: number = 10,
): OldestDeceasedEntry[] {
  if (topN <= 0) return []
  const ranked: Array<{ id: string; birth: Ymd; ageYears: number }> = []
  for (const member of members) {
    if (member.isAlive) continue
    const birth = parseYmd(member.birthDate)
    if (!birth) continue
    const death = parseYmd(member.deathDate)
    if (!death) continue
    ranked.push({ id: member.id, birth, ageYears: ageAtDeath(birth, death) })
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
