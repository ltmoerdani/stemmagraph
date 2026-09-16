import { describe, expect, it } from 'vitest';
import {
  ConsentLedgerError,
  applyRecord,
  createRecord,
  initState,
  type ConsentState,
} from './record';

const T0 = '2026-09-16T00:00:00.000Z';
const T1 = '2026-09-16T01:00:00.000Z';
const T2 = '2026-09-16T02:00:00.000Z';

function grantedState(): ConsentState {
  const grant = createRecord('m1', 'grant', 'newsletter', T0);
  return applyRecord(initState(), grant);
}

describe('consent record', () => {
  it('grant pertama OK dan granted true', () => {
    const record = createRecord('m1', 'grant', 'newsletter', T0);
    const state = applyRecord(initState(), record);
    expect(state.granted).toBe(true);
    expect(state.records).toHaveLength(1);
    expect(state.records[0]?.action).toBe('grant');
  });

  it('revoke tanpa grant ditolak', () => {
    const record = createRecord('m1', 'revoke', 'newsletter', T0);
    expect(() => applyRecord(initState(), record)).toThrow(Error);
  });

  it('revoke setelah grant OK dan granted false', () => {
    const revoke = createRecord('m1', 'revoke', 'newsletter', T1);
    const state = applyRecord(grantedState(), revoke);
    expect(state.granted).toBe(false);
    expect(state.records).toHaveLength(2);
  });

  it('regrant setelah revoke OK', () => {
    const revoke = createRecord('m1', 'revoke', 'newsletter', T1);
    const revoked = applyRecord(grantedState(), revoke);
    const regrant = createRecord('m1', 'regrant', 'newsletter', T2);
    const state = applyRecord(revoked, regrant);
    expect(state.granted).toBe(true);
    expect(state.records).toHaveLength(3);
  });

  it('note 281 karakter ditolak', () => {
    const note = 'a'.repeat(281);
    expect(() => createRecord('m1', 'grant', 'newsletter', T0, note)).toThrow(
      Error,
    );
  });

  it('dua record timestamp sama ditolak (monotonic)', () => {
    const revoke = createRecord('m1', 'revoke', 'newsletter', T0);
    expect(() => applyRecord(grantedState(), revoke)).toThrow(/monotonic/);
  });

  describe('ConsentLedgerError (S-06e AC3)', () => {
    it('revoke tanpa grant tercatat melempar ConsentLedgerError', () => {
      const record = createRecord('m1', 'revoke', 'newsletter', T0);
      try {
        applyRecord(initState(), record);
        expect.unreachable('applyRecord harus melempar ConsentLedgerError');
      } catch (e) {
        expect(e).toBeInstanceOf(ConsentLedgerError);
        expect((e as Error).name).toBe('ConsentLedgerError');
      }
    });

    it('regrant saat granted melempar ConsentLedgerError', () => {
      const record = createRecord('m1', 'regrant', 'newsletter', T1);
      try {
        applyRecord(grantedState(), record);
        expect.unreachable('applyRecord harus melempar ConsentLedgerError');
      } catch (e) {
        expect(e).toBeInstanceOf(ConsentLedgerError);
        expect((e as Error).name).toBe('ConsentLedgerError');
      }
    });

    it('timestamp non-monotonic melempar ConsentLedgerError', () => {
      const revoke = createRecord('m1', 'revoke', 'newsletter', T0);
      try {
        applyRecord(grantedState(), revoke);
        expect.unreachable('applyRecord harus melempar ConsentLedgerError');
      } catch (e) {
        expect(e).toBeInstanceOf(ConsentLedgerError);
        expect((e as Error).name).toBe('ConsentLedgerError');
      }
    });
  });
});
