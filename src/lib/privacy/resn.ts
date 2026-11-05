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
): 'PRIVACY' | null {
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
): 'private' | null {
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

/**
 * Komposit resolver RESN multi nilai (GOAL v423 AC1).
 *
 * Input kumpulan nilai RESN hasil List of Enum GEDCOM 7, dipisah koma
 * atau spasi, sudah diurai memakai parseResnList (resn-list.ts v130).
 * Output komposit paling membatasi dengan merge OR per axis:
 *   hidden: true bila ada CONFIDENTIAL atau lebih ketat (LOCKED);
 *   locked: true bila ada LOCKED.
 * Kontrak evidence Gramps:
 *   LOCKED OR PRIVACY      = LOCKED (axis locked naik, hidden ikut
 *     karena LOCKED sendiri sudah hidden)
 *   kosong OR PRIVACY      = PRIVACY (hidden false, locked false)
 *   LOCKED OR CONFIDENTIAL = LOCKED untuk axis mutasi, sementara
 *     CONFIDENTIAL tetap hidden untuk axis baca: dua axis independen,
 *     merge OR menghasilkan { hidden: true, locked: true }.
 *
 * Pure: tanpa I/O, tanpa dependensi, tidak pernah memutasi input.
 * Item string kosong di daftar ditolak dengan error jelas; duplikat
 * dedupe idempoten; PRIVACY tidak menambah logika di luar gerbang
 * existing (ikon kebijakan).
 */
export interface ResnComposite {
  hidden: boolean
  locked: boolean
}

export function resolveResnComposite(levels: ResnLevel[]): ResnComposite {
  const seen = new Set<ResnLevel>()
  for (const level of levels) {
    if (level == null || (typeof level === 'string' && level.trim() === '')) {
      throw new Error(
        'RESN item kosong ditolak: setiap item harus berupa nilai enumset CONFIDENTIAL, PRIVACY, atau LOCKED',
      )
    }
    seen.add(level)
  }
  return {
    hidden: seen.has('CONFIDENTIAL') || seen.has('LOCKED'),
    locked: seen.has('LOCKED'),
  }
}
