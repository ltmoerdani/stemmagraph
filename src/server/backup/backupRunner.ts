/**
 * Runner backup SQLite: salin database aktif ke file ber-stempel waktu
 * di folder backup. Error ditangkap dan dilog, tidak pernah throw,
 * agar kegagalan backup tidak menjatuhkan proses server.
 */
import { mkdirSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { backupFileNameFor } from "./backupPlanner";

export interface RunBackupResult {
  ok: boolean;
  path?: string;
  error?: string;
}

export async function runBackup(opts?: {
  dbPath?: string;
  backupDir?: string;
}): Promise<RunBackupResult> {
  try {
    const rawDb = opts?.dbPath ?? process.env.DATABASE_URL ?? "";
    const dbPath = rawDb.startsWith("file:") ? rawDb.slice("file:".length) : rawDb;
    if (!dbPath) {
      const error = "DATABASE_URL tidak tersedia";
      console.error(`[backup] ${error}`);
      return { ok: false, error };
    }
    const backupDir = opts?.backupDir ?? process.env.BACKUP_DIR ?? "data/backups";
    mkdirSync(backupDir, { recursive: true });
    const destPath = path.join(backupDir, backupFileNameFor(new Date()));
    const db = new Database(dbPath);
    try {
      await db.backup(destPath);
    } finally {
      db.close();
    }
    return { ok: true, path: destPath };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error(`[backup] gagal: ${error}`);
    return { ok: false, error };
  }
}
