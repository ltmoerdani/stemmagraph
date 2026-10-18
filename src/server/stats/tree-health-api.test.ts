/**
 * Test dedikasi route tree-health v293 fase ii
 * (GET /api/v1/trees/:treeId/stats/tree-health).
 *
 * Pola persis src/server/stats/marriage-months-api.test.ts (v291):
 * prisma di-mock penuh lewat vi.hoisted supaya server/index.ts bisa
 * diimpor tanpa DATABASE_URL dan tanpa generated prisma client.
 * Server express asli dilisten di port ephemeral (API_PORT) lalu
 * diakses via fetch native. Modul pure tree-health (v292) TIDAK
 * diubah; pemetaan graph dikerjakan server-side dari baris
 * relationship type 'parent', baris spouse diabaikan.
 *
 * AC kontrak kukuh v293: 401 challenge Bearer, 403 FORBIDDEN_TREE
 * tanpa WWW-Authenticate, 400 TREE_HEALTH_ROOT_REQUIRED untuk
 * rootId hilang atau kosong, 400 TREE_HEALTH_MAXGEN_INVALID untuk
 * maxGenerations 0, 21, atau non-integer, 404 ROOT_NOT_FOUND untuk
 * rootId nihil di tree, depth tunggal {0,0}, completeness per
 * generasi slot 2^g, collapse DAG dihitung per individu unik,
 * 304 mengulang ETag dan Cache-Control, 500 TREE_HEALTH_ERROR,
 * keys respons persis empat agregat tanpa field individu.
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

vi.mock('../../../server/db', () => ({ prisma: prismaMock }));

const JWT_SECRET = 'dev-only-insecure-secret-change-me';

function authHeader(userId: string): string {
  return `Bearer ${jwt.sign({ sub: userId }, JWT_SECRET)}`;
}

const USER = { id: 'user-1', email: 'u@example.test', status: 'active', role: 'owner' };
const TREE = { id: 'tree-1' };

const PATH = '/api/v1/trees/tree-1/stats/tree-health';

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

function memberRows(ids: string[]): { id: string }[] {
  return ids.map((id) => ({ id }));
}

function parentRel(parentId: string, childId: string): { memberId: string; relatedId: string; type: string } {
  return { memberId: parentId, relatedId: childId, type: 'parent' };
}

interface Depth {
  ancestral: number;
  descendant: number;
}

interface Row {
  generation: number;
  known: number;
  total: number;
  fraction: number;
}

interface HealthPayload {
  rootId: string;
  maxGenerations: number;
  generationDepth: Depth;
  pedigreeCompleteness: Row[];
}

beforeAll(async () => {
  const port = 39800 + (process.pid % 600);
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

describe('v293 tree-health endpoint', () => {
  it('401 tanpa kredensial dengan header WWW-Authenticate: Bearer', async () => {
    prismaMock.user.findUnique.mockResolvedValue(USER);
    prismaMock.familyTree.findUnique.mockResolvedValue(TREE);
    const { status, wwwAuthenticate } = await get(`${PATH}?rootId=r`);
    expect(status).toBe(401);
    expect(wwwAuthenticate).toBe('Bearer');
  });

  it('403 bukan anggota tanpa header WWW-Authenticate', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ ...USER, role: 'member' });
    prismaMock.familyTree.findUnique.mockResolvedValue(TREE);
    prismaMock.treeMember.findUnique.mockResolvedValue(null);
    const { status, body, wwwAuthenticate } = await get(`${PATH}?rootId=r`, { authorization: authHeader('user-1') });
    expect(status).toBe(403);
    expect(body['code']).toBe('FORBIDDEN_TREE');
    expect(wwwAuthenticate).toBeNull();
  });

  it('400 rootId hilang: code TREE_HEALTH_ROOT_REQUIRED', async () => {
    mockGuardAman();
    const { status, body } = await get(PATH, { authorization: authHeader('user-1') });
    expect(status).toBe(400);
    expect(body['code']).toBe('TREE_HEALTH_ROOT_REQUIRED');
  });

  it('400 rootId kosong: code TREE_HEALTH_ROOT_REQUIRED', async () => {
    mockGuardAman();
    const { status, body } = await get(`${PATH}?rootId=`, { authorization: authHeader('user-1') });
    expect(status).toBe(400);
    expect(body['code']).toBe('TREE_HEALTH_ROOT_REQUIRED');
  });

  it('400 maxGenerations 0: code TREE_HEALTH_MAXGEN_INVALID', async () => {
    mockGuardAman();
    const { status, body } = await get(`${PATH}?rootId=r&maxGenerations=0`, { authorization: authHeader('user-1') });
    expect(status).toBe(400);
    expect(body['code']).toBe('TREE_HEALTH_MAXGEN_INVALID');
  });

  it('400 maxGenerations 21: code TREE_HEALTH_MAXGEN_INVALID', async () => {
    mockGuardAman();
    const { status, body } = await get(`${PATH}?rootId=r&maxGenerations=21`, { authorization: authHeader('user-1') });
    expect(status).toBe(400);
    expect(body['code']).toBe('TREE_HEALTH_MAXGEN_INVALID');
  });

  it('400 maxGenerations non-integer 8.5: code TREE_HEALTH_MAXGEN_INVALID', async () => {
    mockGuardAman();
    const { status, body } = await get(`${PATH}?rootId=r&maxGenerations=8.5`, { authorization: authHeader('user-1') });
    expect(status).toBe(400);
    expect(body['code']).toBe('TREE_HEALTH_MAXGEN_INVALID');
  });

  it('404 rootId tidak ada di tree: code ROOT_NOT_FOUND', async () => {
    mockGuardAman();
    prismaMock.familyMember.findMany.mockResolvedValue(memberRows(['a', 'b']));
    prismaMock.familyRelationship.findMany.mockResolvedValue([]);
    const { status, body } = await get(`${PATH}?rootId=tidak-ada`, { authorization: authHeader('user-1') });
    expect(status).toBe(404);
    expect(body['code']).toBe('ROOT_NOT_FOUND');
  });

  it('200 pohon 1 orang: depth {0,0} dan rows gen1 sampai gen8 known 0', async () => {
    mockGuardAman();
    prismaMock.familyMember.findMany.mockResolvedValue(memberRows(['r']));
    prismaMock.familyRelationship.findMany.mockResolvedValue([]);
    const { status, body } = await get(`${PATH}?rootId=r`, { authorization: authHeader('user-1') });
    expect(status).toBe(200);
    const payload = body as unknown as HealthPayload;
    expect(payload.generationDepth).toEqual({ ancestral: 0, descendant: 0 });
    expect(payload.pedigreeCompleteness).toHaveLength(8);
    expect(payload.pedigreeCompleteness[0]).toEqual({ generation: 1, known: 0, total: 2, fraction: 0 });
    expect(payload.pedigreeCompleteness[7]).toEqual({ generation: 8, known: 0, total: 256, fraction: 0 });
  });

  it('200 keluarga inti: gen1 2/2, gen2 3/4, baris spouse diabaikan', async () => {
    mockGuardAman();
    // anak punya ortu ayah dan ibu; ayah berortu kakek nenek; ibu
    // berortu mdb saja sehingga gen2 known 3 dari 4 slot.
    prismaMock.familyMember.findMany.mockResolvedValue(
      memberRows(['anak', 'ayah', 'ibu', 'kakek', 'nenek', 'mdb'])
    );
    prismaMock.familyRelationship.findMany.mockResolvedValue([
      parentRel('ayah', 'anak'),
      parentRel('ibu', 'anak'),
      parentRel('kakek', 'ayah'),
      parentRel('nenek', 'ayah'),
      parentRel('mdb', 'ibu'),
      { memberId: 'ayah', relatedId: 'ibu', type: 'spouse' },
    ]);
    const { status, body } = await get(`${PATH}?rootId=anak`, { authorization: authHeader('user-1') });
    expect(status).toBe(200);
    const payload = body as unknown as HealthPayload;
    expect(payload.generationDepth).toEqual({ ancestral: 2, descendant: 0 });
    const rows = payload.pedigreeCompleteness;
    expect(rows[0]).toEqual({ generation: 1, known: 2, total: 2, fraction: 1 });
    expect(rows[1]).toEqual({ generation: 2, known: 3, total: 4, fraction: 0.75 });
    expect(rows[2]).toEqual({ generation: 3, known: 0, total: 8, fraction: 0 });
  });

  it('200 jangkar Wikipedia: gen3 6 dari 8 slot terisi', async () => {
    mockGuardAman();
    // anak, ortu p1 p2, kakek-nenek g1 sampai g4, buyut gg1 sampai
    // gg6 hanya di sisi g1 g2 g3; sisi g4 kosong, gen3 known 6 dari 8.
    prismaMock.familyMember.findMany.mockResolvedValue(
      memberRows(['anak', 'p1', 'p2', 'g1', 'g2', 'g3', 'g4', 'gg1', 'gg2', 'gg3', 'gg4', 'gg5', 'gg6'])
    );
    prismaMock.familyRelationship.findMany.mockResolvedValue([
      parentRel('p1', 'anak'),
      parentRel('p2', 'anak'),
      parentRel('g1', 'p1'),
      parentRel('g2', 'p1'),
      parentRel('g3', 'p2'),
      parentRel('g4', 'p2'),
      parentRel('gg1', 'g1'),
      parentRel('gg2', 'g1'),
      parentRel('gg3', 'g2'),
      parentRel('gg4', 'g2'),
      parentRel('gg5', 'g3'),
      parentRel('gg6', 'g3'),
    ]);
    const { status, body } = await get(`${PATH}?rootId=anak`, { authorization: authHeader('user-1') });
    expect(status).toBe(200);
    const payload = body as unknown as HealthPayload;
    expect(payload.generationDepth).toEqual({ ancestral: 3, descendant: 0 });
    const rows = payload.pedigreeCompleteness;
    expect(rows[2]).toEqual({ generation: 3, known: 6, total: 8, fraction: 0.75 });
  });

  it('200 leluhur duplikat DAG collapse: known ukuran set, bukan jumlah edge', async () => {
    mockGuardAman();
    // anak dari sepupu pertama: f dan m berortu sama gf gm, gen2
    // punya 4 slot tapi hanya 2 individu unik.
    prismaMock.familyMember.findMany.mockResolvedValue(
      memberRows(['anak', 'f', 'm', 'gf', 'gm'])
    );
    prismaMock.familyRelationship.findMany.mockResolvedValue([
      parentRel('f', 'anak'),
      parentRel('m', 'anak'),
      parentRel('gf', 'f'),
      parentRel('gm', 'f'),
      parentRel('gf', 'm'),
      parentRel('gm', 'm'),
    ]);
    const { status, body } = await get(`${PATH}?rootId=anak`, { authorization: authHeader('user-1') });
    expect(status).toBe(200);
    const payload = body as unknown as HealthPayload;
    expect(payload.generationDepth).toEqual({ ancestral: 2, descendant: 0 });
    const rows = payload.pedigreeCompleteness;
    expect(rows[0]).toEqual({ generation: 1, known: 2, total: 2, fraction: 1 });
    expect(rows[1]).toEqual({ generation: 2, known: 2, total: 4, fraction: 0.5 });
    expect(rows[2]).toEqual({ generation: 3, known: 0, total: 8, fraction: 0 });
  });

  it('304 mengulang ETag dan Cache-Control saat If-None-Match cocok', async () => {
    mockGuardAman();
    prismaMock.familyMember.findMany.mockResolvedValue(memberRows(['r']));
    prismaMock.familyRelationship.findMany.mockResolvedValue([]);
    const first = await get(`${PATH}?rootId=r`, { authorization: authHeader('user-1') });
    expect(first.status).toBe(200);
    const etag = first.etag ?? '';
    const bareHex = etag.replace(/^W\//, '').replaceAll('"', '');
    const second = await get(`${PATH}?rootId=r`, { authorization: authHeader('user-1'), 'if-none-match': bareHex });
    expect(second.status).toBe(304);
    expect(second.etag).toBe(etag);
    expect(second.cacheControl).toBe('private, no-cache');
  });

  it('200 determinisme: rows generation urut 1 sampai maxGenerations', async () => {
    mockGuardAman();
    prismaMock.familyMember.findMany.mockResolvedValue(memberRows(['r']));
    prismaMock.familyRelationship.findMany.mockResolvedValue([]);
    const { status, body } = await get(`${PATH}?rootId=r&maxGenerations=5`, { authorization: authHeader('user-1') });
    expect(status).toBe(200);
    const payload = body as unknown as HealthPayload;
    expect(payload.pedigreeCompleteness.map((row) => row.generation)).toEqual([1, 2, 3, 4, 5]);
    expect(payload.maxGenerations).toBe(5);
  });

  it('200 keys respons persis empat agregat tanpa field individu', async () => {
    mockGuardAman();
    prismaMock.familyMember.findMany.mockResolvedValue(memberRows(['root-utama', 'member-rahasia']));
    prismaMock.familyRelationship.findMany.mockResolvedValue([]);
    const { status, body } = await get(`${PATH}?rootId=root-utama`, { authorization: authHeader('user-1') });
    expect(status).toBe(200);
    expect(Object.keys(body)).toEqual(['rootId', 'maxGenerations', 'generationDepth', 'pedigreeCompleteness']);
    expect(JSON.stringify(body)).not.toContain('member-rahasia');
  });

  it('500 path error mengembalikan code TREE_HEALTH_ERROR', async () => {
    mockGuardAman();
    prismaMock.familyMember.findMany.mockRejectedValueOnce(new Error('db boom'));
    const { status, body } = await get(`${PATH}?rootId=r`, { authorization: authHeader('user-1') });
    expect(status).toBe(500);
    expect(body['code']).toBe('TREE_HEALTH_ERROR');
    expect(body['message']).toContain('db boom');
  });

  it('200 membawa Cache-Control eksak private no-cache dan ETag strong 64 hex', async () => {
    mockGuardAman();
    prismaMock.familyMember.findMany.mockResolvedValue(memberRows(['r']));
    prismaMock.familyRelationship.findMany.mockResolvedValue([]);
    const { status, etag, cacheControl } = await get(`${PATH}?rootId=r`, { authorization: authHeader('user-1') });
    expect(status).toBe(200);
    expect(cacheControl).toBe('private, no-cache');
    expect(etag).toMatch(/^"[0-9a-f]{64}"$/);
  });
});
