/**
 * v417 fase 1: pengubah teks GEDCOM jadi daftar IncomingRecord untuk
 * buildMergePlan di jalur preview dry-run.
 *
 * Teks dipilah per record level 0 dengan tumpukan sub-baris per record;
 * identitas durable (UID, EXID+TYPE, REFN) diekstrak lewat
 * extractDurableIdentity agar preview match candidate memakai jalur
 * pencocokan yang sama dengan apply v418 nanti.
 *
 * Modul PURE: tanpa DB, tanpa server, tanpa filesystem, tidak melempar.
 */
import type { IncomingRecord } from './importMergePlan';
import { extractDurableIdentity } from './importMergePlan';

interface RawRecord {
  source: 'INDI' | 'FAM';
  xref: string;
  /** Baris level >= 1 milik record ini, verbatim (dipakai durable identity). */
  lines: string[];
}

/** LEVEL [XREF] TAG [payload]; ambil level, xref, tag, dan sisa payload. */
const LINE_RE = /^\s*(\d+)\s+(?:@([^@]+)@\s+)?([A-Za-z0-9_]+)\s*(.*)$/;

function toIncoming(raw: RawRecord): IncomingRecord {
  const identity = extractDurableIdentity(raw.lines);
  const record: IncomingRecord = {
    source: raw.source,
    xref: raw.xref,
    uid: identity.uid,
    refn: identity.refn,
    exids: identity.exids,
  };
  return record;
}

/**
 * Pilah teks GEDCOM per record level 0 INDI/FAM. Record lain (HEAD,
 * TRLR, NOTE, dsb) diabaikan. Baris tak terparse diabaikan diam-diam;
 * laporan baris bermasalah tetap tugas import-gate.
 */
export function incomingRecordsFromGedcom(text: string): IncomingRecord[] {
  const raws: RawRecord[] = [];
  let current: RawRecord | null = null;
  for (const line of text.split('\n')) {
    const m = LINE_RE.exec(line);
    if (m === null) continue;
    const level = Number(m[1]);
    if (level === 0) {
      const tag = m[3];
      const xref = m[2];
      if ((tag === 'INDI' || tag === 'FAM') && typeof xref === 'string' && xref !== '') {
        current = { source: tag, xref, lines: [] };
        raws.push(current);
      } else {
        current = null;
      }
      continue;
    }
    if (current !== null) {
      current.lines.push(line);
    }
  }
  // Mapping dilakukan setelah seluruh baris terkumpul supaya identitas
  // durable membaca lines lengkap, bukan potongan kosong awal record.
  return raws.map(toIncoming);
}
