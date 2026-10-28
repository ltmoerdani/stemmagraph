// Helper pure untuk undo GEDCOM v418 (AC3 snapshot + AC4 token).
//
// Tidak melakukan I/O: pembentukan path snapshot, normalisasi URL
// database SQLite, dan bentuk error kontrak untuk route undo.
// Konsumen: server/index.ts (route gedcom/apply dan gedcom/undo).

import { randomBytes } from 'node:crypto';

/**
 * Path file snapshot untuk satu apply: <dir>/<treeId>-<timestamp>-<4 hex>.db
 * Akhiran acak mencegah tabrakan bila dua apply terjadi pada milidetik sama.
 */
export function buildSnapshotPath(dir: string, treeId: string, nowMs: number): string {
  const randomHex = randomBytes(2).toString('hex');
  return `${dir}/${treeId}-${nowMs}-${randomHex}.db`;
}

/**
 * Ubah DATABASE_URL prisma (mis. `file:./prisma/dev.db`) menjadi path
 * filesystem yang diterima better-sqlite3. URL tanpa prefix dikembalikan
 * apa adanya.
 */
export function parseDatabaseUrl(databaseUrl: string): string {
  return databaseUrl.startsWith('file:') ? databaseUrl.slice('file:'.length) : databaseUrl;
}

/** Error kontrak: registry undo sudah lewat TTL (HTTP 410). */
export function undoExpiredError(): { code: 'UNDO_EXPIRED' } {
  return { code: 'UNDO_EXPIRED' };
}

/** Error kontrak: registry undo sudah terpakai / tidak ada lagi (UNDO_GONE). */
export function undoConsumedError(): { code: 'UNDO_GONE' } {
  return { code: 'UNDO_GONE' };
}
