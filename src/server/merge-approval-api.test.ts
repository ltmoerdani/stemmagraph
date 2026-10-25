/**
 * Test dedikasi route merge approval v392 AC8b
 * (POST /api/v1/trees/:treeId/merge-approvals/:approvalId/approve|reject)
 * plus sisi 202/ALLOW pada route merge.
 *
 * Pola persis src/server/unmerge-api.test.ts (v391) dan
 * src/server/merge-api.test.ts (v390): prisma di-mock penuh lewat
 * vi.hoisted, server express asli dilisten di port ephemeral lalu
 * diakses via fetch native. Port digeser ke 38900 supaya tidak
 * berbenturan dengan dua file test server lain saat paralel.
 *
 * Kasus: merge kecil ALLOW eksekusi langsung tanpa baris MergeApproval,
 * NEEDS_APPROVAL 202 + PENDING tanpa perubahan anggota, approve sukses
 * eksekusi merge + jurnal + EXECUTED + deciderId, self-approval 422,
 * viewer 403, approval tree lain 404, ALREADY_DECIDED 422, EXPIRED 422
 * dengan status berganti EXPIRED, PLAN_MISMATCH 422, reject REJECTED
 * tanpa eksekusi apa pun.
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
  mergeApproval: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock('../../server/db', () => ({ prisma: prismaMock }));

const JWT_SECRET = 'dev-only-insecure-secret-change-me';

function authHeader(userId: string): string {
  return `Bearer ${jwt.sign({ sub: userId }, JWT_SECRET)}`;
}

const USER_1 = { id: 'user-1', email: 'u1@example.test', status: 'active', role: 'member' };
const USER_2 = { id: 'user-2', email: 'u2@example.test', status: 'active', role: 'member' };
const TREE = { id: 'tree-1' };

const DUP = {
  id: 'dup-1', treeId: 'tree-1', name: 'Andi', mergedIntoId: null, mergedAt: null,
};
const PRIMARY = {
  id: 'pri-1', treeId: 'tree-1', name: 'Andi', mergedIntoId: null, mergedAt: null,
};

const EXPIRES_AHEAD = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
const EXPIRES_BEHIND = new Date(Date.now() - 60 * 1000);

/** Baris approval PENDING dengan planStats yang cocok dengan fixture rels. */
function approvalBaru(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'apr-1',
    treeId: 'tree-1',
    primaryId: 'pri-1',
    duplicateId: 'dup-1',
    reasons: [{ code: 'RELATION_DELETE', actual: 1, threshold: 1 }],
    planStats: { rewireCount: 1, deleteCount: 1, factsCount: 0, generationsConnected: false },
    status: 'PENDING',
    requesterId: 'user-1',
    deciderId: null,
    decidedAt: null,
    createdAt: new Date(),
    expiresAt: EXPIRES_AHEAD,
    ...overrides,
  };
}

/** Fixture rels untuk approve: 1 rewire + 1 edge internal (delete). */
const RELS_APPROVAL = [
  { id: 'r-w', memberId: 'dup-1', relatedId: 'w-1', type: 'spouse' },
  { id: 'r-d', memberId: 'pri-1', relatedId: 'dup-1', type: 'spouse' },
];

function mockApproveBahan(): void {
  prismaMock.familyMember.findUnique
    .mockResolvedValueOnce(DUP)
    .mockResolvedValueOnce(PRIMARY);
  prismaMock.familyRelationship.findMany.mockResolvedValue(RELS_APPROVAL);
  prismaMock.genealogyEvent.findMany.mockResolvedValue([]);
  prismaMock.lifeEvent.findMany.mockResolvedValue([]);
  prismaMock.familyRelationship.update.mockResolvedValue({});
  prismaMock.familyRelationship.delete.mockResolvedValue({});
  prismaMock.familyMember.update.mockResolvedValue({});
  prismaMock.mergeApproval.update.mockResolvedValue({ id: 'apr-1', status: 'EXECUTED', deciderId: 'user-2', decidedAt: new Date() });
  prismaMock.$transaction.mockImplementation(async (ops: unknown[]) => {
    await Promise.all(ops);
    return [];
  });
}

const APPROVE_PATH = '/api/v1/trees/tree-1/merge-approvals/apr-1/approve';
const REJECT_PATH = '/api/v1/trees/tree-1/merge-approvals/apr-1/reject';
const MERGE_PATH = '/api/v1/trees/tree-1/members/dup-1/merge';

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

/** Guard lolos: tree ada, caller pemilik keputusan ber-role editor. */
function mockGuardDecider(): void {
  prismaMock.user.findUnique.mockResolvedValue(USER_2);
  prismaMock.familyTree.findUnique.mockResolvedValue(TREE);
  prismaMock.treeMember.findUnique.mockResolvedValue({ id: 'tm-2', userId: 'user-2', treeId: 'tree-1', role: 'editor' });
}

/** Guard lolos untuk pemohon merge (user-1, editor). */
function mockGuardRequester(): void {
  prismaMock.user.findUnique.mockResolvedValue(USER_1);
  prismaMock.familyTree.findUnique.mockResolvedValue(TREE);
  prismaMock.treeMember.findUnique.mockResolvedValue({ id: 'tm-1', userId: 'user-1', treeId: 'tree-1', role: 'editor' });
}

beforeEach(() => {
  vi.clearAllMocks();
});

beforeAll(async () => {
  const port = 38900 + (process.pid % 600);
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

describe('route merge sisi approval (v392)', () => {
  it('merge kecil ALLOW: 200 merged true tanpa baris MergeApproval', async () => {
    mockGuardRequester();
    prismaMock.familyMember.findUnique
      .mockResolvedValueOnce(DUP)
      .mockResolvedValueOnce(PRIMARY);
    // satu rewire saja, tanpa delete, tanpa facts, tanpa koneksi generasi.
    prismaMock.familyRelationship.findMany.mockResolvedValue([
      { id: 'r-w', memberId: 'dup-1', relatedId: 'w-1', type: 'spouse' },
    ]);
    prismaMock.genealogyEvent.findMany.mockResolvedValue([]);
    prismaMock.lifeEvent.findMany.mockResolvedValue([]);
    prismaMock.familyRelationship.update.mockResolvedValue({});
    prismaMock.familyMember.update.mockResolvedValue({});
    prismaMock.$transaction.mockImplementation(async (ops: unknown[]) => {
      await Promise.all(ops);
      return [];
    });
    const out = await post(MERGE_PATH, { targetId: 'pri-1', confirmName: 'Andi' }, { Authorization: authHeader('user-1') });
    expect(out.status).toBe(200);
    expect(out.body['merged']).toBe(true);
    expect(prismaMock.mergeApproval.create).not.toHaveBeenCalled();
    const ops = prismaMock.$transaction.mock.calls[0][0] as unknown[];
    expect(ops).toHaveLength(2); // 1 rewire + penandaan merged
  });

  it('NEEDS_APPROVAL: 202 PENDING dengan baris PENDING, nihil perubahan anggota', async () => {
    mockGuardRequester();
    prismaMock.familyMember.findUnique
      .mockResolvedValueOnce(DUP)
      .mockResolvedValueOnce(PRIMARY);
    // edge internal primary<->duplicate: delete 1 >= threshold 1, berisiko.
    prismaMock.familyRelationship.findMany.mockResolvedValue(RELS_APPROVAL);
    prismaMock.genealogyEvent.findMany.mockResolvedValue([]);
    prismaMock.lifeEvent.findMany.mockResolvedValue([]);
    prismaMock.mergeApproval.create.mockResolvedValue({ id: 'apr-9' });
    const out = await post(MERGE_PATH, { targetId: 'pri-1', confirmName: 'Andi' }, { Authorization: authHeader('user-1') });
    expect(out.status).toBe(202);
    expect(out.body['status']).toBe('PENDING');
    expect(out.body['approvalId']).toBe('apr-9');
    expect(prismaMock.mergeApproval.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.mergeApproval.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        treeId: 'tree-1',
        primaryId: 'pri-1',
        duplicateId: 'dup-1',
        status: 'PENDING',
        requesterId: 'user-1',
        expiresAt: expect.any(Date),
      }),
    });
    // tidak ada eksekusi: anggota tidak ditandai merged, transaksi kosong.
    expect(prismaMock.familyMember.update).not.toHaveBeenCalled();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });
});

describe('POST merge-approvals/:id/approve dan /reject (v392)', () => {
  it('401 tanpa kredensial dengan challenge Bearer', async () => {
    mockGuardDecider();
    const out = await post(APPROVE_PATH, {});
    expect(out.status).toBe(401);
    expect(out.wwwAuthenticate).toBe('Bearer');
  });

  it('403 role viewer tidak bisa memutuskan', async () => {
    prismaMock.user.findUnique.mockResolvedValue(USER_2);
    prismaMock.familyTree.findUnique.mockResolvedValue(TREE);
    prismaMock.treeMember.findUnique.mockResolvedValue({ id: 'tm-3', userId: 'user-2', treeId: 'tree-1', role: 'viewer' });
    const out = await post(APPROVE_PATH, {}, { Authorization: authHeader('user-2') });
    expect(out.status).toBe(403);
    expect(out.body['code']).toBe('FORBIDDEN_TREE');
    expect(prismaMock.mergeApproval.findUnique).not.toHaveBeenCalled();
  });

  it('404 approval milik tree lain', async () => {
    mockGuardDecider();
    prismaMock.mergeApproval.findUnique.mockResolvedValue(approvalBaru({ treeId: 'tree-9' }));
    const out = await post(APPROVE_PATH, {}, { Authorization: authHeader('user-2') });
    expect(out.status).toBe(404);
    expect(out.body['code']).toBe('NOT_FOUND');
  });

  it('422 CANNOT_APPROVE_OWN_REQUEST: requester memutuskan requestnya sendiri', async () => {
    mockGuardRequester();
    prismaMock.mergeApproval.findUnique.mockResolvedValue(approvalBaru());
    const out = await post(APPROVE_PATH, {}, { Authorization: authHeader('user-1') });
    expect(out.status).toBe(422);
    expect(out.body['code']).toBe('CANNOT_APPROVE_OWN_REQUEST');
  });

  it('422 ALREADY_DECIDED untuk approval yang sudah diputuskan', async () => {
    mockGuardDecider();
    prismaMock.mergeApproval.findUnique.mockResolvedValue(approvalBaru({ status: 'APPROVED', deciderId: 'user-3' }));
    const out = await post(APPROVE_PATH, {}, { Authorization: authHeader('user-2') });
    expect(out.status).toBe(422);
    expect(out.body['code']).toBe('ALREADY_DECIDED');
  });

  it('422 EXPIRED dan status baris menjadi EXPIRED', async () => {
    mockGuardDecider();
    prismaMock.mergeApproval.findUnique.mockResolvedValue(approvalBaru({ expiresAt: EXPIRES_BEHIND }));
    prismaMock.mergeApproval.update.mockResolvedValue({});
    const out = await post(APPROVE_PATH, {}, { Authorization: authHeader('user-2') });
    expect(out.status).toBe(422);
    expect(out.body['code']).toBe('EXPIRED');
    expect(prismaMock.mergeApproval.update).toHaveBeenCalledWith({
      where: { id: 'apr-1' },
      data: { status: 'EXPIRED' },
    });
  });

  it('422 PLAN_MISMATCH saat data bergeser dari planStats tersimpan', async () => {
    mockGuardDecider();
    prismaMock.mergeApproval.findUnique.mockResolvedValue(
      approvalBaru({ planStats: { rewireCount: 5, deleteCount: 1, factsCount: 0, generationsConnected: false } }),
    );
    mockApproveBahan();
    const out = await post(APPROVE_PATH, {}, { Authorization: authHeader('user-2') });
    expect(out.status).toBe(422);
    expect(out.body['code']).toBe('PLAN_MISMATCH');
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('approve sukses: merge tereksekusi, jurnal tertulis, status EXECUTED dengan deciderId', async () => {
    mockGuardDecider();
    prismaMock.mergeApproval.findUnique.mockResolvedValue(approvalBaru());
    mockApproveBahan();
    const out = await post(APPROVE_PATH, {}, { Authorization: authHeader('user-2') });
    expect(out.status).toBe(200);
    expect(out.body['status']).toBe('EXECUTED');
    expect(out.body['deciderId']).toBe('user-2');
    expect(out.body['primaryId']).toBe('pri-1');
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    const ops = prismaMock.$transaction.mock.calls[0][0] as unknown[];
    // 1 rewire + 1 delete + 0 event + 0 lifeEvent + penandaan merged + status EXECUTED.
    expect(ops).toHaveLength(4);
    expect(prismaMock.familyRelationship.update).toHaveBeenCalledWith({
      where: { id: 'r-w' },
      data: { memberId: 'pri-1' },
    });
    expect(prismaMock.familyRelationship.delete).toHaveBeenCalledWith({ where: { id: 'r-d' } });
    expect(prismaMock.familyMember.update).toHaveBeenCalledWith({
      where: { id: 'dup-1' },
      data: {
        mergedIntoId: 'pri-1',
        mergedAt: expect.any(Date),
        mergeJournal: expect.objectContaining({
          version: 1,
          duplicateId: 'dup-1',
          primary: { id: 'pri-1', name: 'Andi' },
          deleted: [expect.objectContaining({ id: 'r-d' })],
          movedGenealogyEventIds: [],
          movedLifeEventIds: [],
        }),
      },
    });
    expect(prismaMock.mergeApproval.update).toHaveBeenCalledWith({
      where: { id: 'apr-1' },
      data: { status: 'EXECUTED', deciderId: 'user-2', decidedAt: expect.any(Date) },
    });
  });

  it('reject: status REJECTED dengan deciderId, nihil eksekusi', async () => {
    mockGuardDecider();
    prismaMock.mergeApproval.findUnique.mockResolvedValue(approvalBaru());
    prismaMock.mergeApproval.update.mockResolvedValue({ id: 'apr-1', status: 'REJECTED', deciderId: 'user-2', decidedAt: new Date() });
    const out = await post(REJECT_PATH, {}, { Authorization: authHeader('user-2') });
    expect(out.status).toBe(200);
    expect(out.body['status']).toBe('REJECTED');
    expect(out.body['deciderId']).toBe('user-2');
    expect(prismaMock.mergeApproval.update).toHaveBeenCalledWith({
      where: { id: 'apr-1' },
      data: { status: 'REJECTED', deciderId: 'user-2', decidedAt: expect.any(Date) },
    });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(prismaMock.familyMember.update).not.toHaveBeenCalled();
  });
});
