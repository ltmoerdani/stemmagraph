/**
 * Test dedikasi v413 AC3: route GET /api/v1/trees/:treeId/stats/distribution.
 *
 * Pola persis src/server/places-distribution-api.test.ts (v399): prisma
 * di-mock penuh lewat vi.hoisted supaya server/index.ts bisa diimpor
 * tanpa DATABASE_URL, server express asli dilisten port ephemeral lalu
 * diakses via fetch native.
 *
 * Cakupan: 200 agregat multi negara dengan k-anonymity k 3 (region di
 * bawah ambang hilang, negara lolos), pohon tanpa place, anggota hidup
 * privacyStatus private dikeluarkan dari hitungan, negara di bawah
 * ambang hilang total, 401 challenge Bearer, 403 FORBIDDEN_TREE,
 * 404 tree nihil, Cache-Control private, select prisma minimum.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import jwt from 'jsonwebtoken';

const prismaMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  familyTree: { findUnique: vi.fn() },
  treeMember: { findUnique: vi.fn() },
  familyMember: { findMany: vi.fn() },
}));

vi.mock('../../server/db', () => ({ prisma: prismaMock }));

const JWT_SECRET = 'dev-only-insecure-secret-change-me';

function authHeader(userId: string): string {
  return `Bearer ${jwt.sign({ sub: userId }, JWT_SECRET)}`;
}

const USER_1 = { id: 'user-1', email: 'u1@example.test', status: 'active', role: 'member' };
const TREE = { id: 'tree-1' };

interface MemberRow {
  birthPlace: string | null;
  currentLocation: string | null;
  isAlive: boolean;
  privacyStatus: string;
}

function member(place: { birth?: string | null; current?: string | null }, privacy = 'public'): MemberRow {
  return {
    birthPlace: place.birth ?? null,
    currentLocation: place.current ?? null,
    isAlive: true,
    privacyStatus: privacy,
  };
}

// Indonesia x5: Jawa Barat x3 (lolos), Jawa Timur x2 (region hilang).
// Malaysia x3 (lolos, tiap region cuma 1 jadi kosong). Singapura x1
// (negara hilang, di bawah ambang). Satu anggota tanpa place.
function membersFixture(): MemberRow[] {
  return [
    member({ birth: 'Bandung, Jawa Barat, Indonesia' }),
    member({ birth: 'Bekasi, Jawa Barat, Indonesia' }),
    member({ birth: 'Bogor, Jawa Barat, Indonesia' }),
    member({ birth: 'Surabaya, Jawa Timur, Indonesia' }),
    member({ birth: 'Malang, Jawa Timur, Indonesia' }),
    member({ birth: 'Kuala Lumpur, Malaysia' }),
    member({ birth: 'Shah Alam, Selangor, Malaysia' }),
    member({ current: 'Johor Bahru, Malaysia' }),
    member({ birth: 'Singapore' }),
    member({}),
  ];
}

function mockRole(role: string): void {
  prismaMock.user.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) =>
    where.id === 'user-1' ? USER_1 : null,
  );
  prismaMock.familyTree.findUnique.mockResolvedValue(TREE);
  prismaMock.treeMember.findUnique.mockResolvedValue({
    id: 'tm-1',
    userId: 'user-1',
    treeId: 'tree-1',
    role,
  });
}

function mockNonMember(): void {
  prismaMock.user.findUnique.mockResolvedValue(USER_1);
  prismaMock.familyTree.findUnique.mockResolvedValue(TREE);
  prismaMock.treeMember.findUnique.mockResolvedValue(null);
}

let BASE = '';
let serverHandle: import('node:http').Server | undefined;

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
  cacheControl: string | null;
  wwwAuth: string | null;
}

async function call(path = '/api/v1/trees/tree-1/stats/distribution', withAuth = true): Promise<ApiResult> {
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      ...(withAuth ? { authorization: authHeader('user-1') } : {}),
    },
  });
  const text = await res.text();
  let body: Record<string, unknown> = {};
  try {
    body = JSON.parse(text) as Record<string, unknown>;
  } catch {
    body = { raw: text };
  }
  return {
    status: res.status,
    body,
    cacheControl: res.headers.get('cache-control'),
    wwwAuth: res.headers.get('www-authenticate'),
  };
}

// Timeout eksplisit: import server/index.ts plus ics-rotation initial pass
// bisa melampaui hookTimeout default 10 detik di mesin lambat.
beforeAll(async () => {
  const port = 39000 + Math.floor(Math.random() * 2000);
  BASE = `http://127.0.1:${port}`;
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
}, 30000);

afterAll(async () => {
  if (serverHandle) {
    await new Promise<void>((resolve) => serverHandle!.close(() => resolve()));
  }
});

beforeEach(() => {
  vi.clearAllMocks();
  mockRole('editor');
  prismaMock.familyMember.findMany.mockResolvedValue(membersFixture());
});

describe('GET /api/v1/trees/:treeId/stats/distribution', () => {
  it('401 tanpa Authorization dengan challenge Bearer', async () => {
    const res = await call('/api/v1/trees/tree-1/stats/distribution', false);
    expect(res.status).toBe(401);
    expect(res.body['code']).toBe('UNAUTHORIZED');
    expect(res.wwwAuth).toBe('Bearer');
  });

  it('403 non-anggota tree, query familyMember tidak dijalankan', async () => {
    mockNonMember();
    const res = await call();
    expect(res.status).toBe(403);
    expect(res.body['code']).toBe('FORBIDDEN_TREE');
    expect(prismaMock.familyMember.findMany).not.toHaveBeenCalled();
  });

  it('404 tree tidak ada', async () => {
    mockRole('viewer');
    prismaMock.familyTree.findUnique.mockResolvedValue(null);
    const res = await call('/api/v1/trees/tree-404/stats/distribution');
    expect(res.status).toBe(404);
    expect(res.body['code']).toBe('NOT_FOUND');
  });

  it('200 agregat multi negara: Indonesia x5 lolos, region Jawa Timur x2 hilang, Singapura x1 hilang', async () => {
    const res = await call();
    expect(res.status).toBe(200);
    const countries = res.body['countries'] as Array<Record<string, unknown>>;
    expect(res.body['totalWithPlace']).toBe(9);
    expect(res.body['excludedNoPlace']).toBe(1);
    expect(countries).toEqual([
      {
        country: 'indonesia',
        count: 5,
        regions: [{ region: 'jawa barat', count: 3 }],
      },
      { country: 'malaysia', count: 3, regions: [] },
    ]);
  });

  it('pohon tanpa place: countries kosong, excludedNoPlace menghitung semua', async () => {
    prismaMock.familyMember.findMany.mockResolvedValue([
      member({}),
      member({ birth: null, current: null }),
      member({ birth: '   ' }),
      member({}),
    ]);
    const res = await call();
    expect(res.status).toBe(200);
    expect(res.body['countries']).toEqual([]);
    expect(res.body['totalWithPlace']).toBe(0);
    expect(res.body['excludedNoPlace']).toBe(4);
  });

  it('anggota isAlive privacyStatus private dikeluarkan dari hitungan', async () => {
    // Satu private ekstra di Jawa Barat: bila dihitung, Indonesia jadi 6
    // dan Jawa Barat 4. Harapan: tetap 5 dan 3, total 9.
    prismaMock.familyMember.findMany.mockResolvedValue([
      ...membersFixture(),
      member({ birth: 'Depok, Jawa Barat, Indonesia' }, 'private'),
    ]);
    const res = await call();
    expect(res.status).toBe(200);
    const countries = res.body['countries'] as Array<Record<string, unknown>>;
    expect(res.body['totalWithPlace']).toBe(9);
    expect(countries[0]).toEqual({
      country: 'indonesia',
      count: 5,
      regions: [{ region: 'jawa barat', count: 3 }],
    });
  });

  it('country dengan count di bawah 3 hilang total dari countries', async () => {
    prismaMock.familyMember.findMany.mockResolvedValue([
      member({ birth: 'Bandung, Jawa Barat, Indonesia' }),
      member({ birth: 'Semarang, Jawa Tengah, Indonesia' }),
      member({ birth: 'Denpasar, Bali, Indonesia' }),
      member({ birth: 'Hanoi, Vietnam' }),
      member({ birth: 'Da Nang, Vietnam' }),
    ]);
    const res = await call();
    expect(res.status).toBe(200);
    const countries = res.body['countries'] as Array<Record<string, unknown>>;
    expect(countries).toEqual([
      {
        country: 'indonesia',
        count: 3,
        regions: [],
      },
    ]);
    expect(JSON.stringify(res.body)).not.toContain('vietnam');
    expect(res.body['totalWithPlace']).toBe(5);
    expect(res.body['excludedNoPlace']).toBe(0);
  });

  it('Cache-Control private tanpa max-age positif', async () => {
    const res = await call();
    expect(res.status).toBe(200);
    expect(res.cacheControl).toContain('private');
    expect(/max-age=\d/.test(res.cacheControl ?? '')).toBe(false);
    expect(res.cacheControl).not.toContain('s-maxage');
  });

  it('select prisma hanya field agregasi tanpa identitas anggota', async () => {
    await call();
    expect(prismaMock.familyMember.findMany).toHaveBeenCalledWith({
      where: { treeId: 'tree-1' },
      select: { birthPlace: true, currentLocation: true, isAlive: true, privacyStatus: true },
    });
    const serialized = JSON.stringify(await call().then((r) => r.body));
    expect(serialized).not.toContain('displayName');
    expect(serialized).not.toContain('birthDate');
  });
});
