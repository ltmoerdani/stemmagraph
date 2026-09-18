import { describe, expect, it } from 'vitest';
import type { Request, RequestHandler, Response } from 'express';
import { buildErasureRequestEvent } from '../../lib/consent/erasure-routes';
import {
  createErasureExpressAdapter,
  type ErasureExpressHost,
  type ErasurePrismaClient,
} from './erasure-express-adapter';

const T0 = '2026-09-17T00:00:00.000Z';
const ERASURE_PATH = '/api/v1/members/:memberId/erasure';

/** Req palsu: cukup params, user, dan body untuk mapping adapter. */
interface FakeRequest {
  params: Record<string, string>;
  user?: { id?: string };
  body?: unknown;
}

/** Res palsu: status dan json terakhir terekam untuk assert. */
interface FakeResponse {
  statusCode: number;
  body: unknown;
  status(code: number): FakeResponse;
  json(payload: unknown): FakeResponse;
}

function createRes() {
  let settle: (res: FakeResponse) => void = () => undefined;
  const done = new Promise<FakeResponse>((resolve) => {
    settle = resolve;
  });
  const res: FakeResponse = {
    statusCode: 0,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      settle(this);
      return this;
    },
  };
  return { res, done };
}

/** Host palsu: simpan handler terdaftar, sediakan invoke req/res. */
function createMockHost() {
  const routes: Array<{ method: 'get' | 'post' | 'delete'; path: string; handler: RequestHandler }> = [];
  const host: ErasureExpressHost = {
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
  function find(method: 'get' | 'post' | 'delete', path: string): RequestHandler {
    const route = routes.find((r) => r.method === method && r.path === path);
    if (!route) {
      throw new Error(`route tidak terdaftar: ${method} ${path}`);
    }
    return route.handler;
  }
  async function invoke(method: 'get' | 'post' | 'delete', path: string, req: FakeRequest): Promise<FakeResponse> {
    const { res, done } = createRes();
    find(method, path)(
      req as unknown as Request,
      res as unknown as Response,
      () => undefined,
    );
    return done;
  }
  return { host, routes, find, invoke };
}

type FindManyArgs = Parameters<ErasurePrismaClient['event']['findMany']>[0];
type LedgerRow = { type: string; payloadJson: string; createdAt: Date };

/** Prisma in-memory: filter type in + payloadJson contains, urut createdAt. */
function createMockPrisma(seed: LedgerRow[] = []) {
  const rows: LedgerRow[] = [...seed];
  const findManyArgs: FindManyArgs[] = [];
  const prisma: ErasurePrismaClient = {
    event: {
      findMany: async (args) => {
        findManyArgs.push(args);
        return rows
          .filter(
            (row) =>
              args.where.type.in.includes(row.type) &&
              row.payloadJson.includes(args.where.payloadJson.contains),
          )
          .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
          .map((row) => ({ type: row.type, payloadJson: row.payloadJson }));
      },
      create: async (args) => {
        rows.push({ type: args.data.type, payloadJson: args.data.payloadJson, createdAt: new Date() });
        return args.data;
      },
    },
  };
  return { prisma, rows, findManyArgs };
}

function seedRequest(memberId = 'm-1', iso = T0): LedgerRow {
  const base = buildErasureRequestEvent(memberId, iso);
  return { type: base.type, payloadJson: base.payloadJson, createdAt: new Date(iso) };
}

function buildAdapter(seed: LedgerRow[] = []) {
  const hostBox = createMockHost();
  const prismaBox = createMockPrisma(seed);
  createErasureExpressAdapter({ app: hostBox.host, prisma: prismaBox.prisma });
  return { ...hostBox, ...prismaBox };
}

function reqOf(memberId = 'm-1', overrides: Partial<FakeRequest> = {}): FakeRequest {
  return { params: { memberId }, user: { id: 'u-9' }, body: {}, ...overrides };
}

interface RespBody {
  code?: string;
  message?: string;
  request?: { status?: string; memberId?: string };
}

function bodyOf(res: FakeResponse): RespBody {
  return res.body as RespBody;
}

describe('createErasureExpressAdapter', () => {
  it('mendaftar tiga route erasure pada host Express', () => {
    const box = buildAdapter();
    expect(box.routes).toHaveLength(3);
    expect(box.routes.map((r) => r.method).sort()).toEqual(['delete', 'get', 'post']);
    expect(box.routes.every((r) => r.path === ERASURE_PATH)).toBe(true);
  });

  it('GET tanpa event ledger menjawab 404 not_found', async () => {
    const box = buildAdapter();
    const res = await box.invoke('get', ERASURE_PATH, reqOf());
    expect(res.statusCode).toBe(404);
    expect(bodyOf(res).code).toBe('not_found');
  });

  it('GET dengan event requested menjawab 200 REQUESTED', async () => {
    const box = buildAdapter([seedRequest()]);
    const res = await box.invoke('get', ERASURE_PATH, reqOf());
    expect(res.statusCode).toBe(200);
    expect(bodyOf(res).request?.status).toBe('REQUESTED');
    expect(bodyOf(res).request?.memberId).toBe('m-1');
  });

  it('GET meneruskan filter memberId ke prisma findMany', async () => {
    const box = buildAdapter([seedRequest()]);
    await box.invoke('get', ERASURE_PATH, reqOf('m-1'));
    expect(box.findManyArgs).toHaveLength(1);
    expect(box.findManyArgs[0].where.payloadJson.contains).toBe('"memberId":"m-1"');
    expect(box.findManyArgs[0].where.type.in).toContain('erasure.requested');
  });

  it('POST body tanpa action membuat event requested dan menjawab 201', async () => {
    const box = buildAdapter();
    const res = await box.invoke('post', ERASURE_PATH, reqOf('m-1', { body: {} }));
    expect(res.statusCode).toBe(201);
    expect(bodyOf(res).request?.status).toBe('REQUESTED');
    expect(box.rows.map((r) => r.type)).toEqual(['erasure.requested']);
  });

  it('POST action cancel atas REQUESTED menjawab 200 CANCELLED', async () => {
    const box = buildAdapter([seedRequest()]);
    const res = await box.invoke('post', ERASURE_PATH, reqOf('m-1', { body: { action: 'cancel' } }));
    expect(res.statusCode).toBe(200);
    expect(bodyOf(res).request?.status).toBe('CANCELLED');
    expect(box.rows.map((r) => r.type)).toEqual(['erasure.requested', 'erasure.cancelled']);
  });

  it('POST cancel tanpa request tidak menambah event dan menjawab 404', async () => {
    const box = buildAdapter();
    const res = await box.invoke('post', ERASURE_PATH, reqOf('m-1', { body: { action: 'cancel' } }));
    expect(res.statusCode).toBe(404);
    expect(box.rows).toHaveLength(0);
  });

  it('POST request ganda atas REQUESTED menjawab 409 ERASURE_CONFLICT', async () => {
    const box = buildAdapter([seedRequest()]);
    const res = await box.invoke('post', ERASURE_PATH, reqOf('m-1', { body: {} }));
    expect(res.statusCode).toBe(409);
    expect(bodyOf(res).code).toBe('ERASURE_CONFLICT');
  });

  it('DELETE atas REQUESTED menjawab 200 CANCELLED dan menambah event', async () => {
    const box = buildAdapter([seedRequest()]);
    const res = await box.invoke('delete', ERASURE_PATH, reqOf());
    expect(res.statusCode).toBe(200);
    expect(bodyOf(res).request?.status).toBe('CANCELLED');
    expect(box.rows).toHaveLength(2);
  });

  it('DELETE tanpa request menjawab 404 dan tidak menambah event', async () => {
    const box = buildAdapter();
    const res = await box.invoke('delete', ERASURE_PATH, reqOf());
    expect(res.statusCode).toBe(404);
    expect(bodyOf(res).code).toBe('not_found');
    expect(box.rows).toHaveLength(0);
  });

  it('params memberId kosong dipetakan dan ledger nihil menjawab 404', async () => {
    const box = buildAdapter([seedRequest()]);
    const res = await box.invoke('get', ERASURE_PATH, reqOf('', { params: {} }));
    expect(res.statusCode).toBe(404);
    expect(box.findManyArgs[0].where.payloadJson.contains).toBe('"memberId":""');
  });

  it('kegagalan prisma findMany pada GET dipetakan router jadi 400', async () => {
    const hostBox = createMockHost();
    const failing: ErasurePrismaClient = {
      event: {
        findMany: async () => {
          throw new Error('db down');
        },
        create: async () => undefined,
      },
    };
    createErasureExpressAdapter({ app: hostBox.host, prisma: failing });
    const res = await hostBox.invoke('get', ERASURE_PATH, reqOf());
    expect(res.statusCode).toBe(400);
    expect(bodyOf(res).code).toBe('invalid_body');
  });

  it('kegagalan prisma create pada POST dipetakan router jadi 400', async () => {
    const hostBox = createMockHost();
    const failing: ErasurePrismaClient = {
      event: {
        findMany: async () => [],
        create: async () => {
          throw new Error('db write gagal');
        },
      },
    };
    createErasureExpressAdapter({ app: hostBox.host, prisma: failing });
    const res = await hostBox.invoke('post', ERASURE_PATH, reqOf('m-1', { body: {} }));
    expect(res.statusCode).toBe(400);
    expect(bodyOf(res).code).toBe('invalid_body');
  });

  it('respons error menyertakan pesan not_found dari router', async () => {
    const box = buildAdapter();
    const res = await box.invoke('get', ERASURE_PATH, reqOf());
    expect(bodyOf(res).message).toBe('erasure request not found');
  });
});
