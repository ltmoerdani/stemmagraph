/**
 * Schema gate GEDCOM 7 (STG v120 fase ii).
 *
 * Lapisan pelaporan reject per baris DI ATAS vendor lib: menerima daftar
 * entri hasil parse yang line-aware, memeriksa keberadaan struktur dan
 * kardinalitasnya memakai tabel fase i (structure-lookup.ts), lalu
 * mengembalikan laporan. Tidak melempar error, tidak memblokir import.
 *
 * Modul PURE: tanpa import server/, store/, UI. Logika lookup tidak
 * diduplikasi; semua keputusan known/unknown/payload didelegasikan ke
 * structure-lookup.ts.
 */
import { lookupStructure, type StructureEntry } from './structure-lookup';

export interface SchemaGateEntry {
  /** Nomor baris sumber (1-based) tempat struktur ini muncul. */
  line: number;
  /** URI superstructure induk; string kosong ('') untuk root dokumen. */
  superstructureUri: string;
  /** Tag yang muncul di bawah induk tersebut. */
  tag: string;
}

export interface SchemaGateIssue {
  line: number;
  /** URI struktur bermasalah (untuk unknown: URI induknya). */
  structureUri: string;
  tag: string;
  reason: 'unknown_structure' | 'cardinality_violated';
}

export interface SchemaGateReport {
  issues: SchemaGateIssue[];
  /** Entri ber-tag underscore yang sah sebagai extension, hanya dihitung. */
  extensionCount: number;
  /** Entri struktur legal yang lolos gate. */
  checkedCount: number;
}

/** Kardinalitas tabel berbentuk "{min:max}"; max 'M' berarti tanpa batas. */
function maxCardinality(cardinality: string): number | null {
  const m = /^\{(\d+):(\d+|M)\}$/.exec(cardinality);
  if (!m) return null;
  if (m[2] === 'M') return null;
  return Number(m[2]);
}

/**
 * Jalankan gate atas entri parse. Setiap entri jatuh ke tepat satu bucket:
 * issue (unknown atau kardinalitas), extension, atau checked. Dua kali
 * panggilan dengan input sama menghasilkan laporan identik.
 */
export function runSchemaGate(entries: SchemaGateEntry[]): SchemaGateReport {
  const issues: SchemaGateIssue[] = [];
  let extensionCount = 0;
  let checkedCount = 0;

  // Penghitung kemunculan per pasangan (induk, tag) untuk aturan kardinalitas.
  const seen = new Map<string, { first: SchemaGateEntry; def: StructureEntry; count: number }>();

  for (const entry of entries) {
    const def = lookupStructure(entry.superstructureUri, entry.tag);

    if (def === undefined) {
      if (entry.tag.startsWith('_')) {
        // Extension penulis bebas: sah, cukup dicatat jumlahnya.
        extensionCount += 1;
      } else {
        issues.push({
          line: entry.line,
          structureUri: entry.superstructureUri,
          tag: entry.tag,
          reason: 'unknown_structure',
        });
      }
      continue;
    }

    const key = entry.superstructureUri + '::' + entry.tag;
    const slot = seen.get(key) ?? { first: entry, def, count: 0 };
    slot.count += 1;
    seen.set(key, slot);
  }

  // Kardinalitas dievaluasi setelah agregasi per induk selesai.
  for (const slot of seen.values()) {
    const max = maxCardinality(slot.def.cardinality);
    if (max !== null && slot.count > max) {
      // Satu issue per pasangan (induk, tag), dilaporkan di baris entri
      // pertama yang melewati batas.
      issues.push({
        line: slot.first.line,
        structureUri: slot.def.uri,
        tag: slot.first.tag,
        reason: 'cardinality_violated',
      });
      // Kemunculan dalam batas tetap terhitung checked.
      checkedCount += max;
      continue;
    }
    checkedCount += slot.count;
  }

  return { issues, extensionCount, checkedCount };
}
