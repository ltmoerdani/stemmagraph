/**
 * Test dedikasi route stats by-century dari LifeEvent v383
 * (GET /api/v1/trees/:treeId/stats/births-by-century,
 *  /deaths-by-century, /weddings-by-century, /divorces-by-century).
 *
 * Pola persis src/server/stats/marriage-months-api.test.ts (v291): prisma
 * di-mock penuh lewat vi.hoisted supaya server/index.ts bisa diimpor tanpa
 * DATABASE_URL dan tanpa generated prisma client. Server express listen
 * di-intercept untuk capture handle, server dilisten via import
 * server/index.ts, diakses via fetch native.
 *
 * AC kontrak kukuh v383: 401 challenge Bearer, 403 FORBIDDEN_TREE tanpa
 * WWW-Authenticate, 200 payload agregat { centuries, total, undated } dari
 * compute*ByCenturyFromEvents (hanya EXACT lengkap tahun-bulan-hari yang
 * terhitung, presisi parsial gugur ke undated sesuai aturan kejujuran ADR
 * 0011), weddings dan divorces hanya MARRIAGE/DIVORCE berpasangan
 * (partnerMemberId not null), 304 mengulang ETag dan Cache-Control.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import express from 'express';
import jwt from 'jsonwebtoken';

const prismaMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  familyTree: { findUnique: vi.fn() },
  treeMember: { findUnique: vi.fn() },
  lifeEvent: { findMany: vi.fn() },
}));

vi.mock('../../../server/db', () => ({ prisma: prismaMock }));

const JWT_SECRET = 'dev-only-insecure-secret-change-me';

function authHeader(userId: string): string {
  return `Bearer ${jwt.sign({ sub: userId }, JWT_SECRET)}`;
}

const USER = { id: 'user-1', email: 'u@example.test', status: 'active', role: 'owner' };
const TREE = { id: 'tree-1' };

const PATH_BIRTHS = '/api/v1/trees/tree-1/stats/births-by-century';
const PATH_DEATHS = '/api/v1/trees/tree-1/stats/deaths-by-century';
const PATH_WEDDINGS = '/api/v1/trees/tree-1/stats/weddings-by-century';
const PATH_DIVORCES = '/api/v1/trees/tree-1/stats/divorces-by-century';

let BASE = '';
let serverHandle: import('node:http').Server | undefined;

interface GetResult {
  status: number;
  rawText: string;
  body: Record<string, unknown>;
  etag: string | null;
  cacheControl: string | null;
  wwwAuthenticate: string | null;
}

async function get(path: string, headers: Record<string, string> = {}): Promise<GetResult> {
  const res = await fetch(`${BASE}${path}`, { headers });
  const text = await res.text();
  return {
    status: res.status,
    rawText: text,
    body: text.length === 0 ? {} : (JSON.parse(text) as Record<string, unknown>),
    etag: res.headers.get('etag'),
    cacheControl: res.headers.get('cache-control'),
    wwwAuthenticate: res.headers.get('www-authenticate'),
  };
}

function mockGuardAman(): void {
  prismaMock.user.findUnique.mockResolvedValue(USER);
  prismaMock.familyTree.findUnique.mockResolvedValue(TREE);
  prismaMock.treeMember.findUnique.mockResolvedValue(null);
}

interface EventRow {
  memberId: string;
  partnerMemberId: string | null;
  date: {
    dateKind: string;
    yearStart: number | null;
    monthStart: number | null;
    dayStart: number | null;
  } | null;
}

function ev(
  memberId: string,
  partnerMemberId: string | null,
  dateKind: string,
  yearStart: number | null,
  monthStart: number | null,
  dayStart: number | null
): EventRow {
  return { memberId, partnerMemberId, date: { dateKind, yearStart, monthStart, dayStart } };
}

/** Struktur payload agregat: persis tiga kunci, total konsisten dengan abad. */
function expectStrukturAgregat(body: Record<string, unknown>): void {
  expect(Object.keys(body)).toEqual(['centuries', 'total', 'undated']);
  const centuries = body['centuries'] as { century: string; count: number }[];
  const total = centuries.reduce((acc, c) => acc + c.count, 0);
  expect(body['total']).toBe(total);
}

beforeAll(async () => {
  const port = 40600 + (process.pid % 600);
  BASE = `http://127.0.0.1:${port}`;
  process.env['API_PORT'] = String(port);
  const proto = (express as unknown as { application: { listen: (...a: unknown[]) => import('node:http').Server } }).application;
  const origListen = proto.listen;
  proto.listen = function (this: unknown, ...args: unknown[]) {
    serverHandle = origListen.apply(this, args);
    return serverHandle;
  } as typeof proto.listen;
  await import('../../../server/index');
  const deadline = Date.now() + 5000;
  for (;;) {
    try {
      await fetch(`${BASE}/`);
      break;
    } catch {
      if (Date.now() > deadline) throw new Error('server test tidak siap dalam 5 detik');
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

describe('v383 stats by-century endpoints', () => {
  it('401 tanpa kredensial dengan header WWW-Authenticate: Bearer', async () => {
    prismaMock.user.findUnique.mockResolvedValue(USER);
    prismaMock.familyTree.findUnique.mockResolvedValue(TREE);
    const { status, wwwAuthenticate } = await get(PATH_BIRTHS);
    expect(status).toBe(401);
    expect(wwwAuthenticate).toBe('Bearer');
  });

  it('403 bukan anggota tanpa header WWW-Authenticate, code FORBIDDEN_TREE', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ ...USER, role: 'member' });
    prismaMock.familyTree.findUnique.mockResolvedValue(TREE);
    prismaMock.treeMember.findUnique.mockResolvedValue(null);
    const { status, body, wwwAuthenticate } = await get(PATH_BIRTHS, { authorization: authHeader('user-1') });
    expect(status).toBe(403);
    expect(body['code']).toBe('FORBIDDEN_TREE');
    expect(wwwAuthenticate).toBeNull();
  });

  it('200 births-by-century: dua EXACT lengkap di abad berbeda terhitung, EXACT parsial gugur ke undated', async () => {
    mockGuardAman();
    prismaMock.lifeEvent.findMany.mockResolvedValue([
      ev('a', null, 'EXACT', 1875, 3, 12),
      ev('b', null, 'EXACT', 1990, 7, 4),
      ev('c', null, 'EXACT', 1955, null, null),
    ] as EventRow[]);
    const { status, body } = await get(PATH_BIRTHS, { authorization: authHeader('user-1') });
    expect(status).toBe(200);
    expect(prismaMock.lifeEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ eventType: 'BIRTH' }),
      })
    );
    expect(body['centuries']).toEqual([
      { century: '1800', count: 1 },
      { century: '1900', count: 1 },
    ]);
    expect(body['total']).toBe(2);
    expect(body['undated']).toBe(1);
    expectStrukturAgregat(body);
  });

  it('200 deaths-by-century: dua EXACT lengkap di abad berbeda terhitung, EXACT parsial gugur ke undated', async () => {
    mockGuardAman();
    prismaMock.lifeEvent.findMany.mockResolvedValue([
      ev('a', null, 'EXACT', 1821, 11, 30),
      ev('b', null, 'EXACT', 2001, 1, 15),
      ev('c', null, 'EXACT', 1970, 6, null),
    ] as EventRow[]);
    const { status, body } = await get(PATH_DEATHS, { authorization: authHeader('user-1') });
    expect(status).toBe(200);
    expect(prismaMock.lifeEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ eventType: 'DEATH' }),
      })
    );
    expect(body['centuries']).toEqual([
      { century: '1800', count: 1 },
      { century: '2000', count: 1 },
    ]);
    expect(body['total']).toBe(2);
    expect(body['undated']).toBe(1);
    expectStrukturAgregat(body);
  });

  it('200 weddings-by-century: hanya MARRIAGE berpasangan (partnerMemberId not null) yang dikueri dan terhitung', async () => {
    mockGuardAman();
    prismaMock.lifeEvent.findMany.mockResolvedValue([
      ev('a', 'b', 'EXACT', 1910, 5, 20),
      ev('c', 'd', 'EXACT', 1999, 12, 31),
    ] as EventRow[]);
    const { status, body } = await get(PATH_WEDDINGS, { authorization: authHeader('user-1') });
    expect(status).toBe(200);
    expect(prismaMock.lifeEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ eventType: 'MARRIAGE', partnerMemberId: { not: null } }),
      })
    );
    expect(body['centuries']).toEqual([
      { century: '1900', count: 2 },
    ]);
    expect(body['total']).toBe(2);
    expect(body['undated']).toBe(0);
    expectStrukturAgregat(body);
  });

  it('200 divorces-by-century: dua perceraian berpasangan di abad berbeda terhitung', async () => {
    mockGuardAman();
    prismaMock.lifeEvent.findMany.mockResolvedValue([
      ev('a', 'b', 'EXACT', 1925, 4, 2),
      ev('c', 'd', 'EXACT', 2010, 8, 9),
    ] as EventRow[]);
    const { status, body } = await get(PATH_DIVORCES, { authorization: authHeader('user-1') });
    expect(status).toBe(200);
    expect(prismaMock.lifeEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ eventType: 'DIVORCE', partnerMemberId: { not: null } }),
      })
    );
    expect(body['centuries']).toEqual([
      { century: '1900', count: 1 },
      { century: '2000', count: 1 },
    ]);
    expect(body['total']).toBe(2);
    expect(body['undated']).toBe(0);
    expectStrukturAgregat(body);
  });

  it('200 event tanpa date (date null) gugur ke undated', async () => {
    mockGuardAman();
    prismaMock.lifeEvent.findMany.mockResolvedValue([
      { memberId: 'a', partnerMemberId: 'b', date: null } as EventRow,
      { memberId: 'c', partnerMemberId: null, date: null } as EventRow,
    ] as EventRow[]);
    const { status, body } = await get(PATH_WEDDINGS, { authorization: authHeader('user-1') });
    expect(status).toBe(200);
    expect(body['centuries']).toEqual([]);
    expect(body['total']).toBe(0);
    expect(body['undated']).toBe(2);
    expectStrukturAgregat(body);
  });

  it('304 mengulang ETag dan Cache-Control saat If-None-Match cocok, body kosong', async () => {
    mockGuardAman();
    prismaMock.lifeEvent.findMany.mockResolvedValue([
      ev('a', null, 'EXACT', 1931, 9, 30),
    ] as EventRow[]);
    const first = await get(PATH_DEATHS, { authorization: authHeader('user-1') });
    expect(first.status).toBe(200);
    const etag = first.etag ?? '';
    const bareHex = etag.replace(/^W\//, '').replaceAll('"', '');
    const second = await get(PATH_DEATHS, { authorization: authHeader('user-1'), 'if-none-match': bareHex });
    expect(second.status).toBe(304);
    expect(second.rawText).toBe('');
    expect(second.etag).toBe(etag);
    expect(second.cacheControl).toBe('private, no-cache');
  });

  it('500 path error mengembalikan code BIRTHS_BY_CENTURY_ERROR', async () => {
    mockGuardAman();
    prismaMock.lifeEvent.findMany.mockRejectedValueOnce(new Error('db boom'));
    const { status, body } = await get(PATH_BIRTHS, { authorization: authHeader('user-1') });
    expect(status).toBe(500);
    expect(body['code']).toBe('BIRTHS_BY_CENTURY_ERROR');
    expect(body['message']).toContain('db boom');
  });

  it('200 membawa Cache-Control eksak private no-cache dan ETag strong 64 hex dalam kutip', async () => {
    mockGuardAman();
    prismaMock.lifeEvent.findMany.mockResolvedValue([
      ev('a', 'b', 'EXACT', 1988, 4, 17),
    ] as EventRow[]);
    const { status, etag, cacheControl } = await get(PATH_DIVORCES, { authorization: authHeader('user-1') });
    expect(status).toBe(200);
    expect(cacheControl).toBe('private, no-cache');
    expect(etag).toMatch(/^"[0-9a-f]{64}"$/);
  });
});

describe('v384 stats by-century saklar STATS_READ_SOURCE', () => {
  const ORIGINAL = process.env['STATS_READ_SOURCE'];

  function setSource(raw: string | undefined): void {
    if (raw === undefined) {
      delete process.env['STATS_READ_SOURCE'];
    } else {
      process.env['STATS_READ_SOURCE'] = raw;
    }
  }

  afterEach(() => {
    setSource(ORIGINAL);
  });

  it('default (env undefined): births dilayani jalur entity, payload bentuk sama', async () => {
    setSource(undefined);
    mockGuardAman();
    prismaMock.lifeEvent.findMany.mockResolvedValue([
      ev('a', null, 'EXACT', 1875, 3, 12),
      ev('b', null, 'EXACT', 1955, null, null),
    ] as EventRow[]);
    const { status, body } = await get(PATH_BIRTHS, { authorization: authHeader('user-1') });
    expect(status).toBe(200);
    expect(body['centuries']).toEqual([{ century: '1800', count: 1 }]);
    expect(body['total']).toBe(1);
    expect(body['undated']).toBe(1);
    expectStrukturAgregat(body);
  });

  it('legacy: births payload bentuk sama dengan jalur entity (kasus sama, angka sama)', async () => {
    setSource('legacy');
    mockGuardAman();
    prismaMock.lifeEvent.findMany.mockResolvedValue([
      ev('a', null, 'EXACT', 1875, 3, 12),
      ev('b', null, 'EXACT', 1955, null, null),
    ] as EventRow[]);
    const { status, body } = await get(PATH_BIRTHS, { authorization: authHeader('user-1') });
    expect(status).toBe(200);
    expect(body['centuries']).toEqual([{ century: '1800', count: 1 }]);
    expect(body['total']).toBe(1);
    expect(body['undated']).toBe(1);
    expectStrukturAgregat(body);
  });

  it('legacy: weddings familyId pola parity subjectId<partnerId, payload identik entity', async () => {
    setSource('legacy');
    mockGuardAman();
    prismaMock.lifeEvent.findMany.mockResolvedValue([
      ev('a', 'b', 'EXACT', 1910, 5, 20),
      ev('c', null, 'EXACT', 1999, 12, 31),
    ] as EventRow[]);
    const { status, body } = await get(PATH_WEDDINGS, { authorization: authHeader('user-1') });
    expect(status).toBe(200);
    expect(body['centuries']).toEqual([
      { century: '1900', count: 2 },
    ]);
    expect(body['total']).toBe(2);
    expect(body['undated']).toBe(0);
    expectStrukturAgregat(body);
  });

  it('legacy: divorces payload valid dan 304 ETag tetap berjalan', async () => {
    setSource('legacy');
    mockGuardAman();
    prismaMock.lifeEvent.findMany.mockResolvedValue([
      ev('a', 'b', 'EXACT', 1925, 4, 2),
    ] as EventRow[]);
    const first = await get(PATH_DIVORCES, { authorization: authHeader('user-1') });
    expect(first.status).toBe(200);
    expect(first.body['centuries']).toEqual([{ century: '1900', count: 1 }]);
    const etag = first.etag ?? '';
    const bareHex = etag.replace(/^W\//, '').replaceAll('"', '');
    const second = await get(PATH_DIVORCES, { authorization: authHeader('user-1'), 'if-none-match': bareHex });
    expect(second.status).toBe(304);
    expect(second.etag).toBe(etag);
  });

  it('nilai env tidak dikenal jatuh ke entity (default), bukan error', async () => {
    setSource('postgres');
    mockGuardAman();
    prismaMock.lifeEvent.findMany.mockResolvedValue([
      ev('a', null, 'EXACT', 1875, 3, 12),
    ] as EventRow[]);
    const { status, body } = await get(PATH_BIRTHS, { authorization: authHeader('user-1') });
    expect(status).toBe(200);
    expect(body['centuries']).toEqual([{ century: '1800', count: 1 }]);
  });
});
