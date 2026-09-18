/**
 * Express adapter untuk withdrawal routes (S-115-ii-b-a).
 * Tugasnya satu: memetakan Express req/res ke WithdrawalRouteContext,
 * lalu mendelegasikan seluruh logika ke registerWithdrawalRoutes.
 * Prisma di-inject lewat parameter, tidak ada koneksi baru di sini.
 */

import type { Request, RequestHandler, Response } from 'express';
import {
  registerWithdrawalRoutes,
  type WithdrawalRouteHandler,
  type WithdrawalRouteResult,
  type WithdrawalRouter,
  type WithdrawalRouterDeps,
} from '../../lib/consent/withdrawal-router';
import type { WithdrawalEvent, WithdrawalEventType } from '../../lib/consent/withdrawal-tracking';

/** Path withdrawal yang sama dengan yang dipakai withdrawal-router. */
const WITHDRAWAL_PATH = '/api/v1/members/:memberId/withdrawal';

/** Host minimal yang dibutuhkan: aplikasi Express atau subrouter. */
export interface WithdrawalExpressHost {
  get(path: string, handler: RequestHandler): unknown;
  post(path: string, handler: RequestHandler): unknown;
  delete(path: string, handler: RequestHandler): unknown;
}

/**
 * Bentuk prisma minimal untuk ledger Event. Struktural, jadi client
 * prisma apa pun yang punya event.findMany dan event.create diterima.
 */
export interface WithdrawalPrismaClient {
  event: {
    findMany(args: {
      where: {
        type: { in: string[] };
        payloadJson: { contains: string };
      };
      orderBy: { createdAt: 'asc' };
    }): Promise<Array<{ type: string; payloadJson: string }>>;
    create(args: {
      data: { type: string; payloadJson: string };
    }): Promise<unknown>;
  };
}

/** Parameter adapter: host Express plus client prisma yang sudah tersambung. */
export interface WithdrawalExpressAdapterOptions {
  app: WithdrawalExpressHost;
  prisma: WithdrawalPrismaClient;
}

interface WithdrawalExpressRequest extends Request {
  params: { memberId?: string } & Request['params'];
  user?: { id?: string };
}

const WITHDRAWAL_EVENT_TYPES = ['request', 'extend', 'refuse', 'resolve'];

/** Petakan hasil router ke respons HTTP: payload untuk 200/201, sisanya kode pesan. */
function sendResult(res: Response, result: WithdrawalRouteResult): void {
  if (result.code === 'get' || result.code === 'write') {
    res.status(result.status).json(result.payload);
    return;
  }
  res.status(result.status).json({ code: result.code, message: result.message });
}

/** Bungkus handler router menjadi RequestHandler Express. */
function toRequestHandler(handler: WithdrawalRouteHandler): RequestHandler {
  return (req, res) => {
    const withdrawalReq = req as WithdrawalExpressRequest;
    const ctx = {
      memberId: String(withdrawalReq.params.memberId ?? ''),
      userId: String(withdrawalReq.user?.id ?? ''),
      body: withdrawalReq.body,
    };
    handler(ctx)
      .then((result) => sendResult(res, result))
      .catch(() => {
        res.status(500).json({ code: 'internal', message: 'kegagalan internal' });
      });
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Urai payloadJson ledger menjadi WithdrawalEvent. memberId disimpan
 * di dalam payload untuk filter contains, lalu dicopot saat dibaca.
 */
function parseLedgerEvent(type: string, payloadJson: string): WithdrawalEvent {
  const parsed: unknown = JSON.parse(payloadJson);
  if (!isRecord(parsed)) {
    throw new Error('payloadJson ledger withdrawal bukan objek');
  }
  const rest = parsed as Omit<Record<string, string>, "memberId">;
  return {
    type: type as WithdrawalEventType,
    at: String(rest.at ?? ''),
    ...(rest.dueAt === undefined ? {} : { dueAt: String(rest.dueAt) }),
    ...(rest.reason === undefined ? {} : { reason: String(rest.reason) }),
    ...(rest.complaintInfo === undefined ? {} : { complaintInfo: String(rest.complaintInfo) }),
  };
}

/**
 * Pasang tiga route withdrawal pada aplikasi Express. Router entri
 * tetap registerWithdrawalRoutes; adapter hanya menyediakan jembatan
 * req/res dan deps ledger berbasis prisma yang di-inject.
 */
export function createWithdrawalExpressAdapter(options: WithdrawalExpressAdapterOptions): void {
  const { app, prisma } = options;

  const deps: WithdrawalRouterDeps = {
    listEvents: async (memberId) => {
      const rows = await prisma.event.findMany({
        where: {
          type: { in: WITHDRAWAL_EVENT_TYPES },
          payloadJson: { contains: `"memberId":"${memberId}"` },
        },
        orderBy: { createdAt: 'asc' },
      });
      return rows.map((row) => parseLedgerEvent(row.type, row.payloadJson));
    },
    appendEvent: async (memberId, event) => {
      await prisma.event.create({
        data: {
          type: event.type,
          payloadJson: JSON.stringify({ ...event, memberId }),
        },
      });
    },
    now: () => new Date().toISOString(),
  };

  const router: WithdrawalRouter = {
    get: (_path, handler) => app.get(WITHDRAWAL_PATH, toRequestHandler(handler)),
    post: (_path, handler) => app.post(WITHDRAWAL_PATH, toRequestHandler(handler)),
    delete: (_path, handler) => app.delete(WITHDRAWAL_PATH, toRequestHandler(handler)),
  };

  registerWithdrawalRoutes(router, deps);
}
