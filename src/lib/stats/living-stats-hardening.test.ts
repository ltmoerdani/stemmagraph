/**
 * Test dedikasi v272 fase i: stats living hardening (header cache + challenge auth).
 *
 * Harness pola preseden living-stats-api.test.ts: prisma di-mock penuh lewat
 * vi.hoisted, server express asli dilisten di port ephemeral (rentang berbeda
 * dari baseline supaya aman saat keduanya jalan paralel), diakses via fetch
 * native tanpa dependency baru.
 *
 * AC kontrak v272: 200 membawa Cache-Control "private, no-cache" persis
 * (tes negatif: tanpa public, tanpa s-maxage, tanpa max-age positif),
 * 200 membawa ETag dan If-None-Match sama dijawab 304 tanpa body (ETag
 * eksplisit dari hash payload karena express 5.2.1 terbukti tidak
 * mengonversi If-None-Match menjadi 304 secara otomatis),
 * 401 membawa WWW-Authenticate: Bearer (RFC 9110) hanya di route ini,
 * body 401 dan 403 tetap pola repo { code, message }, 403 dan 404 tidak
 * berubah vs baseline, route lain tanpa WWW-Authenticate.
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
  { birthDate: '1950-01-15', deathDate: '2020-01-15', isAlive: false, generation: 2 },
];

const PATH = '/api/v1/trees/tree-1/stats/living';
const OTHER_PATH = '/api/v1/members/member-tidak-ada';

interface Outcome {
  status: number;
  headers: Record<string, string>;
  rawBody: string;
}

let BASE = '';
let serverHandle: import('node:http').Server | undefined;

beforeAll(async () => {
  const port = 39600 + (process.pid % 600);
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

async function call(path: string, headers: Record<string, string> = {}): Promise<Outcome> {
  const res = await fetch(`${BASE}${path}`, { headers });
  const heads: Record<string, string> = {};
  res.headers.forEach((v, k) => {
    heads[k.toLowerCase()] = v;
  });
  const rawBody = await res.text();
  return { status: res.status, headers: heads, rawBody };
}

function parseBody(out: Outcome): Record<string, unknown> {
  return JSON.parse(out.rawBody) as Record<string, unknown>;
}

function mockHappyPath(members: unknown = MEMBERS): void {
  prismaMock.user.findUnique.mockResolvedValue(USER);
  prismaMock.familyTree.findUnique.mockResolvedValue(TREE);
  prismaMock.treeMember.findUnique.mockResolvedValue(null);
  prismaMock.familyMember.findMany.mockResolvedValue(members);
}

describe('v272 stats living hardening: Cache-Control pada 200', () => {
  it('200 membawa header Cache-Control persis "private, no-cache"', async () => {
    mockHappyPath();
    const out = await call(PATH, { authorization: authHeader('user-1') });
    expect(out.status).toBe(200);
    expect(out.headers['cache-control']).toBe('private, no-cache');
  });

  it('negatif: Cache-Control 200 tanpa direktif public', async () => {
    mockHappyPath();
    const out = await call(PATH, { authorization: authHeader('user-1') });
    expect(out.headers['cache-control']).not.toContain('public');
  });

  it('negatif: Cache-Control 200 tanpa s-maxage', async () => {
    mockHappyPath();
    const out = await call(PATH, { authorization: authHeader('user-1') });
    expect(out.headers['cache-control']).not.toContain('s-maxage');
  });

  it('negatif: Cache-Control 200 tanpa max-age bernilai positif', async () => {
    mockHappyPath();
    const out = await call(PATH, { authorization: authHeader('user-1') });
    const cc = out.headers['cache-control'] ?? '';
    expect(cc).not.toMatch(/max-age\s*=\s*0*[1-9]/);
  });
});

describe('v272 stats living hardening: ETag dan 304', () => {
  it('200 membawa header ETag (strong atau weak keduanya sah)', async () => {
    mockHappyPath();
    const out = await call(PATH, { authorization: authHeader('user-1') });
    expect(out.status).toBe(200);
    const etag = out.headers['etag'];
    expect(typeof etag).toBe('string');
    expect(etag!.length).toBeGreaterThan(0);
  });

  it('If-None-Match dengan ETag sama menghasilkan 304 tanpa body', async () => {
    mockHappyPath();
    const first = await call(PATH, { authorization: authHeader('user-1') });
    expect(first.status).toBe(200);
    const etag = first.headers['etag']!;
    const second = await call(PATH, {
      authorization: authHeader('user-1'),
      'if-none-match': etag,
    });
    expect(second.status).toBe(304);
    expect(second.rawBody).toBe('');
  });
});

describe('v272 stats living hardening: WWW-Authenticate pada 401', () => {
  it('401 tanpa Authorization membawa WWW-Authenticate: Bearer', async () => {
    prismaMock.user.findUnique.mockResolvedValue(USER);
    const out = await call(PATH);
    expect(out.status).toBe(401);
    expect(out.headers['www-authenticate']).toBe('Bearer');
  });

  it('401 dengan token invalid tetap membawa WWW-Authenticate: Bearer', async () => {
    const out = await call(PATH, { authorization: 'Bearer bukan-jwt' });
    expect(out.status).toBe(401);
    expect(out.headers['www-authenticate']).toBe('Bearer');
  });

  it('body 401 tetap pola repo { code, message }', async () => {
    const out = await call(PATH);
    expect(out.status).toBe(401);
    const body = parseBody(out);
    expect(Object.keys(body).sort()).toEqual(['code', 'message']);
    expect(body['code']).toBe('UNAUTHORIZED');
    expect(typeof body['message']).toBe('string');
  });
});

describe('v272 stats living hardening: 403 dan 404 nihil regresi', () => {
  it('403 tanpa akses tree: code FORBIDDEN_TREE, body pola repo, tanpa WWW-Authenticate', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ ...USER, role: 'member' });
    prismaMock.familyTree.findUnique.mockResolvedValue(TREE);
    prismaMock.treeMember.findUnique.mockResolvedValue(null);
    const out = await call(PATH, { authorization: authHeader('user-1') });
    expect(out.status).toBe(403);
    const body = parseBody(out);
    expect(Object.keys(body).sort()).toEqual(['code', 'message']);
    expect(body['code']).toBe('FORBIDDEN_TREE');
    expect(out.headers['www-authenticate']).toBeUndefined();
  });

  it('404 tree nihil: code NOT_FOUND, body pola repo, perilaku baseline utuh', async () => {
    prismaMock.user.findUnique.mockResolvedValue(USER);
    prismaMock.familyTree.findUnique.mockResolvedValue(null);
    const out = await call(PATH, { authorization: authHeader('user-1') });
    expect(out.status).toBe(404);
    const body = parseBody(out);
    expect(Object.keys(body).sort()).toEqual(['code', 'message']);
    expect(body['code']).toBe('NOT_FOUND');
    expect(out.headers['www-authenticate']).toBeUndefined();
  });
});

describe('v272 stats living hardening: dampak terbatas satu route', () => {
  it('401 di route lain tidak membawa WWW-Authenticate (requireAuth global tidak disentuh)', async () => {
    const out = await call(OTHER_PATH);
    expect(out.status).toBe(401);
    expect(out.headers['www-authenticate']).toBeUndefined();
    const body = parseBody(out);
    expect(body['code']).toBe('UNAUTHORIZED');
  });

  it('200 route stats/living tetap membawa payload agregat yang benar', async () => {
    mockHappyPath();
    const out = await call(PATH, { authorization: authHeader('user-1') });
    expect(out.status).toBe(200);
    const body = parseBody(out);
    expect(body['total']).toBe(2);
    expect(body['living']).toBe(1);
    expect(body['deceased']).toBe(1);
    expect(body['avgLifespanYears']).toBe(70);
  });
});
