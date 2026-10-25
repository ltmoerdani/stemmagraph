/**
 * v397 XLSX Import Fase 1: jembatan grid XLSX ke pipeline preview v386 (AC3).
 *
 * Kontrak tidak dilonggarkan: header baris pertama wajib identik
 * dengan CSV_TEMPLATE_HEADER (10 kolom, urutan sama). Setiap sel
 * tanggal dari serial Excel dikonversi excelSerialToIsoDate; sel
 * string tetap lewat validasi ISO v386. Grid dinormalisasi jadi
 * array baris CSV-equivalent lalu diteruskan ke previewCsvImport
 * sehingga draft valid, baris invalid, nomor baris, dan alasan
 * identik dengan import CSV. Tidak ada data loss diam-diam.
 */
import { previewCsvImport, type CsvImportPreview } from '../importcsv/validateCsv';
import { excelSerialToIsoDate } from './date';
import { openXlsxFirstSheet, type XlsxSheet } from './openXlsx';

/** Indices of the two date columns in the fixed 10-column template. */
const DATE_COLUMN_INDICES = [4, 5] as const;

/** Serial numbers below 1 are dates only when the cell is numeric-looking. */
function isNumericLike(text: string): boolean {
  return /^-?\d+(\.\d+)?$/.test(text.trim());
}

/** Converts serial-looking date cells to ISO so the v386 validator accepts them. */
export function normalizeXlsxGrid(sheet: XlsxSheet): string[][] {
  return sheet.rows.map((row, rowIdx) =>
    row.map((cell, colIdx) => {
      const text = cell.trim();
      if (rowIdx === 0) return text; // header row stays literal
      if (!DATE_COLUMN_INDICES.includes(colIdx as 4 | 5)) return text;
      if (text === '') return text;
      if (!isNumericLike(text)) return text; // string dates: validated by v386
      const serial = Number.parseFloat(text);
      const iso = excelSerialToIsoDate(serial);
      return iso ?? text; // invalid serial falls through to v386 honest rejection
    }),
  );
}

/** Builds the CSV-equivalent payload and previews it via the v386 pipeline. */
export function previewXlsxImport(buffer: Uint8Array): CsvImportPreview {
  const sheet = openXlsxFirstSheet(buffer);
  const grid = normalizeXlsxGrid(sheet);
  const csvLike = grid
    .map((row) => row.map((cell) => (cell.includes('"') || cell.includes(',') ? `"${cell.replace(/"/g, '""')}"` : cell)).join(','))
    .join('\n');
  return previewCsvImport(csvLike);
}
