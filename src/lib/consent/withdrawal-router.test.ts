import { describe, expect, it } from 'vitest';
import {
  registerWithdrawalRoutes,
  type WithdrawalEvent,
  type WithdrawalRouteContext,
  type WithdrawalRouteHandler,
  type WithdrawalRouteResult,
  type WithdrawalRouter,
} from './withdrawal-router';

const T0 = '2026-09-17T00:00:00.000Z';
const T1 = '2026-09-18T00:00:00.000Z';
const PATH = '/api/v1/members/:memberId/withdrawal';

/** Mock router kecil: simpan handler terdaftar, sediakan helper invoke. */
type RegisteredRoute = {
  method: 'get' | 'post' | 'delete';
  path: string;
  handler: WithdrawalRouteHandler;
};

function createMockRouter() {
  const routes: RegisteredRoute[] = [];
  const router: WithdrawalRouter = {
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
    callCtx: WithdrawalRouteContext,
  ): Promise<WithdrawalRouteResult> {
    return find(method, path).handler(callCtx);
  }
  return { router, routes, find, invoke };
}

/** Deps in-memory: ledger event per memberId, tanpa IO apa pun. */
function createMockDeps(seed: WithdrawalEvent[] = [], seedMemberId = 'm-1', nowIso = T1) {
  const byMember = new Map<string, WithdrawalEvent[]>();
  byMember.set(seedMemberId, [...seed]);
  return {
    listEvents: async (memberId: string): Promise<WithdrawalEvent[]> => {
      const rows = byMember.get(memberId);
      if (!rows) {
        throw new Error(`member ${memberId} tidak ditemukan di ledger`);
      }
      return rows;
    },
    appendEvent: async (memberId: string, event: WithdrawalEvent): Promise<void> => {
      byMember.get(memberId)?.push(event);
    },
    now: () => nowIso,
    ledger: byMember.get(seedMemberId) as WithdrawalEvent[],
  };
}

function callCtx(overrides: Partial<WithdrawalRouteContext> = {}): WithdrawalRouteContext {
  return { memberId: 'm-1', userId: 'u-1', body: undefined, ...overrides };
}

function setupHarness(seed: WithdrawalEvent[] = [], nowIso = T1) {
  const mock = createMockRouter();
  const deps = createMockDeps(seed, 'm-1', nowIso);
  registerWithdrawalRoutes(mock.router, deps);
  return { ...mock, deps };
}

describe('registrasi route withdrawal', () => {
  it('mendaftarkan tepat 3 route di path yang sama', () => {
    const { routes } = setupHarness();
    expect(routes).toHaveLength(3);
    expect(routes.map((r) => r.method).sort()).toEqual(['delete', 'get', 'post']);
    expect(routes.every((r) => r.path === PATH)).toBe(true);
  });

  it('invoke pada path yang tidak terdaftar melempar error', async () => {
    const { invoke } = setupHarness();
    await expect(
      invoke('delete', '/api/v1/other/withdrawal', callCtx()),
    ).rejects.toThrow('route tidak terdaftar');
  });
});

describe('POST action request', () => {
  it('POST request sah: 201 write dengan stage pending', async () => {
    const { invoke } = setupHarness();
    const result = await invoke('post', PATH, callCtx());
    expect(result.status).toBe(201);
    expect(result.code).toBe('write');
    if (result.code === 'write') {
      expect(result.payload.stage).toBe('pending');
      expect(result.payload.requestedAt).toBe(T1);
      expect(result.payload.dueAt).toBeTruthy();
    }
  });

  it('POST body invalid (extend tanpa reason): 400 invalid_body', async () => {
    const { invoke } = setupHarness();
    const result = await invoke('post', PATH, callCtx({ body: { action: 'extend' } }));
    expect(result.status).toBe(400);
    expect(result.code).toBe('invalid_body');
  });

  it('POST request saat pending: 409 WITHDRAWAL_INVALID_TRANSITION', async () => {
    const { invoke } = setupHarness([{ type: 'request', at: T0, dueAt: T1 }]);
    const result = await invoke('post', PATH, callCtx());
    expect(result.status).toBe(409);
    expect(result.code).toBe('WITHDRAWAL_INVALID_TRANSITION');
    if (result.code === 'WITHDRAWAL_INVALID_TRANSITION') {
      expect(result.message).toContain('pending');
    }
  });
});

describe('GET replay state', () => {
  it('GET tanpa event: 404 not_found', async () => {
    const { invoke } = setupHarness();
    const result = await invoke('get', PATH, callCtx());
    expect(result.status).toBe(404);
    expect(result.code).toBe('not_found');
  });

  it('GET dengan event request: 200 get dan state pending', async () => {
    const { invoke } = setupHarness([{ type: 'request', at: T0, dueAt: T1 }]);
    const result = await invoke('get', PATH, callCtx());
    expect(result.status).toBe(200);
    expect(result.code).toBe('get');
    if (result.code === 'get') {
      expect(result.payload.stage).toBe('pending');
      expect(result.payload.requestedAt).toBe(T0);
      expect(result.payload.dueAt).toBe(T1);
    }
  });
});

describe('POST action extend', () => {
  it('extend saat pending: 200 write dan dueAt bergeser +30 hari', async () => {
    const { invoke } = setupHarness([{ type: 'request', at: T0, dueAt: T1 }]);
    const result = await invoke('post', PATH, callCtx({ body: { action: 'extend', reason: 'dokumen tambahan' } }));
    expect(result.status).toBe(200);
    expect(result.code).toBe('write');
    if (result.code === 'write') {
      const expected = new Date(Date.parse(T1) + 30 * 24 * 60 * 60 * 1000).toISOString();
      expect(result.payload.dueAt).toBe(expected);
    }
  });

  it('extend saat stage none: 409 WITHDRAWAL_INVALID_TRANSITION', async () => {
    const { invoke } = setupHarness();
    const result = await invoke('post', PATH, callCtx({ body: { action: 'extend', reason: 'x' } }));
    expect(result.status).toBe(409);
    expect(result.code).toBe('WITHDRAWAL_INVALID_TRANSITION');
  });
});

describe('POST action refuse', () => {
  it('refuse wajib membawa complaintInfo: tanpa itu 400 invalid_body', async () => {
    const { invoke } = setupHarness([{ type: 'request', at: T0, dueAt: T1 }]);
    const result = await invoke('post', PATH, callCtx({ body: { action: 'refuse', reason: 'tidak lengkap' } }));
    expect(result.status).toBe(400);
    expect(result.code).toBe('invalid_body');
  });

  it('refuse sah: 200 write stage refused dengan complaintInfo tersimpan', async () => {
    const { invoke } = setupHarness([{ type: 'request', at: T0, dueAt: T1 }]);
    const result = await invoke(
      'post',
      PATH,
      callCtx({ body: { action: 'refuse', reason: 'data tidak teridentifikasi', complaintInfo: 'hubung AWP' } }),
    );
    expect(result.status).toBe(200);
    expect(result.code).toBe('write');
    if (result.code === 'write') {
      expect(result.payload.stage).toBe('refused');
      expect(result.payload.refusalReason).toBe('data tidak teridentifikasi');
      expect(result.payload.complaintInfo).toBe('hubung AWP');
    }
  });
});

describe('POST action resolve dan DELETE', () => {
  it('resolve saat pending: 200 write stage resolved', async () => {
    const { invoke } = setupHarness([{ type: 'request', at: T0, dueAt: T1 }]);
    const result = await invoke('post', PATH, callCtx({ body: { action: 'resolve' } }));
    expect(result.status).toBe(200);
    expect(result.code).toBe('write');
    if (result.code === 'write') {
      expect(result.payload.stage).toBe('resolved');
    }
  });

  it('resolve saat stage none: 404 not_found', async () => {
    const { invoke } = setupHarness();
    const result = await invoke('post', PATH, callCtx({ body: { action: 'resolve' } }));
    expect(result.status).toBe(404);
    expect(result.code).toBe('not_found');
  });

  it('DELETE atas withdrawal resolved: 409 WITHDRAWAL_CONFLICT', async () => {
    const { invoke } = setupHarness([
      { type: 'request', at: T0, dueAt: T1 },
      { type: 'resolve', at: T1 },
    ]);
    const result = await invoke('delete', PATH, callCtx());
    expect(result.status).toBe(409);
    expect(result.code).toBe('WITHDRAWAL_CONFLICT');
    if (result.code === 'WITHDRAWAL_CONFLICT') {
      expect(result.message).toContain('resolved');
    }
  });
});

describe('kegagalan deps', () => {
  it('listEvents melempar error umum: 500 internal', async () => {
    const mock = createMockRouter();
    registerWithdrawalRoutes(mock.router, {
      listEvents: async () => {
        throw new Error('koneksi ledger putus');
      },
      appendEvent: async () => undefined,
      now: () => T1,
    });
    const result = await mock.invoke('get', PATH, callCtx());
    expect(result.status).toBe(500);
    expect(result.code).toBe('internal');
    if (result.code === 'internal') {
      expect(result.message).toContain('koneksi ledger putus');
    }
  });
});
