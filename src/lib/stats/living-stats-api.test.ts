/**
 * Test dedikasi route living stats v268 fase ii (GET /api/v1/trees/:treeId/stats/living).
 *
 * Pola mock prisma preseden src/server/consent: prisma di-mock penuh lewat
 * vi.hoisted supaya server/index.ts bisa diimpor tanpa DATABASE_URL dan
 * tanpa generated prisma client. Server express asli dilisten di port
 * ephemeral (API_PORT) lalu diakses via fetch native, tanpa dependency baru.
 *
 * AC kontrak v268: 401 tanpa auth, 403 tanpa role, 404 tree nihil,
 * 200 payload agregat penuh, tree kosong, birthDate tak terparse masuk
 * unknownBirthDate, TANPA field individu di body, label id default dan en.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import express from 'express';
import jwt from 'jsonwebtoken';

const prismaMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  familyTree: { findUnique: vi.fn() },
  treeMember: { findUnique: vi.fn() },
  familyMember: { findMany: vi.fn() },
}));

vi.mock('../../../server/db', () => ({ prisma: prismaMock }));

const JWT_SECRET = 'dev-only-insecure-secret-change-me';

function authHeader(userId: string): string {
  return `Bearer ${jwt.sign({ sub: userId }, JWT_SECRET)}`;
}

const USER = { id: 'user-1', email: 'u@example.test', status: 'active', role: 'owner' };
const TREE = { id: 'tree-1' };

const MEMBERS = [
  { birthDate: '1990-05-10', deathDate: null, isAlive: true, generation: 1 },
  { birthDate: '2020-03-01', deathDate: null, isAlive: true, generation: 1 },
  { birthDate: 'tanggal rusak', deathDate: null, isAlive: true, generation: 3 },
  { birthDate: '1950-01-15', deathDate: '2020-01-15', isAlive: false, generation: 2 },
  { birthDate: '1960-06-01', deathDate: '2023-06-01', isAlive: false, generation: 1 },
];

const PAYLOAD_KEYS = [
  'total',
  'living',
  'deceased',
  'unknownBirthDate',
  'generations',
  'avgLifespanYears',
  'ageBuckets',
  'avgLifespanLabel',
];

const PATH = '/api/v1/trees/tree-1/stats/living';

let BASE = '';
let serverHandle: import('node:http').Server | undefined;

beforeAll(async () => {
  const port = 39200 + (process.pid % 600);
  BASE = `http://127.0.0.1:${port}`;
  process.env['API_PORT'] = String(port);
  // Tangkap instance http.Server hasil app.listen agar bisa ditutup di afterAll.
  const proto = (express as unknown as { application: { listen: (...a: unknown[]) => import('node:http').Server } }).application;
  const origListen = proto.listen;
  proto.listen = function (this: unknown, ...args: unknown[]) {
    serverHandle = origListen.apply(this, args);
    return serverHandle;
  } as typeof proto.listen;
  await import('../../../server/index');
  // Tunggu server siap menerima koneksi (maks 5 detik).
  const deadline = Date.now() + 5000;
  for (;;) {
    try {
      await fetch(`${BASE}/`);
      break;
    } catch {
      if (Date.now() > deadline) throw new Error('server test tidak siap dalam 5 detik');
      await new Promise((r) => setTimeout(r, 100));
    }
  }
});

afterAll(async () => {
  await new Promise<void>((resolve) => {
    if (!serverHandle) return resolve();
    serverHandle.close(() => resolve());
  });
});

async function get(path: string, headers: Record<string, string> = {}): Promise<{ status: number; body: Record<string, unknown> }> {
  const res = await fetch(`${BASE}${path}`, { headers });
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

describe('v268 living stats endpoint', () => {
  it('401 tanpa Authorization header', async () => {
    prismaMock.user.findUnique.mockResolvedValue(USER);
    prismaMock.familyTree.findUnique.mockResolvedValue(TREE);
    const { status } = await get(PATH);
    expect(status).toBe(401);
  });

  it('401 dengan token invalid', async () => {
    const { status } = await get(PATH, { authorization: 'Bearer bukan-jwt' });
    expect(status).toBe(401);
  });

  it('403 untuk user tanpa role di tree', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ ...USER, role: 'member' });
    prismaMock.familyTree.findUnique.mockResolvedValue(TREE);
    prismaMock.treeMember.findUnique.mockResolvedValue(null);
    const { status, body } = await get(PATH, { authorization: authHeader('user-1') });
    expect(status).toBe(403);
    expect(body['code']).toBe('FORBIDDEN_TREE');
  });

  it('404 ketika tree tidak ada', async () => {
    prismaMock.user.findUnique.mockResolvedValue(USER);
    prismaMock.familyTree.findUnique.mockResolvedValue(null);
    const { status, body } = await get(PATH, { authorization: authHeader('user-1') });
    expect(status).toBe(404);
    expect(body['code']).toBe('NOT_FOUND');
  });

  it('200 payload agregat penuh sesuai computeLivingStats', async () => {
    prismaMock.user.findUnique.mockResolvedValue(USER);
    prismaMock.familyTree.findUnique.mockResolvedValue(TREE);
    prismaMock.treeMember.findUnique.mockResolvedValue(null);
    prismaMock.familyMember.findMany.mockResolvedValue(MEMBERS);
    const { status, body } = await get(PATH, { authorization: authHeader('user-1') });
    expect(status).toBe(200);
    expect(body['total']).toBe(5);
    expect(body['living']).toBe(3);
    expect(body['deceased']).toBe(2);
    expect(body['unknownBirthDate']).toBe(1);
    expect(body['generations']).toEqual({ min: 1, max: 3 });
    expect(body['avgLifespanYears']).toBe(66.5);
    expect(body['ageBuckets']).toEqual({
      '0-17': 1,
      '18-30': 0,
      '31-45': 1,
      '46-60': 0,
      '61-75': 0,
      '76+': 0,
    });
  });

  it('tree kosong menghasilkan nol angka dan avgLifespanYears null', async () => {
    prismaMock.user.findUnique.mockResolvedValue(USER);
    prismaMock.familyTree.findUnique.mockResolvedValue(TREE);
    prismaMock.treeMember.findUnique.mockResolvedValue(null);
    prismaMock.familyMember.findMany.mockResolvedValue([]);
    const { status, body } = await get(PATH, { authorization: authHeader('user-1') });
    expect(status).toBe(200);
    expect(body['total']).toBe(0);
    expect(body['living']).toBe(0);
    expect(body['deceased']).toBe(0);
    expect(body['unknownBirthDate']).toBe(0);
    expect(body['generations']).toEqual({ min: 0, max: 0 });
    expect(body['avgLifespanYears']).toBeNull();
  });

  it('birthDate tak terparse masuk unknownBirthDate tanpa masuk bucket', async () => {
    prismaMock.user.findUnique.mockResolvedValue(USER);
    prismaMock.familyTree.findUnique.mockResolvedValue(TREE);
    prismaMock.treeMember.findUnique.mockResolvedValue(null);
    prismaMock.familyMember.findMany.mockResolvedValue([
      { birthDate: '31/12/2000', deathDate: null, isAlive: true, generation: 1 },
    ]);
    const { body } = await get(PATH, { authorization: authHeader('user-1') });
    expect(body['unknownBirthDate']).toBe(1);
    expect(body['total']).toBe(1);
    expect(body['ageBuckets']).toEqual({
      '0-17': 0,
      '18-30': 0,
      '31-45': 0,
      '46-60': 0,
      '61-75': 0,
      '76+': 0,
    });
  });

  it('response body TIDAK berisi field individu apa pun (gap 3)', async () => {
    prismaMock.user.findUnique.mockResolvedValue(USER);
    prismaMock.familyTree.findUnique.mockResolvedValue(TREE);
    prismaMock.treeMember.findUnique.mockResolvedValue(null);
    prismaMock.familyMember.findMany.mockResolvedValue(MEMBERS);
    const { body } = await get(PATH, { authorization: authHeader('user-1') });
    expect(Object.keys(body).sort()).toEqual([...PAYLOAD_KEYS].sort());
    expect(Object.keys(body)).not.toContain('members');
    expect(Object.keys(body)).not.toContain('id');
    expect(Object.keys(body)).not.toContain('name');
  });

  it('lang=en mengganti label avgLifespanLabel, default id', async () => {
    prismaMock.user.findUnique.mockResolvedValue(USER);
    prismaMock.familyTree.findUnique.mockResolvedValue(TREE);
    prismaMock.treeMember.findUnique.mockResolvedValue(null);
    prismaMock.familyMember.findMany.mockResolvedValue([]);
    const idRes = await get(PATH, { authorization: authHeader('user-1') });
    expect(idRes.body['avgLifespanLabel']).toBe('Rata-rata umur saat meninggal');
    const enRes = await get(`${PATH}?lang=en`, { authorization: authHeader('user-1') });
    expect(enRes.body['avgLifespanLabel']).toBe('Average age at death');
  });
});
