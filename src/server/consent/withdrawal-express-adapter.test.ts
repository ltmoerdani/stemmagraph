import { describe, expect, it } from 'vitest';
import type { Request, RequestHandler, Response } from 'express';
import {
  extendWithdrawalWindow,
  recordWithdrawalRefusal,
  recordWithdrawalRequest,
  resolveWithdrawal,
  WITHDRAWAL_DUE_DAYS,
  type WithdrawalEvent,
} from '../../lib/consent/withdrawal-tracking';
import {
  createWithdrawalExpressAdapter,
  type WithdrawalExpressHost,
  type WithdrawalPrismaClient,
} from './withdrawal-express-adapter';

const T0 = '2026-09-17T00:00:00.000Z';
const T1 = '2026-09-18T00:00:00.000Z';
const WITHDRAWAL_PATH = '/api/v1/members/:memberId/withdrawal';

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
  const host: WithdrawalExpressHost = {
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

type FindManyArgs = Parameters<WithdrawalPrismaClient['event']['findMany']>[0];
type LedgerRow = { type: string; payloadJson: string; createdAt: Date };

/** Prisma in-memory: filter type in + payloadJson contains, urut createdAt. */
function createMockPrisma(seed: LedgerRow[] = []) {
  const rows: LedgerRow[] = [...seed];
  const findManyArgs: FindManyArgs[] = [];
  const prisma: WithdrawalPrismaClient = {
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

/** Baris ledger dari event tracking, memberId ditanam di payload. */
function mkRow(memberId: string, event: WithdrawalEvent, iso: string): LedgerRow {
  return {
    type: event.type,
    payloadJson: JSON.stringify({ ...event, memberId }),
    createdAt: new Date(iso),
  };
}

function seedPending(memberId = 'm-1'): LedgerRow[] {
  const request = recordWithdrawalRequest(T0);
  return [mkRow(memberId, request, T0)];
}

function buildAdapter(seed: LedgerRow[] = []) {
  const hostBox = createMockHost();
  const prismaBox = createMockPrisma(seed);
  createWithdrawalExpressAdapter({ app: hostBox.host, prisma: prismaBox.prisma });
  return { ...hostBox, ...prismaBox };
}

function reqOf(memberId = 'm-1', overrides: Partial<FakeRequest> = {}): FakeRequest {
  return { params: { memberId }, user: { id: 'u-9' }, body: {}, ...overrides };
}

interface StateBody {
  stage?: string;
  dueAt?: string | null;
  refusalReason?: string | null;
  complaintInfo?: string | null;
}

interface RespBody extends StateBody {
  code?: string;
  message?: string;
}

function bodyOf(res: FakeResponse): RespBody {
  return res.body as RespBody;
}

describe('createWithdrawalExpressAdapter', () => {
  it('mendaftar tiga route withdrawal pada host Express', () => {
    const box = buildAdapter();
    expect(box.routes).toHaveLength(3);
    expect(box.routes.map((r) => r.method).sort()).toEqual(['delete', 'get', 'post']);
    expect(box.routes.every((r) => r.path === WITHDRAWAL_PATH)).toBe(true);
  });

  it('GET state pending menjawab 200 payload state tanpa bungkus kode', async () => {
    const box = buildAdapter(seedPending());
    const res = await box.invoke('get', WITHDRAWAL_PATH, reqOf());
    expect(res.statusCode).toBe(200);
    expect(bodyOf(res).stage).toBe('pending');
    expect(bodyOf(res).dueAt).not.toBeNull();
    expect(bodyOf(res).code).toBeUndefined();
  });

  it('POST action request pada member baru menjawab 201 stage pending', async () => {
    const box = buildAdapter();
    const res = await box.invoke('post', WITHDRAWAL_PATH, reqOf('m-2', { body: { action: 'request' } }));
    expect(res.statusCode).toBe(201);
    expect(bodyOf(res).stage).toBe('pending');
    expect(box.rows).toHaveLength(1);
    expect(box.rows[0]?.type).toBe('request');
  });

  it('POST extend saat pending memanjangkan dueAt dan menjawab 200', async () => {
    const box = buildAdapter(seedPending());
    const res = await box.invoke('post', WITHDRAWAL_PATH, reqOf('m-1', { body: { action: 'extend', reason: 'volume data besar' } }));
    expect(res.statusCode).toBe(200);
    expect(bodyOf(res).stage).toBe('pending');
    expect(box.rows).toHaveLength(2);
    expect(box.rows[1]?.type).toBe('extend');
    const extended = JSON.parse(box.rows[1]?.payloadJson ?? '{}') as { dueAt?: string };
    const originalDue = recordWithdrawalRequest(T0).dueAt;
    expect(bodyOf(res).dueAt).toBe(extended.dueAt);
    expect(bodyOf(res).dueAt).not.toBe(originalDue);
  });

  it('POST refuse saat pending menyimpan alasan dan info hak komplain', async () => {
    const box = buildAdapter(seedPending());
    const res = await box.invoke('post', WITHDRAWAL_PATH, reqOf('m-1', {
      body: { action: 'refuse', reason: 'kewajiban hukum', complaintInfo: 'ajukan ke DPO via dpo@example.com' },
    }));
    expect(res.statusCode).toBe(200);
    expect(bodyOf(res).stage).toBe('refused');
    expect(bodyOf(res).refusalReason).toBe('kewajiban hukum');
    expect(bodyOf(res).complaintInfo).toBe('ajukan ke DPO via dpo@example.com');
  });

  it('POST resolve saat pending menjawab 200 stage resolved', async () => {
    const box = buildAdapter(seedPending());
    const res = await box.invoke('post', WITHDRAWAL_PATH, reqOf('m-1', { body: { action: 'resolve' } }));
    expect(res.statusCode).toBe(200);
    expect(bodyOf(res).stage).toBe('resolved');
  });

  it('DELETE cancel pada withdrawal aktif sama dengan resolve', async () => {
    const box = buildAdapter(seedPending());
    const res = await box.invoke('delete', WITHDRAWAL_PATH, reqOf('m-1'));
    expect(res.statusCode).toBe(200);
    expect(bodyOf(res).stage).toBe('resolved');
    expect(box.rows).toHaveLength(2);
    expect(box.rows[1]?.type).toBe('resolve');
  });

  it('POST extend tanpa reason menjawab 400 invalid_body', async () => {
    const box = buildAdapter(seedPending());
    const res = await box.invoke('post', WITHDRAWAL_PATH, reqOf('m-1', { body: { action: 'extend' } }));
    expect(res.statusCode).toBe(400);
    expect(bodyOf(res).code).toBe('invalid_body');
    expect(typeof bodyOf(res).message).toBe('string');
  });

  it('req tanpa params memberId dipetakan kosong dan menjawab 404', async () => {
    const box = buildAdapter();
    const res = await box.invoke('get', WITHDRAWAL_PATH, { params: {}, user: { id: 'u-9' } });
    expect(res.statusCode).toBe(404);
    expect(bodyOf(res).code).toBe('not_found');
  });

  it('POST request saat sudah pending termap 409 lewat mapWithdrawalError', async () => {
    const box = buildAdapter(seedPending());
    const res = await box.invoke('post', WITHDRAWAL_PATH, reqOf('m-1', { body: { action: 'request' } }));
    expect(res.statusCode).toBe(409);
    expect(bodyOf(res).code).toBe('WITHDRAWAL_INVALID_TRANSITION');
    expect(typeof bodyOf(res).message).toBe('string');
  });

  it('GET pada member tanpa event menjawab 404 not_found', async () => {
    const box = buildAdapter();
    const res = await box.invoke('get', WITHDRAWAL_PATH, reqOf('m-kosong'));
    expect(res.statusCode).toBe(404);
    expect(bodyOf(res).code).toBe('not_found');
  });

  it('replay event urut createdAt: request lalu extend menghasilkan dueAt baru', async () => {
    const request = recordWithdrawalRequest(T0);
    const extended = extendWithdrawalWindow(T1, 'perpanjangan', request.dueAt);
    const box = buildAdapter([mkRow('m-1', extended, T1), mkRow('m-1', request, T0)]);
    expect(box.findManyArgs).toHaveLength(0);
    const res = await box.invoke('get', WITHDRAWAL_PATH, reqOf('m-1'));
    expect(res.statusCode).toBe(200);
    expect(bodyOf(res).stage).toBe('pending');
    expect(bodyOf(res).dueAt).toBe(extended.dueAt);
    expect(box.findManyArgs[0]?.orderBy).toEqual({ createdAt: 'asc' });
  });

  it('sendResult memetakan kode: error berbentuk code+message, sukses payload polos', async () => {
    const box = buildAdapter(seedPending());
    const error = await box.invoke('get', WITHDRAWAL_PATH, reqOf('m-tidak-ada'));
    expect(error.statusCode).toBe(404);
    expect(Object.keys(bodyOf(error)).sort()).toEqual(['code', 'message']);
    const ok = await box.invoke('post', WITHDRAWAL_PATH, reqOf('m-1', { body: { action: 'resolve' } }));
    expect(ok.statusCode).toBe(200);
    expect(Object.keys(bodyOf(ok))).toContain('stage');
    expect(bodyOf(ok).code).toBeUndefined();
  });

  it('konstanta due days tracking masih 30 hari (GDPR Art. 12(3))', () => {
    expect(WITHDRAWAL_DUE_DAYS).toBe(30);
    expect(resolveWithdrawal(T1).type).toBe('resolve');
    expect(recordWithdrawalRefusal('alasan', 'info').complaintInfo).toBe('info');
  });
});
