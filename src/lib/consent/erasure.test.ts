import { describe, expect, it } from 'vitest';
import {
  ERASURE_DEADLINE_DAYS,
  ErasureError,
  assertErasureDeadline,
  cancelErasureRequest,
  completeErasureRequest,
  computeErasurePlan,
  createErasureRequest,
  isErasureDue,
  type ErasureRequest,
} from './erasure';

const T0 = '2026-09-16T00:00:00.000Z';
const DUE = '2026-10-16T00:00:00.000Z'; // T0 + 30 hari
const T1 = '2026-09-20T00:00:00.000Z';
const T2 = '2026-10-01T00:00:00.000Z';

function requested(): ErasureRequest {
  return createErasureRequest('m1', T0);
}

describe('createErasureRequest', () => {
  it('happy path: status REQUESTED dan dueAt tepat 30 hari', () => {
    const req = requested();
    expect(req.status).toBe('REQUESTED');
    expect(req.memberId).toBe('m1');
    expect(req.requestedAt).toBe(T0);
    expect(req.dueAt).toBe(DUE);
    expect(req.completedAt).toBeUndefined();
    expect(req.cancelledAt).toBeUndefined();
  });

  it('konstanta tenggat 30 hari sesuai regulasi', () => {
    expect(ERASURE_DEADLINE_DAYS).toBe(30);
  });

  it('memberId kosong ditolak', () => {
    expect(() => createErasureRequest('', T0)).toThrow(/memberId/);
    expect(() => createErasureRequest('   ', T0)).toThrow(/memberId/);
  });

  it('requestedAt bukan ISO 8601 ditolak', () => {
    expect(() => createErasureRequest('m1', 'bukan-tanggal')).toThrow(/requestedAt/);
  });

  it('boundary tepat 30 hari diterima, 30 hari plus 1 ms ditolak', () => {
    expect(() => assertErasureDeadline(T0, DUE)).not.toThrow();
    const late = new Date(Date.parse(DUE) + 1).toISOString();
    expect(() => assertErasureDeadline(T0, late)).toThrow(ErasureError);
  });
});

describe('transisi state machine', () => {
  it('complete dari REQUESTED menghasilkan COMPLETED dengan completedAt', () => {
    const done = completeErasureRequest(requested(), T1);
    expect(done.status).toBe('COMPLETED');
    expect(done.completedAt).toBe(T1);
    expect(done.cancelledAt).toBeUndefined();
  });

  it('cancel dari REQUESTED menghasilkan CANCELLED dengan cancelledAt', () => {
    const cancelled = cancelErasureRequest(requested(), T1);
    expect(cancelled.status).toBe('CANCELLED');
    expect(cancelled.cancelledAt).toBe(T1);
  });

  it('complete setelah complete ditolak (transisi ilegal)', () => {
    const done = completeErasureRequest(requested(), T1);
    expect(() => completeErasureRequest(done, T2)).toThrow(ErasureError);
  });

  it('cancel setelah complete gagal dengan ErasureError', () => {
    const done = completeErasureRequest(requested(), T1);
    expect(() => cancelErasureRequest(done, T2)).toThrow(ErasureError);
  });

  it('complete setelah cancel ditolak (status final)', () => {
    const cancelled = cancelErasureRequest(requested(), T1);
    expect(() => completeErasureRequest(cancelled, T2)).toThrow(ErasureError);
  });

  it('completedAt lebih awal dari requestedAt ditolak', () => {
    expect(() => completeErasureRequest(requested(), '2026-09-15T00:00:00.000Z')).toThrow(
      /completedAt/,
    );
  });

  it('request immutable: original tidak berubah setelah complete', () => {
    const original = requested();
    completeErasureRequest(original, T1);
    expect(original.status).toBe('REQUESTED');
  });
});

describe('isErasureDue', () => {
  it('belum due sebelum tenggat', () => {
    expect(isErasureDue(requested(), T1)).toBe(false);
  });

  it('tepat dueAt masih dalam tenggat (boundary)', () => {
    expect(isErasureDue(requested(), DUE)).toBe(false);
  });

  it('lewat dueAt jadi due', () => {
    const after = new Date(Date.parse(DUE) + 1).toISOString();
    expect(isErasureDue(requested(), after)).toBe(true);
  });

  it('permintaan COMPLETED atau CANCELLED tidak pernah due', () => {
    const after = new Date(Date.parse(DUE) + 1).toISOString();
    const done = completeErasureRequest(requested(), T1);
    const cancelled = cancelErasureRequest(requested(), T1);
    expect(isErasureDue(done, after)).toBe(false);
    expect(isErasureDue(cancelled, after)).toBe(false);
  });
});

describe('replay beberapa request', () => {
  it('urutan panjang: request, cancel, request ulang, complete', () => {
    const first = createErasureRequest('m1', T0);
    const cancelled = cancelErasureRequest(first, T1);
    expect(cancelled.status).toBe('CANCELLED');

    const second = createErasureRequest('m1', T2);
    expect(second.status).toBe('REQUESTED');
    const done = completeErasureRequest(second, DUE);
    expect(done.status).toBe('COMPLETED');
    expect(done.completedAt).toBe(DUE);
    // request pertama tetap CANCELLED, tidak terkontaminasi
    expect(cancelled.status).toBe('CANCELLED');
    expect(done.requestedAt).toBe(T2);
  });

  it('replay dua member berbeda saling independen', () => {
    const a = createErasureRequest('a', T0);
    const b = createErasureRequest('b', T1);
    const bDone = completeErasureRequest(b, T2);
    expect(a.status).toBe('REQUESTED');
    expect(bDone.status).toBe('COMPLETED');
    expect(isErasureDue(a, T2)).toBe(false);
  });
});

describe('computeErasurePlan', () => {
  it('plan lengkap: nama dan tanggal diredaksi, foto dihapus, relasi anonim', () => {
    const plan = computeErasurePlan('m1', {
      hasName: true,
      hasPhoto: true,
      hasBirthDate: true,
      hasRelations: true,
    });
    expect(plan.scope).toBe('living-person');
    expect(plan.items).toHaveLength(4);
    const byField = new Map(plan.items.map((item) => [item.field, item.action]));
    expect(byField.get('name')).toBe('redact');
    expect(byField.get('birthDate')).toBe('redact');
    expect(byField.get('photoUrl')).toBe('delete');
    expect(byField.get('relations')).toBe('anonymize');
  });

  it('tanpa facts, plan konservatif mencakup semua field', () => {
    const plan = computeErasurePlan('m1');
    expect(plan.items).toHaveLength(4);
  });

  it('facts kosong eksplisit menghapus item dari plan', () => {
    const plan = computeErasurePlan('m1', {
      hasName: false,
      hasPhoto: false,
      hasBirthDate: false,
      hasRelations: false,
    });
    expect(plan.items).toHaveLength(0);
  });

  it('memberId kosong ditolak', () => {
    expect(() => computeErasurePlan('')).toThrow(/memberId/);
  });
});
