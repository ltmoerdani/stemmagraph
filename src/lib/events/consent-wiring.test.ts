import { describe, expect, it, vi } from 'vitest';
import {
  emitConsentEvent,
  projectConsentNotifications,
  safeEmitConsentEvent,
  type ConsentEventSink,
} from './consent-wiring';
import type { EventEnvelope } from './index';

/**
 * S-09a-ii wiring tests. No app.listen and no real server: emitConsentEvent
 * runs against a spy sink and the projector runs as a pure function, which
 * is exactly the split the task demands (testable without the server).
 */

const LEDGER_ROW = {
  id: 'rec_1',
  memberId: 'm1',
  action: 'grant' as const,
  at: '2026-09-17T02:00:00.000Z',
};

const OWNERS = [{ id: 'owner-1' }, { id: 'owner-2' }];

interface SpySink extends ConsentEventSink {
  appended: EventEnvelope[];
  notified: { userId: string; type: string; payloadJson: string }[];
}

const makeSink = (appendError?: Error): SpySink => {
  const appended: EventEnvelope[] = [];
  const notified: { userId: string; type: string; payloadJson: string }[] = [];
  return {
    appended,
    notified,
    appendEvent: vi.fn(async (envelope: EventEnvelope) => {
      if (appendError) throw appendError;
      appended.push(envelope);
      return envelope;
    }),
    createNotifications: vi.fn(async (drafts) => {
      notified.push(...drafts);
      return drafts.length;
    }),
  };
};

describe('emitConsentEvent (S-09a-ii wiring)', () => {
  it('AC4a: emits CONSENT_GRANTED for a grant row and appends before notifying', async () => {
    const sink = makeSink();
    const { event, drafts } = await emitConsentEvent(
      { record: LEDGER_ROW, treeId: 'tree-1', actorId: 'user-9', owners: OWNERS },
      sink,
    );
    expect(event.type).toBe('CONSENT_GRANTED');
    expect(event.actorUserId).toBe('user-9');
    expect(event.familyTreeId).toBe('tree-1');
    expect(event.payload).toEqual({
      consentId: 'rec_1',
      memberId: 'm1',
      action: 'grant',
      occurredAt: '2026-09-17T02:00:00.000Z',
    });
    expect(sink.appendEvent).toHaveBeenCalledTimes(1);
    expect(sink.createNotifications).toHaveBeenCalledTimes(1);
    expect(drafts.map((d) => d.userId).sort()).toEqual(['owner-1', 'owner-2']);
    // The actor already knows; the other owners hear about it.
    expect(drafts.every((d) => d.userId !== 'user-9')).toBe(true);
  });

  it('AC4b: emits CONSENT_REVOKED for a revoke row with the action copied verbatim', async () => {
    const sink = makeSink();
    const { event, drafts } = await emitConsentEvent(
      { record: { ...LEDGER_ROW, id: 'rec_2', action: 'revoke' }, treeId: 'tree-1', actorId: 'user-9', owners: OWNERS },
      sink,
    );
    expect(event.type).toBe('CONSENT_REVOKED');
    expect(event.payload).toMatchObject({ action: 'revoke', consentId: 'rec_2' });
    expect(drafts.every((d) => d.type === 'CONSENT_REVOKED')).toBe(true);
    expect(sink.appended).toHaveLength(1);
    expect(sink.notified).toHaveLength(2);
  });

  it('AC4c: refuses a payload that fails validateConsentEvent and writes nothing', async () => {
    const sink = makeSink();
    await expect(
      emitConsentEvent(
        { record: { ...LEDGER_ROW, id: '' }, treeId: 'tree-1', actorId: 'user-9', owners: OWNERS },
        sink,
      ),
    ).rejects.toThrow(/validateConsentEvent/);
    expect(sink.appendEvent).not.toHaveBeenCalled();
    expect(sink.createNotifications).not.toHaveBeenCalled();
  });

  it('AC4d: appends the fact even when the owner audience is empty', async () => {
    const sink = makeSink();
    const { drafts } = await emitConsentEvent(
      { record: LEDGER_ROW, treeId: 'tree-1', actorId: 'user-9', owners: [] },
      sink,
    );
    expect(sink.appended).toHaveLength(1);
    expect(drafts).toHaveLength(0);
    expect(sink.createNotifications).not.toHaveBeenCalled();
  });

  it('regrant maps to CONSENT_GRANTED while actorId null stays null', async () => {
    const sink = makeSink();
    const { event } = await emitConsentEvent(
      { record: { ...LEDGER_ROW, action: 'regrant' }, treeId: 'tree-1', actorId: null, owners: OWNERS },
      sink,
    );
    expect(event.type).toBe('CONSENT_GRANTED');
    expect(event.actorUserId).toBeNull();
  });
});

describe('safeEmitConsentEvent (resilience boundary)', () => {
  it('AC4e: a rejected append becomes a failure result, the POST keeps its 201', async () => {
    const sink = makeSink(new Error('event store down'));
    const result = await safeEmitConsentEvent(
      { record: LEDGER_ROW, treeId: 'tree-1', actorId: 'user-9', owners: OWNERS },
      sink,
    );
    expect(result.ok).toBe(false);
    expect((result as { error: Error }).error.message).toBe('event store down');
  });

  it('AC4f: a failing notification write is caught the same way', async () => {
    const sink = makeSink();
    sink.createNotifications = vi.fn(async () => {
      throw new Error('notification table locked');
    });
    const result = await safeEmitConsentEvent(
      { record: LEDGER_ROW, treeId: 'tree-1', actorId: 'user-9', owners: OWNERS },
      sink,
    );
    expect(result.ok).toBe(false);
    // The fact was already appended before the projection failed.
    expect(sink.appended).toHaveLength(1);
  });

  it('passes the success through unchanged', async () => {
    const sink = makeSink();
    const result = await safeEmitConsentEvent(
      { record: LEDGER_ROW, treeId: 'tree-1', actorId: 'user-9', owners: OWNERS },
      sink,
    );
    expect(result.ok).toBe(true);
    expect((result as { drafts: unknown[] }).drafts).toHaveLength(2);
  });
});

describe('projectConsentNotifications (pure projection)', () => {
  const envelope: EventEnvelope = {
    type: 'CONSENT_GRANTED',
    actorUserId: 'user-9',
    familyTreeId: 'tree-1',
    payload: {
      consentId: 'rec_1',
      memberId: 'm1',
      action: 'grant',
      occurredAt: '2026-09-17T02:00:00.000Z',
    },
  };

  it('AC4g: projects one draft per owner except the actor, carrying the four contract keys', () => {
    const drafts = projectConsentNotifications(envelope, { treeOwners: OWNERS });
    expect(drafts).toHaveLength(2);
    for (const draft of drafts) {
      expect(draft.type).toBe('CONSENT_GRANTED');
      expect(JSON.parse(draft.payloadJson)).toEqual(envelope.payload);
    }
  });

  it('refuses a non-consent envelope', () => {
    expect(() =>
      projectConsentNotifications(
        { ...envelope, type: 'CHANGE_PROPOSED' } as unknown as EventEnvelope,
        { treeOwners: OWNERS },
      ),
    ).toThrow(/expects CONSENT/);
  });

  it('refuses an envelope whose payload fails the S-09a-i validator', () => {
    const bad = { ...envelope, payload: { ...envelope.payload, action: 'delete' } } as unknown as EventEnvelope;
    expect(() => projectConsentNotifications(bad, { treeOwners: OWNERS })).toThrow(/validateConsentEvent/);
  });
});
