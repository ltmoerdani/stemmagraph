/**
 * Test dedikasi v273 fase i: upcoming birthdays (endpoint read-only).
 *
 * Harness pola preseden living-stats-hardening.test.ts: prisma di-mock penuh
 * lewat vi.hoisted, server express asli dilisten di port ephemeral (rentang
 * 39900 supaya aman paralel dengan baseline 39200 dan hardening 39600),
 * diakses via fetch native tanpa dependency baru.
 *
 * Kasus wajib kontrak: tepat hari ini; besok; hari ke-30 masuk (inklusif);
 * hari ke-31 keluar; 29 Feb kabisat lanjut 1 Mar pada tahun non-kabisat;
 * birthDate rusak dikecualikan di level modul; days=0 ditolak; days=366
 * ditolak; days=365 sah; urutan naik plus tie-break displayName alfabetis;
 * tree tanpa living = array kosong; determinisme now terinjeksi; header 200
 * Cache-Control private no-cache plus ETag weak; If-None-Match sama dijawab
 * 304 tanpa body (dengan dan tanpa prefix W/).
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import express from 'express';
import jwt from 'jsonwebtoken';
import { computeUpcomingBirthdays } from './upcoming-birthdays';

const prismaMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  familyTree: { findUnique: vi.fn() },
  treeMember: { findUnique: vi.fn() },
  familyMember: { findMany: vi.fn() },
}));

vi.mock('../../../server/db', () => ({ prisma: prismaMock }));

const JWT_SECRET = 'dev-only-insecure-secret-change-me';

function authHeader(userId: string): string {
  return `Bearer ${jwt.sign({ sub: userId }, JWT_SECRET)}`;
}

const USER = { id: 'user-1', email: 'u@example.test', status: 'active', role: 'owner' };
const TREE = { id: 'tree-1' };

const PATH = '/api/v1/trees/tree-1/stats/birthdays/upcoming';

interface Outcome {
  status: number;
  headers: Record<string, string>;
  rawBody: string;
}

let BASE = '';
let serverHandle: import('node:http').Server | undefined;

beforeAll(async () => {
  const port = 39900 + (process.pid % 600);
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

describe('upcoming-birthdays modul pure (v273)', () => {
  const M = (id: string, name: string, birth: string) => ({ personId: id, displayName: name, birthDate: birth });

  it('t1: ulang tahun tepat hari query masuk dengan daysUntil 0', () => {
    const out = computeUpcomingBirthdays([M('p1', 'Ani', '1990-06-15')], NOW, 30);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ personId: 'p1', daysUntil: 0, turningAge: 36, nextBirthday: '2026-06-15' });
  });

  it('t2: ulang tahun besok daysUntil 1', () => {
    const out = computeUpcomingBirthdays([M('p1', 'Ani', '1990-06-16')], NOW, 30);
    expect(out[0]).toMatchObject({ daysUntil: 1, turningAge: 36, nextBirthday: '2026-06-16' });
  });

  it('t3: hari ke-30 masuk (jendela inklusif)', () => {
    const out = computeUpcomingBirthdays([M('p1', 'Ani', '1990-07-15')], NOW, 30);
    expect(out[0]).toMatchObject({ daysUntil: 30, nextBirthday: '2026-07-15' });
  });

  it('t4: hari ke-31 keluar', () => {
    const out = computeUpcomingBirthdays([M('p1', 'Ani', '1990-07-16')], NOW, 30);
    expect(out).toHaveLength(0);
  });

  it('t5: 29 Feb kabisat lanjut 1 Mar pada tahun non-kabisat', () => {
    const out = computeUpcomingBirthdays([M('p1', 'Budi', '2000-02-29')], new Date(Date.UTC(2027, 1, 20)), 30);
    expect(out[0]).toMatchObject({ nextBirthday: '2027-03-01', daysUntil: 9, turningAge: 27 });
  });

  it('t6: birthDate rusak dikecualikan senyap', () => {
    const out = computeUpcomingBirthdays([M('p1', 'Ani', 'bukan-tanggal'), M('p2', 'Budi', '1900-02-30')], NOW, 30);
    expect(out).toHaveLength(0);
  });

  it('t7: urutan naik daysUntil plus tie-break displayName alfabetis', () => {
    const out = computeUpcomingBirthdays(
      [M('p1', 'Cici', '1990-06-17'), M('p2', 'Ani', '1980-06-17'), M('p3', 'Budi', '1970-06-16')],
      NOW,
      30,
    );
    expect(out.map((o) => o.personId)).toEqual(['p3', 'p2', 'p1']);
  });

  it('t8: input kosong menghasilkan array kosong (determinisme)', () => {
    expect(computeUpcomingBirthdays([], NOW, 30)).toEqual([]);
    expect(computeUpcomingBirthdays([M('p1', 'Ani', '1990-06-15')], NOW, 30)).toEqual(computeUpcomingBirthdays([M('p1', 'Ani', '1990-06-15')], NOW, 30));
  });

  it('t9: 29 Feb pada tahun kabisat tetap 29 Feb', () => {
    const out = computeUpcomingBirthdays([M('p1', 'Budi', '2000-02-29')], new Date(Date.UTC(2028, 1, 20)), 30);
    expect(out[0]).toMatchObject({ nextBirthday: '2028-02-29', turningAge: 28 });
  });
});

/* Bagian endpoint: otorisasi, validasi days, header hardening, 304. */

describe('upcoming-birthdays endpoint (v273)', () => {
  it('t10: 401 tanpa kredensial membawa WWW-Authenticate Bearer', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    const res = await call(PATH);
    expect(res.status).toBe(401);
    expect(res.headers['www-authenticate']).toBe('Bearer');
  });

  it('t11: 403 non-anggota tanpa WWW-Authenticate body pola repo', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ ...USER, role: 'member' });
    prismaMock.familyTree.findUnique.mockResolvedValue(TREE);
    prismaMock.treeMember.findUnique.mockResolvedValue(null);
    const res = await call(PATH, { authorization: authHeader('user-1') });
    expect(res.status).toBe(403);
    expect(res.headers['www-authenticate']).toBeUndefined();
    expect(JSON.parse(res.rawBody)).toHaveProperty('code', 'FORBIDDEN_TREE');
  });

  it('t12: 422 untuk days=0, days=366, dan non-integer', async () => {    prismaMock.user.findUnique.mockResolvedValue(USER);
    prismaMock.familyTree.findUnique.mockResolvedValue(TREE);
    prismaMock.treeMember.findUnique.mockResolvedValue({ role: 'owner' });
    for (const q of ['?days=0', '?days=366', '?days=abc', '?days=3.5']) {
      const res = await call(`${PATH}${q}`, { authorization: authHeader('user-1') });
      expect(res.status, q).toBe(422);
      expect(JSON.parse(res.rawBody)).toHaveProperty('code');
    }
  });

  it('t13: days=365 sah dan 200 membawa Cache-Control private no-cache plus ETag weak', async () => {
    prismaMock.user.findUnique.mockResolvedValue(USER);
    prismaMock.familyTree.findUnique.mockResolvedValue(TREE);
    prismaMock.treeMember.findUnique.mockResolvedValue({ role: 'owner' });
    prismaMock.familyMember.findMany.mockResolvedValue([
      { id: 'p1', name: 'Ani', birthDate: '1990-06-15' },
    ]);
    const res = await call(`${PATH}?days=365`, { authorization: authHeader('user-1') });
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('private, no-cache');
    expect(res.headers['etag']).toMatch(/^W\/"[0-9a-f]{64}"$/);
    const body = JSON.parse(res.rawBody);
    expect(Array.isArray(body)).toBe(true);
    expect(body[0]).toMatchObject({ personId: 'p1', displayName: 'Ani' });
    expect(body[0]).toHaveProperty('nextBirthday');
    expect(body[0]).toHaveProperty('daysUntil');
    expect(body[0]).toHaveProperty('turningAge');
  });

  it('t14: If-None-Match sama (weak) dijawab 304 tanpa body dengan ETag sama', async () => {
    prismaMock.user.findUnique.mockResolvedValue(USER);
    prismaMock.familyTree.findUnique.mockResolvedValue(TREE);
    prismaMock.treeMember.findUnique.mockResolvedValue({ role: 'owner' });
    prismaMock.familyMember.findMany.mockResolvedValue([
      { id: 'p1', name: 'Ani', birthDate: '1990-06-15' },
    ]);
    const first = await call(PATH, { authorization: authHeader('user-1') });
    const etag = first.headers['etag'];
    const second = await call(PATH, { authorization: authHeader('user-1'), 'if-none-match': etag });
    expect(second.status).toBe(304);
    expect(second.rawBody).toBe('');
    expect(second.headers['etag']).toBe(etag);
  });

  it('t15: If-None-Match tanpa prefix W/ tetap 304 (weak comparison)', async () => {
    prismaMock.user.findUnique.mockResolvedValue(USER);
    prismaMock.familyTree.findUnique.mockResolvedValue(TREE);
    prismaMock.treeMember.findUnique.mockResolvedValue({ role: 'owner' });
    prismaMock.familyMember.findMany.mockResolvedValue([
      { id: 'p1', name: 'Ani', birthDate: '1990-06-15' },
    ]);
    const first = await call(PATH, { authorization: authHeader('user-1') });
    const strongForm = first.headers['etag'].slice(2);
    const second = await call(PATH, { authorization: authHeader('user-1'), 'if-none-match': strongForm });
    expect(second.status).toBe(304);
  });

  it('t16: tree tanpa anggota living menghasilkan array kosong', async () => {
    prismaMock.user.findUnique.mockResolvedValue(USER);
    prismaMock.familyTree.findUnique.mockResolvedValue(TREE);
    prismaMock.treeMember.findUnique.mockResolvedValue({ role: 'owner' });
    prismaMock.familyMember.findMany.mockResolvedValue([]);
    const res = await call(PATH, { authorization: authHeader('user-1') });
    expect(res.status).toBe(200);
    expect(JSON.parse(res.rawBody)).toEqual([]);
  });
});
