import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import jwt from 'jsonwebtoken';

// v470: kontrak tiga route PUT citation upsert (GAP#1 sourcing). Harness
// pola gedcom-apply-api.test.ts: server/index.ts di-import utuh, prisma
// di-mock stateful in-memory sehingga sifat idempoten find-or-create,
// join idempoten, dan reuse lintas citation teruji nyata terhadap store.

interface Row {
  id: string;
  [key: string]: unknown;
}

function makePrismaMock() {
  let seq = 0;
  const nextId = (prefix: string) => `${prefix}-${++seq}`;
  const sources = new Map<string, Row>();
  const citations = new Map<string, Row>();
  const members = new Map<string, Row>();
  const lifeEvents = new Map<string, Row>();
  const joins = new Map<string, Row>();

  function match(row: Row | undefined, where: Record<string, unknown>): boolean {
    if (!row) return false;
    for (const [key, want] of Object.entries(where)) {
      if (want !== null && typeof want === 'object' && !Array.isArray(want)) {
        if (!match(row[key] as Row | undefined, want as Record<string, unknown>)) return false;
      } else if ((row[key] ?? null) !== want) {
        return false;
      }
    }
    return true;
  }

  function first(store: Map<string, Row>, where: Record<string, unknown>): Row | null {
    for (const row of store.values()) {
      if (match(row, where)) return row;
    }
    return null;
  }

  function count(store: Map<string, Row>, where: Record<string, unknown>): number {
    let n = 0;
    for (const row of store.values()) {
      if (match(row, where)) n += 1;
    }
    return n;
  }

  const prisma = {
    user: { findUnique: vi.fn() },
    familyTree: { findUnique: vi.fn() },
    treeMember: { findUnique: vi.fn() },
    familyMember: {
      findFirst: vi.fn(async (a: { where: Record<string, unknown> }) => first(members, a.where)),
    },
    source: {
      findFirst: vi.fn(async (a: { where: Record<string, unknown> }) => first(sources, a.where)),
      create: vi.fn(async (a: { data: Record<string, unknown> }) => {
        const row: Row = { id: nextId('src'), ...a.data };
        sources.set(row.id, row);
        return row;
      }),
    },
    citation: {
      findFirst: vi.fn(async (a: { where: Record<string, unknown> }) => first(citations, a.where)),
      create: vi.fn(async (a: { data: Record<string, unknown> }) => {
        const row: Row = { id: nextId('cit'), ...a.data };
        citations.set(row.id, row);
        return row;
      }),
    },
    lifeEvent: {
      findFirst: vi.fn(async (a: { where: Record<string, unknown> }) => first(lifeEvents, a.where)),
      create: vi.fn(async (a: { data: Record<string, unknown> }) => {
        const row: Row = { id: nextId('evt'), ...a.data };
        lifeEvents.set(row.id, row);
        return row;
      }),
      update: vi.fn(async (a: { where: { id: string }; data: Record<string, unknown> }) => {
        const row = lifeEvents.get(a.where.id) as Row;
        Object.assign(row, a.data);
        return row;
      }),
    },
    lifeEventCitation: {
      findFirst: vi.fn(async (a: { where: Record<string, unknown> }) => first(joins, a.where)),
      count: vi.fn(async (a: { where: Record<string, unknown> }) => count(joins, a.where)),
      create: vi.fn(async (a: { data: Record<string, unknown> }) => {
        const row: Row = { id: nextId('join'), ...a.data };
        joins.set(row.id, row);
        return row;
      }),
    },
  };

  return { seq: () => seq, prisma, sources, citations, members, lifeEvents, joins };
}

const stateful = makePrismaMock();
const prismaMock = stateful.prisma;

vi.mock('../../server/db', () => ({ prisma: prismaMock }));

const JWT_SECRET = 'dev-only-insecure-secret-change-me';

function authHeader(userId: string): string {
  return `Bearer ${jwt.sign({ sub: userId }, JWT_SECRET)}`;
}

const USER_1 = { id: 'user-1', email: 'u1@example.test', status: 'active', role: 'member' };

let BASE = '';
let serverHandle: import('node:http').Server | undefined;

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

async function call(
  method: string,
  path: string,
  body?: unknown,
  withAuth = true,
): Promise<ApiResult> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    headers: {
      ...(withAuth ? { authorization: authHeader('user-1') } : {}),
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
  });
  const text = await res.text();
  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(text) as Record<string, unknown>;
  } catch {
    parsed = { raw: text };
  }
  return { status: res.status, body: parsed };
}

function mockGuardOwner(): void {
  prismaMock.user.findUnique.mockResolvedValue(USER_1);
  prismaMock.familyTree.findUnique.mockResolvedValue({ id: 'tree-1' });
  prismaMock.treeMember.findUnique.mockResolvedValue({
    id: 'tm-1',
    userId: 'user-1',
    treeId: 'tree-1',
    role: 'owner',
  });
}

function resetStores(): void {
  for (const store of [
    stateful.sources,
    stateful.citations,
    stateful.members,
    stateful.lifeEvents,
    stateful.joins,
  ]) {
    store.clear();
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  resetStores();
  mockGuardOwner();
  // Seed: member, source, citation milik tree-1 dan tree-2 (pov B).
  stateful.members.set('mem-1', { id: 'mem-1', treeId: 'tree-1' });
  stateful.members.set('mem-2', { id: 'mem-2', treeId: 'tree-1' });
  stateful.members.set('mem-x', { id: 'mem-x', treeId: 'tree-2' });
  stateful.sources.set('src-a', { id: 'src-a', treeId: 'tree-1', title: '@S1@' });
  stateful.sources.set('src-b', { id: 'src-b', treeId: 'tree-2', title: '@S9@' });
  stateful.citations.set('cit-a', {
    id: 'cit-a',
    sourceId: 'src-a',
    qualifier: 'p1',
    transcription: 't1',
    confidence: 'secondary',
    source: { id: 'src-a', treeId: 'tree-1' },
  });
  stateful.citations.set('cit-b', {
    id: 'cit-b',
    sourceId: 'src-a',
    qualifier: 'p2',
    transcription: 't2',
    confidence: 'secondary',
    source: { id: 'src-a', treeId: 'tree-1' },
  });
});

beforeAll(async () => {
  const port = 37200 + (process.pid % 600);
  BASE = `http://127.0.0.1:${port}`;
  process.env['API_PORT'] = String(port);
  const proto = (express as unknown as { application: { listen: (...a: unknown[]) => import('node:http').Server } })
    .application;
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
}, 20000);

afterAll(async () => {
  serverHandle?.close();
});

describe('PUT citation upsert routes (v470)', () => {
  it('(1) unauthenticated tanpa header dijawab 401', async () => {
    const r = await call('PUT', '/api/v1/trees/tree-1/sources/upsert', { pointer: '@S1@' }, false);
    expect(r.status).toBe(401);
  });

  it('(2) sources/upsert tanpa pointer menjawab 400 invalid_body', async () => {
    const r = await call('PUT', '/api/v1/trees/tree-1/sources/upsert', {});
    expect(r.status).toBe(400);
    expect(r.body['code']).toBe('invalid_body');
  });

  it('(3) source upsert pertama membuat baris baru dan mengembalikan id', async () => {
    const r = await call('PUT', '/api/v1/trees/tree-1/sources/upsert', { pointer: '@S7@' });
    expect(r.status).toBe(200);
    expect(typeof r.body['id']).toBe('string');
    expect(stateful.sources.size).toBe(3); // seed src-a + src-b + 1 baru
  });

  it('(4) source re-upsert pointer sama mengembalikan id sama tanpa duplikat', async () => {
    const first = await call('PUT', '/api/v1/trees/tree-1/sources/upsert', { pointer: '@S7@' });
    const again = await call('PUT', '/api/v1/trees/tree-1/sources/upsert', { pointer: '@S7@' });
    expect(again.status).toBe(200);
    expect(again.body['id']).toBe(first.body['id']);
    expect(stateful.sources.size).toBe(3); // tetap: seed dua + satu
  });

  it('(5) dua pointer beda menghasilkan dua source berbeda', async () => {
    const a = await call('PUT', '/api/v1/trees/tree-1/sources/upsert', { pointer: '@S7@' });
    const b = await call('PUT', '/api/v1/trees/tree-1/sources/upsert', { pointer: '@S8@' });
    expect(a.body['id']).not.toBe(b.body['id']);
    expect(stateful.sources.size).toBe(4); // seed dua + dua baru
  });

  it('(6) citation re-upsert spec sama mengembalikan id sama tanpa duplikat', async () => {
    const spec = { sourceId: 'src-a', page: '12', quay: '2', note: 'akta lahir', memberId: 'mem-1', eventType: 'BIRTH' };
    const first = await call('PUT', '/api/v1/trees/tree-1/citations/upsert', spec);
    expect(first.status).toBe(200);
    const again = await call('PUT', '/api/v1/trees/tree-1/citations/upsert', spec);
    expect(again.body['id']).toBe(first.body['id']);
    expect(stateful.citations.size).toBe(3); // seed dua + satu
  });

  it('(7) eventType empat nilai tersimpan persis BIRTH DEATH MARRIAGE DIVORCE', async () => {
    for (const eventType of ['BIRTH', 'DEATH', 'MARRIAGE', 'DIVORCE']) {
      const r = await call('PUT', '/api/v1/trees/tree-1/life-events/upsert', { memberId: 'mem-1', eventType });
      expect(r.status).toBe(200);
      const stored = stateful.lifeEvents.get(r.body['id'] as string);
      expect(stored?.['eventType']).toBe(eventType);
    }
    expect(stateful.lifeEvents.size).toBe(4);
  });

  it('(8) eventType di luar mapping ditolak 400 invalid_body', async () => {
    const r = await call('PUT', '/api/v1/trees/tree-1/life-events/upsert', { memberId: 'mem-1', eventType: 'CHRISTENING' });
    expect(r.status).toBe(400);
    expect(r.body['code']).toBe('invalid_body');
    expect(stateful.lifeEvents.size).toBe(0);
  });

  it('(9) BOLA memberId tree lain ditolak 404, kontrol tree sendiri 200', async () => {
    const bola = await call('PUT', '/api/v1/trees/tree-1/life-events/upsert', {
      memberId: 'mem-x',
      eventType: 'BIRTH',
    });
    expect(bola.status).toBe(404);
    expect(bola.body['code']).toBe('NOT_FOUND');
    const kontrol = await call('PUT', '/api/v1/trees/tree-1/life-events/upsert', {
      memberId: 'mem-1',
      eventType: 'BIRTH',
    });
    expect(kontrol.status).toBe(200);
  });

  it('(10) citation dengan source milik tree lain ditolak 404', async () => {
    const r = await call('PUT', '/api/v1/trees/tree-1/citations/upsert', {
      sourceId: 'src-b',
      memberId: 'mem-1',
      eventType: 'BIRTH',
    });
    expect(r.status).toBe(404);
    expect(r.body['code']).toBe('NOT_FOUND');
    expect(stateful.citations.size).toBe(2); // nihil citation baru
  });

  it('(11) lifeEvent reuse lintas citation: id sama, citationId ikut citation terakhir', async () => {
    const withA = await call('PUT', '/api/v1/trees/tree-1/life-events/upsert', {
      memberId: 'mem-2',
      eventType: 'MARRIAGE',
      partnerMemberId: 'mem-1',
      citationId: 'cit-a',
    });
    expect(withA.status).toBe(200);
    const withB = await call('PUT', '/api/v1/trees/tree-1/life-events/upsert', {
      memberId: 'mem-2',
      eventType: 'MARRIAGE',
      partnerMemberId: 'mem-1',
      citationId: 'cit-b',
    });
    expect(withB.status).toBe(200);
    expect(withB.body['id']).toBe(withA.body['id']);
    expect(stateful.lifeEvents.size).toBe(1);
    const stored = stateful.lifeEvents.get(withA.body['id'] as string);
    expect(stored?.['citationId']).toBe('cit-b');
    // Dua citation pada event sama: join order 0 lalu 1.
    const orders = [...stateful.joins.values()].map((j) => j['order']).sort();
    expect(orders).toEqual([0, 1]);
  });

  it('(12) join idempoten: replay citation sama tidak menambah baris join', async () => {
    const body = { memberId: 'mem-1', eventType: 'DEATH', citationId: 'cit-a' };
    await call('PUT', '/api/v1/trees/tree-1/life-events/upsert', body);
    await call('PUT', '/api/v1/trees/tree-1/life-events/upsert', body);
    const again = await call('PUT', '/api/v1/trees/tree-1/life-events/upsert', body);
    expect(again.status).toBe(200);
    expect(stateful.joins.size).toBe(1);
    expect(stateful.joins.values().next().value?.['order']).toBe(0);
  });

  it('(13) dua panggilan beruntun aman: hasil konsisten satu citation per pasangan', async () => {
    const spec = { sourceId: 'src-a', memberId: 'mem-1', eventType: 'BIRTH' };
    const a = await call('PUT', '/api/v1/trees/tree-1/citations/upsert', spec);
    const b = await call('PUT', '/api/v1/trees/tree-1/citations/upsert', spec);
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    // find-or-create beruntun: panggilan kedua menemukan baris buatan
    // panggilan pertama, sehingga id sama dan store tidak bertambah.
    expect(b.body['id']).toBe(a.body['id']);
    expect(stateful.citations.size).toBe(3); // seed dua + satu
  });
});
