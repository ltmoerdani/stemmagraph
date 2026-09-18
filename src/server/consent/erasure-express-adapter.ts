/**
 * Express adapter untuk erasure routes (S-09b-vi-ii-a).
 * Tugasnya satu: memetakan Express req/res ke ErasureRouteContext,
 * lalu mendelegasikan seluruh logika ke registerErasureRoutes.
 * Prisma di-inject lewat parameter, tidak ada koneksi baru di sini.
 */

import type { Request, RequestHandler, Response } from 'express';
import {
  registerErasureRoutes,
  type ErasureRouteHandler,
  type ErasureRouteResult,
  type ErasureRouter,
  type ErasureRouterDeps,
} from '../../lib/consent/erasure-router';
import type { ErasureEventType } from '../../lib/consent/erasure-wiring';

/** Path erasure yang sama dengan yang dipakai erasure-router. */
const ERASURE_PATH = '/api/v1/members/:memberId/erasure';

/** Host minimal yang dibutuhkan: aplikasi Express atau subrouter. */
export interface ErasureExpressHost {
  get(path: string, handler: RequestHandler): unknown;
  post(path: string, handler: RequestHandler): unknown;
  delete(path: string, handler: RequestHandler): unknown;
}

/**
 * Bentuk prisma minimal untuk ledger Event. Struktural, jadi client
 * prisma apa pun yang punya event.findMany dan event.create diterima.
 */
export interface ErasurePrismaClient {
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
export interface ErasureExpressAdapterOptions {
  app: ErasureExpressHost;
  prisma: ErasurePrismaClient;
}

interface ErasureExpressRequest extends Request {
  params: { memberId?: string } & Request['params'];
  user?: { id?: string };
}

/** Petakan hasil router ke respons HTTP: payload untuk 200/201, sisanya kode pesan. */
function sendResult(res: Response, result: ErasureRouteResult): void {
  if (result.code === 'get' || result.code === 'write') {
    res.status(result.status).json(result.payload);
    return;
  }
  res.status(result.status).json({ code: result.code, message: result.message });
}

/** Bungkus handler router menjadi RequestHandler Express. */
function toRequestHandler(handler: ErasureRouteHandler): RequestHandler {
  return (req, res) => {
    const erasureReq = req as ErasureExpressRequest;
    const ctx = {
      memberId: String(erasureReq.params.memberId ?? ''),
      userId: String(erasureReq.user?.id ?? ''),
      body: erasureReq.body,
    };
    handler(ctx)
      .then((result) => sendResult(res, result))
      .catch(() => {
        res.status(500).json({ code: 'internal', message: 'kegagalan internal' });
      });
  };
}

/**
 * Pasang tiga route erasure pada aplikasi Express. Router entri
 * tetap registerErasureRoutes; adapter hanya menyediakan jembatan
 * req/res dan deps ledger berbasis prisma yang di-inject.
 */
export function createErasureExpressAdapter(options: ErasureExpressAdapterOptions): void {
  const { app, prisma } = options;

  const deps: ErasureRouterDeps = {
    listEvents: async (memberId) => {
      const rows = await prisma.event.findMany({
        where: {
          type: {
            in: ['erasure.requested', 'erasure.completed', 'erasure.cancelled'],
          },
          payloadJson: { contains: `"memberId":"${memberId}"` },
        },
        orderBy: { createdAt: 'asc' },
      });
      return rows.map((row) => ({
        type: row.type as ErasureEventType,
        payloadJson: row.payloadJson,
      }));
    },
    appendEvent: async (row) => {
      await prisma.event.create({
        data: { type: row.type, payloadJson: row.payloadJson },
      });
    },
  };

  const router: ErasureRouter = {
    get: (_path, handler) => app.get(ERASURE_PATH, toRequestHandler(handler)),
    post: (_path, handler) => app.post(ERASURE_PATH, toRequestHandler(handler)),
    delete: (_path, handler) => app.delete(ERASURE_PATH, toRequestHandler(handler)),
  };

  registerErasureRoutes(router, deps);
}
