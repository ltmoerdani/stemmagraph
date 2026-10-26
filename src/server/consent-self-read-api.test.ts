/**
 * Test dedikasi v409 AC5: route read consent self-service.
 *
 * Cakupan: GET /api/v1/consent/self/members (cocok satu member, kosong,
 * multi member lintas pohon), GET /api/v1/members/:memberId/consent/self
 * (200 replay oldest first, 403 SELF_ONLY, 404 NOT_FOUND, 401 tanpa JWT).
 *
 * Pola persis consent-self-api.test.ts (v408) dan calendar-ics-api.test.ts
 * (v394): prisma di-mock penuh lewat vi.hoisted, server express asli di
 * port ephemeral, JWT dev secret, fetch native.
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
async function getSelfMembers(): Promise<Res> {
  const res = await fetch(`${BASE}/api/v1/consent/self/members`, {
    headers: { authorization: authHeader() },
  });
  return { status: res.status, json: (await res.json()) as Record<string, unknown> };
}
async function getSelfConsent(memberId: string, withAuth = true): Promise<Res> {
  const res = await fetch(`${BASE}/api/v1/members/${memberId}/consent/self`, {
    headers: withAuth ? { authorization: authHeader() } : {},
  });
  return { status: res.status, json: (await res.json()) as Record<string, unknown> };
}

describe('GET /api/v1/consent/self/members (v409 AC1)', () => {
  it('satu member cocok: list berisi memberId, treeName, granted, lastAction', async () => {
    prismaMock.familyMember.findMany.mockResolvedValue([
      { id: MEMBER_ID, treeId: TREE_ID, email: ' Self@Keluarga.id ' },
    ]);
    prismaMock.consentRecord.findMany.mockResolvedValue([
      { id: 'rec-1', memberId: MEMBER_ID, action: 'grant', scope: 'share', note: null, at: new Date('2026-10-01T00:00:00Z') },
      { id: 'rec-2', memberId: MEMBER_ID, action: 'revoke', scope: 'share', note: null, at: new Date('2026-10-02T00:00:00Z') },
    ]);
    const r = await getSelfMembers();
    expect(r.status).toBe(200);
    const members = r.json.members as Array<Record<string, unknown>>;
    expect(members).toHaveLength(1);
    expect(members[0].memberId).toBe(MEMBER_ID);
    expect(members[0].treeName).toBe('Pohon Keluarga');
    expect(members[0].granted).toBe(false);
    expect(members[0].lastAction).toBe('revoke');
  });

  it('email user kosong: members kosong tanpa query member', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: USER_ID, email: null });
    const r = await getSelfMembers();
    expect(r.status).toBe(200);
    expect(r.json.members).toEqual([]);
    expect(prismaMock.familyMember.findMany).not.toHaveBeenCalled();
  });

  it('nihil member cocok: members kosong', async () => {
    prismaMock.familyMember.findMany.mockResolvedValue([
      { id: 'm-lain', treeId: TREE_ID, email: 'orang-lain@keluarga.id' },
    ]);
    const r = await getSelfMembers();
    expect(r.status).toBe(200);
    expect(r.json.members).toEqual([]);
  });

  it('multi member lintas pohon: semua anggota diri tercantum', async () => {
    prismaMock.familyMember.findMany.mockResolvedValue([
      { id: 'm-a', treeId: 'tree-1', email: 'self@keluarga.id' },
      { id: 'm-b', treeId: 'tree-2', email: 'self@keluarga.id' },
    ]);
    prismaMock.familyTree.findUnique
      .mockResolvedValueOnce({ id: 'tree-1', name: 'Pohon Satu' })
      .mockResolvedValueOnce({ id: 'tree-2', name: 'Pohon Dua' });
    const r = await getSelfMembers();
    expect(r.status).toBe(200);
    const members = r.json.members as Array<Record<string, unknown>>;
    expect(members).toHaveLength(2);
    expect(members.map((m) => m.treeName)).toEqual(['Pohon Satu', 'Pohon Dua']);
  });
});

describe('GET /api/v1/members/:memberId/consent/self (v409 AC2)', () => {
  it('self: 200 replay oldest first plus granted', async () => {
    prismaMock.consentRecord.findMany.mockResolvedValue([
      { id: 'rec-1', memberId: MEMBER_ID, action: 'grant', scope: 'share', note: null, at: new Date('2026-10-01T00:00:00Z') },
      { id: 'rec-2', memberId: MEMBER_ID, action: 'revoke', scope: 'share', note: null, at: new Date('2026-10-02T00:00:00Z') },
      { id: 'rec-3', memberId: MEMBER_ID, action: 'regrant', scope: 'share', note: null, at: new Date('2026-10-03T00:00:00Z') },
    ]);
    const r = await getSelfConsent(MEMBER_ID);
    expect(r.status).toBe(200);
    const records = r.json.records as Array<Record<string, unknown>>;
    expect(records).toHaveLength(3);
    expect(records[0].action).toBe('grant');
    expect(records[1].action).toBe('revoke');
    expect(records[2].action).toBe('regrant');
    expect(r.json.granted).toBe(true);
  });

  it('non-self: 403 SELF_ONLY identik tanpa membocorkan member', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: USER_ID, email: 'orang-lain@keluarga.id' });
    const r = await getSelfConsent(MEMBER_ID);
    expect(r.status).toBe(403);
    expect(r.json.code).toBe('SELF_ONLY');
  });

  it('member nihil: 404 NOT_FOUND', async () => {
    prismaMock.familyMember.findUnique.mockResolvedValue(null);
    const r = await getSelfConsent('m-hilang');
    expect(r.status).toBe(404);
    expect(r.json.code).toBe('NOT_FOUND');
  });

  it('tanpa JWT: 401', async () => {
    const r = await getSelfConsent(MEMBER_ID, false);
    expect(r.status).toBe(401);
  });
});
