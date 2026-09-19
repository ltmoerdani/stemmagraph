import { describe, expect, it } from 'vitest';
import { runSchemaGate, type SchemaGateEntry } from './schema-gate';

const ROOT = '';
const INDI = 'https://gedcom.io/terms/v7/record-INDI';
const HEAD_URI = 'https://gedcom.io/terms/v7/HEAD';
const SEX_URI = 'https://gedcom.io/terms/v7/SEX';

function ent(line: number, superstructureUri: string, tag: string): SchemaGateEntry {
  return { line, superstructureUri, tag };
}

describe('schema-gate', () => {
  it('runSchemaGate([]) mengembalikan report kosong', () => {
    expect(runSchemaGate([])).toEqual({
      issues: [],
      extensionCount: 0,
      checkedCount: 0,
    });
  });

  it('struktur legal INDI NAME menaikkan checkedCount tanpa issue', () => {
    const report = runSchemaGate([ent(1, INDI, 'NAME'), ent(4, INDI, 'NAME')]);
    expect(report.issues).toEqual([]);
    expect(report.checkedCount).toBe(2);
  });

  it('struktur unknown menghasilkan issue unknown_structure dengan URI induk', () => {
    const report = runSchemaGate([ent(7, INDI, 'MARR')]);
    expect(report.issues).toHaveLength(1);
    expect(report.issues[0]).toEqual({
      line: 7,
      structureUri: INDI,
      tag: 'MARR',
      reason: 'unknown_structure',
    });
    expect(report.checkedCount).toBe(0);
  });

  it('kardinalitas {1:1} dilanggar: issue di kemunculan kedua', () => {
    const report = runSchemaGate([ent(1, ROOT, 'HEAD'), ent(2, ROOT, 'HEAD')]);
    expect(report.issues).toHaveLength(1);
    expect(report.issues[0]).toEqual({
      line: 2,
      structureUri: HEAD_URI,
      tag: 'HEAD',
      reason: 'cardinality_violated',
    });
    expect(report.checkedCount).toBe(1);
  });

  it('kardinalitas {1:1} pas: HEAD sekali di root nihil issue', () => {
    const report = runSchemaGate([ent(1, ROOT, 'HEAD')]);
    expect(report.issues).toEqual([]);
    expect(report.checkedCount).toBe(1);
    expect(report.extensionCount).toBe(0);
  });

  it('tag underscore dihitung extension tanpa issue', () => {
    const report = runSchemaGate([ent(3, INDI, '_EXT')]);
    expect(report.issues).toEqual([]);
    expect(report.extensionCount).toBe(1);
    expect(report.checkedCount).toBe(0);
  });

  it('baris issue menunjuk kemunculan yang melewati batas', () => {
    const report = runSchemaGate([
      ent(4, INDI, 'SEX'),
      ent(8, INDI, 'SEX'),
      ent(15, INDI, 'SEX'),
    ]);
    expect(report.issues).toHaveLength(1);
    expect(report.issues[0]?.line).toBe(8);
    expect(report.issues[0]?.reason).toBe('cardinality_violated');
    expect(report.issues[0]?.structureUri).toBe(SEX_URI);
  });

  it('superstructure kosong berarti root dokumen untuk HEAD {1:1}', () => {
    const rootDokumen = runSchemaGate([ent(1, ROOT, 'HEAD')]);
    expect(rootDokumen.issues).toEqual([]);
    expect(rootDokumen.checkedCount).toBe(1);

    // HEAD di bawah induk lain tidak dikenal tabel.
    const salahInduk = runSchemaGate([ent(9, INDI, 'HEAD')]);
    expect(salahInduk.issues).toHaveLength(1);
    expect(salahInduk.issues[0]?.reason).toBe('unknown_structure');
    expect(salahInduk.issues[0]?.structureUri).toBe(INDI);
  });
});
