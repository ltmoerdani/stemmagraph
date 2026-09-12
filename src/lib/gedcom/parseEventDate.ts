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

  // Kata kunci presisi longgar: ambil sisanya sebagai tanggal exact.
  const keywordMatch = normalized.match(/^(ABT|ABOUT|BEF|BEFORE|AFT|AFTER)\s+(.+)$/)
  if (keywordMatch) {
    const inner = parseExactTokens(keywordMatch[2].trim())
    if (!inner) return { dateKind: 'ABOUT', ...base }
    const kindMap = {
      ABT: 'ABOUT', ABOUT: 'ABOUT',
      BEF: 'BEFORE', BEFORE: 'BEFORE',
      AFT: 'AFTER', AFTER: 'AFTER',
    } as const
    return { dateKind: kindMap[keywordMatch[1] as keyof typeof kindMap], ...inner, ...base }
  }

  // Tanpa kata kunci: harus exact sah, kalau tidak jatuh ke ABOUT.
  const exact = parseExactTokens(normalized)
  if (exact) {
    return { dateKind: 'EXACT', ...exact, ...base }
  }
  return { dateKind: 'ABOUT', ...base }
}
