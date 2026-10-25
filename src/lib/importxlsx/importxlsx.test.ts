/**
 * v397 XLSX Import Fase 1: test suite (AC5).
 * Fixture .xlsx dibangun deterministik via fflate zipSync, nihil file
 * binari di repo. Kasus mencakup: konversi serial tanggal (termasuk
 * serial 60 fiktif), parser XML mini, pembuka XLSX (sharedStrings,
 * inlineStr, angka, multi-sheet, namespace, tanpa rels, bukan zip),
 * dan end-to-end previewXlsxImport (header salah, baris invalid,
 * sel kosong) identik dengan kontrak pipeline v386.
 */
import { describe, it, expect } from 'vitest';
import { excelSerialToIsoDate } from './date';
import { colRefToIndex, openXlsxFirstSheet, XlsxReadError } from './openXlsx';
import { decodeXmlEntities, localName, parseMiniXml } from './xml';
import { normalizeXlsxGrid, previewXlsxImport } from './previewXlsx';
import { buildXlsx, type FixtureCell } from './fixture';

const HEADER: FixtureCell[] = [
  { ref: 'A1', value: 'name' },
  { ref: 'B1', value: 'nickname' },
  { ref: 'C1', value: 'marga' },
  { ref: 'D1', value: 'gender' },
  { ref: 'E1', value: 'birthDate' },
  { ref: 'F1', value: 'deathDate' },
  { ref: 'G1', value: 'birthPlace' },
  { ref: 'H1', value: 'isAlive' },
  { ref: 'I1', value: 'generation' },
  { ref: 'J1', value: 'maritalStatus' },
];

function row2(cells: FixtureCell[]): FixtureCell[] {
  return [...HEADER, ...cells];
}

describe('v397 excelSerialToIsoDate (AC2)', () => {
  it('serial 1 sampai 59 memakai anchor 1899-12-31', () => {
    expect(excelSerialToIsoDate(1)).toBe('1900-01-01');
    expect(excelSerialToIsoDate(59)).toBe('1900-02-28');
  });

  it('serial 60 fiktif 1900-02-29 ditolak null', () => {
    expect(excelSerialToIsoDate(60)).toBeNull();
  });

  it('serial 61 ke atas memakai anchor 1899-12-30 melompati hari fiktif', () => {
    expect(excelSerialToIsoDate(61)).toBe('1900-03-01');
    // serial 44197 dikenal sebagai 2021-01-01 di Excel modern
    expect(excelSerialToIsoDate(44197)).toBe('2021-01-01');
  });

  it('input tidak sah: non-finite, nol, negatif', () => {
    expect(excelSerialToIsoDate(0)).toBeNull();
    expect(excelSerialToIsoDate(-5)).toBeNull();
    expect(excelSerialToIsoDate(Number.NaN)).toBeNull();
    expect(excelSerialToIsoDate(Number.POSITIVE_INFINITY)).toBeNull();
  });

  it('pecahan waktu dibuang via floor tanpa mengubah tanggal', () => {
    expect(excelSerialToIsoDate(44197.5)).toBe('2021-01-01');
  });
});

describe('v397 parser XML mini (AC1)', () => {
  it('decode entity bernama dan numerik', () => {
    expect(decodeXmlEntities('A &amp; B &lt;C&gt; &quot;D&quot; &apos;E&#65;')).toBe('A & B <C> "D" \'EA');
  });

  it('localName membuang prefix namespace', () => {
    expect(localName('x:worksheet')).toBe('worksheet');
    expect(localName('row')).toBe('row');
  });

  it('tag sarang, self-closing simetris, komentar dan declaration dilewati', () => {
    const seen: string[] = [];
    parseMiniXml(
      '<?xml version="1.0"?><!-- note --><root a="1" b=\'dua\'><leaf/><leaf>teks</leaf></root>',
      {
        onStartTag: (n) => seen.push(`open:${n}`),
        onEndTag: (n) => seen.push(`close:${n}`),
        onText: (t) => {
          if (t.trim() !== '') seen.push(`text:${t}`);
        },
      },
    );
    expect(seen).toEqual([
      'open:root',
      'open:leaf',
      'close:leaf',
      'open:leaf',
      'text:teks',
      'close:leaf',
      'close:root',
    ]);
  });

  it('markup terpotong melempar error jujur', () => {
    expect(() =>
      parseMiniXml('<a><b></a>', { onStartTag() {}, onEndTag() {}, onText() {} }),
    ).toThrow();
  });
});

describe('v397 colRefToIndex', () => {
  it('decode huruf kolom Excel', () => {
    expect(colRefToIndex('A')).toBe(0);
    expect(colRefToIndex('Z')).toBe(25);
    expect(colRefToIndex('AA')).toBe(26);
    expect(colRefToIndex('AJ')).toBe(35);
  });
});

describe('v397 openXlsxFirstSheet (AC1)', () => {
  it('sharedStrings, inlineStr, dan angka terbaca pada grid rapat', () => {
    const cells = row2([
      { ref: 'A2', kind: 'shared', value: 'Andi' },
      { ref: 'D2', value: 'M' },
      { ref: 'E2', kind: 'number', value: '44197' },
      { ref: 'H2', value: 'true' },
    ]);
    const sheet = openXlsxFirstSheet(buildXlsx(cells, 2, { includeSharedStrings: true }));
    expect(sheet.name).toBe('Data');
    expect(sheet.rows[1][0]).toBe('Andi');
    expect(sheet.rows[1][3]).toBe('M');
    expect(sheet.rows[1][4]).toBe('44197');
    expect(sheet.rows[1][7]).toBe('true');
    // sel kosong B2, C2, F2, G2, I2, J2 jadi string kosong, bukan undefined
    expect(sheet.rows[1][1]).toBe('');
    expect(sheet.rows[1][5]).toBe('');
  });

  it('inline string dengan entity ter-decode', () => {
    const cells = row2([{ ref: 'A2', kind: 'inline', value: 'Situmorang & Sons <Toba>' }]);
    const sheet = openXlsxFirstSheet(buildXlsx(cells, 2, { includeSharedStrings: false }));
    expect(sheet.rows[1][0]).toBe('Situmorang & Sons <Toba>');
  });

  it('multi-sheet: sheet pertama yang diambil', () => {
    const cells = row2([{ ref: 'A2', value: 'X' }]);
    const sheet = openXlsxFirstSheet(buildXlsx(cells, 2, { extraSheets: ['Lain'] }));
    expect(sheet.name).toBe('Data');
  });

  it('toleransi prefix namespace x:', () => {
    const cells = row2([{ ref: 'A2', kind: 'shared', value: 'Nala' }]);
    const sheet = openXlsxFirstSheet(
      buildXlsx(cells, 2, { namespaced: true, includeSharedStrings: true }),
    );
    expect(sheet.rows[1][0]).toBe('Nala');
  });

  it('bukan zip sah melempar XlsxReadError', () => {
    const bogus = new Uint8Array([1, 2, 3, 4, 5]);
    expect(() => openXlsxFirstSheet(bogus)).toThrow(XlsxReadError);
  });

  it('zip tanpa workbook.xml melempar XlsxReadError', () => {
    const { zipSync, strToU8 } = require('fflate') as typeof import('fflate');
    const noWb = zipSync({ 'readme.txt': strToU8('bukan xlsx') });
    expect(() => openXlsxFirstSheet(noWb)).toThrow(XlsxReadError);
    void noWb;
  });
});

describe('v397 normalizeXlsxGrid (AC3)', () => {
  it('serial di kolom tanggal dikonversi, header tetap literal', () => {
    const grid = [
      ['name', 'nickname', 'marga', 'gender', 'birthDate', 'deathDate', 'birthPlace', 'isAlive', 'generation', 'maritalStatus'],
      ['Budi', '', '', 'M', '44197', '', '', 'true', '', ''],
      ['Sari', '', '', 'F', '1900-02-29', '', '', 'true', '', ''],
    ];
    const out = normalizeXlsxGrid({ name: 'Data', rows: grid });
    expect(out[0][4]).toBe('birthDate');
    expect(out[1][4]).toBe('2021-01-01');
    // serial 60 palsu: string asli diteruskan, nanti ditolak validasi v386
    expect(out[2][4]).toBe('1900-02-29');
  });

  it('string tanggal non-serial diteruskan apa adanya', () => {
    const out = normalizeXlsxGrid({
      name: 'Data',
      rows: [
        ['name', 'nickname', 'marga', 'gender', 'birthDate', 'deathDate', 'birthPlace', 'isAlive', 'generation', 'maritalStatus'],
        ['Budi', '', '', 'M', '1980-05-12', '', '', 'true', '', ''],
      ],
    });
    expect(out[1][4]).toBe('1980-05-12');
  });
});

describe('v397 previewXlsxImport end-to-end (AC3/AC5)', () => {
  it('baris valid jadi CsvMemberDraft lengkap dengan serial tanggal', () => {
    const cells = row2([
      { ref: 'A2', kind: 'shared', value: 'Andi Situmorang' },
      { ref: 'D2', value: 'M' },
      { ref: 'E2', kind: 'number', value: '44197' },
      { ref: 'H2', value: 'true' },
    ]);
    const preview = previewXlsxImport(buildXlsx(cells, 2, { includeSharedStrings: true }));
    expect(preview.valid).toHaveLength(1);
    expect(preview.valid[0].name).toBe('Andi Situmorang');
    expect(preview.valid[0].birthDate).toBe('2021-01-01');
    expect(preview.invalid).toHaveLength(0);
  });

  it('header salah ditolak seluruhnya sesuai kontrak v386', () => {
    const cells: FixtureCell[] = [
      { ref: 'A1', value: 'nama' },
      { ref: 'A2', value: 'Andi' },
    ];
    const preview = previewXlsxImport(buildXlsx(cells, 2, {}));
    expect(preview.valid).toHaveLength(0);
    expect(preview.invalid.length).toBeGreaterThan(0);
  });

  it('baris invalid (gender asing) masuk daftar penolakan dengan nomor baris', () => {
    const cells = row2([
      { ref: 'A2', value: 'Budi' },
      { ref: 'D2', value: 'Z' },
      { ref: 'E2', value: '1980-05-12' },
      { ref: 'H2', value: 'true' },
    ]);
    const preview = previewXlsxImport(buildXlsx(cells, 2, {}));
    expect(preview.valid).toHaveLength(0);
    // kontrak v386: nomor baris dihitung atas baris data, baris data pertama = 1
    expect(preview.invalid[0].row).toBe(1);
  });

  it('sel tanggal kosong diterima sebagai optional sesuai v386', () => {
    const cells = row2([
      { ref: 'A2', value: 'Citra' },
      { ref: 'D2', value: 'F' },
      { ref: 'H2', value: 'true' },
    ]);
    const preview = previewXlsxImport(buildXlsx(cells, 2, {}));
    expect(preview.valid).toHaveLength(1);
    expect(preview.valid[0].birthDate).toBe('');
  });
});
