// STG v464 unit 1c (AC4): wiring resolveAfterCharsetGate di route preview
// dan apply. Kasus wajib: byte C1 (rentang 0x80-0x9F) ditolak 400
// GEDCOM_INVALID_CHARSET dengan offset byte, payload bersih lolos gate
// dan import berjalan, BOM U+FEFF di-strip lalu lolos. Pola persis
// gedcom-preview-api.test.ts dan gedcom-apply-api.test.ts: prisma
// di-mock lewat vi.hoisted, server express asli di port ephemeral,
// diakses via fetch native.
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
  readFileSync: vi.fn(() => '{}'),
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

const GEDCOM_BERSIH = [
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

// Kasus C1: U+0093 (rentang C1 0x80-0x9F, kategori c1_control di gate
// unit 1a) disisip di payload NAME. Semua karakter sebelum sisipan
// ASCII, sehingga index codepoint = offset byte yang dilaporkan gate.
const GEDCOM_C1 = GEDCOM_BERSIH.replace(
  '1 NAME Budi Santoso',
  '1 NAME Budi\u0093 Santoso',
);
const OFFSET_C1 = GEDCOM_C1.indexOf('\u0093');

// Kasus BOM: U+FEFF di awal berkas, gate strip saat pemeriksaan lalu lolos.
const GEDCOM_BOM = '\uFEFF' + GEDCOM_BERSIH;

const enc = (s: string): Uint8Array => new TextEncoder().encode(s);

function multipartOf(
  fileName: string,
  bytes: Uint8Array,
  fieldName = 'file',
): { body: Buffer; contentType: string } {
  const boundary = 'rakaapiboundary4641';
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
  const port = 37000 + (process.pid % 600);
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

describe('GEDCOM charset gate wiring (STG v464 unit 1c)', () => {
  it('(a) preview: byte C1 (U+0093) ditolak 400 GEDCOM_INVALID_CHARSET dengan offset byte', async () => {
    const { body, contentType } = multipartOf('c1.ged', enc(GEDCOM_C1));
    const r = await call('POST', '/api/v1/trees/tree-1/gedcom/preview', upload(body, contentType));
    expect(r.status).toBe(400);
    expect(r.body['code']).toBe('GEDCOM_INVALID_CHARSET');
    expect(r.body['offset']).toBe(OFFSET_C1);
    expect(String(r.body['message'])).toContain('0x93');
    expect(String(r.body['message'])).toContain('control C1 0x80-0x9F');
    // Ditolak sebelum parse vendor: tidak ada summary maupun plan.
    expect(r.body['summary']).toBeUndefined();
    expect(r.body['plan']).toBeUndefined();
  });

  it('(b) apply: byte C1 ditolak 400 GEDCOM_INVALID_CHARSET dengan offset byte', async () => {
    const { body, contentType } = multipartOf('c1.ged', enc(GEDCOM_C1));
    const r = await call('POST', '/api/v1/trees/tree-1/gedcom/apply', upload(body, contentType));
    expect(r.status).toBe(400);
    expect(r.body['code']).toBe('GEDCOM_INVALID_CHARSET');
    expect(r.body['offset']).toBe(OFFSET_C1);
    // Ditolak sebelum snapshot dan transaksi: nihil tulis DB maupun file.
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(fsMock.writeFileSync).not.toHaveBeenCalled();
  });

  it('(c) preview: payload bersih lolos gate, import berjalan (plan 2 NEW)', async () => {
    const { body, contentType } = multipartOf('bersih.ged', enc(GEDCOM_BERSIH));
    const r = await call('POST', '/api/v1/trees/tree-1/gedcom/preview', upload(body, contentType));
    expect(r.status).toBe(200);
    expect(r.body['dryRun']).toBe(true);
    const summary = r.body['summary'] as Record<string, unknown>;
    expect(summary['new']).toBe(2);
    const plan = r.body['plan'] as Array<Record<string, unknown>>;
    expect(plan).toHaveLength(2);
    expect(plan.every((e) => e['status'] === 'NEW')).toBe(true);
  });

  it('(d) apply: payload bersih lolos gate, import berjalan (200 dengan applied)', async () => {
    const { body, contentType } = multipartOf('bersih.ged', enc(GEDCOM_BERSIH));
    const r = await call('POST', '/api/v1/trees/tree-1/gedcom/apply', upload(body, contentType));
    expect(r.status).toBe(200);
    expect(r.body['applied']).toBeDefined();
    expect(prismaMock.$transaction).toHaveBeenCalled();
  });

  it('(e) preview: BOM U+FEFF di-strip oleh gate lalu lolos', async () => {
    const { body, contentType } = multipartOf('bom.ged', enc(GEDCOM_BOM));
    const r = await call('POST', '/api/v1/trees/tree-1/gedcom/preview', upload(body, contentType));
    expect(r.status).toBe(200);
    expect(r.body['dryRun']).toBe(true);
    const summary = r.body['summary'] as Record<string, unknown>;
    expect(summary['total']).toBe(2);
  });
});
