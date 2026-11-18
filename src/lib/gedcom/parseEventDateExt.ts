// Perluasan urai DATE GEDCOM 7 untuk v459 fase 1: periode (FROM/TO) dan
// phrase (INT). parseEventDate.ts existing sudah menangani EXACT, ABT,
// BEF, AFT, dan rentang BET..AND; modul ini menambah dua bentuk sisanya
// dari bab Date pada spec GEDCOM 7.0.18 dengan pola yang sama: tidak
// pernah melempar, gagal urai jatuh ke ABOUT tanpa mengarang presisi,
// originalDateString selalu utuh.
//
// Delegasi: input yang bukan FROM/TO/INT diteruskan utuh ke
// parseEventDate sehingga perilaku existing tidak berubah sama sekali.
// Murni fungsi: tanpa DB, tanpa env, tanpa efek samping.

import { parseEventDate } from './parseEventDate'
import type { EventDateComponents, ParsedEventDate } from './parseEventDate'

/** Periode GEDCOM 7: FROM dan/atau TO. Sisi kosong = null, bukan tebakan. */
export interface ParsedEventDatePeriod {
  dateKind: 'PERIOD'
  /** String input asli, utuh tanpa perubahan apa pun. */
  originalDateString: string
  /** Komponen FROM, null bila tidak ada FROM pada input. */
  from: EventDateComponents | null
  /** Komponen TO, null bila tidak ada TO pada input. */
  to: EventDateComponents | null
}

/** Phrase GEDCOM 7: INT diikuti teks bebas, dipertahankan verbatim. */
export interface ParsedEventDatePhrase {
  dateKind: 'PHRASE'
  /** String input asli, utuh tanpa perubahan apa pun. */
  originalDateString: string
  /** Teks setelah kata kunci INT, utuh tanpa normalisasi kapital. */
  phrase: string
}

/** Hasil urai diperluas: union existing ditambah PERIOD dan PHRASE. */
export type ParsedEventDateExt =
  | ParsedEventDate
  | ParsedEventDatePeriod
  | ParsedEventDatePhrase

/** Lipat whitespace dan trim tanpa mengubah kapitalisasi (phrase verbatim). */
function fold(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ')
}

/**
 * Urai satu sisi tanggal polos untuk FROM/TO: hanya EXACT sah per spec
 * (date sederhana, bukan date value ber-kata kunci). Mengembalikan null
 * untuk sisi tak sah atau tanggal mustahil, tanpa mengarang presisi.
 */
function parseSide(raw: string): EventDateComponents | null {
  const parsed = parseEventDate(raw)
  if (parsed.dateKind !== 'EXACT') return null
  return { year: parsed.year, month: parsed.month, day: parsed.day }
}

/**
 * Urai DATE GEDCOM 7 dengan dukungan periode dan phrase.
 *
 * Urutan pencocokan (case-insensitive pada kata kunci):
 *   FROM <date> TO <date> menjadi PERIOD kedua sisi
 *   FROM <date> menjadi PERIOD hanya from
 *   TO <date> menjadi PERIOD hanya to
 *   INT <teks> menjadi PHRASE verbatim
 *   selain itu didelegasikan ke parseEventDate (EXACT/ABOUT/BEF/AFT/BET-AND)
 *
 * FROM/TO dengan sisi tak sah (mis. sisi ber-kata kunci atau tanggal
 * mustahil) jatuh ke ABOUT dengan original utuh, konsisten dengan
 * disiplin parseEventDate: gagal urai tidak boleh mengarang presisi.
 */
export function parseEventDateExt(input: string): ParsedEventDateExt {
  const folded = fold(input)

  const fromTo = /^FROM\s+(.+?)\s+TO\s+(.+)$/i.exec(folded)
  if (fromTo) {
    const from = parseSide(fromTo[1] ?? '')
    const to = parseSide(fromTo[2] ?? '')
    if (from && to) {
      return { dateKind: 'PERIOD', originalDateString: input, from, to }
    }
    return { dateKind: 'ABOUT', originalDateString: input }
  }

  const fromOnly = /^FROM\s+(.+)$/i.exec(folded)
  if (fromOnly) {
    const from = parseSide(fromOnly[1] ?? '')
    if (from) {
      return { dateKind: 'PERIOD', originalDateString: input, from, to: null }
    }
    return { dateKind: 'ABOUT', originalDateString: input }
  }

  const toOnly = /^TO\s+(.+)$/i.exec(folded)
  if (toOnly) {
    const to = parseSide(toOnly[1] ?? '')
    if (to) {
      return { dateKind: 'PERIOD', originalDateString: input, from: null, to }
    }
    return { dateKind: 'ABOUT', originalDateString: input }
  }

  const phrase = /^INT\s+(.+)$/i.exec(folded)
  if (phrase) {
    return {
      dateKind: 'PHRASE',
      originalDateString: input,
      // Teks phrase dari input asli setelah kata kunci INT, verbatim.
      phrase: extractPhraseVerbatim(input),
    }
  }

  return parseEventDate(input)
}

/** Ambil teks setelah kata kunci INT dari input asli, verbatim. */
function extractPhraseVerbatim(raw: string): string {
  const m = /\bINT\s+(.+)$/i.exec(raw.trim().replace(/\s+/g, ' '))
  return m?.[1] ?? ''
}
