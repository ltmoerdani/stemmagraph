/**
 * Test dedikasi route citation coverage v281 fase ii
 * (GET /api/v1/trees/:treeId/stats/citation-coverage).
 *
 * Pola persis src/lib/stats/living-stats-api.test.ts: prisma di-mock penuh
 * lewat vi.hoisted supaya server/index.ts bisa diimpor tanpa DATABASE_URL
 * dan tanpa generated prisma client. Server express asli dilisten di port
 * ephemeral (API_PORT) lalu diakses via fetch native, tanpa dependency baru.
 *
 * AC kontrak v281: 401 challenge Bearer, 403 non-anggota tanpa
 * WWW-Authenticate, 404 tree nihil, 200 coverage terisi, pohon kosong null,
 * citationId @VOID@ tidak ter-cover, citation event pasangan tidak
 * meng-cover pasangan, 304 dengan header ETag dan Cache-Control diulang
 * (addendum RFC 9111), header cache di 200, nihil kebocoran field individu.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import express from 'express';
import jwt from 'jsonwebtoken';

const prismaMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  familyTree: { findUnique: vi.fn() },
  treeMember: { findUnique: vi.fn() },
  familyMember: { findMany: vi.fn() },
  lifeEvent: { findMany: vi.fn() },
}));

vi.mock('../../../server/db', () => ({ prisma: prismaMock }));

const JWT_SECRET = 'dev-only-insecure-secret-change-me';

function authHeader(userId: string): string {
  return `Bearer ${jwt.sign({ sub: userId }, JWT_SECRET)}`;
}

const USER = { id: 'user-1', email: 'u@example.test', status: 'active', role: 'owner' };
const TREE = { id: 'tree-1' };

const PATH = '/api/v1/trees/tree-1/stats/citation-coverage';

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

beforeAll(async () => {
  const port = 39800 + (process.pid % 600);
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

describe('v281 citation coverage endpoint', () => {
  it('401 tanpa kredensial dengan header WWW-Authenticate: Bearer', async () => {
    prismaMock.user.findUnique.mockResolvedValue(USER);
    prismaMock.familyTree.findUnique.mockResolvedValue(TREE);
    const { status, wwwAuthenticate } = await get(PATH);
    expect(status).toBe(401);
    expect(wwwAuthenticate).toBe('Bearer');
  });

  it('401 dengan token invalid tetap membawa challenge Bearer', async () => {
    const { status, wwwAuthenticate } = await get(PATH, { authorization: 'Bearer bukan-jwt' });
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

  it('200 coverage terisi: dua dari empat individu ter-cover, 50', async () => {
    mockGuardAman();
    prismaMock.familyMember.findMany.mockResolvedValue([{ id: 'm1' }, { id: 'm2' }, { id: 'm3' }, { id: 'm4' }]);
    prismaMock.lifeEvent.findMany.mockResolvedValue([
      { memberId: 'm1', citationId: 'c1' },
      { memberId: 'm2', citationId: null },
      { memberId: 'm3', citationId: null },
      { memberId: 'm4', citationId: 'c2' },
    ]);
    const { status, body } = await get(PATH, { authorization: authHeader('user-1') });
    expect(status).toBe(200);
    expect(body['coverage']).toBe(50);
  });

  it('pohon kosong menghasilkan coverage null', async () => {
    mockGuardAman();
    prismaMock.familyMember.findMany.mockResolvedValue([]);
    prismaMock.lifeEvent.findMany.mockResolvedValue([]);
    const { status, body } = await get(PATH, { authorization: authHeader('user-1') });
    expect(status).toBe(200);
    expect(body['coverage']).toBeNull();
  });

  it('citationId @VOID@ dihitung tidak ter-cover', async () => {
    mockGuardAman();
    prismaMock.familyMember.findMany.mockResolvedValue([{ id: 'm1' }, { id: 'm2' }]);
    prismaMock.lifeEvent.findMany.mockResolvedValue([
      { memberId: 'm1', citationId: '@VOID@' },
      { memberId: 'm2', citationId: 'c1' },
    ]);
    const { body } = await get(PATH, { authorization: authHeader('user-1') });
    expect(body['coverage']).toBe(50);
  });

  it('citation pada event pasangan hanya meng-cover pemilik event, bukan pasangan', async () => {
    mockGuardAman();
    prismaMock.familyMember.findMany.mockResolvedValue([{ id: 'm1' }, { id: 'm2' }]);
    // Route select { memberId, citationId } saja: partnerMemberId tidak ikut.
    prismaMock.lifeEvent.findMany.mockResolvedValue([{ memberId: 'm1', citationId: 'c1' }]);
    const { body } = await get(PATH, { authorization: authHeader('user-1') });
    expect(body['coverage']).toBe(50);
  });

  it('200 membawa Cache-Control private, no-cache dan ETag weak', async () => {
    mockGuardAman();
    prismaMock.familyMember.findMany.mockResolvedValue([{ id: 'm1' }]);
    prismaMock.lifeEvent.findMany.mockResolvedValue([{ memberId: 'm1', citationId: 'c1' }]);
    const { status, etag, cacheControl } = await get(PATH, { authorization: authHeader('user-1') });
    expect(status).toBe(200);
    expect(cacheControl).toBe('private, no-cache');
    expect(etag).toMatch(/^W\/"[0-9a-f]{64}"$/);
  });

  it('304 saat If-None-Match cocok nilai hex tanpa prefix, header ETag dan Cache-Control diulang', async () => {
    mockGuardAman();
    prismaMock.familyMember.findMany.mockResolvedValue([{ id: 'm1' }]);
    prismaMock.lifeEvent.findMany.mockResolvedValue([{ memberId: 'm1', citationId: 'c1' }]);
    const first = await get(PATH, { authorization: authHeader('user-1') });
    const etag = first.etag ?? '';
    const bareHex = etag.replace(/^W\//, '').replaceAll('"', '');
    const second = await get(PATH, { authorization: authHeader('user-1'), 'if-none-match': bareHex });
    expect(second.status).toBe(304);
    expect(second.etag).toBe(etag);
    expect(second.cacheControl).toBe('private, no-cache');
  });

  it('304 saat klien mengirim format weak penuh, header ETag dan Cache-Control diulang', async () => {
    mockGuardAman();
    prismaMock.familyMember.findMany.mockResolvedValue([{ id: 'm1' }]);
    prismaMock.lifeEvent.findMany.mockResolvedValue([{ memberId: 'm1', citationId: 'c1' }]);
    const first = await get(PATH, { authorization: authHeader('user-1') });
    const etag = first.etag ?? '';
    const second = await get(PATH, { authorization: authHeader('user-1'), 'if-none-match': etag });
    expect(second.status).toBe(304);
    expect(second.etag).toBe(etag);
    expect(second.cacheControl).toBe('private, no-cache');
  });

  it('response body TIDAK membocorkan field individu apa pun', async () => {
    mockGuardAman();
    prismaMock.familyMember.findMany.mockResolvedValue([{ id: 'm1' }, { id: 'm2' }]);
    prismaMock.lifeEvent.findMany.mockResolvedValue([{ memberId: 'm1', citationId: 'c1' }]);
    const { body } = await get(PATH, { authorization: authHeader('user-1') });
    expect(Object.keys(body)).toEqual(['coverage']);
    expect(Object.keys(body)).not.toContain('members');
    expect(Object.keys(body)).not.toContain('id');
    expect(Object.keys(body)).not.toContain('name');
  });

  it('500 ketika query prisma gagal, body CITATION_COVERAGE_ERROR', async () => {
    mockGuardAman();
    prismaMock.familyMember.findMany.mockResolvedValue([{ id: 'm1' }]);
    prismaMock.lifeEvent.findMany.mockRejectedValue(new Error('db down'));
    const { status, body } = await get(PATH, { authorization: authHeader('user-1') });
    expect(status).toBe(500);
    expect(body['code']).toBe('CITATION_COVERAGE_ERROR');
  });
});
