import path from 'node:path';
import fs from 'node:fs';
import Database from 'better-sqlite3';
import { register } from 'tsx/esm/api';

// Wajib import dari sumber tunggal, dilarang duplikasi logika path.
const unregister = register();
const { buildBackupPath } = await import('../src/lib/server/backup-plan.ts');

const raw = process.env.DATABASE_URL ?? 'file:./prisma/dev.db';
const dbFile = raw.startsWith('file:') ? raw.slice('file:'.length) : raw;

const target = buildBackupPath(path.dirname(dbFile), new Date());
fs.mkdirSync(path.dirname(target), { recursive: true });

const db = new Database(dbFile);
try {
	await db.backup(target);
} finally {
	db.close();
}

console.log(target);
unregister();
process.exit(0);
