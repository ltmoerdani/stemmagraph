import { useMemo } from 'react';
import { useFamilyStore } from '../store/familyStore';
import {
  buildKinshipGraph,
  type ChildLink,
  type KinshipGraph,
} from '../lib/genealogy/kinship';
import { makePartnerRelation } from '../lib/genealogy/relationship';
import type { FamilyMember } from '../types/family';

/**
 * Hook jembatan store kekerabatan: membangun KinshipGraph murni dari
 * members + relationships dan meneruskan selectedMember dari store.
 *
 * Logika pemetaan mengikuti pola selektor KinshipPanelMount (v141):
 * rel 'spouse' simetris dipetakan ke partner link, rel 'parent'
 * berarah (memberId orang tua, relatedId anak) dipetakan ke ChildLink.
 * Hook ini hanya penyedia data; konsumsi di mount menyusul pada fase
 * refactor berikutnya sehingga tidak ada duplikasi perilaku mount.
 *
 * Pure data: tanpa import server/prisma/API, tanpa efek samping.
 */
interface KinshipGraphState {
  graph: KinshipGraph;
  selectedMember: FamilyMember | null;
}

export function useKinshipGraph(): KinshipGraphState {
  const members = useFamilyStore((s) => s.members);
  const relationships = useFamilyStore((s) => s.relationships);
  const selectedMember = useFamilyStore((s) => s.selectedMember);

  return useMemo(
    () => {
      const persons = members.map((m) => m.id);
      const partnerLinks = relationships
        .filter((r) => r.type === 'spouse')
        .map((r) => makePartnerRelation(r.memberId, r.relatedId));
      const childLinks: ChildLink[] = relationships
        .filter((r) => r.type === 'parent')
        .map((r): ChildLink => ({
          childId: r.relatedId,
          parentId: r.memberId,
          type: 'BIRTH',
        }));
      const graph = buildKinshipGraph(persons, partnerLinks, childLinks);
      return { graph, selectedMember };
    },
    [members, relationships, selectedMember],
  );
}
