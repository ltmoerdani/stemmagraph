/**
 * Test dedikasi v411 AC1: route read riwayat penuh consent self-service.
 *
 * Cakupan: GET /api/v1/members/:memberId/consent/self/events (200 array
 * ledger urut at ascending, 403 SELF_ONLY, 404 NOT_FOUND, 401 tanpa JWT).
 * Pola persis consent-self-read-api.test.ts (v409): prisma di-mock penuh
 * lewat vi.hoisted, server express asli di port ephemeral, JWT dev
 * secret, fetch native.
 *
 * @vitest-environment node
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import jwt from 'jsonwebtoken';

const prismaMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  familyMember: { findUnique: vi.fn(), findMany: vi.fn() },
  familyTree: { findUnique: vi.fn() },
  consentRecord: { findMany: vi.fn() },
}));

vi.mock('../../server/db', () => ({ prisma: prismaMock }));

const JWT_SECRET = 'dev-only-insecure-secret-change-me';

const USER_ID = 'u-self';
const TREE_ID = 'tree-1';
const MEMBER_ID = 'm-self';

function authHeader(): string {
  return `Bearer ${jwt.sign({ sub: USER_ID }, JWT_SECRET)}`;
}

let BASE = '';
let serverHandle: import('node:http').Server | undefined;

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.user.findUnique.mockResolvedValue({ id: USER_ID, email: 'self@keluarga.id', status: 'active' });
  prismaMock.familyMember.findMany.mockResolvedValue([]);
  prismaMock.familyMember.findUnique.mockResolvedValue({
    id: MEMBER_ID,
    treeId: TREE_ID,
    email: 'self@keluarga.id',
    name: 'Anggota Self',
    isAlive: true,
    privacyStatus: null,
  });
  prismaMock.familyTree.findUnique.mockResolvedValue({ id: TREE_ID, name: 'Pohon Keluarga' });
  prismaMock.consentRecord.findMany.mockResolvedValue([]);
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

interface Res { status: number; json: Record<string, unknown> }
async function getSelfEvents(memberId: string, withAuth = true): Promise<Res> {
  const res = await fetch(`${BASE}/api/v1/members/${memberId}/consent/self/events`, {
    headers: withAuth ? { authorization: authHeader() } : {},
  });
  return { status: res.status, json: (await res.json()) as Record<string, unknown> };
}

describe('GET /api/v1/members/:memberId/consent/self/events (v411 AC1)', () => {
  it('200 array records urut at ascending dengan bentuk baris ledger', async () => {
    prismaMock.consentRecord.findMany.mockImplementation(async (args: { where: { memberId: string }; orderBy: { at: string } }) => {
      expect(args.where.memberId).toBe(MEMBER_ID);
      expect(args.orderBy.at).toBe('asc');
      return [
        { id: 'rec-a', memberId: MEMBER_ID, action: 'grant', scope: 'share', note: null, at: new Date('2026-10-01T00:00:00Z') },
        { id: 'rec-b', memberId: MEMBER_ID, action: 'revoke', scope: 'share', note: null, at: new Date('2026-10-02T00:00:00Z') },
        { id: 'rec-c', memberId: MEMBER_ID, action: 'regrant', scope: 'export', note: 'izin foto', at: new Date('2026-10-03T00:00:00Z') },
      ];
    });
    const r = await getSelfEvents(MEMBER_ID);
    expect(r.status).toBe(200);
    const rows = r.json.records as Array<Record<string, unknown>>;
    expect(rows).toHaveLength(3);
    expect(rows.map((x) => x.action)).toEqual(['grant', 'revoke', 'regrant']);
    expect(rows[2].note).toBe('izin foto');
    for (const row of rows) {
      expect(typeof row.id).toBe('string');
      expect(typeof row.scope).toBe('string');
      expect(typeof row.at).toBe('string');
    }
  });

  it('403 SELF_ONLY bukan subjek data, identik semua alasan', async () => {
    prismaMock.familyMember.findUnique.mockResolvedValue({
      id: 'm-lain',
      treeId: TREE_ID,
      email: 'lain@keluarga.id',
      name: 'Anggota Lain',
      isAlive: true,
      privacyStatus: null,
    });
    const r = await getSelfEvents('m-lain');
    expect(r.status).toBe(403);
    expect(r.json.code).toBe('SELF_ONLY');
    expect(prismaMock.consentRecord.findMany).not.toHaveBeenCalled();
  });

  it('404 NOT_FOUND member tidak ada', async () => {
    prismaMock.familyMember.findUnique.mockResolvedValue(null);
    const r = await getSelfEvents('m-hilang');
    expect(r.status).toBe(404);
    expect(r.json.code).toBe('NOT_FOUND');
  });

  it('401 tanpa JWT', async () => {
    const r = await getSelfEvents(MEMBER_ID, false);
    expect(r.status).toBe(401);
  });
});
