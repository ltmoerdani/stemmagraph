// Test API v417 fase 1 (AC4): route POST /api/v1/trees/:treeId/gedcom/preview.
//
// Pola persis src/server/photo-api.test.ts (v398): prisma di-mock penuh
// lewat vi.hoisted, server express asli dilisten port ephemeral lalu
// diakses via fetch native. Seluruh cakupan AC4: 401 tanpa auth, 403
// non-owner, 404 tree nihil, upload .ged valid (plan NEW semua di tree
// kosong), upload .gdz valid, file rusak 400, ukuran lebih 413.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import jwt from 'jsonwebtoken';
import { zipSync } from 'fflate';

const prismaMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  familyTree: { findUnique: vi.fn() },
  treeMember: { findUnique: vi.fn() },
  familyMember: { findMany: vi.fn(() => []) },
}));

vi.mock('../../server/db', () => ({ prisma: prismaMock }));

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

/** Guard owner tree: tree ada, caller role owner (manage_membership lolos). */
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

/** Builder multipart minimal per RFC 2045, deterministik untuk test. */
function multipartOf(
  fileName: string,
  bytes: Uint8Array,
  fieldName = 'file',
): { body: Buffer; contentType: string } {
  const boundary = 'rakaapiboundary4171';
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
  const port = 36800 + (process.pid % 600);
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

describe('POST /api/v1/trees/:treeId/gedcom/preview', () => {
  it('401 tanpa Authorization', async () => {
    const { body, contentType } = multipartOf('s.ged', enc(GEDCOM_MINIMAL));
    const r = await call('POST', '/api/v1/trees/tree-1/gedcom/preview', upload(body, contentType), false);
    expect(r.status).toBe(401);
    expect(r.body['code']).toBe('UNAUTHORIZED');
  });

  it('404 tree nihil', async () => {
    prismaMock.familyTree.findUnique.mockResolvedValue(null);
    const { body, contentType } = multipartOf('s.ged', enc(GEDCOM_MINIMAL));
    const r = await call('POST', '/api/v1/trees/tree-1/gedcom/preview', upload(body, contentType));
    expect(r.status).toBe(404);
    expect(r.body['code']).toBe('NOT_FOUND');
  });

  it('403 non-owner FORBIDDEN_TREE', async () => {
    prismaMock.treeMember.findUnique.mockResolvedValue({
      id: 'tm-1',
      userId: 'user-1',
      treeId: 'tree-1',
      role: 'viewer',
    });
    const { body, contentType } = multipartOf('s.ged', enc(GEDCOM_MINIMAL));
    const r = await call('POST', '/api/v1/trees/tree-1/gedcom/preview', upload(body, contentType));
    expect(r.status).toBe(403);
    expect(r.body['code']).toBe('FORBIDDEN_TREE');
  });

  it('400 bukan multipart', async () => {
    const r = await call('POST', '/api/v1/trees/tree-1/gedcom/preview', {
      body: JSON.stringify({}),
      headers: { 'content-type': 'application/json' },
    });
    expect(r.status).toBe(400);
    expect(r.body['code']).toBe('GEDCOM_BAD_REQUEST');
  });

  it('400 tanpa part file', async () => {
    const boundary = 'rakaapiboundary4171';
    const raw = `--${boundary}\r\nContent-Disposition: form-data; name="catatan"\r\n\r\nhalo\r\n--${boundary}--\r\n`;
    const r = await call(
      'POST',
      '/api/v1/trees/tree-1/gedcom/preview',
      upload(Buffer.from(raw, 'utf8'), `multipart/form-data; boundary=${boundary}`),
    );
    expect(r.status).toBe(400);
    expect(r.body['code']).toBe('GEDCOM_NO_FILE');
  });

  it('400 ekstensi bukan .ged/.gdz', async () => {
    const { body, contentType } = multipartOf('dokumen.txt', enc(GEDCOM_MINIMAL));
    const r = await call('POST', '/api/v1/trees/tree-1/gedcom/preview', upload(body, contentType));
    expect(r.status).toBe(400);
    expect(r.body['code']).toBe('GEDCOM_BAD_EXTENSION');
  });

  it('413 ukuran melebihi 10 MB', async () => {
    const besar = new Uint8Array(10 * 1024 * 1024 + 1);
    const { body, contentType } = multipartOf('besar.ged', besar);
    const r = await call('POST', '/api/v1/trees/tree-1/gedcom/preview', upload(body, contentType));
    expect(r.status).toBe(413);
    expect(r.body['code']).toBe('GEDCOM_TOO_LARGE');
  });

  it('400 isi bukan GEDCOM (tanpa HEAD)', async () => {
    const { body, contentType } = multipartOf('sampah.ged', enc('teks biasa tanpa struktur'));
    const r = await call('POST', '/api/v1/trees/tree-1/gedcom/preview', upload(body, contentType));
    expect(r.status).toBe(400);
    expect(r.body['code']).toBe('GEDCOM_MALFORMED');
  });

  it('400 arsip zip tanpa entry gedcom (GEDZIP tidak sah)', async () => {
    const zip = zipSync({ 'catatan.txt': enc('bukan gedcom') });
    const { body, contentType } = multipartOf('arsip.gdz', zip);
    const r = await call('POST', '/api/v1/trees/tree-1/gedcom/preview', upload(body, contentType));
    expect(r.status).toBe(400);
    expect(r.body['code']).toBe('GEDCOM_INVALID_ARCHIVE');
  });

  it('200 upload .ged valid di tree kosong: plan semua NEW tanpa tulis DB', async () => {
    const { body, contentType } = multipartOf('silsilah.ged', enc(GEDCOM_MINIMAL));
    const r = await call('POST', '/api/v1/trees/tree-1/gedcom/preview', upload(body, contentType));
    expect(r.status).toBe(200);
    expect(r.body['dryRun']).toBe(true);
    expect(r.body['uploadKind']).toBe('gedcom');
    const summary = r.body['summary'] as Record<string, unknown>;
    expect(summary).toEqual({
      total: 2,
      new: 2,
      matchCandidate: 0,
      skipped: 0,
      // Baris 4 (1 CHAR) belum ada di tabel struktur v7 terpasang, jadi
      // gate melaporkan tepat satu reject unknown_structure untuk dokumen
      // minimal ini. Preview tetap sah.
      gateRejectCount: 1,
      livingAffected: 2,
    });
    const rejects = r.body['gateRejects'] as Array<Record<string, unknown>>;
    expect(rejects).toHaveLength(1);
    expect(rejects[0]?.['line']).toBe(4);
    expect(rejects[0]?.['reason']).toBe('unknown_structure');
    const plan = r.body['plan'] as Array<Record<string, unknown>>;
    expect(plan).toHaveLength(2);
    expect(plan.every((e) => e['status'] === 'NEW')).toBe(true);
    expect(plan.map((e) => e['newInternalId'])).toEqual(['@M1@', '@M2@']);
    // Dry-run: hanya baca (findMany indeks existing), nihil pemanggilan write.
    expect(prismaMock.familyMember.findMany).toHaveBeenCalledTimes(1);
  });

  it('200 upload .gdz valid (gedzip berisi gedcom.ged)', async () => {
    const zip = zipSync({ 'gedcom.ged': enc(GEDCOM_MINIMAL) });
    const { body, contentType } = multipartOf('arsip.gdz', zip);
    const r = await call('POST', '/api/v1/trees/tree-1/gedcom/preview', upload(body, contentType));
    expect(r.status).toBe(200);
    expect(r.body['uploadKind']).toBe('gedzip');
    const summary = r.body['summary'] as Record<string, unknown>;
    expect(summary['total']).toBe(2);
  });

  it('200 gate reject dilaporkan per baris tanpa menggagalkan preview', async () => {
    const rusak = GEDCOM_MINIMAL.replace('1 SEX F', '1 BOGUSTAG X');
    const { body, contentType } = multipartOf('s.ged', enc(rusak));
    const r = await call('POST', '/api/v1/trees/tree-1/gedcom/preview', upload(body, contentType));
    expect(r.status).toBe(200);
    const summary = r.body['summary'] as Record<string, unknown>;
    // Dua reject sesuai urutan parse: baris 4 (CHAR, bawaan dokumen
    // minimal) dan baris 10 (BOGUSTAG pengganti SEX). Preview tetap 200.
    expect(Number(summary['gateRejectCount'])).toBe(2);
    const rejects = r.body['gateRejects'] as Array<Record<string, unknown>>;
    expect(rejects.map((x) => x['line'])).toEqual([4, 10]);
    expect(rejects[1]?.['reason']).toBe('unknown_structure');
  });
});
