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
import type {
  FamilyMemberRecord,
  MemberRelationship,
} from '../adapters/types'

/** Registry-verified GEDCOM 7.0.18 month abbreviations for DateExact. */
const MONTHS = [
  'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
  'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC',
] as const

/** Product identifier written to HEAD.SOUR. */
const PRODUCT_ID = 'Stemmagraph'

/** GEDCOM 7 specification version advertised in HEAD.GEDC.VERS. */
const GEDCOM_VERSION = '7.0'

export interface ExportGedcom70Input {
  members: FamilyMemberRecord[]
  relationships: MemberRelationship[]
  /** Timestamp recorded in HEAD.DATE; defaults to the current time. */
  exportedAt?: Date
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

/** Maps model gender to the GEDCOM 7 SEX enumeration. */
function sexPayload(gender: FamilyMemberRecord['gender']): string {
  switch (gender) {
    case 'male':
      return 'M'
    case 'female':
      return 'F'
    // 'other' has no dedicated model handling yet (planned for the model
    // rework, T0c). 'X' is the standard GEDCOM 7 value for non-binary
    // sex, so exporting it directly keeps the data lossless.
    default:
      return 'X'
  }
}

/** Formats a Date as a GEDCOM 7 DateExact payload, e.g. "18 AUG 2026". */
function dateExact(d: Date): string {
  const day = d.getUTCDate()
  const month = MONTHS[d.getUTCMonth()]
  const year = d.getUTCFullYear()
  return `${day} ${month} ${year}`
}

/** True when the URL can be written as an OBJE>FILE payload. */
function isHttpUrl(url: string): boolean {
  return /^https?:\/\//.test(url)
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
 * - BIRT>DATE / BIRT>PLAC: model strings written as-is. The model stores
 *   free-form date strings and date grammar normalization is explicitly
 *   out of scope for this wave, so a non-GEDCOM-shaped birthDate stays
 *   byte-preserved here (validators will flag it; see worklog S-04).
 * - DEAT: DEAT>DATE when deathDate exists; plain "DEAT Y" when the member
 *   is recorded as not alive without a death date; omitted otherwise.
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

  // INDI records in member id order.
  const indiRecords: GEDCStruct[] = []
  for (const m of members) {
    const indi = new GEDCStruct(
      'INDI',
      null,
      undefined,
      undefined,
      xrefOf.get(m.id),
    )

    // NAME (+ NICK as its substructure, the only legal parent for it).
    if (m.name) {
      const name = new GEDCStruct('NAME', indi, undefined, m.name)
      addText(name, 'NICK', m.nickname)
    }

    new GEDCStruct('SEX', indi, undefined, sexPayload(m.gender))

    if (m.birthDate || m.birthPlace) {
      const birt = new GEDCStruct('BIRT', indi)
      addText(birt, 'DATE', m.birthDate)
      addText(birt, 'PLAC', m.birthPlace)
    }

    if (m.deathDate) {
      const deat = new GEDCStruct('DEAT', indi)
      addText(deat, 'DATE', m.deathDate)
    } else if (!m.isAlive) {
      // Died, but no death date recorded. Payload Y is the standard way
      // to assert the event without a date and keeps DEAT non-empty.
      new GEDCStruct('DEAT', indi, undefined, 'Y')
    }

    addText(indi, 'OCCU', m.profession)
    addText(indi, 'EDUC', m.education)

    // RESI bundles currentLocation + contact fields (see mapping notes).
    if (m.currentLocation || m.email || m.phone) {
      const resi = new GEDCStruct('RESI', indi)
      addText(resi, 'PLAC', m.currentLocation)
      addText(resi, 'EMAIL', m.email)
      addText(resi, 'PHON', m.phone)
    }

    // OBJE>FILE for remotely linkable photos only.
    if (m.photoUrl) {
      if (isHttpUrl(m.photoUrl)) {
        const obje = new GEDCStruct('OBJE', indi)
        new GEDCStruct('FILE', obje, undefined, m.photoUrl)
      } else {
        skippedPhotos.count += 1
      }
    }

    // FAMS / FAMC pointers, in FAM xref order.
    for (const fx of famsOf.get(m.id) ?? []) new GEDCStruct('FAMS', indi, fx)
    for (const fx of famcOf.get(m.id) ?? []) new GEDCStruct('FAMC', indi, fx)

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

    famRecords.push(fam)
  }

  // ---- Serialize -------------------------------------------------------

  const records: GEDCStruct[] = [
    head,
    ...indiRecords,
    ...famRecords,
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
