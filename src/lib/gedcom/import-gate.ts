/**
 * Wiring gate schema ke jalur import (STG v120 fase iii).
 *
 * Lapisan tipis antara hasil parse GEDCOM dan schema-gate: menerima
 * daftar entri struktur line-aware, menjalankan runSchemaGate, lalu
 * menyusun daftar reject per baris (baris, URI struktur, alasan).
 * Modul ini tidak mengubah perilaku importPipeline; gate bersifat
 * pelaporan sehingga pemanggil import bebas memakai atau mengabaikan
 * hasilnya.
 *
 * Modul PURE: tanpa import server/, store/, UI, tanpa filesystem.
 */
import {
  runSchemaGate,
  type SchemaGateEntry,
  type SchemaGateReport,
} from './schema-gate';

/** Satu baris yang tertolak gate: lokasi, URI, dan alasannya. */
export interface ImportGateReject {
  /** Nomor baris sumber (1-based) tempat pelanggaran terdeteksi. */
  line: number;
  /**
   * URI struktur bermasalah. Untuk struktur salah tempat yang tak
   * punya URI sendiri di skema, yang dicantumkan adalah URI induknya.
   * Extension tag underscore (spec GEDCOM 7 Bab 1.5) tidak masuk
   * daftar ini.
   */
  structureUri: string;
  reason: 'unknown_structure' | 'cardinality_violated';
}

/** Hasil wiring: laporan ringkas plus daftar reject siap tampilkan. */
export interface ImportGateResult {
  report: SchemaGateReport;
  rejects: ImportGateReject[];
}

/**
 * Jalankan gate atas hasil parse lalu petakan isu jadi reject per
 * baris. Urutan rejects mengikuti urutan isu dari runSchemaGate:
 * isu per entri (unknown) lebih dulu sesuai urutan parse, kemudian
 * pelanggaran kardinalitas hasil agregasi per induk. Pure: input
 * sama selalu menghasilkan laporan dan rejects yang identik.
 */
export function runImportGate(entries: SchemaGateEntry[]): ImportGateResult {
  const report: SchemaGateReport = runSchemaGate(entries);
  const rejects: ImportGateReject[] = report.issues.map((issue) => ({
    line: issue.line,
    structureUri: issue.structureUri,
    reason: issue.reason,
  }));
  return { report, rejects };
}
