import React, { useMemo } from 'react';
import { useFamilyStore } from '../../store/familyStore';
import { buildKinshipGraph, type ChildLink } from '../../lib/genealogy/kinship';
import { makePartnerRelation } from '../../lib/genealogy/relationship';
import { KinshipPanel } from './KinshipPanel';

/**
 * Jembatan store ke panel kekerabatan: membangun KinshipGraph murni
 * dari members + relationships lalu merender KinshipPanel untuk
 * selectedMember.
 *
 * Konvensi store: rel 'spouse' simetris (memberId, relatedId pasangan),
 * rel 'parent' berarah (memberId orang tua, relatedId anak), sehingga
 * dipetakan ke ChildLink { childId: relatedId, parentId: memberId }.
 * Pure UI: tanpa import server/prisma/API, tanpa efek samping.
 */
export const KinshipPanelMount: React.FC = () => {
  const members = useFamilyStore((s) => s.members);
  const relationships = useFamilyStore((s) => s.relationships);
  const selectedMember = useFamilyStore((s) => s.selectedMember);

  const graph = useMemo(() => {
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
    return buildKinshipGraph(persons, partnerLinks, childLinks);
  }, [members, relationships]);

  if (!selectedMember) {
    return null;
  }

  const getPersonName = (id: string): string =>
    members.find((m) => m.id === id)?.name ?? id;

  return (
    <KinshipPanel
      graph={graph}
      fromId={selectedMember.id}
      getPersonName={getPersonName}
    />
  );
};
