/**
 * Test wiring scheduler purge erasure (STG v123-ii).
 * Kontrak yang diuji: start otomatis interval default, timer.unref,
 * proteksi reentrant, error tick tertelan, stop membersihkan timer,
 * deps default dari prisma (listMemberIds, listEvents, executePurge
 * mendelegasikan executeErasurePurge dengan filter field PII), dan
 * runOnce meneruskan ringkasan scanErasurePurges.
 * Modul scheduler dan execute di-mock agar kontrak delegasi wiring
 * diuji terisolasi dari implementasi inti (sudah punya test sendiri).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('./erasure-purge-scheduler', () => ({
  scanErasurePurges: vi.fn(),
}));
vi.mock('../../lib/consent/erasure-purge-execute', () => ({
  executeErasurePurge: vi.fn(),
}));
import {
  createErasurePurgeScheduler,
  buildDefaultErasurePurgeSchedulerDeps,
  type ErasurePurgeSchedulerPrismaClient,
} from './erasure-purge-scheduler-wiring';
import { scanErasurePurges } from './erasure-purge-scheduler';
import { executeErasurePurge } from '../../lib/consent/erasure-purge-execute';

const mockScan = vi.mocked(scanErasurePurges);
const mockExec = vi.mocked(executeErasurePurge);

const NOW_DUE = '2026-09-15T00:00:00.000Z';
const DEFAULT_INTERVAL_MS = 3600000;

const RINGKASAN_KOSONG = { candidates: [] as string[], purged: [] as string[], skipped: [] as string[] };

interface WiringEnv {
  familyMemberFindManyCalls: Array<Record<string, unknown> | undefined>;
  memberUpdateCalls: Array<{ where: { id: string }; data: Record<string, unknown> }>;
  eventFindManyCalls: Array<{ types: string[]; contains: string }>;
  eventCreateCalls: Array<{ type: string; payloadJson: string }>;
  members: Array<Record<string, unknown>>;
  events: Array<{ type: string; payloadJson: string }>;
}

function makePrisma(overrides: Partial<Pick<WiringEnv, 'members' | 'events'>> = {}): {
  prisma: ErasurePurgeSchedulerPrismaClient;
  env: WiringEnv;
} {
  const env: WiringEnv = {
    familyMemberFindManyCalls: [],
    memberUpdateCalls: [],
    eventFindManyCalls: [],
    eventCreateCalls: [],
    members: overrides.members ?? [],
    events: overrides.events ?? [],
  };
  const prisma = {
    familyMember: {
      findMany: async (args?: {
        select?: { id?: boolean };
        where?: { id: string };
      }): Promise<Array<Record<string, unknown>>> => {
        env.familyMemberFindManyCalls.push(args);
        if (args?.where?.id) {
          return env.members.filter((m) => m.id === args.where?.id);
        }
        return env.members.map((m) => ({ ...m }));
      },
      update: async (args: {
        where: { id: string };
        data: Record<string, unknown>;
      }): Promise<unknown> => {
        env.memberUpdateCalls.push(args);
        return { ...args.data };
      },
    },
    event: {
      findMany: async (args: {
        where: { type: { in: string[] }; payloadJson: { contains: string } };
        orderBy: { createdAt: 'asc' };
      }): Promise<Array<{ type: string; payloadJson: string }>> => {
        env.eventFindManyCalls.push({
          types: [...args.where.type.in],
          contains: args.where.payloadJson.contains,
        });
        const memberId = args.where.payloadJson.contains.slice(
          '"memberId":"'.length,
          -1,
        );
        return env.events
          .filter((e) => args.where.type.in.includes(e.type))
          .filter((e) => e.payloadJson.includes(`"memberId":"${memberId}"`));
      },
      create: async (args: {
        data: { type: string; payloadJson: string };
      }): Promise<unknown> => {
        env.eventCreateCalls.push(args.data);
        env.events.push(args.data);
        return { ...args.data };
      },
    },
  } as unknown as ErasurePurgeSchedulerPrismaClient;
  return { prisma, env };
}

function requestedRow(memberId: string): { type: string; payloadJson: string } {
  return {
    type: 'erasure.requested',
    payloadJson: JSON.stringify({ memberId, requestedAt: '2026-08-01T00:00:00.000Z' }),
  };
}

function completedRow(memberId: string): { type: string; payloadJson: string } {
  return {
    type: 'erasure.completed',
    payloadJson: JSON.stringify({ memberId, completedAt: '2026-08-10T00:00:00.000Z' }),
  };
}

function makeMember(id: string): Record<string, unknown> {
  return {
    id,
    fullName: 'Subjek Uji',
    email: 'subjek@contoh.id',
    phone: '+628123456789',
    photoUrl: 'https://contoh.id/foto.png',
    currentLocation: 'Jakarta',
    notes: 'catatan pribadi',
  };
}

beforeEach(() => {
  mockScan.mockReset();
  mockExec.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('createErasurePurgeScheduler', () => {
  it('kasus 1: memulai interval default saat diciptakan, isRunning true, scan jalan pada 3600000 ms', async () => {
    vi.useFakeTimers();
    mockScan.mockResolvedValue(RINGKASAN_KOSONG);
    const { prisma } = makePrisma();
    const scheduler = createErasurePurgeScheduler({ prisma, log: () => undefined });

    expect(scheduler.isRunning()).toBe(true);

    await vi.advanceTimersByTimeAsync(DEFAULT_INTERVAL_MS - 1);
    expect(mockScan).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(mockScan).toHaveBeenCalledTimes(1);

    scheduler.stop();
  });

  it('kasus 2: timer.unref dipanggil sekali saat scheduler mulai', () => {
    vi.useFakeTimers();
    const { prisma } = makePrisma();
    const unref = vi.fn();
    const originalSetInterval = global.setInterval;
    const wrappedSetInterval = ((fn: () => void, ms?: number, ...rest: unknown[]) => {
      const timer = originalSetInterval(fn, ms, ...rest) as unknown as NodeJS.Timeout;
      Object.defineProperty(timer, 'unref', { value: unref });
      return timer;
    }) as typeof setInterval;
    global.setInterval = wrappedSetInterval;

    try {
      const scheduler = createErasurePurgeScheduler({ prisma, log: () => undefined });
      expect(unref).toHaveBeenCalledTimes(1);
      scheduler.stop();
    } finally {
      global.setInterval = originalSetInterval;
    }
  });

  it('kasus 3: proteksi reentrant, runOnce bersamaan hanya memindai satu kali', async () => {
    const { prisma } = makePrisma();
    let releaseScan: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      releaseScan = resolve;
    });
    let scanCount = 0;
    mockScan.mockImplementation(async () => {
      scanCount += 1;
      await gate;
      return { candidates: ['m-1'], purged: [], skipped: [] };
    });
    const scheduler = createErasurePurgeScheduler({ prisma, log: () => undefined });

    const first = scheduler.runOnce();
    const second = scheduler.runOnce();
    releaseScan();
    const [summaryFirst, summarySecond] = await Promise.all([first, second]);

    expect(scanCount).toBe(1);
    expect(summaryFirst.candidates).toEqual(['m-1']);
    expect(summarySecond).toEqual(RINGKASAN_KOSONG);
    scheduler.stop();
  });

  it('kasus 4: error tick ditelan, scheduler tetap hidup dan tick berikutnya tetap dicoba', async () => {
    vi.useFakeTimers();
    mockScan.mockRejectedValue(new Error('db down'));
    const { prisma } = makePrisma();
    const logs: string[] = [];
    const scheduler = createErasurePurgeScheduler({
      prisma,
      log: (...args) => logs.push(args.join(' ')),
    });

    await vi.advanceTimersByTimeAsync(DEFAULT_INTERVAL_MS);
    expect(scheduler.isRunning()).toBe(true);
    expect(logs.some((line) => line.includes('db down'))).toBe(true);

    mockScan.mockResolvedValue(RINGKASAN_KOSONG);
    await vi.advanceTimersByTimeAsync(DEFAULT_INTERVAL_MS);
    expect(scheduler.isRunning()).toBe(true);
    expect(mockScan).toHaveBeenCalledTimes(2);

    scheduler.stop();
  });

  it('kasus 5: stop() membersihkan timer dan isRunning menjadi false', async () => {
    vi.useFakeTimers();
    mockScan.mockResolvedValue(RINGKASAN_KOSONG);
    const { prisma } = makePrisma();
    const scheduler = createErasurePurgeScheduler({ prisma, log: () => undefined });
    expect(scheduler.isRunning()).toBe(true);

    scheduler.stop();
    expect(scheduler.isRunning()).toBe(false);

    await vi.advanceTimersByTimeAsync(DEFAULT_INTERVAL_MS * 2);
    expect(mockScan).not.toHaveBeenCalled();
  });

  it('kasus 6: listMemberIds memetakan prisma.familyMember.findMany ke array id', async () => {
    const { prisma, env } = makePrisma({
      members: [makeMember('m-b'), makeMember('m-a')],
    });
    const deps = buildDefaultErasurePurgeSchedulerDeps(prisma);

    const ids = await deps.listMemberIds();

    expect(ids).toEqual(['m-b', 'm-a']);
    expect(env.familyMemberFindManyCalls).toHaveLength(1);
  });

  it('kasus 7: listEvents memfilter tipe replay erasure per memberId dari prisma.event.findMany', async () => {
    const { prisma, env } = makePrisma({
      events: [
        requestedRow('m-1'),
        completedRow('m-1'),
        requestedRow('m-2'),
        { type: 'member.created', payloadJson: JSON.stringify({ memberId: 'm-1' }) },
      ],
    });
    const deps = buildDefaultErasurePurgeSchedulerDeps(prisma);

    const rows = await deps.listEvents('m-1');

    expect(rows.map((r) => r.type)).toEqual(['erasure.requested', 'erasure.completed']);
    expect(env.eventFindManyCalls).toHaveLength(1);
    expect(env.eventFindManyCalls[0].types).toEqual([
      'erasure.requested',
      'erasure.completed',
      'erasure.cancelled',
    ]);
    expect(env.eventFindManyCalls[0].contains).toBe('"memberId":"m-1"');
  });

  it('kasus 8: executePurge mendelegasikan executeErasurePurge dan updateMember hanya mengirim field PII terdaftar', async () => {
    const { prisma, env } = makePrisma({
      members: [makeMember('m-1')],
    });
    const deps = buildDefaultErasurePurgeSchedulerDeps(prisma);

    await deps.executePurge('m-1');

    expect(mockExec).toHaveBeenCalledTimes(1);
    expect(mockExec.mock.calls[0][0]).toBe('m-1');
    const executeDeps = mockExec.mock.calls[0][1];

    await executeDeps.updateMember('m-1', {
      id: 'm-1',
      fullName: 'harus tidak ikut',
      email: null,
      phone: null,
      photoUrl: null,
      currentLocation: null,
      notes: null,
      extraField: 'harus tidak ikut',
    } as never);

    expect(env.memberUpdateCalls).toHaveLength(1);
    expect(env.memberUpdateCalls[0].where).toEqual({ id: 'm-1' });
    expect(Object.keys(env.memberUpdateCalls[0].data).sort()).toEqual([
      'currentLocation',
      'email',
      'notes',
      'phone',
      'photoUrl',
    ]);
    expect(env.memberUpdateCalls[0].data).toEqual({
      email: null,
      phone: null,
      photoUrl: null,
      currentLocation: null,
      notes: null,
    });

    await executeDeps.appendEvent({ type: 'erasure.purged', payloadJson: '{}' });
    expect(env.eventCreateCalls.map((c) => c.type)).toEqual(['erasure.purged']);

    const rows = await executeDeps.listEvents('m-1');
    expect(rows).toHaveLength(0);
  });

  it('kasus 9: runOnce mengembalikan ringkasan dari scanErasurePurges', async () => {
    const ringkasan = { candidates: ['m-1'], purged: [], skipped: ['m-2'] };
    mockScan.mockResolvedValue(ringkasan);
    const { prisma } = makePrisma();
    const deps = buildDefaultErasurePurgeSchedulerDeps(prisma);
    const scheduler = createErasurePurgeScheduler({
      prisma,
      deps: { ...deps, nowIso: () => NOW_DUE },
      log: () => undefined,
    });

    const summary = await scheduler.runOnce();

    expect(mockScan).toHaveBeenCalledTimes(1);
    expect(summary).toEqual(ringkasan);
    scheduler.stop();
  });
});
