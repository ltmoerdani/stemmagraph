/**
 * Test dedikasi route export JSON v402 AC3
 * (GET /api/v1/trees/:treeId/export/json).
 *
 * Pola merge-approval-api.test.ts (v392): prisma di-mock penuh lewat
 * vi.hoisted, server express asli di-listen port ephemeral, fetch
 * native. Port digeser ke 39400 agar tidak bentrok file test server
 * lain saat paralel.
 *
 * Kasus: 401 tanpa auth, 404 tree nihil, 200 clean default
 * (schemaVersion, attachment, redaksi [Living]), mode full owner 200
 * tanpa redaksi, mode full non-owner 403, mode invalid 422, filename
 * disanitasi.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import jwt from 'jsonwebtoken';

const prismaMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  familyTree: { findUnique: vi.fn(), findFirst: vi.fn() },
  treeMember: { findUnique: vi.fn() },
  familyMember: { findMany: vi.fn() },
  familyRelationship: { findMany: vi.fn() },
}));

vi.mock('../../server/db', () => ({ prisma: prismaMock }));

const JWT_SECRET = 'dev-only-insecure-secret-change-me';

function authHeader(userId: string): string {
  return `Bearer ${jwt.sign({ sub: userId }, JWT_SECRET)}`;
}

const USER = { id: 'user-1', email: 'u1@example.test', status: 'active', role: 'member' };
const TREE = { id: 'tree-1', name: 'Keluarga Besar' };

function memberRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'm-1', treeId: 'tree-1', name: 'Budi Santoso', nickname: null,
    marga: 'Santoso', birthDate: '1970-01-01', deathDate: null,
    haulOverrideDate: null, birthDateGed: null, deathDateGed: null,
    birthPlace: 'Solo', currentLocation: null, profession: null,
    education: null, gender: 'male', sexGed: null, photoUrl: null,
    email: 'budi@example.test', phone: null, isAlive: true,
    privacyStatus: null, generation: 2, maritalStatus: 'married',
    mergedIntoId: null, mergedAt: null, mergeJournal: null,
    notes: null, createdAt: new Date('2020-01-01T00:00:00Z'),
    updatedAt: new Date('2020-01-01T00:00:00Z'),
    ...overrides,
  };
}

const MEMBERS = [
  memberRow(),
  memberRow({
    id: 'm-2', name: 'Siti Aminah', marga: null, gender: 'female',
    birthDate: '1995-03-01', email: 'siti@example.test', phone: '0812',
    isAlive: true, privacyStatus: 'private', maritalStatus: 'single',
    notes: 'rahasia', birthPlace: null,
  }),
];

const RELS = [
  { id: 'r-1', treeId: 'tree-1', memberId: 'm-1', relatedId: 'm-2', type: 'spouse' },
];

/** Guard view_tree lolos: user aktif, tree ada, role tertentu. */
function mockGuard(role: 'viewer' | 'editor' | 'owner'): void {
  prismaMock.user.findUnique.mockResolvedValue(USER);
  prismaMock.familyTree.findUnique.mockResolvedValue(TREE);
  prismaMock.treeMember.findUnique.mockResolvedValue({
    id: 'tm-1', userId: 'user-1', treeId: 'tree-1', role,
  });
  prismaMock.familyMember.findMany.mockResolvedValue(MEMBERS);
  prismaMock.familyRelationship.findMany.mockResolvedValue(RELS);
}

const PATH = '/api/v1/trees/tree-1/export/json';

let BASE = '';
let serverHandle: import('node:http').Server | undefined;

interface GetResult {
  status: number;
  text: string;
  headers: Record<string, string>;
}

async function get(path: string, headers: Record<string, string> = {}): Promise<GetResult> {
  const res = await fetch(`${BASE}${path}`, { headers });
  const text = await res.text();
  const headersObj: Record<string, string> = {};
  res.headers.forEach((v, k) => { headersObj[k] = v; });
  return { status: res.status, text, headers: headersObj };
}

beforeEach(() => {
  vi.clearAllMocks();
});

beforeAll(async () => {
  const port = 39400 + (process.pid % 600);
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

describe('GET /api/v1/trees/:treeId/export/json (v402)', () => {
  it('401 tanpa Authorization header', async () => {
    const r = await get(PATH);
    expect(r.status).toBe(401);
    const body = JSON.parse(r.text) as { code: string };
    expect(body.code).toBe('UNAUTHORIZED');
  });

  it('404 ketika tree tidak ada', async () => {
    prismaMock.user.findUnique.mockResolvedValue(USER);
    prismaMock.familyTree.findUnique.mockResolvedValue(null);
    const r = await get(PATH, { authorization: authHeader('user-1') });
    expect(r.status).toBe(404);
  });

  it('200 clean default: schemaVersion, attachment, redaksi [Living] untuk anggota hidup private', async () => {
    mockGuard('viewer');
    const r = await get(PATH, { authorization: authHeader('user-1') });
    expect(r.status).toBe(200);
    expect(r.headers['content-type']).toContain('application/json');
    expect(r.headers['content-disposition']).toContain('attachment');
    expect(r.headers['content-disposition']).toContain('.json"');
    expect(r.headers['x-content-type-options']).toBe('nosniff');
    expect(r.headers['cache-control']).toBe('no-store');
    const doc = JSON.parse(r.text) as {
      schemaVersion: string;
      privacy: { mode: string };
      members: Array<{ id: string; name: string; redacted: boolean }>;
      relationships: unknown[];
    };
    expect(doc.schemaVersion).toBe('stemmagraph-tree-export/1');
    expect(doc.privacy.mode).toBe('clean');
    const siti = doc.members.find((m) => m.id === 'm-2');
    expect(siti?.redacted).toBe(true);
    expect(siti?.name).toBe('[Living]');
    expect(doc.relationships).toHaveLength(1);
  });

  it('200 mode full owner: tanpa redaksi', async () => {
    mockGuard('owner');
    const r = await get(`${PATH}?mode=full`, { authorization: authHeader('user-1') });
    expect(r.status).toBe(200);
    const doc = JSON.parse(r.text) as {
      privacy: { mode: string };
      members: Array<{ id: string; name: string; redacted: boolean; email?: string }>;
    };
    expect(doc.privacy.mode).toBe('full');
    expect(doc.members.every((m) => !m.redacted)).toBe(true);
    const siti = doc.members.find((m) => m.id === 'm-2');
    expect(siti?.name).toBe('Siti Aminah');
    expect(siti?.email).toBe('siti@example.test');
  });

  it('403 mode full non-owner (viewer)', async () => {
    mockGuard('viewer');
    const r = await get(`${PATH}?mode=full`, { authorization: authHeader('user-1') });
    expect(r.status).toBe(403);
    const body = JSON.parse(r.text) as { code: string };
    expect(body.code).toBe('FORBIDDEN_FULL_EXPORT');
  });

  it('422 mode invalid', async () => {
    mockGuard('viewer');
    const r = await get(`${PATH}?mode=bronze`, { authorization: authHeader('user-1') });
    expect(r.status).toBe(422);
    const body = JSON.parse(r.text) as { code: string };
    expect(body.code).toBe('INVALID_MODE');
  });

  it('filename disanitasi: nama tree dengan karakter khusus menjadi aman', async () => {
    mockGuard('viewer');
    prismaMock.familyTree.findUnique.mockResolvedValue({ id: 'tree-1', name: 'Keluarga / Besar <Gedung> "A"' });
    const r = await get(PATH, { authorization: authHeader('user-1') });
    expect(r.status).toBe(200);
    const cd = r.headers['content-disposition'] ?? '';
    expect(cd).toContain('attachment');
    const m = cd.match(/filename="([^"]*)"/);
    expect(m).not.toBeNull();
    const fname = m?.[1] ?? '';
    expect(fname).not.toMatch(/[<>"\\/:|?*]/);
    expect(fname.endsWith('.json')).toBe(true);
    expect(fname).toMatch(/^[A-Za-z0-9-_]+-\d{8}\.json$/);
  });
});
