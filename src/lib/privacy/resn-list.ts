/**
 * Penanganan RESN multi-nilai GEDCOM 7 (v130-i).
 *
 * ABNF GEDCOM 7 mendefinisikan RESN sebagai list of enum: satu nilai
 * atau beberapa nilai yang dipisah koma. listDelim memperbolehkan
 * pemisah tanpa spasi maupun dengan spasi, sehingga bentuk resmi
 * testfile maximal70.ged seperti 'CONFIDENTIAL, LOCKED' maupun bentuk
 * 'CONFIDENTIAL,LOCKED' keduanya sah.
 *
 * Modul ini pure: tidak ada I/O, tidak ada dependensi selain tipe
 * ResnLevel dari resn.ts (v128).
 */

import type { ResnLevel } from './resn.js'
import { RESN_LEVELS } from './resn.js'

/**
 * Urai string RESN mentah menjadi daftar ResnLevel.
 *
 * - Split pada koma, trim spasi di tiap item, buang item kosong.
 * - Validasi tiap item case-insensitive terhadap tiga nilai enumset;
 *   item tak dikenal diabaikan tanpa error (malformed tidak melebarkan
 *   akses, ia hanya tidak berkontribusi).
 * - null/undefined/empty mengembalikan []: tidak ada RESN tercatat.
 */
export function parseResnList(raw: string | null | undefined): ResnLevel[] {
  if (raw == null) return []
  const out: ResnLevel[] = []
  for (const part of raw.split(',')) {
    const candidate = part.trim().toUpperCase()
    if (RESN_LEVELS.some((level) => level === candidate)) {
      out.push(candidate as ResnLevel)
    }
  }
  return out
}

/**
 * Rakit daftar ResnLevel menjadi satu string RESN.
 *
 * - Join dengan comma-space, byte-compatible dengan testfile resmi
 *   maximal70.ged ('CONFIDENTIAL, LOCKED').
 * - Array kosong mengembalikan '': tidak ada nilai RESN untuk ditulis.
 */
export function serializeResnList(levels: ResnLevel[]): string {
  return levels.join(', ')
}

/**
 * Petakan daftar ResnLevel ke privacyStatus internal.
 *
 * - Kombinasi apapun yang non-kosong mengembalikan 'private': semua
 *   nilai enumset RESN berarti pembatasan, dan Stemmagraph fase ini
 *   hanya punya dua nilai privacyStatus.
 * - Array kosong mengembalikan null: status tidak diketahui, pemanggil
 *   menulis NULL ke DB. Konsisten dengan safe default asimetris v128.
 */
export function resnListToPrivacyStatus(
  levels: ResnLevel[],
): 'shared' | 'private' | null {
  if (levels.length === 0) return null
  return 'private'
}
