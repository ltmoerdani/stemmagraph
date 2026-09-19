import { describe, expect, it } from 'vitest';
import { runImportGate } from './import-gate';
import type { SchemaGateEntry } from './schema-gate';

const ROOT = '';
const INDI = 'https://gedcom.io/terms/v7/record-INDI';
const HEAD_URI = 'https://gedcom.io/terms/v7/HEAD';

function ent(
  line: number,
  superstructureUri: string,
  tag: string,
): SchemaGateEntry {
  return { line, superstructureUri, tag };
}

describe('import-gate', () => {
  it('input kosong menghasilkan laporan kosong tanpa reject', () => {
    const result = runImportGate([]);
    expect(result.report).toEqual({
      issues: [],
      extensionCount: 0,
      checkedCount: 0,
    });
    expect(result.rejects).toEqual([]);
  });

  it('struktur legal lolos tanpa reject palsu', () => {
    const result = runImportGate([
      ent(1, ROOT, 'HEAD'),
      ent(2, ROOT, 'INDI'),
      ent(3, INDI, 'NAME'),
      ent(5, INDI, 'NAME'),
    ]);
    expect(result.rejects).toEqual([]);
    expect(result.report.issues).toEqual([]);
    expect(result.report.checkedCount).toBe(4);
  });

  it('HEAD sekali di root tidak menghasilkan reject', () => {
    const result = runImportGate([ent(1, ROOT, 'HEAD')]);
    expect(result.rejects).toEqual([]);
    expect(result.report.checkedCount).toBe(1);
  });

  it('tag underscore ditandai extension, tidak ditolak (GEDCOM 7 Bab 1.5)', () => {
    const result = runImportGate([ent(3, INDI, '_CUSTOM')]);
    expect(result.rejects).toEqual([]);
    expect(result.report.issues).toEqual([]);
    expect(result.report.extensionCount).toBe(1);
    expect(result.report.checkedCount).toBe(0);
  });

  it('extension campur struktur legal: nihil reject, keduanya terhitung', () => {
    const result = runImportGate([
      ent(1, ROOT, 'INDI'),
      ent(2, INDI, '_NOTE'),
      ent(3, INDI, 'NAME'),
    ]);
    expect(result.rejects).toEqual([]);
    expect(result.report.extensionCount).toBe(1);
    expect(result.report.checkedCount).toBe(2);
  });

  it('struktur salah tempat menghasilkan reject: baris, URI induk, alasan', () => {
    const result = runImportGate([ent(7, INDI, 'MARR')]);
    expect(result.rejects).toEqual([
      {
        line: 7,
        structureUri: INDI,
        reason: 'unknown_structure',
      },
    ]);
  });

  it('struktur tak dikenal tanpa underscore tetap ditolak, bukan extension', () => {
    const result = runImportGate([ent(4, ROOT, 'XXXX')]);
    expect(result.report.extensionCount).toBe(0);
    expect(result.rejects).toHaveLength(1);
    expect(result.rejects[0].reason).toBe('unknown_structure');
    expect(result.rejects[0].line).toBe(4);
  });

  it('kardinalitas {1:1} dilanggar: reject di kemunculan kedua', () => {
    const result = runImportGate([ent(1, ROOT, 'HEAD'), ent(9, ROOT, 'HEAD')]);
    expect(result.rejects).toEqual([
      {
        line: 9,
        structureUri: HEAD_URI,
        reason: 'cardinality_violated',
      },
    ]);
    expect(result.report.checkedCount).toBe(1);
  });

  it('reject memetakan isu satu-satu dengan urutan yang sama', () => {
    const result = runImportGate([
      ent(2, INDI, 'MARR'),
      ent(3, ROOT, 'HEAD'),
      ent(4, ROOT, 'HEAD'),
    ]);
    expect(result.report.issues).toHaveLength(2);
    expect(result.rejects).toEqual([
      { line: 2, structureUri: INDI, reason: 'unknown_structure' },
      { line: 4, structureUri: HEAD_URI, reason: 'cardinality_violated' },
    ]);
  });

  it(' banyak reject unknown: urutan baris parse dipertahankan', () => {
    const result = runImportGate([
      ent(5, INDI, 'MARR'),
      ent(6, INDI, 'DIV'),
      ent(8, INDI, 'MARR'),
    ]);
    expect(result.rejects.map((r) => r.line)).toEqual([5, 6, 8]);
    expect(result.rejects.every((r) => r.reason === 'unknown_structure')).toBe(
      true,
    );
  });

  it('laporan ringkas benar: gabungan checked, extension, issues', () => {
    const result = runImportGate([
      ent(1, ROOT, 'HEAD'),
      ent(2, ROOT, 'INDI'),
      ent(3, INDI, 'NAME'),
      ent(4, INDI, '_X'),
      ent(5, INDI, 'MARR'),
      ent(6, ROOT, 'HEAD'),
    ]);
    expect(result.report).toEqual({
      issues: [
        {
          line: 5,
          structureUri: INDI,
          tag: 'MARR',
          reason: 'unknown_structure',
        },
        {
          line: 6,
          structureUri: HEAD_URI,
          tag: 'HEAD',
          reason: 'cardinality_violated',
        },
      ],
      extensionCount: 1,
      checkedCount: 3,
    });
    expect(result.rejects).toHaveLength(2);
  });

  it('pure: input sama dua kali panggil menghasilkan hasil identik', () => {
    const entries = [
      ent(1, ROOT, 'HEAD'),
      ent(2, INDI, 'NAME'),
      ent(3, ROOT, 'HEAD'),
    ];
    expect(runImportGate(entries)).toEqual(runImportGate(entries));
  });

  it('reject tidak membawa field tag (bentuk ringkas sesuai kontrak)', () => {
    const result = runImportGate([ent(2, INDI, 'MARR')]);
    expect(Object.keys(result.rejects[0]).sort()).toEqual([
      'line',
      'reason',
      'structureUri',
    ]);
  });
});
