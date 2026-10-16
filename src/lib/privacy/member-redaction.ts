/**
 * Redaksi anggota berdasarkan visibilitas relasi (fase i wiring read path).
 * Modul PURE: tanpa import eksternal selain modul v260-i, tanpa efek samping.
 *
 * applyMemberVisibility memanggil resolveRelationshipVisibility dari
 * relationship-privacy.ts (v260-i) TANPA mengubahnya, lalu meredaksi
 * payload anggota sesuai hasil. redactMember murni bentuk-bentuk subset.
 *
 * Kontrak v261-i: TIDAK ada perubahan pada relationship-privacy.ts,
 * exportPrivacyGate.ts, resn, schema, lockfile.
 */

import {
  resolveRelationshipVisibility,
  type ViewerRelation,
} from './relationship-privacy';

/** Bentuk input anggota yang dibutuhkan redaksi (subset formatMember). */
export interface RedactableMember {
  id: string;
  treeId: string;
  name: string;
  isAlive: boolean;
  privacyStatus?: string | null;
  generation?: number | null;
  gender?: string | null;
}

/** Subset minimal name-only, bentuk eksak sesuai kontrak v261-i. */
export interface NameOnlyMember {
  id: string;
  treeId: string;
  name: string;
  isAlive: boolean;
  generation: number | null;
  gender: string | null;
}

export type RedactedMember = NameOnlyMember | null;

export function redactMember(member: RedactableMember, visibility: 'full' | 'name-only' | 'hidden'): NameOnlyMember | RedactableMember | null {
  if (visibility === 'hidden') return null;
  if (visibility === 'name-only') {
    return {
      id: member.id,
      treeId: member.treeId,
      name: member.name,
      isAlive: member.isAlive,
      generation: member.generation ?? null,
      gender: member.gender ?? null,
    };
  }
  return member;
}

/**
 * Gabungan resolusi visibilitas (v260-i) dan redaksi payload.
 * privacyStatus dan isAlive diambil dari kolom anggota.
 */
export function applyMemberVisibility<T extends RedactableMember>(
  member: T,
  viewerRelation: ViewerRelation,
): T | NameOnlyMember | null {
  const visibility = resolveRelationshipVisibility({
    viewerRelation,
    privacyStatus: (member.privacyStatus as 'shared' | 'private' | null | undefined) ?? null,
    isAlive: member.isAlive,
  });
  return redactMember(member, visibility);
}
