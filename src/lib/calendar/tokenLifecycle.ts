// Pure ICS feed token lifecycle math (v400 Rotasi Otomatis Token dengan
// Grace Period, Pilar 6 Privasi lanjutan v394/v396).
//
// Modul ini sengaja bebas I/O: tanpa database, tanpa HTTP, tanpa React.
// Ia menjawab tiga pertanyaan yang dipakai bersama oleh handler feed,
// route rotate/revoke, dan scheduler rotasi otomatis, supaya ketiga
// permukaan itu tidak mungkin berbeda interpretasi soal umur dan grace:
// (1) kapan umur sebuah token dihitung dimulai, (2) apakah token aktif
// sudah cukup tua untuk dirotasi otomatis, (3) apakah token prev masih
// dalam masa grace. Pola jam sama dengan src/lib/digest/window.ts:
// nilai tanggal rusak tidak diam-diam dianggap valid.

const DAY_MS = 86_400_000;

/** Lama URL lama (token prev) masih dijawab 200 setelah rotasi. */
export const ICS_TOKEN_GRACE_DAYS = 7;

/** Umur maksimum token aktif sebelum dirotasi otomatis oleh scheduler. */
export const ICS_TOKEN_MAX_AGE_DAYS = 90;

/** Umur token dihitung dari sini: rotatedAt, fallback createdAt. */
export interface TokenAgeInput {
  /** Momen rotasi terakhir; null pada token yang belum pernah dirotasi. */
  readonly rotatedAt: Date | string | null;
  /** Momen tree dibuat; kolom NOT NULL, jadi fallback yang selalu ada. */
  readonly createdAt: Date | string;
}

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

/**
 * Titik awal hitung umur token: rotatedAt bila valid, selain itu
 * createdAt. Nilai null atau rusak pada rotatedAt jatuh ke createdAt;
 * createdAt rusak melempar TypeError karena umur token dari jam yang
 * rusak berarti keputusan rotasi yang salah (fail closed, pola
 * weeklyWindow). Uji lewat test modul pure.
 */
export function tokenAgeStart(token: TokenAgeInput): Date {
  const rotated = token.rotatedAt === null ? null : toDate(token.rotatedAt);
  if (rotated !== null && !Number.isNaN(rotated.getTime())) return rotated;
  const created = toDate(token.createdAt);
  if (Number.isNaN(created.getTime())) {
    throw new TypeError('tokenAgeStart: createdAt must be a valid Date or ISO string');
  }
  return created;
}

/**
 * Guard rotasi otomatis scheduler: benar hanya bila umur token sejak
 * tokenAgeStart SUDAH LEWAT 90 hari penuh (age > max, tepat 90 hari
 * masih dipelihara). Satu pass idempoten: dipanggil berulang pada jam
 * yang sama menghasilkan keputusan yang sama.
 */
export function isTokenDueForRotation(token: TokenAgeInput, now: Date | string): boolean {
  const at = toDate(now);
  if (Number.isNaN(at.getTime())) {
    throw new TypeError('isTokenDueForRotation: now must be a valid Date or ISO string');
  }
  const start = tokenAgeStart(token);
  return at.getTime() - start.getTime() > ICS_TOKEN_MAX_AGE_DAYS * DAY_MS;
}

/**
 * Guard grace di handler feed: token prev hanya sah bila rotatedAt ada
 * dan usia sejak rotasi BELUM MELEWATI 7 hari (tepat 7 hari masih
 * sah, sesudahnya 404). rotatedAt null atau rusak gagal tertutup:
 * token prev tanpa cap waktu yang bisa dipercaya tidak pernah disetujui.
 */
export function isPrevTokenWithinGrace(
  rotatedAt: Date | string | null,
  now: Date | string,
): boolean {
  if (rotatedAt === null) return false;
  const rotated = toDate(rotatedAt);
  if (Number.isNaN(rotated.getTime())) return false;
  const at = toDate(now);
  if (Number.isNaN(at.getTime())) return false;
  return at.getTime() - rotated.getTime() <= ICS_TOKEN_GRACE_DAYS * DAY_MS;
}
