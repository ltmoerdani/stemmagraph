/**
 * Test route create share link (S-05b): POST /api/v1/trees/:treeId/share-links.
 *
 * Pola persis src/server/members-search-api.test.ts (v401): prisma di-mock
 * penuh lewat vi.hoisted supaya server/index.ts bisa diimpor tanpa
 * DATABASE_URL dan tanpa generated prisma client. Server express asli
 * dilisten di port ephemeral lalu diakses via fetch native.
 *
 * AC S-05b: 201 mode public tanpa hash, 201 mode password dengan hash
 * bcrypt (bukan plaintext) dan token base64url penuh, 400 mode asing,
 * 400 password di bawah batas, 401 tanpa auth, 403 non-owner.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import express from 'express';
import jwt from 'jsonwebtoken';
import { verifySharePassword } from '../../src/lib/share/password';

const prismaMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  familyTree: { findUnique: vi.fn() },
  treeMember: { findUnique: vi.fn() },
  treeShareLink: { create: vi.fn() },
}));

vi.mock('../../server/db', () => ({ prisma: prismaMock }));

const JWT_SECRET = 'dev-only-insecure-secret-change-me';

function authHeader(userId: string): string {
  return 'Bearer ' + jwt.sign({ sub: userId }, JWT_SECRET);
}

const USER = { id: 'user-1', email: 'u@example.test', status: 'active', role: 'owner' };
const TREE = { id: 'tree-1' };

const PATH = '/api/v1/trees/tree-1/share-links';

let BASE = '';
let serverHandle: import('node:http').Server | undefined;

interface PostResult {
  status: number;
  body: Record<string, unknown>;
}

async function post(path: string, payload: unknown, withAuth = true): Promise<PostResult> {
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(withAuth ? { Authorization: authHeader('user-1') } : {}),
    },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  return {
    status: res.status,
    body: text.length === 0 ? {} : (JSON.parse(text) as Record<string, unknown>),
  };
}

/** mock guard lolos sebagai owner lewat membership pohon. */
function mockGuardOwner(): void {
  prismaMock.user.findUnique.mockResolvedValue(USER);
  prismaMock.familyTree.findUnique.mockResolvedValue(TREE);
  prismaMock.treeMember.findUnique.mockResolvedValue({ id: 'tm-1', userId: 'user-1', treeId: 'tree-1', role: 'owner' });
}

/** mock guard untuk role viewer: lolos tree, ditolak matrix aksi. */
function mockGuardViewer(): void {
  prismaMock.user.findUnique.mockResolvedValue(USER);
  prismaMock.familyTree.findUnique.mockResolvedValue(TREE);
  prismaMock.treeMember.findUnique.mockResolvedValue({ id: 'tm-1', userId: 'user-1', treeId: 'tree-1', role: 'viewer' });
}

function rowFromArgs(): Record<string, unknown> {
  const calls = prismaMock.treeShareLink.create.mock.calls;
  const last = calls[calls.length - 1] as Array<{ data: Record<string, unknown> }>;
  const data = last[0].data;
  return {
    id: 'slink-1',
    treeId: data['treeId'],
    token: data['token'],
    mode: data['mode'],
    passwordHash: data['passwordHash'],
    revokedAt: null,
    lastUsedAt: null,
    createdAt: new Date('2026-10-30T08:00:00.000Z'),
  };
}

beforeAll(async () => {
  const port = 39900 + (process.pid % 600);
  BASE = 'http://127.0.0.1:' + String(port);
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

describe('POST /api/v1/trees/:treeId/share-links (S-05b)', () => {
  it('201 mode public: tanpa hash, token penuh sekali, bentuk respons lengkap', async () => {
    mockGuardOwner();
    prismaMock.treeShareLink.create.mockImplementation(async () => rowFromArgs());
    const out = await post(PATH, { mode: 'public' });
    expect(out.status).toBe(201);
    const calls = prismaMock.treeShareLink.create.mock.calls;
    const data = (calls[calls.length - 1] as Array<{ data: Record<string, unknown> }>)[0].data;
    expect(data['mode']).toBe('public');
    expect(data['passwordHash']).toBeNull();
    expect(data['treeId']).toBe('tree-1');
    const token = out.body['token'] as string;
    expect(typeof token).toBe('string');
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(token.length).toBeGreaterThanOrEqual(40);
    expect(out.body['tokenMasked']).not.toBe(token);
    expect(out.body['state']).toBe('active');
    expect(out.body['id']).toBe('slink-1');
    expect(out.body['treeId']).toBe('tree-1');
    expect(out.body['mode']).toBe('public');
    expect(out.body['createdAt']).toBe('2026-10-30T08:00:00.000Z');
  });

  it('201 mode password: hash tersimpan bukan plaintext dan terverifikasi, token base64url', async () => {
    mockGuardOwner();
    prismaMock.treeShareLink.create.mockImplementation(async () => rowFromArgs());
    const plain = 'rahasia-ku-2026';
    const out = await post(PATH, { mode: 'password', password: plain });
    expect(out.status).toBe(201);
    const calls = prismaMock.treeShareLink.create.mock.calls;
    const data = (calls[calls.length - 1] as Array<{ data: Record<string, unknown> }>)[0].data;
    const hash = data['passwordHash'] as string;
    expect(typeof hash).toBe('string');
    expect(hash).not.toBe(plain);
    expect(hash.startsWith('$2')).toBe(true);
    expect(await verifySharePassword(plain, hash)).toBe(true);
    expect(data['mode']).toBe('password');
    const token = out.body['token'] as string;
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(token.length).toBeGreaterThanOrEqual(40);
    expect(out.body['state']).toBe('active');
  });

  it('201 mode public mengabaikan field password yang menyusup', async () => {
    mockGuardOwner();
    prismaMock.treeShareLink.create.mockImplementation(async () => rowFromArgs());
    const out = await post(PATH, { mode: 'public', password: 'stray-pass-123' });
    expect(out.status).toBe(201);
    const calls = prismaMock.treeShareLink.create.mock.calls;
    const data = (calls[calls.length - 1] as Array<{ data: Record<string, unknown> }>)[0].data;
    expect(data['passwordHash']).toBeNull();
  });

  it('400 mode selain public password: VALIDATION_ERROR, tanpa create', async () => {
    mockGuardOwner();
    const before = prismaMock.treeShareLink.create.mock.calls.length;
    const out = await post(PATH, { mode: 'link' });
    expect(out.status).toBe(400);
    expect((out.body as { code?: string }).code).toBe('VALIDATION_ERROR');
    expect(prismaMock.treeShareLink.create.mock.calls.length).toBe(before);
  });

  it('400 mode password tanpa password dan password pendek: VALIDATION_ERROR', async () => {
    mockGuardOwner();
    const noPassword = await post(PATH, { mode: 'password' });
    expect(noPassword.status).toBe(400);
    expect((noPassword.body as { code?: string }).code).toBe('VALIDATION_ERROR');
    const short = await post(PATH, { mode: 'password', password: 'pendek' });
    expect(short.status).toBe(400);
    expect((short.body as { code?: string }).code).toBe('VALIDATION_ERROR');
    const before = prismaMock.treeShareLink.create.mock.calls.length;
    expect(prismaMock.treeShareLink.create.mock.calls.length).toBe(before);
  });

  it('401 tanpa auth header', async () => {
    mockGuardOwner();
    const out = await post(PATH, { mode: 'public' }, false);
    expect(out.status).toBe(401);
    expect((out.body as { code?: string }).code).toBe('UNAUTHORIZED');
  });

  it('403 non-owner: FORBIDDEN_TREE, tanpa create', async () => {
    mockGuardViewer();
    const before = prismaMock.treeShareLink.create.mock.calls.length;
    const out = await post(PATH, { mode: 'public' });
    expect(out.status).toBe(403);
    expect((out.body as { code?: string }).code).toBe('FORBIDDEN_TREE');
    expect(prismaMock.treeShareLink.create.mock.calls.length).toBe(before);
  });
});
