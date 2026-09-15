// Parser tanggal GEDCOM komposit untuk event genealogi (S1 fase 3 persiapan,
// item parser-only). Input: string DATE GEDCOM seperti yang tertulis di tag
// BIRT/DEAT/MARR, mis. "12 JAN 1900", "ABT 1900", "BET 1900 AND 1910".
//
// Kontrak perilaku:
//   - Tidak pernah melempar error. Input yang gagal diurai kembali sebagai
//     dateKind ABOUT tanpa komponen tanggal, dengan originalDateString utuh.
//     Gagal urai tidak boleh mengarang presisi (mis. membuang "BET" lalu
//     mengembalikan EXACT).
//   - Murni fungsi: tanpa efek samping, tanpa state, tanpa import apa pun.
//
// Sintaks yang dikenali (case-insensitive, whitespace dilipat):
//   EXACT : "<DAY> <MON> <YEAR>" | "<MON> <YEAR>" | "<YEAR>"
//   ABOUT : "ABT <DATE>" | "ABOUT <DATE>"
//   BEFORE: "BEF <DATE>" | "BEFORE <DATE>"
//   AFTER : "AFT <DATE>" | "AFTER <DATE>"
//   RANGE : "BET <DATE> AND <DATE>" (kedua sisi harus sah)
//
// Tanggal ISO 8601 calendar (S1F3-A) diterima pada posisi <DATE> polos dan
// setelah kata kunci ABT/ABOUT/BEF/BEFORE/AFT/AFTER:
//   "YYYY-MM-DD" | "YYYY-MM" | "YYYY" (tahun saja lewat aturan YEAR lama).
// Bentuk dengan bagian waktu ("1945-03-15T10:00:00"), bulan 13, hari
// mustahil, atau tahun 0 gagal urai dan jatuh ke ABOUT tanpa komponen;
// originalDateString tetap utuh, tanpa mengarang presisi. RANGE (BET..AND)
// masih menerima tanggal GEDCOM saja pada fase ini.
//
// Escape kalender GEDCOM seperti "@#DGREGORIAN@" dibuang saat normalisasi.
// Validitas hari dicek terhadap panjang bulan Gregorian; tanggal mustahil
// ("31 FEB 1900") diperlakukan sebagai gagal urai, bukan tanggal sah.

/** Jenis hasil urai tanggal event. */
export type EventDateKind = 'EXACT' | 'ABOUT' | 'BEFORE' | 'AFTER' | 'RANGE'

/** Komponen tanggal yang sah: year wajib, month/day opsional. */
export interface EventDateComponents {
  year: number
  month?: number
  day?: number
}

interface ParsedEventDateBase {
  dateKind: EventDateKind
  /** String input asli, utuh tanpa perubahan apa pun. */
  originalDateString: string
}

export interface ParsedEventDateExact extends ParsedEventDateBase {
  dateKind: 'EXACT'
  year: number
  month?: number
  day?: number
}

export interface ParsedEventDateAbout extends ParsedEventDateBase {
  dateKind: 'ABOUT'
  year?: number
  month?: number
  day?: number
}

export interface ParsedEventDateBefore extends ParsedEventDateBase {
  dateKind: 'BEFORE'
  year: number
  month?: number
  day?: number
}

export interface ParsedEventDateAfter extends ParsedEventDateBase {
  dateKind: 'AFTER'
  year: number
  month?: number
  day?: number
}

export interface ParsedEventDateRange extends ParsedEventDateBase {
  dateKind: 'RANGE'
  from: EventDateComponents
  to: EventDateComponents
}

export type ParsedEventDate =
  | ParsedEventDateExact
  | ParsedEventDateAbout
  | ParsedEventDateBefore
  | ParsedEventDateAfter
  | ParsedEventDateRange

/** Bulan singkat GEDCOM 7.0.18 (huruf besar). */
const MONTHS: Readonly<Record<string, number>> = {
  JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6,
  JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12,
}

const DAY_RE = /^\d{1,2}$/
const YEAR_RE = /^\d{1,4}$/

/** ISO 8601 calendar lengkap: "YYYY-MM-DD" (bulan dan hari dua digit). */
const ISO_YMD_RE = /^(\d{1,4})-(\d{2})-(\d{2})$/
/** ISO 8601 tahun-bulan: "YYYY-MM" (tanpa hari, jangan mengarang presisi). */
const ISO_YM_RE = /^(\d{1,4})-(\d{2})$/

/** Tahun kabisat Gregorian (aturan proleptik; komentar lihat bawah). */
function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28
  if (month === 4 || month === 6 || month === 9 || month === 11) return 30
  return 31
}

/**
 * Normalisasi ringan: trim, lipat whitespace, buang escape kalender
 * GEDCOM "@#DXxx@", kapitalkan (kata kunci dan bulan tak case-sensitif).
 */
function normalize(raw: string): string {
  return raw
    .replace(/@#D[A-Z]+@/gi, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase()
}

/** Urai satu tanggal tanpa kata kunci: "[DAY] [MON] YEAR". */
function parseExactTokens(normalized: string): EventDateComponents | null {
  const tokens = normalized.split(' ').filter((t) => t.length > 0)
  if (tokens.length < 1 || tokens.length > 3) return null

  const yearToken = tokens[tokens.length - 1]
  if (!YEAR_RE.test(yearToken)) return null
  const year = Number(yearToken)
  if (year < 1) return null

  let month: number | undefined
  let day: number | undefined

  if (tokens.length >= 2) {
    const monthToken = tokens[tokens.length - 2].slice(0, 3)
    month = MONTHS[monthToken]
    if (month === undefined) return null
  }

  if (tokens.length === 3) {
    if (!DAY_RE.test(tokens[0])) return null
    day = Number(tokens[0])
  }

  if (day !== undefined && (day < 1 || day > daysInMonth(year, month ?? 1))) {
    return null
  }

  return day !== undefined ? { year, month, day } : month !== undefined ? { year, month } : { year }
}

/**
 * Urai tanggal ISO 8601 calendar: "YYYY-MM-DD" atau "YYYY-MM".
 * Tahun memakai rentang aturan GEDCOM yang sudah ada (1 sampai 4 digit,
 * tahun >= 1, konstanta tidak diubah). Bulan wajib 01 sampai 12 dan hari
 * wajib 01 sampai panjang bulan Gregorian, sehingga bentuk mustahil
 * ("1945-13-01", "2023-02-29") gagal urai. Bentuk dengan bagian waktu
 * ("1945-03-15T10:00:00") tidak cocok pola apa pun di sini dan gagal:
 * jangan membuang bagian lalu mengarang presisi dari sisa yang tertinggal.
 * Tahun saja ("1945") sudah tertangani aturan YEAR GEDCOM di atas.
 */
function parseIsoDate(normalized: string): EventDateComponents | null {
  const ymd = normalized.match(ISO_YMD_RE)
  if (ymd) {
    const year = Number(ymd[1])
    const month = Number(ymd[2])
    const day = Number(ymd[3])
    if (year < 1 || month < 1 || month > 12) return null
    if (day < 1 || day > daysInMonth(year, month)) return null
    return { year, month, day }
  }
  const ym = normalized.match(ISO_YM_RE)
  if (ym) {
    const year = Number(ym[1])
    const month = Number(ym[2])
    if (year < 1 || month < 1 || month > 12) return null
    return { year, month }
  }
  return null
}

/**
 * Urai satu tanggal tanpa kata kunci pada posisi tanggal polos: coba
 * format GEDCOM dulu agar seluruh perilaku lama tetap identik, baru
 * fallback ke ISO 8601. Input yang gagal keduanya kembali null.
 */
function parsePlainDate(normalized: string): EventDateComponents | null {
  return parseExactTokens(normalized) ?? parseIsoDate(normalized)
}

/**
 * Parse string tanggal GEDCOM menjadi objek ParsedEventDate.
 * Gagal urai TIDAK melempar: kembalikan ABOUT tanpa komponen, dengan
 * originalDateString persis sama seperti input.
 */
export function parseEventDate(input: string): ParsedEventDate {
  const original = typeof input === 'string' ? input : String(input)
  const base = { originalDateString: original }
  const normalized = normalize(original)

  if (normalized.length === 0) {
    return { dateKind: 'ABOUT', ...base }
  }

  // RANGE: BET <DATE> AND <DATE>, kedua sisi wajib sah.
  const rangeMatch = normalized.match(/^BET\s+(.+?)\s+AND\s+(.+)$/)
  if (rangeMatch) {
    const from = parseExactTokens(rangeMatch[1].trim())
    const to = parseExactTokens(rangeMatch[2].trim())
    if (from && to) {
      return { dateKind: 'RANGE', from, to, ...base }
    }
    // "BET" tanpa AND atau salah satu sisi rusak: jangan mengarang presisi.
    return { dateKind: 'ABOUT', ...base }
  }

  // Kata kunci presisi longgar: ambil sisanya sebagai tanggal polos
  // (GEDCOM atau ISO 8601).
  const keywordMatch = normalized.match(/^(ABT|ABOUT|BEF|BEFORE|AFT|AFTER)\s+(.+)$/)
  if (keywordMatch) {
    const inner = parsePlainDate(keywordMatch[2].trim())
    if (!inner) return { dateKind: 'ABOUT', ...base }
    const kindMap = {
      ABT: 'ABOUT', ABOUT: 'ABOUT',
      BEF: 'BEFORE', BEFORE: 'BEFORE',
      AFT: 'AFTER', AFTER: 'AFTER',
    } as const
    return { dateKind: kindMap[keywordMatch[1] as keyof typeof kindMap], ...inner, ...base }
  }

  // Tanpa kata kunci: harus tanggal polos sah (GEDCOM atau ISO 8601),
  // kalau tidak jatuh ke ABOUT.
  const exact = parsePlainDate(normalized)
  if (exact) {
    return { dateKind: 'EXACT', ...exact, ...base }
  }
  return { dateKind: 'ABOUT', ...base }
}
