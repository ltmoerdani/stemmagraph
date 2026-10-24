/**
 * v386 Import CSV Anggota Fase 1: parser RFC 4180 pure.
 *
 * Mendukung: pemisah koma, quote ganda, escape "" di dalam quoted
 * field, CRLF dan LF (dan CR tunggal) sebagai akhir baris, dan strip
 * BOM UTF-8 di awal input. Baris kosong penuh dilewati. Tanpa
 * dependency; string masuk, string[][] keluar.
 */

/** Strips a UTF-8 BOM from the start of the text, if present. */
export function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/**
 * Parses one CSV record per RFC 4180 (lenient). State machine: start,
 * unquoted, quoted, quoteInQuoted. A quote inside a quoted field must
 * be doubled; a lone quote mid-field is kept verbatim (common in
 * hand-edited files). Blank lines (no content since last record end)
 * are skipped, matching the import validator's row-skipping contract.
 */
export function parseCsv(input: string): string[][] {
  const text = stripBom(input);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let state: 'start' | 'unquoted' | 'quoted' | 'quoteInQuoted' = 'start';
  let hasContent = false;
  let pendingLf = false; // previous char was CR inside a CRLF pair

  const pushField = () => {
    row.push(field);
    field = '';
  };
  const pushRow = () => {
    pushField();
    rows.push(row);
    row = [];
  };
  /** Ends the current record; blank records are dropped, not emitted. */
  const endRecord = () => {
    if (hasContent) {
      pushRow();
    } else {
      row = [];
      field = '';
    }
    hasContent = false;
    state = 'start';
  };

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (pendingLf) {
      pendingLf = false;
      if (ch === '\n') {
        continue; // CRLF consumed as one separator
      }
    }
    if (ch === '\r' || ch === '\n') {
      if (state === 'quoted') {
        field += ch; // newline inside quotes is data
      } else {
        if (ch === '\r') pendingLf = true;
        endRecord();
      }
      continue;
    }
    hasContent = true;
    if (state === 'start') {
      if (ch === '"') {
        state = 'quoted';
      } else if (ch === ',') {
        pushField();
      } else {
        field += ch;
        state = 'unquoted';
      }
    } else if (state === 'unquoted') {
      if (ch === ',') {
        pushField();
        state = 'start';
      } else {
        field += ch;
      }
    } else if (state === 'quoted') {
      if (ch === '"') {
        state = 'quoteInQuoted';
      } else {
        field += ch;
      }
    } else {
      // quoteInQuoted: previous char was a quote inside a quoted field
      if (ch === '"') {
        field += '"'; // escaped quote ("")
        state = 'quoted';
      } else if (ch === ',') {
        pushField();
        state = 'start';
      } else {
        field += '"' + ch; // lone quote: keep verbatim
        state = 'quoted';
      }
    }
  }

  // Final record: only when the input did not end with a newline.
  if (hasContent || row.length > 0) {
    pushRow();
  }
  return rows;
}
