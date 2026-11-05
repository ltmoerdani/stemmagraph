/**
 * Masking API key untuk log (STG v420 Pilar 5, micro-2, AC1).
 *
 * Kontrak: API key pengguna TIDAK PERNAH muncul utuh di log, pesan
 * error, maupun exception. Semua jalur logging di modul BYO wajib
 * melewati maskApiKey sebelum menulis keluar.
 */

/**
 * Panjang minimum agar 4 karakter akhir boleh ditampilkan. Di bawah
 * ambang ini suffix bisa menebak sebagian besar key, jadi seluruh
 * karakter ditutup tanpa kecuali.
 */
const MIN_MASKED_LENGTH = 12;

/**
 * Sembunyikan API key untuk keperluan log.
 *
 * Key panjang tampil sebagai `****` diikuti 4 karakter terakhir
 * (mis. `****9f2a`), key pendek ditutup penuh menjadi `****`. Output
 * dijamin tidak mengandung prefix maupun bagian tengah key.
 *
 * @param key API key mentah, boleh string kosong atau non-string.
 * @returns representasi aman untuk log.
 */
export function maskApiKey(key: unknown): string {
  if (typeof key !== 'string' || key.length < MIN_MASKED_LENGTH) {
    return '****';
  }
  return `****${key.slice(-4)}`;
}

/**
 * Bangun pesan error generik untuk kegagalan terkait API key.
 *
 * Pesan yang dihasilkan tidak memuat key maupun mask dengan suffix
 * untuk jalur yang dianggap sensitif (validasi, dekripsi), sehingga
 * error yang menyebar ke konsol atau crash report tetap bebas leak.
 *
 * @param reason kode penyebab pendek, mis. 'invalid-format'.
 */
export function apiKeyError(reason: string): string {
  return `API key ditolak: ${reason}`;
}
