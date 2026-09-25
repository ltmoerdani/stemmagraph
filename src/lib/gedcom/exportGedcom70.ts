// GEDCOM 7.0 export: maps adapter-layer records to a GEDCOM 7.0 string.
//
// Input contract (adapter layer, src/lib/adapters/types.ts):
//   FamilyMemberRecord[] + MemberRelationship[]
// NOT the legacy FamilyMember shape from familyStore.
//
// Serialization discipline: every line is produced by the vendored
// tag-oriented GEDCStruct layer (src/lib/gedcom/vendor/gedcstruct.js,
// dialect g7ConfGEDC) through manual structure creation. There is no
// hand-rolled byte writer anywhere in this file on purpose: keeping
// serialization inside the tag-oriented layer is what makes the
// fromString/toString round-trip guarantee apply to our output too.
//
// Relationship semantics (mirrors src/store/familyStore.ts):
//   type 'spouse': memberId and relatedId are spouses of each other
//   type 'parent': memberId is the parent, relatedId is the child
//   type 'child' : memberId is the child, relatedId is the parent
//                  (accepted as the inverse of 'parent' for robustness)
//   type 'sibling': ignored; siblinghood is implied in GEDCOM by
//                  sharing a FAM via CHIL, so no extra structure is emitted

import { GEDCStruct } from './vendor/gedcstruct.js'
import { version as appVersion } from '../../../package.json'
import { evaluateMemberPrivacy, isLiving } from '../privacy/exportPrivacyGate'
import { privacyStatusToResn } from '../privacy/resn'
import { parseEventDate } from './parseEventDate'
import { formatGedcomDateValue } from './formatGedcomDate'
import { placePayload } from './placePayload'
import { datePayloadFromGed, sexFromGender } from '../genealogy/gedcom-bridge'
import { toGedcomDateValue } from '../genealogy/genealogical-date'
import type {
  FamilyMemberRecord,
  MemberRelationship,
} from '../adapters/types'
import { famcStatPayload, dateCalPayload } from './stat-cal-import'
import { resolveExportResn } from './resn-export-filter'
import { isNoAssertionEvent } from './no-assertion'
import type { ParsedNoAssertion } from './no-assertion'
import type { ParsedCitation } from './citation'

/** Registry-verified GEDCOM 7.0.18 month abbreviations for DateExact. */
const MONTHS = [
  'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
  'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC',
] as const

/** Product identifier written to HEAD.SOUR. */
const PRODUCT_ID = 'Stemmagraph'

/** GEDCOM 7 specification version advertised in HEAD.GEDC.VERS. */
const GEDCOM_VERSION = '7.0'

/**
 * Export privacy mode (S-06 Wave 1).
 *
 * - 'clean': the share-ready export. Members the privacy gate labels
 *   'redact' (living without explicit 'shared' consent) keep their
 *   INDI record and xref so family topology stays intact, but their
 *   NAME payload becomes "[Living]" and every sensitive
 *   substructure is omitted (see the INDI loop below).
 * - 'full': the private archive export. The gate changes nothing and
 *   the output is byte-identical to the pre-privacy behavior.
 *
 * The default (undefined) keeps the legacy archive behavior so
 * existing callers and verification scripts are unaffected; the UI
 * always passes the mode explicitly.
 */
export type ExportPrivacyMode = 'clean' | 'full'

/** NAME payload substituted for redacted living members. */
const REDACTED_NAME = '[Living]'

export interface ExportGedcom70Input {
  members: FamilyMemberRecord[]
  relationships: MemberRelationship[]
  /** Timestamp recorded in HEAD.DATE; defaults to the current time. */
  exportedAt?: Date
  /** Privacy mode; see ExportPrivacyMode. Defaults to 'full'. */
  privacyMode?: ExportPrivacyMode
  /**
   * Optional FAMC-STAT payloads keyed by member id (childId). When present,
   * the raw STAT payload is written under every FAMC pointer of that child.
   * Limitation: a child with multiple FAMC pointers gets the same STAT under
   * each one; the input shape does not carry per-FAM precision.
   */
  famcStat?: Record<string, string>
  /**
   * Optional per-link PEDI payloads keyed `${famXref}:${childId}`
   * (v159-iv). Per GEDCOM 7, PEDI is a substructure of INDI-FAMC
   * (NOT of CHIL; CHIL only allows PHRASE), so each payload is written
   * verbatim as a PEDI substructure under the matching FAMC pointer in
   * the child's INDI record, mirroring the FAMC-STAT loop above.
   * famXref is the emitted FAM cross-reference id (F1, F2, ... assigned
   * in FAM record order), the same id the FAMC pointer points at, so
   * callers holding an imported FAM record can key by its own xref.
   * A key that matches no emitted FAMC pointer is silently ignored; a
   * child linked to several families gets the PEDI written under each
   * matching pointer (per INDI-FAMC instance, as the spec allows).
   */
  famPedi?: Record<string, string>
  /**
   * Optional member-level RESN payloads keyed by member id (v135,
   * wired through resolveExportResn). A string may carry multiple
   * comma-separated enumset values; arrays pass per value. This
   * event-level RESN overrides the record-level RESN derived from
   * privacyStatus, mirroring effectiveResn precedence. Values the
   * export filter drops (CONFIDENTIAL) remove the RESN entirely.
   */
  memberResn?: Record<string, string | readonly string[]>
  /**
   * Privacy parity flag (v135-ii). When true, the PRIVACY level is also
   * withheld from the written RESN, so privacy-restricted records ship
   * without a marker (spec "Removing data" parity). CONFIDENTIAL stays
   * dropped by resn-export-filter regardless of this flag and LOCKED
   * always passes. Defaults to false: absent or false keeps the output
   * byte-identical to the merged v135 wiring behavior.
   */
  exportPrivacyParity?: boolean
  /**
   * Optional member-level NO (non-event) assertions keyed by member id
   * (v137-ii-b). Each assertion is written as `1 NO <event>` with a
   * `2 DATE <value>` sub-line when the parsed assertion carries a date;
   * payloads pass through verbatim (no normalization), the same
   * discipline the import side uses. Events that are neither an
   * EVEN-enum tag nor an underscore extension tag are skipped so the
   * output stays registry-valid. Absent input keeps the output
   * byte-identical to the pre-v137 behavior.
   */
  memberNoAssertions?: Record<string, ParsedNoAssertion[]>
  /**
   * Optional family-level NO assertions keyed by family key
   * (v137-ii-b). The key is the sorted participant ids joined with a
   * comma: `id1,id2` for a couple family, a bare `id` for a
   * single-parent family. Serialization and validation follow
   * memberNoAssertions. Absent input keeps the output byte-identical.
   */
  familyNoAssertions?: Record<string, ParsedNoAssertion[]>
  /**
   * Optional event-level SOURCE citations keyed by `${memberId}:${TAG}`
   * (v151-iii), e.g. 'I1:BIRT'. Payloads pass through verbatim (no
   * normalization): each citation becomes one `n SOUR` structure under
   * that event structure, with PAGE/QUAY/NOTE sub-lines when the
   * parsed citation carries them. Citations for an event structure
   * that was not created (a redacted member's BIRT, a DEAT with no
   * recorded death) are skipped, keeping the v135 privacy parity.
   * Absent input keeps the output byte-identical.
   */
  memberEventCitations?: Record<string, ParsedCitation[]>
  /**
   * Optional family event-level SOURCE citations keyed by
   * `${familyKey}:${TAG}` (v151-iii), e.g. 'a,b:MARR'. The family key
   * follows familyNoAssertions: sorted participant ids joined with a
   * comma. Serialization follows memberEventCitations. Absent input
   * keeps the output byte-identical.
   */
  familyEventCitations?: Record<string, ParsedCitation[]>
}

export interface ExportGedcom70Stats {
  individuals: number
  families: number
  /** photoUrl values that are not http(s) URLs and were therefore skipped. */
  skippedPhotos: number
}

export interface ExportGedcom70Result {
  gedcom: string
  stats: ExportGedcom70Stats
}

/**
 * Deterministic couple key: lower member id first, joined with a NUL
 * separator (NUL can never appear in ids, so the join is unambiguous).
 */
function coupleKey(a: string, b: string): string {
  return a < b ? `${a}\u0000${b}` : `${b}\u0000${a}`
}

/** Single-parent family key: one NUL-prefixed member id. */
function singleKey(memberId: string): string {
  return `S\u0000${memberId}`
}

/**
 * Maps model gender to the GEDCOM 7 SEX enumeration via the pure
 * genealogy bridge (v116 iv-b). normalizeGender accepts both the new
 * M/F/X/U values and the legacy male/female/other strings; anything
 * unrecognized lands on U (the 7.0 enum's unknown value).
 */
function sexPayload(gender: FamilyMemberRecord['gender']): string {
  return sexFromGender(gender)
}

/** Formats a Date as a GEDCOM 7 DateExact payload, e.g. "18 AUG 2026". */
function dateExact(d: Date): string {
  const day = d.getUTCDate()
  const month = MONTHS[d.getUTCMonth()]
  const year = d.getUTCFullYear()
  return `${day} ${month} ${year}`
}

/**
 * Maps a stored event date string (BIRT/DEAT) to a GEDCOM 7 DateValue
 * payload (S1F4-A). Strings the parser recognizes are normalized to the
 * proper 7.0 grammar (ABT/BEF/AFT/BET..AND, month names, ISO 8601
 * input) while keeping the source precision. Anything the parser cannot
 * read falls back to the raw string, unchanged: a stored precision is
 * never sharpened (ADR 0011, decision 1), and unrecognized text is
 * never rewritten into something that looks authoritative.
 */
function eventDateValue(raw: string): string {
  const formatted = formatGedcomDateValue(parseEventDate(raw))
  return formatted ?? raw
}

/**
 * Event date payload input for the v116 iv-c helper: the legacy raw
 * string (byte-preserved fallback) plus the optional GEDCOM-aligned
 * Ged column (JSON of a GenealogicalDate, v116-ii).
 */
export interface EventDateInput {
  /** Legacy stored string, unchanged from the pre-Ged columns. */
  raw?: string | null
  /** JSON string of a GenealogicalDate; preferred when present. */
  ged?: string | null
}

/**
 * Maps a stored event date (BIRT/DEAT) to a GEDCOM 7 DateValue payload
 * with Ged-column preference (v116 iv-c). When the Ged column is set
 * and parses via the pure bridge (datePayloadFromGed), the value is
 * serialized with toGedcomDateValue exactly as the GenealogicalDate
 * structure says: periods stay FROM-TO, closed ranges stay BET-AND,
 * ABT/CAL/EST keep their approx modifier, and phrases are wrapped
 * intact. No sharpening in either path (ADR 0011, decision 1). When
 * the Ged column is absent, malformed JSON, or fails to parse (or
 * serializes to an empty string), the legacy path runs unchanged:
 * parseEventDate + formatGedcomDateValue with the raw byte-preserved
 * fallback for unrecognized strings.
 */
export function eventDateValueGed(input: EventDateInput): string {
  if (input.ged !== null && input.ged !== undefined && input.ged !== '') {
    const parsed = datePayloadFromGed(input.ged)
    if (parsed !== null) {
      const value = toGedcomDateValue(parsed)
      if (value !== '') return value
    }
  }
  if (input.raw !== null && input.raw !== undefined && input.raw !== '') {
    const cal = dateCalPayload(input.raw)
    if (cal.calendarTag !== undefined || cal.phrase !== undefined) {
      return input.raw.trim()
    }
  }
  return input.raw === null || input.raw === undefined ? '' : eventDateValue(input.raw)
}

/** True when the URL can be written as an OBJE>FILE payload. */
function isHttpUrl(url: string): boolean {
  return /^https?:\/\//.test(url)
}

/**
 * Infers a FORM media type for a photo URL from its file extension.
 * FORM is required under FILE by the 7.0.18 registry, so unknown
 * extensions fall back to the generic application/octet-stream.
 */
const FORM_BY_EXTENSION: Record<string, string> = {
  avif: 'image/avif',
  bmp: 'image/bmp',
  gif: 'image/gif',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  png: 'image/png',
  svg: 'image/svg+xml',
  tif: 'image/tiff',
  tiff: 'image/tiff',
  webp: 'image/webp',
}

function inferForm(url: string): string {
  try {
    const path = new URL(url).pathname
    const dot = path.lastIndexOf('.')
    if (dot >= 0) {
      const ext = path.slice(dot + 1).toLowerCase()
      const form = FORM_BY_EXTENSION[ext]
      if (form) return form
    }
  } catch {
    // Not a parseable URL; fall through to the generic type.
  }
  return 'application/octet-stream'
}

/** Adds a structure with a string payload, skipping empty values. */
function addText(
  sup: GEDCStruct,
  tag: string,
  value: string | undefined,
): GEDCStruct | undefined {
  if (value === undefined || value === '') return undefined
  return new GEDCStruct(tag, sup, undefined, value)
}

/**
 * Writes one NO assertion block under `sup` (v137-ii-b): `NO <event>`
 * with a DATE sub-line when the assertion carries one. Payloads are
 * passed through verbatim; invalid event payloads are skipped so the
 * written structure always satisfies the 7.0.18 NO payload rule
 * (EVEN-enum or underscore extTag, same check the parser applies).
 */
function addNoAssertions(sup: GEDCStruct, list: ParsedNoAssertion[]): void {
  for (const assertion of list) {
    if (!isNoAssertionEvent(assertion.event)) continue
    const no = new GEDCStruct('NO', sup, undefined, assertion.event)
    addText(no, 'DATE', assertion.date)
  }
}

/** Event tags on INDI records that accept member event citations. */
const MEMBER_CITATION_TAGS = ['BIRT', 'DEAT'] as const

/** Event tags on FAM records that accept family event citations. */
const FAMILY_CITATION_TAGS = ['MARR', 'DIV'] as const

/**
 * Writes one citation list as consecutive SOUR structures under an
 * event structure (v151-iii). Payloads pass through verbatim: the
 * pointer payload is written exactly as parsed (including '@VOID@'
 * and free-form pointers), PAGE/QUAY/NOTE become sub-lines only when
 * the parsed citation carries them.
 */
function addCitations(event: GEDCStruct, list: ParsedCitation[]): void {
  for (const c of list) {
    const sour = new GEDCStruct('SOUR', event, undefined, c.sourcePointer)
    addText(sour, 'PAGE', c.page)
    addText(sour, 'QUAY', c.quay)
    addText(sour, 'NOTE', c.note)
  }
}

/**
 * Writes event-level SOURCE citations for one record (v151-iii).
 * `citations` is keyed `${keyPrefix}:${TAG}`; each tag's citation list
 * lands under the event structure of the same tag, in input order
 * (multi-citation = consecutive SOUR lines). A tag with no structure
 * in the record (event not created: redacted BIRT, missing DEAT, MARR
 * from a never-married couple) gets nothing, so the citation cannot
 * resurrect suppressed data. Absent/empty input writes nothing.
 */
function addEventCitations(
  record: GEDCStruct,
  citations: Record<string, ParsedCitation[]> | undefined,
  keyPrefix: string,
  tags: readonly string[],
): void {
  if (citations === undefined) return
  for (const tag of tags) {
    const list = citations[`${keyPrefix}:${tag}`]
    if (list === undefined || list.length === 0) continue
    const event = record.sub.find((s) => s.tag === tag)
    if (event === undefined) continue
    addCitations(event, list)
  }
}

/**
 * Exports a family tree to a GEDCOM 7.0 string.
 *
 * Field mapping decisions (verified against the official 7.0.18 registry,
 * vendored via g7lookups/g7validation at verify time):
 *
 * - NAME: written as-is. The model stores one free-form name string with
 *   no separate given/surname parts, so we do not synthesize "Given
 *   /Surname/" slashes. A plain payload is valid per the Name datatype.
 *   Splitting names properly is deferred to the model rework (T0c).
 * - NICK: substructure of NAME (its only legal parent per the registry).
 * - SEX: male=M, female=F, other=X.
 * - BIRT>DATE / BIRT>PLAC: model strings, with the date going through
 *   parseEventDate + formatGedcomDateValue first (S1F4-A). Recognized
 *   date grammar is written as a proper GEDCOM 7 DateValue: ABT/BEF/
 *   AFT prefixes, BET..AND ranges, and GEDCOM month names, each keeping
 *   exactly the precision recorded in the source (ADR 0011, decision 1:
 *   a stored date is never sharpened). Unrecognized date strings stay
 *   byte-preserved via the raw fallback (validators will flag them;
 *   see worklog S-04). PLAC is written as-is.
 * - DEAT: DEAT>DATE (through the same date normalization as BIRT.DATE,
 *   same raw fallback) when deathDate exists; plain "DEAT Y" when the
 *   member is recorded as not alive without a death date; omitted
 *   otherwise.
 * - EDUC: standard 7.0 tag (verified present under INDI in the registry),
 *   so education needs no extension tag.
 * - OCCU: standard tag.
 * - RESI: currentLocation, email, and phone have no INDI-level standard
 *   slots in 7.0.18 (EMAIL/PHON are only legal under event/fact type
 *   structures), but RESI legally carries PLAC, EMAIL, and PHON, so one
 *   RESI block exports all three. Verified against the registry.
 * - generation: skipped. Internal UI metadata with no genealogical
 *   meaning outside Stemmagraph and no standard counterpart.
 * - notes: skipped in Wave 1 (not part of the S-04 mapping contract).
 * - OBJE>FILE: only http(s) photo URLs; blob:/data: URLs are skipped and
 *   counted in stats.skippedPhotos.
 * - Privacy redaction (S-06 Wave 1): with privacyMode 'clean', members
 *   the gate labels 'redact' (living without explicit 'shared' consent)
 *   keep their INDI record and xref so FAM topology stays intact, but
 *   export NAME payload "[Living]" and omit NICK, BIRT, DEAT, OCCU,
 *   EDUC, RESI, and OBJE. NOTE is not written for anyone in Wave 1
 *   (see above), so there is nothing extra to suppress.
 * - FAM HUSB/WIFE: slots are gender-neutral in 7.0 (confirmed by the
 *   official same-sex-marriage.ged fixture, which uses HUSB + WIFE for
 *   two husbands). Deterministic slot rule: the partner with the lower
 *   id gets the slot matching their SEX; the other partner gets the
 *   remaining slot. Single-parent families use the one slot matching
 *   the parent's SEX.
 * - MARR / DIV: the model stores no marriage dates, so MARR carries
 *   payload "Y" (a bare MARR with nothing else trips the validator's
 *   empty-structure check). A family gets MARR Y when any participant
 *   has maritalStatus married, widowed, or divorced; it additionally
 *   gets DIV Y when any participant is divorced. Widowed keeps MARR
 *   only. Single members produce no family from their status alone.
 * - CHIL: a child goes to the couple FAM when both of its recorded
 *   parents form a spouse pair; otherwise each recorded parent gets a
 *   single-parent FAM containing that child (a child may legitimately
 *   appear as CHIL in more than one FAM, e.g. unmarried parents).
 * - xrefs: deterministic @I<n>@ / @F<n>@, numbered by member id sort
 *   order and family assembly order. Note: the vendored serializer only
 *   prints an xref for records that are actually pointed to, so an
 *   isolated member with no family links serializes as a bare "0 INDI"
 *   line, which is valid GEDCOM 7.
 *
 * Output shape:
 * - HEAD with SOUR Stemmagraph, SOUR>VERS (app version from
 *   package.json), GEDC>VERS 7.0, and DATE (export timestamp). No CHAR:
 *   GEDCOM 7 is UTF-8 only. No UTF-8 BOM either, matching the official
 *   minimal70.ged and maximal70.ged fixtures (same-sex-marriage.ged
 *   upstream ships with a BOM; we consistently ship without one).
 * - INDI records in id order, then FAM records, then TRLR.
 * - The string ends with a trailing newline (TRLR line terminator).
 */
export function exportGedcom70(input: ExportGedcom70Input): ExportGedcom70Result {
  const exportedAt = input.exportedAt ?? new Date()

  // Deterministic member order: by id ascending.
  const members = [...input.members].sort((a, b) =>
    a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
  )
  const memberById = new Map(members.map((m) => [m.id, m]))
  const xrefOf = new Map<string, string>()
  members.forEach((m, i) => xrefOf.set(m.id, `I${i + 1}`))

  // ---- Relationships -------------------------------------------------

  // Spouse pairs, deduplicated across direction (A-B and B-A are one pair)
  // and keyed deterministically.
  const coupleMembers = new Map<string, [string, string]>()
  for (const rel of input.relationships) {
    if (rel.type !== 'spouse') continue
    if (!memberById.has(rel.memberId) || !memberById.has(rel.relatedId)) continue
    if (rel.memberId === rel.relatedId) continue
    coupleMembers.set(coupleKey(rel.memberId, rel.relatedId), [
      rel.memberId < rel.relatedId ? rel.memberId : rel.relatedId,
      rel.memberId < rel.relatedId ? rel.relatedId : rel.memberId,
    ])
  }
  const couples = [...coupleMembers.entries()]
    .sort(([k1], [k2]) => (k1 < k2 ? -1 : k1 > k2 ? 1 : 0))
    .map(([, pair]) => pair)

  // Parent->child edges, deduplicated. 'parent' means memberId is the
  // parent; 'child' is accepted as its inverse. 'sibling' adds nothing.
  const parentEdges = new Map<string, [string, string]>()
  for (const rel of input.relationships) {
    if (rel.type !== 'parent' && rel.type !== 'child') continue
    if (!memberById.has(rel.memberId) || !memberById.has(rel.relatedId)) continue
    const parent = rel.type === 'parent' ? rel.memberId : rel.relatedId
    const child = rel.type === 'parent' ? rel.relatedId : rel.memberId
    if (parent === child) continue
    parentEdges.set(`${parent}\u0000${child}`, [parent, child])
  }

  // Parents of each child (sorted for deterministic iteration).
  const parentsOf = new Map<string, string[]>()
  for (const [parent, child] of parentEdges.values()) {
    const list = parentsOf.get(child) ?? []
    list.push(parent)
    parentsOf.set(child, list)
  }
  for (const list of parentsOf.values()) list.sort()

  // Does this parent form a couple with another recorded parent of child?
  // (Kept as a helper comment; assignment below iterates per child.)

  // Family membership: family key -> { spouseIds, childIds }.
  interface FamPlan {
    participants: string[]
    childIds: string[]
  }
  const famPlans = new Map<string, FamPlan>()
  const getPlan = (key: string, participants: string[]): FamPlan => {
    let plan = famPlans.get(key)
    if (!plan) {
      plan = { participants, childIds: [] }
      famPlans.set(key, plan)
    }
    return plan
  }

  for (const [a, b] of couples) {
    getPlan(coupleKey(a, b), [a, b])
  }

  // Assign each child (sorted for determinism) to family or families:
  // a child goes to the couple FAM when one of its recorded parents
  // forms a couple with another recorded parent of the same child;
  // otherwise each recorded parent gets a single-parent FAM with that
  // child. A child may legitimately appear as CHIL in more than one FAM
  // (e.g. parents who are not recorded as a spouse pair). The assigned
  // set deduplicates couple families discovered via both parent edges.
  const children = [...parentsOf.keys()].sort()
  for (const child of children) {
    const parents = parentsOf.get(child)!
    const assigned = new Set<string>()
    for (const p of parents) {
      const q = parents.find(
        (other) => other !== p && coupleMembers.has(coupleKey(p, other)),
      )
      if (q !== undefined) {
        const key = coupleKey(p, q)
        if (!assigned.has(key)) {
          assigned.add(key)
          getPlan(key, [p, q]).childIds.push(child)
        }
      } else {
        const key = singleKey(p)
        if (!assigned.has(key)) {
          assigned.add(key)
          getPlan(key, [p]).childIds.push(child)
        }
      }
    }
  }

  // Deterministic FAM xrefs: couples in couple-key order first, then
  // single-parent families in parent id order.
  const orderedKeys = [
    ...couples.map(([a, b]) => coupleKey(a, b)),
    ...[...famPlans.keys()]
      .filter((k) => k.startsWith('S\u0000'))
      .sort(),
  ].filter((k) => famPlans.has(k))
  const famXref = new Map<string, string>()
  orderedKeys.forEach((key, i) => famXref.set(key, `F${i + 1}`))

  // FAMs each member participates in as spouse/single parent (FAMS) and
  // as a child (FAMC), in FAM xref order.
  const famsOf = new Map<string, string[]>()
  const famcOf = new Map<string, string[]>()
  const pushUnique = (map: Map<string, string[]>, id: string, xref: string) => {
    const list = map.get(id) ?? []
    if (!list.includes(xref)) list.push(xref)
    map.set(id, list)
  }
  for (const key of orderedKeys) {
    const plan = famPlans.get(key)!
    const fx = famXref.get(key)!
    for (const p of plan.participants) pushUnique(famsOf, p, fx)
    for (const c of plan.childIds) pushUnique(famcOf, c, fx)
  }

  // ---- Structures ------------------------------------------------------

  // HEAD. Substructure order follows the conventional SOUR, GEDC, DATE.
  const head = new GEDCStruct('HEAD', null)
  const sour = new GEDCStruct('SOUR', head, undefined, PRODUCT_ID)
  new GEDCStruct('VERS', sour, undefined, appVersion)
  const gedc = new GEDCStruct('GEDC', head)
  new GEDCStruct('VERS', gedc, undefined, GEDCOM_VERSION)
  new GEDCStruct('DATE', head, undefined, dateExact(exportedAt))

  const skippedPhotos = { count: 0 }
  // Standalone multimedia records for remotely linkable photos.
  const objeRecords: GEDCStruct[] = []

  // INDI records in member id order.
  const indiRecords: GEDCStruct[] = []
  for (const m of members) {
    // One gate call per member: the mapper never re-derives the redact
    // decision itself (S-06: a single gate feeds both export paths).
    // Redacted members keep their INDI record and xref so FAM pointers
    // stay valid; only the sensitive payload below is suppressed.
    const redact =
      input.privacyMode === 'clean' && evaluateMemberPrivacy(m) === 'redact'

    const indi = new GEDCStruct(
      'INDI',
      null,
      undefined,
      undefined,
      xrefOf.get(m.id),
    )

    // NAME (+ NICK as its substructure, the only legal parent for it).
    // Redacted members keep the NAME structure (so topology stays
    // readable in third-party tools) with the payload replaced; NICK
    // is dropped because it can identify a person on its own.
    if (redact) {
      new GEDCStruct('NAME', indi, undefined, REDACTED_NAME)
    } else if (m.name) {
      const name = new GEDCStruct('NAME', indi, undefined, m.name)
      addText(name, 'NICK', m.nickname)
    }

    new GEDCStruct('SEX', indi, undefined, sexPayload(m.gender))

    // RESN PRIVACY menandai living member dengan consent eksplisit
    // 'private' pada arsip full mode (v128-ii-c, notes/297): penerima
    // arsip privat melihat penanda pembatasan RESN. Clean mode meredaksi
    // member ini sebagai gantinya, consent nihil tetap nihil RESN supaya
    // fixture round-trip tetap byte-exact (tanpa penajaman).
    // RESN wiring (v135): record-level RESN still comes from the
    // existing PRIVACY living-private path with its gate conditions
    // untouched (byte-identity when memberResn is absent), then the
    // member-level input.memberResn overrides it via resolveExportResn
    // (event beats record, CONFIDENTIAL is dropped so no RESN line is
    // written at all, PRIVACY/LOCKED are written normalized). Empty
    // resolution writes nothing: no empty RESN tag (notes/303).
    const recordResn =
      input.privacyMode === 'full' &&
      isLiving(m) &&
      m.privacyStatus === 'private'
        ? privacyStatusToResn(m.privacyStatus)
        : null
    const memberResnRaw = input.memberResn?.[m.id]
    const resolvedResn = resolveExportResn({
      resn:
        memberResnRaw === undefined || memberResnRaw === null
          ? null
          : typeof memberResnRaw === 'string'
            ? memberResnRaw
            : memberResnRaw.join(', '),
      resnMulti: recordResn === null ? null : [recordResn],
    })
    // Privacy parity (v135-ii): a caller-side pass over the already
    // normalized resolution. Enum knowledge (normalize, precedence,
    // CONFIDENTIAL drop, LOCKED pass) stays delegated to
    // resn-export-filter; this only withholds the PRIVACY marker when
    // the flag asks for it, so the flag default keeps bytes identical.
    const resnLevels = input.exportPrivacyParity
      ? resolvedResn.filter((level) => level !== 'PRIVACY')
      : resolvedResn
    if (resnLevels.length > 0) {
      new GEDCStruct('RESN', indi, undefined, resnLevels.join(', '))
    }

    // NO assertions (v137-ii-b): written right after the RESN lines,
    // before the event structures. Absent input writes nothing, so the
    // pre-v137 output stays byte-identical.
    const memberNoList = input.memberNoAssertions?.[m.id]
    if (memberNoList !== undefined && memberNoList.length > 0) {
      addNoAssertions(indi, memberNoList)
    }

    // BIRT is omitted entirely for redacted members (DATE and PLAC
    // both reveal identifying data).
    if (!redact && (m.birthDate || m.birthDateGed || m.birthPlace)) {
      const birt = new GEDCStruct('BIRT', indi)
      addText(birt, 'DATE', eventDateValueGed({ raw: m.birthDate, ged: m.birthDateGed }))
      const birtPlace = m.birthPlace ? placePayload(m.birthPlace) : undefined
      if (birtPlace) addText(birt, 'PLAC', birtPlace)
    }

    // The gate labels only living members 'redact', so a redacted INDI
    // carries no DEAT either: a recorded death date on a member treated
    // as living would leak an exact date.
    if (!redact) {
      if (m.deathDate || m.deathDateGed) {
        const deat = new GEDCStruct('DEAT', indi)
        addText(deat, 'DATE', eventDateValueGed({ raw: m.deathDate, ged: m.deathDateGed }))
      } else if (!m.isAlive) {
        // Died, but no death date recorded. Payload Y is the standard way
        // to assert the event without a date and keeps DEAT non-empty.
        new GEDCStruct('DEAT', indi, undefined, 'Y')
      }
    }

    // OCCU and EDUC are omitted for redacted members.
    if (!redact) {
      addText(indi, 'OCCU', m.profession)
      addText(indi, 'EDUC', m.education)
    }

    // RESI bundles currentLocation + contact fields (see mapping
    // notes); the whole block is omitted for redacted members.
    if (!redact && (m.currentLocation || m.email || m.phone)) {
      const resi = new GEDCStruct('RESI', indi)
      const resiPlace = m.currentLocation ? placePayload(m.currentLocation) : undefined
      if (resiPlace) addText(resi, 'PLAC', resiPlace)
      addText(resi, 'EMAIL', m.email)
      addText(resi, 'PHON', m.phone)
    }

    // OBJE: standalone multimedia record pointed to from INDI (see
    // mapping notes; embedded FILE under INDI.OBJE is not legal 7.0).
    // Photos of redacted members are not written at all (neither the
    // pointer nor the standalone record, and not counted as skipped).
    if (!redact && m.photoUrl) {
      if (isHttpUrl(m.photoUrl)) {
        const objeXref = `O${objeRecords.length + 1}`
        const objeRecord = new GEDCStruct('OBJE', null, undefined, undefined, objeXref)
        const file = new GEDCStruct('FILE', objeRecord, undefined, m.photoUrl)
        // FORM is mandatory under FILE per the 7.0.18 registry.
        new GEDCStruct('FORM', file, undefined, inferForm(m.photoUrl))
        objeRecords.push(objeRecord)
        new GEDCStruct('OBJE', indi, objeXref)
      } else {
        skippedPhotos.count += 1
      }
    }

    // FAMS / FAMC pointers, in FAM xref order.
    for (const fx of famsOf.get(m.id) ?? []) new GEDCStruct('FAMS', indi, fx)
    for (const fx of famcOf.get(m.id) ?? []) {
      const famc = new GEDCStruct('FAMC', indi, fx)
      const statRaw = input.famcStat?.[m.id]
      if (statRaw !== undefined && statRaw !== '') {
        // Enum payloads pass through verbatim; raw extTag payloads pass
        // through without normalization (GOAL v125, FAMC-STAT fidelity).
        addText(famc, 'STAT', famcStatPayload(statRaw).value)
      }
      // Per-link PEDI (v159-iv): written under the FAMC pointer (INDI
      // side) verbatim, no normalization; an absent key or empty raw
      // writes nothing. Spec: PEDI's only superstructure is INDI-FAMC.
      const pediRaw = input.famPedi?.[`${fx}:${m.id}`]
      if (pediRaw !== undefined && pediRaw !== '') {
        addText(famc, 'PEDI', pediRaw)
      }
    }

    // Event-level SOURCE citations (v151-iii): routed to the BIRT/DEAT
    // structures that actually exist above; absent input writes nothing.
    addEventCitations(
      indi,
      input.memberEventCitations,
      m.id,
      MEMBER_CITATION_TAGS,
    )

    indiRecords.push(indi)
  }

  // FAM records in xref order.
  const famRecords: GEDCStruct[] = []
  for (const key of orderedKeys) {
    const plan = famPlans.get(key)!
    const fam = new GEDCStruct('FAM', null, undefined, undefined, famXref.get(key))

    // HUSB/WIFE slots: first participant gets the slot matching their
    // SEX, the other gets the remaining slot (works for mixed-sex and
    // same-sex couples alike; see the official same-sex-marriage.ged).
    const [p1, p2] = plan.participants
    const slot1 = sexPayload(memberById.get(p1)!.gender) === 'F' ? 'WIFE' : 'HUSB'
    if (p2 !== undefined) {
      const slot2 = slot1 === 'HUSB' ? 'WIFE' : 'HUSB'
      new GEDCStruct(slot1, fam, xrefOf.get(p1))
      new GEDCStruct(slot2, fam, xrefOf.get(p2))
    } else {
      new GEDCStruct(slot1, fam, xrefOf.get(p1))
    }

    // MARR / DIV derived from marital status of the participants.
    const everMarried = plan.participants.some((p) => {
      const s = memberById.get(p)!.maritalStatus
      return s === 'married' || s === 'widowed' || s === 'divorced'
    })
    const everDivorced = plan.participants.some(
      (p) => memberById.get(p)!.maritalStatus === 'divorced',
    )
    // Marriage dates are not stored in the model, so MARR/DIV carry the
    // bare Y payload instead of a DATE (documented model limitation).
    if (everMarried) new GEDCStruct('MARR', fam, undefined, 'Y')
    if (everDivorced) new GEDCStruct('DIV', fam, undefined, 'Y')

    for (const c of plan.childIds) new GEDCStruct('CHIL', fam, xrefOf.get(c))

    // NO assertions (v137-ii-b): keyed by the sorted participant ids
    // comma-joined ('p1,p2' couple, bare id single-parent). Written at
    // the end of the record; absent input writes nothing.
    const famNoKey =
      plan.participants.length > 1
        ? [...plan.participants].sort().join(',')
        : plan.participants[0]
    const famNoList = input.familyNoAssertions?.[famNoKey]
    if (famNoList !== undefined && famNoList.length > 0) {
      addNoAssertions(fam, famNoList)
    }

    // Event-level SOURCE citations (v151-iii): same family key as the
    // NO assertions above, routed to the MARR/DIV structures that
    // actually exist; absent input writes nothing.
    addEventCitations(
      fam,
      input.familyEventCitations,
      famNoKey,
      FAMILY_CITATION_TAGS,
    )

    famRecords.push(fam)
  }

  // ---- Serialize -------------------------------------------------------

  const records: GEDCStruct[] = [
    head,
    ...indiRecords,
    ...famRecords,
    ...objeRecords,
    new GEDCStruct('TRLR', null),
  ]

  // Register xref ids so string pointer payloads resolve, then resolve.
  // VOID:null mirrors upstream fromString behavior. indiRecords and
  // members share index order (both built in the same loop).
  const ids: Record<string, GEDCStruct | null> = { VOID: null }
  members.forEach((m, i) => {
    ids[xrefOf.get(m.id)!] = indiRecords[i]
  })
  famRecords.forEach((fam, i) => {
    ids[famXref.get(orderedKeys[i])!] = fam
  })
  objeRecords.forEach((obje) => {
    ids[obje.xref_id!] = obje
  })
  records.forEach((r) => r.fixPtrs(ids))

  // GEDCOM 7 dialect: LF newlines, no CONC wrapping, no @# escapes.
  const gedcom = records.map((r) => r.toString('\n', -1, false)).join('')

  return {
    gedcom,
    stats: {
      individuals: members.length,
      families: famRecords.length,
      skippedPhotos: skippedPhotos.count,
    },
  }
}
