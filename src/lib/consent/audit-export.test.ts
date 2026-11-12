import { describe, it, expect } from 'vitest';
import { reconstructAuditLedger, exportAuditCsv, escapeCsvField } from './audit-export';
import { replayConsentState } from './dispatch';

describe('Stemmagraph Consent Audit Trail (v431)', () => {
  const sampleRows = [
    {
      id: 'evt-1',
      memberId: 'mem-123',
      actorUserId: 'usr-456',
      aksi: 'grant',
      scope: 'public-profile',
      policyVersion: '1.0',
      sumber: 'ui',
      noop: false,
      at: '2026-11-06T00:00:00.000Z',
    },
    {
      id: 'evt-2',
      memberId: 'mem-123',
      actorUserId: 'usr-456',
      aksi: 'revoke',
      scope: 'public-profile',
      policyVersion: '1.0',
      sumber: 'api',
      noop: true,
      at: '2026-11-07T00:00:00.000Z',
    },
  ];

  it('AC3: reconstructAuditLedger menghasilkan row consent valid untuk replay', () => {
    const ledgerRows = reconstructAuditLedger(sampleRows);
    expect(ledgerRows).toHaveLength(1);
    expect(ledgerRows[0].action).toBe('grant');
    const state = replayConsentState(ledgerRows);
    expect(state.granted).toBe(true);
  });

  it('AC4: escapeCsvField mencegah CSV Injection (owasp 7 char)', () => {
    expect(escapeCsvField('normal')).toBe('normal');
    expect(escapeCsvField('=SUM(1+1)')).toBe('"=SUM(1+1)"');
    expect(escapeCsvField('@test')).toBe('"@test"');
    expect(escapeCsvField('+12345')).toBe('"+12345"');
  });

  it('AC4: exportAuditCsv menghasilkan format CSV valid dengan header', () => {
    const csv = exportAuditCsv(sampleRows);
    const lines = csv.split('\n');
    expect(lines[0]).toContain('memberId,actorUserId,aksi');
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain('mem-123');
  });

  it('AC6: struktur immutability dan freeze check', () => {
    const frozen = Object.freeze([...sampleRows]);
    const csv = exportAuditCsv(frozen);
    expect(csv).toBeDefined();
  });
});
