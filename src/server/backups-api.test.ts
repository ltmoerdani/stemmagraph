/**
 * Test v406 untuk route admin backup GET/POST /api/v1/backups.
 *
 * Pola persis src/server/calendar-ics-api.test.ts (v394): prisma di-mock
 * penuh lewat vi.hoisted, server express asli dilisten di port ephemeral
 * dasar 38600 lalu diakses via fetch native. Modul backupRunner juga
 * di-mock supaya trigger POST tidak menyentuh disk sungguhan, sedangkan
 * GET memakai folder BACKUP_DIR sementara berisi file .db palsu.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import jwt from 'jsonwebtoken';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const prismaMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  $transaction: vi.fn(),
}));

const runBackupMock = vi.hoisted(() => vi.fn());

vi.mock('../../server/db', () => ({ prisma: prismaMock }));
vi.mock('../../src/server/backup/backupRunner', () => ({ runBackup: runBackupMock }));

const JWT_SECRET = 'dev-only-insecure-secret-change-me';

const OWNER = { id: 'user-owner', role: 'owner', status: 'active' };
const MEMBER = { id: 'user-member', role: 'member', status: 'active' };

function authHeader(userId: string): string {
  return `Bearer ${jwt.sign({ sub: userId }, JWT_SECRET)}`;
}

function mockAkun(id: string, akun: { id: string; role: string; status: string }): void {
  prismaMock.user.findUnique.mockImplementation(async (args: { where: { id: string } }) => {
    if (args.where.id === id) return akun;
    return null;
  });
}

let BASE = '';
let backupDirUji = '';
let serverHandle: import('node:http').Server | undefined;

beforeEach(() => {
  vi.clearAllMocks();
});

beforeAll(async () => {
  backupDirUji = fs.mkdtempSync(path.join(os.tmpdir(), 'stg-backup-uji-'));
  fs.writeFileSync(path.join(backupDirUji, 'stemmagraph-backup-20260101T000000Z.db'), 'x');
  fs.writeFileSync(path.join(backupDirUji, 'stemmagraph-backup-20260102T000000Z.db'), 'yy');
  fs.writeFileSync(path.join(backupDirUji, 'ignore-me.txt'), 'bukan db');
  process.env['BACKUP_DIR'] = backupDirUji;

  const port = 38600 + (process.pid % 600);
  BASE = `http://127.0.0.1:${port}`;
  process.env['API_PORT'] = String(port);
  const proto = (express as unknown as { application: { listen: (...a: unknown[]) => import('node:http').Server } }).application;
  const origListen = proto.listen;
  proto.listen = function (this: unknown, ...a: unknown[]) {
    serverHandle = origListen.apply(this, a);
    return serverHandle;
  } as typeof proto.listen;
  await import('../../server/index');
  const deadline = Date.now() + 8000;
  for (;;) {
    try {
      await fetch(`${BASE}/`);
      break;
    } catch {
      if (Date.now() > deadline) throw new Error('server test tidak siap dalam 8 detik');
      await new Promise((r) => setTimeout(r, 100));
    }
  }
}, 30000);

afterAll(async () => {
  await new Promise<void>((resolve) => {
    if (!serverHandle) return resolve();
    serverHandle.close(() => resolve());
  });
  fs.rmSync(backupDirUji, { recursive: true, force: true });
});

describe('GET /api/v1/backups', () => {
  it('tanpa token: 401 UNAUTHORIZED', async () => {
    const res = await fetch(`${BASE}/api/v1/backups`);
    expect(res.status).toBe(401);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe('UNAUTHORIZED');
  });

  it('token member: 403 OWNER_REQUIRED', async () => {
    mockAkun('user-member', MEMBER);
    const res = await fetch(`${BASE}/api/v1/backups`, { headers: { Authorization: authHeader('user-member') } });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe('OWNER_REQUIRED');
  });

  it('token owner: 200 daftar backup hanya file .db, terbaru dulu', async () => {
    mockAkun('user-owner', OWNER);
    const res = await fetch(`${BASE}/api/v1/backups`, { headers: { Authorization: authHeader('user-owner') } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { backups: { name: string; sizeBytes: number; createdAt: string }[] };
    expect(body.backups.map((b) => b.name)).toEqual([
      'stemmagraph-backup-20260102T000000Z.db',
      'stemmagraph-backup-20260101T000000Z.db',
    ]);
    expect(body.backups[0].sizeBytes).toBe(2);
    expect(typeof body.backups[0].createdAt).toBe('string');
  });
});

describe('POST /api/v1/backups', () => {
  it('token owner: trigger backup sukses, hasil runner dikembalikan', async () => {
    mockAkun('user-owner', OWNER);
    runBackupMock.mockResolvedValue({ ok: true, path: `${backupDirUji}/stemmagraph-backup-20260103T000000Z.db` });
    const res = await fetch(`${BASE}/api/v1/backups`, { method: 'POST', headers: { Authorization: authHeader('user-owner') } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; path?: string };
    expect(body.ok).toBe(true);
    expect(body.path).toContain('stemmagraph-backup-');
    expect(runBackupMock).toHaveBeenCalledTimes(1);
  });
});
