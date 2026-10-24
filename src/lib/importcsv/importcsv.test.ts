/**
 * Tests for v386 Import CSV Fase 1: parseCsv, previewCsvImport,
 * generateCsvTemplate. Pure modules, no DOM, no adapter.
 */
import { describe, it, expect } from 'vitest';
import { parseCsv } from './parseCsv';
import {
  previewCsvImport,
  generateCsvTemplate,
  CSV_TEMPLATE_HEADER,
  isValidIsoDate,
  mapGenderFromCsv,
  mapIsAliveFromCsv,
} from './validateCsv';

describe('parseCsv', () => {
  it('parses simple comma rows', () => {
    expect(parseCsv('a,b,c\nd,e,f')).toEqual([
      ['a', 'b', 'c'],
      ['d', 'e', 'f'],
    ]);
  });

  it('parses quoted fields containing commas', () => {
    expect(parseCsv('"Santoso, Budi",1970,X')).toEqual([
      ['Santoso, Budi', '1970', 'X'],
    ]);
  });

  it('parses escaped double quotes inside quoted fields', () => {
    expect(parseCsv('"He said ""halo""",b')).toEqual([
      ['He said "halo"', 'b'],
    ]);
  });

  it('handles CRLF line endings', () => {
    expect(parseCsv('a,b\r\nc,d\r\n')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
  });

  it('handles LF line endings', () => {
    expect(parseCsv('a,b\nc,d\n')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
  });

  it('strips UTF-8 BOM before parsing', () => {
    expect(parseCsv('\uFEFFname,gender')).toEqual([['name', 'gender']]);
  });

  it('skips blank lines entirely', () => {
    expect(parseCsv('a,b\n\n\nc,d\n')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
  });

  it('keeps newlines inside quoted fields as data', () => {
    expect(parseCsv('"line1\nline2",b')).toEqual([['line1\nline2', 'b']]);
  });

  it('parses empty trailing fields', () => {
    expect(parseCsv('a,,')).toEqual([['a', '', '']]);
  });
});

describe('previewCsvImport', () => {
  const header = CSV_TEMPLATE_HEADER.join(',');

  it('accepts the generated template as fully valid', () => {
    const preview = previewCsvImport(generateCsvTemplate());
    expect(preview.invalid).toEqual([]);
    expect(preview.valid).toHaveLength(2);
    expect(preview.valid[0]).toMatchObject({
      name: 'Budi Santoso',
      gender: 'male',
      isAlive: true,
      generation: 1,
      maritalStatus: 'married',
    });
    expect(preview.valid[1].marga).toBe('Santoso');
  });

  it('rejects a row without name', () => {
    const csv = header + '\n,,X,,,,,,,';
    const preview = previewCsvImport(csv);
    expect(preview.valid).toEqual([]);
    expect(preview.invalid).toHaveLength(1);
    expect(preview.invalid[0].row).toBe(1);
    expect(preview.invalid[0].reason).toContain('name is required');
  });

  it('rejects unknown gender values', () => {
    const csv = header + '\nBudi,,,Z,,,,,,';
    const preview = previewCsvImport(csv);
    expect(preview.valid).toEqual([]);
    expect(preview.invalid[0].reason).toContain('gender');
  });

  it('rejects malformed dates', () => {
    const csv = header + '\nBudi,,,,12/05/1970,,,,,';
    const preview = previewCsvImport(csv);
    expect(preview.valid).toEqual([]);
    expect(preview.invalid[0].reason).toContain('birthDate');
  });

  it('rejects non-boolean isAlive values', () => {
    const csv = header + '\nBudi,,,,,,,mungkin,,';
    const preview = previewCsvImport(csv);
    expect(preview.valid).toEqual([]);
    expect(preview.invalid[0].reason).toContain('isAlive');
  });

  it('rejects unknown header columns up front', () => {
    const csv = 'nama,jk\nBudi,M';
    const preview = previewCsvImport(csv);
    expect(preview.valid).toEqual([]);
    expect(preview.invalid[0].row).toBe(1);
    expect(preview.invalid[0].reason).toContain('header mismatch');
  });

  it('rejects rows with more columns than the header', () => {
    const csv = header + '\nBudi,,Z,M,1970-05-12,,Bandung,true,1,married,extra';
    const preview = previewCsvImport(csv);
    expect(preview.valid).toEqual([]);
    expect(preview.invalid[0].reason).toContain('columns');
  });

  it('reports row numbers counting data rows from 1', () => {
    const csv = header + '\nBudi,,,,,,,,,\n,,,Q,,,,,,,';
    const preview = previewCsvImport(csv);
    expect(preview.valid).toHaveLength(1);
    expect(preview.invalid[0].row).toBe(2);
  });

  it('maps empty gender and isAlive to defaults', () => {
    const csv = header + '\nBudi,,,,,,,,,';
    const preview = previewCsvImport(csv);
    expect(preview.valid[0].gender).toBe('other');
    expect(preview.valid[0].isAlive).toBe(true);
  });

  it('accepts isAlive false and keeps the member deceased', () => {
    const csv = header + '\nBudi,,,,1970-05-12,,,false,';
    const preview = previewCsvImport(csv);
    expect(preview.valid[0].isAlive).toBe(false);
  });

  it('accepts lowercase and localized true/false spellings', () => {
    const csv = header + '\nBudi,,,,,,,ya,,' + '\nAni,,,,,,,tidak,,';
    const preview = previewCsvImport(csv);
    expect(preview.valid[0].isAlive).toBe(true);
    expect(preview.valid[1].isAlive).toBe(false);
  });
});

describe('generateCsvTemplate', () => {
  it('starts with the fixed header and ends with CRLF', () => {
    const tpl = generateCsvTemplate();
    expect(tpl.startsWith(CSV_TEMPLATE_HEADER.join(','))).toBe(true);
    expect(tpl.endsWith('\r\n')).toBe(true);
  });

  it('contains exactly two example rows', () => {
    const tpl = generateCsvTemplate();
    const lines = tpl.split('\r\n').filter((l) => l !== '');
    expect(lines).toHaveLength(3);
  });
});

describe('helpers', () => {
  it('isValidIsoDate rejects impossible calendar dates', () => {
    expect(isValidIsoDate('2026-02-30')).toBe(false);
    expect(isValidIsoDate('2026-13-01')).toBe(false);
    expect(isValidIsoDate('2024-02-29')).toBe(true);
    expect(isValidIsoDate('2026-00-10')).toBe(false);
  });

  it('mapGenderFromCsv handles case and empty', () => {
    expect(mapGenderFromCsv('m')).toBe('male');
    expect(mapGenderFromCsv('F')).toBe('female');
    expect(mapGenderFromCsv('u')).toBe('other');
    expect(mapGenderFromCsv('')).toBe('other');
  });

  it('mapIsAliveFromCsv defaults empty to true', () => {
    expect(mapIsAliveFromCsv('')).toBe(true);
    expect(mapIsAliveFromCsv('false')).toBe(false);
    expect(mapIsAliveFromCsv('TRUE')).toBe(true);
  });
});
