// GEDZIP packaging: wraps the GEDCOM 7.0 export in a .gedzip archive.
//
// GEDZIP is the ZIP packaging defined by the GEDCOM 7.0 specification:
// a ZIP archive whose single root-level entry is the family data file
// gedcom.ged (the name is case-sensitive and carries no folder part).
// This wave packages text only: no encryption, no media embedding,
// and no zip64 structures (the spec does not require them, so archives
// stay inside the classic ZIP limits on purpose).
//
// Byte-identity discipline: the .ged payload is produced by the exact
// same exportGedcom70 call the plain .ged download uses, so the archive
// entry and the direct export are byte-identical by construction. This
// module never re-serializes or post-processes the GEDCOM string; it
// only UTF-8 encodes it, because ZIP entries are byte streams.

import { zipSync } from 'fflate'
import {
  exportGedcom70,
  type ExportGedcom70Input,
  type ExportGedcom70Stats,
} from './exportGedcom70'

/** The one and only entry name inside a GEDZIP archive (case-sensitive). */
export const GEDZIP_ENTRY_NAME = 'gedcom.ged'

export type ExportGedzipInput = ExportGedcom70Input

export interface ExportGedzipResult {
  zip: Uint8Array
  stats: ExportGedcom70Stats
}

/**
 * Packages a GEDCOM 7.0 string as a GEDZIP archive.
 *
 * Exported separately from exportGedzip so verification tooling can
 * exercise the ZIP layer directly on known GEDCOM texts. The optional
 * mtime stamps the entry; when omitted it defaults to the current time.
 * Feeding the export timestamp makes archives reproducible: the same
 * input and timestamp always produce the same bytes.
 */
export function packageGedzip(gedcom: string, mtime?: Date): Uint8Array {
  const bytes = new TextEncoder().encode(gedcom)
  return zipSync({ [GEDZIP_ENTRY_NAME]: bytes }, { mtime })
}

/**
 * Exports a family tree as a .gedzip archive.
 *
 * The contained gedcom.ged entry is byte-identical to what
 * exportGedcom70 returns for the same input, because this function
 * calls that mapper exactly once and packages its output unchanged.
 */
export function exportGedzip(input: ExportGedzipInput): ExportGedzipResult {
  const { gedcom, stats } = exportGedcom70(input)
  const zip = packageGedzip(gedcom, input.exportedAt)
  return { zip, stats }
}
