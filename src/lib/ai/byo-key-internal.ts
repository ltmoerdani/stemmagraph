/**
 * Ekspor internal untuk test (micro-2 AC3/AC5).
 *
 * Pemisahan modul ini menjaga byo-key-manager.ts tetap bersih dari
 * utilitas murni sambil memungkinkan test mengimpor fungsi validasi
 * dan masking tanpa memicu koneksi IndexedDB (lingkungan node).
 */

import { maskApiKey } from './byo-key-mask'

export { maskApiKey }

/** Panjang minimum agar suffix 4 karakter boleh ditampilkan. */
const MIN_KEY_LENGTH = 8

/**
 * Sama seperti kontrak isValidKeyFormat di byo-key-manager.ts:
 * string minimal 8 karakter tanpa whitespace. Didefinisikan ulang di
 * sini sebagai sumber test murni tanpa menyentuh jalur IDB.
 */
export function isValidKeyFormat(rawKey: unknown): rawKey is string {
  if (typeof rawKey !== 'string') {
    return false
  }
  if (rawKey.length < MIN_KEY_LENGTH) {
    return false
  }
  return !/\s/.test(rawKey)
}

/**
 * Masking dengan suffix terkontrol untuk kasus log: delegasi penuh ke
 * maskApiKey supaya kontrak AC1 ada di satu tempat.
 */
export function maskKeySuffix(key: unknown): string {
  return maskApiKey(key)
}
