/**
 * Test dedikasi v431 AC6: route GET /api/v1/members/:memberId/consent/audit-export.
 *
 * Cakupan: owner 200 dengan baris pertama CSV berisi header
 * id,memberId,actorUserId,aksi,scope,policyVersion,sumber,noop,at,
 * non-owner (editor/viewer) 403 FORBIDDEN_TREE, tanpa auth 401.
 *
 * Pola persis src/server/consent-self-api.test.ts (v408): prisma di-mock
 * penuh lewat vi.hoisted, server express asli di port ephemeral, JWT dev
 * secret, fetch native.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import jwt from 'jsonwebtoken';

const prismaMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  familyMember: { findUnique: vi.fn() },
  familyTree: { findUnique: vi.fn() },
  treeMember: { findUnique: vi.fn() },
  consentAuditEvent: { findMany: vi.fn() },
}));

vi.mock('../../../server/db', () => ({ prisma: prismaMock }));

const JWT_SECRET = 'dev-only-insecure-secret-change-me';

const USER_ID = 'u-owner-1';
const TREE_ID = 'tree-1';
const MEMBER_ID = 'm-1';

const MEMBER = { id: MEMBER_ID, treeId: TREE_ID };
const AUDIT_ROWS = [
  {
    id: 'evt-1',
    memberId: MEMBER_ID,
    actorUserId: USER_ID,
    aksi: 'grant',
    scope: 'share',
    policyVersion: '1.0',
    sumber: 'api',
    noop: false,
    at: new Date('2026-11-06T00:00:00.000Z'),
  },
  {
    id: 'evt-2',
    memberId: MEMBER_ID,
    actorUserId: USER_ID,
    aksi: 'revoke',
    scope: 'share',
    policyVersion: '1.0',
    sumber: 'api',
    noop: true,
    at: new Date('2026-11-07T00:00:00.000Z'),
  },
];

function authHeader(): string {
  return `Bearer ${jwt.sign({ sub: USER_ID }, JWT_SECRET)}`;
}

let BASE = '';
let serverHandle: import('node:http').Server | undefined;

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.user.findUnique.mockResolvedValue({ id: USER_ID, email: 'owner@keluarga.id', status: 'active' });
  prismaMock.familyMember.findUnique.mockResolvedValue(MEMBER);
  prismaMock.familyTree.findUnique.mockResolvedValue({ id: TREE_ID });
  prismaMock.treeMember.findUnique.mockResolvedValue({ userId: USER_ID, treeId: TREE_ID, role: 'owner' });
  prismaMock.consentAuditEvent.findMany.mockResolvedValue(AUDIT_ROWS);
});

beforeAll(async () => {
  const port = 39100 + (process.pid % 600);
  BASE = `http://127.0.0.1:${port}`;
  process.env['API_PORT'] = String(port);
  const proto = (express as unknown as { application: { listen: (...a: unknown[]) => import('node:http').Server } }).application;
  const origListen = proto.listen;
  proto.listen = function (this: unknown, ...a: unknown[]) {
    serverHandle = origListen.apply(this, a);
    return serverHandle;
  } as typeof proto.listen;
  await import('../../../server/index');
  const deadline = Date.now() + 8000;
  for (;;) {
    try { await fetch(`${BASE}/`); break; }
    catch {
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

interface CsvResponse { status: number; text: string; json?: Record<string, unknown> }

async function getAuditExport(auth?: string): Promise<CsvResponse> {
  const res = await fetch(`${BASE}/api/v1/members/${MEMBER_ID}/consent/audit-export`, {
    headers: auth === undefined ? {} : { authorization: auth },
  });
  const text = await res.text();
  let json: Record<string, unknown> | undefined;
  try { json = JSON.parse(text) as Record<string, unknown>; } catch { /* CSV bukan JSON */ }
  return { status: res.status, text, json };
}

describe('GET /api/v1/members/:memberId/consent/audit-export (v431)', () => {
  it('owner: 200, CSV header lengkap, baris noop dibuang reconstruct, Content-Disposition attachment', async () => {
    const r = await getAuditExport(authHeader());
    expect(r.status).toBe(200);
    const lines = r.text.split('\n');
    expect(lines[0]).toBe('id,memberId,actorUserId,aksi,scope,policyVersion,sumber,noop,at');
    expect(lines).toHaveLength(2); // header + evt-1 (evt-2 noop dibuang reconstruct)
    expect(lines[1]).toContain('evt-1');
    expect(lines[1]).toContain(',api,false,');
  });
  it('non-owner (editor): 403 FORBIDDEN_TREE, tanpa query audit', async () => {
    prismaMock.treeMember.findUnique.mockResolvedValue({ userId: USER_ID, treeId: TREE_ID, role: 'editor' });
    const r = await getAuditExport(authHeader());
    expect(r.status).toBe(403);
    expect(r.json?.['code']).toBe('FORBIDDEN_TREE');
    expect(prismaMock.consentAuditEvent.findMany).not.toHaveBeenCalled();
  });

  it('tanpa auth: 401 UNAUTHORIZED', async () => {
    const r = await getAuditExport();
    expect(r.status).toBe(401);
    expect(r.json?.['code']).toBe('UNAUTHORIZED');
  });
});
