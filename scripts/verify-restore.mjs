#!/usr/bin/env node
/**
 * Verifikasi restore v407 AC4: bukti file backup benar-benar dapat
 * dibuka dan berisi data identik. Membuat database sumber sementara
 * berisi satu tabel uji dua baris, menjalankan runBackup ke folder
 * sementara, lalu membuka file hasil dengan better-sqlite3 dan
 * membandingkan isi baris. Exit 0 bila identik, exit 1 bila gagal.
 *
 * Pakai: npx tsx scripts/verify-restore.mjs
 * Tanpa dependency baru: node:builtin + better-sqlite3 yang sudah ada.
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');

const SEED_ROWS = [
  { id: 1, nama: 'Adi Putra', tahun: 1945 },
  { id: 2, nama: 'Bondan Sakti', tahun: 1960 },
];

function fail(msg) {
  console.error(`[verify-restore] GAGAL: ${msg}`);
  process.exit(1);
}

async function main() {
  const work = mkdtempSync(path.join(tmpdir(), 'stg-verify-restore-'));
  const srcDb = path.join(work, 'sumber.db');
  const backupDir = path.join(work, 'backups');

  // 1. Database sumber berisi data uji
  const src = new Database(srcDb);
  src.exec('CREATE TABLE uji_restore (id INTEGER PRIMARY KEY, nama TEXT NOT NULL, tahun INTEGER NOT NULL)');
  const ins = src.prepare('INSERT INTO uji_restore (id, nama, tahun) VALUES (?, ?, ?)');
  for (const r of SEED_ROWS) ins.run(r.id, r.nama, r.tahun);
  src.close();

  // 2. Backup via runner produksi (kode nyata, bukan tiruan)
  const { runBackup } = await import('../src/server/backup/backupRunner.ts').catch(() => ({}));
  if (!runBackup) fail('runBackup tidak dapat diimpor (jalankan lewat tsx bila perlu)');
  const res = await runBackup({ dbPath: srcDb, backupDir, keep: 14 });
  if (!res.ok) fail(`runBackup gagal: ${res.error ?? 'tanpa pesan'}`);
  console.log(`[verify-restore] backup dibuat: ${res.path}`);

  // 3. Buka file hasil dan bandingkan isi
  const dst = new Database(res.path, { readonly: true });
  const rows = dst.prepare('SELECT id, nama, tahun FROM uji_restore ORDER BY id').all();
  dst.close();
  const same = rows.length === SEED_ROWS.length
    && rows.every((r, i) => r.id === SEED_ROWS[i].id && r.nama === SEED_ROWS[i].nama && r.tahun === SEED_ROWS[i].tahun);
  if (!same) fail(`isi berbeda: ${JSON.stringify(rows)}`);

  console.log(`[verify-restore] LULUS: ${rows.length} baris identik antara sumber dan backup`);
  rmSync(work, { recursive: true, force: true });
  process.exit(0);
}

main().catch((e) => fail(e?.message ?? String(e)));
