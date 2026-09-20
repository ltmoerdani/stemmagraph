/**
 * Test kebijakan staleness backup fase I (STG v127-i).
 * Kasus mencakup: batas tepat 30 hari, di atas dan di bawahnya, umur
 * nol, merge point ada dan nihil, retention cap dalam dan luar,
 * determinisme parse ISO, serta fallback aman untuk input rusak.
 */

import { describe, expect, it } from 'vitest';
import {
  BACKUP_RETENTION_CAP_DAYS,
  BACKUP_STALENESS_THRESHOLD_DAYS,
  backupStalenessDays,
  evaluateBackupPolicy,
  isBackupStale,
} from './backup-policy';

const NOW = '2026-09-20T00:00:00.000Z';

function daysAgoIso(days: number, offsetMs = 0): string {
  return new Date(Date.parse(NOW) - days * 86_400_000 + offsetMs).toISOString();
}

describe('backupStalenessDays', () => {
  it('umur tepat 30 hari menghasilkan 30', () => {
    expect(backupStalenessDays(daysAgoIso(30), NOW)).toBe(30);
  });

  it('umur di atas 30 hari menghasilkan 31', () => {
    expect(backupStalenessDays(daysAgoIso(31), NOW)).toBe(31);
  });

  it('umur di bawah 30 hari menghasilkan 29', () => {
    expect(backupStalenessDays(daysAgoIso(29), NOW)).toBe(29);
  });

  it('umur di batas 0 hari menghasilkan 0', () => {
    expect(backupStalenessDays(NOW, NOW)).toBe(0);
  });
});

describe('isBackupStale', () => {
  it('tepat 30 hari dianggap usang (threshold inclusive)', () => {
    expect(isBackupStale(daysAgoIso(30), NOW)).toBe(true);
  });

  it('30 hari dikurangi 1 milidetik belum usang', () => {
    expect(isBackupStale(daysAgoIso(30, 1), NOW)).toBe(false);
  });

  it('timestamp rusak dianggap usang tanpa melempar error', () => {
    expect(isBackupStale('bukan-iso', NOW)).toBe(true);
  });
});

describe('evaluateBackupPolicy', () => {
  it('merge point ada: delta sejak merge point dihitung', () => {
    const verdict = evaluateBackupPolicy(
      { lastBackupAt: daysAgoIso(10), mergePointAt: daysAgoIso(7) },
      NOW,
    );
    expect(verdict.deltaSinceMergePointDays).toBe(7);
    expect(verdict.isStale).toBe(false);
  });

  it('merge point nihil (field absen): delta null', () => {
    const verdict = evaluateBackupPolicy({ lastBackupAt: daysAgoIso(5) }, NOW);
    expect(verdict.deltaSinceMergePointDays).toBeNull();
  });

  it('merge point string kosong diperlakukan nihil: delta null', () => {
    const verdict = evaluateBackupPolicy(
      { lastBackupAt: daysAgoIso(5), mergePointAt: '' },
      NOW,
    );
    expect(verdict.deltaSinceMergePointDays).toBeNull();
  });

  it('umur 45 hari masih dalam retention cap tapi sudah usang', () => {
    const verdict = evaluateBackupPolicy({ lastBackupAt: daysAgoIso(45) }, NOW);
    expect(verdict.isStale).toBe(true);
    expect(verdict.withinRetention).toBe(true);
  });

  it('umur 91 hari melewati retention cap', () => {
    const verdict = evaluateBackupPolicy({ lastBackupAt: daysAgoIso(91) }, NOW);
    expect(verdict.withinRetention).toBe(false);
  });

  it('lastBackupAt rusak: fallback aman, tidak throw, usang dan di luar retensi', () => {
    const verdict = evaluateBackupPolicy({ lastBackupAt: 'not-a-date' }, NOW);
    expect(verdict.isStale).toBe(true);
    expect(verdict.withinRetention).toBe(false);
    expect(verdict.ageDays).toBe(Number.POSITIVE_INFINITY);
  });

  it('determinisme: hasil identik untuk input dan format offset yang ekuivalen', () => {
    const a = evaluateBackupPolicy(
      { lastBackupAt: '2026-09-13T00:00:00.000Z', mergePointAt: '2026-09-10T00:00:00.000Z' },
      NOW,
    );
    const b = evaluateBackupPolicy(
      { lastBackupAt: '2026-09-13T07:00:00+07:00', mergePointAt: '2026-09-10T02:00:00+02:00' },
      NOW,
    );
    expect(b).toEqual(a);
    expect(a.deltaSinceMergePointDays).toBe(10);
  });
});

describe('konstanta kebijakan', () => {
  it('threshold 30 dan retention cap 90 dengan cap 3x threshold', () => {
    expect(BACKUP_STALENESS_THRESHOLD_DAYS).toBe(30);
    expect(BACKUP_RETENTION_CAP_DAYS).toBe(90);
    expect(BACKUP_RETENTION_CAP_DAYS).toBe(BACKUP_STALENESS_THRESHOLD_DAYS * 3);
  });
});
