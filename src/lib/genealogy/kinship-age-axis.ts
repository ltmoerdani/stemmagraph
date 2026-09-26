// Sumbu usia saudara dan komposisi frasa usia (GAP #6 Pilar 3).
// Sumber: notes 401 (halaman adik KBBI edisi III) dan notes 404
// (asimetri pembukuan: kakak ipar tak tercatat sebagai sub-entri).
// Pure function, tanpa dependensi react, zustand, prisma, atau server.

export type AgeAxis = 'older' | 'younger' | 'unknown'

export interface AgeCompositeResult {
  base: string
  axis: AgeAxis
  dictionaryRecorded: boolean
}

interface CompositeEntry {
  base: 'adik' | 'kakak'
  axis: AgeAxis
  dictionaryRecorded: boolean
}

/**
 * Komposit usia resmi: enam sub-entri halaman adik KBBI edisi III
 * (dictionaryRecorded true) plus kakak ipar sebagai komposisi
 * produktif yang tidak tercatat kamus (dictionaryRecorded false).
 * Sumbu usia adalah atribut, bukan kind baru.
 */
const AGE_COMPOSITES: Record<string, CompositeEntry> = {
  'adik bungsu': { base: 'adik', axis: 'younger', dictionaryRecorded: true },
  'adik ipar': { base: 'adik', axis: 'younger', dictionaryRecorded: true },
  'adik seayah': { base: 'adik', axis: 'younger', dictionaryRecorded: true },
  'adik seibu': { base: 'adik', axis: 'younger', dictionaryRecorded: true },
  'adik seibu seayah': { base: 'adik', axis: 'younger', dictionaryRecorded: true },
  'adik sepupu': { base: 'adik', axis: 'younger', dictionaryRecorded: true },
  'kakak ipar': { base: 'kakak', axis: 'older', dictionaryRecorded: false },
}

/** Normalisasi frasa: trim, lowercase, rapat spasi ganda. */
function normalize(phrase: string): string {
  return phrase
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

function toTime(value: string | Date | null | undefined): number | null {
  if (value === null || value === undefined) return null
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.getTime()
  }
  if (value.trim() === '') return null
  const time = new Date(value).getTime()
  return Number.isNaN(time) ? null : time
}

/**
 * Bandingkan dua tanggal lahir opsional.
 * older bila A lahir lebih dulu, younger bila A lebih belakangan,
 * unknown bila salah satu nihil, invalid, atau tanggal identik.
 * Tidak pernah throw.
 */
export function resolveSiblingAgeAxis(
  birthA: string | Date | null | undefined,
  birthB: string | Date | null | undefined,
): AgeAxis {
  const timeA = toTime(birthA)
  const timeB = toTime(birthB)
  if (timeA === null || timeB === null) return 'unknown'
  if (timeA === timeB) return 'unknown'
  return timeA < timeB ? 'older' : 'younger'
}

/**
 * Kenali frasa komposit usia. Return null bila frasa tidak dikenali,
 * termasuk adik atau kakak tanpa pelengkap usia.
 */
export function resolveAgeCompositePhrase(phrase: string): AgeCompositeResult | null {
  const key = normalize(phrase)
  const entry = AGE_COMPOSITES[key]
  if (entry === undefined) return null
  return {
    base: entry.base,
    axis: entry.axis,
    dictionaryRecorded: entry.dictionaryRecorded,
  }
}
