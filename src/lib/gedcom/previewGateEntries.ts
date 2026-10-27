/**
 * v417 fase 1: pemetaan teks GEDCOM mentah jadi entri schema gate yang
 * line-aware.
 *
 * Vendor lib (GEDCStruct) tidak membawa nomor baris, sedangkan import-gate
 * melaporkan reject per baris. Modul ini menjalan ulang baris mentah dengan
 * tumpukan level sederhana untuk memperkirakan (baris, URI induk, tag)
 * tiap struktur, lalu hasilnya siap diberikan ke runImportGate.
 *
 * Aturan penelusuran:
 * - Struktur dengan induk tidak dikenal tidak ikut dilaporkan (masalah
 *   induk cukup dilaporkan sekali, tanpa reject berantai palsu).
 * - Baris yang tidak bisa diparse (bukan format level+tag) diabaikan;
 *   validasi keabsahan dokumen tetap tugas pemanggil.
 *
 * Modul PURE: tanpa DB, tanpa server, tanpa filesystem, tidak melempar.
 */
import type { SchemaGateEntry } from './schema-gate';
import { lookupStructure } from './structure-lookup';

interface Frame {
  level: number;
  uri: string;
  known: boolean;
}

/** LEVEL [XREF] TAG [payload]; xref @..@ dan payload tidak dipakai gate. */
const LINE_RE = /^\s*(\d+)\s+(?:@[^@]+@\s+)?([A-Za-z0-9_]+)/;

export function gateEntriesFromGedcom(text: string): SchemaGateEntry[] {
  const entries: SchemaGateEntry[] = [];
  const stack: Frame[] = [{ level: -1, uri: '', known: true }];

  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const m = LINE_RE.exec(lines[i]);
    if (m === null) continue;
    const level = Number(m[1]);
    const tag = m[2];

    while (stack.length > 1 && stack[stack.length - 1].level >= level) {
      stack.pop();
    }
    const parent = stack[stack.length - 1];
    if (parent.known) {
      entries.push({ line: i + 1, superstructureUri: parent.uri, tag });
      const def = lookupStructure(parent.uri, tag);
      stack.push({ level, uri: def?.uri ?? '', known: def !== undefined });
    } else {
      // Induk tak dikenal: anak tidak dilaporkan, tapi tetap ditumpuk
      // agar level berikutnya dibaca konsisten.
      stack.push({ level, uri: '', known: false });
    }
  }
  return entries;
}
