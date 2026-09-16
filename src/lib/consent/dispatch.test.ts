import { describe, expect, it } from 'vitest';
import {
  parseConsentBody,
  replayConsentState,
  targetPrivacyStatus,
} from './dispatch';
import { createRecord, initState, applyRecord } from './record';

const T0 = '2026-09-16T00:00:00.000Z';
const T1 = '2026-09-16T01:00:00.000Z';
const T2 = '2026-09-16T02:00:00.000Z';

describe('parseConsentBody', () => {
  it('body valid grant dengan note diterima', () => {
    const r = parseConsentBody({ action: 'grant', scope: 'research', note: 'ok' });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.action).toBe('grant');
      expect(r.scope).toBe('research');
      expect(r.note).toBe('ok');
    }
  });

  it('body valid revoke tanpa note diterima', () => {
    const r = parseConsentBody({ action: 'revoke', scope: 'research' });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.action).toBe('revoke');
      expect(r.note).toBeUndefined();
    }
  });

  it('action tidak dikenal ditolak', () => {
    const r = parseConsentBody({ action: 'delete', scope: 'research' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('CONSENT_ACTION_INVALID');
  });

  it('scope kosong ditolak', () => {
    const r = parseConsentBody({ action: 'grant', scope: '  ' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('CONSENT_SCOPE_REQUIRED');
  });

  it('note non-string ditolak', () => {
    const r = parseConsentBody({ action: 'grant', scope: 'research', note: 42 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('CONSENT_NOTE_INVALID');
  });
});

describe('targetPrivacyStatus', () => {
  it('revoke memetakan ke private', () => {
    expect(targetPrivacyStatus('revoke')).toBe('private');
  });

  it('grant dan regrant memetakan ke shared', () => {
    expect(targetPrivacyStatus('grant')).toBe('shared');
    expect(targetPrivacyStatus('regrant')).toBe('shared');
  });
});

describe('replayConsentState', () => {
  it('replay ledger grant lalu revoke menghasilkan granted false', () => {
    const state = replayConsentState([
      { id: 'rec_1', memberId: 'm1', action: 'grant', scope: 'research', note: null, at: new Date(T0) },
      { id: 'rec_2', memberId: 'm1', action: 'revoke', scope: 'research', note: null, at: new Date(T1) },
    ]);
    expect(state.granted).toBe(false);
    expect(state.records).toHaveLength(2);
  });

  it('ledger korup (revoke tanpa grant) melempar Error', () => {
    expect(() =>
      replayConsentState([
        { id: 'rec_1', memberId: 'm1', action: 'revoke', scope: 'research', note: null, at: new Date(T0) },
      ]),
    ).toThrow(Error);
  });

  it('replay konsisten dengan reducer langsung (grant revoke regrant)', () => {
    const direct = applyRecord(applyRecord(applyRecord(initState(), createRecord('m1', 'grant', 'research', T0)), createRecord('m1', 'revoke', 'research', T1)), createRecord('m1', 'regrant', 'research', T2));
    const replayed = replayConsentState([
      { id: 'rec_1', memberId: 'm1', action: 'grant', scope: 'research', note: null, at: new Date(T0) },
      { id: 'rec_2', memberId: 'm1', action: 'revoke', scope: 'research', note: null, at: new Date(T1) },
      { id: 'rec_3', memberId: 'm1', action: 'regrant', scope: 'research', note: null, at: new Date(T2) },
    ]);
    expect(replayed.granted).toBe(true);
    expect(replayed.records.map((r) => r.action)).toEqual(direct.records.map((r) => r.action));
  });
});
