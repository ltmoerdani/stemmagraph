// GEDCOM 7.0 import: parses FAM records from a GEDCOM 7.0 string into
// plain, lossless family summaries (S1F5-B).
//
// Parsing discipline mirrors the exporter (exportGedcom70.ts) and the
// sibling importer (importIndividuals.ts, S1F5-A): input goes through the
// same vendored tag-oriented GEDCStruct layer
// (src/lib/gedcom/vendor/gedcstruct.js, dialect g7ConfGEDC) so the
// fromString/toString round-trip guarantee covers the family import path
// too. There is no hand-rolled line splitter anywhere in this file.
//
// Scope (S1F5-B, deliberately narrow):
//   - FAM records only: xref, HUSB, WIFE, CHIL (array, in file order),
//     MARR DATE via parseEventDate, MARR PLAC via placePayload, DIV DATE
//     via parseEventDate, RESN payload verbatim (no enum normalization,
//     no mapping; same discipline as importIndividuals.ts).
//   - FAMS/FSEM/FAMC pointers are ignored here on purpose: they are
//     derivable from the INDI/FAM record pairs themselves, so keeping
//     them would duplicate state.
//   - Output is a summary, NOT a FamilyMemberRecord: this lib never
//     fabricates treeId/generation/maritalStatus. Mapping decisions
//     belong to the wiring layer, not the parser.
//
// Purity contract (same family as parseEventDate/placePayload):
//   - Pure functions: no DB, no env, no network, no side effects. The
//     pure-core rule (no commercial code) applies: this parser only
//     reads genealogical payloads and never touches monetization.
//   - Never throws on malformed GEDCOM: the vendor parser logs broken
//     lines via the optional logger and skips them; FAM records without
//     a usable xref are skipped honestly; absent/empty payloads stay
//     undefined; dates go through parseEventDate which also never throws.

import { GEDCStruct, g7ConfGEDC } from './vendor/gedcstruct.js'
import { parseEventDate } from './parseEventDate'
import type { ParsedEventDate } from './parseEventDate'
import { placePayload } from './placePayload'

/** One parsed FAM record: raw payloads plus structured event dates. */
export interface ImportedFamily {
  /** FAM xref (without @), or undefined when the record has none. */
  xref: string | undefined
  /** HUSB pointer payload (xref of husband INDI), or undefined when absent/empty; first occurrence wins. */
  husband: string | undefined
  /** WIFE pointer payload (xref of wife INDI), or undefined when absent/empty; first occurrence wins. */
  wife: string | undefined
  /** CHIL pointer payloads in file order, no dedup, no fabrication. */
  children: string[]
  /** MARR.DATE through parseEventDate, or undefined when absent/empty. */
  marriageDate: ParsedEventDate | undefined
  /** MARR.PLAC through placePayload, or undefined when absent/empty. */
  marriagePlace: string | undefined
  /** DIV.DATE through parseEventDate, or undefined when absent/empty. */
  divorceDate: ParsedEventDate | undefined
  /** RESN verbatim utuh apa adanya (bisa multi-nilai seperti 'CONFIDENTIAL, LOCKED'), undefined bila FAM nihil RESN. */
  resn?: string
}

/** First direct substructure with the given tag, or undefined. */
function subWithTag(
  sup: GEDCStruct | undefined,
  tag: string,
): GEDCStruct | undefined {
  return sup?.sub.find((s) => s.tag === tag)
}

/** String payload of a structure, or undefined for absent/non-string/empty. */
function payloadOf(struct: GEDCStruct | undefined): string | undefined {
  const p = struct?.payload
  return typeof p === 'string' && p !== '' ? p : undefined
}

/**
 * Pointer payload (HUSB/WIFE/CHIL): the vendor resolves a pointer to its
 * target record, so the xref comes from the target's xref_id. Unresolvable
 * pointers are dropped by the vendor itself (with a log); this helper
 * stays honest and never fabricates an xref.
 */
function pointerOf(struct: GEDCStruct | undefined): string | undefined {
  const p = struct?.payload
  return p instanceof GEDCStruct ? (p.xref_id ?? undefined) : undefined
}

/** Event date of an MARR/DIV structure through parseEventDate (never throws). */
function dateOf(event: GEDCStruct | undefined): ParsedEventDate | undefined {
  const raw = payloadOf(subWithTag(event, 'DATE'))
  return raw === undefined ? undefined : parseEventDate(raw)
}

/** Place payload of an MARR structure through placePayload (sanitized). */
function placeOf(event: GEDCStruct | undefined): string | undefined {
  const raw = payloadOf(subWithTag(event, 'PLAC'))
  return raw === undefined ? undefined : placePayload(raw)
}

/**
 * Parses GEDCOM 7.0 text and returns one ImportedFamily per FAM record,
 * in file order. Non-FAM records are ignored. FAM records without a
 * usable xref are skipped honestly (noted via the optional logger, no
 * exception raised). The optional logger also receives vendor parse
 * diagnostics (line, message).
 */
export function importFamilies(
  gedcom: string,
  logger?: (msg: string) => void,
): ImportedFamily[] {
  const records = GEDCStruct.fromString(gedcom, g7ConfGEDC, logger)
  const out: ImportedFamily[] = []
  for (const record of records) {
    if (record.tag !== 'FAM') continue
    if (typeof record.xref_id !== 'string') {
      logger?.('skip FAM record without xref')
      continue
    }
    const marr = subWithTag(record, 'MARR')
    const div = subWithTag(record, 'DIV')
    const children = record.sub
      .filter((s) => s.tag === 'CHIL')
      .map((s) => pointerOf(s))
      .filter((p): p is string => p !== undefined)
    out.push({
      xref: record.xref_id,
      husband: pointerOf(subWithTag(record, 'HUSB')),
      wife: pointerOf(subWithTag(record, 'WIFE')),
      children,
      marriageDate: dateOf(marr),
      marriagePlace: placeOf(marr),
      divorceDate: dateOf(div),
      resn: payloadOf(subWithTag(record, 'RESN')),
    })
  }
  return out
}
