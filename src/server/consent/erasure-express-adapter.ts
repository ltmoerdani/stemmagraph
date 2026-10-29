/**
 * Express adapter untuk erasure routes (S-09b-vi-ii-a).
 * Tugasnya satu: memetakan Express req/res ke ErasureRouteContext,
 * lalu mendelegasikan seluruh logika ke registerErasureRoutes.
 * Prisma di-inject lewat parameter, tidak ada koneksi baru di sini.
 * GOAL v421 SLICE 2: setelah prisma.event.create sukses di appendEvent,
 * emisi notifikasi owner dijalankan fire-and-log (kegagalan emisi tidak
 * boleh menggagalkan appendEvent maupun respons route).
 */

import type { Request, RequestHandler, Response } from 'express';
import {
  encryptEventForWrite,
  listMemberEventRows,
  resolveDekOrNull,
  resolveTreeIdForMember,
} from './erasure-crypto-wiring';
import {
  registerErasureRoutes,
  type ErasureRouteHandler,
  type ErasureRouteResult,
  type ErasureRouter,
  type ErasureRouterDeps,
} from '../../lib/consent/erasure-router';
import type { ErasureEventType } from '../../lib/consent/erasure-wiring';
import {
  emitErasureOwnerNotifications,
  erasureMemberIdFromPayload,
  type ErasureNotificationPrismaClient,
} from './erasure-notify-wiring';

/** Path erasure yang sama dengan yang dipakai erasure-router. */
const ERASURE_PATH = '/api/v1/members/:memberId/erasure';

/** Host minimal yang dibutuhkan: aplikasi Express atau subrouter. */
export interface ErasureExpressHost {
  get(path: string, handler: RequestHandler): unknown;
  post(path: string, handler: RequestHandler): unknown;
  delete(path: string, handler: RequestHandler): unknown;
}

/**
 * Bentuk prisma minimal untuk ledger Event dan emisi notifikasi.
 * Struktural, jadi client prisma apa pun yang punya model-model ini diterima.
 */
export interface ErasurePrismaClient extends ErasureNotificationPrismaClient {
  event: {
    findMany(args: {
      where: {
        type: { in: string[] };
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
      const rawRows = await prisma.event.findMany({
        where: {
          type: {
            in: ['erasure.requested', 'erasure.completed', 'erasure.cancelled'],
          },
        },
        orderBy: { createdAt: 'asc' },
      });
      const treeId = await resolveTreeIdForMember(prisma, memberId);
      const key = treeId ? resolveDekOrNull(treeId) : null;
      return listMemberEventRows(
        rawRows,
        key?.dek ?? null,
        key?.keyId ?? 'legacy',
        memberId,
      ).map((row) => ({
        type: row.type as ErasureEventType,
        payloadJson: row.payloadJson,
      }));
    },
    appendEvent: async (row, ctxExtra) => {
      // Enkripsi fail-open terkontrol: bila treeId member tidak ada atau
      // resolve DEK gagal (termasuk payload bukan JSON valid), payload
      // diteruskan plaintext apa adanya; bila treeId tersedia, payloadJson
      // disimpan sebagai envelope terenkripsi.
      const payloadMemberId = erasureMemberIdFromPayload(
        row.payloadJson,
        ctxExtra?.memberId ?? '',
      );
      let payloadJson = row.payloadJson;
      try {
        const parsedPayload: unknown = JSON.parse(row.payloadJson);
        const treeId = await resolveTreeIdForMember(prisma, payloadMemberId);
        if (treeId !== null) {
          payloadJson = encryptEventForWrite(treeId, parsedPayload).stored;
        }
      } catch {
        payloadJson = row.payloadJson;
      }
      await prisma.event.create({
        data: { type: row.type, payloadJson },
      });

      // Emisi notifikasi owner fire-and-log: seluruh kegagalan ditelan
      // di dalam emitErasureOwnerNotifications, jadi respons route dan
      // ledger tetap sukses meskipun emisi gagal. memberId dari payload
      // asli dipakai apa adanya, terenkripsi atau tidak.
      await emitErasureOwnerNotifications({
        prisma,
        memberId: payloadMemberId,
        eventType: row.type,
        actorUserId: ctxExtra?.userId ?? '',
        evidence: new Date().toISOString(),
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
