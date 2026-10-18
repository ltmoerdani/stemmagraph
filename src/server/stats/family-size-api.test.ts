/**
 * Test dedikasi route family-size v288 fase ii
 * (GET /api/v1/trees/:treeId/stats/family-size).
 *
 * Pola persis src/server/generations-api.test.ts (v284) dan
 * src/lib/stats/citation-coverage-api.test.ts (v281): prisma di-mock
 * penuh lewat vi.hoisted supaya server/index.ts bisa diimpor tanpa
 * DATABASE_URL dan tanpa generated prisma client. Server express asli
 * dilisten di port ephemeral (API_PORT) lalu diakses via fetch native.
 *
 * AC kontrak kukuh v288: 401 challenge Bearer, 403 FORBIDDEN_TREE tanpa
 * WWW-Authenticate, 404 tree nihil, 200 pasangan spouse dengan anak
 * dedupe dua ortu, pasangan tanpa anak masuk bucket zero, ortu tunggal
 * tanpa spouse, anak dua ortu tanpa spouse link, tree tanpa relasi
 * bentuk null (familyCount 0, average null, median null, max 0,
 * distribution nol semua), 304 mengulang ETag dan Cache-Control, keys
 * respons tanpa field individu, rel type lain diabaikan.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import express from 'express';
import jwt from 'jsonwebtoken';

const prismaMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  familyTree: { findUnique: vi.fn() },
  treeMember: { findUnique: vi.fn() },
  familyRelationship: { findMany: vi.fn() },
}));

vi.mock('../../../server/db', () => ({ prisma: prismaMock }));

const JWT_SECRET = 'dev-only-insecure-secret-change-me';

function authHeader(userId: string): string {
  return `Bearer ${jwt.sign({ sub: userId }, JWT_SECRET)}`;
}

const USER = { id: 'user-1', email: 'u@example.test', status: 'active', role: 'owner' };
const TREE = { id: 'tree-1' };

const PATH = '/api/v1/trees/tree-1/stats/family-size';

let BASE = '';
let serverHandle: import('node:http').Server | undefined;

interface GetResult {
  status: number;
  body: Record<string, unknown>;
  etag: string | null;
  cacheControl: string | null;
  wwwAuthenticate: string | null;
}

async function get(path: string, headers: Record<string, string> = {}): Promise<GetResult> {
  const res = await fetch(`${BASE}${path}`, { headers });
  const text = await res.text();
  return {
    status: res.status,
    body: text.length === 0 ? {} : (JSON.parse(text) as Record<string, unknown>),
    etag: res.headers.get('etag'),
    cacheControl: res.headers.get('cache-control'),
    wwwAuthenticate: res.headers.get('www-authenticate'),
  };
}

function mockGuardAman(): void {
  prismaMock.user.findUnique.mockResolvedValue(USER);
  prismaMock.familyTree.findUnique.mockResolvedValue(TREE);
  prismaMock.treeMember.findUnique.mockResolvedValue(null);
}

interface RelRow {
  memberId: string;
  relatedId: string;
  type: string;
}

/** Bentuk null lengkap saat nihil keluarga valid (keputusan PM v288). */
const BENTUK_NULL = {
  average: null,
  median: null,
  max: 0,
  distribution: { zero: 0, oneToTwo: 0, threeToFour: 0, fivePlus: 0 },
  familyCount: 0,
  excludedCount: 0,
};

beforeAll(async () => {
  const port = 38600 + (process.pid % 600);
  BASE = `http://127.0.0.1:${port}`;
  process.env['API_PORT'] = String(port);
  const proto = (express as unknown as { application: { listen: (...a: unknown[]) => import('node:http').Server } }).application;
  const origListen = proto.listen;
  proto.listen = function (this: unknown, ...args: unknown[]) {
    serverHandle = origListen.apply(this, args);
    return serverHandle;
  } as typeof proto.listen;
  await import('../../../server/index');
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

describe('v288 family-size endpoint', () => {
  it('401 tanpa kredensial dengan header WWW-Authenticate: Bearer', async () => {
    prismaMock.user.findUnique.mockResolvedValue(USER);
    prismaMock.familyTree.findUnique.mockResolvedValue(TREE);
    const { status, wwwAuthenticate } = await get(PATH);
    expect(status).toBe(401);
    expect(wwwAuthenticate).toBe('Bearer');
  });

  it('403 bukan anggota tanpa header WWW-Authenticate', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ ...USER, role: 'member' });
    prismaMock.familyTree.findUnique.mockResolvedValue(TREE);
    prismaMock.treeMember.findUnique.mockResolvedValue(null);
    const { status, body, wwwAuthenticate } = await get(PATH, { authorization: authHeader('user-1') });
    expect(status).toBe(403);
    expect(body['code']).toBe('FORBIDDEN_TREE');
    expect(wwwAuthenticate).toBeNull();
  });

  it('404 ketika tree tidak ada', async () => {
    prismaMock.user.findUnique.mockResolvedValue(USER);
    prismaMock.familyTree.findUnique.mockResolvedValue(null);
    const { status, body } = await get(PATH, { authorization: authHeader('user-1') });
    expect(status).toBe(404);
    expect(body['code']).toBe('NOT_FOUND');
  });

  it('200 pasangan spouse dengan satu anak, dedupe dua ortu, satu keluarga ukuran 1', async () => {
    mockGuardAman();
    const rels: RelRow[] = [
      { memberId: 'p1', relatedId: 'p2', type: 'spouse' },
      { memberId: 'p1', relatedId: 'c1', type: 'parent' },
      { memberId: 'p2', relatedId: 'c1', type: 'parent' },
      // Baris parent duplikat membuktikan normalisasi set ortu.
      { memberId: 'p1', relatedId: 'c1', type: 'parent' },
    ];
    prismaMock.familyRelationship.findMany.mockResolvedValue(rels);
    const { status, body } = await get(PATH, { authorization: authHeader('user-1') });
    expect(status).toBe(200);
    expect(body['familyCount']).toBe(1);
    expect(body['average']).toBe(1);
    expect(body['median']).toBe(1);
    expect(body['max']).toBe(1);
    expect(body['excludedCount']).toBe(0);
    expect(body['distribution']).toEqual({ zero: 0, oneToTwo: 1, threeToFour: 0, fivePlus: 0 });
  });

  it('200 pasangan tanpa anak masuk bucket zero sebagai keluarga ukuran 0', async () => {
    mockGuardAman();
    prismaMock.familyRelationship.findMany.mockResolvedValue([
      { memberId: 'a', relatedId: 'b', type: 'spouse' } as RelRow,
    ]);
    const { status, body } = await get(PATH, { authorization: authHeader('user-1') });
    expect(status).toBe(200);
    expect(body['familyCount']).toBe(1);
    expect(body['average']).toBe(0);
    expect(body['median']).toBe(0);
    expect(body['max']).toBe(0);
    expect(body['distribution']).toEqual({ zero: 1, oneToTwo: 0, threeToFour: 0, fivePlus: 0 });
  });

  it('200 ortu tunggal tanpa spouse: dua anak jadi satu keluarga ukuran 2', async () => {
    mockGuardAman();
    prismaMock.familyRelationship.findMany.mockResolvedValue([
      { memberId: 'p', relatedId: 'c1', type: 'parent' },
      { memberId: 'p', relatedId: 'c2', type: 'parent' },
    ] as RelRow[]);
    const { status, body } = await get(PATH, { authorization: authHeader('user-1') });
    expect(status).toBe(200);
    expect(body['familyCount']).toBe(1);
    expect(body['average']).toBe(2);
    expect(body['median']).toBe(2);
    expect(body['max']).toBe(2);
    expect(body['distribution']).toEqual({ zero: 0, oneToTwo: 1, threeToFour: 0, fivePlus: 0 });
  });

  it('200 anak dua ortu tanpa spouse link: keluarga key A saja tanpa unit zero tambahan', async () => {
    mockGuardAman();
    prismaMock.familyRelationship.findMany.mockResolvedValue([
      { memberId: 'a', relatedId: 'c', type: 'parent' },
      { memberId: 'b', relatedId: 'c', type: 'parent' },
    ] as RelRow[]);
    const { status, body } = await get(PATH, { authorization: authHeader('user-1') });
    expect(status).toBe(200);
    expect(body['familyCount']).toBe(1);
    expect(body['average']).toBe(1);
    expect(body['distribution']).toEqual({ zero: 0, oneToTwo: 1, threeToFour: 0, fivePlus: 0 });
  });

  it('200 tree tanpa relasi apapun mengembalikan bentuk null lengkap', async () => {
    mockGuardAman();
    prismaMock.familyRelationship.findMany.mockResolvedValue([]);
    const { status, body } = await get(PATH, { authorization: authHeader('user-1') });
    expect(status).toBe(200);
    expect(body).toEqual(BENTUK_NULL);
  });

  it('304 mengulang ETag dan Cache-Control saat If-None-Match cocok', async () => {
    mockGuardAman();
    prismaMock.familyRelationship.findMany.mockResolvedValue([
      { memberId: 'p1', relatedId: 'p2', type: 'spouse' },
      { memberId: 'p1', relatedId: 'c1', type: 'parent' },
      { memberId: 'p2', relatedId: 'c1', type: 'parent' },
    ] as RelRow[]);
    const first = await get(PATH, { authorization: authHeader('user-1') });
    expect(first.status).toBe(200);
    const etag = first.etag ?? '';
    const bareHex = etag.replace(/^W\//, '').replaceAll('"', '');
    const second = await get(PATH, { authorization: authHeader('user-1'), 'if-none-match': bareHex });
    expect(second.status).toBe(304);
    expect(second.etag).toBe(etag);
    expect(second.cacheControl).toBe('private, no-cache');
  });

  it('200 keys respons persis enam agregat tanpa field individu', async () => {
    mockGuardAman();
    prismaMock.familyRelationship.findMany.mockResolvedValue([
      { memberId: 'p1', relatedId: 'p2', type: 'spouse' },
      { memberId: 'p1', relatedId: 'c1', type: 'parent' },
      { memberId: 'p2', relatedId: 'c1', type: 'parent' },
    ] as RelRow[]);
    const { status, body } = await get(PATH, { authorization: authHeader('user-1') });
    expect(status).toBe(200);
    expect(Object.keys(body)).toEqual(['average', 'median', 'max', 'distribution', 'familyCount', 'excludedCount']);
    expect(Object.keys(body)).not.toContain('members');
    expect(Object.keys(body)).not.toContain('id');
    expect(Object.keys(body)).not.toContain('name');
    expect(Object.keys(body)).not.toContain('childIds');
    expect(JSON.stringify(body)).not.toContain('"c1"');
  });

  it('200 rel type lain (nonsense, sibling) diabaikan sehingga bentuk null', async () => {
    mockGuardAman();
    prismaMock.familyRelationship.findMany.mockResolvedValue([
      { memberId: 'a', relatedId: 'b', type: 'nonsense' },
      { memberId: 'b', relatedId: 'c', type: 'sibling' },
    ] as RelRow[]);
    const { status, body } = await get(PATH, { authorization: authHeader('user-1') });
    expect(status).toBe(200);
    expect(body).toEqual(BENTUK_NULL);
  });

  it('200 membawa Cache-Control eksak private no-cache dan ETag strong 64 hex', async () => {
    mockGuardAman();
    prismaMock.familyRelationship.findMany.mockResolvedValue([
      { memberId: 'a', relatedId: 'b', type: 'spouse' },
    ] as RelRow[]);
    const { status, etag, cacheControl } = await get(PATH, { authorization: authHeader('user-1') });
    expect(status).toBe(200);
    expect(cacheControl).toBe('private, no-cache');
    expect(etag).toMatch(/^"[0-9a-f]{64}"$/);
  });

  it('200 agregasi tiga keluarga campuran: average 1.7, median 2, max 3', async () => {
    mockGuardAman();
    const rels: RelRow[] = [
      // Keluarga 1: pasangan p1 p2 dengan tiga anak (ukuran 3).
      { memberId: 'p1', relatedId: 'p2', type: 'spouse' },
      { memberId: 'p1', relatedId: 'k1', type: 'parent' },
      { memberId: 'p2', relatedId: 'k1', type: 'parent' },
      { memberId: 'p1', relatedId: 'k2', type: 'parent' },
      { memberId: 'p2', relatedId: 'k2', type: 'parent' },
      { memberId: 'p1', relatedId: 'k3', type: 'parent' },
      { memberId: 'p2', relatedId: 'k3', type: 'parent' },
      // Keluarga 2: ortu tunggal p3 dengan dua anak (ukuran 2).
      { memberId: 'p3', relatedId: 'k4', type: 'parent' },
      { memberId: 'p3', relatedId: 'k5', type: 'parent' },
      // Keluarga 3: pasangan p4 p5 tanpa anak (ukuran 0).
      { memberId: 'p4', relatedId: 'p5', type: 'spouse' },
    ];
    prismaMock.familyRelationship.findMany.mockResolvedValue(rels);
    const { status, body } = await get(PATH, { authorization: authHeader('user-1') });
    expect(status).toBe(200);
    expect(body['familyCount']).toBe(3);
    expect(body['average']).toBe(1.7);
    expect(body['median']).toBe(2);
    expect(body['max']).toBe(3);
    expect(body['excludedCount']).toBe(0);
    expect(body['distribution']).toEqual({ zero: 1, oneToTwo: 1, threeToFour: 1, fivePlus: 0 });
  });
});
