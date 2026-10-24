/**
 * Test dedikasi route merge anggota v390
 * (POST /api/v1/trees/:treeId/members/:memberId/merge).
 *
 * Pola persis src/server/duplicates-api.test.ts (v388): prisma di-mock
 * penuh lewat vi.hoisted, server express asli dilisten di port ephemeral
 * lalu diakses via fetch native.
 *
 * AC kontrak v390: 401 challenge Bearer, 403 FORBIDDEN_TREE tanpa
 * WWW-Authenticate, 404 tree/member, 422 self / merged / cycle /
 * confirmName salah / target absen, 200 merged true, rollback saat
 * transaksi gagal (diperiksa lewat kontrak kode, prisma $transaction
 * dibalas 500 MERGE_ERROR).
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import jwt from 'jsonwebtoken';

const prismaMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  familyTree: { findUnique: vi.fn() },
  treeMember: { findUnique: vi.fn() },
  familyMember: { findUnique: vi.fn(), update: vi.fn() },
  familyRelationship: { findMany: vi.fn(), update: vi.fn(), delete: vi.fn() },
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

const DUP = {
  id: 'dup-1', treeId: 'tree-1', name: 'Andi', mergedIntoId: null, mergedAt: null,
};
const PRIMARY = {
  id: 'pri-1', treeId: 'tree-1', name: 'Andi', mergedIntoId: null, mergedAt: null,
};

const PATH = '/api/v1/trees/tree-1/members/dup-1/merge';

let BASE = '';
let serverHandle: import('node:http').Server | undefined;

interface PostResult {
  status: number;
  body: Record<string, unknown>;
  wwwAuthenticate: string | null;
}

async function post(path: string, body: unknown, headers: Record<string, string> = {}): Promise<PostResult> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
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

beforeEach(() => {
  vi.clearAllMocks();
});

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

describe('POST /api/v1/trees/:treeId/members/:memberId/merge (v390)', () => {
  it('401 tanpa kredensial dengan challenge Bearer', async () => {
    mockGuardAman();
    const out = await post(PATH, { targetId: 'pri-1', confirmName: 'Andi' });
    expect(out.status).toBe(401);
    expect(out.wwwAuthenticate).toBe('Bearer');
  });

  it('403 bukan anggota tree tanpa WWW-Authenticate', async () => {
    mockGuardAman();
    prismaMock.user.findUnique.mockResolvedValue({ ...USER, role: 'member' });
    const out = await post(PATH, { targetId: 'pri-1', confirmName: 'Andi' }, { Authorization: authHeader('user-1') });
    expect(out.status).toBe(403);
    expect(out.wwwAuthenticate).toBeNull();
    expect(out.body['code']).toBe('FORBIDDEN_TREE');
  });

  it('404 tree tidak ada', async () => {
    mockGuardAman();
    prismaMock.familyTree.findUnique.mockResolvedValue(null);
    const out = await post(PATH, { targetId: 'pri-1', confirmName: 'Andi' }, { Authorization: authHeader('user-1') });
    expect(out.status).toBe(404);
    expect(out.body['code']).toBe('NOT_FOUND');
  });

  it('422 tanpa targetId', async () => {
    mockGuardAman();
    mockAnggotaEditor();
    const out = await post(PATH, { confirmName: 'Andi' }, { Authorization: authHeader('user-1') });
    expect(out.status).toBe(422);
    expect(out.body['code']).toBe('INVALID_TARGET');
  });

  it('422 tanpa confirmName', async () => {
    mockGuardAman();
    mockAnggotaEditor();
    const out = await post(PATH, { targetId: 'pri-1' }, { Authorization: authHeader('user-1') });
    expect(out.status).toBe(422);
    expect(out.body['code']).toBe('INVALID_CONFIRM_NAME');
  });

  it('422 merge ke diri sendiri', async () => {
    mockGuardAman();
    mockAnggotaEditor();
    const out = await post(PATH, { targetId: 'dup-1', confirmName: 'Andi' }, { Authorization: authHeader('user-1') });
    expect(out.status).toBe(422);
    expect(out.body['code']).toBe('MERGE_SELF');
  });

  it('404 duplikat tidak ada di tree', async () => {
    mockGuardAman();
    mockAnggotaEditor();
    prismaMock.familyMember.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(PRIMARY);
    const out = await post(PATH, { targetId: 'pri-1', confirmName: 'Andi' }, { Authorization: authHeader('user-1') });
    expect(out.status).toBe(404);
    expect(out.body['code']).toBe('NOT_FOUND');
  });

  it('404 primary tidak ada di tree', async () => {
    mockGuardAman();
    mockAnggotaEditor();
    prismaMock.familyMember.findUnique
      .mockResolvedValueOnce(DUP)
      .mockResolvedValueOnce(null);
    const out = await post(PATH, { targetId: 'pri-1', confirmName: 'Andi' }, { Authorization: authHeader('user-1') });
    expect(out.status).toBe(404);
    expect(out.body['code']).toBe('NOT_FOUND');
  });

  it('422 confirmName tidak cocok nama primary', async () => {
    mockGuardAman();
    mockAnggotaEditor();
    prismaMock.familyMember.findUnique
      .mockResolvedValueOnce(DUP)
      .mockResolvedValueOnce(PRIMARY);
    const out = await post(PATH, { targetId: 'pri-1', confirmName: 'Andes' }, { Authorization: authHeader('user-1') });
    expect(out.status).toBe(422);
    expect(out.body['code']).toBe('CONFIRM_NAME_MISMATCH');
  });

  it('422 salah satu sudah merged', async () => {
    mockGuardAman();
    mockAnggotaEditor();
    prismaMock.familyMember.findUnique
      .mockResolvedValueOnce(DUP)
      .mockResolvedValueOnce({ ...PRIMARY, mergedIntoId: 'other-1', mergedAt: new Date() });
    const out = await post(PATH, { targetId: 'pri-1', confirmName: 'Andi' }, { Authorization: authHeader('user-1') });
    expect(out.status).toBe(422);
    expect(out.body['code']).toBe('ALREADY_MERGED');
  });

  it('422 merge menciptakan cycle parent-child', async () => {
    mockGuardAman();
    mockAnggotaEditor();
    prismaMock.familyMember.findUnique
      .mockResolvedValueOnce(DUP)
      .mockResolvedValueOnce(PRIMARY);
    prismaMock.familyRelationship.findMany.mockResolvedValue([
      { id: 'r1', memberId: 'pri-1', relatedId: 'dup-1', type: 'parent' },
    ]);
    const out = await post(PATH, { targetId: 'pri-1', confirmName: 'Andi' }, { Authorization: authHeader('user-1') });
    expect(out.status).toBe(422);
    expect(out.body['code']).toBe('MERGE_CYCLE');
  });

  it('200 sukses: transaksi berisi rewire, delete, reassign event, dan penandaan merged', async () => {
    mockGuardAman();
    mockAnggotaEditor();
    prismaMock.familyMember.findUnique
      .mockResolvedValueOnce(DUP)
      .mockResolvedValueOnce(PRIMARY);
    const rels = [
      { id: 'r-w', memberId: 'dup-1', relatedId: 'w-1', type: 'spouse' }, // rewire
      { id: 'r-d', memberId: 'pri-1', relatedId: 'dup-1', type: 'spouse' }, // edge internal
      { id: 'r-x', memberId: 'w-1', relatedId: 'w-2', type: 'parent' }, // hidup
    ];
    prismaMock.familyRelationship.findMany.mockResolvedValue(rels);
    prismaMock.genealogyEvent.findMany.mockResolvedValue([
      { id: 'e-1', memberId: 'dup-1', type: 'BIRT' },
    ]);
    prismaMock.lifeEvent.findMany.mockResolvedValue([
      { id: 'le-1' },
    ]);
    prismaMock.familyRelationship.update.mockResolvedValue({});
    prismaMock.familyRelationship.delete.mockResolvedValue({});
    prismaMock.genealogyEvent.update.mockResolvedValue({});
    prismaMock.lifeEvent.update.mockResolvedValue({});
    prismaMock.familyMember.update.mockResolvedValue({});
    prismaMock.$transaction.mockImplementation(async (ops: unknown[]) => {
      await Promise.all(ops);
      return [];
    });
    const out = await post(PATH, { targetId: 'pri-1', confirmName: 'Andi' }, { Authorization: authHeader('user-1') });
    expect(out.status).toBe(200);
    expect(out.body['merged']).toBe(true);
    expect(out.body['primaryId']).toBe('pri-1');
    // transaksi terpanggil dengan operasi: 1 rewire, 1 delete,
    // 1 genealogy event, 1 life event, 1 penandaan merged.
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    const ops = prismaMock.$transaction.mock.calls[0][0] as unknown[];
    expect(ops).toHaveLength(5);
    expect(prismaMock.familyRelationship.update).toHaveBeenCalledWith({
      where: { id: 'r-w' },
      data: { memberId: 'pri-1' },
    });
    expect(prismaMock.familyRelationship.delete).toHaveBeenCalledWith({ where: { id: 'r-d' } });
    expect(prismaMock.genealogyEvent.update).toHaveBeenCalledWith({
      where: { id: 'e-1' },
      data: { memberId: 'pri-1' },
    });
    expect(prismaMock.lifeEvent.update).toHaveBeenCalledWith({
      where: { id: 'le-1' },
      data: { memberId: 'pri-1' },
    });
    expect(prismaMock.familyMember.update).toHaveBeenCalledWith({
      where: { id: 'dup-1' },
      data: {
        mergedIntoId: 'pri-1',
        mergedAt: expect.any(Date),
        // v391 AC2: jurnal merge ditulis atomik dengan penandaan merged.
        mergeJournal: expect.objectContaining({
          version: 1,
          duplicateId: 'dup-1',
          primary: { id: 'pri-1', name: 'Andi' },
          rewire: [
            expect.objectContaining({ relationId: 'r-w', side: 'memberId', memberId: 'pri-1', relatedId: 'w-1', type: 'spouse' }),
          ],
          deleted: [expect.objectContaining({ id: 'r-d', memberId: 'pri-1', relatedId: 'dup-1', type: 'spouse' })],
          movedGenealogyEventIds: ['e-1'],
          movedLifeEventIds: ['le-1'],
        }),
      },
    });
  });

  it('rewire sisi relatedId menghasilkan update di sisi related', async () => {
    mockGuardAman();
    mockAnggotaEditor();
    prismaMock.familyMember.findUnique
      .mockResolvedValueOnce(DUP)
      .mockResolvedValueOnce(PRIMARY);
    prismaMock.familyRelationship.findMany.mockResolvedValue([
      { id: 'r-c', memberId: 'w-1', relatedId: 'dup-1', type: 'parent' },
    ]);
    prismaMock.genealogyEvent.findMany.mockResolvedValue([]);
    prismaMock.lifeEvent.findMany.mockResolvedValue([]);
    prismaMock.familyRelationship.update.mockResolvedValue({});
    prismaMock.familyMember.update.mockResolvedValue({});
    prismaMock.$transaction.mockImplementation(async (ops: unknown[]) => {
      await Promise.all(ops);
      return [];
    });
    const out = await post(PATH, { targetId: 'pri-1', confirmName: 'Andi' }, { Authorization: authHeader('user-1') });
    expect(out.status).toBe(200);
    const ops = prismaMock.$transaction.mock.calls[0][0] as unknown[];
    expect(ops).toHaveLength(2); // 1 rewire + 1 penandaan merged
    expect(prismaMock.familyRelationship.update).toHaveBeenCalledWith({
      where: { id: 'r-c' },
      data: { relatedId: 'pri-1' },
    });
  });

  it('500 rollback: $transaction gagal dijawab MERGE_ERROR tanpa merged true', async () => {
    mockGuardAman();
    mockAnggotaEditor();
    prismaMock.familyMember.findUnique
      .mockResolvedValueOnce(DUP)
      .mockResolvedValueOnce(PRIMARY);
    prismaMock.familyRelationship.findMany.mockResolvedValue([]);
    prismaMock.genealogyEvent.findMany.mockResolvedValue([]);
    prismaMock.lifeEvent.findMany.mockResolvedValue([]);
    prismaMock.$transaction.mockRejectedValue(new Error('db down'));
    const out = await post(PATH, { targetId: 'pri-1', confirmName: 'Andi' }, { Authorization: authHeader('user-1') });
    expect(out.status).toBe(500);
    expect(out.body['code']).toBe('MERGE_ERROR');
  });
});
