import { describe, expect, it, vi } from 'vitest';
import { emitErasureOwnerNotifications } from './erasure-notify-wiring';
import type { ErasureNotificationPrismaClient } from './erasure-notify-wiring';

/**
 * Test wiring IO emisi notifikasi erasure (GOAL v421 SLICE 2).
 * Prisma struktural di-mock in-memory tanpa database nyata: fokus pada
 * fire-and-log, guard idempoten replay, dan pemetaan action purge.
 */

function buildMockPrisma() {
  const notifications: Array<{ userId: string; type: string; payloadJson: string }> = [];
  const members: Record<string, { treeId?: string } | null> = {
    m1: { treeId: 't1' },
  };
  const treeMembers: Array<{ user: { id: string; status: string } }> = [
    { user: { id: 'owner-1', status: 'active' } },
    { user: { id: 'owner-2', status: 'active' } },
    { user: { id: 'owner-3', status: 'nonactive' } },
  ];

  const prisma = {
    familyMember: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) =>
        members[where.id] ?? null),
    },
    treeMember: {
      findMany: vi.fn(async () => treeMembers),
    },
    notification: {
      findFirst: vi.fn(async ({ where }: { where: { userId: string; type: string; payloadJson: { contains: string } } }) =>
        notifications.find(
          (n) => n.userId === where.userId && n.type === where.type && n.payloadJson.includes(where.payloadJson.contains),
        ) ?? null),
      createMany: vi.fn(async ({ data }: { data: Array<{ userId: string; type: string; payloadJson: string }> }) => {
        notifications.push(...data);
        return { count: data.length };
      }),
    },
  } as unknown as ErasureNotificationPrismaClient & {
    notification: { findFirst: ReturnType<typeof vi.fn>; createMany: ReturnType<typeof vi.fn> };
  };

  return { prisma, notifications };
}

describe('emitErasureOwnerNotifications (GOAL v421 SLICE 2)', () => {
  it('AC1 happy path: owner aktif menerima draft, owner nonaktif dan aktor dikecualikan', async () => {
    const { prisma, notifications } = buildMockPrisma();
    await emitErasureOwnerNotifications({
      prisma,
      memberId: 'm1',
      eventType: 'erasure.requested',
      actorUserId: 'owner-1',
      evidence: 'ev-1',
    });
    expect(notifications).toHaveLength(1);
    expect(notifications[0].userId).toBe('owner-2');
    const payload = JSON.parse(notifications[0].payloadJson) as Record<string, unknown>;
    expect(payload).toMatchObject({
      memberId: 'm1',
      action: 'requested',
      eventType: 'erasure.requested',
      evidence: 'ev-1',
    });
  });

  it('AC2 idempoten: replay evidence sama tidak menggandakan baris (purge scheduler replay)', async () => {
    const { prisma, notifications } = buildMockPrisma();
    const input = {
      prisma,
      memberId: 'm1',
      eventType: 'erasure.purged' as const,
      actorUserId: '',
      evidence: 'purge-ev-1',
    };
    await emitErasureOwnerNotifications(input);
    await emitErasureOwnerNotifications(input);
    await emitErasureOwnerNotifications(input);
    expect(notifications).toHaveLength(2);
    expect(notifications.map((n) => n.userId).sort()).toEqual(['owner-1', 'owner-2']);
    for (const n of notifications) {
      const payload = JSON.parse(n.payloadJson) as Record<string, unknown>;
      expect(payload.action).toBe('purged');
    }
  });

  it('fire-and-log: kegagalan prisma ditelan, fungsi tidak melempar', async () => {
    const broken = {
      familyMember: {
        findUnique: async () => {
          throw new Error('db down');
        },
      },
    } as unknown as ErasureNotificationPrismaClient;
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(
      emitErasureOwnerNotifications({
        prisma: broken,
        memberId: 'm1',
        eventType: 'erasure.cancelled',
        actorUserId: 'owner-1',
        evidence: 'ev-x',
      }),
    ).resolves.toBeUndefined();
    errSpy.mockRestore();
  });

  it('member tanpa treeId atau nihil: emisi berhenti tanpa error', async () => {
    const { prisma, notifications } = buildMockPrisma();
    await emitErasureOwnerNotifications({
      prisma,
      memberId: 'm-tidak-ada',
      eventType: 'erasure.requested',
      actorUserId: 'owner-1',
      evidence: 'ev-2',
    });
    expect(notifications).toHaveLength(0);
  });
});
