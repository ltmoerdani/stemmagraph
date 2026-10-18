/**
 * Test dedikasi route generations v284 fase ii
 * (GET /api/v1/trees/:treeId/stats/generations).
 *
 * Pola persis src/lib/stats/citation-coverage-api.test.ts (v281): prisma
 * di-mock penuh lewat vi.hoisted supaya server/index.ts bisa diimpor tanpa
 * DATABASE_URL dan tanpa generated prisma client. Server express asli
 * dilisten di port ephemeral (API_PORT) lalu diakses via fetch native.
 *
 * AC kontrak v284: 401 challenge Bearer, 403 FORBIDDEN_TREE tanpa
 * WWW-Authenticate, 404 tree nihil, 200 pohon kosong generationCount 0,
 * rantai 3 generasi count 3, rel child reverse setara rel parent, spouse
 * diabaikan, keys respons persis generationCount, 304 mengulang ETag dan
 * Cache-Control, Cache-Control eksak private no-cache, 500
 * GENERATIONS_ERROR.
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

vi.mock('../../server/db', () => ({ prisma: prismaMock }));

const JWT_SECRET = 'dev-only-insecure-secret-change-me';

function authHeader(userId: string): string {
  return `Bearer ${jwt.sign({ sub: userId }, JWT_SECRET)}`;
}

const USER = { id: 'user-1', email: 'u@example.test', status: 'active', role: 'owner' };
const TREE = { id: 'tree-1' };

const PATH = '/api/v1/trees/tree-1/stats/generations';

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

/** Rantai gp p c: gp orang tua p, p orang tua c, 3 generasi. */
function rantaiParent(): RelRow[] {
  return [
    { memberId: 'gp', relatedId: 'p', type: 'parent' },
    { memberId: 'p', relatedId: 'c', type: 'parent' },
  ];
}

beforeAll(async () => {
  const port = 39800 + (process.pid % 600);
  BASE = `http://127.0.0.1:${port}`;
  process.env['API_PORT'] = String(port);
  const proto = (express as unknown as { application: { listen: (...a: unknown[]) => import('node:http').Server } }).application;
  const origListen = proto.listen;
  proto.listen = function (this: unknown, ...args: unknown[]) {
    serverHandle = origListen.apply(this, args);
    return serverHandle;
  } as typeof proto.listen;
  await import('../../server/index');
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

describe('v284 generations endpoint', () => {
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

  it('200 pohon kosong generationCount 0', async () => {
    mockGuardAman();
    prismaMock.familyRelationship.findMany.mockResolvedValue([]);
    const { status, body } = await get(PATH, { authorization: authHeader('user-1') });
    expect(status).toBe(200);
    expect(body['generationCount']).toBe(0);
  });

  it('200 rantai 3 generasi via rel parent generationCount 3', async () => {
    mockGuardAman();
    prismaMock.familyRelationship.findMany.mockResolvedValue(rantaiParent());
    const { status, body } = await get(PATH, { authorization: authHeader('user-1') });
    expect(status).toBe(200);
    expect(body['generationCount']).toBe(3);
  });

  it('200 rel child reverse dipetakan benar, count sama dengan rel parent ekuivalen', async () => {
    mockGuardAman();
    prismaMock.familyRelationship.findMany.mockResolvedValue([
      { memberId: 'p', relatedId: 'gp', type: 'child' },
      { memberId: 'c', relatedId: 'p', type: 'child' },
    ]);
    const { status, body } = await get(PATH, { authorization: authHeader('user-1') });
    expect(status).toBe(200);
    expect(body['generationCount']).toBe(3);
  });

  it('200 rel spouse dan type asing diabaikan', async () => {
    mockGuardAman();
    prismaMock.familyRelationship.findMany.mockResolvedValue([
      { memberId: 'a', relatedId: 'b', type: 'spouse' },
      { memberId: 'c', relatedId: 'x', type: 'nonsense' },
    ]);
    const { status, body } = await get(PATH, { authorization: authHeader('user-1') });
    expect(status).toBe(200);
    expect(body['generationCount']).toBe(0);
  });

  it('200 keys respons PERSIS generationCount tanpa field individu', async () => {
    mockGuardAman();
    prismaMock.familyRelationship.findMany.mockResolvedValue(rantaiParent());
    const { body } = await get(PATH, { authorization: authHeader('user-1') });
    expect(Object.keys(body)).toEqual(['generationCount']);
    expect(Object.keys(body)).not.toContain('depthByMember');
    expect(Object.keys(body)).not.toContain('members');
    expect(Object.keys(body)).not.toContain('id');
    expect(Object.keys(body)).not.toContain('name');
  });

  it('200 membawa Cache-Control private, no-cache dan ETag strong', async () => {
    mockGuardAman();
    prismaMock.familyRelationship.findMany.mockResolvedValue(rantaiParent());
    const { status, etag, cacheControl } = await get(PATH, { authorization: authHeader('user-1') });
    expect(status).toBe(200);
    expect(cacheControl).toBe('private, no-cache');
    expect(etag).toMatch(/^"[0-9a-f]{64}"$/);
  });

  it('304 saat If-None-Match cocok nilai hex tanpa prefix, header ETag dan Cache-Control diulang', async () => {
    mockGuardAman();
    prismaMock.familyRelationship.findMany.mockResolvedValue(rantaiParent());
    const first = await get(PATH, { authorization: authHeader('user-1') });
    const etag = first.etag ?? '';
    const bareHex = etag.replace(/^W\//, '').replaceAll('"', '');
    const second = await get(PATH, { authorization: authHeader('user-1'), 'if-none-match': bareHex });
    expect(second.status).toBe(304);
    expect(second.etag).toBe(etag);
    expect(second.cacheControl).toBe('private, no-cache');
  });

  it('200 ketika klien kirim token dengan If-None-Match beda payload tetap 200 baru', async () => {
    mockGuardAman();
    prismaMock.familyRelationship.findMany.mockResolvedValue(rantaiParent());
    const res = await get(PATH, { authorization: authHeader('user-1'), 'if-none-match': '"etag-lama-selalu-beda"' });
    expect(res.status).toBe(200);
  });

  it('500 ketika query prisma gagal, body GENERATIONS_ERROR', async () => {
    mockGuardAman();
    prismaMock.familyRelationship.findMany.mockRejectedValue(new Error('db down'));
    const { status, body } = await get(PATH, { authorization: authHeader('user-1') });
    expect(status).toBe(500);
    expect(body['code']).toBe('GENERATIONS_ERROR');
  });
});
