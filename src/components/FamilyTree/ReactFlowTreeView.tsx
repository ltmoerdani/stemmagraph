import React, { useState } from 'react';
import { ReactFlowFamilyTree } from './ReactFlowFamilyTree';
import { UnifiedMemberModal } from '../Forms/UnifiedMemberModal';
import { useFamilyStore } from '../../store/familyStore';
import type { FamilyMember } from '../../types/family';

interface AddMemberContext {
  relationshipType: string;
  targetMemberId: string;
}

export const ReactFlowTreeView: React.FC = () => {
  const { members, updateMember, deleteMember } = useFamilyStore();
  const [showAddModal, setShowAddModal] = useState(false);
  const [addContext, setAddContext] = useState<AddMemberContext | undefined>(undefined);
  // S-14 U3: id anggota terakhir yang wajib terlihat pasca simpan.
  const [revealMemberId, setRevealMemberId] = useState<string | null>(null);

  const handleMemberUpdate = (updatedMember: FamilyMember) => {
    updateMember(updatedMember.id, updatedMember);
  };

  // S-14 U2: the +child/+spouse context now reaches the modal instead of
  // silently creating an orphan placeholder; the edge itself is created by
  // addMemberWithRelationship inside the modal submit path.
  const handleMemberAdd = (newMember: Partial<FamilyMember>) => {
    if (newMember.parentIds && newMember.parentIds.length > 0) {
      setAddContext({
        relationshipType: 'biological_child',
        targetMemberId: newMember.parentIds[0],
      });
    } else if (newMember.spouseId) {
      setAddContext({
        relationshipType: 'partner',
        targetMemberId: newMember.spouseId,
      });
    } else {
      setAddContext(undefined);
    }
    setShowAddModal(true);
  };

  const handleMemberDelete = (memberId: string) => {
    deleteMember(memberId);
  };

  return (
    <div className="w-full h-full">
      <ReactFlowFamilyTree
        members={members}
        onMemberUpdate={handleMemberUpdate}
        onMemberAdd={handleMemberAdd}
        onMemberDelete={handleMemberDelete}
        revealMemberId={revealMemberId}
        onMemberRevealed={() => setRevealMemberId(null)}
      />
      <UnifiedMemberModal
        isOpen={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          setAddContext(undefined);
        }}
        relationshipContext={addContext}
        onMemberAdded={(id) => setRevealMemberId(id)}
      />
    </div>
  );
};