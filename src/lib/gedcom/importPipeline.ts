// Deteksi dan ekstraksi GEDCOM dari berkas unggahan (S1F6-C).
//
// Jembatan kecil antara <input type="file"> dan rantai import lib
// (importIndividuals + importFamilies + buildImportPlan +
// applyImportPlan). Tugasnya satu: memilah byte unggahan GEDZIP vs
// GEDCOM polos lewat magic ZIP lalu mengembalikan teks GEDCOM siap
// parse.
//
// Kontrak murni: tanpa DB, tanpa env, tanpa state, tanpa DOM.
// Arsip GEDZIP tidak sah dilempar eksplisit oleh importGedzip
// (Error berpesan jelas) supaya pemanggil UI bisa menampilkannya
// apa adanya; GEDCOM polos tidak pernah melempar.

import { importGedzip } from './importGedzip'

/** Jenis sumber unggahan terdeteksi. */
export type GedcomUploadKind = 'gedzip' | 'gedcom'

/**
 * Magic local file header ZIP klasik: 'P' 'K' 0x03 0x04. GEDZIP adalah
 * ZIP, jadi empat byte awal ini cukup memilah tanpa membaca ekstensi
 * nama berkas (nama bebas diubah pengguna, isi tidak).
 */
function hasZipMagic(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 4 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    bytes[2] === 0x03 &&
    bytes[3] === 0x04
  )
}

/** Memilah jenis unggahan dari byte awal; tidak pernah melempar. */
export function detectUploadKind(bytes: Uint8Array): GedcomUploadKind {
  return hasZipMagic(bytes) ? 'gedzip' : 'gedcom'
}

/** Hasil ekstraksi: jenis sumber plus teks GEDCOM siap parse. */
export interface ExtractedGedcom {
  kind: GedcomUploadKind
  text: string
}

/**
 * Mengubah byte unggahan jadi teks GEDCOM. Jalur gedzip didelegasikan
 * ke importGedzip (unzipSync + pencarian entry gedcom.ged
 * case-insensitive, melempar Error eksplisit untuk arsip tidak sah);
 * jalur lain didekode UTF-8 dengan TextDecoder default (byte tak valid
 * jadi U+FFFD, konsisten dengan sisa aplikasi).
 */
export function extractGedcom(bytes: Uint8Array): ExtractedGedcom {
  if (detectUploadKind(bytes) === 'gedzip') {
    return { kind: 'gedzip', text: importGedzip(bytes) }
  }
  return { kind: 'gedcom', text: new TextDecoder().decode(bytes) }
}
