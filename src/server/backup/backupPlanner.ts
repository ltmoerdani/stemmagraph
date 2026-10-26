/**
 * Pure helpers untuk penamaan file backup dan perencanaan retensi.
 * Tanpa I/O, tanpa import, mudah diuji.
 */

/**
 * Nama file backup deterministik dari sebuah Date.
 * Format: stemmagraph-backup-YYYYMMDDTHHMMSSZ.db (UTC, dua digit per komponen).
 */
export function backupFileNameFor(now: Date): string {
  const pad2 = (n: number): string => String(n).padStart(2, "0");
  const y = String(now.getUTCFullYear()).padStart(4, "0");
  const mo = pad2(now.getUTCMonth() + 1);
  const d = pad2(now.getUTCDate());
  const h = pad2(now.getUTCHours());
  const mi = pad2(now.getUTCMinutes());
  const s = pad2(now.getUTCSeconds());
  return `stemmagraph-backup-${y}${mo}${d}T${h}${mi}${s}Z.db`;
}

/**
 * Kembalikan daftar file yang harus dihapus agar tersisa `keep` file terbaru.
 * Nama backup memuat timestamp sehingga urut nama sama dengan urut waktu.
 * Tertua dulu di depan.
 */
export function planRetention(files: string[], keep: number): string[] {
  const safeKeep = Math.max(0, keep);
  if (files.length <= safeKeep) return [];
  const sorted = [...files].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const excess = sorted.length - safeKeep;
  return sorted.slice(0, excess);
}
