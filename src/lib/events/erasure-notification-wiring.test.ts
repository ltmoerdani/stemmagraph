import { describe, expect, it } from 'vitest';
import {
  erasureNotifyActionFromEvent,
  projectErasureNotifications,
  type ErasureNotificationSink,
} from './erasure-notification-wiring';

/**
 * Test wiring notifikasi erasure GOAL v421 SLICE 1. Tanpa server dan
 * tanpa database: proyeksi dijalankan sebagai fungsi murni dan sink
 * hanya berupa kontrak tipe, persis pembagian tugas yang diminta.
 */

const OWNERS = [{ id: 'owner-1' }, { id: 'owner-2' }, { id: 'owner-3' }];

const BASE_INPUT = {
  memberId: 'm1',
  action: 'requested' as const,
  eventType: 'erasure.requested',
  evidence: 'req_1',
  actorUserId: 'owner-1',
  treeOwners: OWNERS,
};

describe('projectErasureNotifications (proyeksi pure)', () => {
  it('happy path: satu draft per owner, aktor dikecualikan', () => {
    const drafts = projectErasureNotifications(BASE_INPUT);
    expect(drafts).toHaveLength(2);
    expect(drafts.map((d) => d.userId)).toEqual(['owner-2', 'owner-3']);
    expect(drafts.every((d) => d.userId !== BASE_INPUT.actorUserId)).toBe(true);
    for (const draft of drafts) {
      expect(draft.type).toBe('ERASURE_OWNER_NOTICE');
    }
  });

  it('payloadJson berisi memberId, action, eventType, dan evidence', () => {
    const [draft] = projectErasureNotifications(BASE_INPUT);
    expect(draft).toBeDefined();
    const payload = JSON.parse(draft.payloadJson) as Record<string, unknown>;
    expect(payload).toEqual({
      memberId: 'm1',
      action: 'requested',
      eventType: 'erasure.requested',
      evidence: 'req_1',
    });
  });

  it('semua owner menerima payloadJson yang identik', () => {
    const drafts = projectErasureNotifications(BASE_INPUT);
    const payloadJsons = new Set(drafts.map((d) => d.payloadJson));
    expect(payloadJsons.size).toBe(1);
  });

  it('audiens kosong menghasilkan daftar draft kosong tanpa lempar', () => {
    const drafts = projectErasureNotifications({ ...BASE_INPUT, treeOwners: [] });
    expect(drafts).toEqual([]);
  });

  it('audiens yang hanya berisi aktor juga menghasilkan kosong', () => {
    const drafts = projectErasureNotifications({
      ...BASE_INPUT,
      treeOwners: [{ id: 'owner-1' }],
    });
    expect(drafts).toEqual([]);
  });
});

describe('erasureNotifyActionFromEvent (pemetaan eventType)', () => {
  it('erasure.requested dipetakan ke requested', () => {
    expect(erasureNotifyActionFromEvent('erasure.requested')).toBe('requested');
  });

  it('erasure.cancelled dipetakan ke cancelled', () => {
    expect(erasureNotifyActionFromEvent('erasure.cancelled')).toBe('cancelled');
  });

  it('tipe lain jatuh ke purged, termasuk erasure.completed dan erasure.purged', () => {
    expect(erasureNotifyActionFromEvent('erasure.completed')).toBe('purged');
    expect(erasureNotifyActionFromEvent('erasure.purged')).toBe('purged');
    expect(erasureNotifyActionFromEvent('tipe.tidak.dikenal')).toBe('purged');
  });

  it('hasil pemetaan purged terbawa utuh ke payload draft', () => {
    const drafts = projectErasureNotifications({
      ...BASE_INPUT,
      action: 'purged',
      eventType: 'erasure.purged',
      evidence: 'purge_1',
    });
    const payload = JSON.parse(drafts[0].payloadJson) as Record<string, unknown>;
    expect(payload.action).toBe('purged');
    expect(payload.eventType).toBe('erasure.purged');
    expect(payload.evidence).toBe('purge_1');
  });
});

describe('ErasureNotificationSink (kontrak sink minimal)', () => {
  it('draft hasil proyeksi kompatibel dengan bentuk createNotifications', async () => {
    const drafts = projectErasureNotifications(BASE_INPUT);
    const received: string[] = [];
    const sink: ErasureNotificationSink = {
      createNotifications: async (batch) => {
        received.push(...batch.map((d) => d.userId));
        return batch.length;
      },
    };
    await sink.createNotifications(drafts);
    expect(received).toEqual(['owner-2', 'owner-3']);
  });
});
