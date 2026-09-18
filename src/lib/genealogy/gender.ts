/**
 * Gender model genealogi-grade: ganti biner dengan 4 nilai.
 * M = male, F = female, X = other/nonbinary, U = unknown (default).
 * Enumset SEX GEDCOM 7 menerima M, F, X, U.
 * Modul pure: tanpa import dari server/.
 */

export type Gender = 'M' | 'F' | 'X' | 'U'

export const DEFAULT_GENDER: Gender = 'U'

/**
 * Normalisasi teks bebas ke Gender.
 * male/m jadi M, female/f jadi F, other/x/nonbinary jadi X,
 * sisanya (termasuk null/undefined/teks asing) jadi U.
 */
export function normalizeGender(input: string | null | undefined): Gender {
  if (input === null || input === undefined) return DEFAULT_GENDER
  const value = String(input).trim().toLowerCase()
  switch (value) {
    case 'male':
    case 'm':
      return 'M'
    case 'female':
    case 'f':
      return 'F'
    case 'other':
    case 'x':
    case 'nonbinary':
    case 'non-binary':
      return 'X'
    default:
      return DEFAULT_GENDER
  }
}

/** Serialisasi ke value SEX GEDCOM 7 (enumset M/F/X/U). */
export function toGedcomSex(g: Gender): string {
  switch (g) {
    case 'M':
    case 'F':
    case 'X':
    case 'U':
      return g
    default:
      return DEFAULT_GENDER
  }
}
