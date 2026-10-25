/**
 * Test dedikasi v399: route GET /api/v1/trees/:treeId/places/distribution.
 *
 * Pola persis src/server/photo-api.test.ts (v398): prisma di-mock penuh
 * lewat vi.hoisted supaya server/index.ts bisa diimpor tanpa
 * DATABASE_URL, server express asli dilisten port ephemeral lalu
 * diakses via fetch native.
 *
 * Cakupan: 401 challenge Bearer, 403 FORBIDDEN_TREE non-anggota,
 * 404 tree nihil, semua role anggota (owner, editor, viewer) 200,
 * payload murni {points,totalPlaced,excludedNoCoords} dengan titik
 * {lat,lng,count} tanpa identitas place/anggota, pembulatan 2 desimal,
 * Cache-Control private, ETag + If-None-Match 304.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import jwt from 'jsonwebtoken';

const prismaMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  familyTree: { findUnique: vi.fn() },
  treeMember: { findUnique: vi.fn() },
  place: { findMany: vi.fn() },
}));

vi.mock('../../server/db', () => ({ prisma: prismaMock }));

const JWT_SECRET = 'dev-only-insecure-secret-change-me';

function authHeader(userId: string): string {
  return `Bearer ${jwt.sign({ sub: userId }, JWT_SECRET)}`;
}

const USER_1 = { id: 'user-1', email: 'u1@example.test', status: 'active', role: 'member' };
const TREE = { id: 'tree-1' };

function placesFixture(): Array<{ latitude: number | null; longitude: number | null }> {
  return [
    { latitude: -6.20881, longitude: 106.84559 },
    { latitude: -6.20903, longitude: 106.84521 },
    { latitude: 40.7128, longitude: -74.006 },
    { latitude: null, longitude: null },
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
  etag: string | null;
  wwwAuth: string | null;
}

async function call(path = '/api/v1/trees/tree-1/places/distribution', withAuth = true, extraHeaders: Record<string, string> = {}): Promise<ApiResult> {
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      ...(withAuth ? { authorization: authHeader('user-1') } : {}),
      ...extraHeaders,
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
    etag: res.headers.get('etag'),
    wwwAuth: res.headers.get('www-authenticate'),
  };
}

beforeAll(async () => {
  const port = 37000 + Math.floor(Math.random() * 2000);
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
});

afterAll(async () => {
  if (serverHandle) {
    await new Promise<void>((resolve) => serverHandle!.close(() => resolve()));
  }
});

beforeEach(() => {
  vi.clearAllMocks();
  mockRole('editor');
  prismaMock.place.findMany.mockResolvedValue(placesFixture());
});

describe('GET /api/v1/trees/:treeId/places/distribution', () => {
  it('401 tanpa Authorization dengan challenge Bearer', async () => {
    const res = await call('/api/v1/trees/tree-1/places/distribution', false);
    expect(res.status).toBe(401);
    expect(res.body['code']).toBe('UNAUTHORIZED');
    expect(res.wwwAuth).toBe('Bearer');
  });

  it('403 non-anggota tree', async () => {
    mockNonMember();
    const res = await call();
    expect(res.status).toBe(403);
    expect(res.body['code']).toBe('FORBIDDEN_TREE');
    expect(prismaMock.place.findMany).not.toHaveBeenCalled();
  });

  it('404 tree tidak ada', async () => {
    mockRole('viewer');
    prismaMock.familyTree.findUnique.mockResolvedValue(null);
    const res = await call('/api/v1/trees/tree-404/places/distribution');
    expect(res.status).toBe(404);
    expect(res.body['code']).toBe('NOT_FOUND');
  });

  it.each(['owner', 'editor', 'viewer'] as const)('role %s boleh melihat (200)', async (role) => {
    mockRole(role);
    const res = await call();
    expect(res.status).toBe(200);
    const points = res.body['points'] as Array<Record<string, unknown>>;
    expect(res.body['totalPlaced']).toBe(3);
    expect(res.body['excludedNoCoords']).toBe(1);
    expect(points).toHaveLength(2);
  });

  it('payload murni {lat,lng,count} dengan pembulatan 2 desimal, tanpa identitas', async () => {
    const res = await call();
    expect(res.status).toBe(200);
    const points = res.body['points'] as Array<Record<string, unknown>>;
    expect(points[0]).toEqual({ lat: -6.21, lng: 106.85, count: 2 });
    expect(points[1]).toEqual({ lat: 40.71, lng: -74.01, count: 1 });
    for (const point of points) {
      expect(Object.keys(point).sort()).toEqual(['count', 'lat', 'lng']);
    }
    expect(Object.keys(res.body).sort()).toEqual(['excludedNoCoords', 'points', 'totalPlaced']);
    const serialized = JSON.stringify(res.body);
    expect(serialized).not.toContain('displayName');
    expect(serialized).not.toContain('normalizedName');
    expect(serialized).not.toContain('member');
  });

  it('Cache-Control private tanpa max-age positif', async () => {
    const res = await call();
    expect(res.status).toBe(200);
    expect(res.cacheControl).toContain('private');
    expect(/max-age=\d/.test(res.cacheControl ?? '')).toBe(false);
    expect(res.cacheControl).not.toContain('s-maxage');
  });

  it('If-None-Match cocok dijawab 304 tanpa body', async () => {
    const first = await call();
    expect(first.status).toBe(200);
    expect(first.etag).toBeTruthy();
    const second = await call('/api/v1/trees/tree-1/places/distribution', true, {
      'if-none-match': first.etag ?? '',
    });
    expect(second.status).toBe(304);
  });

  it('select prisma hanya latitude longitude', async () => {
    await call();
    expect(prismaMock.place.findMany).toHaveBeenCalledWith({
      where: { treeId: 'tree-1' },
      select: { latitude: true, longitude: true },
    });
  });
});
