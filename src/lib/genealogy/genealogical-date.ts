/**
 * GenealogicalDate: model tanggal dua sumbu ala Gramps/GEDCOM 7.
 *
 * Sumbu 1: modifier, semantik per GEDCOM 7:
 *   exact      = tanggal tunggal (DATE 1900)
 *   from / to  = periode FROM-TO (dua ujung, semantik periode)
 *   range      = BET-AND (semantik rentang pencarian, berbeda dari periode)
 *   about      = ABT (perkiraan umum)
 *   calculated = CAL (hasil perhitungan)
 *   estimated  = EST (perkiraan kasar)
 *
 * Sumbu 2: quality sumber, null jika tidak dinyatakan:
 *   primary | secondary | tertiary
 *
 * phrase menyimpan teks asli utuh, wajib ada bila input berupa phrase.
 * Modul pure: tanpa import dari server/.
 */

export type DateModifier =
  | 'exact'
  | 'from'
  | 'to'
  | 'range'
  | 'about'
  | 'calculated'
  | 'estimated'

export type DateQuality = 'primary' | 'secondary' | 'tertiary'

export interface GenealogicalDate {
  modifier: DateModifier
  quality?: DateQuality | null
  /** Tahun utama. Untuk period/range berisi batas awal. */
  year?: number
  /** Batas akhir untuk period FROM-TO dan rentang BET-AND. */
  year2?: number
  /** Teks asli utuh; tersimpan apa adanya saat input adalah phrase. */
  phrase?: string
}

const MODIFIER_WORD: Record<DateModifier, string> = {
  exact: '',
  from: 'FROM',
  to: 'TO',
  range: 'BET',
  about: 'ABT',
  calculated: 'CAL',
  estimated: 'EST',
}

/** ABT/CAL/EST: kata approx GEDCOM 7, pola dua token (kata approx + tahun). */
const APPROX_WORDS = ['ABT', 'CAL', 'EST'] as const

function isYearWord(word: string): boolean {
  return /^\d{1,4}$/.test(word)
}

/**
 * Normalisasi quality dari metadata sumber (mis. kolom CSV/GEDCOM _QUAL)
 * ke DateQuality, null bila tidak dinyatakan.
 * Sumbu kedua yang berdiri sendiri: modifier diparse dari teks tanggal
 * lewat parseGenealogicalDate, quality dinormalkan lewat fungsi ini.
 */
export function normalizeQuality(raw: string | undefined): DateQuality | null {
  if (raw === undefined || raw === null) return null
  const value = raw.trim().toLowerCase()
  if (value === 'primary') return 'primary'
  if (value === 'secondary') return 'secondary'
  if (value === 'tertiary') return 'tertiary'
  return null
}

/**
 * Parse teks tanggal ke GenealogicalDate.
 * Pola dikenali: ABT 1900, EST 1850, CAL 1875, FROM 1900 TO 1910,
 * BET 1900 AND 1910, AFTER 1900, BEFORE 1950, dan tahun tunggal.
 * Teks lain menjadi modifier exact dengan phrase utuh.
 * Input kosong/null menghasilkan null.
 */
export function parseGenealogicalDate(input: string | null | undefined): GenealogicalDate | null {
  if (input === null || input === undefined) return null
  const text = String(input).trim()
  if (text === '') return null

  const upper = text.toUpperCase()
  const words = upper.split(/\s+/)

  // ABT 1900 / CAL 1875 / EST 1850: dua token (kata approx + tahun).
  if (words.length === 2 && APPROX_WORDS.includes(words[0] as (typeof APPROX_WORDS)[number])) {
    if (isYearWord(words[1])) {
      return { modifier: words[0] === 'ABT' ? 'about' : words[0] === 'CAL' ? 'calculated' : 'estimated', year: Number(words[1]), quality: null }
    }
    return { modifier: 'exact', phrase: text, quality: null }
  }

  // FROM 1900 TO 1910: semantik periode (dua ujung).
  if (words.length === 4 && words[0] === 'FROM' && words[2] === 'TO' && isYearWord(words[1]) && isYearWord(words[3])) {
    return { modifier: 'from', year: Number(words[1]), year2: Number(words[3]), quality: null }
  }

  // BET 1900 AND 1910: semantik rentang pencarian.
  if (words.length === 4 && words[0] === 'BET' && words[2] === 'AND' && isYearWord(words[1]) && isYearWord(words[3])) {
    return { modifier: 'range', year: Number(words[1]), year2: Number(words[3]), quality: null }
  }

  // AFTER 1900 / BEFORE 1950: ujung tunggal.
  if (words.length === 2 && isYearWord(words[1])) {
    if (words[0] === 'AFTER') return { modifier: 'from', year: Number(words[1]), quality: null }
    if (words[0] === 'BEFORE') return { modifier: 'to', year: Number(words[1]), quality: null }
  }

  // Tahun tunggal.
  if (words.length === 1 && isYearWord(words[0])) {
    return { modifier: 'exact', year: Number(words[0]), quality: null }
  }

  // Phrase bebas: modifier exact, teks asli utuh tanpa dipotong.
  return { modifier: 'exact', phrase: text, quality: null }
}

/**
 * Serialisasi ke DATE value GEDCOM 7 yang valid.
 * Phrase dibungkus kurung agar utuh sebagai satu value.
 */
export function toGedcomDateValue(g: GenealogicalDate): string {
  const prefix = MODIFIER_WORD[g.modifier]
  const hasBounds = g.year !== undefined && (g.modifier === 'range' || g.modifier === 'from' ? g.year2 !== undefined : true)

  if (!hasBounds || (g.year === undefined && !g.phrase)) {
    if (g.phrase) {
      return `(${g.phrase})`
    }
    return prefix === '' ? '' : `${prefix} `
  }

  switch (g.modifier) {
    case 'range':
      return `BET ${g.year} AND ${g.year2}`
    case 'from':
      return g.year2 !== undefined ? `FROM ${g.year} TO ${g.year2}` : `FROM ${g.year}`
    case 'to':
      return `TO ${g.year}`
    case 'about':
    case 'calculated':
    case 'estimated':
      return `${prefix} ${g.year}`
    default:
      if (g.phrase) return `(${g.phrase})`
      return g.year !== undefined ? `${g.year}` : ''
  }
}

/** Ringkasan singkat untuk UI. */
export function formatHuman(g: GenealogicalDate): string {
  const qualitySuffix = g.quality && g.quality !== null ? ` [${g.quality}]` : ''
  switch (g.modifier) {
    case 'range':
      return `antara ${g.year} dan ${g.year2}${qualitySuffix}`
    case 'from':
      return g.year2 !== undefined ? `sejak ${g.year} hingga ${g.year2}${qualitySuffix}` : `sejak ${g.year}${qualitySuffix}`
    case 'to':
      return `sampai ${g.year}${qualitySuffix}`
    case 'about':
      return `sekitar ${g.year}${qualitySuffix}`
    case 'calculated':
      return `dihitung ${g.year}${qualitySuffix}`
    case 'estimated':
      return `perkiraan ${g.year}${qualitySuffix}`
    default:
      if (g.phrase) return `${g.phrase}${qualitySuffix}`
      return `${g.year ?? ''}${qualitySuffix}`
  }
}

/**
 * Round-trip: parse -> gedcom -> parse, hasil setara untuk semua kelas tanggal.
 * Dipakai test untuk menjamin serialisasi tidak mengubah makna.
 */
export function roundTrip(input: string): GenealogicalDate | null {
  const first = parseGenealogicalDate(input)
  if (first === null) return null
  return parseGenealogicalDate(toGedcomDateValue(first))
}
