// GEDCOM 7.0 import: parses INDI records from a GEDCOM 7.0 string into
// plain, lossless individual summaries (S1F5-A).
//
// Parsing discipline mirrors the exporter (exportGedcom70.ts): input goes
// through the same vendored tag-oriented GEDCStruct layer
// (src/lib/gedcom/vendor/gedcstruct.js, dialect g7ConfGEDC) so the
// fromString/toString round-trip guarantee covers the import path too.
// There is no hand-rolled line splitter anywhere in this file.
//
// Scope (S1F5-A, deliberately narrow):
//   - INDI records only: xref, NAME, SEX, BIRT (DATE/PLAC), DEAT (DATE/PLAC).
//   - FAM/HEAD/SOUR/OBJE records are ignored here; relationships and media
//     wiring are follow-up items (S1F5-B onward).
//   - Output is a summary, NOT a FamilyMemberRecord: this lib never
//     fabricates treeId/generation/maritalStatus, and it keeps the raw SEX
//     payload instead of guessing a model gender. Mapping decisions belong
//     to the wiring layer, not the parser.
//
// Purity contract (same family as parseEventDate/placePayload):
//   - Pure functions: no DB, no env, no network, no side effects. The
//     pure-core rule (no commercial code) applies: this parser only reads
//     genealogical payloads and never touches monetization concerns.
//   - Never throws on malformed GEDCOM: the vendor parser logs broken
//     lines via the optional logger and skips them; empty payloads stay
//     undefined; dates go through parseEventDate which also never throws.

import { GEDCStruct, g7ConfGEDC } from './vendor/gedcstruct.js'
import { parseEventDate } from './parseEventDate'
import type { ParsedEventDate } from './parseEventDate'
import { placePayload } from './placePayload'
import { parseNoLines } from './no-assertion'
import type { ParsedNoAssertion } from './no-assertion'

/** One parsed INDI record: raw payloads plus structured event dates. */
export interface ImportedIndividual {
  /** Recommended xref of the INDI record (without @), or undefined when the record has none. */
  xref: string | undefined
  /** NAME payload as written (may be the redacted "[Living]" text), or undefined when absent. */
  name: string | undefined
  /** SEX payload as written ('M'/'F'/'X' on our own exports), or undefined when absent. */
  sex: string | undefined
  /** BIRT.DATE through parseEventDate, or undefined when absent/empty. */
  birthDate: ParsedEventDate | undefined
  /** BIRT.PLAC through placePayload, or undefined when absent/empty. */
  birthPlace: string | undefined
  /** DEAT.DATE through parseEventDate, or undefined when absent/empty. */
  deathDate: ParsedEventDate | undefined
  /** DEAT.PLAC through placePayload, or undefined when absent/empty. */
  deathPlace: string | undefined
  /** RESN payload verbatim (mapping is the consumer's job, not this parser), or undefined when absent. */
  resn: string | undefined
  /** NO assertions hasil parseNoLines (payload mentah diteruskan, tanpa normalisasi), kosong bila record nihil NO. */
  noAssertions?: ParsedNoAssertion[]
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

/** Event date of a BIRT/DEAT structure through parseEventDate (never throws). */
function dateOf(event: GEDCStruct | undefined): ParsedEventDate | undefined {
  const raw = payloadOf(subWithTag(event, 'DATE'))
  return raw === undefined ? undefined : parseEventDate(raw)
}

/** Place payload of a BIRT/DEAT structure through placePayload (sanitized). */
function placeOf(event: GEDCStruct | undefined): string | undefined {
  const raw = payloadOf(subWithTag(event, 'PLAC'))
  return raw === undefined ? undefined : placePayload(raw)
}

/**
 * Serializes one NO subtree back to depth-tagged lines so parseNoLines
 * can do its job on the exact payloads as written. Payloads are passed
 * through verbatim: no normalization, same discipline as RESN.
 */
function noLinesOf(no: GEDCStruct, depth: number): string[] {
  const line = `${depth} ${no.tag}${typeof no.payload === 'string' && no.payload !== '' ? ` ${no.payload}` : ''}`
  return [line, ...no.sub.flatMap((s) => noLinesOf(s, depth + 1))]
}

/** NO assertions of an INDI record via parseNoLines (pure, never throws). */
function noAssertionsOf(record: GEDCStruct): ParsedNoAssertion[] {
  const lines = record.sub
    .filter((s) => s.tag === 'NO')
    .flatMap((s) => noLinesOf(s, 1))
  return lines.length === 0 ? [] : parseNoLines(lines).assertions
}

/**
 * Parses GEDCOM 7.0 text and returns one ImportedIndividual per INDI
 * record, in file order. Non-INDI records are ignored. The optional
 * logger receives vendor parse diagnostics (line, message) without any
 * exception being raised.
 */
export function importIndividuals(
  gedcom: string,
  logger?: (msg: string) => void,
): ImportedIndividual[] {
  const records = GEDCStruct.fromString(gedcom, g7ConfGEDC, logger)
  const out: ImportedIndividual[] = []
  for (const record of records) {
    if (record.tag !== 'INDI') continue
    const birt = subWithTag(record, 'BIRT')
    const deat = subWithTag(record, 'DEAT')
    out.push({
      xref: record.xref_id,
      name: payloadOf(subWithTag(record, 'NAME')),
      sex: payloadOf(subWithTag(record, 'SEX')),
      birthDate: dateOf(birt),
      birthPlace: placeOf(birt),
      deathDate: dateOf(deat),
      deathPlace: placeOf(deat),
      resn: payloadOf(subWithTag(record, 'RESN')),
      noAssertions: noAssertionsOf(record),
    })
  }
  return out
}
