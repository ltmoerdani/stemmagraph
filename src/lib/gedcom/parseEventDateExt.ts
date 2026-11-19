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
//
// Perluasan v459b (fase integrasi): tanggal ber-kalender dan epoch.
// Grammar type-Date (gedcom.io, diakses 19 Nov 2026):
//   date = [calendar D] [[day D] month D] year [D epoch]
//   calendar = GREGORIAN / JULIAN / FRENCH_R / HEBREW / extTag
//   epoch = BCE / extTag
// Bentuk ber-kalender diurai sebagai dateKind CAL yang menyimpan badan
// tanggal verbatim (tanpa prefix kalender dan tanpa epoch) sehingga
// formatter bisa menulis kembali persis seperti sumber, termasuk untuk
// bulan non-Gregorian (HEBREW) yang tidak dipetakan di fase ini.
// Kalender extTag tidak ada di daftar resmi ditandai issue
// UNKNOWN_CALENDAR pada hasil: error terstruktur, tanpa lemparan.

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

/**
 * Tanggal ber-kalender GEDCOM 7 (v459b): prefix kalender dan epoch
 * dipisahkan, badan tanggal disimpan verbatim agar formatter bisa
 * menulis kembali identik tanpa memetakan bulan non-Gregorian.
 */
export interface ParsedEventDateCal {
  dateKind: 'CALENDAR'
  /** String input asli, utuh tanpa perubahan apa pun. */
  originalDateString: string
  /** Tag kalender terkapitalisasi: resmi atau extTag tanpa @#D..@. */
  calendar: string
  /** Bentuk prefix verbatim untuk tulis balik identik (mis. "@#DJULIAN@"). */
  prefixVerbatim: string
  /** true bila kalender bukan anggota daftar resmi spec (extTag). */
  unknownCalendar: boolean
  /** Epoch verbatim bila dinyatakan (mis. "BCE"), undefined bila tidak. */
  epoch?: string
  /** Badan tanggal setelah prefix kalender dan epoch, verbatim terlipat. */
  body: string
  /** Komponen Gregorian setara bila badan dikenali parser polos. */
  components?: EventDateComponents
  /** Temuan terstruktur, mis. UNKNOWN_CALENDAR; tanpa lemparan. */
  issues?: string[]
}

/** Hasil urai diperluas: union existing ditambah PERIOD, PHRASE, CALENDAR. */
export type ParsedEventDateExt =
  | ParsedEventDate
  | ParsedEventDatePeriod
  | ParsedEventDatePhrase
  | ParsedEventDateCal

/** Kalender resmi GEDCOM 7 type-Date (diakses 19 Nov 2026). */
const OFFICIAL_CALENDARS: ReadonlySet<string> = new Set([
  'GREGORIAN', 'JULIAN', 'FRENCH_R', 'HEBREW',
])

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

  // Kalender dicek paling awal: prefix terikat pada badan sesudahnya
  // (spec 6.3, pola parser-stat-cal existing), bentuknya selalu di awal.
  const cal = matchCalendarPrefix(folded, input)
  if (cal !== null) return cal

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

/**
 * Deteksi prefix kalender pada awal payload: bentuk escape @#DTAG@ atau
 * nama polos. Tag resmi dan extTag (underscore) sama-sama diterima;
 * extTag ditandai UNKNOWN_CALENDAR pada hasil, tanpa lemparan.
 * Kembalikan null bila awal payload bukan prefix kalender.
 */
function matchCalendarPrefix(
  folded: string,
  original: string,
): ParsedEventDateCal | null {
  const atForm = /^@#D([A-Za-z0-9_]+)@\s+(.+)$/.exec(folded)
  const plainForm = /^([A-Za-z][A-Za-z0-9_]*|_[A-Za-z0-9_]+)\s+(.+)$/.exec(folded)
  const tag = atForm?.[1] ?? plainForm?.[1]
  if (tag === undefined) return null

  const upper = tag.toUpperCase()
  const isExt = upper.startsWith('_')
  const official = !isExt && OFFICIAL_CALENDARS.has(upper)
  // Hanya kalender resmi, bentuk escape @#D..@, atau extTag underscore
  // yang diperlakukan sebagai prefix kalender; kata lain (mis. FROM,
  // TO, INT) jatuh ke aturan kata kunci di bawah.
  if (!official && atForm === null && !isExt) return null

  const body = (atForm?.[2] ?? plainForm?.[2] ?? '').trim()
  const issues: string[] = []
  const normalizedTag = upper
  if (!official) {
    issues.push('UNKNOWN_CALENDAR')
  }

  // Epoch di akhir badan: BCE resmi atau extTag verbatim.
  const epochForm = /\s+(BCE|_[A-Za-z0-9_]+)$/.exec(body)
  let rest = body
  let epoch: string | undefined
  if (epochForm !== null) {
    epoch = epochForm[1]
    rest = body.slice(0, epochForm.index).trim()
  }

  const inner = rest === '' ? null : parseSide(rest)
  const prefixVerbatim = atForm !== null ? `@#D${tag}@` : (tag ?? upper)
  const result: ParsedEventDateCal = {
    dateKind: 'CALENDAR',
    originalDateString: original,
    calendar: normalizedTag,
    prefixVerbatim,
    unknownCalendar: issues.length > 0,
    body: rest,
    ...(epoch !== undefined ? { epoch } : {}),
    ...(inner !== null ? { components: inner } : {}),
  }
  return issues.length > 0 ? { ...result, issues } : result
}

/**
 * Gate fail-closed v459b (AC4): substructure TIME hanya sah pada
 * DateExact per spec type-DATE; TIME pada DatePeriod (FROM/TO) ditolak.
 * Kembalikan kode pelanggaran terstruktur atau null bila sah. Tanpa
 * lemparan: pemanggil memutuskan sendiri cara menandai gagal.
 */
export function dateSubstructureViolation(
  parsed: ParsedEventDateExt,
  hasTimeSubstructure: boolean,
): 'TIME_ON_PERIOD' | null {
  if (hasTimeSubstructure && parsed.dateKind === 'PERIOD') return 'TIME_ON_PERIOD'
  return null
}
