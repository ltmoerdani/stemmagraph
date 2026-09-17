import { describe, expect, it } from 'vitest';
import {
  ERASURE_DUE_DAYS,
  buildErasureCancelEvent,
  buildErasureRequestEvent,
  type ErasureRouteRow,
} from './erasure-routes';
import {
  registerErasureRoutes,
  type ErasureRouteContext,
  type ErasureRouteHandler,
  type ErasureRouteResult,
  type ErasureRouter,
} from './erasure-router';
import type { ErasureEventRow } from './erasure-wiring';
import { NotFoundError } from '../adapters/types';

const T0 = '2026-09-17T00:00:00.000Z';
const T1 = '2026-09-18T00:00:00.000Z';
const PATH = '/api/v1/members/:memberId/erasure';

/** Mock router kecil: simpan handler terdaftar, sediakan helper invoke. */
type RegisteredRoute = {
  method: 'get' | 'post' | 'delete';
  path: string;
  handler: ErasureRouteHandler;
};

function createMockRouter() {
  const routes: RegisteredRoute[] = [];
  const router: ErasureRouter = {
    get: (path, handler) => {
      routes.push({ method: 'get', path, handler });
      return routes.length;
    },
    post: (path, handler) => {
      routes.push({ method: 'post', path, handler });
      return routes.length;
    },
    delete: (path, handler) => {
      routes.push({ method: 'delete', path, handler });
      return routes.length;
    },
  };
  function find(method: RegisteredRoute['method'], path: string): RegisteredRoute {
    const route = routes.find((r) => r.method === method && r.path === path);
    if (!route) {
      throw new Error(`route tidak terdaftar: ${method} ${path}`);
    }
    return route;
  }
  async function invoke(
    method: RegisteredRoute['method'],
    path: string,
    callCtx: ErasureRouteContext,
  ): Promise<ErasureRouteResult> {
    return find(method, path).handler(callCtx);
  }
  return { router, routes, find, invoke };
}

/** Deps in-memory: ledger per memberId, tanpa IO apa pun. */
function createMockDeps(seed: ErasureEventRow[] = [], seedMemberId = 'm-1') {
  const byMember = new Map<string, ErasureEventRow[]>();
  byMember.set(seedMemberId, [...seed]);
  return {
    listEvents: async (memberId: string): Promise<ErasureEventRow[]> => {
      const rows = byMember.get(memberId);
      if (!rows) {
        throw new NotFoundError(`member ${memberId} tidak ditemukan`);
      }
      return rows;
    },
    appendEvent: async (row: ErasureEventRow): Promise<void> => {
      byMember.get(seedMemberId)?.push(row);
    },
    ledger: byMember.get(seedMemberId) as ErasureEventRow[],
  };
}

function requestRow(memberId = 'm-1'): ErasureEventRow {
  return buildErasureRequestEvent(memberId, T0);
}

function completedRow(): ErasureEventRow {
  return { type: 'erasure.completed', payloadJson: JSON.stringify({ completedAt: T1 }) };
}

function corruptRow(): ErasureEventRow {
  return { type: 'erasure.requested', payloadJson: 'bukan-json' };
}

function callCtx(overrides: Partial<ErasureRouteContext> = {}): ErasureRouteContext {
  return { memberId: 'm-1', userId: 'u-1', body: undefined, ...overrides };
}

function setupHarness(seed: ErasureEventRow[] = []) {
  const mock = createMockRouter();
  const deps = createMockDeps(seed);
  registerErasureRoutes(mock.router, deps);
  return { ...mock, deps };
}

describe('registrasi route erasure', () => {
  it('mendaftarkan tepat 3 route di path yang sama', () => {
    const { routes } = setupHarness();
    expect(routes).toHaveLength(3);
    expect(routes.map((r) => r.method).sort()).toEqual(['delete', 'get', 'post']);
    expect(routes.every((r) => r.path === PATH)).toBe(true);
  });

  it('invoke pada path yang tidak terdaftar melempar error', async () => {
    const { invoke } = setupHarness();
    await expect(
      invoke('delete', '/api/v1/other/erasure', callCtx()),
    ).rejects.toThrow('route tidak terdaftar');
  });
});

describe('jalur POST action request', () => {
  it('body nihil berarti request: 201 write dengan status REQUESTED', async () => {
    const { invoke } = setupHarness();
    const result = await invoke('post', PATH, callCtx({ body: { note: 'hapus' } }));
    expect(result.status).toBe(201);
    expect(result.code).toBe('write');
    if (result.code === 'write' && 'request' in result.payload) {
      expect(result.payload.request.status).toBe('REQUESTED');
      expect(result.payload.request.memberId).toBe('m-1');
    }
  });

  it('dueAt pada payload tepat requestedAt + 30 hari', async () => {
    const { invoke } = setupHarness();
    const result = await invoke('post', PATH, callCtx());
    expect(result.code).toBe('write');
    if (result.code === 'write' && 'request' in result.payload) {
      const expected = new Date(
        Date.parse(result.payload.request.requestedAt) + ERASURE_DUE_DAYS * 24 * 60 * 60 * 1000,
      ).toISOString();
      expect(result.payload.request.dueAt).toBe(expected);
    }
  });

  it('event erasure.requested ditambahkan ke ledger', async () => {
    const { invoke, deps } = setupHarness();
    await invoke('post', PATH, callCtx());
    expect(deps.ledger).toHaveLength(1);
    expect(deps.ledger[0]?.type).toBe('erasure.requested');
    const payload = JSON.parse(deps.ledger[0]?.payloadJson ?? '{}') as Record<string, unknown>;
    expect(payload.memberId).toBe('m-1');
  });

  it('memberId kosong: 400 invalid_body dari validasi planErasureRequest', async () => {
    const { invoke } = setupHarness();
    const result = await invoke('post', PATH, callCtx({ memberId: '' }));
    expect(result.status).toBe(400);
    expect(result.code).toBe('invalid_body');
    if (result.code === 'invalid_body') {
      expect(result.message).toContain('memberId wajib');
    }
  });

  it('ledger berisi payload korup: replay write menghasilkan 409 ERASURE_CONFLICT', async () => {
    const { invoke } = setupHarness([corruptRow()]);
    const result = await invoke('post', PATH, callCtx());
    expect(result.status).toBe(409);
    expect(result.code).toBe('write');
    if (result.code === 'write') {
      expect((result.payload as { code: string }).code).toBe('ERASURE_CONFLICT');
    }
  });

  it('listEvents gagal dengan error umum: 400 invalid_body sesuai kontrak mapErasureError', async () => {
    const mock = createMockRouter();
    registerErasureRoutes(mock.router, {
      listEvents: async () => {
        throw new Error('koneksi ledger putus');
      },
      appendEvent: async () => undefined,
    });
    const result = await mock.invoke('post', PATH, callCtx());
    expect(result.status).toBe(400);
    expect(result.code).toBe('invalid_body');
    if (result.code === 'invalid_body') {
      expect(result.message).toContain('koneksi ledger putus');
    }
  });

  it('listEvents melempar nilai bukan Error: 500 internal', async () => {
    const mock = createMockRouter();
    registerErasureRoutes(mock.router, {
      listEvents: async () => {
        throw 'gangguan non-Error';
      },
      appendEvent: async () => undefined,
    });
    const result = await mock.invoke('post', PATH, callCtx());
    expect(result.status).toBe(500);
    expect(result.code).toBe('internal');
  });
});

describe('jalur cancel sah via POST body dan DELETE', () => {
  it('POST { action: cancel } atas REQUESTED: 200 write CANCELLED', async () => {
    const { invoke, deps } = setupHarness([requestRow()]);
    const result = await invoke('post', PATH, callCtx({ body: { action: 'cancel' } }));
    expect(result.status).toBe(200);
    expect(result.code).toBe('write');
    if (result.code === 'write' && 'request' in result.payload) {
      expect(result.payload.request.status).toBe('CANCELLED');
    }
    expect(deps.ledger).toHaveLength(2);
    expect(deps.ledger[1]?.type).toBe('erasure.cancelled');
  });

  it('DELETE atas REQUESTED: 200 write CANCELLED', async () => {
    const { invoke } = setupHarness([requestRow()]);
    const result = await invoke('delete', PATH, callCtx());
    expect(result.status).toBe(200);
    expect(result.code).toBe('write');
    if (result.code === 'write' && 'request' in result.payload) {
      expect(result.payload.request.status).toBe('CANCELLED');
      expect(result.payload.request.cancelledAt).toBeTruthy();
    }
  });

  it('DELETE dua kali: cancel kedua ditolak 409 karena status sudah CANCELLED', async () => {
    const { invoke } = setupHarness([requestRow()]);
    await invoke('delete', PATH, callCtx());
    const second = await invoke('delete', PATH, callCtx());
    expect(second.status).toBe(409);
    expect(second.code).toBe('ERASURE_CONFLICT');
    if (second.code === 'ERASURE_CONFLICT') {
      expect(second.message.length).toBeGreaterThan(0);
    }
  });
});

describe('cancel invalid: not-found dan conflict', () => {
  it('POST cancel saat ledger kosong: 404 not_found dari decideErasureCancel', async () => {
    const { invoke } = setupHarness();
    const result = await invoke('post', PATH, callCtx({ body: { action: 'cancel' } }));
    expect(result.status).toBe(404);
    expect(result.code).toBe('not_found');
    if (result.code === 'not_found') {
      expect(result.message).toBe('erasure request not found');
    }
  });

  it('DELETE saat sudah COMPLETED: 409 ERASURE_CONFLICT dari decideErasureCancel', async () => {
    const { invoke } = setupHarness([requestRow(), completedRow()]);
    const result = await invoke('delete', PATH, callCtx());
    expect(result.status).toBe(409);
    expect(result.code).toBe('ERASURE_CONFLICT');
    if (result.code === 'ERASURE_CONFLICT') {
      expect(result.message).toContain('COMPLETED');
    }
  });
});

describe('GET summarize state', () => {
  it('GET tanpa event: 404 not_found', async () => {
    const { invoke } = setupHarness();
    const result = await invoke('get', PATH, callCtx());
    expect(result.status).toBe(404);
    expect(result.code).toBe('not_found');
  });

  it('GET dengan event request: 200 get dan state REQUESTED', async () => {
    const { invoke } = setupHarness([requestRow()]);
    const result = await invoke('get', PATH, callCtx());
    expect(result.status).toBe(200);
    expect(result.code).toBe('get');
    if (result.code === 'get') {
      expect(result.payload.status).toBe(200);
      if ('request' in result.payload) {
        expect(result.payload.request.status).toBe('REQUESTED');
        expect(result.payload.request.dueAt).toBeTruthy();
      }
    }
  });

  it('GET dengan payload korup: 409 ERASURE_CONFLICT lewat toConflict', async () => {
    const { invoke } = setupHarness([corruptRow()]);
    const result = await invoke('get', PATH, callCtx());
    expect(result.status).toBe(409);
    expect(result.code).toBe('ERASURE_CONFLICT');
    if (result.code === 'ERASURE_CONFLICT') {
      expect(result.message.length).toBeGreaterThan(0);
    }
  });

  it('GET saat member tidak ada di ledger: NotFoundError dipetakan 404', async () => {
    const { invoke } = setupHarness();
    const result = await invoke('get', PATH, callCtx({ memberId: 'm-404' }));
    expect(result.status).toBe(404);
    expect(result.code).toBe('not_found');
    if (result.code === 'not_found') {
      expect(result.message).toContain('m-404');
    }
  });
});

describe('konstanta tenggat dan event cancel', () => {
  it('ERASURE_DUE_DAYS bernilai 30 sesuai UU PDP dan GDPR', () => {
    expect(ERASURE_DUE_DAYS).toBe(30);
  });

  it('buildErasureCancelEvent menghasilkan payload cancelledAt sesuai nowIso', () => {
    const base = buildErasureCancelEvent('m-9', T1);
    const row: ErasureRouteRow = {
      type: base.type,
      payloadJson: base.payloadJson,
      createdAt: new Date(T1),
    };
    expect(row.type).toBe('erasure.cancelled');
    const payload = JSON.parse(row.payloadJson) as Record<string, unknown>;
    expect(payload.memberId).toBe('m-9');
    expect(payload.cancelledAt).toBe(T1);
  });
});
