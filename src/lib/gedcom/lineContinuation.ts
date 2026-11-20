/**
 * Pembaca baris import GEDCOM dengan penggabung continuation
 * (STG v464 unit 1b).
 *
 * Dua tag continuation melanjutkan payload struktur induknya: CONT
 * menyisipkan U+000A di antara potongan, CONC (warisan 5.x, masih
 * sah di GEDCOM 7) menyambung langsung tanpa pemisah. Baris dibaca
 * dengan toleransi EOL campur CRLF/LF/CR; CRLF dihitung satu pemisah
 * supaya tidak muncul baris kosong palsu.
 *
 * Urutan pemakaian bersama unit 1a: jalankan runCharsetGate lebih
 * dulu, lalu berikan text bersih (tanpa BOM) ke resolveLineContinuations.
 * Helper resolveAfterCharsetGate merangkai keduanya sekaligus dan
 * meneruskan reject gate apa adanya, jadi sifat fail-closed tetap
 * terjaga sampai resolusi continuation.
 *
 * CONT/CONC tanpa induk level-1 di atasnya dibiarkan jadi baris
 * biasa (fail-soft terdokumentasi); validasi keabsahan dokumen tetap
 * tugas import-gate. Nomor baris fisik tiap entri dicatat dari baris
 * pertama grupnya, siap dipakai pelaporan reject per baris.
 *
 * Pemilahan LEVEL [XREF] TAG payload memakai pola yang sama dengan
 * modul preview sejenis (previewIncoming), jadi perilaku pemisahan
 * whitespace payload konsisten di seluruh jalur import.
 *
 * Modul PURE: tanpa import server/, store/, UI, tanpa filesystem.
 */
import { runCharsetGate, type CharsetGateError } from './charsetGate';

/** Satu baris logis GEDCOM dengan payload continuation tergabung. */
export interface GedcomSourceLine {
  /** Level angka dari baris awal grup. */
  level: number;
  /** Xref tanpa pembatas @, bila baris awal grup membawanya. */
  xref: string | undefined;
  /** Tag baris awal grup; CONT/CONC tergabung tidak muncul di sini. */
  tag: string;
  /** Payload penuh: potongan CONT disambung U+000A, CONC tanpa pemisah. */
  payload: string;
  /** Nomor baris fisik (1-based) baris pertama grup. */
  line: number;
}

/** LEVEL [XREF] TAG [payload]; pola identik dengan previewIncoming. */
const LINE_RE = /^\s*(\d+)\s+(?:@([^@]+)@\s+)?([A-Za-z0-9_]+)\s*(.*)$/;

/**
 * Pecah teks jadi baris fisik dengan EOL campur: CRLF dihitung satu
 * pemisah, LF dan CR tunggal masing-masing satu. Ujung berkas tanpa
 * EOL tetap menghasilkan baris terakhirnya.
 */
export function splitGedcomLines(text: string): string[] {
  const lines: string[] = [];
  let start = 0;
  let i = 0;
  const n = text.length;
  while (i < n) {
    const ch = text[i];
    if (ch === '\r') {
      lines.push(text.slice(start, i));
      i += text[i + 1] === '\n' ? 2 : 1;
      start = i;
    } else if (ch === '\n') {
      lines.push(text.slice(start, i));
      i += 1;
      start = i;
    } else {
      i += 1;
    }
  }
  lines.push(text.slice(start));
  return lines;
}

/**
 * Baca teks GEDCOM jadi baris logis dengan CONT/CONC tergabung ke
 * payload induk level-1 di atasnya. Baris tak terparse diabaikan;
 * CONT/CONC yatim dibiarkan sebagai baris biasa (fail-soft).
 */
export function resolveLineContinuations(text: string): GedcomSourceLine[] {
  const result: GedcomSourceLine[] = [];
  const lastAtLevel: (GedcomSourceLine | undefined)[] = [];
  const rawLines = splitGedcomLines(text);
  for (let i = 0; i < rawLines.length; i++) {
    const m = LINE_RE.exec(rawLines[i]);
    if (m === null) continue;
    const level = Number(m[1]);
    const tag = m[3];
    const payload = m[4];
    const isContinuation = (tag === 'CONT' || tag === 'CONC') && level >= 1;
    if (isContinuation) {
      const parent = lastAtLevel[level - 1];
      if (parent !== undefined) {
        parent.payload =
          tag === 'CONT' ? parent.payload + '\n' + payload : parent.payload + payload;
        continue;
      }
      // Yatim: jatuh ke jalur baris biasa di bawah supaya tetap
      // terlihat oleh pemeriksa hilir, bukan hilang diam-diam.
    }
    for (let lv = lastAtLevel.length - 1; lv >= level; lv--) {
      lastAtLevel[lv] = undefined;
    }
    const entry: GedcomSourceLine = { level, xref: m[2], tag, payload, line: i + 1 };
    lastAtLevel[level] = entry;
    result.push(entry);
  }
  return result;
}

/** Jalur penuh unit 1a + 1b: gate lolos, baris continuation tergabung. */
export interface ContinuationPipelineOk {
  ok: true;
  lines: GedcomSourceLine[];
}

/** Gate menolak: daftar error offset byte diteruskan tanpa resolusi. */
export interface ContinuationPipelineReject {
  ok: false;
  errors: CharsetGateError[];
}

export type ContinuationPipelineResult =
  | ContinuationPipelineOk
  | ContinuationPipelineReject;

/**
 * Rangkai runCharsetGate (unit 1a) dengan resolusi continuation: BOM
 * ter-strip di gate, payload bersih masuk pembaca baris. Reject gate
 * diteruskan apa adanya, fail-closed.
 */
export function resolveAfterCharsetGate(payload: string): ContinuationPipelineResult {
  const gate = runCharsetGate(payload);
  if (!gate.ok) {
    return { ok: false, errors: gate.errors };
  }
  return { ok: true, lines: resolveLineContinuations(gate.text) };
}
