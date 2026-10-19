/**
 * Test dedikasi route children-per-family v306 fase ii
 * (GET /api/v1/trees/:treeId/stats/children-per-family).
 *
 * Pola preseden src/lib/stats/living-stats-api.test.ts: prisma di-mock
 * penuh lewat vi.hoisted supaya server/index.ts bisa diimpor tanpa
 * DATABASE_URL dan tanpa generated prisma client. Server express asli
 * dilisten di port ephemeral (API_PORT) lalu diakses via fetch native,
 * tanpa dependency baru.
 *
 * AC kontrak v306: 401 tanpa auth, 403 non-anggota, 404 tree nihil,
 * 200 payload distribusi penuh (bucket children asc, average 1 desimal),
 * tree tanpa relasi anak (family key B spouse childIds kosong), tree
 * kosong, dedup relasi dobel, 304 via If-None-Match dengan Cache-Control
 * terbawa, 500 CHILDREN_PER_FAMILY_ERROR, tanpa field PII di body.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import express from 'express';
import jwt from 'jsonwebtoken';

const prismaMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  familyTree: { findUnique: vi.fn() },
  treeMember: { findUnique: vi.fn() },
  familyMember: { findMany: vi.fn() },
  familyRelationship: { findMany: vi.fn() },
}));

vi.mock('../../../server/db', () => ({ prisma: prismaMock }));

const JWT_SECRET = 'dev-only-insecure-secret-change-me';

function authHeader(userId: string): string {
  return `Bearer ${jwt.sign({ sub: userId }, JWT_SECRET)}`;
}

const USER = { id: 'user-1', email: 'u@example.test', status: 'active', role: 'owner' };
const TREE = { id: 'tree-1' };

const PATH = '/api/v1/trees/tree-1/stats/children-per-family';
const PAYLOAD_KEYS = ['distribution', 'familyCount', 'average'];

let BASE = '';
let serverHandle: import('node:http').Server | undefined;

beforeAll(async () => {
  const port = 39900 + (process.pid % 600);
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

async function get(path: string, headers: Record<string, string> = {}): Promise<{ status: number; body: Record<string, unknown>; headers: Headers }> {
  const res = await fetch(`${BASE}${path}`, { headers });
  return { status: res.status, body: (await res.json()) as Record<string, unknown>, headers: res.headers };
}

function mockAuthLolos(): void {
  prismaMock.user.findUnique.mockResolvedValue(USER);
  prismaMock.familyTree.findUnique.mockResolvedValue(TREE);
  prismaMock.treeMember.findUnique.mockResolvedValue(null);
}

// Keluarga A (p1+p2): c1,c2,c3; keluarga B (p3+p4): c4,c5; keluarga C
// (p5 tunggal): c6,c7. Total 7 anak di 3 keluarga, average 7/3 dibulatkan
// 2.3; bucket children asc: dua keluarga 2 anak, satu keluarga 3 anak.
const RELS_MULTI = [
  { memberId: 'c1', relatedId: 'p1', type: 'child' },
  { memberId: 'c1', relatedId: 'p2', type: 'child' },
  { memberId: 'c2', relatedId: 'p1', type: 'child' },
  { memberId: 'c2', relatedId: 'p2', type: 'child' },
  { memberId: 'c3', relatedId: 'p1', type: 'child' },
  { memberId: 'c3', relatedId: 'p2', type: 'child' },
  { memberId: 'c4', relatedId: 'p3', type: 'child' },
  { memberId: 'c4', relatedId: 'p4', type: 'child' },
  { memberId: 'c5', relatedId: 'p3', type: 'child' },
  { memberId: 'c5', relatedId: 'p4', type: 'child' },
  { memberId: 'c6', relatedId: 'p5', type: 'child' },
  { memberId: 'c7', relatedId: 'p5', type: 'child' },
];

describe('v306 children-per-family endpoint', () => {
  it('401 tanpa Authorization header', async () => {
    mockAuthLolos();
    const { status } = await get(PATH);
    expect(status).toBe(401);
  });

  it('403 untuk user non-anggota tree', async () => {
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

  it('200 payload penuh: bucket children asc, familyCount per bucket, average 1 desimal', async () => {
    mockAuthLolos();
    prismaMock.familyRelationship.findMany.mockResolvedValue(RELS_MULTI);
    const { status, body } = await get(PATH, { authorization: authHeader('user-1') });
    expect(status).toBe(200);
    expect(body['distribution']).toEqual([
      { children: 2, familyCount: 2 },
      { children: 3, familyCount: 1 },
    ]);
    expect(body['familyCount']).toBe(3);
    expect(body['average']).toBe(2.3);
  });

  it('tree tanpa relasi anak: spouse family key B childIds kosong, average 0', async () => {
    mockAuthLolos();
    prismaMock.familyRelationship.findMany.mockResolvedValue([
      { memberId: 's1', relatedId: 's2', type: 'spouse' },
    ]);
    const { status, body } = await get(PATH, { authorization: authHeader('user-1') });
    expect(status).toBe(200);
    expect(body['distribution']).toEqual([{ children: 0, familyCount: 1 }]);
    expect(body['familyCount']).toBe(1);
    expect(body['average']).toBe(0);
  });

  it('tree kosong menghasilkan payload nol dari modul', async () => {
    mockAuthLolos();
    prismaMock.familyRelationship.findMany.mockResolvedValue([]);
    const { status, body } = await get(PATH, { authorization: authHeader('user-1') });
    expect(status).toBe(200);
    expect(body).toEqual({ distribution: [], familyCount: 0, average: 0 });
  });

  it('relasi dobel tetap dedup: bucket tidak menggembung', async () => {
    mockAuthLolos();
    prismaMock.familyRelationship.findMany.mockResolvedValue([
      { memberId: 'c1', relatedId: 'p1', type: 'child' },
      { memberId: 'c1', relatedId: 'p1', type: 'child' },
      { memberId: 'c1', relatedId: 'p2', type: 'child' },
      { memberId: 'p1', relatedId: 'p2', type: 'spouse' },
      { memberId: 'p2', relatedId: 'p1', type: 'spouse' },
    ]);
    const { status, body } = await get(PATH, { authorization: authHeader('user-1') });
    expect(status).toBe(200);
    expect(body['distribution']).toEqual([{ children: 1, familyCount: 1 }]);
    expect(body['familyCount']).toBe(1);
    expect(body['average']).toBe(1);
  });

  it('If-None-Match cocok dijawab 304 dengan Cache-Control terbawa', async () => {
    mockAuthLolos();
    prismaMock.familyRelationship.findMany.mockResolvedValue(RELS_MULTI);
    const first = await fetch(`${BASE}${PATH}`, { headers: { authorization: authHeader('user-1') } });
    expect(first.status).toBe(200);
    const etag = first.headers.get('etag');
    expect(etag).toBeTruthy();
    expect(first.headers.get('cache-control')).toBe('private, no-cache');
    const second = await fetch(`${BASE}${PATH}`, {
      headers: { authorization: authHeader('user-1'), 'if-none-match': etag as string },
    });
    expect(second.status).toBe(304);
    expect(second.headers.get('cache-control')).toBe('private, no-cache');
    expect(second.headers.get('etag')).toBe(etag);
    await second.text();
  });

  it('500 saat prisma reject dengan code CHILDREN_PER_FAMILY_ERROR', async () => {
    mockAuthLolos();
    prismaMock.familyRelationship.findMany.mockRejectedValue(new Error('db mati'));
    const { status, body } = await get(PATH, { authorization: authHeader('user-1') });
    expect(status).toBe(500);
    expect(body['code']).toBe('CHILDREN_PER_FAMILY_ERROR');
    expect(body['message']).toBe('db mati');
  });

  it('body TIDAK memuat field PII: kunci payload dan kunci bucket terbatas', async () => {
    mockAuthLolos();
    prismaMock.familyRelationship.findMany.mockResolvedValue(RELS_MULTI);
    const { body } = await get(PATH, { authorization: authHeader('user-1') });
    expect(Object.keys(body).sort()).toEqual([...PAYLOAD_KEYS].sort());
    const buckets = body['distribution'] as Array<Record<string, unknown>>;
    for (const bucket of buckets) {
      expect(Object.keys(bucket).sort()).toEqual(['children', 'familyCount']);
    }
    expect(JSON.stringify(body)).not.toContain('c1');
    expect(JSON.stringify(body)).not.toContain('p1');
  });

  it('select prisma minimal: hanya memberId, relatedId, type', async () => {
    mockAuthLolos();
    prismaMock.familyRelationship.findMany.mockResolvedValue([]);
    await get(PATH, { authorization: authHeader('user-1') });
    expect(prismaMock.familyRelationship.findMany).toHaveBeenCalledWith({
      where: { treeId: 'tree-1' },
      select: { memberId: true, relatedId: true, type: true },
    });
  });
});
