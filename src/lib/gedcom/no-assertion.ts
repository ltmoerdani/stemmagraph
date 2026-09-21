/**
 * NO (negative assertion) untuk parse GEDCOM 7 (v137-i).
 *
 * GEDCOM 7 memperkenalkan struktur NO sebagai non-event assertion:
 * pernyataan bahwa suatu event TIDAK terjadi (contoh: NO MARR
 * berarti tidak pernah menikah). Lihat notes/306: term NO,
 * enumset-EVEN 31 nilai, NON_EVENT_STRUCTURE, spec 7.0.18.
 *
 * Kontrak modul ini pure: tidak membaca DB, tidak menyentuh
 * import/export pipeline, hanya menormalkan dan memvalidasi
 * baris-baris NO dari teks GEDCOM.
 *
 * Bentuk sumber:
 * - `1 NO MARR` membuka assertion event MARR.
 * - `2 DATE TO 1900` atau `2 DATE FROM 1900 TO 1950` (DatePeriod).
 * - `3 PHRASE teks` / `2 SNOTE teks` / `2 NOTE teks`.
 * - Payload event valid: salah satu dari 31 enum EVEN ATAU
 *   extTag dengan awalan underscore (contoh: _MYEVENT).
 */

/**
 * Enumset-EVEN GEDCOM 7: tepat 31 nilai event yang sah sebagai
 * payload NO (notes/306 temuan enum).
 */
export const NO_EVENT_ENUM: ReadonlySet<string> = new Set([
  'CENS', 'ADOP', 'BAPM', 'BARM', 'BASM', 'BIRT', 'BLES', 'BURI',
  'CHR', 'CHRA', 'CONF', 'CREM', 'DEAT', 'EMIG', 'FCOM', 'GRAD',
  'IMMI', 'NATU', 'ORDN', 'PROB', 'RETI', 'WILL', 'ANUL', 'DIV',
  'DIVF', 'ENGA', 'MARB', 'MARC', 'MARL', 'MARR', 'MARS',
])

/** Satu assertion NO yang berhasil di-parse. */
export interface ParsedNoAssertion {
  /** Tag event: enum EVEN atau extTag underscore (verbatim). */
  event: string
  /** Nilai DATE mentah bila ada (belum dinormalkan). */
  date?: string
  /** Nilai PHRASE bila ada. */
  phrase?: string
  /** Nilai NOTE atau SNOTE bila ada (SNOTE diprioritaskan). */
  note?: string
}

/** Peringatan terstruktur untuk payload NO tidak valid. */
export interface NoAssertionWarning {
  /** Nomor baris input (1-based). */
  line: number
  message: string
}

/** Hasil parse sekumpulan baris NO. */
export interface ParsedNoResult {
  assertions: ParsedNoAssertion[]
  warnings: NoAssertionWarning[]
}

/**
 * Cek apakah tag event sah sebagai payload NO:
 * anggota enumset-EVEN ATAU extTag berawalan underscore.
 */
export function isNoAssertionEvent(tag: string): boolean {
  return NO_EVENT_ENUM.has(tag) || tag.startsWith('_')
}

/**
 * Parse DatePeriod NO-DATE: bentuk `TO <date>` atau
 * `FROM <date> TO <date>`. Mengembalikan null bila raw bukan
 * pola yang dikenal (bukan error, hanya bukan DatePeriod).
 */
export function parseNoDatePeriod(
  raw: string,
): { kind: 'TO' | 'FROM-TO'; from?: string; to: string } | null {
  const trimmed = raw.trim()

  const toOnly = /^TO\s+(.+)$/.exec(trimmed)
  if (toOnly) {
    return { kind: 'TO', to: toOnly[1].trim() }
  }

  const fromTo = /^FROM\s+(.+?)\s+TO\s+(.+)$/.exec(trimmed)
  if (fromTo) {
    return { kind: 'FROM-TO', from: fromTo[1].trim(), to: fromTo[2].trim() }
  }

  return null
}

/**
 * Parse baris-baris GEDCOM yang berisi struktur NO.
 *
 * State machine multi-kejadian: setiap baris `n NO <payload>`
 * membuka assertion baru; baris DATE/PHRASE/SNOTE/NOTE ber-level
 * lebih dalam dilampirkan ke assertion terbuka. Baris lain
 * menutup assertion terbuka.
 *
 * Payload tidak valid (bukan enum EVEN dan bukan extTag)
 * menghasilkan warning terstruktur, BUKAN throw: lapisan parse
 * tidak menghakimi, mengikuti pola modul pure existing.
 */
export function parseNoLines(lines: readonly string[]): ParsedNoResult {
  const assertions: ParsedNoAssertion[] = []
  const warnings: NoAssertionWarning[] = []

  let current: ParsedNoAssertion | null = null
  let currentDepth = 0

  const close = (): void => {
    current = null
    currentDepth = 0
  }

  lines.forEach((rawLine, index) => {
    const lineNumber = index + 1
    const match = /^(\d+)\s+(.+)$/.exec(rawLine.trim())
    if (!match) {
      close()
      return
    }

    const depth = Number(match[1])
    const rest = match[2]
    const spaceIndex = rest.indexOf(' ')
    const tag = spaceIndex === -1 ? rest : rest.slice(0, spaceIndex)
    const value = spaceIndex === -1 ? '' : rest.slice(spaceIndex + 1).trim()

    if (tag === 'NO') {
      close()
      if (!isNoAssertionEvent(value)) {
        warnings.push({
          line: lineNumber,
          message: `payload NO tidak valid: ${value || '(kosong)'}`,
        })
        current = null
        return
      }
      current = { event: value }
      currentDepth = depth
      assertions.push(current)
      return
    }

    if (current !== null && depth > currentDepth) {
      if (tag === 'DATE') {
        current.date = value
        return
      }
      if (tag === 'PHRASE') {
        current.phrase = value
        return
      }
      if (tag === 'SNOTE' || tag === 'NOTE') {
        current.note = value
        return
      }
    }

    close()
  })

  return { assertions, warnings }
}
