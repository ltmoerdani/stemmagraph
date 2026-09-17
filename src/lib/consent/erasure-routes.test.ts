import { describe, expect, it } from 'vitest';
import { erasureStateFromEvents, mapErasureError, type ErasureEventRow } from './erasure-wiring';
import {
  ERASURE_DUE_DAYS,
  buildErasureRequestEvent,
  buildErasureCancelEvent,
  erasureGetResponse,
  erasureWriteOutcome,
  type ErasureRouteRow,
} from './erasure-routes';

const T0 = '2026-09-17T00:00:00.000Z';
const DUE = '2026-10-17T00:00:00.000Z'; // T0 + 30 hari
const T1 = '2026-09-20T00:00:00.000Z';
const T2 = '2026-10-01T00:00:00.000Z';

function toRouteRow(event: ErasureEventRow, createdAt: string): ErasureRouteRow {
  return { type: event.type, payloadJson: event.payloadJson, createdAt: new Date(createdAt) };
}

function requestRow(memberId = 'm-1'): ErasureRouteRow {
  return toRouteRow(buildErasureRequestEvent(memberId, T0), T0);
}

function cancelRow(): ErasureRouteRow {
  return toRouteRow(buildErasureCancelEvent('m-1', T1), T1);
}

function completedRow(): ErasureRouteRow {
  return {
    type: 'erasure.completed',
    payloadJson: JSON.stringify({ completedAt: T1 }),
    createdAt: new Date(T1),
  };
}

describe('erasure-routes', () => {
  it('ERASURE_DUE_DAYS bernilai 30', () => {
    expect(ERASURE_DUE_DAYS).toBe(30);
  });

  it('buildErasureRequestEvent: payloadJson JSON valid berisi memberId dan dueAt tepat 30 hari', () => {
    const event = buildErasureRequestEvent('m-1', T0);
    expect(event.type).toBe('erasure.requested');
    const payload = JSON.parse(event.payloadJson) as Record<string, unknown>;
    expect(payload.memberId).toBe('m-1');
    expect(payload.dueAt).toBe(DUE);
  });

  it('buildErasureCancelEvent: payloadJson JSON valid berisi memberId dan cancelledAt', () => {
    const event = buildErasureCancelEvent('m-1', T1);
    expect(event.type).toBe('erasure.cancelled');
    const payload = JSON.parse(event.payloadJson) as Record<string, unknown>;
    expect(payload.memberId).toBe('m-1');
    expect(payload.cancelledAt).toBe(T1);
  });

  it('write request saat nihil state diterima sebagai 201', () => {
    const result = erasureWriteOutcome([requestRow('m-2')], 'request');
    expect(result.status).toBe(201);
    if (result.status === 201) {
      expect(result.request.memberId).toBe('m-2');
      expect(result.request.status).toBe('REQUESTED');
      expect(result.request.dueAt).toBe(DUE);
    }
  });

  it('GET dengan rows terisi merekonstruksi state sebagai 200', () => {
    const result = erasureGetResponse([requestRow()]);
    expect(result.status).toBe(200);
    if (result.status === 200) {
      expect(result.request.memberId).toBe('m-1');
      expect(result.request.status).toBe('REQUESTED');
      expect(result.request.requestedAt).toBe(T0);
      expect(result.request.dueAt).toBe(DUE);
    }
  });

  it('GET tanpa rows mengembalikan 404 ERASURE_NOT_FOUND', () => {
    const result = erasureGetResponse([]);
    expect(result).toEqual({ status: 404, code: 'ERASURE_NOT_FOUND' });
  });

  it('cancel dari REQUESTED diterima sebagai 200', () => {
    const result = erasureWriteOutcome([requestRow(), cancelRow()], 'cancel');
    expect(result.status).toBe(200);
    if (result.status === 200) {
      expect(result.request.status).toBe('CANCELLED');
      expect(result.request.cancelledAt).toBe(T1);
    }
  });

  it('cancel dari COMPLETED ditolak sebagai 409 ERASURE_CONFLICT', () => {
    const result = erasureWriteOutcome([requestRow(), completedRow(), cancelRow()], 'cancel');
    expect(result.status).toBe(409);
    if (result.status === 409) {
      expect(result.code).toBe('ERASURE_CONFLICT');
    }
  });

  it('cancel tanpa request ditolak sebagai 409 ERASURE_CONFLICT (kontrak konsisten)', () => {
    const result = erasureWriteOutcome([], 'cancel');
    expect(result.status).toBe(409);
    if (result.status === 409) {
      expect(result.code).toBe('ERASURE_CONFLICT');
    }
  });

  it('double request ditolak sebagai 409 ERASURE_CONFLICT', () => {
    const result = erasureWriteOutcome([requestRow(), requestRow()], 'request');
    expect(result.status).toBe(409);
    if (result.status === 409) {
      expect(result.code).toBe('ERASURE_CONFLICT');
    }
  });

  it('urutan rows dihormati: requested lalu completed menghasilkan COMPLETED', () => {
    const result = erasureGetResponse([requestRow(), completedRow()]);
    expect(result.status).toBe(200);
    if (result.status === 200) {
      expect(result.request.status).toBe('COMPLETED');
      expect(result.request.completedAt).toBe(T1);
    }
  });

  it('urutan rows dihormati: completed sebelum requested membuat replay gagal', () => {
    const result = erasureGetResponse([completedRow(), requestRow()]);
    expect(result.status).toBe(409);
    if (result.status === 409) {
      expect(result.code).toBe('ERASURE_CONFLICT');
    }
  });

  it('pemetaan error konsisten dengan mapErasureError dari erasure-wiring', () => {
    const broken: ErasureRouteRow[] = [
      { type: 'erasure.requested', payloadJson: '{bukan json', createdAt: new Date(T0) },
    ];
    let caught: unknown;
    try {
      erasureStateFromEvents(
        broken.map((row) => ({ type: row.type, payloadJson: row.payloadJson })),
      );
    } catch (error) {
      caught = error;
    }
    const expected = mapErasureError(caught);
    const result = erasureGetResponse(broken);
    expect(result.status).toBe(409);
    if (result.status === 409) {
      expect(result.code).toBe('ERASURE_CONFLICT');
      expect(result.message).toBe(expected.message);
    }
  });
});
