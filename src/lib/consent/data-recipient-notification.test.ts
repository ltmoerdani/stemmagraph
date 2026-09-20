/**
 * Test pemberitahuan penerima data fase II (STG v127-ii).
 * Kasus mencakup: deceased exempt (Recital 27), ambang effort 100
 * penerima (Art. 44.7.b), backup usang defer (threshold backup-policy),
 * notify standar (Art. 44.7.a), kombinasi prioritas, reason terisi,
 * dan determinisme dengan nowIso sama.
 */

import { describe, expect, it } from 'vitest';
import { BACKUP_STALENESS_THRESHOLD_DAYS } from './backup-policy';
import {
  evaluateRecipientNotification,
  type DataRecipientNotificationInput,
} from './data-recipient-notification';

const NOW = '2026-09-20T00:00:00.000Z';

function daysAgoIso(days: number): string {
  return new Date(Date.parse(NOW) - days * 86_400_000).toISOString();
}

function baseInput(overrides: Partial<DataRecipientNotificationInput>): DataRecipientNotificationInput {
  return {
    recipientCount: 3,
    lastBackupAt: daysAgoIso(1),
    deceasedFlag: false,
    nowIso: NOW,
    ...overrides,
  };
}

describe('evaluateRecipientNotification', () => {
  it('deceasedFlag true menghasilkan exempt per Recital 27', () => {
    const verdict = evaluateRecipientNotification(baseInput({ deceasedFlag: true }));
    expect(verdict.decision).toBe('exempt');
    expect(verdict.reason).toContain('Recital 27');
  });

  it('recipientCount tepat 100 menghasilkan exempt ambang effort', () => {
    const verdict = evaluateRecipientNotification(baseInput({ recipientCount: 100 }));
    expect(verdict.decision).toBe('exempt');
    expect(verdict.reason).toContain('44.7.b');
  });

  it('recipientCount 99 masih notify', () => {
    const verdict = evaluateRecipientNotification(baseInput({ recipientCount: 99 }));
    expect(verdict.decision).toBe('notify');
  });

  it('recipientCount 100 tanpa backup tetap exempt ambang effort', () => {
    const verdict = evaluateRecipientNotification(baseInput({ recipientCount: 100, lastBackupAt: undefined }));
    expect(verdict.decision).toBe('exempt');
  });

  it('backup lebih tua dari threshold menghasilkan defer staleness', () => {
    const verdict = evaluateRecipientNotification(baseInput({ lastBackupAt: daysAgoIso(BACKUP_STALENESS_THRESHOLD_DAYS + 1) }));
    expect(verdict.decision).toBe('defer');
    expect(verdict.reason).toContain('usang');
  });

  it('backup masih segar menghasilkan notify', () => {
    const verdict = evaluateRecipientNotification(baseInput({ lastBackupAt: daysAgoIso(BACKUP_STALENESS_THRESHOLD_DAYS - 1) }));
    expect(verdict.decision).toBe('notify');
  });

  it('umur backup tepat threshold dianggap usang dan defer', () => {
    const verdict = evaluateRecipientNotification(baseInput({ lastBackupAt: daysAgoIso(BACKUP_STALENESS_THRESHOLD_DAYS) }));
    expect(verdict.decision).toBe('defer');
  });

  it('umur backup tepat di bawah threshold tidak defer', () => {
    const verdict = evaluateRecipientNotification(baseInput({ lastBackupAt: daysAgoIso(BACKUP_STALENESS_THRESHOLD_DAYS - 1) }));
    expect(verdict.decision).not.toBe('defer');
  });

  it('kombinasi deceased dan count besar tetap exempt karena deceased lebih dulu', () => {
    const verdict = evaluateRecipientNotification(baseInput({ deceasedFlag: true, recipientCount: 500 }));
    expect(verdict.decision).toBe('exempt');
    expect(verdict.reason).toContain('Recital 27');
  });

  it('lastBackupAt absen dengan count kecil menghasilkan notify', () => {
    const verdict = evaluateRecipientNotification(baseInput({ lastBackupAt: undefined }));
    expect(verdict.decision).toBe('notify');
  });

  it('reason notify memuat isi pemberitahuan Art. 44.7.a', () => {
    const verdict = evaluateRecipientNotification(baseInput({}));
    expect(verdict.reason).toContain('44.7.a');
  });

  it('semua jalur keputusan menghasilkan reason tidak kosong', () => {
    const inputs: DataRecipientNotificationInput[] = [
      baseInput({ deceasedFlag: true }),
      baseInput({ recipientCount: 150 }),
      baseInput({ lastBackupAt: daysAgoIso(60) }),
      baseInput({}),
    ];
    for (const input of inputs) {
      const verdict = evaluateRecipientNotification(input);
      expect(verdict.reason.length).toBeGreaterThan(0);
      expect(verdict.reason.trim()).toBe(verdict.reason);
    }
  });

  it('fungsi deterministik: nowIso sama menghasilkan verdict identik', () => {
    const input = baseInput({ recipientCount: 42, lastBackupAt: daysAgoIso(10) });
    const first = evaluateRecipientNotification(input);
    const second = evaluateRecipientNotification({ ...input });
    expect(second).toEqual(first);
  });

  it('nowIso lebih baru mengubah backup segar menjadi usang', () => {
    const backupAt = daysAgoIso(29);
    const fresh = evaluateRecipientNotification(baseInput({ lastBackupAt: backupAt }));
    const later = evaluateRecipientNotification(baseInput({ lastBackupAt: backupAt, nowIso: '2026-10-21T00:00:00.000Z' }));
    expect(fresh.decision).toBe('notify');
    expect(later.decision).toBe('defer');
  });
});
