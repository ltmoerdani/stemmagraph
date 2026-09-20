/**
 * Pemetaan RESN GEDCOM 7 ke privacyStatus Stemmagraph (v128-i).
 *
 * RESN pada GEDCOM 7 adalah enumset dengan TEPAT tiga nilai:
 *   CONFIDENTIAL, PRIVACY, LOCKED (lihat notes/269).
 *
 * privacyStatus Stemmagraph fase ini hanya dua nilai:
 *   'shared' | 'private' (schema baris 130; NULL berarti belum dicatat,
 *   dan gerbang ekspor memperlakukan NULL pada anggota hidup sebagai
 *   redact, lihat exportPrivacyGate.ts).
 *
 * Urutan evaluasi mengikuti pola webtrees (notes/269): RESN eksplisit
 * pada individu menang atas preferensi global.
 */

export type ResnLevel = 'CONFIDENTIAL' | 'PRIVACY' | 'LOCKED'

export const RESN_LEVELS: readonly ResnLevel[] = [
  'CONFIDENTIAL',
  'PRIVACY',
  'LOCKED',
]

/**
 * Konversi privacyStatus internal ke nilai RESN untuk output GEDCOM.
 *
 * - 'shared' mengembalikan null: consent eksplisit diberikan, sehingga
 *   nihil RESN ditulis ke output (tidak ada pembatasan yang perlu
 *   diumumkan ke penerima berkas).
 * - 'private' mengembalikan 'PRIVACY'.
 * - null/undefined mengembalikan 'PRIVACY' sebagai default aman,
 *   konsisten dengan gerbang ekspor yang meredaksi NULL living.
 * - Nilai tak dikenal apapun mengembalikan 'PRIVACY': data malformed
 *   tidak pernah melebarkan akses.
 */
export function privacyStatusToResn(
  status: string | null | undefined,
): ResnLevel | null {
  if (status === 'shared') return null
  return 'PRIVACY'
}

/**
 * Konversi nilai RESN dari berkas GEDCOM ke privacyStatus internal.
 *
 * - Nilai RESN valid apapun dari tiga nilai enumset mengembalikan
 *   'private'. Pencocokan case-sensitive sesuai spec; bentuk lowercase
 *   diterima secara toleran karena beberapa alat lama menulis demikian.
 * - null/undefined/empty mengembalikan null: status tidak diketahui,
 *   pemanggil menulis NULL ke DB.
 *
 * CATATAN ARAH PEMETAAN (intentional safe default):
 * Pemetaan dua arah ini SALAH ARAH untuk 'shared'. Round-trip
 * shared menghasilkan NULL, bukan kembali ke 'shared', karena tidak
 * ada cara merekonstruksi consent dari berkas tanpa RESN. Import balik
 * tanpa RESN jatuh ke NULL, dan NULL pada anggota hidup direduksi oleh
 * gerbang ekspor, sehingga tidak pernah bocor.
 *
 * LOCKED, CONFIDENTIAL, dan PRIVACY semuanya dipetakan ke 'private'
 * karena Stemmagraph fase ini hanya memiliki dua nilai privacyStatus.
 * Penyempurnaan granular menunggu iterasi consent berikutnya.
 */
export function resnToPrivacyStatus(
  resn: string | null | undefined,
): 'shared' | 'private' | null {
  if (resn == null) return null
  switch (resn.toUpperCase()) {
    case 'CONFIDENTIAL':
    case 'PRIVACY':
    case 'LOCKED':
      return 'private'
    default:
      return null
  }
}
