/**
 * v397 XLSX Import Fase 1: builder fixture .xlsx deterministik (AC5).
 * Membangun arsip XLSX nyata via fflate zipSync sehingga test tidak
 * menyimpan file binari di repo. Parameter memungkinkan kasus
 * sharedStrings, inlineStr, angka serial, multi-sheet, namespace,
 * dan workbook tanpa rels.
 */
import { zipSync, strToU8 } from 'fflate';

export interface FixtureCell {
  ref: string;
  kind?: 'shared' | 'inline' | 'number';
  /** For shared: index; inline: text; number: raw numeric text. */
  value: string;
}

export interface FixtureOptions {
  sheetName?: string;
  /** Extra sheet names beyond the first (multi-sheet case). */
  extraSheets?: string[];
  /** Wrap tags with an x: namespace prefix (tolerance case). */
  namespaced?: boolean;
  /** Omit workbook.xml.rels and name the part sheet1.xml directly. */
  noRels?: boolean;
  includeSharedStrings?: boolean;
}

function xmlEscape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function buildXlsx(cells: FixtureCell[], rowsCount: number, opts: FixtureOptions = {}): Uint8Array {
  const ns = opts.namespaced === true ? 'x:' : '';
  const shared = opts.includeSharedStrings === true ? cells.filter((c) => c.kind === 'shared').map((c) => c.value) : [];
  const sharedIdx = new Map<string, number>();
  if (opts.includeSharedStrings === true) {
    cells.filter((c) => c.kind === 'shared').forEach((c, i) => sharedIdx.set(c.value, i));
  }
  const byRow = new Map<number, FixtureCell[]>();
  cells.forEach((c) => {
    const m = /^(\d+)$/.exec(c.ref.replace(/^[A-Z]+/, ''));
    const r = m === null ? 1 : Number.parseInt(m[1], 10);
    if (!byRow.has(r)) byRow.set(r, []);
    byRow.get(r)!.push(c);
  });
  const rowXml = (sheetTagPrefix: string) =>
    Array.from(byRow.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([r, list]) => {
        const cs = list
          .map((c) => {
            const col = c.ref.replace(/\d+$/, '');
            if (c.kind === 'inline') {
              return `<${sheetTagPrefix}c r="${c.ref}" t="inlineStr"><is><t>${xmlEscape(c.value)}</t></is></${sheetTagPrefix}c>`;
            }
            if (c.kind === 'shared') {
              const i = sharedIdx.get(c.value) ?? 0;
              return `<${sheetTagPrefix}c r="${c.ref}" t="s"><v>${i}</v></${sheetTagPrefix}c>`;
            }
            return `<${sheetTagPrefix}c r="${c.ref}"><v>${xmlEscape(c.value)}</v></${sheetTagPrefix}c>`;
          })
          .join('');
        return `<${sheetTagPrefix}row r="${r}">${cs}</${sheetTagPrefix}row>`;
      })
      .join('');
  const worksheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><${ns}worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><${ns}sheetData>${rowXml(ns)}</${ns}sheetData></${ns}worksheet>`;
  const sheets = [opts.sheetName ?? 'Data', ...(opts.extraSheets ?? [])];
  const wbSheets = sheets
    .map((nm, i) => `<${ns}sheet name="${nm}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
    .join('');
  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><${ns}workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">${wbSheets}</${ns}workbook>`;
  const rels = sheets
    .map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`)
    .join('');
  const relsDoc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels}</Relationships>`;
  const ssXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><${ns}sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${shared.length}" uniqueCount="${shared.length}">${shared.map((s, i) => `<${ns}si><${ns}t>${xmlEscape(s)}</${ns}t></${ns}si>`).join('')}</${ns}sst>`;
  const files: Record<string, Uint8Array> = {
    'xl/workbook.xml': strToU8(workbook),
    'xl/_rels/workbook.xml.rels': strToU8(relsDoc),
    'xl/worksheets/sheet1.xml': strToU8(worksheet),
  };
  sheets.slice(1).forEach((_, i) => {
    files[`xl/worksheets/sheet${i + 2}.xml`] = strToU8(worksheet);
  });
  if (opts.noRels === true) delete files['xl/_rels/workbook.xml.rels'];
  if (opts.includeSharedStrings === true) files['xl/sharedStrings.xml'] = strToU8(ssXml);
  return zipSync(files);
}
