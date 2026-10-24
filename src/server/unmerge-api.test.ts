/**
 * Test dedikasi route un-merge anggota v391
 * (POST /api/v1/trees/:treeId/members/:memberId/unmerge).
 *
 * Pola persis src/server/merge-api.test.ts (v390): prisma di-mock penuh
 * lewat vi.hoisted, server express asli dilisten di port ephemeral lalu
 * diakses via fetch native.
 *
 * AC kontrak v391 (AC7): 401 challenge Bearer, 403 FORBIDDEN_TREE tanpa
 * WWW-Authenticate, 404 member, 422 belum merged / tanpa jurnal
 * (pra-v391) / primary merged / jurnal state mismatch, 200 unmerged
 * true dengan eksekusi ops balik lengkap dalam satu transaksi.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import jwt from 'jsonwebtoken';

const prismaMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  familyTree: { findUnique: vi.fn() },
  treeMember: { findUnique: vi.fn() },
  familyMember: { findUnique: vi.fn(), update: vi.fn() },
  familyRelationship: { findMany: vi.fn(), update: vi.fn(), delete: vi.fn(), create: vi.fn() },
  genealogyEvent: { findMany: vi.fn(), update: vi.fn() },
  lifeEvent: { findMany: vi.fn(), update: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock('../../server/db', () => ({ prisma: prismaMock }));

const JWT_SECRET = 'dev-only-insecure-secret-change-me';

function authHeader(userId: string): string {
  return `Bearer ${jwt.sign({ sub: userId }, JWT_SECRET)}`;
}

const USER = { id: 'user-1', email: 'u@example.test', status: 'active', role: 'owner' };
const TREE = { id: 'tree-1' };

const JURNAL = {
  version: 1,
  mergedAt: '2026-10-25T00:00:00.000Z',
  duplicateId: 'dup-1',
  primary: { id: 'pri-1', name: 'Andi' },
  rewire: [{ relationId: 'r-w', side: 'relatedId', memberId: 'w-1', relatedId: 'pri-1', type: 'spouse' }],
  deleted: [{ id: 'r-d', treeId: 'tree-1', memberId: 'pri-1', relatedId: 'dup-1', type: 'parent' }],
  movedGenealogyEventIds: ['e-1'],
  movedLifeEventIds: ['le-1'],
};

const DUP_MERGED = {
  id: 'dup-1', treeId: 'tree-1', name: 'Andi',
  mergedIntoId: 'pri-1', mergedAt: new Date('2026-10-25T00:00:00.000Z'), mergeJournal: JURNAL,
};
const PRIMARY_BEKAS = {
  id: 'pri-1', treeId: 'tree-1', name: 'Andi', mergedIntoId: null, mergedAt: null, mergeJournal: null,
};

const RELS = [
  { id: 'r-w', memberId: 'w-1', relatedId: 'pri-1', type: 'spouse' },
];

const PATH = '/api/v1/trees/tree-1/members/dup-1/unmerge';

let BASE = '';
let serverHandle: import('node:http').Server | undefined;

interface PostResult {
  status: number;
  body: Record<string, unknown>;
  wwwAuthenticate: string | null;
}

async function post(path: string, headers: Record<string, string> = {}): Promise<PostResult> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: '{}',
  });
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

function mockAnggotaEditor(): void {
  prismaMock.treeMember.findUnique.mockResolvedValue({ id: 'tm-1', userId: 'user-1', treeId: 'tree-1', role: 'editor' });
}

function mockUnmergeBahagia(): void {
  mockAnggotaEditor();
  prismaMock.familyMember.findUnique
    .mockResolvedValueOnce(DUP_MERGED)
    .mockResolvedValueOnce(PRIMARY_BEKAS);
  prismaMock.familyRelationship.findMany.mockResolvedValue(RELS);
  prismaMock.genealogyEvent.findMany.mockResolvedValue([{ id: 'e-1' }]);
  prismaMock.lifeEvent.findMany.mockResolvedValue([{ id: 'le-1' }]);
  prismaMock.$transaction.mockResolvedValue([]);
}

beforeEach(() => {
  vi.clearAllMocks();
});

beforeAll(async () => {
  const port = 39900 + (process.pid % 600);
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

describe('POST /api/v1/trees/:treeId/members/:memberId/unmerge (v391)', () => {
  it('401 tanpa kredensial dengan challenge Bearer', async () => {
    mockGuardAman();
    const out = await post(PATH);
    expect(out.status).toBe(401);
    expect(out.wwwAuthenticate).toBe('Bearer');
  });

  it('403 bukan anggota tree tanpa WWW-Authenticate', async () => {
    mockGuardAman();
    prismaMock.user.findUnique.mockResolvedValue({ ...USER, role: 'member' });
    const out = await post(PATH, { Authorization: authHeader('user-1') });
    expect(out.status).toBe(403);
    expect(out.wwwAuthenticate).toBeNull();
    expect(out.body['code']).toBe('FORBIDDEN_TREE');
  });

  it('404 member tidak ada di tree', async () => {
    mockGuardAman();
    prismaMock.familyMember.findUnique.mockResolvedValue(null);
    const out = await post(PATH, { Authorization: authHeader('user-1') });
    expect(out.status).toBe(404);
    expect(out.body['code']).toBe('NOT_FOUND');
  });

  it('422 member belum merged', async () => {
    mockGuardAman();
    prismaMock.familyMember.findUnique.mockResolvedValue({ ...DUP_MERGED, mergedIntoId: null, mergedAt: null, mergeJournal: null });
    const out = await post(PATH, { Authorization: authHeader('user-1') });
    expect(out.status).toBe(422);
    expect(out.body['code']).toBe('NOT_MERGED');
  });

  it('422 merge pra-v391 tanpa jurnal, pesan jelas', async () => {
    mockGuardAman();
    prismaMock.familyMember.findUnique.mockResolvedValue({ ...DUP_MERGED, mergeJournal: null });
    const out = await post(PATH, { Authorization: authHeader('user-1') });
    expect(out.status).toBe(422);
    expect(out.body['code']).toBe('NO_MERGE_JOURNAL');
    expect(String(out.body['message'])).toContain('cannot be undone');
  });

  it('422 primary sendiri sudah merged ke pihak lain', async () => {
    mockGuardAman();
    prismaMock.familyMember.findUnique
      .mockResolvedValueOnce(DUP_MERGED)
      .mockResolvedValueOnce({ ...PRIMARY_BEKAS, mergedIntoId: 'other-1' });
    const out = await post(PATH, { Authorization: authHeader('user-1') });
    expect(out.status).toBe(422);
    expect(out.body['code']).toBe('PRIMARY_MERGED');
  });

  it('422 jurnal mismatch saat state sudah berubah (relasi hilang)', async () => {
    mockGuardAman();
    prismaMock.familyMember.findUnique
      .mockResolvedValueOnce(DUP_MERGED)
      .mockResolvedValueOnce(PRIMARY_BEKAS);
    prismaMock.familyRelationship.findMany.mockResolvedValue([]);
    prismaMock.genealogyEvent.findMany.mockResolvedValue([{ id: 'e-1' }]);
    prismaMock.lifeEvent.findMany.mockResolvedValue([{ id: 'le-1' }]);
    const out = await post(PATH, { Authorization: authHeader('user-1') });
    expect(out.status).toBe(422);
    expect(out.body['code']).toBe('JOURNAL_MISMATCH');
  });

  it('200 unmerged true: satu transaksi membalik rewire, recreate relasi terhapus, pindah facts balik, bersihkan kolom audit', async () => {
    mockGuardAman();
    mockUnmergeBahagia();
    const out = await post(PATH, { Authorization: authHeader('user-1') });
    expect(out.status).toBe(200);
    expect(out.body).toEqual({ unmerged: true, duplicateId: 'dup-1' });
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    const ops = prismaMock.$transaction.mock.calls[0]![0] as Array<ReturnType<typeof vi.fn>>;
    // 5 operasi balik: rewire r-w balik ke dup, recreate r-d, e-1 balik, le-1 balik, clearMerge.
    expect(ops).toHaveLength(5);
    expect(prismaMock.familyRelationship.update).toHaveBeenCalledWith({ where: { id: 'r-w' }, data: { relatedId: 'dup-1' } });
    expect(prismaMock.familyRelationship.create).toHaveBeenCalledWith({
      data: { id: 'r-d', treeId: 'tree-1', memberId: 'pri-1', relatedId: 'dup-1', type: 'parent' },
    });
    expect(prismaMock.genealogyEvent.update).toHaveBeenCalledWith({ where: { id: 'e-1' }, data: { memberId: 'dup-1' } });
    expect(prismaMock.lifeEvent.update).toHaveBeenCalledWith({ where: { id: 'le-1' }, data: { memberId: 'dup-1' } });
    expect(prismaMock.familyMember.update).toHaveBeenCalledWith({
      where: { id: 'dup-1' },
      data: { mergedIntoId: null, mergedAt: null, mergeJournal: null },
    });
  });
});
