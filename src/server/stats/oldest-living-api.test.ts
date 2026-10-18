/**
 * Test dedikasi route oldest-living v302 fase ii
 * (GET /api/v1/trees/:treeId/stats/oldest-living).
 *
 * Pola persis src/server/stats/family-size-api.test.ts (v288): prisma
 * di-mock penuh lewat vi.hoisted supaya server/index.ts bisa diimpor
 * tanpa DATABASE_URL dan tanpa generated prisma client. Server express
 * asli dilisten di port ephemeral (API_PORT) lalu diakses via fetch
 * native.
 *
 * AC kontrak kukuh v302: 401 challenge Bearer, 403 FORBIDDEN_TREE tanpa
 * WWW-Authenticate, 404 tree nihil, 200 urut age DESC hanya id ageYears,
 * topN default 10 integer 1 sampai 50 di luar rentang 400 INVALID_TOP_N,
 * isAlive false dikecualikan, birthDate null atau rusak dikecualikan
 * modul, privacyStatus private dikecualikan meski paling tua, shared
 * lolos, 304 mengulang ETag dan Cache-Control, 500 OLDEST_LIVING_API_ERROR.
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

const PATH = '/api/v1/trees/tree-1/stats/oldest-living';

let BASE = '';
let serverHandle: import('node:http').Server | undefined;

interface GetResult {
  status: number;
  body: Record<string, unknown>;
  etag: string | null;
  cacheControl: string | null;
  contentType: string | null;
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
    contentType: res.headers.get('content-type'),
    wwwAuthenticate: res.headers.get('www-authenticate'),
  };
}

function mockGuardAman(): void {
  prismaMock.user.findUnique.mockResolvedValue(USER);
  prismaMock.familyTree.findUnique.mockResolvedValue(TREE);
  prismaMock.treeMember.findUnique.mockResolvedValue(null);
}

interface MemberRow {
  id: string;
  birthDate: string | null;
  isAlive: boolean;
  privacyStatus: string | null;
}

function member(id: string, birthDate: string | null, opts: Partial<MemberRow> = {}): MemberRow {
  return { id, birthDate, isAlive: true, privacyStatus: null, ...opts };
}

/** Umur penuh tahun anniversary-aware, formula sama dengan modul pure. */
function expectedAge(birth: string, now: Date): number {
  const [y, m, d] = birth.split('-').map(Number);
  let age = now.getUTCFullYear() - (y as number);
  const nm = now.getUTCMonth() + 1;
  const nd = now.getUTCDate();
  const passed = (m as number) < nm || ((m as number) === nm && (d as number) <= nd);
  if (!passed) age -= 1;
  return age;
}

beforeAll(async () => {
  const port = 40400 + (process.pid % 600);
  BASE = `http://127.0.0.1:${port}`;
  process.env['API_PORT'] = String(port);
  const proto = (express as unknown as { application: { listen: (...a: unknown[]) => import('node:http').Server } }).application;
  const origListen = proto.listen;
  proto.listen = function (this: unknown, ...a: unknown[]) {
    serverHandle = origListen.apply(this, a);
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

describe('v302 oldest-living endpoint', () => {
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

  it('200 happy path multi anggota urut age DESC, entry hanya id dan ageYears', async () => {
    mockGuardAman();
    prismaMock.familyMember.findMany.mockResolvedValue([
      member('a1', '1930-01-15'),
      member('a2', '1945-06-10'),
      member('a3', '1960-12-01'),
      member('a4', '1950-03-03'),
    ]);
    const { status, body, contentType } = await get(PATH, { authorization: authHeader('user-1') });
    expect(status).toBe(200);
    expect(contentType).toBe('application/json; charset=utf-8');
    const results = body['results'] as Array<{ id: string; ageYears: number }>;
    const now = new Date();
    expect(results).toEqual([
      { id: 'a1', ageYears: expectedAge('1930-01-15', now) },
      { id: 'a2', ageYears: expectedAge('1945-06-10', now) },
      { id: 'a4', ageYears: expectedAge('1950-03-03', now) },
      { id: 'a3', ageYears: expectedAge('1960-12-01', now) },
    ]);
    for (const entry of results) {
      expect(Object.keys(entry)).toEqual(['id', 'ageYears']);
    }
  });

  it('200 query prisma select minimal id birthDate isAlive privacyStatus tanpa relasi', async () => {
    mockGuardAman();
    prismaMock.familyMember.findMany.mockResolvedValue([]);
    await get(PATH, { authorization: authHeader('user-1') });
    expect(prismaMock.familyMember.findMany).toHaveBeenCalledWith({
      where: { treeId: 'tree-1' },
      select: { id: true, birthDate: true, isAlive: true, privacyStatus: true },
    });
  });

  it('200 topN default 10 memotong 12 kandidat menjadi 10 teratas', async () => {
    mockGuardAman();
    const rows: MemberRow[] = [];
    for (let i = 1; i <= 12; i += 1) {
      const year = 1919 + i;
      rows.push(member(`m${String(i).padStart(2, '0')}`, `${year}-06-15`));
    }
    prismaMock.familyMember.findMany.mockResolvedValue(rows);
    const { status, body } = await get(PATH, { authorization: authHeader('user-1') });
    expect(status).toBe(200);
    const results = body['results'] as Array<{ id: string }>;
    expect(results).toHaveLength(10);
    expect(results[0]?.id).toBe('m01');
    expect(results[9]?.id).toBe('m10');
  });

  it('200 topN valid memotong hasil (topN 2 dari 4 kandidat)', async () => {
    mockGuardAman();
    prismaMock.familyMember.findMany.mockResolvedValue([
      member('a1', '1930-01-15'),
      member('a2', '1945-06-10'),
      member('a3', '1960-12-01'),
      member('a4', '1950-03-03'),
    ]);
    const { status, body } = await get(`${PATH}?topN=2`, { authorization: authHeader('user-1') });
    expect(status).toBe(200);
    const results = body['results'] as Array<{ id: string }>;
    expect(results).toHaveLength(2);
    expect(results.map((r) => r.id)).toEqual(['a1', 'a2']);
  });

  it('200 topN batas bawah 1 dan batas atas 50 keduanya valid', async () => {
    mockGuardAman();
    const rows = [member('a1', '1930-01-15'), member('a2', '1945-06-10')];
    prismaMock.familyMember.findMany.mockResolvedValue(rows);
    const bawah = await get(`${PATH}?topN=1`, { authorization: authHeader('user-1') });
    expect(bawah.status).toBe(200);
    expect(bawah.body['results']).toHaveLength(1);
    const atas = await get(`${PATH}?topN=50`, { authorization: authHeader('user-1') });
    expect(atas.status).toBe(200);
    expect(atas.body['results']).toHaveLength(2);
  });

  it('400 topN 0 INVALID_TOP_N', async () => {
    mockGuardAman();
    prismaMock.familyMember.findMany.mockResolvedValue([]);
    const { status, body } = await get(`${PATH}?topN=0`, { authorization: authHeader('user-1') });
    expect(status).toBe(400);
    expect(body['code']).toBe('INVALID_TOP_N');
  });

  it('400 topN 51 INVALID_TOP_N', async () => {
    mockGuardAman();
    prismaMock.familyMember.findMany.mockResolvedValue([]);
    const { status, body } = await get(`${PATH}?topN=51`, { authorization: authHeader('user-1') });
    expect(status).toBe(400);
    expect(body['code']).toBe('INVALID_TOP_N');
  });

  it('400 topN abc INVALID_TOP_N', async () => {
    mockGuardAman();
    prismaMock.familyMember.findMany.mockResolvedValue([]);
    const { status, body } = await get(`${PATH}?topN=abc`, { authorization: authHeader('user-1') });
    expect(status).toBe(400);
    expect(body['code']).toBe('INVALID_TOP_N');
  });

  it('400 topN desimal 2.5 INVALID_TOP_N', async () => {
    mockGuardAman();
    prismaMock.familyMember.findMany.mockResolvedValue([]);
    const { status, body } = await get(`${PATH}?topN=2.5`, { authorization: authHeader('user-1') });
    expect(status).toBe(400);
    expect(body['code']).toBe('INVALID_TOP_N');
  });

  it('200 kandidat isAlive false dikecualikan dari hasil', async () => {
    mockGuardAman();
    prismaMock.familyMember.findMany.mockResolvedValue([
      member('dead1', '1900-01-01', { isAlive: false }),
      member('alive1', '1955-05-05'),
    ]);
    const { status, body } = await get(PATH, { authorization: authHeader('user-1') });
    expect(status).toBe(200);
    const results = body['results'] as Array<{ id: string }>;
    expect(results).toHaveLength(1);
    expect(results[0]?.id).toBe('alive1');
    expect(JSON.stringify(body)).not.toContain('dead1');
  });

  it('200 birthDate null atau rusak dikecualikan modul, route tetap 200', async () => {
    mockGuardAman();
    prismaMock.familyMember.findMany.mockResolvedValue([
      member('x1', null),
      member('x2', '2026-02-30'),
      member('x3', 'not-a-date'),
      member('v1', '1940-04-04'),
    ]);
    const { status, body } = await get(PATH, { authorization: authHeader('user-1') });
    expect(status).toBe(200);
    const results = body['results'] as Array<{ id: string }>;
    expect(results).toHaveLength(1);
    expect(results[0]?.id).toBe('v1');
  });

  it('200 privacyStatus private dikecualikan meski paling tua', async () => {
    mockGuardAman();
    prismaMock.familyMember.findMany.mockResolvedValue([
      member('old-private', '1900-01-01', { privacyStatus: 'private' }),
      member('a1', '1930-01-15', { privacyStatus: 'public' }),
      member('a2', '1945-06-10'),
    ]);
    const { status, body } = await get(PATH, { authorization: authHeader('user-1') });
    expect(status).toBe(200);
    const results = body['results'] as Array<{ id: string }>;
    expect(results.map((r) => r.id)).toEqual(['a1', 'a2']);
    expect(JSON.stringify(body)).not.toContain('old-private');
  });

  it('200 privacyStatus shared lolos masuk hasil', async () => {
    mockGuardAman();
    prismaMock.familyMember.findMany.mockResolvedValue([
      member('s1', '1931-02-02', { privacyStatus: 'shared' }),
    ]);
    const { status, body } = await get(PATH, { authorization: authHeader('user-1') });
    expect(status).toBe(200);
    const results = body['results'] as Array<{ id: string; ageYears: number }>;
    expect(results).toEqual([{ id: 's1', ageYears: expectedAge('1931-02-02', new Date()) }]);
  });

  it('304 mengulang ETag dan Cache-Control saat If-None-Match cocok, kuat maupun weak prefix', async () => {
    mockGuardAman();
    prismaMock.familyMember.findMany.mockResolvedValue([
      member('a1', '1930-01-15'),
      member('a2', '1945-06-10'),
    ]);
    const first = await get(PATH, { authorization: authHeader('user-1') });
    expect(first.status).toBe(200);
    const etag = first.etag ?? '';
    expect(etag).toMatch(/^"[0-9a-f]{64}"$/);
    const bareHex = etag.replace(/^W\//, '').replaceAll('"', '');
    const second = await get(PATH, { authorization: authHeader('user-1'), 'if-none-match': bareHex });
    expect(second.status).toBe(304);
    expect(second.etag).toBe(etag);
    expect(second.cacheControl).toBe('private, no-cache');
    const third = await get(PATH, { authorization: authHeader('user-1'), 'if-none-match': `W/${bareHex}` });
    expect(third.status).toBe(304);
  });

  it('500 saat prisma findMany reject dengan code OLDEST_LIVING_API_ERROR', async () => {
    mockGuardAman();
    prismaMock.familyMember.findMany.mockRejectedValue(new Error('db down'));
    const { status, body } = await get(PATH, { authorization: authHeader('user-1') });
    expect(status).toBe(500);
    expect(body['code']).toBe('OLDEST_LIVING_API_ERROR');
  });
});
