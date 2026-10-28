import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import jwt from 'jsonwebtoken';

const prismaMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  familyTree: { findUnique: vi.fn() },
  treeMember: { findUnique: vi.fn() },
  familyMember: { findMany: vi.fn(() => []) },
  $transaction: vi.fn(async (cb) => cb({
    familyMember: { create: vi.fn(async (d) => ({ id: 'm-new-1', ...d.data })) },
    familyRelationship: { create: vi.fn(async (d) => ({ id: 'r-new-1', ...d.data })) },
  })),
}));

const backupFn = vi.fn(async () => {});
const closeFn = vi.fn();
const dbCtor = vi.fn(function () {
  return { backup: backupFn, close: closeFn };
});

const fsMock = vi.hoisted(() => ({
  existsSync: vi.fn(() => false),
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
  readFileSync: vi.fn(() => JSON.stringify({
    token: 'tok-valid-123',
    snapshotPath: 'data/gedcom-snapshots/tree-1-1000-abcd.db',
    appliedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
    summary: { total: 2, new: 2 },
  })),
  rmSync: vi.fn(),
}));

vi.mock('../../server/db', () => ({ prisma: prismaMock }));
vi.mock('better-sqlite3', () => ({ default: dbCtor }));
vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return { ...actual, default: fsMock, ...fsMock };
});

const JWT_SECRET = 'dev-only-insecure-secret-change-me';

function authHeader(userId: string): string {
  return `Bearer ${jwt.sign({ sub: userId }, JWT_SECRET)}`;
}

const USER_1 = { id: 'user-1', email: 'u1@example.test', status: 'active', role: 'member' };
const TREE = { id: 'tree-1' };

let BASE = '';
let serverHandle: import('node:http').Server | undefined;

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

async function call(
  method: string,
  path: string,
  init: RequestInit = {},
  withAuth = true,
): Promise<ApiResult> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    ...init,
    headers: {
      ...(withAuth ? { authorization: authHeader('user-1') } : {}),
      ...((init.headers as Record<string, string>) ?? {}),
    },
  });
  const text = await res.text();
  let body: Record<string, unknown> = {};
  try {
    body = JSON.parse(text) as Record<string, unknown>;
  } catch {
    body = { raw: text };
  }
  return { status: res.status, body };
}

function mockGuardOwner(): void {
  prismaMock.user.findUnique.mockResolvedValue(USER_1);
  prismaMock.familyTree.findUnique.mockResolvedValue(TREE);
  prismaMock.treeMember.findUnique.mockResolvedValue({
    id: 'tm-1',
    userId: 'user-1',
    treeId: 'tree-1',
    role: 'owner',
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.familyMember.findMany.mockReturnValue([]);
  fsMock.existsSync.mockReturnValue(false);
  mockGuardOwner();
});

const GEDCOM_MINIMAL = [
  '0 HEAD',
  '1 GEDC',
  '2 VERS 7.0',
  '1 CHAR',
  '2 FORM UTF-8',
  '0 @I1@ INDI',
  '1 NAME Budi Santoso',
  '0 @I2@ INDI',
  '1 NAME Siti Aminah',
  '1 SEX F',
  '0 TRLR',
].join('\n');

const enc = (s: string): Uint8Array => new TextEncoder().encode(s);

function multipartOf(
  fileName: string,
  bytes: Uint8Array,
  fieldName = 'file',
): { body: Buffer; contentType: string } {
  const boundary = 'rakaapiboundary4181';
  const head =
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="${fieldName}"; filename="${fileName}"\r\n` +
    `Content-Type: application/octet-stream\r\n\r\n`;
  const tail = `\r\n--${boundary}--\r\n`;
  const headBytes = enc(head);
  const tailBytes = enc(tail);
  const body = Buffer.alloc(headBytes.length + bytes.length + tailBytes.length);
  body.set(headBytes, 0);
  body.set(bytes, headBytes.length);
  body.set(tailBytes, headBytes.length + bytes.length);
  return { body, contentType: `multipart/form-data; boundary=${boundary}` };
}

function upload(body: Buffer, contentType: string): RequestInit {
  return {
    body,
    headers: { 'content-type': contentType },
  };
}

beforeAll(async () => {
  const port = 36900 + (process.pid % 600);
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
      const probe = await fetch(`${BASE}/api/v1/auth/session`, {
        headers: { authorization: authHeader('user-1') },
      });
      if (probe.status === 401 || probe.ok) break;
    } catch {
      /* belum siap */
    }
    if (Date.now() > deadline) throw new Error('server failed to start');
    await new Promise((r) => setTimeout(r, 200));
  }
}, 20000);

afterAll(async () => {
  serverHandle?.close();
});

describe('POST /api/v1/trees/:treeId/gedcom/apply', () => {
  it('(a) apply sukses: mengembalikan 200 dengan summary, applied, undo { token, expiresAt }, dan menulis snapshot/registry', async () => {
    const { body, contentType } = multipartOf('silsilah.ged', enc(GEDCOM_MINIMAL));
    const r = await call('POST', '/api/v1/trees/tree-1/gedcom/apply', upload(body, contentType));
    expect(r.status).toBe(200);
    expect(r.body['summary']).toBeDefined();
    expect(r.body['applied']).toBeDefined();
    const undo = r.body['undo'] as Record<string, unknown>;
    expect(undo).toBeDefined();
    expect(typeof undo['token']).toBe('string');
    expect(typeof undo['expiresAt']).toBe('string');
    expect(fsMock.writeFileSync).toHaveBeenCalled();
    expect(prismaMock.$transaction).toHaveBeenCalled();
  });

  it('(b) apply gagal di tengah transaksi: prisma.$transaction melempar, mengembalikan 500 tanpa stack trace', async () => {
    prismaMock.$transaction.mockRejectedValueOnce(new Error('DB crash'));
    const { body, contentType } = multipartOf('silsilah.ged', enc(GEDCOM_MINIMAL));
    const r = await call('POST', '/api/v1/trees/tree-1/gedcom/apply', upload(body, contentType));
    expect(r.status).toBe(500);
    expect(r.body['code']).toBe('GEDCOM_APPLY_ERROR');
    expect(r.body['stack']).toBeUndefined();
  });
});

describe('POST /api/v1/trees/:treeId/gedcom/undo', () => {
  it('(c) undo sukses: registry valid + token match + belum expired, mengembalikan 200 { restored: true, summary } dan menghapus registry & snapshot', async () => {
    fsMock.existsSync.mockReturnValueOnce(true); // registry ada
    const r = await call('POST', '/api/v1/trees/tree-1/gedcom/undo', {
      body: JSON.stringify({ token: 'tok-valid-123' }),
      headers: { 'content-type': 'application/json' },
    });
    expect(r.status).toBe(200);
    expect(r.body['restored']).toBe(true);
    expect(r.body['summary']).toBeDefined();
    expect(fsMock.rmSync).toHaveBeenCalled();
  });

  it('(d) undo kedua kali: registry sudah terhapus = 404 NO_PENDING_UNDO', async () => {
    fsMock.existsSync.mockReturnValueOnce(false); // registry tidak ada
    const r = await call('POST', '/api/v1/trees/tree-1/gedcom/undo', {
      body: JSON.stringify({ token: 'tok-valid-123' }),
      headers: { 'content-type': 'application/json' },
    });
    expect(r.status).toBe(404);
    expect(r.body['code']).toBe('NO_PENDING_UNDO');
  });

  it('(e) undo non-owner: guardTreeAction return 403, assert 403 FORBIDDEN_TREE', async () => {
    prismaMock.treeMember.findUnique.mockResolvedValueOnce({
      id: 'tm-1',
      userId: 'user-1',
      treeId: 'tree-1',
      role: 'viewer',
    });
    const r = await call('POST', '/api/v1/trees/tree-1/gedcom/undo', {
      body: JSON.stringify({ token: 'tok-valid-123' }),
      headers: { 'content-type': 'application/json' },
    });
    expect(r.status).toBe(403);
    expect(r.body['code']).toBe('FORBIDDEN_TREE');
  });

  it('(f) undo TTL kedaluwarsa: expiresAt di masa lalu, mengembalikan 410 UNDO_EXPIRED', async () => {
    fsMock.existsSync.mockReturnValueOnce(true);
    fsMock.readFileSync.mockReturnValueOnce(JSON.stringify({
      token: 'tok-valid-123',
      snapshotPath: 'data/gedcom-snapshots/tree-1-expired.db',
      appliedAt: '2020-01-01T00:00:00.000Z',
      expiresAt: '2020-01-02T00:00:00.000Z',
      summary: {},
    }));
    const r = await call('POST', '/api/v1/trees/tree-1/gedcom/undo', {
      body: JSON.stringify({ token: 'tok-valid-123' }),
      headers: { 'content-type': 'application/json' },
    });
    expect(r.status).toBe(410);
    expect(r.body['code']).toBe('UNDO_EXPIRED');
  });

  it('(g) undo token mismatch: mengembalikan 403 UNDO_TOKEN_MISMATCH', async () => {
    fsMock.existsSync.mockReturnValueOnce(true);
    fsMock.readFileSync.mockReturnValueOnce(JSON.stringify({
      token: 'tok-valid-123',
      snapshotPath: 'data/gedcom-snapshots/tree-1-valid.db',
      appliedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
      summary: {},
    }));
    const r = await call('POST', '/api/v1/trees/tree-1/gedcom/undo', {
      body: JSON.stringify({ token: 'salah-token' }),
      headers: { 'content-type': 'application/json' },
    });
    expect(r.status).toBe(403);
    expect(r.body['code']).toBe('UNDO_TOKEN_MISMATCH');
  });
});
