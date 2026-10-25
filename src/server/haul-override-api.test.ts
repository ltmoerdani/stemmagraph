/**
 * Test dedikasi v393 AC6: override haul manual.
 *
 * Cakupan:
 * (a) PUT /api/v1/members/:id dengan haulOverrideDate: format valid 200,
 *     format salah 422 INVALID_HAUL_DATE, tanggal tidak kalender 422,
 *     string kosong menghapus override, set pada anggota hidup 422
 *     HAUL_OVERRIDE_ON_LIVING.
 * (b) GET /api/v1/trees/:treeId/reminders/upcoming memuat item kind haul
 *     dengan tanggal efektif override (fallback deathDate saat kosong).
 *
 * Pola persis src/server/merge-approval-api.test.ts (v392): prisma
 * di-mock penuh lewat vi.hoisted, server express asli dilisten di port
 * ephemeral lalu diakses via fetch native. Port digeser ke 37900 supaya
 * tidak berbenturan dengan empat file test server lain saat paralel.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import jwt from 'jsonwebtoken';

const prismaMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  familyTree: { findUnique: vi.fn() },
  treeMember: { findUnique: vi.fn() },
  familyMember: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn() },
  lifeEvent: { findMany: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock('../../server/db', () => ({ prisma: prismaMock }));

const JWT_SECRET = 'dev-only-insecure-secret-change-me';

function authHeader(userId: string): string {
  return `Bearer ${jwt.sign({ sub: userId }, JWT_SECRET)}`;
}

const USER_1 = { id: 'user-1', email: 'u1@example.test', status: 'active', role: 'member' };
const TREE = { id: 'tree-1' };

function memberBaru(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'm-1',
    treeId: 'tree-1',
    name: 'Adi',
    isAlive: false,
    deathDate: '2020-05-10',
    haulOverrideDate: null,
    ...overrides,
  };
}

let BASE = '';
let serverHandle: import('node:http').Server | undefined;

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

async function call(method: string, path: string, body?: unknown, withAuth = true): Promise<ApiResult> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(withAuth ? { authorization: authHeader('user-1') } : {}),
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  return {
    status: res.status,
    body: text.length === 0 ? {} : (JSON.parse(text) as Record<string, unknown>),
  };
}

/** Guard lolos: tree ada, caller editor. */
function mockGuardEditor(): void {
  prismaMock.user.findUnique.mockResolvedValue(USER_1);
  prismaMock.familyTree.findUnique.mockResolvedValue(TREE);
  prismaMock.treeMember.findUnique.mockResolvedValue({ id: 'tm-1', userId: 'user-1', treeId: 'tree-1', role: 'editor' });
}

beforeEach(() => {
  vi.clearAllMocks();
});

beforeAll(async () => {
  const port = 37900 + (process.pid % 600);
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

describe('PUT members validasi haulOverrideDate (v393)', () => {
  it('format valid pada anggota wafat: 200, update membawa override, respons formatMember memuatnya', async () => {
    mockGuardEditor();
    prismaMock.familyMember.findUnique.mockResolvedValue(memberBaru());
    prismaMock.familyMember.update.mockImplementation(async (args: { data: Record<string, unknown> }) => ({
      ...memberBaru(),
      ...args.data,
    }));
    const r = await call('PUT', '/api/v1/members/m-1', { haulOverrideDate: '2026-11-15' });
    expect(r.status).toBe(200);
    expect(prismaMock.familyMember.update).toHaveBeenCalledTimes(1);
    const args = prismaMock.familyMember.update.mock.calls[0]?.[0] as { data: { haulOverrideDate: string } };
    expect(args.data.haulOverrideDate).toBe('2026-11-15');
    expect(r.body['haulOverrideDate']).toBe('2026-11-15');
  });

  it('format salah (bukan YYYY-MM-DD): 422 INVALID_HAUL_DATE tanpa update', async () => {
    mockGuardEditor();
    prismaMock.familyMember.findUnique.mockResolvedValue(memberBaru());
    const r = await call('PUT', '/api/v1/members/m-1', { haulOverrideDate: '15/11/2026' });
    expect(r.status).toBe(422);
    expect(r.body['code']).toBe('INVALID_HAUL_DATE');
    expect(prismaMock.familyMember.update).not.toHaveBeenCalled();
  });

  it('tanggal tidak kalender (2026-02-30): 422 INVALID_HAUL_DATE tanpa update', async () => {
    mockGuardEditor();
    prismaMock.familyMember.findUnique.mockResolvedValue(memberBaru());
    const r = await call('PUT', '/api/v1/members/m-1', { haulOverrideDate: '2026-02-30' });
    expect(r.status).toBe(422);
    expect(r.body['code']).toBe('INVALID_HAUL_DATE');
    expect(prismaMock.familyMember.update).not.toHaveBeenCalled();
  });

  it('29 Feb hanya sah pada tahun kabisat (2026-02-29 ditolak, 2028-02-29 diterima)', async () => {
    mockGuardEditor();
    prismaMock.familyMember.findUnique.mockResolvedValue(memberBaru());
    const ditolak = await call('PUT', '/api/v1/members/m-1', { haulOverrideDate: '2026-02-29' });
    expect(ditolak.status).toBe(422);
    expect(ditolak.body['code']).toBe('INVALID_HAUL_DATE');
    prismaMock.familyMember.update.mockImplementation(async (args: { data: Record<string, unknown> }) => ({
      ...memberBaru(),
      ...args.data,
    }));
    const diterima = await call('PUT', '/api/v1/members/m-1', { haulOverrideDate: '2028-02-29' });
    expect(diterima.status).toBe(200);
  });

  it('string kosong menghapus override (update membawa haulOverrideDate kosong)', async () => {
    mockGuardEditor();
    prismaMock.familyMember.findUnique.mockResolvedValue(memberBaru({ haulOverrideDate: '2026-11-15' }));
    prismaMock.familyMember.update.mockImplementation(async (args: { data: Record<string, unknown> }) => ({
      ...memberBaru(),
      ...args.data,
    }));
    const r = await call('PUT', '/api/v1/members/m-1', { haulOverrideDate: '' });
    expect(r.status).toBe(200);
    const args = prismaMock.familyMember.update.mock.calls[0]?.[0] as { data: { haulOverrideDate: string } };
    expect(args.data.haulOverrideDate).toBe('');
  });

  it('set pada anggota hidup: 422 HAUL_OVERRIDE_ON_LIVING tanpa update', async () => {
    mockGuardEditor();
    prismaMock.familyMember.findUnique.mockResolvedValue(memberBaru({ isAlive: true, deathDate: null }));
    const r = await call('PUT', '/api/v1/members/m-1', { haulOverrideDate: '2026-11-15' });
    expect(r.status).toBe(422);
    expect(r.body['code']).toBe('HAUL_OVERRIDE_ON_LIVING');
    expect(prismaMock.familyMember.update).not.toHaveBeenCalled();
  });

  it('tanpa kunci haulOverrideDate di body: validasi tidak jalan, update tetap boleh', async () => {
    mockGuardEditor();
    prismaMock.familyMember.findUnique.mockResolvedValue(memberBaru());
    prismaMock.familyMember.update.mockImplementation(async (args: { data: Record<string, unknown> }) => ({
      ...memberBaru(),
      ...args.data,
    }));
    const r = await call('PUT', '/api/v1/members/m-1', { name: 'Adi Sitorus' });
    expect(r.status).toBe(200);
    expect(prismaMock.familyMember.update).toHaveBeenCalledTimes(1);
  });
});

describe('GET reminders/upcoming memuat haul (v393)', () => {
  it('anggota wafat ber-override masuk hasil dengan tanggal override, bukan deathDate', async () => {
    mockGuardEditor();
    prismaMock.familyMember.findMany.mockImplementation(async (args: { where: { isAlive?: boolean } }) => {
      if (args.where.isAlive === true) {
        return [{ id: 'm-hidup', name: 'Budi', birthDate: '1990-10-24' }];
      }
      return [{ id: 'm-1', name: 'Adi', deathDate: '2020-05-10', haulOverrideDate: '2026-11-15' }];
    });
    prismaMock.lifeEvent.findMany.mockResolvedValue([]);
    const r = await call('GET', '/api/v1/trees/tree-1/reminders/upcoming');
    expect(r.status).toBe(200);
    const items = r.body as unknown as { kind: string; refId: string; date: string }[];
    const haul = items.find((i) => i.kind === 'haul');
    expect(haul).toBeTruthy();
    expect(haul?.refId).toBe('m-1');
    expect(haul?.date).toBe('2026-11-15');
  });

  it('override kosong: haul jatuh pada tanggal efektif fallback deathDate', async () => {
    mockGuardEditor();
    prismaMock.familyMember.findMany.mockImplementation(async (args: { where: { isAlive?: boolean } }) => {
      if (args.where.isAlive === true) return [];
      return [{ id: 'm-2', name: 'Citra', deathDate: '2020-12-05', haulOverrideDate: null }];
    });
    prismaMock.lifeEvent.findMany.mockResolvedValue([]);
    const r = await call('GET', '/api/v1/trees/tree-1/reminders/upcoming?days=60');
    expect(r.status).toBe(200);
    const items = r.body as unknown as { kind: string; refId: string; date: string; nextDate: string }[];
    const haul = items.find((i) => i.kind === 'haul');
    expect(haul).toBeTruthy();
    expect(haul?.date).toBe('2020-12-05');
    expect(haul?.nextDate).toBe('2026-12-05');
  });
});
