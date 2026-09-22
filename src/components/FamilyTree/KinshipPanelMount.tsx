import React from 'react';
import { useFamilyStore } from '../../store/familyStore';
import { useKinshipGraph } from '../../hooks/useKinshipGraph';
import { KinshipPanel } from './KinshipPanel';

/**
 * Jembatan store ke panel kekerabatan: data graph dibangun oleh hook
 * useKinshipGraph (members + relationships dari store), komponen
 * merender KinshipPanel untuk selectedMember.
 *
 * Konvensi pemetaan rel kini menjadi milik hook (rel 'spouse' simetris
 * ke partner link, rel 'parent' berarah ke ChildLink, lihat
 * src/hooks/useKinshipGraph.ts). Komponen hanya menambah lookup nama.
 * Pure UI: tanpa import server/prisma/API, tanpa efek samping.
 */
export const KinshipPanelMount: React.FC = () => {
  const { graph, selectedMember } = useKinshipGraph();
  const members = useFamilyStore((s) => s.members);

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
