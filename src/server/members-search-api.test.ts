/**
 * Test dedikasi pencarian dan filter anggota sisi server v401
 * (GET /api/v1/trees/:treeId/members dengan query q, living, marga, sort).
 *
 * Pola persis src/server/duplicates-api.test.ts (v388): prisma di-mock
 * penuh lewat vi.hoisted supaya server/index.ts bisa diimpor tanpa
 * DATABASE_URL dan tanpa generated prisma client. Server express asli
 * dilisten di port ephemeral lalu diakses via fetch native.
 *
 * AC kontrak v401: filter di level database (where findMany diverifikasi
 * lewat argumen panggilan), tanpa parameter respons identik baseline,
 * q substring case-insensitive nama depan dan belakang (LIKE SQLite),
 * marga exact match, living true false konsisten isAlive, sort=name
 * localeCompare id dengan tie-break id, 422 untuk nilai param tidak valid.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import express from 'express';
import jwt from 'jsonwebtoken';

const prismaMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  familyTree: { findUnique: vi.fn() },
  treeMember: { findUnique: vi.fn() },
  familyMember: { findMany: vi.fn() },
  familyRelationship: { findMany: vi.fn() },
}));

vi.mock('../../server/db', () => ({ prisma: prismaMock }));

const JWT_SECRET = 'dev-only-insecure-secret-change-me';

function authHeader(userId: string): string {
  return 'Bearer ' + jwt.sign({ sub: userId }, JWT_SECRET);
}

const USER = { id: 'user-1', email: 'u@example.test', status: 'active', role: 'owner' };
const TREE = { id: 'tree-1' };

const PATH = '/api/v1/trees/tree-1/members';

let BASE = '';
let serverHandle: import('node:http').Server | undefined;

interface GetResult {
  status: number;
  body: Record<string, unknown>;
}

async function get(path: string): Promise<GetResult> {
  const res = await fetch(BASE + path, { headers: { Authorization: authHeader('user-1') } });
  const text = await res.text();
  return {
    status: res.status,
    body: text.length === 0 ? {} : (JSON.parse(text) as Record<string, unknown>),
  };
}

/** mock guard lolos: user owner tree, anggota role viewer. */
function mockGuardAman(): void {
  prismaMock.user.findUnique.mockResolvedValue(USER);
  prismaMock.familyTree.findUnique.mockResolvedValue(TREE);
  prismaMock.treeMember.findUnique.mockResolvedValue({ id: 'tm-1', userId: 'user-1', treeId: 'tree-1', role: 'viewer' });
  prismaMock.familyRelationship.findMany.mockResolvedValue([]);
}

let seq = 0;
function makeMember(over: Record<string, unknown>): Record<string, unknown> {
  seq += 1;
  return {
    id: 'm' + String(seq).padStart(3, '0'),
    treeId: 'tree-1',
    name: 'Tanpa Nama',
    nickname: null,
    marga: null,
    birthDate: '1950-01-01',
    deathDate: null,
    haulOverrideDate: null,
    birthPlace: null,
    currentLocation: null,
    profession: null,
    education: null,
    gender: 'U',
    sexGed: null,
    photoUrl: null,
    email: null,
    phone: null,
    isAlive: false,
    generation: 1,
    maritalStatus: null,
    notes: null,
    privacyStatus: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...over,
  };
}

function lastFindManyWhere(): Record<string, unknown> {
  const calls = prismaMock.familyMember.findMany.mock.calls;
  const last = calls[calls.length - 1] as Array<{ where: Record<string, unknown> }>;
  return last[0].where;
}

beforeAll(async () => {
  const port = 39900 + (process.pid % 600);
  BASE = 'http://127.0.0.1:' + String(port);
  process.env['API_PORT'] = String(port);
  const proto = (express as unknown as { application: { listen: (...a: unknown[]) => import('node:http').Server } }).application;
  const origListen = proto.listen;
  proto.listen = function (this: unknown, ...args: unknown[]) {
    serverHandle = origListen.apply(this, args);
    return serverHandle;
  } as typeof proto.listen;
  await import('../../server/index');
  const deadline = Date.now() + 8000;
  for (;;) {
    try {
      await fetch(BASE + '/');
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

describe('GET /api/v1/trees/:treeId/members dengan query v401', () => {
  it('tanpa parameter: where hanya treeId, respons identik baseline', async () => {
    mockGuardAman();
    // self (email = viewer) dan mendiang keduanya dapat full visibility,
    // jadi bentuk respons deterministik tanpa menyentuh relasi.
    const rows = [
      makeMember({ id: 'm-self', name: 'Siti Mariam', email: 'u@example.test', isAlive: true, privacyStatus: 'private' }),
      makeMember({ id: 'm-dead', name: 'Wahyu Sakti', isAlive: false }),
    ];
    prismaMock.familyMember.findMany.mockResolvedValue(rows);
    const out = await get(PATH);
    expect(lastFindManyWhere()).toEqual({ treeId: 'tree-1' });
    expect(out.status).toBe(200);
    const arr = out.body as unknown as Array<Record<string, unknown>>;
    expect(Array.isArray(arr)).toBe(true);
    expect(arr.map((m) => m['id'])).toEqual(['m-self', 'm-dead']);
    expect(arr[0]!['name']).toBe('Siti Mariam');
    expect(arr[0]!['birthDate']).toBe('1950-01-01');
  });

  it('q parsial diteruskan ke database sebagai contains nama depan', async () => {
    mockGuardAman();
    prismaMock.familyMember.findMany.mockResolvedValue([]);
    await get(PATH + '?q=And');
    expect(lastFindManyWhere()).toEqual({ treeId: 'tree-1', name: { contains: 'And' } });
  });

  it('q parsial cocok nama belakang: contains dipakai di kolom name utuh', async () => {
    mockGuardAman();
    // DB (LIKE SQLite) yang memfilter; mock mengembalikan satu baris hasil
    // filter nama belakang untuk memastikan jalur respons tidak mengubah
    // hasil query.
    prismaMock.familyMember.findMany.mockResolvedValue([
      makeMember({ id: 'm-1', name: 'Andi Sitompul', isAlive: false }),
    ]);
    await get(PATH + '?q=ompul');
    expect(lastFindManyWhere()).toEqual({ treeId: 'tree-1', name: { contains: 'ompul' } });
    const out = await get(PATH + '?q=ompul');
    const arr = out.body as unknown as Array<Record<string, unknown>>;
    expect(arr.map((m) => m['id'])).toEqual(['m-1']);
  });

  it('q kosong atau whitespace: tanpa filter name', async () => {
    mockGuardAman();
    prismaMock.familyMember.findMany.mockResolvedValue([]);
    await get(PATH + '?q=');
    expect(lastFindManyWhere()).toEqual({ treeId: 'tree-1' });
    await get(PATH + '?q=%20%20');
    expect(lastFindManyWhere()).toEqual({ treeId: 'tree-1' });
  });

  it('marga exact match: equals dipakai, bukan contains', async () => {
    mockGuardAman();
    prismaMock.familyMember.findMany.mockResolvedValue([]);
    await get(PATH + '?marga=Sitompul');
    expect(lastFindManyWhere()).toEqual({ treeId: 'tree-1', marga: { equals: 'Sitompul' } });
  });

  it('living true dan living false: isAlive diteruskan sebagai boolean', async () => {
    mockGuardAman();
    prismaMock.familyMember.findMany.mockResolvedValue([]);
    await get(PATH + '?living=true');
    expect(lastFindManyWhere()).toEqual({ treeId: 'tree-1', isAlive: true });
    await get(PATH + '?living=false');
    expect(lastFindManyWhere()).toEqual({ treeId: 'tree-1', isAlive: false });
  });

  it('kombinasi q living marga: semua masuk where sekali query', async () => {
    mockGuardAman();
    prismaMock.familyMember.findMany.mockResolvedValue([]);
    await get(PATH + '?q=sit&living=false&marga=Sitompul');
    expect(lastFindManyWhere()).toEqual({
      treeId: 'tree-1',
      name: { contains: 'sit' },
      isAlive: false,
      marga: { equals: 'Sitompul' },
    });
  });

  it('sort=name: urutan localeCompare id deterministik dengan tie-break id', async () => {
    mockGuardAman();
    prismaMock.familyMember.findMany.mockResolvedValue([
      makeMember({ id: 'a-5', name: 'Budi Santoso', isAlive: false }),
      makeMember({ id: 'z-9', name: 'Budi Santoso', isAlive: false }),
      makeMember({ id: 'm-3', name: 'andi saputra', isAlive: false }),
      makeMember({ id: 'c-2', name: 'candra wijaya', isAlive: false }),
    ]);
    const first = (await get(PATH + '?sort=name')).body as unknown as Array<Record<string, unknown>>;
    const second = (await get(PATH + '?sort=name')).body as unknown as Array<Record<string, unknown>>;
    // andi < Budi < candra pada locale id; dua Budi Santoso identik penuh
    // dipecah lewat tie-break id leksikograf (a-5 sebelum z-9).
    expect(first.map((m) => m['id'])).toEqual(['m-3', 'a-5', 'z-9', 'c-2']);
    // stabil: dua permintaan hasil identik persis
    expect(first).toEqual(second);
  });

  it('tanpa sort: urutan hasil mengikuti query (generation asc) seperti baseline', async () => {
    mockGuardAman();
    prismaMock.familyMember.findMany.mockResolvedValue([
      makeMember({ id: 'gen-2', name: 'Anak', generation: 2, isAlive: false }),
      makeMember({ id: 'gen-1', name: 'Orang Tua', generation: 1, isAlive: false }),
    ]);
    const out = await get(PATH);
    const arr = out.body as unknown as Array<Record<string, unknown>>;
    expect(arr.map((m) => m['id'])).toEqual(['gen-2', 'gen-1']);
  });

  it('422 nilai param tidak valid: living di luar true false, sort asing, q array', async () => {
    mockGuardAman();
    const badLiving = await get(PATH + '?living=yes');
    expect(badLiving.status).toBe(422);
    expect((badLiving.body as { code?: string }).code).toBe('INVALID_LIVING');
    const badSort = await get(PATH + '?sort=generation');
    expect(badSort.status).toBe(422);
    expect((badSort.body as { code?: string }).code).toBe('INVALID_SORT');
    const badQ = await get(PATH + '?q=a&q=b');
    expect(badQ.status).toBe(422);
    expect((badQ.body as { code?: string }).code).toBe('INVALID_Q');
  });
});
