/**
 * Modul pure kebijakan staleness backup fase I (STG v127-i).
 * Backup hasil merge/purge tetap boleh disimpan selamaauapun asalkan
 * diletakkan di luar sistem produksi (ICO, backup beyond use; riset
 * notes/289, merujuk Recital 27 dan Art. 44 GDPR). Modul ini hanya
 * menilai secara murni: seberapa usang sebuah backup, apakah masih
 * di dalam batas retensi, dan berapa jaraknya sejak merge point.
 * Tanpa import eksternal, konsisten dengan modul consent lain.
 */

/**
 * Batas umur backup dianggap usang, dalam hari.
 * Merujuk catatan riset ICO backup beyond use di notes/289: backup yang
 * lebih tua dari 30 hari harus dianggap usang dan tidak layak dipulihkan
 * ke sistem produksi tanpa peninjauan ulang.
 */
export const BACKUP_STALENESS_THRESHOLD_DAYS = 30;

/**
 * Batas atas retensi backup, dalam hari. Setelah lewat umur ini backup
 * wajib dihapus dari lokasi arsip, bukan sekadar ditandai usang.
 * Nilainya 3x threshold staleness sebagai ruang peninjauan.
 */
export const BACKUP_RETENTION_CAP_DAYS = 90;

/** Input penilaian kebijakan backup. Semua timestamp berformat ISO 8601. */
export interface BackupPolicyInput {
  /** Timestamp backup terakhir. */
  lastBackupAt: string;
  /** Timestamp merge point pembatas versi data, optional. */
  mergePointAt?: string;
}

/** Hasil penilaian kebijakan backup untuk satu titik waktu. */
export interface BackupPolicyVerdict {
  /** true bila umur backup mencapai atau melewati threshold staleness. */
  isStale: boolean;
  /** Umur backup dalam hari penuh (dibulatkan ke bawah). */
  ageDays: number;
  /** true bila umur backup masih di dalam batas retensi. */
  withinRetention: boolean;
  /** Hari penuh sejak merge point, atau null bila merge point tidak ada. */
  deltaSinceMergePointDays: number | null;
}

const MS_PER_DAY = 86_400_000;

/**
 * Hitung umur backup dalam hari penuh relatif terhadap nowIso.
 * Input timestamp yang rusak tidak dilempar sebagai error; umur
 * dikembalikan sebagai Infinity sehingga penilai bersikap konservatif
 * (backup tanpa waktu yang jelas diperlakukan usang).
 */
export function backupStalenessDays(lastBackupAt: string, nowIso: string): number {
  const lastMs = Date.parse(lastBackupAt);
  const nowMs = Date.parse(nowIso);
  if (Number.isNaN(lastMs) || Number.isNaN(nowMs)) {
    return Number.POSITIVE_INFINITY;
  }
  return Math.floor((nowMs - lastMs) / MS_PER_DAY);
}

/**
 * Nilai umur mentah dalam milidetik, atau Infinity bila parse gagal.
 * Perhitungan boolean memakai nilai mentah agar batas tepat 30 hari
 * tidak tergeser oleh pembulatan.
 */
function rawAgeMs(timestamp: string, nowIso: string): number {
  const tsMs = Date.parse(timestamp);
  const nowMs = Date.parse(nowIso);
  if (Number.isNaN(tsMs) || Number.isNaN(nowMs)) {
    return Number.POSITIVE_INFINITY;
  }
  return nowMs - tsMs;
}

/**
 * Backup dianggap usang bila umurnya mencapai atau melewati 30 hari
 * (threshold, bukan di atasnya). Timestamp rusak juga dianggap usang.
 */
export function isBackupStale(lastBackupAt: string, nowIso: string): boolean {
  const ageMs = rawAgeMs(lastBackupAt, nowIso);
  if (!Number.isFinite(ageMs)) {
    return true;
  }
  return ageMs >= BACKUP_STALENESS_THRESHOLD_DAYS * MS_PER_DAY;
}

/**
 * Nilai satu kebijakan backup pada titik waktu nowIso. Fungsi murni:
 * hasil hanya bergantung pada input, tanpa IO dan tanpa jam sistem.
 * Merge point yang tidak diberikan atau rusak menghasilkan null pada
 * delta, bukan exception, supaya pemanggil fase II bisa memakai hasil
 * apa adanya.
 */
export function evaluateBackupPolicy(
  input: BackupPolicyInput,
  nowIso: string,
): BackupPolicyVerdict {
  const ageMs = rawAgeMs(input.lastBackupAt, nowIso);
  const finiteAge = Number.isFinite(ageMs);
  const isStale = !finiteAge || ageMs >= BACKUP_STALENESS_THRESHOLD_DAYS * MS_PER_DAY;
  const withinRetention = finiteAge && ageMs <= BACKUP_RETENTION_CAP_DAYS * MS_PER_DAY;

  let deltaSinceMergePointDays: number | null = null;
  if (typeof input.mergePointAt === 'string' && input.mergePointAt.length > 0) {
    const mergeMs = Date.parse(input.mergePointAt);
    const nowMs = Date.parse(nowIso);
    if (!Number.isNaN(mergeMs) && !Number.isNaN(nowMs)) {
      deltaSinceMergePointDays = Math.floor((nowMs - mergeMs) / MS_PER_DAY);
    }
  }

  return {
    isStale,
    ageDays: finiteAge ? Math.floor(ageMs / MS_PER_DAY) : Number.POSITIVE_INFINITY,
    withinRetention,
    deltaSinceMergePointDays,
  };
}
