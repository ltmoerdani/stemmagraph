import { describe, expect, it } from 'vitest';
import {
  buildErasureCancelEvent,
  buildErasureRequestEvent,
  ERASURE_DUE_DAYS,
  type ErasureRouteRow,
} from './erasure-routes';
import {
  decideErasureCancel,
  parseErasureAction,
  planErasureRequest,
  summarizeErasure,
} from './erasure-endpoints';

const T0 = '2026-09-17T00:00:00.000Z';
const T1 = '2026-09-20T00:00:00.000Z';
const DUE = new Date(
  new Date(T0).getTime() + ERASURE_DUE_DAYS * 24 * 60 * 60 * 1000,
).toISOString();

function toRouteRow(
  event: { type: ErasureRouteRow['type']; payloadJson: string },
  createdAtIso: string,
): ErasureRouteRow {
  return {
    type: event.type,
    payloadJson: event.payloadJson,
    createdAt: new Date(createdAtIso),
  };
}

function requestRow(memberId = 'm-1'): ErasureRouteRow {
  return toRouteRow(buildErasureRequestEvent(memberId, T0), T0);
}

function cancelRow(memberId = 'm-1'): ErasureRouteRow {
  return toRouteRow(buildErasureCancelEvent(memberId, T1), T1);
}

function completedRow(): ErasureRouteRow {
  return {
    type: 'erasure.completed',
    payloadJson: JSON.stringify({ completedAt: T1 }),
    createdAt: new Date(T1),
  };
}

describe('parseErasureAction', () => {
  it('body { action: cancel } diterima', () => {
    expect(parseErasureAction({ action: 'cancel' })).toEqual({ action: 'cancel' });
  });

  it('bukan object menghasilkan null (null, string, angka, array, boolean)', () => {
    expect(parseErasureAction(null)).toBeNull();
    expect(parseErasureAction('cancel')).toBeNull();
    expect(parseErasureAction(42)).toBeNull();
    expect(parseErasureAction(['cancel'])).toBeNull();
    expect(parseErasureAction(true)).toBeNull();
  });

  it('object tanpa action menghasilkan null', () => {
    expect(parseErasureAction({})).toBeNull();
    expect(parseErasureAction({ member: 'm-1' })).toBeNull();
  });

  it('action selain cancel menghasilkan null', () => {
    expect(parseErasureAction({ action: 'request' })).toBeNull();
    expect(parseErasureAction({ action: 'CANCEL' })).toBeNull();
  });
});

describe('planErasureRequest', () => {
  it('event bertipe erasure.requested dengan payload memberId', () => {
    const { event } = planErasureRequest('m-7', T0);
    expect(event.type).toBe('erasure.requested');
    const payload = JSON.parse(event.payloadJson) as Record<string, unknown>;
    expect(payload.memberId).toBe('m-7');
  });

  it('createdAt berupa Date sesuai nowIso', () => {
    const { event } = planErasureRequest('m-7', T0);
    expect(event.createdAt).toBeInstanceOf(Date);
    expect(event.createdAt).toEqual(new Date(T0));
  });

  it('dueAt pada payload tepat 30 hari sesuai ERASURE_DUE_DAYS', () => {
    expect(ERASURE_DUE_DAYS).toBe(30);
    const { event } = planErasureRequest('m-7', T0);
    const payload = JSON.parse(event.payloadJson) as Record<string, unknown>;
    expect(payload.dueAt).toBe(DUE);
  });
});

describe('summarizeErasure', () => {
  it('rows kosong: state none dan dueAt null', () => {
    expect(summarizeErasure([])).toEqual({ state: 'none', dueAt: null });
  });

  it('request aktif: state requested dengan dueAt ISO', () => {
    const summary = summarizeErasure([requestRow()]);
    expect(summary.state).toBe('requested');
    expect(summary.dueAt).toBe(DUE);
  });

  it('sudah completed: state completed', () => {
    const summary = summarizeErasure([requestRow(), completedRow()]);
    expect(summary.state).toBe('completed');
  });

  it('sudah cancelled: state cancelled', () => {
    const summary = summarizeErasure([requestRow(), cancelRow()]);
    expect(summary.state).toBe('cancelled');
  });
});

describe('decideErasureCancel', () => {
  it('nihil event: kind not-found dengan 404 ERASURE_NOT_FOUND', () => {
    const decision = decideErasureCancel([], T1);
    expect(decision.kind).toBe('not-found');
    if (decision.kind === 'not-found') {
      expect(decision.response.status).toBe(404);
      expect(decision.response.code).toBe('ERASURE_NOT_FOUND');
    }
  });

  it('request aktif: kind ok dengan event erasure.cancelled', () => {
    const decision = decideErasureCancel([requestRow()], T1);
    expect(decision.kind).toBe('ok');
    if (decision.kind === 'ok') {
      expect(decision.event.type).toBe('erasure.cancelled');
      const payload = JSON.parse(decision.event.payloadJson) as Record<string, unknown>;
      expect(payload.memberId).toBe('m-1');
      expect(payload.cancelledAt).toBe(T1);
    }
  });

  it('sudah completed: kind conflict 409 ERASURE_CONFLICT', () => {
    const decision = decideErasureCancel([requestRow(), completedRow()], T1);
    expect(decision.kind).toBe('conflict');
    if (decision.kind === 'conflict') {
      expect(decision.response.status).toBe(409);
      expect(decision.response.code).toBe('ERASURE_CONFLICT');
    }
  });

  it('sudah cancelled: kind conflict 409 ERASURE_CONFLICT', () => {
    const decision = decideErasureCancel([requestRow(), cancelRow()], T1);
    expect(decision.kind).toBe('conflict');
    if (decision.kind === 'conflict') {
      expect(decision.response.status).toBe(409);
      expect(decision.response.code).toBe('ERASURE_CONFLICT');
    }
  });

  it('payload korup: kind conflict lewat mapErasureError dengan status 409', () => {
    const corrupt: ErasureRouteRow = {
      type: 'erasure.requested',
      payloadJson: 'bukan-json',
      createdAt: new Date(T0),
    };
    const decision = decideErasureCancel([corrupt], T1);
    expect(decision.kind).toBe('conflict');
    if (decision.kind === 'conflict') {
      expect(decision.response.status).toBe(409);
      expect(decision.response.code).toBe('ERASURE_CONFLICT');
      expect(decision.response.message.length).toBeGreaterThan(0);
    }
  });
});
