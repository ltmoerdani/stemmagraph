// GEDZIP ingestion: reads the GEDCOM 7.0 text back out of a .gedzip archive.
//
// GEDZIP is the ZIP packaging defined by the GEDCOM 7.0 specification:
// a ZIP archive whose family-data entry is the file gedcom.ged. This
// module is the read counterpart of exportGedzip: it accepts raw
// archive bytes, locates the gedcom.ged entry (name matched
// case-sensitively as the spec's GEDZIP chapter prescribes, with
// nesting at any depth kept as a documented application tolerance),
// and returns its text decoded as UTF-8. It never parses genealogy
// data; callers feed the returned string into the regular GEDCOM
// parsing path.
//
// Failure discipline: a missing gedcom.ged entry or an unreadable
// archive throws an Error with a plain message. Nothing is swallowed
// and nothing falls back silently. The module is pure: no database,
// no environment access, and no commercial concerns of any kind.

import { unzipSync } from 'fflate'

/** Exact file name (case-sensitive) this module looks for inside a GEDZIP archive. */
const GEDZIP_ENTRY_BASENAME = 'gedcom.ged'

/**
 * Returns the final path segment of a ZIP entry name, compared
 * as-is so matching stays case-sensitive per the GEDZIP chapter of
 * the GEDCOM 7.0 spec. Directory entries (trailing slash) come out
 * as an empty string and never match.
 */
function entryBasename(name: string): string {
  const parts = name.split('/')
  const base = parts[parts.length - 1] ?? ''
  return base
}

/**
 * Deterministic name ordering for candidate entries: raw code points
 * so archives carrying more than one exact gedcom.ged candidate
 * (e.g. a root copy plus a nested duplicate) always resolve to the
 * same entry.
 */
function compareEntryNames(a: string, b: string): number {
  if (a !== b) return a < b ? -1 : 1
  return 0
}

/**
 * Extracts the GEDCOM 7.0 text from a GEDZIP archive.
 *
 * The archive is inflated with fflate's synchronous unzip, then the
 * gedcom.ged entry is located by exact case-sensitive file name match
 * at any path depth, following the GEDZIP chapter of the GEDCOM 7.0
 * spec; accepting nested paths is a documented application tolerance
 * and only loosens where the entry may sit, never which name it
 * carries. When several candidates exist, the raw-code-point-first
 * name wins so the result stays deterministic. The entry bytes are
 * decoded as UTF-8 with the platform TextDecoder defaults, meaning
 * malformed byte sequences are replaced (U+FFFD) rather than thrown
 * away, mirroring how the rest of the app reads UTF-8 text.
 *
 * Throws an Error when the bytes are not a readable ZIP archive or
 * when no gedcom.ged entry exists, so callers always get an explicit
 * failure they can surface to the user.
 */
export function importGedzip(data: Uint8Array): string {
  let entries: Record<string, Uint8Array>
  try {
    entries = unzipSync(data)
  } catch (cause) {
    const detail = cause instanceof Error ? cause.message : String(cause)
    throw new Error(
      `importGedzip: input is not a readable GEDZIP archive (${detail})`,
    )
  }

  const candidateNames = Object.keys(entries)
    .filter((name) => entryBasename(name) === GEDZIP_ENTRY_BASENAME)
    .sort(compareEntryNames)
  const picked = candidateNames[0]
  if (picked === undefined) {
    throw new Error(
      `importGedzip: no ${GEDZIP_ENTRY_BASENAME} entry found in the archive`,
    )
  }

  const bytes = entries[picked]
  if (bytes === undefined) {
    throw new Error(
      `importGedzip: ${GEDZIP_ENTRY_BASENAME} entry is present but unreadable`,
    )
  }
  return new TextDecoder().decode(bytes)
}
