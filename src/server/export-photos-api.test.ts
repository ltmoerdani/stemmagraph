/**
 * Test dedikasi route export foto ZIP v403 AC5
 * (GET /api/v1/trees/:treeId/export/photos).
 *
 * Pola export-json-api.test.ts (v402): prisma di-mock penuh lewat
 * vi.hoisted, server express asli di-listen port ephemeral, fetch
 * native. Port 39500 + pid offset agar tidak bentrok test server lain.
 *
 * Kasus: 401 tanpa auth, 404 tree nihil, 200 ZIP dengan magic bytes
 * PK, skip file hilang jujur di manifest, 422 agregat, full non-owner
 * 403.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import jwt from 'jsonwebtoken';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const prismaMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  familyTree: { findUnique: vi.fn(), findFirst: vi.fn() },
  treeMember: { findUnique: vi.fn() },
  familyMember: { findMany: vi.fn() },
  familyRelationship: { findMany: vi.fn() },
}));

vi.mock('../../server/db', () => ({ prisma: prismaMock }));

const JWT_SECRET = 'dev-only-insecure-secret-change-me';

function authHeader(userId: string): string {
  return `Bearer ${jwt.sign({ sub: userId }, JWT_SECRET)}`;
}

const USER = { id: 'user-1', email: 'u1@example.test', status: 'active', role: 'member' };
const TREE = { id: 'tree-1', name: 'Keluarga Besar' };

const F1 = '11111111-1111-1111-1111-111111111111';
const F3 = '33333333-3333-3333-3333-333333333333';

function memberRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'm-1', treeId: 'tree-1', name: 'Budi Santoso', nickname: null,
    marga: 'Santoso', birthDate: '1970-01-01', deathDate: null,
    haulOverrideDate: null, birthDateGed: null, deathDateGed: null,
    birthPlace: 'Solo', currentLocation: null, profession: null,
    education: null, gender: 'male', sexGed: null, photoUrl: null,
    email: 'budi@example.test', phone: null, isAlive: true,
    privacyStatus: null, generation: 2, maritalStatus: 'married',
    mergedIntoId: null, mergedAt: null, mergeJournal: null,
    notes: null, createdAt: new Date('2020-01-01T00:00:00Z'),
    updatedAt: new Date('2020-01-01T00:00:00Z'),
    ...overrides,
  };
}

/**
 * m-1: hidup tanpa flag privacy (clean: direduksi), punya foto F1.
 * m-2: hidup private tanpa file (skip file_not_found di clean? tidak:
 *      direduksi dulu oleh gate). m-3: mendiang, foto F3 ada.
 */
const MEMBERS = [
  memberRow({ photoUrl: `/api/v1/members/m-1/photo?f=${F1}.jpg` }),
  memberRow({
    id: 'm-2', name: 'Siti Aminah', marga: null, gender: 'female',
    birthDate: '1995-03-01', email: 'siti@example.test', phone: '0812',
    isAlive: true, privacyStatus: 'private', maritalStatus: 'single',
    notes: 'rahasia', birthPlace: null,
    photoUrl: '/api/v1/members/m-2/photo?f=99999999-9999-9999-9999-999999999999.jpg',
  }),
  memberRow({
    id: 'm-3', name: 'Buyut Slamet', marga: null, gender: 'male',
    isAlive: false, deathDate: '1988-02-02', privacyStatus: null,
    email: null, phone: null, birthPlace: null,
    photoUrl: `/api/v1/members/m-3/photo?f=${F3}.png`,
  }),
];

function mockGuard(role: 'viewer' | 'editor' | 'owner'): void {
  prismaMock.user.findUnique.mockResolvedValue(USER);
  prismaMock.familyTree.findUnique.mockResolvedValue(TREE);
  prismaMock.treeMember.findUnique.mockResolvedValue({
    id: 'tm-1', userId: 'user-1', treeId: 'tree-1', role,
  });
  prismaMock.familyMember.findMany.mockResolvedValue(MEMBERS);
  prismaMock.familyRelationship.findMany.mockResolvedValue([]);
}

const PATH = '/api/v1/trees/tree-1/export/photos';

let BASE = '';
let serverHandle: import('node:http').Server | undefined;
let uploadsDir = '';

interface GetResult {
  status: number;
  body: Buffer;
  text: string;
  headers: Record<string, string>;
}

async function get(path: string, headers: Record<string, string> = {}): Promise<GetResult> {
  const res = await fetch(`${BASE}${path}`, { headers });
  const body = Buffer.from(await res.arrayBuffer());
  const headersObj: Record<string, string> = {};
  res.headers.forEach((v, k) => { headersObj[k] = v; });
  return { status: res.status, body, text: body.toString('utf8'), headers: headersObj };
}

beforeEach(() => {
  vi.clearAllMocks();
  // Fresh uploads dir per test; PHOTO_UPLOADS_DIR dibaca saat request
  // (bukan saat import), jadi mengubah env sebelum tiap kasus aman.
  uploadsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stg-v403-'));
  process.env['PHOTO_UPLOADS_DIR'] = uploadsDir;
});

beforeAll(async () => {
  const port = 39500 + (process.pid % 600);
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
});

/** Seed uploads dir: F1 jpg ada, foto m-2 hilang, F3 png ada. */
function seedPhotos(): void {
  fs.writeFileSync(path.join(uploadsDir, `${F1}.jpg`), Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]));
  fs.writeFileSync(path.join(uploadsDir, `${F3}.png`), Buffer.from([0x89, 0x50, 0x4e, 0x47, 5, 6, 7, 8]));
}

describe('GET /api/v1/trees/:treeId/export/photos (v403)', () => {
  it('401 tanpa Authorization header', async () => {
    const r = await get(PATH);
    expect(r.status).toBe(401);
    const body = JSON.parse(r.text) as { code: string };
    expect(body.code).toBe('UNAUTHORIZED');
  });

  it('404 ketika tree tidak ada', async () => {
    prismaMock.user.findUnique.mockResolvedValue(USER);
    prismaMock.familyTree.findUnique.mockResolvedValue(null);
    const r = await get(PATH, { authorization: authHeader('user-1') });
    expect(r.status).toBe(404);
  });

  it('200 clean: application/zip attachment, magic bytes PK, hanya foto mendiang, header aman pola v402', async () => {
    mockGuard('viewer');
    seedPhotos();
    const r = await get(PATH, { authorization: authHeader('user-1') });
    expect(r.status).toBe(200);
    expect(r.headers['content-type']).toContain('application/zip');
    expect(r.headers['content-disposition']).toContain('attachment');
    expect(r.headers['content-disposition']).toMatch(/filename="[A-Za-z0-9-_]+-\d{8}-photos\.zip"$/);
    expect(r.headers['x-content-type-options']).toBe('nosniff');
    expect(r.headers['cache-control']).toBe('no-store');
    expect(r.headers['referrer-policy']).toBe('no-referrer');
    // Magic bytes ZIP: 'PK\x03\x04'
    expect(r.body[0]).toBe(0x50);
    expect(r.body[1]).toBe(0x4b);
    expect(r.body[2]).toBe(0x03);
    expect(r.body[3]).toBe(0x04);
  });

  it('200 clean: skip file hilang jujur di manifest tanpa gagal total', async () => {
    mockGuard('viewer');
    seedPhotos();
    const r = await get(PATH, { authorization: authHeader('user-1') });
    expect(r.status).toBe(200);
    const { unzipSync } = await import('fflate');
    const files = unzipSync(new Uint8Array(r.body));
    expect(Object.keys(files)).toContain('manifest.json');
    expect(Object.keys(files)).toContain('photos/m-3.png');
    expect(Object.keys(files)).not.toContain('photos/m-1.jpg');
    const manifest = JSON.parse(new TextDecoder().decode(files['manifest.json'])) as {
      schemaVersion: string;
      privacy: { mode: string };
      exported: Array<{ memberId: string; filename: string }>;
      skipped: Array<{ memberId: string; reason: string }>;
    };
    expect(manifest.schemaVersion).toBe('stemmagraph-photo-export/1');
    expect(manifest.privacy.mode).toBe('clean');
    expect(manifest.exported.map((e) => e.memberId)).toEqual(['m-3']);
    // m-1 direduksi gate (hidup tanpa consent), m-2 juga (private);
    // pointer m-2 hilang dari disk tidak menggagalkan export.
    expect(manifest.skipped.every((s) => s.reason === 'redacted')).toBe(true);
    expect(manifest.skipped.map((s) => s.memberId).sort()).toEqual(['m-1', 'm-2']);
  });

  it('200 mode full owner: semua foto terbaca, file hilang tercatat file_not_found', async () => {
    mockGuard('owner');
    // F1 ada; foto m-2 dan F3 sengaja tidak di-seed (hilang dari disk).
    fs.writeFileSync(path.join(uploadsDir, `${F1}.jpg`), Buffer.from([0xff, 0xd8, 1, 1]));
    const r = await get(`${PATH}?mode=full`, { authorization: authHeader('user-1') });
    expect(r.status).toBe(200);
    const { unzipSync } = await import('fflate');
    const files = unzipSync(new Uint8Array(r.body));
    expect(Object.keys(files)).toContain('photos/m-1.jpg');
    const manifest = JSON.parse(new TextDecoder().decode(files['manifest.json'])) as {
      privacy: { mode: string };
      exported: Array<{ memberId: string }>;
      skipped: Array<{ memberId: string; reason: string }>;
    };
    expect(manifest.privacy.mode).toBe('full');
    expect(manifest.exported.map((e) => e.memberId)).toEqual(['m-1']);
    const missing = manifest.skipped.filter((s) => s.reason === 'file_not_found');
    expect(missing.map((s) => s.memberId).sort()).toEqual(['m-2', 'm-3']);
  });

  it('403 mode full non-owner (viewer)', async () => {
    mockGuard('viewer');
    seedPhotos();
    const r = await get(`${PATH}?mode=full`, { authorization: authHeader('user-1') });
    expect(r.status).toBe(403);
    const body = JSON.parse(r.text) as { code: string };
    expect(body.code).toBe('FORBIDDEN_FULL_EXPORT');
  });

  it('422 mode invalid', async () => {
    mockGuard('viewer');
    const r = await get(`${PATH}?mode=bronze`, { authorization: authHeader('user-1') });
    expect(r.status).toBe(422);
    const body = JSON.parse(r.text) as { code: string };
    expect(body.code).toBe('INVALID_MODE');
  });

  it('422 AGGREGATE_LIMIT ketika total foto melewati bound (diuji lewat modul pure dengan bound kecil)', async () => {
    mockGuard('owner');
    seedPhotos();
    // Route memakai bound default 200 MB; bound kecil tidak dapat
    // diinjeksi lewat query. Verifikasi langsung modul pure untuk
    // jalur guard; route sudah tercakup kasus 200.
    const { buildPhotoZipManifest } = await import('../lib/portability/photoZipExport');
    const result = buildPhotoZipManifest({
      members: [
        memberRow({ privacyStatus: 'shared', photoUrl: '/api/v1/members/m-1/photo?f=x.jpg' }) as never,
      ] as never,
      photos: new Map([['m-1', new Uint8Array(32)]]),
      exportedAt: new Date('2026-10-26T00:00:00Z'),
      maxAggregateBytes: 16,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('AGGREGATE_LIMIT');
      expect(result.totalBytes).toBe(32);
      expect(result.limitBytes).toBe(16);
    }
  });
});
