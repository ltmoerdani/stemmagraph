/**
 * Manager API key BYO (STG v420 Pilar 5, micro-2, AC3 + AC4).
 *
 * Lapisan validasi dan rotasi di atas byo-key-store: format key
 * divalidasi sebelum menyimpan, key invalid ditolak dengan pesan
 * generik tanpa membocorkan isi key, dan rotasi dilakukan saat
 * runtime (menimpa slot) tanpa reload halaman.
 *
 * Kontrak BYO: key milik pengguna, self-host, tidak ada telemetri,
 * tidak ada pengiriman key ke luar aplikasi.
 */

import {
  ByoKeyError,
  apiKeyError,
} from './byo-key-mask'
import {
  loadApiKey,
  removeApiKey,
  saveApiKey,
} from './byo-key-store'

/** Key valid: string minimal 8 karakter tanpa karakter spasi apa pun. */
const MIN_KEY_LENGTH = 8

function isValidKeyFormat(rawKey: unknown): rawKey is string {
  if (typeof rawKey !== 'string') {
    return false
  }
  if (rawKey.length < MIN_KEY_LENGTH) {
    return false
  }
  return !/\s/.test(rawKey)
}

/**
 * Validasi lalu simpan API key ke slot.
 *
 * AC3: key invalid (bukan string, terlalu pendek, mengandung
 * whitespace) ditolak dengan ByoKeyError berpesan generik dari
 * apiKeyError, TANPA menyertakan isi key, suffix, atau panjang
 * pastinya.
 *
 * @throws ByoKeyError bila format tidak valid.
 */
export async function setApiKey(slot: string, rawKey: string): Promise<void> {
  if (!isValidKeyFormat(rawKey)) {
    throw new ByoKeyError('BYO_KEY_INVALID_FORMAT', apiKeyError('invalid-format'))
  }
  await saveApiKey(slot, rawKey)
}

/**
 * Baca API key dari slot (dekripsi runtime), null bila kosong.
 */
export async function getApiKey(slot: string): Promise<string | null> {
  return loadApiKey(slot)
}

/**
 * Rotasi key: tulis key baru ke slot yang sama, menimpa lama.
 *
 * AC4: berjalan penuh di runtime tanpa reload atau restart proses;
 * state terenkripsi lama ditimpa atomik lewat put() IDB, jadi bacaan
 * setelah rotasi selalu menghasilkan key baru.
 *
 * @throws ByoKeyError bila format key baru tidak valid.
 */
export async function rotateApiKey(slot: string, newKey: string): Promise<void> {
  await setApiKey(slot, newKey)
}

/**
 * Cabut key: hapus slot dari storage.
 */
export async function revokeApiKey(slot: string): Promise<void> {
  await removeApiKey(slot)
}
