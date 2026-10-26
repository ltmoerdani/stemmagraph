/**
 * Test API relationship-based privacy v412 fase 1
 * (GET /api/v1/trees/:treeId/relationships).
 *
 * Pola persis src/server/duplicates-api.test.ts (v388): prisma di-mock
 * penuh lewat vi.hoisted supaya server/index.ts bisa diimpor tanpa
 * DATABASE_URL dan tanpa generated prisma client. Server express asli
 * dilisten di port ephemeral lalu diakses via fetch native.
 *
 * AC kontrak v412: 401 tanpa auth, 404 tree tidak ada, 403 bukan
 * anggota, owner dan editor menerima daftar penuh tanpa filter,
 * viewer menerima 200 daftar tereduksi tanpa busur yang menyentuh
 * member hidden baginya dan tanpa indikator jumlah asli
 * (anti-enumerasi), regresi kesesuaian keputusan single GET vs list
 * untuk viewer sama.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import express from 'express';
import jwt from 'jsonwebtoken';

const prismaMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  familyTree: { findUnique: vi.fn() },
  treeMember: { findUnique: vi.fn() },
  familyMember: { findUnique: vi.fn(), findMany: vi.fn() },
  familyRelationship: { findMany: vi.fn() },
}));

vi.mock('../../server/db', () => ({ prisma: prismaMock }));

const JWT_SECRET = 'dev-only-insecure-secret-change-me';

function authHeader(userId: string): string {
  return 'Bearer ' + jwt.sign({ sub: userId }, JWT_SECRET);
}

const USER = { id: 'user-2', email: 'v@example.test', status: 'active', role: 'member' };
const TREE = { id: 'tree-1' };

const PATH = '/api/v1/trees/tree-1/relationships';

// mv = viewer (self, full); mb = pasangan viewer living private
// (name-only); md = meninggal (full); ma = living shared (full);
// mh1 dan mh2 = living tanpa busur langsung ke viewer (hidden).
const MEMBERS = [
  { name: 'Viewer Sendiri', id: 'mv', treeId: 'tree-1', email: 'v@example.test', isAlive: true, privacyStatus: 'private' },
  { name: 'Pasangan Viewer', id: 'mb', treeId: 'tree-1', email: null, isAlive: true, privacyStatus: null },
  { name: 'Datuk Meninggal', id: 'md', treeId: 'tree-1', email: null, isAlive: false, privacyStatus: null },
  { name: 'Anak Shared', id: 'ma', treeId: 'tree-1', email: null, isAlive: true, privacyStatus: 'shared' },
  { name: 'Kerbau Hidden Satu', id: 'mh1', treeId: 'tree-1', email: null, isAlive: true, privacyStatus: null },
  { name: 'Kerbau Hidden Dua', id: 'mh2', treeId: 'tree-1', email: null, isAlive: true, privacyStatus: null },
];

const RELS = [
  { id: 'r1', treeId: 'tree-1', memberId: 'mv', relatedId: 'mb', type: 'spouse' },
  { id: 'r2', treeId: 'tree-1', memberId: 'md', relatedId: 'mv', type: 'parent' },
  { id: 'r3', treeId: 'tree-1', memberId: 'mv', relatedId: 'ma', type: 'child' },
  { id: 'r4', treeId: 'tree-1', memberId: 'mh1', relatedId: 'mh2', type: 'parent' },
  { id: 'r5', treeId: 'tree-1', memberId: 'mh1', relatedId: 'md', type: 'parent' },
  { id: 'r6', treeId: 'tree-1', memberId: 'mh2', relatedId: 'ma', type: 'sibling' },
];

let BASE = '';
let serverHandle: import('node:http').Server | undefined;

interface GetResult {
  status: number;
  body: Record<string, unknown> | unknown[];
  wwwAuthenticate: string | null;
}

async function get(path: string, headers: Record<string, string> = {}): Promise<GetResult> {
  const res = await fetch(BASE + path, { headers });
  const text = await res.text();
  return {
    status: res.status,
    body: text.length === 0 ? {} : (JSON.parse(text) as Record<string, unknown>),
    wwwAuthenticate: res.headers.get('www-authenticate'),
  };
}

function mockGuard(role: string | null): void {
  prismaMock.user.findUnique.mockResolvedValue(USER);
  prismaMock.familyTree.findUnique.mockResolvedValue(TREE);
  prismaMock.treeMember.findUnique.mockResolvedValue(
    role === null ? null : { id: 'tm-1', userId: 'user-2', treeId: 'tree-1', role },
  );
}

function mockTreeData(): void {
  prismaMock.familyRelationship.findMany.mockResolvedValue(RELS);
  prismaMock.familyMember.findMany.mockResolvedValue(MEMBERS);
}

beforeAll(async () => {
  const port = 39600 + (process.pid % 600);
  BASE = 'http://127.0.0.1:' + String(port);
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
      await fetch(BASE + '/');
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

describe('GET /api/v1/trees/:treeId/relationships (v412 fase 1)', () => {
  it('401 tanpa kredensial', async () => {
    mockGuard('viewer');
    mockTreeData();
    const out = await get(PATH);
    expect(out.status).toBe(401);
    expect((out.body as { code?: string }).code).toBe('UNAUTHORIZED');
  });

  it('404 tree tidak ada', async () => {
    mockGuard('viewer');
    prismaMock.familyTree.findUnique.mockResolvedValue(null);
    const out = await get(PATH, { Authorization: authHeader('user-2') });
    expect(out.status).toBe(404);
    expect((out.body as { code?: string }).code).toBe('NOT_FOUND');
  });

  it('403 bukan anggota tree', async () => {
    mockGuard(null);
    mockTreeData();
    const out = await get(PATH, { Authorization: authHeader('user-2') });
    expect(out.status).toBe(403);
    expect((out.body as { code?: string }).code).toBe('FORBIDDEN_TREE');
  });

  it('owner menerima daftar penuh tanpa filter', async () => {
    mockGuard('owner');
    mockTreeData();
    const out = await get(PATH, { Authorization: authHeader('user-2') });
    expect(out.status).toBe(200);
    const ids = (out.body as Array<{ id: string }>).map((r) => r.id);
    expect(ids).toEqual(['r1', 'r2', 'r3', 'r4', 'r5', 'r6']);
  });

  it('editor menerima daftar penuh tanpa filter', async () => {
    mockGuard('editor');
    mockTreeData();
    const out = await get(PATH, { Authorization: authHeader('user-2') });
    expect(out.status).toBe(200);
    const ids = (out.body as Array<{ id: string }>).map((r) => r.id);
    expect(ids).toEqual(['r1', 'r2', 'r3', 'r4', 'r5', 'r6']);
  });

  it('viewer menerima 200 daftar tereduksi tanpa busur yang menyentuh member hidden baginya', async () => {
    mockGuard('viewer');
    mockTreeData();
    const out = await get(PATH, { Authorization: authHeader('user-2') });
    expect(out.status).toBe(200);
    const rows = out.body as Array<{ id: string; memberId: string; relatedId: string }>;
    // Hanya busur antar ujung yang terlihat: r1 (self ke name-only),
    // r2 (name-only ke deceased full), r3 (self ke shared full).
    expect(rows.map((r) => r.id)).toEqual(['r1', 'r2', 'r3']);
    const touched = rows.filter(
      (r) => r.memberId === 'mh1' || r.relatedId === 'mh1' || r.memberId === 'mh2' || r.relatedId === 'mh2',
    );
    expect(touched).toEqual([]);
  });

  it('regresi: keputusan single GET selaras list untuk viewer sama', async () => {
    mockGuard('viewer');
    mockTreeData();
    const listOut = await get(PATH, { Authorization: authHeader('user-2') });
    expect(listOut.status).toBe(200);
    const rows = listOut.body as Array<{ memberId: string; relatedId: string }>;

    // mh1 hidden bagi viewer: single GET 404 bentuk identik member nihil,
    // list tidak memuat satu pun busur yang menyentuh mh1.
    prismaMock.familyMember.findUnique.mockResolvedValue(MEMBERS[4]);
    const hiddenOut = await get('/api/v1/members/mh1', { Authorization: authHeader('user-2') });
    expect(hiddenOut.status).toBe(404);
    expect((hiddenOut.body as { code?: string }).code).toBe('NOT_FOUND');
    expect(rows.some((r) => r.memberId === 'mh1' || r.relatedId === 'mh1')).toBe(false);

    // mb name-only bagi viewer (pasangan, living, private): single GET
    // 200 bentuk name-only, list memuat busur yang menghubungkannya.
    prismaMock.familyMember.findUnique.mockResolvedValue(MEMBERS[1]);
    const nameOnlyOut = await get('/api/v1/members/mb', { Authorization: authHeader('user-2') });
    expect(nameOnlyOut.status).toBe(200);
    expect(nameOnlyOut.body).toMatchObject({ id: 'mb', name: expect.any(String) });
    expect((nameOnlyOut.body as Record<string, unknown>)).not.toHaveProperty('email');
    expect(rows.some((r) => r.memberId === 'mb' || r.relatedId === 'mb')).toBe(true);
  });
});
