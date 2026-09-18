import { describe, it, expect } from 'vitest';
import {
  WITHDRAWAL_DUE_DAYS,
  recordWithdrawalRequest,
  extendWithdrawalWindow,
  recordWithdrawalRefusal,
  resolveWithdrawal,
  withdrawalStateFromEvents,
  mapWithdrawalError,
  WithdrawalEvent,
} from './withdrawal-tracking';

describe('Withdrawal Tracking Module (STG v115-i)', () => {
  it('1. dueAt = 30 hari', () => {
    const now = '2026-09-01T00:00:00.000Z';
    const ev = recordWithdrawalRequest(now);
    expect(ev.type).toBe('request');
    expect(ev.at).toBe(now);
    const expectedDue = new Date(Date.parse(now) + WITHDRAWAL_DUE_DAYS * 86400000).toISOString();
    expect(ev.dueAt).toBe(expectedDue);
  });

  it('2. extend menggeser dueAt', () => {
    const now = '2026-09-01T00:00:00.000Z';
    const req = recordWithdrawalRequest(now);
    const ext = extendWithdrawalWindow('2026-09-05T00:00:00.000Z', 'Kompleksitas tinggi', req.dueAt);
    expect(ext.type).toBe('extend');
    expect(ext.reason).toBe('Kompleksitas tinggi');
    expect(ext.dueAt).toBeDefined();
    const expectedExtendedDue = new Date(Date.parse(req.dueAt!) + WITHDRAWAL_DUE_DAYS * 86400000).toISOString();
    expect(ext.dueAt).toBe(expectedExtendedDue);
  });

  it('3. refuse menyimpan reason + complaintInfo dan wajib complaintInfo non-kosong', () => {
    expect(() => recordWithdrawalRefusal('Alasan sah', '')).toThrow();
    const ref = recordWithdrawalRefusal('Tidak dapat dihapus saat ini', 'Hak komplain ke Otoritas Perlindungan Data');
    expect(ref.type).toBe('refuse');
    expect(ref.reason).toBe('Tidak dapat dihapus saat ini');
    expect(ref.complaintInfo).toBe('Hak komplain ke Otoritas Perlindungan Data');
  });

  it('4. resolve', () => {
    const now = '2026-09-10T00:00:00.000Z';
    const res = resolveWithdrawal(now);
    expect(res.type).toBe('resolve');
    expect(res.at).toBe(now);
  });

  it('5. replay urutan campuran', () => {
    const now = '2026-09-01T00:00:00.000Z';
    const events: WithdrawalEvent[] = [
      recordWithdrawalRequest(now),
      extendWithdrawalWindow('2026-09-05T00:00:00.000Z', 'Perpanjangan waktu', undefined),
      resolveWithdrawal('2026-09-10T00:00:00.000Z'),
    ];
    const state = withdrawalStateFromEvents(events);
    expect(state.stage).toBe('resolved');
  });

  it('6. state awal none', () => {
    const state = withdrawalStateFromEvents([]);
    expect(state.stage).toBe('none');
    expect(state.requestedAt).toBeNull();
    expect(state.dueAt).toBeNull();
    expect(state.refusalReason).toBeNull();
    expect(state.complaintInfo).toBeNull();
  });

  it('7. dua request berurutan (yang terakhir menang / update state)', () => {
    const now1 = '2026-09-01T00:00:00.000Z';
    const now2 = '2026-09-02T00:00:00.000Z';
    const events: WithdrawalEvent[] = [
      recordWithdrawalRequest(now1),
      recordWithdrawalRequest(now2),
    ];
    const state = withdrawalStateFromEvents(events);
    expect(state.stage).toBe('pending');
    expect(state.requestedAt).toBe(now2);
  });

  it('8. refusal setelah pending', () => {
    const now = '2026-09-01T00:00:00.000Z';
    const events: WithdrawalEvent[] = [
      recordWithdrawalRequest(now),
      recordWithdrawalRefusal('Ditolak hukum', 'Info banding'),
    ];
    const state = withdrawalStateFromEvents(events);
    expect(state.stage).toBe('refused');
    expect(state.refusalReason).toBe('Ditolak hukum');
    expect(state.complaintInfo).toBe('Info banding');
    expect(state.dueAt).not.toBeNull();
  });

  it('9. extend sebelum request (state tetap none)', () => {
    const events: WithdrawalEvent[] = [
      extendWithdrawalWindow('2026-09-01T00:00:00.000Z', 'Invalid extend'),
    ];
    const state = withdrawalStateFromEvents(events);
    expect(state.stage).toBe('none');
  });

  it('10. mapWithdrawalError 3 kode', () => {
    const e1 = mapWithdrawalError('invalid_state');
    expect(e1.status).toBe(409);
    expect(e1.code).toBe('invalid_state');

    const e2 = mapWithdrawalError('not_found');
    expect(e2.status).toBe(404);
    expect(e2.code).toBe('not_found');

    const e3 = mapWithdrawalError('invalid_request');
    expect(e3.status).toBe(400);
    expect(e3.code).toBe('invalid_request');
  });

  it('11. format ISO round-trip', () => {
    const now = new Date().toISOString();
    const req = recordWithdrawalRequest(now);
    expect(() => new Date(req.at).toISOString()).not.toThrow();
    expect(req.dueAt && !Number.isNaN(Date.parse(req.dueAt))).toBe(true);
  });

  it('12. resolve setelah refused', () => {
    const events: WithdrawalEvent[] = [
      recordWithdrawalRequest('2026-09-01T00:00:00.000Z'),
      recordWithdrawalRefusal('Tolak', 'Info'),
      resolveWithdrawal('2026-09-05T00:00:00.000Z'),
    ];
    const state = withdrawalStateFromEvents(events);
    expect(state.stage).toBe('resolved');
  });

  it('13. invalid now string pada recordWithdrawalRequest throws', () => {
    expect(() => recordWithdrawalRequest('not-a-date')).toThrow();
  });

  it('14. invalid now string pada extendWithdrawalWindow throws', () => {
    expect(() => extendWithdrawalWindow('not-a-date', 'alasan')).toThrow();
  });
});
