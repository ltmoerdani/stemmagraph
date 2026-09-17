import { describe, expect, it } from 'vitest';
import { isErasureDue } from './erasure';
import {
  erasureStateFromEvents,
  mapErasureError,
  requestErasure,
  type ErasureEventRow,
} from './erasure-wiring';

const T0 = '2026-09-16T00:00:00.000Z';
const DUE = '2026-10-16T00:00:00.000Z'; // T0 + 30 hari
const T1 = '2026-09-20T00:00:00.000Z';
const T2 = '2026-10-01T00:00:00.000Z';
const AFTER_DUE = '2026-10-20T00:00:00.000Z';

function requestedRow(memberId = 'm1'): ErasureEventRow {
  return {
    type: 'erasure.requested',
    payloadJson: JSON.stringify({ memberId, requestedAt: T0 }),
  };
}

function completedRow(at: string): ErasureEventRow {
  return {
    type: 'erasure.completed',
    payloadJson: JSON.stringify({ completedAt: at }),
  };
}

function cancelledRow(at: string): ErasureEventRow {
  return {
    type: 'erasure.cancelled',
    payloadJson: JSON.stringify({ cancelledAt: at }),
  };
}

describe('requestErasure', () => {
  it('happy path: status REQUESTED dan dueAt tepat 30 hari', () => {
    const req = requestErasure('m1', T0);
    expect(req.status).toBe('REQUESTED');
    expect(req.memberId).toBe('m1');
    expect(req.dueAt).toBe(DUE);
  });

  it('memberId kosong ditolak sebagai Error validasi', () => {
    expect(() => requestErasure('   ', T0)).toThrow('memberId wajib diisi');
  });

  it('timestamp tidak valid ditolak sebagai Error validasi', () => {
    expect(() => requestErasure('m1', 'bukan-iso')).toThrow();
  });
});

describe('erasureStateFromEvents', () => {
  it('array kosong menghasilkan null karena belum ada permintaan', () => {
    expect(erasureStateFromEvents([])).toBeNull();
  });

  it('replay requested saja menghasilkan status REQUESTED', () => {
    const state = erasureStateFromEvents([requestedRow()]);
    expect(state).not.toBeNull();
    expect(state?.status).toBe('REQUESTED');
    expect(state?.requestedAt).toBe(T0);
    expect(state?.dueAt).toBe(DUE);
  });

  it('replay requested lalu completed menghasilkan status COMPLETED', () => {
    const state = erasureStateFromEvents([requestedRow(), completedRow(T1)]);
    expect(state?.status).toBe('COMPLETED');
    expect(state?.completedAt).toBe(T1);
  });

  it('replay requested lalu cancelled menghasilkan status CANCELLED', () => {
    const state = erasureStateFromEvents([requestedRow(), cancelledRow(T1)]);
    expect(state?.status).toBe('CANCELLED');
    expect(state?.cancelledAt).toBe(T1);
  });

  it('urutan terbalik (completed sebelum requested) ditolak ErasureError', () => {
    expect(() => erasureStateFromEvents([completedRow(T1), requestedRow()])).toThrowError(
      /belum ada permintaan erasure/,
    );
  });

  it('requested ganda ditolak ErasureError', () => {
    expect(() => erasureStateFromEvents([requestedRow(), requestedRow()])).toThrowError(/sudah ada/);
  });

  it('cancel atas permintaan yang sudah COMPLETED ditolak ErasureError', () => {
    const rows = [requestedRow(), completedRow(T1), cancelledRow(T2)];
    expect(() => erasureStateFromEvents(rows)).toThrowError(/cancel ditolak/);
  });

  it('payloadJson bukan JSON valid ditolak sebagai Error validasi', () => {
    const rows: ErasureEventRow[] = [{ type: 'erasure.requested', payloadJson: '{tidak json' }];
    expect(() => erasureStateFromEvents(rows)).toThrowError(/bukan JSON valid/);
  });

  it('tipe event tidak dikenal ditolak sebagai Error validasi', () => {
    const rows: ErasureEventRow[] = [{ type: 'erasure.deleted' as never, payloadJson: '{}' }];
    expect(() => erasureStateFromEvents(rows)).toThrowError(/tidak dikenal/);
  });

  it('state hasil replay terlihat due ketika waktu lewat tenggat', () => {
    const state = erasureStateFromEvents([requestedRow()]);
    expect(state).not.toBeNull();
    expect(isErasureDue(state as NonNullable<typeof state>, AFTER_DUE)).toBe(true);
    expect(isErasureDue(state as NonNullable<typeof state>, DUE)).toBe(false);
  });

  it('state CANCELLED hasil replay tidak pernah due', () => {
    const state = erasureStateFromEvents([requestedRow(), cancelledRow(T1)]);
    expect(state?.status).toBe('CANCELLED');
    expect(isErasureDue(state as NonNullable<typeof state>, AFTER_DUE)).toBe(false);
  });
});

describe('mapErasureError', () => {
  it('ErasureError dari transisi invalid dipetakan ke 409 ERASURE_CONFLICT', () => {
    let caught: unknown;
    try {
      erasureStateFromEvents([completedRow(T1)]);
    } catch (error) {
      caught = error;
    }
    const mapped = mapErasureError(caught);
    expect(mapped.status).toBe(409);
    expect(mapped.code).toBe('ERASURE_CONFLICT');
    expect(typeof mapped.message).toBe('string');
  });

  it('Error validasi biasa dipetakan ke 400 ERASURE_VALIDATION', () => {
    const mapped = mapErasureError(new Error('memberId wajib diisi'));
    expect(mapped.status).toBe(400);
    expect(mapped.code).toBe('ERASURE_VALIDATION');
    expect(mapped.message).toBe('memberId wajib diisi');
  });

  it('nilai bukan Error dipetakan ke 500 dengan pesan generik', () => {
    const mapped = mapErasureError('kabut');
    expect(mapped.status).toBe(500);
    expect(mapped.code).toBe('ERASURE_INTERNAL');
    expect(mapped.message).not.toContain('kabut');
  });
});
