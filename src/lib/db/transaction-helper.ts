import Database from 'better-sqlite3';

/**
 * AC4 GOAL v419 fase 2: helper transaksi atomik better-sqlite3 untuk penulisan
 * multi-entitas (member + event + source). Pola resmi better-sqlite3:
 * db.transaction(fn) mengembalikan fungsi; memanggilnya menjalankan BEGIN,
 * COMMIT saat fn selesai, dan ROLLBACK otomatis saat fn melempar error.
 * Nested call di dalam transaksi lain otomatis menjadi SAVEPOINT.
 * Sinkron penuh: callback async dilarang (komit prematur).
 */
export function withAtomicTransaction<T>(
  db: Database.Database,
  fn: () => T
): T {
  const run = db.transaction(fn);
  return run();
}

/**
 * Varian immediate: kunci tulis sejak BEGIN IMMEDIATE sehingga deadlock
 * upgrade deferred tidak mungkin; dipakai untuk tulis multi-entitas.
 * Guard db.inTransaction saat catch mencegah rollback paksa ganda
 * (SQLITE_BUSY/SQLITE_FULL dihubungkan ke pesan error asli).
 */
export function withAtomicTransactionImmediate<T>(
  db: Database.Database,
  fn: () => T
): T {
  const run = db.transaction(fn).immediate();
  try {
    return run();
  } catch (e) {
    if (db.inTransaction) {
      try {
        db.exec('ROLLBACK');
      } catch (rollbackErr) {
        const original = e as Error;
        const rbMessage = (rollbackErr as Error).message;
        throw new Error(
          `${original.message} (rollback forced failed: ${rbMessage})`
        );
      }
    }
    throw e;
  }
}
