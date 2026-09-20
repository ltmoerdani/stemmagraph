// GEDCOM 7.0 import: builds a pure import plan from parsed individuals and
// families (S1F6-A).
//
// This planner sits between the sibling parsers (importIndividuals.ts,
// importFamilies.ts) and the future wiring layer. It turns the lossless
// summaries into a plan of PlannedMember + PlannedRelationship entries plus
// an honest skipped list, WITHOUT touching the database, env, or any
// commercial concern (pure-core rule).
//
// Decisions deliberately left to the wiring layer (never fabricated here):
//   treeId, member id, generation, maritalStatus. The plan keeps the
//   GEDCOM xref as the only identity so the wiring layer can map it onto
//   real records.
//
// Relationship semantics mirror the exporter (exportGedcom70.ts):
//   spouse: symmetric; here one edge per valid FAM between HUSB and WIFE.
//   parent: memberXref is the parent, relatedXref is the child; emitted
//           once per valid parent (HUSB and WIFE each) per valid child.
//
// Honesty rules:
//   - Unknown xref (HUSB/WIFE/CHIL pointing outside the individual set):
//     no placeholder member is created, the FAM is noted in skipped with
//     reason 'unknown-xref', and every relation touching that xref is
//     dropped. Relations among the remaining known members are kept.
//   - A FAM with no valid member at all is still recorded in skipped
//     ('unknown-xref' when it referenced unknown xrefs, otherwise
//     'no-valid-member' for an empty family).
//   - Gender mapping is a fixed table: 'M' -> 'male', 'F' -> 'female',
//     anything else -> 'other'. Never guessed.
//   - Dates stay ParsedEventDate as parsed (lossless); names and places
//     pass through unchanged.
//
// Purity contract: pure functions only, no DB, no env, no network, no side
// effects, and never throws on any input.

import type { ImportedIndividual } from './importIndividuals'
import type { ImportedFamily } from './importFamilies'
import type { ParsedEventDate } from './parseEventDate'
import { applyResnToPrivacyStatus } from './resn-import'

/** Gender as planned for the wiring layer; unknown SEX never becomes male/female. */
export type PlannedGender = 'male' | 'female' | 'other'

/** One planned member, keyed by the source GEDCOM xref, fields lossless. */
export interface PlannedMember {
  /** INDI xref as parsed, or undefined when the record had none. */
  xref: string | undefined
  /** NAME payload as written, or undefined when absent. */
  name: string | undefined
  /** 'M' -> male, 'F' -> female, anything else -> 'other' (no guessing). */
  gender: PlannedGender
  birthDate: ParsedEventDate | undefined
  birthPlace: string | undefined
  deathDate: ParsedEventDate | undefined
  deathPlace: string | undefined
  /**
   * Privacy status hasil pemetaan RESN multi-nilai (v130-ii) lewat
   * applyResnToPrivacyStatus. Undefined saat RESN absen maupun tak dikenal:
   * keputusan tetap milik wiring layer, tidak ada fabrikasi nilai.
   */
  privacyStatus?: 'shared' | 'private'
}

/** One planned relation. parent: memberXref is the parent, relatedXref the child. */
export interface PlannedRelationship {
  memberXref: string
  relatedXref: string
  type: 'spouse' | 'parent'
}

/** One FAM that could not be fully planned, with the reason. */
export interface SkippedFamily {
  source: 'FAM'
  xref: string | undefined
  reason: string
}

/** The complete plan handed to the wiring layer. */
export interface ImportPlan {
  members: PlannedMember[]
  relationships: PlannedRelationship[]
  skipped: SkippedFamily[]
}

/** Fixed gender table; no fallback to male/female. */
function plannedGender(sex: string | undefined): PlannedGender {
  if (sex === 'M') return 'male'
  if (sex === 'F') return 'female'
  return 'other'
}

/** Maps one parsed individual losslessly onto a planned member. */
function plannedMember(individual: ImportedIndividual): PlannedMember {
  return {
    xref: individual.xref,
    name: individual.name,
    gender: plannedGender(individual.sex),
    birthDate: individual.birthDate,
    birthPlace: individual.birthPlace,
    deathDate: individual.deathDate,
    deathPlace: individual.deathPlace,
    // RESN multi-nilai: null (absen/tak dikenal) jadi undefined agar
    // backward compatible dengan member tanpa RESN.
    privacyStatus: applyResnToPrivacyStatus(individual.resn) ?? undefined,
  }
}

/**
 * Builds the import plan. Never throws: missing arrays are treated as
 * empty and each FAM is judged member by member, so malformed entries can
 * only ever end up in skipped, never as an exception.
 */
export function buildImportPlan(
  individuals: ImportedIndividual[],
  families: ImportedFamily[],
): ImportPlan {
  const safeIndividuals = Array.isArray(individuals) ? individuals : []
  const safeFamilies = Array.isArray(families) ? families : []

  const members = safeIndividuals.map(plannedMember)

  // Only defined xrefs are addressable; an INDI without xref can never be
  // referenced by a FAM pointer.
  const known = new Set<string>()
  for (const individual of safeIndividuals) {
    if (typeof individual.xref === 'string') known.add(individual.xref)
  }

  // Dedupe identical relation triples, first occurrence wins.
  const seen = new Set<string>()
  const relationships: PlannedRelationship[] = []
  const addRelation = (
    memberXref: string,
    relatedXref: string,
    type: PlannedRelationship['type'],
  ): void => {
    const key = `${memberXref}\u0000${relatedXref}\u0000${type}`
    if (seen.has(key)) return
    seen.add(key)
    relationships.push({ memberXref, relatedXref, type })
  }

  const skipped: SkippedFamily[] = []

  for (const family of safeFamilies) {
    const husband = typeof family.husband === 'string' ? family.husband : undefined
    const wife = typeof family.wife === 'string' ? family.wife : undefined
    const children = Array.isArray(family.children)
      ? family.children.filter((c): c is string => typeof c === 'string')
      : []

    // Unknown pointers: recorded once per FAM, never turned into members.
    const unknown = [husband, wife, ...children].filter(
      (x) => x !== undefined && !known.has(x),
    )

    const validHusband = husband !== undefined && known.has(husband) ? husband : undefined
    const validWife = wife !== undefined && known.has(wife) ? wife : undefined
    const validChildren = children.filter((c) => known.has(c))

    if (unknown.length > 0) {
      skipped.push({ source: 'FAM', xref: family.xref, reason: 'unknown-xref' })
    } else if (
      validHusband === undefined &&
      validWife === undefined &&
      validChildren.length === 0
    ) {
      // Empty family: nothing referenced at all, still worth recording.
      skipped.push({ source: 'FAM', xref: family.xref, reason: 'no-valid-member' })
    }

    // Spouse edge only when both partners are known.
    if (validHusband !== undefined && validWife !== undefined) {
      addRelation(validHusband, validWife, 'spouse')
    }

    // One parent edge per valid parent per valid child (exporter semantics:
    // memberXref is the parent, relatedXref the child).
    for (const child of validChildren) {
      if (validHusband !== undefined) addRelation(validHusband, child, 'parent')
      if (validWife !== undefined) addRelation(validWife, child, 'parent')
    }
  }

  return { members, relationships, skipped }
}
