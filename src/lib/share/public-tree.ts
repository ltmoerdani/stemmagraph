// Public tree payload builder for share links (ADR 0010).
//
// Pure, deterministic, zero dependencies. This module is the single
// source of truth for what a public share-link reader may see. It reuses
// the phase 1 export privacy gate (src/lib/privacy/exportPrivacyGate)
// so the share payload and the clean export can never disagree about
// who is redacted:
//
// - Deceased members (not alive AND with a recorded death date) ship in
//   full, minus the contact fields dropped for everyone below.
// - Living members flagged 'shared' ship in full, same drop list.
// - Living members flagged 'private', or with no flag recorded yet
//   (NULL), are redacted down to { id, generation, visible: false }.
//   The id stays so relationships keep their topology, exactly like the
//   phase 1 gate keeps FAM/CHIL structure in GEDCOM exports.
//
// The conservative living rule of the gate carries over unchanged: when
// the record is incomplete the member is treated as living, which
// redacts rather than leaks.
//
// Contact fields (email, phone) and free-text fields (notes,
// currentLocation, maritalStatus) are dropped for every member, full or
// redacted. A public link is a wider audience than any logged-in role,
// so the payload carries the genealogy, never the contact book.

import {
  evaluateMemberPrivacy,
  isLiving,
} from '../privacy/exportPrivacyGate';

/** Structural member input: any server or adapter record satisfies it. */
export interface ShareSourceMember {
  id: string
  name: string
  nickname?: string | null
  birthDate?: string | null
  deathDate?: string | null
  birthPlace?: string | null
  profession?: string | null
  education?: string | null
  gender?: string | null
  isAlive: boolean
  privacyStatus?: string | null
  generation: number
}

/** Structural relationship input. */
export interface ShareSourceRelationship {
  memberId: string
  relatedId: string
  type: string
}

/** Structural tree input. */
export interface ShareSourceTree {
  name: string
  description?: string | null
  memberCount?: number
  generationCount?: number
}

/**
 * One member in the public payload. Redacted entries carry only id,
 * generation, and visible: false; the JSON serialization therefore
 * contains no name, dates, or any other field for them.
 */
export interface PublicTreeMember {
  id: string
  generation: number
  visible: boolean
  name?: string
  nickname?: string | null
  gender?: string
  birthDate?: string | null
  deathDate?: string | null
  birthPlace?: string | null
  profession?: string | null
  education?: string | null
}

/** One relationship in the public payload (topology is preserved). */
export interface PublicTreeRelationship {
  memberId: string
  relatedId: string
  type: string
}

/** The full public payload served for one share link. */
export interface PublicTreePayload {
  tree: {
    name: string
    description: string | null
    memberCount: number
    generationCount: number
  }
  members: PublicTreeMember[]
  relationships: PublicTreeRelationship[]
  summary: {
    total: number
    visible: number
    redacted: number
  }
}

/**
 * Builds the public payload for one tree. The decision per member comes
 * from evaluateMemberPrivacy, so the safe default (unknown or NULL
 * privacy on a living member) lands on redact here too.
 */
export function buildPublicTreePayload(
  tree: ShareSourceTree,
  members: readonly ShareSourceMember[],
  relationships: readonly ShareSourceRelationship[],
): PublicTreePayload {
  const publicMembers: PublicTreeMember[] = members.map((member) => {
    const decision = evaluateMemberPrivacy({
      isAlive: member.isAlive,
      deathDate: member.deathDate ?? undefined,
      privacyStatus: (member.privacyStatus ?? undefined) as
        | 'shared'
        | 'private'
        | undefined,
    });

    if (decision === 'redact') {
      return {
        id: member.id,
        generation: member.generation,
        visible: false,
      };
    }

    return {
      id: member.id,
      generation: member.generation,
      visible: true,
      name: member.name,
      nickname: member.nickname ?? null,
      gender: member.gender ?? 'male',
      birthDate: member.birthDate ?? null,
      deathDate: member.deathDate ?? null,
      birthPlace: member.birthPlace ?? null,
      profession: member.profession ?? null,
      education: member.education ?? null,
    };
  });

  const visible = publicMembers.filter((member) => member.visible).length;

  return {
    tree: {
      name: tree.name,
      description: tree.description ?? null,
      memberCount: members.length,
      generationCount: tree.generationCount ?? 0,
    },
    members: publicMembers,
    relationships: relationships.map((rel) => ({
      memberId: rel.memberId,
      relatedId: rel.relatedId,
      type: rel.type,
    })),
    summary: {
      total: publicMembers.length,
      visible,
      redacted: publicMembers.length - visible,
    },
  };
}

// isLiving is re-exported for the server route so the og-image and page
// builders read the same living rule instead of re-deriving one.
export { isLiving };
