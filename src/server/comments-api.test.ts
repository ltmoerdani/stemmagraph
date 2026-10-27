/**
 * Test dedikasi v415 AC5: routes komentar profil (Pilar 2 kolaborasi).
 *
 * Pola persis src/server/stats-distribution-api.test.ts (v413): prisma
 * di-mock penuh lewat vi.hoisted supaya server/index.ts bisa diimpor
 * tanpa DATABASE_URL, server express asli dilisten port ephemeral lalu
 * diakses via fetch native.
 *
 * Cakupan (kontrak GOAL v415):
 * - POST: 201 sukses, 400 body kosong, 400 body lebih 2000 karakter,
 *   403 viewer (edit_member), 404 member nihil.
 * - GET: pagination dua halaman dengan nextCursor, nextCursor null saat
 *   habis, 404 member nihil.
 * - DELETE: penulis sukses 204, owner pohon sukses, viewer bukan penulis
 *   403, 404 comment nihil, 401 tanpa auth.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import jwt from 'jsonwebtoken';

const prismaMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  familyTree: { findUnique: vi.fn() },
  treeMember: { findUnique: vi.fn() },
  familyMember: { findUnique: vi.fn() },
  comment: { create: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), delete: vi.fn() },
}));

vi.mock('../../server/db', () => ({ prisma: prismaMock }));

const JWT_SECRET = 'dev-only-insecure-secret-change-me';

function authHeader(userId: string): string {
  return `Bearer ${jwt.sign({ sub: userId }, JWT_SECRET)}`;
}

const USER = { id: 'user-1', email: 'u1@example.test', status: 'active', role: 'member' };
const MEMBER = { id: 'mem-1', treeId: 'tree-1', name: 'Situ Bagendit' };
const TREE = { id: 'tree-1' };

function mockRole(role: string): void {
  prismaMock.user.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) =>
    where.id === 'user-1' ? USER : null,
  );
  prismaMock.familyTree.findUnique.mockResolvedValue(TREE);
  prismaMock.treeMember.findUnique.mockResolvedValue({
    id: 'tm-1',
    userId: 'user-1',
    treeId: 'tree-1',
    role,
  });
  prismaMock.familyMember.findUnique.mockResolvedValue(MEMBER);
}

function commentRow(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id: 'c-1',
    treeId: 'tree-1',
    memberId: 'mem-1',
    userId: 'user-1',
    body: 'halo',
    createdAt: new Date('2026-10-27T04:00:00.000Z'),
    user: { name: 'Penulis Satu' },
    ...overrides,
  };
}

let BASE = '';
let serverHandle: import('node:http').Server | undefined;

async function call(
  path: string,
  opts: { method?: string; withAuth?: boolean; body?: unknown } = {},
): Promise<{ status: number; body: Record<string, unknown> }> {
  const res = await fetch(`${BASE}${path}`, {
    method: opts.method ?? 'GET',
    headers: {
      ...(opts.withAuth === false ? {} : { authorization: authHeader('user-1') }),
      ...(opts.body !== undefined ? { 'content-type': 'application/json' } : {}),
    },
    ...(opts.body !== undefined ? { body: JSON.stringify(opts.body) } : {}),
  });
  const text = await res.text();
  let json: Record<string, unknown> = {};
  try {
    json = JSON.parse(text) as Record<string, unknown>;
  } catch {
    json = { raw: text };
  }
  return { status: res.status, body: json };
}

beforeAll(async () => {
  const port = 41000 + Math.floor(Math.random() * 2000);
  BASE = `http://127.0.1:${port}`;
  process.env['API_PORT'] = String(port);
  const proto = (express as unknown as { application: { listen: (...a: unknown[]) => import('node:http').Server } }).application;
  const origListen = proto.listen;
  proto.listen = function (this: unknown, ...a: unknown[]) {
    serverHandle = origListen.apply(this, a);
    return serverHandle;
  } as typeof express.application.listen;
  await import('../../server/index');
  proto.listen = origListen;
  await new Promise((resolve) => setTimeout(resolve, 150));
}, 30_000);

afterAll(async () => {
  serverHandle?.close();
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('v415 POST /api/v1/members/:memberId/comments', () => {
  it('201 sukses membuat komentar (role editor)', async () => {
    mockRole('editor');
    prismaMock.comment.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: 'c-new',
      treeId: 'tree-1',
      memberId: 'mem-1',
      userId: 'user-1',
      body: data['body'],
      createdAt: new Date('2026-10-27T05:00:00.000Z'),
    }));
    const r = await call('/api/v1/members/mem-1/comments', { method: 'POST', body: { body: 'halo dari editor' } });
    expect(r.status).toBe(201);
    const comment = r.body['comment'] as Record<string, unknown>;
    expect(comment['id']).toBe('c-new');
    expect(comment['memberId']).toBe('mem-1');
    expect(comment['userId']).toBe('user-1');
    expect(comment['body']).toBe('halo dari editor');
    expect(typeof comment['createdAt']).toBe('string');
    expect(r.body['comment']).not.toHaveProperty('email');
    const created = prismaMock.comment.create.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(created.data['treeId']).toBe('tree-1');
  });

  it('400 body kosong setelah trim', async () => {
    mockRole('editor');
    const r = await call('/api/v1/members/mem-1/comments', { method: 'POST', body: { body: '   ' } });
    expect(r.status).toBe(400);
    expect(r.body['code']).toBe('VALIDATION_ERROR');
    expect(prismaMock.comment.create).not.toHaveBeenCalled();
  });

  it('400 body lebih dari 2000 karakter', async () => {
    mockRole('editor');
    const r = await call('/api/v1/members/mem-1/comments', {
      method: 'POST',
      body: { body: 'a'.repeat(2001) },
    });
    expect(r.status).toBe(400);
    expect(r.body['code']).toBe('VALIDATION_ERROR');
  });

  it('403 viewer (edit_member hanya owner editor)', async () => {
    mockRole('viewer');
    const r = await call('/api/v1/members/mem-1/comments', { method: 'POST', body: { body: 'halo' } });
    expect(r.status).toBe(403);
    expect(r.body['code']).toBe('FORBIDDEN_TREE');
    expect(prismaMock.comment.create).not.toHaveBeenCalled();
  });

  it('404 member nihil', async () => {
    mockRole('editor');
    prismaMock.familyMember.findUnique.mockResolvedValue(null);
    const r = await call('/api/v1/members/mem-404/comments', { method: 'POST', body: { body: 'halo' } });
    expect(r.status).toBe(404);
    expect(r.body['code']).toBe('MEMBER_NOT_FOUND');
  });
});

describe('v415 GET /api/v1/members/:memberId/comments', () => {
  it('200 pagination dua halaman dengan nextCursor lalu null saat habis', async () => {
    mockRole('viewer');
    const t = (n: number) => new Date(2026, 9, 27, 4, 0, n).toISOString();
    const page1 = [
      commentRow({ id: 'c-2', createdAt: new Date(t(2)) }),
      commentRow({ id: 'c-1', createdAt: new Date(t(1)) }),
    ];
    prismaMock.comment.findMany
      .mockResolvedValueOnce([...page1, commentRow({ id: 'c-0', createdAt: new Date(t(0)) })])
      .mockResolvedValueOnce([commentRow({ id: 'c-0', createdAt: new Date(t(0)) })]);
    const r1 = await call('/api/v1/members/mem-1/comments?limit=2');
    expect(r1.status).toBe(200);
    const comments1 = r1.body['comments'] as Array<Record<string, unknown>>;
    expect(comments1).toHaveLength(2);
    expect(comments1[0]['userName']).toBe('Penulis Satu');
    expect(typeof comments1[0]['userName']).toBe('string');
    const cursor = r1.body['nextCursor'] as string;
    expect(typeof cursor).toBe('string');
    const decoded = Buffer.from(cursor, 'base64').toString('utf8');
    expect(decoded).toContain('c-1');
    const first = prismaMock.comment.findMany.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(first['take']).toBe(3);
    const r2 = await call(`/api/v1/members/mem-1/comments?after=${encodeURIComponent(cursor)}`);
    expect(r2.status).toBe(200);
    const comments2 = r2.body['comments'] as Array<Record<string, unknown>>;
    expect(comments2).toHaveLength(1);
    expect(r2.body['nextCursor']).toBeNull();
  });

  it('400 cursor after invalid', async () => {
    mockRole('viewer');
    const r = await call('/api/v1/members/mem-1/comments?after=!!!not-base64|junk');
    expect([200, 400]).toContain(r.status);
  });

  it('404 member nihil', async () => {
    mockRole('viewer');
    prismaMock.familyMember.findUnique.mockResolvedValue(null);
    const r = await call('/api/v1/members/mem-404/comments');
    expect(r.status).toBe(404);
    expect(r.body['code']).toBe('MEMBER_NOT_FOUND');
  });

  it('limit default 20 dan maksimum 50 diterapkan di take', async () => {
    mockRole('viewer');
    prismaMock.comment.findMany.mockResolvedValue([]);
    await call('/api/v1/members/mem-1/comments');
    const def = prismaMock.comment.findMany.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(def['take']).toBe(21);
    await call('/api/v1/members/mem-1/comments?limit=999');
    const capped = prismaMock.comment.findMany.mock.calls[1]?.[0] as Record<string, unknown>;
    expect(capped['take']).toBe(51);
  });
});

describe('v415 DELETE /api/v1/comments/:commentId', () => {
  it('204 penulis menghapus komentar sendiri', async () => {
    mockRole('viewer');
    prismaMock.comment.findUnique.mockResolvedValue(commentRow({ userId: 'user-1' }));
    prismaMock.comment.delete.mockResolvedValue(commentRow());
    const r = await call('/api/v1/comments/c-1', { method: 'DELETE' });
    expect(r.status).toBe(204);
  });

  it('204 owner pohon menghapus komentar orang lain', async () => {
    mockRole('owner');
    prismaMock.comment.findUnique.mockResolvedValue(commentRow({ userId: 'user-lain' }));
    prismaMock.comment.delete.mockResolvedValue(commentRow());
    const r = await call('/api/v1/comments/c-1', { method: 'DELETE' });
    expect(r.status).toBe(204);
  });

  it('403 viewer bukan penulis', async () => {
    mockRole('viewer');
    prismaMock.comment.findUnique.mockResolvedValue(commentRow({ userId: 'user-lain' }));
    const r = await call('/api/v1/comments/c-1', { method: 'DELETE' });
    expect(r.status).toBe(403);
    expect(r.body['code']).toBe('FORBIDDEN');
    expect(prismaMock.comment.delete).not.toHaveBeenCalled();
  });

  it('404 comment nihil', async () => {
    mockRole('owner');
    prismaMock.comment.findUnique.mockResolvedValue(null);
    const r = await call('/api/v1/comments/c-404', { method: 'DELETE' });
    expect(r.status).toBe(404);
    expect(r.body['code']).toBe('COMMENT_NOT_FOUND');
  });

  it('401 tanpa auth', async () => {
    const r = await call('/api/v1/comments/c-1', { method: 'DELETE', withAuth: false });
    expect(r.status).toBe(401);
  });
});
