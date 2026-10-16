/**
 * Resolusi relasi viewer terhadap satu anggota target, berbasis email.
 * Modul PURE: tanpa import eksternal, tanpa efek samping.
 *
 * Fondasi feasibility first-hand 16 Okt 2026:
 * - Tidak ada kolom linkage User ke FamilyMember di schema; identitas
 *   viewer dicocokkan lewat email (FamilyMember.email vs User.email).
 * - Nilai type relasi yang benar-benar dipakai sistem (src/types/family.ts
 *   RelationshipType): 'parent' | 'child' | 'spouse' | 'sibling' |
 *   'grandparent' | 'grandchild'. Kontrak bicara partner; dipetakan dari
 *   'spouse' karena data nyata memakai spouse (exportGedcom70.ts baris 15).
 * - Arah baris relasi (exportGedcom70.ts baris 16-18):
 *   type 'parent' = memberId adalah orang tua dari relatedId;
 *   type 'child'  = memberId adalah anak dari relatedId (invers);
 *   type 'spouse' = simetris.
 *
 * Keputusan konservatif:
 * - Email kosong, tanpa match, atau ambigu (lebih dari satu anggota
 *   dengan email sama) = 'other'.
 * - Nilai type tak dikenal (termasuk grandparent/grandchild) diabaikan.
 * - Bila beberapa relasi menghubungkan viewer dan target, prioritas
 *   core: partner > parent > child > sibling.
 */

import type { ViewerRelation } from './relationship-privacy';

export interface ViewerMemberRef {
  id: string;
  email?: string | null;
}

export interface ViewerRelationshipRef {
  memberId: string;
  relatedId: string;
  type: string;
}

export interface ResolveViewerRelationInput {
  viewerEmail?: string | null;
  members: ViewerMemberRef[];
  relationships: ViewerRelationshipRef[];
  targetMemberId: string;
}

function normalizeEmail(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

export function resolveViewerRelation(input: ResolveViewerRelationInput): ViewerRelation {
  const viewerEmail = normalizeEmail(input.viewerEmail);
  if (!viewerEmail) return 'other';

  const matches = input.members.filter(
    (m) => normalizeEmail(m.email) === viewerEmail,
  );
  if (matches.length !== 1) return 'other'; // tanpa match atau ambigu
  const viewerId = matches[0].id;
  if (viewerId === input.targetMemberId) return 'self';

  const relations: ViewerRelation[] = [];
  for (const rel of input.relationships) {
    const connects =
      (rel.memberId === viewerId && rel.relatedId === input.targetMemberId) ||
      (rel.memberId === input.targetMemberId && rel.relatedId === viewerId);
    if (!connects) continue;

    switch (rel.type) {
      case 'spouse':
        relations.push('partner');
        break;
      case 'sibling':
        relations.push('sibling');
        break;
      case 'parent':
        // memberId adalah orang tua dari relatedId.
        relations.push(rel.memberId === viewerId ? 'parent' : 'child');
        break;
      case 'child':
        // memberId adalah anak dari relatedId (invers parent).
        relations.push(rel.memberId === viewerId ? 'child' : 'parent');
        break;
      default:
        // grandparent, grandchild, atau nilai asing: diabaikan (other).
        break;
    }
  }

  const priority: ViewerRelation[] = ['partner', 'parent', 'child', 'sibling'];
  for (const rel of priority) {
    if (relations.includes(rel)) return rel;
  }
  return 'other';
}
