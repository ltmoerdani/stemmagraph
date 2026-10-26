/**
 * Test v406 untuk planner backup pure: nama file deterministik dari
 * Date UTC tetap dan perencanaan retensi keep terbaru, hapus tertua dulu.
 */
import { describe, expect, it } from 'vitest';
import { backupFileNameFor, planRetention } from './backupPlanner';

describe('backupFileNameFor', () => {
  it('menghasilkan nama deterministik dari Date UTC tetap', () => {
    const d = new Date('2026-05-04T07:08:09Z');
    expect(backupFileNameFor(d)).toBe('stemmagraph-backup-20260504T070809Z.db');
  });

  it('memadatkan komponen satu digit menjadi dua digit', () => {
    const d = new Date('2026-01-02T03:04:05Z');
    expect(backupFileNameFor(d)).toBe('stemmagraph-backup-20260102T030405Z.db');
  });

  it('konsisten untuk input yang sama', () => {
    const d = new Date('2025-12-31T23:59:59Z');
    expect(backupFileNameFor(d)).toBe(backupFileNameFor(new Date(d.getTime())));
  });
});

describe('planRetention', () => {
  it('keep 14 dari 20 file: hapus 6 tertua, urut nama naik', () => {
    const files = Array.from({ length: 20 }, (_, i) => {
      const n = String(i + 1).padStart(2, '0');
      return `stemmagraph-backup-20260101T0000${n}Z.db`;
    });
    const toDelete = planRetention(files, 14);
    expect(toDelete).toHaveLength(6);
    expect(toDelete).toEqual(files.slice(0, 6));
    const sisa = files.filter((f) => !toDelete.includes(f));
    expect(sisa).toEqual(files.slice(6));
  });

  it('files lebih sedikit dari keep: tidak ada yang dihapus', () => {
    const files = ['b-3.db', 'a-1.db', 'c-2.db'];
    expect(planRetention(files, 14)).toEqual([]);
  });

  it('array kosong: hasil kosong', () => {
    expect(planRetention([], 14)).toEqual([]);
  });

  it('jumlah file tepat sama dengan keep: tidak ada yang dihapus', () => {
    const files = ['a.db', 'b.db', 'c.db', 'd.db'];
    expect(planRetention(files, 4)).toEqual([]);
  });

  it('urutan input acak tetap diurutkan: tertua dulu di depan', () => {
    const files = ['c.db', 'a.db', 'd.db', 'b.db'];
    expect(planRetention(files, 2)).toEqual(['a.db', 'b.db']);
  });
});
