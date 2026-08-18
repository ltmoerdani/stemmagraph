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
//
// Guard discipline: limits are checked BEFORE any archive is built.
// When a limit is violated the caller gets a structured error plus the
// plain GEDCOM string, so the UI can explain the problem and still
// deliver a .ged fallback download instead of failing silently.

import { zipSync } from 'fflate'
import {
  exportGedcom70,
  type ExportGedcom70Input,
  type ExportGedcom70Stats,
} from './exportGedcom70'

/** The one and only entry name inside a GEDZIP archive (case-sensitive). */
export const GEDZIP_ENTRY_NAME = 'gedcom.ged'

/**
 * Guard thresholds for archive creation. Defaults are the classic
 * (non-zip64) ZIP limits; both stay injectable so verification can
 * exercise the guard with small values instead of real 4 GiB payloads.
 */
export interface GedzipLimits {
  /**
   * Maximum total UTF-8 byte size of archived content. A classic ZIP
   * cannot store a member larger than 0xFFFFFFFF bytes (4 GiB minus
   * one); the default guard uses exactly that bound.
   */
  maxContentBytes: number
  /**
   * Maximum number of entries. The classic ZIP central directory
   * records at most 65535 entries. GEDZIP currently ships exactly one
   * entry; the guard exists so future media packaging inherits it.
   */
  maxEntries: number
}

export const DEFAULT_GEDZIP_LIMITS: Readonly<GedzipLimits> = {
  // 0xFFFFFFFF (4 GiB minus one byte) is the largest member a classic
  // ZIP can address. Anything larger would force zip64 structures,
  // which this GEDZIP packaging forbids, so the guard trips one byte
  // earlier than a literal 4 GiB would.
  maxContentBytes: 0xffffffff,
  maxEntries: 0xffff,
}

export type GedzipLimitCode =
  | 'GEDZIP_CONTENT_TOO_LARGE'
  | 'GEDZIP_TOO_MANY_ENTRIES'

/**
 * Structured guard violation. Plain data (no Error subclass) so result
 * unions stay serializable and callers can branch on the code.
 */
export interface GedzipLimitError {
  code: GedzipLimitCode
  message: string
  /** Offending measurement: total content bytes or entry count. */
  value: number
  /** The threshold that was violated. */
  limit: number
}

/** One planned archive member: entry name plus already-encoded bytes. */
interface GedzipEntryPlan {
  name: string
  bytes: Uint8Array
}

/**
 * Checks planned entries against the limits. Returns null when the
 * archive may be built, otherwise the violation to surface.
 */
export function checkGedzipLimits(
  entries: GedzipEntryPlan[],
  limits: GedzipLimits,
): GedzipLimitError | null {
  if (entries.length > limits.maxEntries) {
    return {
      code: 'GEDZIP_TOO_MANY_ENTRIES',
      message:
        `GEDZIP would contain ${entries.length} entries, exceeding the ` +
        `limit of ${limits.maxEntries} entries of a classic (non-zip64) ZIP.`,
      value: entries.length,
      limit: limits.maxEntries,
    }
  }
  const totalBytes = entries.reduce((sum, e) => sum + e.bytes.byteLength, 0)
  if (totalBytes > limits.maxContentBytes) {
    return {
      code: 'GEDZIP_CONTENT_TOO_LARGE',
      message:
        `GEDZIP content of ${totalBytes} bytes exceeds the limit of ` +
        `${limits.maxContentBytes} bytes of a classic (non-zip64) ZIP.`,
      value: totalBytes,
      limit: limits.maxContentBytes,
    }
  }
  return null
}

/**
 * exportGedzip input. privacyMode (S-06 Wave 1) flows straight into the
 * single exportGedcom70 call below, so the archive entry is exactly
 * what the plain .ged path produces for the same mode: 'clean'
 * archives ship a redacted gedcom.ged, 'full' (or omitted) archives
 * ship the unchanged private-archive output.
 */
export type ExportGedzipInput = ExportGedcom70Input & {
  /**
   * Optional guard threshold override. Production callers leave this
   * unset and get the classic ZIP defaults; verification injects small
   * values to exercise the guard without multi-gigabyte fixtures.
   */
  limits?: Partial<GedzipLimits>
}

export type ExportGedzipResult =
  | {
      ok: true
      /** Raw archive bytes, ready for Blob construction in the UI. */
      zip: Uint8Array<ArrayBuffer>
      stats: ExportGedcom70Stats
    }
  | {
      ok: false
      error: GedzipLimitError
      /**
       * The plain GEDCOM 7.0 text, identical to what exportGedcom70
       * returns for this input. Delivered on guard failure so callers
       * can offer a .ged fallback download with no second generation.
       */
      gedcom: string
      stats: ExportGedcom70Stats
    }

/** Resolves injected limits against the classic ZIP defaults. */
function resolveLimits(override?: Partial<GedzipLimits>): GedzipLimits {
  return { ...DEFAULT_GEDZIP_LIMITS, ...override }
}

/**
 * Packages a GEDCOM 7.0 string as a GEDZIP archive, after running the
 * limit guard.
 *
 * Exported separately from exportGedzip so verification tooling can
 * exercise the ZIP layer directly on known GEDCOM texts. The optional
 * mtime stamps the entry; when omitted it defaults to the current
 * time. Feeding the export timestamp makes archives reproducible: the
 * same input and timestamp always produce the same bytes.
 */
export function packageGedzip(
  gedcom: string,
  options?: { limits?: Partial<GedzipLimits>; mtime?: Date },
):
  | { ok: true; zip: Uint8Array<ArrayBuffer> }
  | { ok: false; error: GedzipLimitError } {
  const bytes = new TextEncoder().encode(gedcom)
  const entries: GedzipEntryPlan[] = [{ name: GEDZIP_ENTRY_NAME, bytes }]
  const violation = checkGedzipLimits(entries, resolveLimits(options?.limits))
  if (violation) return { ok: false, error: violation }
  const zip = zipSync({ [GEDZIP_ENTRY_NAME]: bytes }, { mtime: options?.mtime })
  return { ok: true, zip }
}

/**
 * Exports a family tree as a .gedzip archive.
 *
 * The contained gedcom.ged entry is byte-identical to what
 * exportGedcom70 returns for the same input, because this function
 * calls that mapper exactly once and packages its output unchanged.
 * When the guard rejects the archive, the same GEDCOM string comes
 * back in the error branch for the caller's .ged fallback.
 */
export function exportGedzip(input: ExportGedzipInput): ExportGedzipResult {
  const { gedcom, stats } = exportGedcom70(input)
  const packaged = packageGedzip(gedcom, {
    limits: input.limits,
    mtime: input.exportedAt,
  })
  if (!packaged.ok) {
    return { ok: false, error: packaged.error, gedcom, stats }
  }
  return { ok: true, zip: packaged.zip, stats }
}
