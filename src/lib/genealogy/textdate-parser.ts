/**
 * Parser tanggal teks legacy (gaya GEDCOM/Gramps) menjadi GenealogicalDate.
 *
 * Aturan kejujuran presisi (ADR 0011): input yang tidak terurai secara penuh
 * disimpan sebagai modifier 'about' + phrase teks asli utuh, TANPA year.
 * Modul pure: tanpa import dari server/, store, atau dependensi eksternal.
 */

import type { GenealogicalDate } from './genealogical-date'

const MONTHS: Record<string, true> = {
  JAN: true,
  FEB: true,
  MAR: true,
  APR: true,
  MAY: true,
  JUN: true,
  JUL: true,
  AUG: true,
  SEP: true,
  OCT: true,
  NOV: true,
  DEC: true,
}

/**
 * Mengurai string tanggal teks legacy menjadi GenealogicalDate.
 * Toleran huruf besar-kecil, spasi di trim. Mengembalikan null untuk
 * input kosong atau whitespace saja.
 */
export function parseTextDate(input: string): GenealogicalDate | null {
  const text = input.trim()
  if (text.length === 0) return null
  const upper = text.toUpperCase()

  // '1945' = exact year
  let m = upper.match(/^(\d{4})$/)
  if (m) return { modifier: 'exact', year: Number(m[1]) }

  // '12 MAR 1945' = exact year + phrase (bulan tersimpan di phrase asli)
  m = upper.match(/^(\d{1,2})\s+([A-Z]{3})\s+(\d{4})$/)
  if (m && MONTHS[m[2]]) {
    return { modifier: 'exact', year: Number(m[3]), phrase: text }
  }

  // 'MAR 1945' = exact year + phrase
  m = upper.match(/^([A-Z]{3})\s+(\d{4})$/)
  if (m && MONTHS[m[1]]) {
    return { modifier: 'exact', year: Number(m[2]), phrase: text }
  }

  // 'ABT 1945' / 'EST 1945' / 'CAL 1945'
  m = upper.match(/^(ABT|EST|CAL)\s+(\d{4})$/)
  if (m) {
    const modifier =
      m[1] === 'ABT' ? 'about' : m[1] === 'EST' ? 'estimated' : 'calculated'
    return { modifier, year: Number(m[2]) }
  }

  // 'BEF 1945' = to (batas atas, bukan exact)
  m = upper.match(/^BEF\s+(\d{4})$/)
  if (m) return { modifier: 'to', year: Number(m[1]) }

  // 'AFT 1945' = from (batas bawah)
  m = upper.match(/^AFT\s+(\d{4})$/)
  if (m) return { modifier: 'from', year: Number(m[1]) }

  // 'BET 1940 AND 1945' = range
  m = upper.match(/^BET\s+(\d{4})\s+AND\s+(\d{4})$/)
  if (m) return { modifier: 'range', year: Number(m[1]), year2: Number(m[2]) }

  // 'FROM 1940 TO 1945' = period from-to
  m = upper.match(/^FROM\s+(\d{4})\s+TO\s+(\d{4})$/)
  if (m) return { modifier: 'from', year: Number(m[1]), year2: Number(m[2]) }

  // Tidak terurai: about + phrase teks asli utuh, tanpa year (ADR 0011)
  return { modifier: 'about', phrase: text }
}
