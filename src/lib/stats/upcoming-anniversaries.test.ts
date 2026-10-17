/**
 * Test dedikasi v275 fase i: upcoming wedding anniversaries (read-only).
 *
 * Harness pola preseden upcoming-birthdays.test.ts (v273): prisma di-mock
 * penuh lewat vi.hoisted, server express asli dilisten di port ephemeral
 * (rentang 40200 supaya aman paralel dengan baseline 39200, hardening
 * 39600, dan birthdays 39900), diakses via fetch native tanpa dependency
 * baru. Mock route: lifeEvent.findMany (MARRIAGE) dan
 * familyMember.findMany (partner) terpisah, tanpa relasi prisma baru.
 *
 * Kasus wajib kontrak: tepat hari ini; besok; hari ke-30 masuk; hari
 * ke-31 keluar; 29 Feb lanjut 1 Mar non-kabisat; satu partner deceased
 * dikecualikan; MARR tanpa tanggal atau non-EXACT dikecualikan; tanggal
 * invalid kalender dikecualikan; days=0 ditolak; days=366 ditolak;
 * days=365 sah; urutan naik plus tie-break; pasangan cermin terdedup;
 * input kosong array kosong.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import express from 'express';
import jwt from 'jsonwebtoken';
import { computeUpcomingAnniversaries } from './upcoming-anniversaries';

const prismaMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  familyTree: { findUnique: vi.fn() },
  treeMember: { findUnique: vi.fn() },
  lifeEvent: { findMany: vi.fn() },
  familyMember: { findMany: vi.fn() },
}));

vi.mock('../../../server/db', () => ({ prisma: prismaMock }));

const JWT_SECRET = 'dev-only-insecure-secret-change-me';

function authHeader(userId: string): string {
  return `Bearer ${jwt.sign({ sub: userId }, JWT_SECRET)}`;
}

const USER = { id: 'user-1', email: 'u@example.test', status: 'active', role: 'owner' };
const TREE = { id: 'tree-1' };

const PATH = '/api/v1/trees/tree-1/stats/anniversaries/upcoming';

interface Outcome {
  status: number;
  headers: Record<string, string>;
  rawBody: string;
}

let BASE = '';
let serverHandle: import('node:http').Server | undefined;

beforeAll(async () => {
  const port = 40200 + (process.pid % 600);
  BASE = `http://127.0.0.1:${port}`;
  process.env['API_PORT'] = String(port);
  const proto = (express as unknown as { application: { listen: (...a: unknown[]) => import('node:http').Server } }).application;
  const origListen = proto.listen;
  proto.listen = function (this: unknown, ...a: unknown[]) {
    serverHandle = origListen.apply(this, a);
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

async function call(path: string, headers: Record<string, string> = {}): Promise<Outcome> {
  const res = await fetch(`${BASE}${path}`, { headers });
  const heads: Record<string, string> = {};
  res.headers.forEach((v, k) => {
    heads[k.toLowerCase()] = v;
  });
  return { status: res.status, headers: heads, rawBody: await res.text() };
}

/* Bagian modul pure: determinisme dan aturan kalender murni, now terinjeksi. */
const NOW = new Date(Date.UTC(2026, 5, 15)); // 2026-06-15 UTC

interface PairRow {
  pairId: string;
  partnerNames: [string, string];
  marriageDate: string;
}

const P = (pairId: string, names: [string, string], date: string): PairRow => ({ pairId, partnerNames: names, marriageDate: date });

describe('upcoming-anniversaries modul pure (v275)', () => {
  it('t1: hari jadi tepat hari query masuk dengan daysUntil 0', () => {
    const out = computeUpcomingAnniversaries([P('a:b', ['Ani', 'Budi'], '1990-06-15')], NOW, 30);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ pairId: 'a:b', daysUntil: 0, yearsMarried: 36, nextAnniversary: '2026-06-15' });
  });

  it('t2: hari jadi besok daysUntil 1', () => {
    const out = computeUpcomingAnniversaries([P('a:b', ['Ani', 'Budi'], '1990-06-16')], NOW, 30);
    expect(out[0]).toMatchObject({ daysUntil: 1, yearsMarried: 36, nextAnniversary: '2026-06-16' });
  });

  it('t3: hari ke-30 masuk (jendela inklusif)', () => {
    const out = computeUpcomingAnniversaries([P('a:b', ['Ani', 'Budi'], '1990-07-15')], NOW, 30);
    expect(out[0]).toMatchObject({ daysUntil: 30, nextAnniversary: '2026-07-15' });
  });

  it('t4: hari ke-31 keluar', () => {
    const out = computeUpcomingAnniversaries([P('a:b', ['Ani', 'Budi'], '1990-07-16')], NOW, 30);
    expect(out).toHaveLength(0);
  });

  it('t5: 29 Feb lanjut 1 Mar pada tahun non-kabisat', () => {
    const out = computeUpcomingAnniversaries([P('a:b', ['Ani', 'Budi'], '2000-02-29')], new Date(Date.UTC(2027, 1, 20)), 30);
    expect(out[0]).toMatchObject({ nextAnniversary: '2027-03-01', daysUntil: 9, yearsMarried: 27 });
  });

  it('t6: marriageDate rusak atau invalid kalender dikecualikan senyap', () => {
    const out = computeUpcomingAnniversaries(
      [P('a:b', ['Ani', 'Budi'], 'bukan-tanggal'), P('c:d', ['Citra', 'Dodi'], '1900-02-30')],
      NOW,
      30,
    );
    expect(out).toHaveLength(0);
  });

  it('t7: urutan naik daysUntil, tie-break marriageDate lama dulu lalu pairId', () => {
    const out = computeUpcomingAnniversaries(
      [
        P('m:n', ['Nia', 'Omar'], '1990-06-17'),
        P('k:l', ['Karti', 'Lukman'], '1980-06-17'),
        P('e:f', ['Eka', 'Fajar'], '2000-06-16'),
        P('g:h', ['Gita', 'Hadi'], '1985-06-17'),
      ],
      NOW,
      30,
    );
    // e:f daysUntil 1; sisanya daysUntil 2, marriageDate 1980 < 1985 < 1990.
    expect(out.map((o) => o.pairId)).toEqual(['e:f', 'k:l', 'g:h', 'm:n']);
  });

  it('t8: input kosong menghasilkan array kosong (determinisme)', () => {
    expect(computeUpcomingAnniversaries([], NOW, 30)).toEqual([]);
    const once = computeUpcomingAnniversaries([P('a:b', ['Ani', 'Budi'], '1990-06-15')], NOW, 30);
    expect(computeUpcomingAnniversaries([P('a:b', ['Ani', 'Budi'], '1990-06-15')], NOW, 30)).toEqual(once);
  });
});

/* Bagian endpoint: otorisasi, validasi days, filter living/EXACT, dedup
 * pasangan cermin, header hardening, 304. */

const ALL_MEMBERS = [
  { id: 'mem-a', name: 'Ani', isAlive: true },
  { id: 'mem-b', name: 'Budi', isAlive: true },
  { id: 'mem-c', name: 'Citra', isAlive: false },
];

function mockMembersById(): void {
  prismaMock.familyMember.findMany.mockImplementation(async (args: { where: { id: { in: string[] } } }) =>
    ALL_MEMBERS.filter((m) => args.where.id.in.includes(m.id)));
}

function mockAuthOk(): void {
  prismaMock.user.findUnique.mockResolvedValue(USER);
  prismaMock.familyTree.findUnique.mockResolvedValue(TREE);
  prismaMock.treeMember.findUnique.mockResolvedValue({ role: 'owner' });
}

describe('upcoming-anniversaries endpoint (v275)', () => {
  it('t9: 401 tanpa kredensial membawa WWW-Authenticate Bearer', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    const res = await call(PATH);
    expect(res.status).toBe(401);
    expect(res.headers['www-authenticate']).toBe('Bearer');
  });

  it('t10: 403 non-anggota tanpa WWW-Authenticate body pola repo', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ ...USER, role: 'member' });
    prismaMock.familyTree.findUnique.mockResolvedValue(TREE);
    prismaMock.treeMember.findUnique.mockResolvedValue(null);
    const res = await call(PATH, { authorization: authHeader('user-1') });
    expect(res.status).toBe(403);
    expect(res.headers['www-authenticate']).toBeUndefined();
    expect(JSON.parse(res.rawBody)).toHaveProperty('code', 'FORBIDDEN_TREE');
  });

  it('t11: 422 untuk days=0, days=366, dan non-integer', async () => {
    mockAuthOk();
    for (const q of ['?days=0', '?days=366', '?days=abc', '?days=3.5']) {
      const res = await call(`${PATH}${q}`, { authorization: authHeader('user-1') });
      expect(res.status, q).toBe(422);
      expect(JSON.parse(res.rawBody)).toHaveProperty('code');
    }
  });

  it('t12: days=365 sah dan 200 membawa Cache-Control private no-cache plus ETag weak', async () => {
    mockAuthOk();
    prismaMock.lifeEvent.findMany.mockResolvedValue([
      { id: 'le1', eventType: 'MARRIAGE', memberId: 'mem-a', partnerMemberId: 'mem-b', date: { dateKind: 'EXACT', yearStart: 1990, monthStart: 6, dayStart: 15 } },
    ]);
    mockMembersById();
    const res = await call(`${PATH}?days=365`, { authorization: authHeader('user-1') });
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('private, no-cache');
    expect(res.headers['etag']).toMatch(/^W\/"[0-9a-f]{64}"$/);
    const body = JSON.parse(res.rawBody);
    expect(Array.isArray(body)).toBe(true);
    expect(body[0]).toMatchObject({ pairId: 'mem-a:mem-b', partnerNames: ['Ani', 'Budi'], marriageDate: '1990-06-15' });
    expect(Number.isInteger(body[0].daysUntil)).toBe(true);
    expect(body[0].daysUntil).toBeGreaterThanOrEqual(0);
    expect(body[0].daysUntil).toBeLessThanOrEqual(365);
    expect(Number.isInteger(body[0].yearsMarried)).toBe(true);
    expect(body[0]).toHaveProperty('nextAnniversary');
  });

  it('t13: If-None-Match sama (weak) dijawab 304 tanpa body dengan ETag sama', async () => {
    mockAuthOk();
    prismaMock.lifeEvent.findMany.mockResolvedValue([
      { id: 'le1', eventType: 'MARRIAGE', memberId: 'mem-a', partnerMemberId: 'mem-b', date: { dateKind: 'EXACT', yearStart: 1990, monthStart: 6, dayStart: 15 } },
    ]);
    mockMembersById();
    const first = await call(PATH, { authorization: authHeader('user-1') });
    const etag = first.headers['etag'];
    const second = await call(PATH, { authorization: authHeader('user-1'), 'if-none-match': etag });
    expect(second.status).toBe(304);
    expect(second.rawBody).toBe('');
    expect(second.headers['etag']).toBe(etag);
  });

  it('t14: If-None-Match tanpa prefix W/ tetap 304 (weak comparison)', async () => {
    mockAuthOk();
    prismaMock.lifeEvent.findMany.mockResolvedValue([
      { id: 'le1', eventType: 'MARRIAGE', memberId: 'mem-a', partnerMemberId: 'mem-b', date: { dateKind: 'EXACT', yearStart: 1990, monthStart: 6, dayStart: 15 } },
    ]);
    mockMembersById();
    const first = await call(PATH, { authorization: authHeader('user-1') });
    const strongForm = first.headers['etag'].slice(2);
    const second = await call(PATH, { authorization: authHeader('user-1'), 'if-none-match': strongForm });
    expect(second.status).toBe(304);
  });

  it('t15: pasangan cermin (A ke B dan B ke A) terdedup satu baris', async () => {
    mockAuthOk();
    prismaMock.lifeEvent.findMany.mockResolvedValue([
      { id: 'le1', eventType: 'MARRIAGE', memberId: 'mem-a', partnerMemberId: 'mem-b', date: { dateKind: 'EXACT', yearStart: 1990, monthStart: 6, dayStart: 15 } },
      { id: 'le2', eventType: 'MARRIAGE', memberId: 'mem-b', partnerMemberId: 'mem-a', date: { dateKind: 'EXACT', yearStart: 1990, monthStart: 6, dayStart: 15 } },
    ]);
    mockMembersById();
    // days=365 supaya assertion isi tidak bergantung tanggal kalender
    // saat test dieksekusi (now route diambil dari jam nyata).
    const res = await call(`${PATH}?days=365`, { authorization: authHeader('user-1') });
    expect(res.status).toBe(200);
    const body = JSON.parse(res.rawBody);
    expect(body).toHaveLength(1);
    expect(body[0]).toMatchObject({ pairId: 'mem-a:mem-b', partnerNames: ['Ani', 'Budi'] });
  });

  it('t16: satu partner deceased dikecualikan senyap', async () => {
    mockAuthOk();
    prismaMock.lifeEvent.findMany.mockResolvedValue([
      { id: 'le1', eventType: 'MARRIAGE', memberId: 'mem-a', partnerMemberId: 'mem-c', date: { dateKind: 'EXACT', yearStart: 1990, monthStart: 6, dayStart: 15 } },
    ]);
    mockMembersById();
    const res = await call(PATH, { authorization: authHeader('user-1') });
    expect(res.status).toBe(200);
    expect(JSON.parse(res.rawBody)).toEqual([]);
  });

  it('t17: MARR tanpa tanggal atau dateKind bukan EXACT dikecualikan', async () => {
    mockAuthOk();
    prismaMock.lifeEvent.findMany.mockResolvedValue([
      { id: 'le1', eventType: 'MARRIAGE', memberId: 'mem-a', partnerMemberId: 'mem-b', date: null },
      { id: 'le2', eventType: 'MARRIAGE', memberId: 'mem-a', partnerMemberId: 'mem-b', date: { dateKind: 'ABOUT', yearStart: 1990, monthStart: 6, dayStart: 15 } },
      { id: 'le3', eventType: 'MARRIAGE', memberId: 'mem-a', partnerMemberId: 'mem-b', date: { dateKind: 'EXACT', yearStart: 1990, monthStart: null, dayStart: 15 } },
    ]);
    mockMembersById();
    const res = await call(PATH, { authorization: authHeader('user-1') });
    expect(res.status).toBe(200);
    expect(JSON.parse(res.rawBody)).toEqual([]);
  });

  it('t18: tanggal invalid kalender (1900-02-30) dikecualikan', async () => {
    mockAuthOk();
    prismaMock.lifeEvent.findMany.mockResolvedValue([
      { id: 'le1', eventType: 'MARRIAGE', memberId: 'mem-a', partnerMemberId: 'mem-b', date: { dateKind: 'EXACT', yearStart: 1900, monthStart: 2, dayStart: 30 } },
    ]);
    mockMembersById();
    const res = await call(PATH, { authorization: authHeader('user-1') });
    expect(res.status).toBe(200);
    expect(JSON.parse(res.rawBody)).toEqual([]);
  });

  it('t19: tree tanpa MARRIAGE menghasilkan array kosong', async () => {
    mockAuthOk();
    prismaMock.lifeEvent.findMany.mockResolvedValue([]);
    const res = await call(PATH, { authorization: authHeader('user-1') });
    expect(res.status).toBe(200);
    expect(JSON.parse(res.rawBody)).toEqual([]);
  });
});
