/**
 * Test dedikasi route duplicates v388
 * (GET /api/v1/trees/:treeId/members/duplicates).
 *
 * Pola persis src/server/generations-api.test.ts (v284): prisma di-mock
 * penuh lewat vi.hoisted supaya server/index.ts bisa diimpor tanpa
 * DATABASE_URL dan tanpa generated prisma client. Server express asli
 * dilisten di port ephemeral lalu diakses via fetch native.
 *
 * AC kontrak v388: 401 challenge Bearer, 403 FORBIDDEN_TREE tanpa
 * WWW-Authenticate, 422 INVALID_NAME tanpa query name, 200 { candidates }
 * berisi kandidat dari modul pure, 500 DUPLICATES_ERROR.
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

vi.mock('../../server/db', () => ({ prisma: prismaMock }));

const JWT_SECRET = 'dev-only-insecure-secret-change-me';

function authHeader(userId: string): string {
  return `Bearer ${jwt.sign({ sub: userId }, JWT_SECRET)}`;
}

const USER = { id: 'user-1', email: 'u@example.test', status: 'active', role: 'owner' };
const TREE = { id: 'tree-1' };

const PATH = '/api/v1/trees/tree-1/members/duplicates';

let BASE = '';
let serverHandle: import('node:http').Server | undefined;

interface GetResult {
  status: number;
  body: Record<string, unknown>;
  wwwAuthenticate: string | null;
}

async function get(path: string, headers: Record<string, string> = {}): Promise<GetResult> {
  const res = await fetch(`${BASE}${path}`, { headers });
  const text = await res.text();
  return {
    status: res.status,
    body: text.length === 0 ? {} : (JSON.parse(text) as Record<string, unknown>),
    wwwAuthenticate: res.headers.get('www-authenticate'),
  };
}

function mockGuardAman(): void {
  prismaMock.user.findUnique.mockResolvedValue(USER);
  prismaMock.familyTree.findUnique.mockResolvedValue(TREE);
  prismaMock.treeMember.findUnique.mockResolvedValue(null);
}

beforeAll(async () => {
  const port = 39900 + (process.pid % 600);
  BASE = `http://127.0.0.1:${port}`;
  process.env['API_PORT'] = String(port);
  const proto = (express as unknown as { application: { listen: (...a: unknown[]) => import('node:http').Server } }).application;
  const origListen = proto.listen;
  proto.listen = function (this: unknown, ...args: unknown[]) {
    serverHandle = origListen.apply(this, args);
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

describe('GET /api/v1/trees/:treeId/members/duplicates (v388)', () => {
  it('401 tanpa kredensial dengan challenge Bearer', async () => {
    mockGuardAman();
    const out = await get(`${PATH}?name=Andi`);
    expect(out.status).toBe(401);
    expect(out.wwwAuthenticate).toBe('Bearer');
  });

  it('403 bukan anggota tree tanpa WWW-Authenticate', async () => {
    mockGuardAman();
    prismaMock.user.findUnique.mockResolvedValue({ ...USER, role: 'member' });
    const out = await get(`${PATH}?name=Andi`, { Authorization: authHeader('user-1') });
    expect(out.status).toBe(403);
    expect(out.wwwAuthenticate).toBeNull();
    expect((out.body as { code?: string }).code).toBe('FORBIDDEN_TREE');
  });

  it('422 bila query name kosong atau absen', async () => {
    mockGuardAman();
    const out = await get(PATH, { Authorization: authHeader('user-1') });
    expect(out.status).toBe(422);
    expect((out.body as { code?: string }).code).toBe('INVALID_NAME');
  });

  it('200 kandidat dari modul pure untuk anggota tree', async () => {
    mockGuardAman();
    prismaMock.treeMember.findUnique.mockResolvedValue({ id: 'tm-1', userId: 'user-1', treeId: 'tree-1', role: 'editor' });
    prismaMock.familyMember.findMany.mockResolvedValue([
      { id: 'm1', name: 'Andi Sitompul', nickname: null, marga: 'Sitompul', birthDate: '1980-05-10', gender: 'M' },
    ]);
    const out = await get(`${PATH}?name=Andi%20Sitompul&marga=Sitompul`, { Authorization: authHeader('user-1') });
    expect(out.status).toBe(200);
    const candidates = (out.body as { candidates: Array<{ memberId: string; score: number; reasons: string[] }> }).candidates;
    expect(candidates).toHaveLength(1);
    expect(candidates[0]!.memberId).toBe('m1');
    expect(candidates[0]!.reasons).toContain('EXACT_NAME');
  });

  it('200 kandidat kosong bila tidak ada kemiripan', async () => {
    mockGuardAman();
    prismaMock.treeMember.findUnique.mockResolvedValue({ id: 'tm-1', userId: 'user-1', treeId: 'tree-1', role: 'editor' });
    prismaMock.familyMember.findMany.mockResolvedValue([
      { id: 'm2', name: 'Budi Santoso', nickname: null, marga: 'Santoso', birthDate: '1970-01-01', gender: 'M' },
    ]);
    const out = await get(`${PATH}?name=Andi%20Sitompul`, { Authorization: authHeader('user-1') });
    expect(out.status).toBe(200);
    expect((out.body as { candidates: unknown[] }).candidates).toHaveLength(0);
  });
});
