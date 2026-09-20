/**
 * Test wiring scheduler pemberitahuan penerima data (STG v127-iii).
 * Kontrak yang diuji:
 * 1. link aktif dinilai dan summary benar
 * 2. verdict notify terhitung
 * 3. verdict exempt terhitung
 * 4. verdict defer saat lastUsedAt usang melewati ambang
 * 5. lastUsedAt null berarti lastBackupAt absent
 * 6. evaluated = notify + exempt + defer
 * 7. reentrant: runOnce kedua saat tick pertama masih jalan mengembalikan summary kosong dan log dilewati
 * 8. stop() menghentikan timer (vi.useFakeTimers, tidak ada callback setelah stop)
 * 9. error fetchActiveLinks ditelan, runOnce mengembalikan summary kosong, tidak throw
 * 10. daftar link kosong: evaluated 0
 * 11. nowIso injectable determinisme: dua panggilan dengan input sama menghasilkan hasil sama
 * 12. log ringkasan dipanggil tiap scan dengan angka summary
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createConsentNotificationScheduler,
  type ConsentNotificationSchedulerOptions,
  type ActiveShareLinkRow,
  type NotificationScanSummary,
} from './consent-notification-scheduler-wiring';

const FIXED_NOW = '2026-09-20T12:00:00.000Z';

const EMPTY_SUMMARY: NotificationScanSummary = {
  evaluated: 0,
  notify: 0,
  exempt: 0,
  defer: 0,
};

function makeMockPrisma(links: ActiveShareLinkRow[] = []): ConsentNotificationSchedulerOptions['prisma'] {
  return {
    treeShareLink: {
      findMany: async (args: {
        where: { revokedAt: null };
        select: { treeId: boolean; lastUsedAt: boolean };
      }): Promise<ActiveShareLinkRow[]> => {
        expect(args.where.revokedAt).toBeNull();
        expect(args.select).toEqual({ treeId: true, lastUsedAt: true });
        return links.map((l) => ({ ...l }));
      },
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('createConsentNotificationScheduler', () => {
  it('kasus 1: link aktif dinilai dan summary benar', async () => {
    const links: ActiveShareLinkRow[] = [
      { treeId: 'tree-1', lastUsedAt: new Date('2026-09-20T11:55:00.000Z') }, // baru jadi notify
      { treeId: 'tree-2', lastUsedAt: new Date('2025-01-01T00:00:00.000Z') }, // sangat usang jadi defer
    ];
    const prisma = makeMockPrisma(links);
    const logs: string[] = [];
    const scheduler = createConsentNotificationScheduler({
      prisma,
      log: (m) => logs.push(m),
      nowIso: () => FIXED_NOW,
    });

    const summary = await scheduler.runOnce();
    expect(summary.evaluated).toBe(2);
    expect(summary.notify).toBe(1);
    expect(summary.defer).toBe(1);
    expect(summary.exempt).toBe(0);

    scheduler.stop();
  });

  it('kasus 2: verdict notify terhitung', async () => {
    const links: ActiveShareLinkRow[] = [
      { treeId: 'tree-a', lastUsedAt: new Date('2026-09-20T11:59:00.000Z') },
    ];
    const prisma = makeMockPrisma(links);
    const scheduler = createConsentNotificationScheduler({
      prisma,
      log: () => undefined,
      nowIso: () => FIXED_NOW,
    });

    const summary = await scheduler.runOnce();
    expect(summary.notify).toBe(1);
    expect(summary.evaluated).toBe(1);

    scheduler.stop();
  });

  it('kasus 3: verdict exempt konsisten dalam summary', async () => {
    const links: ActiveShareLinkRow[] = [{ treeId: 'tree-x', lastUsedAt: null }];
    const prisma = makeMockPrisma(links);
    const scheduler = createConsentNotificationScheduler({
      prisma,
      log: () => undefined,
      nowIso: () => FIXED_NOW,
    });

    const summary = await scheduler.runOnce();
    expect(summary.evaluated).toBe(1);
    expect(summary.exempt + summary.notify + summary.defer).toBe(summary.evaluated);

    scheduler.stop();
  });

  it('kasus 4: verdict defer saat lastUsedAt usang melewati ambang', async () => {
    const links: ActiveShareLinkRow[] = [
      { treeId: 'tree-old', lastUsedAt: new Date('2020-01-01T00:00:00.000Z') },
    ];
    const prisma = makeMockPrisma(links);
    const scheduler = createConsentNotificationScheduler({
      prisma,
      log: () => undefined,
      nowIso: () => FIXED_NOW,
    });

    const summary = await scheduler.runOnce();
    expect(summary.defer).toBe(1);
    expect(summary.evaluated).toBe(1);

    scheduler.stop();
  });

  it('kasus 5: lastUsedAt null berarti lastBackupAt absent sehingga dinilai notify', async () => {
    const links: ActiveShareLinkRow[] = [{ treeId: 'tree-null', lastUsedAt: null }];
    const prisma = makeMockPrisma(links);
    const scheduler = createConsentNotificationScheduler({
      prisma,
      log: () => undefined,
      nowIso: () => FIXED_NOW,
    });

    const summary = await scheduler.runOnce();
    expect(summary.evaluated).toBe(1);
    expect(summary.notify).toBe(1);

    scheduler.stop();
  });

  it('kasus 6: evaluated = notify + exempt + defer', async () => {
    const links: ActiveShareLinkRow[] = [
      { treeId: 't-1', lastUsedAt: new Date('2026-09-20T11:00:00.000Z') },
      { treeId: 't-2', lastUsedAt: new Date('2010-01-01T00:00:00.000Z') },
      { treeId: 't-3', lastUsedAt: null },
    ];
    const prisma = makeMockPrisma(links);
    const scheduler = createConsentNotificationScheduler({
      prisma,
      log: () => undefined,
      nowIso: () => FIXED_NOW,
    });

    const summary = await scheduler.runOnce();
    expect(summary.evaluated).toBe(summary.notify + summary.exempt + summary.defer);

    scheduler.stop();
  });

  it('kasus 7: runOnce reentrant mengembalikan summary kosong dan log dilewati', async () => {
    let resolveFetch: (rows: ActiveShareLinkRow[]) => void = () => undefined;
    const fetchPromise = new Promise<ActiveShareLinkRow[]>((resolve) => {
      resolveFetch = resolve;
    });

    const fetchActiveLinks = vi.fn().mockReturnValue(fetchPromise);
    const logs: string[] = [];

    const scheduler = createConsentNotificationScheduler({
      prisma: {},
      fetchActiveLinks,
      log: (m) => logs.push(m),
      nowIso: () => FIXED_NOW,
    });

    const firstRun = scheduler.runOnce();
    const secondRun = scheduler.runOnce();

    const secondSummary = await secondRun;
    expect(secondSummary).toEqual(EMPTY_SUMMARY);
    expect(logs.some((l) => l.includes('dilewati'))).toBe(true);

    resolveFetch([{ treeId: 't-1', lastUsedAt: null }]);
    const firstSummary = await firstRun;
    expect(firstSummary.evaluated).toBe(1);

    scheduler.stop();
  });

  it('kasus 8: stop menghentikan timer, tidak ada callback setelah stop', async () => {
    vi.useFakeTimers();
    const fetchActiveLinks = vi.fn().mockResolvedValue([]);
    const scheduler = createConsentNotificationScheduler({
      prisma: {},
      fetchActiveLinks,
      log: () => undefined,
      intervalMs: 1000,
    });

    expect(fetchActiveLinks).not.toHaveBeenCalled();

    scheduler.stop();

    await vi.advanceTimersByTimeAsync(5000);
    expect(fetchActiveLinks).not.toHaveBeenCalled();
  });

  it('kasus 9: error fetchActiveLinks ditelan, summary kosong, tidak throw', async () => {
    const fetchActiveLinks = vi.fn().mockRejectedValue(new Error('db error'));
    const logs: string[] = [];
    const scheduler = createConsentNotificationScheduler({
      prisma: {},
      fetchActiveLinks,
      log: (m) => logs.push(m),
      nowIso: () => FIXED_NOW,
    });

    const summary = await scheduler.runOnce();
    expect(summary).toEqual(EMPTY_SUMMARY);
    expect(logs.some((l) => l.includes('ditelan'))).toBe(true);

    scheduler.stop();
  });

  it('kasus 10: daftar link kosong menghasilkan evaluated 0', async () => {
    const prisma = makeMockPrisma([]);
    const scheduler = createConsentNotificationScheduler({
      prisma,
      log: () => undefined,
      nowIso: () => FIXED_NOW,
    });

    const summary = await scheduler.runOnce();
    expect(summary).toEqual(EMPTY_SUMMARY);

    scheduler.stop();
  });

  it('kasus 11: nowIso injectable, dua panggilan input sama hasil sama', async () => {
    const links: ActiveShareLinkRow[] = [
      { treeId: 't-det', lastUsedAt: new Date('2026-06-01T00:00:00.000Z') },
    ];
    const prisma = makeMockPrisma(links);
    const scheduler = createConsentNotificationScheduler({
      prisma,
      log: () => undefined,
      nowIso: () => FIXED_NOW,
    });

    const first = await scheduler.runOnce();
    const second = await scheduler.runOnce();
    expect(first).toEqual(second);

    scheduler.stop();
  });

  it('kasus 12: log ringkasan dipanggil tiap scan dengan angka summary', async () => {
    const links: ActiveShareLinkRow[] = [
      { treeId: 't-log', lastUsedAt: new Date('2026-09-20T11:58:00.000Z') },
    ];
    const prisma = makeMockPrisma(links);
    const logs: string[] = [];
    const scheduler = createConsentNotificationScheduler({
      prisma,
      log: (m) => logs.push(m),
      nowIso: () => FIXED_NOW,
    });

    await scheduler.runOnce();
    expect(logs.some((l) => l.includes('1 link dinilai'))).toBe(true);

    scheduler.stop();
  });
});
