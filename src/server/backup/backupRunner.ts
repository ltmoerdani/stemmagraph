/**
 * Runner backup SQLite: salin database aktif ke file ber-stempel waktu
 * di folder backup, lalu terapkan retensi (hapus file tertua melewati
 * keep). Error ditangkap dan dilog, tidak pernah throw, agar kegagalan
 * backup tidak menjatuhkan proses server.
 */
import { mkdirSync, readdirSync, unlinkSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { backupFileNameFor, planRetention } from "./backupPlanner";

export interface RunBackupResult {
  ok: boolean;
  path?: string;
  error?: string;
  pruned?: string[];
}

/**
 * Sumber tunggal konfigurasi folder backup. Dipakai runner dan route
 * daftar backup supaya keduanya tidak mungkin memakai folder berbeda.
 */
export function resolveBackupDir(): string {
  return process.env.BACKUP_DIR ?? "data/backups";
}

/** Hapus satu per satu file hasil retensi; gagal individual dilog saja. */
function pruneFiles(toDelete: string[], backupDir: string): string[] {
  const pruned: string[] = [];
  for (const name of toDelete) {
    try {
      unlinkSync(path.join(backupDir, name));
      pruned.push(name);
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      console.error(`[backup] retensi gagal hapus ${name}: ${error}`);
    }
  }
  return pruned;
}

export async function runBackup(opts?: {
  dbPath?: string;
  backupDir?: string;
  keep?: number;
}): Promise<RunBackupResult> {
  try {
    const rawDb = opts?.dbPath ?? process.env.DATABASE_URL ?? "";
    const dbPath = rawDb.startsWith("file:") ? rawDb.slice("file:".length) : rawDb;
    if (!dbPath) {
      const error = "DATABASE_URL tidak tersedia";
      console.error(`[backup] ${error}`);
      return { ok: false, error };
    }
    const backupDir = opts?.backupDir ?? resolveBackupDir();
    mkdirSync(backupDir, { recursive: true });
    const destPath = path.join(backupDir, backupFileNameFor(new Date()));
    const db = new Database(dbPath);
    try {
      await db.backup(destPath);
    } finally {
      db.close();
    }
    const keep = opts?.keep ?? Number(process.env.BACKUP_KEEP ?? "14");
    const keepSafe = Number.isFinite(keep) && keep >= 0 ? keep : 14;
    const all = readdirSync(backupDir).filter((f) => f.endsWith(".db"));
    const toDelete = planRetention(all, keepSafe);
    const pruned = pruneFiles(toDelete, backupDir);
    return { ok: true, path: destPath, pruned };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error(`[backup] gagal: ${error}`);
    return { ok: false, error };
  }
}
