/**
 * Wiring scheduler purge erasure server-side (STG v123-ii).
 * Menghubungkan ErasurePurgeScheduler core ke instance prisma nyata,
 * menyediakan setInterval terjadwal unref, penelanan error per tick,
 * proteksi agar tidak dobel berjalan, dan handle stop untuk pengujian.
 * Bebas em dash, sesuai standar Anti-AI.
 */

import {
  scanErasurePurges,
  type ErasurePurgeSchedulerDeps,
  type ErasurePurgeSchedulerSummary,
} from './erasure-purge-scheduler';
import { executeErasurePurge } from '../../lib/consent/erasure-purge-execute';
import type { ErasureEventType } from '../../lib/consent/erasure-wiring';

/** Bentuk prisma minimal untuk scheduler purge: familyMember dan event ledger. */
export interface ErasurePurgeSchedulerPrismaClient {
  familyMember: {
    findMany(args?: { select?: { id?: boolean } }): Promise<Array<{ id: string }>>;
  };
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
  familyMemberData?: {
    findUnique(args: { where: { id: string } }): Promise<Record<string, unknown> | null>;
    update(args: { where: { id: string }; data: Record<string, unknown> }): Promise<unknown>;
  };
}

export interface ErasurePurgeSchedulerOptions {
  prisma: ErasurePurgeSchedulerPrismaClient;
  intervalMs?: number;
  deps?: ErasurePurgeSchedulerDeps;
  log?: (message: string, ...args: unknown[]) => void;
}

export interface ErasurePurgeSchedulerHandle {
  stop(): void;
  runOnce(): Promise<ErasurePurgeSchedulerSummary>;
  isRunning(): boolean;
}

/**
 * Membangun ErasurePurgeSchedulerDeps standar dari prisma nyata.
 * Mengambil daftar id member dari familyMember, event ledger dari model Event,
 * dan mengeksekusi purge via executeErasurePurge dengan callback getMember/updateMember
 * dari familyMember.
 */
export function buildDefaultErasurePurgeSchedulerDeps(
  prisma: ErasurePurgeSchedulerPrismaClient,
): ErasurePurgeSchedulerDeps {
  return {
    listMemberIds: async () => {
      const members = await prisma.familyMember.findMany({ select: { id: true } });
      return members.map((m) => m.id);
    },
    listEvents: async (memberId: string) => {
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
    executePurge: async (memberId: string) => {
      const executeDeps = {
        listEvents: async (id: string) => {
          const rows = await prisma.event.findMany({
            where: {
              type: {
                in: ['erasure.requested', 'erasure.completed', 'erasure.cancelled'],
              },
              payloadJson: { contains: `"memberId":"${id}"` },
            },
            orderBy: { createdAt: 'asc' },
          });
          return rows.map((row) => ({
            type: row.type as ErasureEventType,
            payloadJson: row.payloadJson,
          }));
        },
        getMember: async (id: string) => {
          const member = await prisma.familyMember.findMany({
            where: { id },
          });
          return (member[0] as unknown as Record<string, unknown>) ?? null;
        },
        updateMember: async (id: string, updated: Record<string, unknown>) => {
          // Menggunakan prisma raw update atau pendekatan penyetujuan data member
          // Mengambil field PII yang relevan dan melakukan update pada familyMember
          const safeData: Record<string, unknown> = {};
          const fields = ['email', 'phone', 'photoUrl', 'currentLocation', 'notes'];
          for (const f of fields) {
            if (Object.prototype.hasOwnProperty.call(updated, f)) {
              safeData[f] = updated[f];
            }
          }
          // Jika prisma punya familyMember update
          const clientWithUpdate = prisma as unknown as {
            familyMember: {
              update(args: { where: { id: string }; data: Record<string, unknown> }): Promise<unknown>;
            };
          };
          if (clientWithUpdate.familyMember && typeof clientWithUpdate.familyMember.update === 'function') {
            await clientWithUpdate.familyMember.update({
              where: { id },
              data: safeData,
            });
          }
        },
        appendEvent: async (row: { type: string; payloadJson: string }) => {
          await prisma.event.create({
            data: {
              type: row.type,
              payloadJson: row.payloadJson,
            },
          });
        },
        nowIso: () => new Date().toISOString(),
      };
      return executeErasurePurge(memberId, executeDeps);
    },
    nowIso: () => new Date().toISOString(),
  };
}

/**
 * Membuat dan memulai scheduler purge erasure terkelola.
 * Menjadwalkan scan periodic dengan interval default 1 jam (3600000 ms),
 * melindungi dari eksekusi tumpang tindih (reentrant guard), menelan error per tick,
 * dan mengembalikan handle stop serta runOnce.
 */
export function createErasurePurgeScheduler(
  options: ErasurePurgeSchedulerOptions,
): ErasurePurgeSchedulerHandle {
  const intervalMs = options.intervalMs ?? 3600000;
  const deps = options.deps ?? buildDefaultErasurePurgeSchedulerDeps(options.prisma);
  const log = options.log ?? ((msg: string) => console.log(`[erasure-purge-scheduler] ${msg}`));

  let running = false;
  let activeTick = false;
  let timer: NodeJS.Timeout | null = null;

  async function runOnce(): Promise<ErasurePurgeSchedulerSummary> {
    if (activeTick) {
      log('scan dilewati: tick sebelumnya masih berjalan');
      return { candidates: [], purged: [], skipped: [] };
    }
    activeTick = true;
    try {
      const summary = await scanErasurePurges(deps);
      if (summary.candidates.length > 0) {
        log(`scan selesai: ${summary.candidates.length} kandidat, ${summary.purged.length} ter-purge`);
      }
      return summary;
    } catch (err) {
      log('error tidak tertangkap pada tick scan purge:', (err as Error).message);
      return { candidates: [], purged: [], skipped: [] };
    } finally {
      activeTick = false;
    }
  }

  function start(): void {
    if (running) return;
    running = true;
    timer = setInterval(() => {
      runOnce().catch((err) => {
        log('error tick setInterval ditelan:', (err as Error).message);
      });
    }, intervalMs);

    if (timer && typeof timer.unref === 'function') {
      timer.unref();
    }
  }

  function stop(): void {
    if (!running) return;
    running = false;
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  // Otomatis mulai saat diciptakan
  start();

  return {
    stop,
    runOnce,
    isRunning: () => running,
  };
}
