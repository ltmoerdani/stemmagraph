/**
 * v386 Import CSV Anggota Fase 1: validator + normalizer pure.
 *
 * Header tetap (fixed template): name, nickname, marga, gender,
 * birthDate, deathDate, birthPlace, isAlive, generation, maritalStatus.
 * Setiap baris data dinilai: valid jadi draft member, invalid masuk
 * daftar penolakan dengan nomor baris dan alasan. Tidak ada data loss
 * diam-diam: baris valid tidak pernah dibuang tanpa laporan.
 */
import { parseCsv } from './parseCsv';

/** Fixed CSV template header, also the contract for input files. */
export const CSV_TEMPLATE_HEADER = [
  'name',
  'nickname',
  'marga',
  'gender',
  'birthDate',
  'deathDate',
  'birthPlace',
  'isAlive',
  'generation',
  'maritalStatus',
] as const;

/** Gender values accepted in CSV (case-insensitive). */
export const CSV_GENDER_VALUES = ['M', 'F', 'X', 'U'] as const;

/** maritalStatus values accepted in CSV (case-insensitive). */
export const CSV_MARITAL_VALUES = [
  'single',
  'married',
  'divorced',
  'widowed',
] as const;

/** A validated draft member, ready for adapter.createMember. */
export interface CsvMemberDraft {
  name: string;
  nickname?: string;
  marga?: string;
  gender: 'male' | 'female' | 'other';
  birthDate: string;
  deathDate?: string;
  birthPlace?: string;
  isAlive: boolean;
  generation?: number;
  maritalStatus?: 'single' | 'married' | 'divorced' | 'widowed';
}

/** One rejected row with its 1-based data row number and reason. */
export interface CsvInvalidRow {
  row: number;
  reason: string;
}

/** Result of validating a CSV payload against the fixed template. */
export interface CsvImportPreview {
  valid: CsvMemberDraft[];
  invalid: CsvInvalidRow[];
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Validates a YYYY-MM-DD string as a real calendar date. */
export function isValidIsoDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  if (m < 1 || m > 12) return false;
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return d >= 1 && d <= daysInMonth;
}

/** Maps CSV gender M/F/X/U to adapter gender enum; empty or U maps to other. */
export function mapGenderFromCsv(
  raw: string | undefined
): 'male' | 'female' | 'other' {
  switch ((raw ?? '').trim().toUpperCase()) {
    case 'M':
      return 'male';
    case 'F':
      return 'female';
    case 'X':
    case 'U':
    default:
      return 'other';
  }
}

/** Maps the CSV isAlive column to boolean; empty defaults to true. */
export function mapIsAliveFromCsv(raw: string | undefined): boolean {
  const v = (raw ?? '').trim().toLowerCase();
  if (v === '') return true;
  return v === 'true' || v === '1' || v === 'yes' || v === 'ya';
}

/** Returns true only for values the isAlive column accepts explicitly. */
function isExplicitAliveValue(raw: string): boolean {
  const v = raw.trim().toLowerCase();
  return (
    v === '' ||
    v === 'true' ||
    v === '1' ||
    v === 'yes' ||
    v === 'ya' ||
    v === 'false' ||
    v === '0' ||
    v === 'no' ||
    v === 'tidak'
  );
}

/** Optional string cell: trimmed, undefined when empty. */
function opt(raw: string | undefined): string | undefined {
  const v = (raw ?? '').trim();
  return v === '' ? undefined : v;
}

/**
 * Validates parsed CSV rows (header row included) into a preview.
 * Row numbers in invalid entries are 1-based data rows (header is
 * row 0 and not reported). Unknown header columns are rejected up
 * front so typos never produce silently ignored data.
 */
export function previewCsvImport(input: string): CsvImportPreview {
  const rows = parseCsv(input);
  const valid: CsvMemberDraft[] = [];
  const invalid: CsvInvalidRow[] = [];

  if (rows.length === 0) {
    return { valid, invalid: [{ row: 1, reason: 'empty: no header row' }] };
  }

  const header = rows[0].map((h) => h.trim());
  const expected = CSV_TEMPLATE_HEADER as readonly string[];
  const headerMatches =
    header.length === expected.length &&
    expected.every((col, i) => header[i] === col);
  if (!headerMatches) {
    return {
      valid,
      invalid: [
        {
          row: 1,
          reason:
            'header mismatch: expected ' + expected.join(',') + ' got ' + header.join(','),
        },
      ],
    };
  }

  for (let i = 1; i < rows.length; i += 1) {
    const cells = rows[i];
    const dataRow = i; // header is row 0; first data row is 1
    if (cells.length > expected.length) {
      invalid.push({
        row: dataRow,
        reason:
          'row has ' + cells.length + ' columns, expected ' + expected.length,
      });
      continue;
    }
    const get = (col: (typeof CSV_TEMPLATE_HEADER)[number]): string => {
      const idx = expected.indexOf(col);
      return (cells[idx] ?? '').trim();
    };

    const name = get('name');
    if (name === '') {
      invalid.push({ row: dataRow, reason: 'name is required' });
      continue;
    }

    const genderRaw = get('gender').toUpperCase();
    if (genderRaw !== '' && !(CSV_GENDER_VALUES as readonly string[]).includes(genderRaw)) {
      invalid.push({
        row: dataRow,
        reason: 'gender must be one of M, F, X, U or empty, got: ' + get('gender'),
      });
      continue;
    }

    const birthDate = get('birthDate');
    if (birthDate !== '' && !isValidIsoDate(birthDate)) {
      invalid.push({
        row: dataRow,
        reason: 'birthDate must be YYYY-MM-DD or empty, got: ' + birthDate,
      });
      continue;
    }
    const deathDate = get('deathDate');
    if (deathDate !== '' && !isValidIsoDate(deathDate)) {
      invalid.push({
        row: dataRow,
        reason: 'deathDate must be YYYY-MM-DD or empty, got: ' + deathDate,
      });
      continue;
    }

    const isAliveRaw = get('isAlive');
    if (!isExplicitAliveValue(isAliveRaw)) {
      invalid.push({
        row: dataRow,
        reason: 'isAlive must be true or false (or empty), got: ' + isAliveRaw,
      });
      continue;
    }

    const generationRaw = get('generation');
    let generation: number | undefined;
    if (generationRaw !== '') {
      const n = Number(generationRaw);
      if (!Number.isInteger(n) || n < 1) {
        invalid.push({
          row: dataRow,
          reason: 'generation must be a positive integer or empty, got: ' + generationRaw,
        });
        continue;
      }
      generation = n;
    }

    const maritalRaw = get('maritalStatus').toLowerCase();
    let maritalStatus: CsvMemberDraft['maritalStatus'];
    if (maritalRaw !== '') {
      if (!(CSV_MARITAL_VALUES as readonly string[]).includes(maritalRaw)) {
        invalid.push({
          row: dataRow,
          reason:
            'maritalStatus must be single, married, divorced, widowed or empty, got: ' +
            get('maritalStatus'),
        });
        continue;
      }
      maritalStatus = maritalRaw as CsvMemberDraft['maritalStatus'];
    }

    const draft: CsvMemberDraft = {
      name,
      nickname: opt(get('nickname')),
      marga: opt(get('marga')),
      gender: mapGenderFromCsv(get('gender')),
      birthDate,
      deathDate: opt(get('deathDate')),
      birthPlace: opt(get('birthPlace')),
      isAlive: mapIsAliveFromCsv(get('isAlive')),
      generation,
      maritalStatus,
    };
    valid.push(draft);
  }

  return { valid, invalid };
}

/**
 * Builds the downloadable CSV template: fixed header + two example
 * rows (a father and his child) so users see the expected shape.
 */
export function generateCsvTemplate(): string {
  const lines: string[] = [(CSV_TEMPLATE_HEADER as readonly string[]).join(',')];
  lines.push(
    'Budi Santoso,Bud,,M,1970-05-12,,Bandung,true,1,married',
    'Ani Santoso,,Santoso,F,1998-08-03,,Bandung,true,2,single'
  );
  return lines.join('\r\n') + '\r\n';
}
