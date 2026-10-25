/**
 * v397 XLSX Import Fase 1: pembuka file .xlsx murni lokal (AC1).
 *
 * XLSX adalah zip berisi XML. Buffer dibuka via fflate unzipSync
 * (dependency existing, tanpa dependency baru). Hanya tiga part
 * dibaca: xl/workbook.xml (daftar sheet, ambil sheet pertama yang
 * terdaftar), xl/_rels/workbook.xml.rels (pemetaan r:id ke target
 * part), dan part worksheet-nya ditambah xl/sharedStrings.xml bila
 * ada. Sel dibaca dengan parser mini parseMiniXml: t="s" merujuk
 * sharedStrings, t="inlineStr" memuat teks langsung, sel tanpa t
 * dianggap angka atau string mentah. Sel kosong dilewati. Formula
 * tidak dievaluasi: nilai cached <v> dipakai apa adanya bila ada.
 * Kolom di-decode dari atribut ref (A1, AA7) menjadi indeks 0-based
 * sehingga grid rapat kolom-nya konsisten dengan baris CSV.
 */
import { unzipSync, strFromU8 } from 'fflate';
import { localName, parseMiniXml } from './xml';

/** One parsed worksheet as a rectangular-by-row grid of raw cell texts. */
export interface XlsxSheet {
  name: string;
  /** rows[r][c] with c 0-based from the cell ref; empty cells are empty strings. */
  rows: string[][];
}

/** Error thrown when the file is not a readable XLSX within phase-1 scope. */
export class XlsxReadError extends Error {}

/** Decodes a column letters run (A, Z, AA) into a 0-based column index. */
export function colRefToIndex(ref: string): number {
  let idx = 0;
  for (let i = 0; i < ref.length; i += 1) {
    const ch = ref.charCodeAt(i);
    if (ch < 65 || ch > 90) return -1; // not A-Z
    idx = idx * 26 + (ch - 64);
  }
  return idx - 1;
}

interface CellValue {
  col: number;
  text: string;
}

/** Reads a worksheet XML string into rows using the shared strings table. */
function parseWorksheet(xml: string, shared: string[]): CellValue[][] {
  const rows: CellValue[][] = [];
  let curRow: CellValue[] | null = null;
  let curCell: { col: number; kind: 's' | 'inline' | 'raw'; parts: string[] } | null = null;

  const finishCell = () => {
    if (curCell === null || curRow === null) return;
    const raw = curCell.parts.join('');
    let text: string;
    if (curCell.kind === 's') {
      const n = Number.parseInt(raw, 10);
      text = Number.isNaN(n) ? '' : (shared[n] ?? '');
    } else {
      text = raw;
    }
    if (text.length > 0) curRow.push({ col: curCell.col, text });
    curCell = null;
  };

  parseMiniXml(xml, {
    onStartTag(name, attrs) {
      const tag = localName(name);
      if (tag === 'row') {
        finishCell();
        curRow = [];
        rows.push(curRow);
      } else if (tag === 'c' && curRow !== null) {
        finishCell();
        const ref = attrs.r ?? '';
        let col = -1;
        for (let i = 0; i < ref.length; i += 1) {
          const ch = ref[i];
          if (ch >= 'A' && ch <= 'Z') {
            col = colRefToIndex(ref.slice(0, i + 1));
            break;
          }
        }
        if (col === -1) col = curRow.length;
        const t = attrs.t ?? '';
        curCell = { col, kind: t === 's' ? 's' : t === 'inlineStr' ? 'inline' : 'raw', parts: [] };
      } else if (tag === 'is' && curCell !== null && curCell.kind === 'inline') {
        // inline string container, text arrives via onText
      } else if ((tag === 'v' || tag === 't') && curCell !== null) {
        // value container, text arrives via onText
      }
    },
    onText(text) {
      if (curCell !== null) curCell.parts.push(text);
    },
    onEndTag(name) {
      const tag = localName(name);
      if (tag === 'c') finishCell();
      else if (tag === 'row') {
        finishCell();
        curRow = null;
      }
    },
  });
  finishCell();
  return rows;
}

/** Reads the shared strings table into an array of strings. */
function parseSharedStrings(xml: string): string[] {
  const out: string[] = [];
  let cur: string[] | null = null;
  parseMiniXml(xml, {
    onStartTag(name) {
      if (localName(name) === 'si') cur = [];
    },
    onText(text) {
      if (cur !== null) cur.push(text);
    },
    onEndTag(name) {
      const tag = localName(name);
      if (tag === 'si' && cur !== null) {
        out.push(cur.join(''));
        cur = null;
      } else if (tag === 't' && cur !== null) {
        // text already collected via onText
      }
    },
  });
  return out;
}

interface SheetRef {
  name: string;
  rid: string;
}

/** Reads workbook.xml for the first sheet name and its relationship id. */
function parseWorkbook(xml: string): SheetRef {
  let first: SheetRef | null = null;
  parseMiniXml(xml, {
    onStartTag(name, attrs) {
      if (localName(name) === 'sheet' && first === null) {
        first = { name: attrs.name ?? 'Sheet1', rid: attrs['r:id'] ?? attrs.id ?? '' };
      }
    },
    onText() {},
    onEndTag() {},
  });
  if (first === null) throw new XlsxReadError('workbook.xml tanpa sheet');
  return first;
}

/** Reads workbook.xml.rels mapping rId to the worksheet part path. */
function parseWorkbookRels(xml: string, rid: string): string {
  let target: string | null = null;
  parseMiniXml(xml, {
    onStartTag(name, attrs) {
      if (localName(name) === 'Relationship' && attrs.Id === rid) {
        target = attrs.Target ?? '';
      }
    },
    onText() {},
    onEndTag() {},
  });
  if (target === null) throw new XlsxReadError(`relasi ${rid} tidak ditemukan`);
  // Relative targets are against xl/; strip a leading slash or ../xl/ noise.
  let t = target.replace(/^\//, '');
  if (!t.startsWith('xl/')) t = `xl/${t}`;
  return t;
}

/** Opens an XLSX buffer and returns the first sheet as a text grid. */
export function openXlsxFirstSheet(buffer: Uint8Array): XlsxSheet {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(buffer);
  } catch {
    throw new XlsxReadError('bukan arsip zip yang sah');
  }
  const wbKey = Object.keys(files).find((k) => k === 'xl/workbook.xml');
  if (wbKey === undefined) throw new XlsxReadError('workbook.xml tidak ditemukan');
  const sheet = parseWorkbook(strFromU8(files[wbKey]));
  const relsKey = Object.keys(files).find((k) => k === 'xl/_rels/workbook.xml.rels');
  let partPath = `xl/worksheets/sheet1.xml`;
  if (sheet.rid !== '' && relsKey !== undefined) {
    partPath = parseWorkbookRels(strFromU8(files[relsKey]), sheet.rid);
  }
  const part = files[partPath];
  if (part === undefined) throw new XlsxReadError(`part worksheet ${partPath} tidak ditemukan`);
  const ssKey = Object.keys(files).find((k) => k === 'xl/sharedStrings.xml');
  const shared = ssKey === undefined ? [] : parseSharedStrings(strFromU8(files[ssKey]));
  const parsed = parseWorksheet(strFromU8(part), shared);
  const maxCol = parsed.reduce((m, row) => Math.max(m, ...row.map((c) => c.col + 1)), 0);
  const grid = parsed.map((row) => {
    const out: string[] = new Array(maxCol).fill('');
    for (const cell of row) out[cell.col] = cell.text;
    return out;
  });
  return { name: sheet.name, rows: grid };
}
