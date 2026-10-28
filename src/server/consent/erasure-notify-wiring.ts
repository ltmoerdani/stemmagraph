/**
 * Helper emisi notifikasi erasure bersama untuk lapisan IO (GOAL v421, SLICE 2).
 * Mengikat modul pure src/lib/events/erasure-notification-wiring.ts ke prisma
 * struktural: resolve member untuk treeId, resolve owner aktif pohon (pola
 * activeTreeOwnerIds), proyeksi draft via projectErasureNotifications, lalu
 * createMany idempoten. Seluruh blok emisi fire-and-log: try/catch yang hanya
 * console.error, kegagalan tidak pernah melempar ke route atau appendEvent.
 * Prisma di-inject, tidak ada import server/index.ts. Bebas em dash.
 */

import {
  erasureNotifyActionFromEvent,
  projectErasureNotifications,
} from '../../lib/events/erasure-notification-wiring';

/** Bentuk prisma minimal untuk emisi notifikasi erasure. Struktural, di-inject. */
export interface ErasureNotificationPrismaClient {
  familyMember: {
    findUnique(args: {
      where: { id: string };
      select?: { treeId?: boolean };
    }): Promise<{ treeId?: string } | null>;
  };
  treeMember: {
    findMany(args: {
      where: { treeId: string; role: string };
      select: { user: { select: { id: boolean; status: boolean } } };
    }): Promise<Array<{ user: { id: string; status: string } }>>;
  };
  notification: {
    findFirst(args: {
      where: {
        userId: string;
        type: string;
        payloadJson: { contains: string };
      };
    }): Promise<unknown>;
    createMany(args: {
      data: Array<{ userId: string; type: string; payloadJson: string }>;
    }): Promise<unknown>;
  };
}

/** Parameter emisi: klien prisma plus fakta kejadian erasure yang baru dicatat. */
export interface EmitErasureOwnerNotificationsOptions {
  prisma: ErasureNotificationPrismaClient;
  /** Member subjek erasure, diambil dari payloadJson event. */
  memberId: string;
  /** Tipe event ledger asal, misalnya erasure.requested atau erasure.purged. */
  eventType: string;
  /** Akun perekam kejadian; ia tidak menerima notifikasi. Kosong berarti sistem. */
  actorUserId: string;
  /** Evidence idempoten: timestamp ISO saat event append sukses. */
  evidence: string;
}

/**
 * Emisi notifikasi owner fire-and-log setelah satu event erasure append sukses.
 * Urutan: familyMember.findUnique untuk treeId, treeMember.findMany role owner
 * aktif (pola activeTreeOwnerIds), proyeksi draft per owner non-aktor, guard
 * idempoten findFirst per owner dengan payloadJson contains evidence, lalu
 * createMany untuk draft yang belum ada. Seluruhnya dalam satu try/catch yang
 * hanya console.error sehingga kegagalan apa pun tidak menggagalkan pemanggil.
 */
export async function emitErasureOwnerNotifications(
  options: EmitErasureOwnerNotificationsOptions,
): Promise<void> {
  try {
    const { prisma, memberId, eventType, actorUserId, evidence } = options;
    if (!memberId) {
      return;
    }

    const member = await prisma.familyMember.findUnique({
      where: { id: memberId },
      select: { treeId: true },
    });
    if (member === null || !member.treeId) {
      return;
    }

    const ownerRows = await prisma.treeMember.findMany({
      where: { treeId: member.treeId, role: 'owner' },
      select: { user: { select: { id: true, status: true } } },
    });
    const treeOwners = ownerRows
      .map((row) => row.user)
      .filter((user) => user.status === 'active')
      .map((user) => ({ id: user.id }));

    const drafts = projectErasureNotifications({
      memberId,
      action: erasureNotifyActionFromEvent(eventType),
      eventType,
      evidence,
      actorUserId,
      treeOwners,
    });
    if (drafts.length === 0) {
      return;
    }

    const pending: Array<{ userId: string; type: string; payloadJson: string }> = [];
    for (const draft of drafts) {
      const existing = await prisma.notification.findFirst({
        where: {
          userId: draft.userId,
          type: 'ERASURE_OWNER_NOTICE',
          payloadJson: { contains: evidence },
        },
      });
      if (existing === null || existing === undefined) {
        pending.push({ userId: draft.userId, type: draft.type, payloadJson: draft.payloadJson });
      }
    }
    if (pending.length === 0) {
      return;
    }

    await prisma.notification.createMany({ data: pending });
  } catch (err) {
    console.error('[erasure-notify-wiring] emisi notifikasi erasure gagal (ditelan):', err);
  }
}

/**
 * Ekstrak memberId dari payloadJson baris event erasure. Row erasure memuat
 * payloadJson JSON berisi "memberId":"..."; JSON.parse gagal atau field kosong
 * jatuh ke fallback supaya emisi tetap aman dipanggil dari wiring mana pun.
 */
export function erasureMemberIdFromPayload(payloadJson: string, fallback: string): string {
  try {
    const parsed = JSON.parse(payloadJson) as { memberId?: unknown };
    if (typeof parsed.memberId === 'string' && parsed.memberId.length > 0) {
      return parsed.memberId;
    }
  } catch {
    // payloadJson bukan JSON valid: pakai fallback, emisi tetap fire-and-log.
  }
  return fallback;
}
