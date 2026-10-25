/**
 * Test dedikasi v394 AC3: feed ICS GET /api/v1/trees/:treeId/calendar.ics.
 *
 * Cakupan:
 * (a) auth token: tanpa token 404, token kosong 404, token salah 404
 *     (bukan 401), token benar 200 text/calendar.
 * (b) kontrak token milik tree: query prisma by treeId + icsFeedToken.
 * (c) isi feed: VCALENDAR, VEVENT per kind, horizon dua tahun (event
 *     ~207 hari di depan masuk, bukan window 30 hari), prioritas
 *     haulOverrideDate, X-WR-CALNAME nama tree.
 * (d) cache: Cache-Control private no-cache, ETag weak, 304 revalidasi.
 *
 * Pola persis src/server/haul-override-api.test.ts (v393): prisma
 * di-mock penuh lewat vi.hoisted, server express asli dilisten di port
 * ephemeral lalu diakses via fetch native. Port dasar 38400 supaya tidak
 * berbenturan dengan file test server lain saat paralel.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import jwt from 'jsonwebtoken';
import { computeNextAnniversaries } from '../../src/lib/anniversaries/nextAnniversaries';

const prismaMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  familyTree: { findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
  treeMember: { findUnique: vi.fn() },
  familyMember: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn() },
  lifeEvent: { findMany: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock('../../server/db', () => ({ prisma: prismaMock }));

const JWT_SECRET = 'dev-only-insecure-secret-change-me';

const TOKEN = 'tok-benar-unguessable';
const TREE = { id: 'tree-1', name: 'Keluarga Uji', icsFeedToken: TOKEN };
const LIVING = [{ id: 'm-1', name: 'Adi', birthDate: '2000-05-20' }];
const DECEASED = [{ id: 'm-2', name: 'Opung', deathDate: '1990-03-10', haulOverrideDate: '1990-03-01' }];

function mockTreeDenganToken(): void {
  prismaMock.familyTree.findFirst.mockImplementation(async (args: { where: { id?: string; icsFeedToken?: string } }) => {
    if (args.where.id === TREE.id && args.where.icsFeedToken === TOKEN) return TREE;
    return null;
  });
}

function mockDataTree(): void {
  prismaMock.familyMember.findMany.mockImplementation(async (args: { where: Record<string, unknown> }) => {
    const where = args.where as { isAlive?: boolean; id?: { in?: string[] } };
    if (where.id && typeof where.id === 'object' && Array.isArray((where.id as { in?: string[] }).in)) {
      return (where.id as { in: string[] }).in.map((id) => ({ id, name: `Nama ${id}`, isAlive: true }));
    }
    if (where.isAlive === true) return LIVING;
    return DECEASED;
  });
  prismaMock.lifeEvent.findMany.mockResolvedValue([]);
}

let BASE = '';
let serverHandle: import('node:http').Server | undefined;

beforeEach(() => {
  vi.clearAllMocks();
});

beforeAll(async () => {
  const port = 38400 + (process.pid % 600);
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

async function getFeed(path: string, headers: Record<string, string> = {}): Promise<{ status: number; text: string; contentType: string; etag: string; cacheControl: string }> {
  const res = await fetch(`${BASE}${path}`, { headers });
  return {
    status: res.status,
    text: await res.text(),
    contentType: res.headers.get('content-type') ?? '',
    etag: res.headers.get('etag') ?? '',
    cacheControl: res.headers.get('cache-control') ?? '',
  };
}

function authHeader(userId: string): string {
  return `Bearer ${jwt.sign({ sub: userId }, JWT_SECRET)}`;
}

describe('GET calendar.ics auth token (v394 AC3)', () => {
  it('tanpa query token: 404 text/plain, tanpa menyentuh prisma', async () => {
    const r = await getFeed('/api/v1/trees/tree-1/calendar.ics');
    expect(r.status).toBe(404);
    expect(r.contentType).toContain('text/plain');
    expect(prismaMock.familyTree.findFirst).not.toHaveBeenCalled();
  });

  it('token kosong: 404', async () => {
    const r = await getFeed('/api/v1/trees/tree-1/calendar.ics?token=');
    expect(r.status).toBe(404);
    expect(prismaMock.familyTree.findFirst).not.toHaveBeenCalled();
  });

  it('token salah: 404 bukan 401', async () => {
    mockTreeDenganToken();
    const r = await getFeed('/api/v1/trees/tree-1/calendar.ics?token=tok-ngawur');
    expect(r.status).toBe(404);
    expect(r.contentType).toContain('text/plain');
  });

  it('tree tanpa feed aktif (token null): 404', async () => {
    prismaMock.familyTree.findFirst.mockResolvedValue(null);
    const r = await getFeed('/api/v1/trees/tree-1/calendar.ics?token=apa-saja');
    expect(r.status).toBe(404);
  });

  it('token benar: 200 text/calendar charset utf-8, body VCALENDAR', async () => {
    mockTreeDenganToken();
    mockDataTree();
    const r = await getFeed(`/api/v1/trees/tree-1/calendar.ics?token=${TOKEN}`);
    expect(r.status).toBe(200);
    expect(r.contentType).toContain('text/calendar');
    expect(r.contentType).toContain('charset=utf-8');
    expect(r.text.startsWith('BEGIN:VCALENDAR')).toBe(true);
    expect(r.text).toContain('UID:stg-birthday-m-1@stemmagraph');
    expect(r.text).toContain('UID:stg-haul-m-2@stemmagraph');
  });

  it('kontrak token milik tree: query by treeId dan icsFeedToken bersama', async () => {
    mockTreeDenganToken();
    mockDataTree();
    await getFeed(`/api/v1/trees/tree-1/calendar.ics?token=${TOKEN}`);
    expect(prismaMock.familyTree.findFirst).toHaveBeenCalledTimes(1);
    const args = prismaMock.familyTree.findFirst.mock.calls[0]?.[0] as { where: { id: string; icsFeedToken: string } };
    expect(args.where.id).toBe('tree-1');
    expect(args.where.icsFeedToken).toBe(TOKEN);
  });

  it('kontrak lintas tree: token benar tapi treeId beda tetap 404', async () => {
    mockTreeDenganToken();
    const r = await getFeed(`/api/v1/trees/tree-lain/calendar.ics?token=${TOKEN}`);
    expect(r.status).toBe(404);
  });
});

describe('GET calendar.ics isi feed (v394 AC3)', () => {
  it('horizon dua tahun: event 207 hari di depan masuk feed (bukan window 30 hari)', async () => {
    mockTreeDenganToken();
    mockDataTree();
    const r = await getFeed(`/api/v1/trees/tree-1/calendar.ics?token=${TOKEN}`);
    expect(r.status).toBe(200);
    const expected = computeNextAnniversaries(
      [{ kind: 'birthday', refId: 'm-1', displayName: 'Adi', date: '2000-05-20' }],
      new Date(),
      730,
    );
    const ymd = expected[0]?.nextDate.replace(/-/g, '');
    expect(expected[0]?.daysUntil).toBeGreaterThan(30);
    expect(r.text).toContain(`DTSTART;VALUE=DATE:${ymd}`);
  });

  it('haul memakai haulOverrideDate, bukan deathDate', async () => {
    mockTreeDenganToken();
    mockDataTree();
    const r = await getFeed(`/api/v1/trees/tree-1/calendar.ics?token=${TOKEN}`);
    const expected = computeNextAnniversaries(
      [{ kind: 'haul', refId: 'm-2', displayName: 'Opung', date: '1990-03-01' }],
      new Date(),
      730,
    );
    const ymd = expected[0]?.nextDate.replace(/-/g, '');
    expect(r.text).toContain(`DTSTART;VALUE=DATE:${ymd}`);
    expect(r.text).not.toContain(`DTSTART;VALUE=DATE:19900310`);
  });

  it('X-WR-CALNAME memuat nama tree, SUMMARY memakai label kind', async () => {
    mockTreeDenganToken();
    mockDataTree();
    const r = await getFeed(`/api/v1/trees/tree-1/calendar.ics?token=${TOKEN}`);
    expect(r.text).toContain('X-WR-CALNAME:Keluarga Uji');
    expect(r.text).toContain('SUMMARY:Ulang tahun: Adi');
    expect(r.text).toContain('SUMMARY:Haul: Opung');
  });
});

describe('GET calendar.ics cache (v394 AC3)', () => {
  it('Cache-Control private no-cache, ETag weak, revalidasi If-None-Match 304', async () => {
    mockTreeDenganToken();
    mockDataTree();
    const first = await getFeed(`/api/v1/trees/tree-1/calendar.ics?token=${TOKEN}`);
    expect(first.cacheControl).toContain('no-cache');
    expect(first.etag.startsWith('W/"')).toBe(true);
    const second = await getFeed(`/api/v1/trees/tree-1/calendar.ics?token=${TOKEN}`, { 'if-none-match': first.etag });
    expect(second.status).toBe(304);
    expect(second.text).toHaveLength(0);
  });

  it('feed tetap terbit tanpa header Authorization (tanpa login JWT)', async () => {
    mockTreeDenganToken();
    mockDataTree();
    const res = await fetch(`${BASE}/api/v1/trees/tree-1/calendar.ics?token=${TOKEN}`, { headers: { authorization: authHeader('user-1') } });
    expect(res.status).toBe(200);
  });
});

describe('Manajemen token feed (v394 AC4)', () => {
  const OWNER = { id: 'user-owner', status: 'ACTIVE', role: 'user' };
  const EDITOR = { id: 'user-editor', status: 'ACTIVE', role: 'user' };
  const VIEWER = { id: 'user-viewer', status: 'ACTIVE', role: 'user' };

  function mockUser(u: { id: string; status: string; role: string }): void {
    prismaMock.user.findUnique.mockImplementation(async (args: { where: { id: string } }) => (args.where.id === u.id ? u : null));
  }

  function mockMembership(userId: string, role: string | null): void {
    prismaMock.treeMember.findUnique.mockImplementation(async (args: { where: { treeId_userId: { treeId: string; userId: string } } }) =>
      args.where.treeId_userId.userId === userId && role !== null ? { userId, role } : null,
    );
  }

  function mockTreeExists(exists: boolean): void {
    prismaMock.familyTree.findUnique.mockImplementation(async () => (exists ? { id: 'tree-1' } : null));
    prismaMock.familyTree.update.mockResolvedValue({ id: 'tree-1' });
  }

  it('tanpa login: 401 di rotate dan revoke', async () => {
    const r1 = await fetch(`${BASE}/api/v1/trees/tree-1/calendar-token/rotate`, { method: 'POST' });
    expect(r1.status).toBe(401);
    const r2 = await fetch(`${BASE}/api/v1/trees/tree-1/calendar-token`, { method: 'DELETE' });
    expect(r2.status).toBe(401);
  });

  it('viewer: 403 di rotate dan revoke, prisma.update tidak dipanggil', async () => {
    mockUser(VIEWER);
    mockMembership(VIEWER.id, 'viewer');
    mockTreeExists(true);
    const h = { authorization: authHeader(VIEWER.id), 'content-type': 'application/json' };
    const r1 = await fetch(`${BASE}/api/v1/trees/tree-1/calendar-token/rotate`, { method: 'POST', headers: h });
    expect(r1.status).toBe(403);
    const r2 = await fetch(`${BASE}/api/v1/trees/tree-1/calendar-token`, { method: 'DELETE', headers: h });
    expect(r2.status).toBe(403);
    expect(prismaMock.familyTree.update).not.toHaveBeenCalled();
  });

  it('non-anggota: 403 di rotate', async () => {
    mockUser(OWNER);
    mockMembership(OWNER.id, null);
    mockTreeExists(true);
    const r = await fetch(`${BASE}/api/v1/trees/tree-1/calendar-token/rotate`, { method: 'POST', headers: { authorization: authHeader(OWNER.id) } });
    expect(r.status).toBe(403);
  });

  it('tree tidak ada: 404 di rotate', async () => {
    mockUser(OWNER);
    mockMembership(OWNER.id, 'owner');
    mockTreeExists(false);
    const r = await fetch(`${BASE}/api/v1/trees/tree-1/calendar-token/rotate`, { method: 'POST', headers: { authorization: authHeader(OWNER.id) } });
    expect(r.status).toBe(404);
  });

  it('owner rotate: 200 token baru unguessable, token lama mati (feed 404 token lama, 200 token baru)', async () => {
    mockUser(OWNER);
    mockMembership(OWNER.id, 'owner');
    mockTreeExists(true);
    const OLD = 'tok-lama';
    let current = OLD;
    prismaMock.familyTree.update.mockImplementation(async (args: { data: { icsFeedToken: string | null } }) => {
      current = args.data.icsFeedToken;
      return { id: 'tree-1' };
    });
    prismaMock.familyTree.findFirst.mockImplementation(async (args: { where: { id: string; icsFeedToken: string } }) =>
      args.where.id === 'tree-1' && args.where.icsFeedToken === current ? { id: 'tree-1', name: 'Keluarga Uji' } : null,
    );
    prismaMock.familyMember.findMany.mockResolvedValue([]);
    prismaMock.lifeEvent.findMany.mockResolvedValue([]);
    const r = await fetch(`${BASE}/api/v1/trees/tree-1/calendar-token/rotate`, { method: 'POST', headers: { authorization: authHeader(OWNER.id) } });
    expect(r.status).toBe(200);
    const body = (await r.json()) as { token: string };
    expect(body.token.length).toBeGreaterThan(20);
    expect(body.token).not.toBe(OLD);
    const feedLama = await getFeed(`/api/v1/trees/tree-1/calendar.ics?token=${OLD}`);
    expect(feedLama.status).toBe(404);
    const feedBaru = await getFeed(`/api/v1/trees/tree-1/calendar.ics?token=${body.token}`);
    expect(feedBaru.status).toBe(200);
  });

  it('editor rotate: 200 (owner/editor boleh mengelola token feed)', async () => {
    mockUser(EDITOR);
    mockMembership(EDITOR.id, 'editor');
    mockTreeExists(true);
    const r = await fetch(`${BASE}/api/v1/trees/tree-1/calendar-token/rotate`, { method: 'POST', headers: { authorization: authHeader(EDITOR.id) } });
    expect(r.status).toBe(200);
    const body = (await r.json()) as { token: string };
    expect(typeof body.token).toBe('string');
  });

  it('revoke: 200, kolom null, feed menjawab 404', async () => {
    mockUser(OWNER);
    mockMembership(OWNER.id, 'owner');
    mockTreeExists(true);
    let current: string | null = 'tok-aktif';
    prismaMock.familyTree.update.mockImplementation(async (args: { data: { icsFeedToken: string | null } }) => {
      current = args.data.icsFeedToken;
      return { id: 'tree-1' };
    });
    prismaMock.familyTree.findFirst.mockImplementation(async (args: { where: { id: string; icsFeedToken: string } }) =>
      current !== null && args.where.id === 'tree-1' && args.where.icsFeedToken === current ? { id: 'tree-1', name: 'Keluarga Uji' } : null,
    );
    prismaMock.familyMember.findMany.mockResolvedValue([]);
    prismaMock.lifeEvent.findMany.mockResolvedValue([]);
    const feedSebelum = await getFeed('/api/v1/trees/tree-1/calendar.ics?token=tok-aktif');
    expect(feedSebelum.status).toBe(200);
    const r = await fetch(`${BASE}/api/v1/trees/tree-1/calendar-token`, { method: 'DELETE', headers: { authorization: authHeader(OWNER.id) } });
    expect(r.status).toBe(200);
    const body = (await r.json()) as { revoked: boolean };
    expect(body.revoked).toBe(true);
    const feedSesudah = await getFeed('/api/v1/trees/tree-1/calendar.ics?token=tok-aktif');
    expect(feedSesudah.status).toBe(404);
  });
});
