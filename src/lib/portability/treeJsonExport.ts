// Portability JSON export for Stemmagraph (VISION 2.8 Portability
// Dashboard fase 1, v402).
//
// Pure, deterministic, zero dependencies: no I/O, no clock reads, no
// store access. The export time is an explicit parameter so two calls
// with identical inputs produce byte-identical JSON.
//
// Privacy (v402 AC2): the export privacy gate
// (src/lib/privacy/exportPrivacyGate) remains the single source of
// truth. In 'clean' mode a member the gate labels 'redact' keeps its
// id and relationships so family topology stays intact, its name
// becomes the same '[Living]' marker used by the GEDCOM clean export,
// and every sensitive field is omitted. In 'full' mode the gate
// changes nothing and every field is exported.

import type {
  FamilyMemberRecord,
  MemberRelationship,
} from '../adapters/types'
import {
  buildExportPrivacyReport,
  evaluateMemberPrivacy,
} from '../privacy/exportPrivacyGate'

/** Schema version locked for the fase 1 contract. */
export const TREE_JSON_EXPORT_SCHEMA_VERSION = 'stemmagraph-tree-export/1'

/** NAME marker substituted for redacted living members (GEDCOM parity). */
const REDACTED_NAME = '[Living]'

/** Privacy mode; mirrors the GEDCOM export modes. Default 'clean'. */
export type TreeJsonPrivacyMode = 'clean' | 'full'

export interface TreeJsonExportInput {
  members: FamilyMemberRecord[]
  relationships: MemberRelationship[]
  /** Export timestamp written into the document; required for determinism. */
  exportedAt: Date
  /** Privacy mode; see TreeJsonPrivacyMode. Defaults to 'clean'. */
  privacyMode?: TreeJsonPrivacyMode
  /** Optional tree identity block for the document header. */
  tree?: { id?: string; name?: string }
}

/** Redacted member shape: topology fields only, plus the marker. */
export interface RedactedMemberExport {
  id: string
  name: string
  isAlive: boolean
  generation: number
  redacted: true
}

/** Full member export: every canonical adapter field, minus DB metadata. */
export type FullMemberExport = Omit<
  FamilyMemberRecord,
  'createdAt' | 'updatedAt'
> & { redacted: false }

export type MemberExport = RedactedMemberExport | FullMemberExport

export interface TreeJsonExportDocument {
  schemaVersion: string
  exportedAt: string
  tree?: { id?: string; name?: string }
  privacy: {
    mode: TreeJsonPrivacyMode
    total: number
    livingFull: number
    livingRedacted: number
    deceased: number
  }
  members: MemberExport[]
  relationships: MemberRelationship[]
}

/**
 * Builds the deterministic portability JSON document.
 *
 * Determinism contract: members sorted by id, relationships sorted by
 * id, the only timestamp is exportedAt (serialized as ISO), and no
 * source of randomness. The privacy report counts come from the same
 * gate the GEDCOM path uses, so the numbers can never disagree
 * between export formats.
 */
export function buildTreeJsonExport(
  input: TreeJsonExportInput,
): TreeJsonExportDocument {
  const mode: TreeJsonPrivacyMode = input.privacyMode ?? 'clean'

  const sortedMembers = [...input.members].sort((a, b) =>
    a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
  )
  const sortedRelationships = [...input.relationships].sort((a, b) =>
    a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
  )

  const members: MemberExport[] = sortedMembers.map((member) => {
    if (mode === 'full' || evaluateMemberPrivacy(member) === 'full') {
      const { createdAt: _createdAt, updatedAt: _updatedAt, ...rest } = member
      return { ...rest, redacted: false }
    }
    return {
      id: member.id,
      name: REDACTED_NAME,
      isAlive: member.isAlive,
      generation: member.generation,
      redacted: true,
    }
  })

  return {
    schemaVersion: TREE_JSON_EXPORT_SCHEMA_VERSION,
    exportedAt: input.exportedAt.toISOString(),
    tree: input.tree,
    privacy: {
      mode,
      ...buildExportPrivacyReport(input.members),
    },
    members,
    relationships: sortedRelationships,
  }
}
