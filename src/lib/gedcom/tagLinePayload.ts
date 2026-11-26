/**
 * Parser line-level GEDCOM untuk baris tag dengan payload opsional
 * (STG v465 unit B).
 *
 * Kontrak: baris tag TANPA payload (mis. "1 SOUR") sah dengan payload
 * kosong; grammar GEDCOM 7 menjadikan payload opsional setelah delimiter
 * tag. Spasi ekor setelah tag (mis. "1 SOUR  ") diperlakukan sebagai
 * delimiter plus payload kosong, bukan payload berisi spasi. Spasi ganda
 * di antara level dan tag diterima lenient dan dicoalesce sebagai satu
 * delimiter, tanpa error.
 *
 * Konsisten dengan modul merged sebelumnya: lineValueUnescape (unescape
 * @@ pada payload saat import) dan placePayload (payload kosong pulang
 * undefined, whitespace berlebih di-collapse). Coalesce whitespace di
 * modul ini hanya menyentuh posisi delimiter antar token; spasi di
 * dalam payload dipertahankan apa adanya.
 *
 * Baris tak bisa di-parse (kosong, tanpa level, tanpa tag) pulang null
 * tanpa melempar error; validasi keabsahan dokumen tetap tugas
 * import-gate (fail-soft terdokumentasi, pola sama dengan
 * lineContinuation).
 *
 * Modul PURE: tanpa import server/, store/, UI, tanpa filesystem.
 */

/** Hasil parse satu baris tag GEDCOM. */
export interface ParsedTagLine {
  /** Level angka di awal baris. */
  level: number;
  /** Xref tanpa pembatas @, bila baris membawanya. */
  xref: string | undefined;
  /** Tag baris. */
  tag: string;
  /** Payload baris; undefined berarti kosong (tanpa payload). */
  payload: string | undefined;
}

/** Tag GEDCOM: huruf, angka, underscore (lemma TAG di spek 7.0). */
const TAG_RE = /^[A-Za-z0-9_]+/;

/** Xref berbentuk @id@ tanpa @ di dalamnya. */
const XREF_RE = /^@([^@]+)@/;

/**
 * Parse satu baris tag GEDCOM menjadi struktur token.
 *
 * Mengembalikan null bila baris kosong setelah trim, tidak berawalan
 * level angka, atau level saja tanpa tag (grammar mewajibkan tag).
 * Whitespace di awal dan akhir baris diabaikan; deret spasi di posisi
 * delimiter antar token dianggap satu delimiter (lenient).
 */
export function parseTagLine(raw: string): ParsedTagLine | null {
  const s = raw.replace(/^\s+/, '').replace(/\s+$/, '');
  if (s === '') return null;

  const levelMatch = /^(\d+)/.exec(s);
  if (levelMatch === null) return null;
  const level = Number.parseInt(levelMatch[1], 10);
  let rest = s.slice(levelMatch[1].length);

  // Deret delimiter setelah level dicoalesce jadi satu (lenient).
  rest = rest.replace(/^\s+/, '');

  let xref: string | undefined;
  const xrefMatch = XREF_RE.exec(rest);
  if (xrefMatch !== null) {
    xref = xrefMatch[1];
    rest = rest.slice(xrefMatch[0].length).replace(/^\s+/, '');
  }

  const tagMatch = TAG_RE.exec(rest);
  if (tagMatch === null) return null;
  const tag = tagMatch[0];
  rest = rest.slice(tagMatch[0].length);

  // Sisa setelah tag: deret spasi di posisi delimiter coalesce jadi
  // satu; payload kosong (termasuk spasi ekor murni) pulang undefined.
  let payload: string | undefined;
  if (/^\s/.test(rest)) {
    const trimmed = rest.replace(/^\s+/, '');
    payload = trimmed === '' ? undefined : trimmed;
  }

  return { level, xref, tag, payload };
}

/**
 * Format satu baris tag GEDCOM dari struktur token.
 *
 * Payload kosong (undefined) menghasilkan baris tanpa delimiter ekor,
 * jadi baris tag tanpa payload export balik tanpa spasi tersisa dan
 * struktur tidak berubah saat roundtrip.
 */
export function formatTagLine(parsed: ParsedTagLine): string {
  const xrefPart = parsed.xref === undefined ? '' : `@${parsed.xref}@ `;
  const payloadPart = parsed.payload === undefined ? '' : ` ${parsed.payload}`;
  return `${parsed.level} ${xrefPart}${parsed.tag}${payloadPart}`;
}

/**
 * Parse dokumen GEDCOM kecil: pecah baris (LF/CRLF/CR), parse tiap
 * baris tak kosong. Baris tak bisa di-parse dilewati fail-soft; untuk
 * roundtrip dokumen sah hasilnya identik dengan masukan kanonikal.
 */
export function parseGedcomDocument(text: string): ParsedTagLine[] {
  const out: ParsedTagLine[] = [];
  for (const line of text.split(/\r\n|\r|\n/)) {
    if (line.trim() === '') continue;
    const parsed = parseTagLine(line);
    if (parsed !== null) out.push(parsed);
  }
  return out;
}
