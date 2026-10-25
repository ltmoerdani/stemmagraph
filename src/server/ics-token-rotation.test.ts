/**
 * Test dedikasi v400 AC5: pass rotasi otomatis token ICS
 * (runIcsTokenRotationPass di server/digest.ts, pola scheduler digest
 * v387). Prisma di-mock lewat vi.hoisted, pola calendar-ics-api.test.
 * Cakupan: tree lewat umur 90 hari dirotasi (prev + timestamp tersimpan
 * seperti route rotate), tree muda diabaikan, fallback createdAt bila
 * rotatedAt null, pass idempoten, kegagalan satu tree terisolasi.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  familyTree: { findMany: vi.fn(), update: vi.fn() },
}));

vi.mock('../../server/db', () => ({ prisma: prismaMock }));

import { runIcsTokenRotationPass } from '../../server/digest';

const DAY_MS = 86_400_000;
const NOW = new Date('2026-10-26T00:00:00.000Z');

interface TreeRow {
  id: string;
  icsFeedToken: string;
  icsFeedRotatedAt: Date | null;
  createdAt: Date;
}

function row(id: string, umurHari: number, denganRotatedAt: boolean): TreeRow {
  return {
    id,
    icsFeedToken: `tok-${id}`,
    icsFeedRotatedAt: denganRotatedAt ? new Date(NOW.getTime() - umurHari * DAY_MS) : null,
    createdAt: new Date(NOW.getTime() - (umurHari + 5) * DAY_MS),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.familyTree.update.mockResolvedValue({ id: 'x' });
});

describe('runIcsTokenRotationPass (v400 AC4)', () => {
  it('query menyaring umur di WHERE: cutoff = now minus 90 hari, hanya tree berfeed aktif', async () => {
    prismaMock.familyTree.findMany.mockResolvedValue([]);
    const summary = await runIcsTokenRotationPass(NOW);
    expect(summary).toEqual({ rotated: 0, skipped: 0, failed: 0 });
    const args = prismaMock.familyTree.findMany.mock.calls[0]?.[0] as {
      where: { icsFeedToken: { not: null }; OR: { icsFeedRotatedAt?: { lt: Date }; createdAt?: { lt: Date } }[] };
    };
    expect(args.where.icsFeedToken).toEqual({ not: null });
    const cutoffMs = NOW.getTime() - 90 * DAY_MS;
    expect(args.where.OR[0]?.icsFeedRotatedAt?.lt.getTime()).toBe(cutoffMs);
    expect(args.where.OR[1]?.createdAt?.lt.getTime()).toBe(cutoffMs);
    expect(prismaMock.familyTree.update).not.toHaveBeenCalled();
  });

  it('tree lewat umur 91 hari dirotasi: prev + timestamp tersimpan, tree muda diabaikan', async () => {
    const tua = row('tree-tua', 91, true);
    const muda = row('tree-muda', 10, true);
    prismaMock.familyTree.findMany.mockResolvedValue([tua, muda]);
    const summary = await runIcsTokenRotationPass(NOW);
    expect(summary).toEqual({ rotated: 1, skipped: 1, failed: 0 });
    expect(prismaMock.familyTree.update).toHaveBeenCalledTimes(1);
    const args = prismaMock.familyTree.update.mock.calls[0]?.[0] as {
      where: { id: string };
      data: { icsFeedToken: string; icsFeedTokenPrev: string | null; icsFeedRotatedAt: Date };
    };
    expect(args.where.id).toBe('tree-tua');
    expect(args.data.icsFeedToken).not.toBe(tua.icsFeedToken);
    expect(args.data.icsFeedToken.length).toBeGreaterThan(20);
    expect(args.data.icsFeedTokenPrev).toBe(tua.icsFeedToken);
    expect(args.data.icsFeedRotatedAt.getTime()).toBe(NOW.getTime());
  });

  it('fallback createdAt bila icsFeedRotatedAt null: tua dari createdAt dirotasi, muda tidak', async () => {
    const tua = row('tree-lama', 91, false);
    const muda = row('tree-baru', 10, false);
    prismaMock.familyTree.findMany.mockResolvedValue([tua, muda]);
    const summary = await runIcsTokenRotationPass(NOW);
    expect(summary).toEqual({ rotated: 1, skipped: 1, failed: 0 });
    const args = prismaMock.familyTree.update.mock.calls[0]?.[0] as { where: { id: string } };
    expect(args.where.id).toBe('tree-lama');
  });

  it('idempoten: pass berulang pada now sama tidak merotasi ulang token yang baru dirotasi', async () => {
    const rows: TreeRow[] = [row('tree-tua', 91, true)];
    prismaMock.familyTree.findMany.mockResolvedValue(rows);
    prismaMock.familyTree.update.mockImplementation(async (args: { where: { id: string }; data: { icsFeedRotatedAt: Date } }) => {
      const target = rows.find((t) => t.id === args.where.id);
      if (target) target.icsFeedRotatedAt = args.data.icsFeedRotatedAt;
      return { id: args.where.id };
    });
    const pass1 = await runIcsTokenRotationPass(NOW);
    expect(pass1.rotated).toBe(1);
    const pass2 = await runIcsTokenRotationPass(NOW);
    expect(pass2).toEqual({ rotated: 0, skipped: 1, failed: 0 });
    expect(prismaMock.familyTree.update).toHaveBeenCalledTimes(1);
  });

  it('kegagalan satu tree tidak menghentikan pass (isolasi per baris)', async () => {
    const rusak = row('tree-rusak', 91, true);
    const sehat = row('tree-sehat', 95, true);
    prismaMock.familyTree.findMany.mockResolvedValue([rusak, sehat]);
    prismaMock.familyTree.update.mockImplementation(async (args: { where: { id: string } }) => {
      if (args.where.id === 'tree-rusak') throw new Error('db rusak');
      return { id: args.where.id };
    });
    const summary = await runIcsTokenRotationPass(NOW);
    expect(summary).toEqual({ rotated: 1, skipped: 0, failed: 1 });
  });
});
