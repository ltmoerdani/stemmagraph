/**
 * Test dedikasi route marriage-months v291 fase ii
 * (GET /api/v1/trees/:treeId/stats/marriage-months).
 *
 * Pola persis src/server/stats/family-size-api.test.ts (v288): prisma di-mock
 * penuh lewat vi.hoisted supaya server/index.ts bisa diimpor tanpa
 * DATABASE_URL dan tanpa generated prisma client. Server express asli
 * dilisten di port ephemeral (API_PORT) lalu diakses via fetch native.
 *
 * AC kontrak kukuh v291: 401 challenge Bearer, 403 FORBIDDEN_TREE tanpa
 * WWW-Authenticate, 200 distribusi 12 key GEDCOM JAN..DEC, bulan kosong nol,
 * non-EXACT berbulan masuk (dateKind apa pun asal monthStart 1..12),
 * tahun-only dan event tanpa tanggal gugur ke excludedCount, dedup per orang
 * greedy pasca sort kanonik (pasangan terawal menang, pasangan gugur dedup
 * TIDAK masuk excludedCount, semantik jangkar webtrees), 304 mengulang ETag
 * dan Cache-Control, 500 path error dimock, keys respons persis tiga agregat
 * tanpa field individu.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import express from 'express';
import jwt from 'jsonwebtoken';

const prismaMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  familyTree: { findUnique: vi.fn() },
  treeMember: { findUnique: vi.fn() },
  lifeEvent: { findMany: vi.fn() },
  familyRelationship: { findMany: vi.fn() },
}));

vi.mock('../../../server/db', () => ({ prisma: prismaMock }));

const JWT_SECRET = 'dev-only-insecure-secret-change-me';

function authHeader(userId: string): string {
  return `Bearer ${jwt.sign({ sub: userId }, JWT_SECRET)}`;
}

const USER = { id: 'user-1', email: 'u@example.test', status: 'active', role: 'owner' };
const TREE = { id: 'tree-1' };

const PATH = '/api/v1/trees/tree-1/stats/marriage-months';

let BASE = '';
let serverHandle: import('node:http').Server | undefined;

interface GetResult {
  status: number;
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
  partnerMemberId: string;
  date: {
    dateKind: string;
    yearStart: number | null;
    monthStart: number | null;
    dayStart: number | null;
  } | null;
}

function ev(
  memberId: string,
  partnerMemberId: string,
  dateKind: string,
  yearStart: number | null,
  monthStart: number | null,
  dayStart: number | null
): EventRow {
  return { memberId, partnerMemberId, date: { dateKind, yearStart, monthStart, dayStart } };
}

const DISTRIBUSI_NOL = {
  JAN: 0, FEB: 0, MAR: 0, APR: 0, MAY: 0, JUN: 0,
  JUL: 0, AUG: 0, SEP: 0, OCT: 0, NOV: 0, DEC: 0,
};

beforeAll(async () => {
  const port = 39200 + (process.pid % 600);
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
});

afterAll(async () => {
  await new Promise<void>((resolve) => {
    if (!serverHandle) return resolve();
    serverHandle.close(() => resolve());
  });
});

describe('v291 marriage-months endpoint', () => {
  it('401 tanpa kredensial dengan header WWW-Authenticate: Bearer', async () => {
    prismaMock.user.findUnique.mockResolvedValue(USER);
    prismaMock.familyTree.findUnique.mockResolvedValue(TREE);
    const { status, wwwAuthenticate } = await get(PATH);
    expect(status).toBe(401);
    expect(wwwAuthenticate).toBe('Bearer');
  });

  it('403 bukan anggota tanpa header WWW-Authenticate', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ ...USER, role: 'member' });
    prismaMock.familyTree.findUnique.mockResolvedValue(TREE);
    prismaMock.treeMember.findUnique.mockResolvedValue(null);
    const { status, body, wwwAuthenticate } = await get(PATH, { authorization: authHeader('user-1') });
    expect(status).toBe(403);
    expect(body['code']).toBe('FORBIDDEN_TREE');
    expect(wwwAuthenticate).toBeNull();
  });

  it('200 dua pernikahan di bulan berbeda: distribusi dan marriageCount benar', async () => {
    mockGuardAman();
    prismaMock.lifeEvent.findMany.mockResolvedValue([
      ev('a', 'b', 'EXACT', 1990, 5, 12),
      ev('c', 'd', 'EXACT', 2001, 11, 2),
    ] as EventRow[]);
    const { status, body } = await get(PATH, { authorization: authHeader('user-1') });
    expect(status).toBe(200);
    expect(body['marriageCount']).toBe(2);
    expect(body['excludedCount']).toBe(0);
    expect(body['countsByMonth']).toEqual({ ...DISTRIBUSI_NOL, MAY: 1, NOV: 1 });
  });

  it('200 kunci countsByMonth persis 12 kode GEDCOM urut JAN sampai DEC', async () => {
    mockGuardAman();
    prismaMock.lifeEvent.findMany.mockResolvedValue([]);
    const { status, body } = await get(PATH, { authorization: authHeader('user-1') });
    expect(status).toBe(200);
    expect(Object.keys(body['countsByMonth'] as Record<string, number>)).toEqual([
      'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC',
    ]);
    expect(body['marriageCount']).toBe(0);
  });

  it('200 non-EXACT berbulan (ABOUT) tetap masuk hitungan, beda sengaja dari v280', async () => {
    mockGuardAman();
    prismaMock.lifeEvent.findMany.mockResolvedValue([
      ev('a', 'b', 'ABOUT', 1985, 3, null),
    ] as EventRow[]);
    const { status, body } = await get(PATH, { authorization: authHeader('user-1') });
    expect(status).toBe(200);
    expect(body['marriageCount']).toBe(1);
    expect(body['excludedCount']).toBe(0);
    expect(body['countsByMonth']).toEqual({ ...DISTRIBUSI_NOL, MAR: 1 });
  });

  it('200 tahun-only (monthStart null) gugur dari hitungan dan masuk excludedCount', async () => {
    mockGuardAman();
    prismaMock.lifeEvent.findMany.mockResolvedValue([
      ev('a', 'b', 'EXACT', 1970, null, null),
      ev('c', 'd', 'EXACT', 1980, 7, 4),
    ] as EventRow[]);
    const { status, body } = await get(PATH, { authorization: authHeader('user-1') });
    expect(status).toBe(200);
    expect(body['marriageCount']).toBe(1);
    expect(body['excludedCount']).toBe(1);
    expect(body['countsByMonth']).toEqual({ ...DISTRIBUSI_NOL, JUL: 1 });
  });

  it('200 event tanpa tanggal (date null) gugur dan masuk excludedCount', async () => {
    mockGuardAman();
    prismaMock.lifeEvent.findMany.mockResolvedValue([
      { memberId: 'a', partnerMemberId: 'b', date: null } as EventRow,
    ] as EventRow[]);
    const { status, body } = await get(PATH, { authorization: authHeader('user-1') });
    expect(status).toBe(200);
    expect(body['marriageCount']).toBe(0);
    expect(body['excludedCount']).toBe(1);
    expect(body['countsByMonth']).toEqual(DISTRIBUSI_NOL);
  });

  it('200 dedup per orang greedy: orang sama di dua pasangan, pasangan terawal menang', async () => {
    mockGuardAman();
    // 'a' menikah dengan 'b' tahun 1990 dan dengan 'c' tahun 1995;
    // pasangan 1990 masuk, pasangan 1995 gugur dedup (bukan excluded).
    prismaMock.lifeEvent.findMany.mockResolvedValue([
      ev('a', 'c', 'EXACT', 1995, 6, 1),
      ev('a', 'b', 'EXACT', 1990, 8, 9),
    ] as EventRow[]);
    const { status, body } = await get(PATH, { authorization: authHeader('user-1') });
    expect(status).toBe(200);
    expect(body['marriageCount']).toBe(1);
    expect(body['excludedCount']).toBe(0);
    expect(body['countsByMonth']).toEqual({ ...DISTRIBUSI_NOL, AUG: 1 });
  });

  it('200 urutan input tidak mengubah hasil (determinisme sort kanonik)', async () => {
    mockGuardAman();
    prismaMock.lifeEvent.findMany.mockResolvedValue([
      ev('p', 'q', 'EXACT', 2000, 12, 25),
      ev('r', 's', 'EXACT', 2000, 1, 1),
    ] as EventRow[]);
    const { status, body } = await get(PATH, { authorization: authHeader('user-1') });
    expect(status).toBe(200);
    expect(body['countsByMonth']).toEqual({ ...DISTRIBUSI_NOL, JAN: 1, DEC: 1 });
  });

  it('304 mengulang ETag dan Cache-Control saat If-None-Match cocok', async () => {
    mockGuardAman();
    prismaMock.lifeEvent.findMany.mockResolvedValue([
      ev('a', 'b', 'EXACT', 1991, 9, 30),
    ] as EventRow[]);
    const first = await get(PATH, { authorization: authHeader('user-1') });
    expect(first.status).toBe(200);
    const etag = first.etag ?? '';
    const bareHex = etag.replace(/^W\//, '').replaceAll('"', '');
    const second = await get(PATH, { authorization: authHeader('user-1'), 'if-none-match': bareHex });
    expect(second.status).toBe(304);
    expect(second.etag).toBe(etag);
    expect(second.cacheControl).toBe('private, no-cache');
  });

  it('200 keys respons persis tiga agregat tanpa field individu', async () => {
    mockGuardAman();
    prismaMock.lifeEvent.findMany.mockResolvedValue([
      ev('member-rahasia', 'partner-rahasia', 'EXACT', 1999, 2, 2),
    ] as EventRow[]);
    const { status, body } = await get(PATH, { authorization: authHeader('user-1') });
    expect(status).toBe(200);
    expect(Object.keys(body)).toEqual(['countsByMonth', 'marriageCount', 'excludedCount']);
    expect(JSON.stringify(body)).not.toContain('member-rahasia');
    expect(JSON.stringify(body)).not.toContain('partner-rahasia');
  });

  it('500 path error mengembalikan code MARRIAGE_MONTHS_ERROR', async () => {
    mockGuardAman();
    prismaMock.lifeEvent.findMany.mockRejectedValueOnce(new Error('db boom'));
    const { status, body } = await get(PATH, { authorization: authHeader('user-1') });
    expect(status).toBe(500);
    expect(body['code']).toBe('MARRIAGE_MONTHS_ERROR');
    expect(body['message']).toContain('db boom');
  });

  it('200 membawa Cache-Control eksak private no-cache dan ETag strong 64 hex', async () => {
    mockGuardAman();
    prismaMock.lifeEvent.findMany.mockResolvedValue([
      ev('a', 'b', 'EXACT', 1988, 4, 17),
    ] as EventRow[]);
    const { status, etag, cacheControl } = await get(PATH, { authorization: authHeader('user-1') });
    expect(status).toBe(200);
    expect(cacheControl).toBe('private, no-cache');
    expect(etag).toMatch(/^"[0-9a-f]{64}"$/);
  });
});
