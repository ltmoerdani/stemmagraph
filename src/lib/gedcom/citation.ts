// Definisi tipe ParsedCitation dan helper capture untuk sitasi event-level
// GEDCOM 7.0 (v151-i).
//
// Kontrak modul ini pure: tanpa DB, tanpa env, tanpa network, tanpa import
// react/zustand. Aturan pure core berlaku: tidak ada kode komersial.
// Payload diteruskan verbatim tanpa normalisasi, disiplin yang sama dengan
// RESN dan noAssertions pada importIndividuals/importFamilies.

import { GEDCStruct } from './vendor/gedcstruct.js'

/** Struktur satu sitasi SOUR event-level (BIRT/DEAT/MARR/DIV). */
export interface ParsedCitation {
  /** Pointer SOUR verbatim, misal '@S1@' atau string bebas bila tidak menunjuk record terdaftar. */
  sourcePointer: string
  /** Sub-struktur PAGE verbatim, atau undefined bila tidak ada. */
  page?: string
  /** Sub-struktur QUAY verbatim (disimpan apa adanya, misal '3' atau nilai non-standar), atau undefined bila tidak ada. */
  quay?: string
  /** Payload NOTE verbatim di bawah SOUR tersebut, atau undefined bila tidak ada. */
  note?: string
}

/** String payload of a structure, or undefined for absent/non-string/empty. */
function payloadOf(struct: GEDCStruct | undefined): string | undefined {
  const p = struct?.payload
  return typeof p === 'string' && p !== '' ? p : undefined
}

/**
 * Pointer payload dari satu struktur SOUR, selalu verbatim:
 * pointer yang menunjuk record terdaftar menghasilkan '@<xref>@',
 * pointer ke record yang tidak ada menghasilkan '@VOID@', dan payload
 * non-pointer diteruskan apa adanya. Tidak ada normalisasi.
 */
function sourcePointerOf(sour: GEDCStruct): string {
  const p = sour.payload
  if (p instanceof GEDCStruct) return `@${p.xref_id ?? ''}@`
  if (p === null) return '@VOID@'
  return typeof p === 'string' ? p : ''
}

/**
 * Semua sitasi SOUR langsung di bawah satu struktur event (BIRT/DEAT/MARR/DIV),
 * urutan file dipertahankan. Setiap SOUR menyimpan pointer, PAGE, QUAY, dan
 * NOTE verbatim. SOUR tanpa sub-struktur tetap masuk daftar. Pure, never throws.
 */
export function citationsOf(event: GEDCStruct | undefined): ParsedCitation[] {
  if (!event) return []
  return event.sub
    .filter((s) => s.tag === 'SOUR')
    .map((sour) => ({
      sourcePointer: sourcePointerOf(sour),
      page: payloadOf(sour.sub.find((s) => s.tag === 'PAGE')),
      quay: payloadOf(sour.sub.find((s) => s.tag === 'QUAY')),
      note: payloadOf(sour.sub.find((s) => s.tag === 'NOTE')),
    }))
}
