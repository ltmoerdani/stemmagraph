import { create } from 'zustand';
import type { FamilyMember, FamilyStats, ViewMode, TreePosition } from '../types/family';
import { getAdapter } from '@/lib/adapters';
import type { FamilyMemberRecord, MemberRelationship } from '@/lib/adapters';

// ─── Adapter ⟷ Legacy Type Bridge ──────────────────────────

/**
 * Merge adapter member records + relationships into the legacy FamilyMember type
 * that the UI components still consume.
 */
function hydrateMembers(
  records: FamilyMemberRecord[],
  relationships: MemberRelationship[],
): FamilyMember[] {
  return records.map((r) => {
    const rels = relationships.filter((rel) => rel.memberId === r.id || rel.relatedId === r.id);

    // QA put-1 Temuan-3: kumpulkan SEMUA rel spouse, bukan cuma find()
    // pertama, agar anggota berpasangan ganda tidak memegang pasangan lama
    // saja. spouseId legacy tetap diisi pasangan pertama demi kompatibilitas.
    // Seed mock menyimpan rel spouse dua arah, jadi dedup sambil jaga urutan.
    const spouseIds = [
      ...new Set(
        rels
          .filter((rel) => rel.type === 'spouse')
          .map((rel) => (rel.memberId === r.id ? rel.relatedId : rel.memberId)),
      ),
    ];

    const parentIds = rels
      .filter((rel) => rel.type === 'parent' && rel.relatedId === r.id)
      .map((rel) => rel.memberId);

    const childrenIds = rels
      .filter((rel) => rel.type === 'parent' && rel.memberId === r.id)
      .map((rel) => rel.relatedId);

    const siblingIds = rels
      .filter((rel) => rel.type === 'sibling' && rel.memberId === r.id)
      .map((rel) => rel.relatedId);

    return {
      id: r.id,
      name: r.name,
      nickname: r.nickname,
      birthDate: r.birthDate,
      deathDate: r.deathDate,
      birthPlace: r.birthPlace,
      currentLocation: r.currentLocation,
      profession: r.profession,
      education: r.education,
      gender: r.gender as 'male' | 'female',
      photoUrl: r.photoUrl,
      spouseId: spouseIds[0],
      spouseIds: spouseIds.length ? spouseIds : undefined,
      parentIds: parentIds.length ? parentIds : undefined,
      childrenIds: childrenIds.length ? childrenIds : undefined,
      siblingIds: siblingIds.length ? siblingIds : undefined,
      email: r.email,
      phone: r.phone,
      isAlive: r.isAlive,
      generation: r.generation,
      maritalStatus: r.maritalStatus,
      created_at: r.createdAt,
      updated_at: r.updatedAt,
    };
  });
}

interface FamilyStore {
  members: FamilyMember[];
  /** Adapter-layer member records, kept as the canonical export source. */
  records: FamilyMemberRecord[];
  /** Adapter-layer relationships, kept as the canonical export source. */
  relationships: MemberRelationship[];
  selectedMember: FamilyMember | null;
  searchQuery: string;
  viewMode: ViewMode;
  treePosition: TreePosition;
  stats: FamilyStats;
  editMode: boolean;
  hasUnsavedChanges: boolean;
  currentFamilyTreeId: string | null;
  isLoading: boolean;

  // Actions
  fetchMembers: (treeId: string) => Promise<void>;
  setMembers: (members: FamilyMember[]) => void;
  setSelectedMember: (member: FamilyMember | null) => void;
  setSearchQuery: (query: string) => void;
  setViewMode: (mode: Partial<ViewMode>) => void;
  setTreePosition: (position: Partial<TreePosition>) => void;
  setEditMode: (enabled: boolean) => void;
  setHasUnsavedChanges: (hasChanges: boolean) => void;
  setCurrentFamilyTreeId: (id: string | null) => void;
  updateStats: () => void;
  addMember: (member: FamilyMember) => Promise<string>;
  updateMember: (id: string, updates: Partial<FamilyMember>) => Promise<void>;
  deleteMember: (id: string) => Promise<void>;
  /** S-14 fix: balikan id record dari adapter (bukan id lokal caller). */
  addMemberWithRelationship: (member: FamilyMember, relationshipType: string, targetMemberId: string) => Promise<string>;
}

function mapRelationshipType(uiType: string): MemberRelationship['type'] | null {
  switch (uiType) {
    case 'husband':
    case 'wife':
    case 'partner':
      return 'spouse';
    case 'father':
    case 'mother':
    case 'grandfather':
    case 'grandmother':
    case 'both_parents':
      return 'parent';
    case 'biological_child':
    case 'step_child':
    case 'adopted_child':
    case 'grandchild':
    case 'great_grandchild':
      return 'child';
    case 'brother':
    case 'sister':
    case 'sibling':
      return 'sibling';
    default:
      return null;
  }
}

export const useFamilyStore = create<FamilyStore>((set, get) => ({
  members: [],
  records: [],
  relationships: [],
  selectedMember: null,
  searchQuery: '',
  viewMode: {
    type: 'tree',
    zoom: 75,
    showDeceased: true,
    showAlive: true,
    selectedGeneration: null,
  },
  treePosition: {
    x: 0,
    y: 0,
    scale: 1,
  },
  editMode: false,
  hasUnsavedChanges: false,
  currentFamilyTreeId: null,
  isLoading: false,
  stats: {
    totalMembers: 0,
    totalGenerations: 0,
    maleCount: 0,
    femaleCount: 0,
    ageDistribution: {
      '0-18': 0,
      '19-35': 0,
      '36-60': 0,
      '60+': 0,
    },
    locationDistribution: {},
  },

  fetchMembers: async (treeId: string) => {
    set({ isLoading: true, currentFamilyTreeId: treeId });
    try {
      const adapter = getAdapter();
      const [records, relationships] = await Promise.all([
        adapter.listMembers(treeId),
        adapter.listRelationships(treeId),
      ]);
      const members = hydrateMembers(records, relationships);
      // records/relationships are kept unmerged so exports read the
      // canonical adapter layer instead of the legacy UI shape.
      set({ members, records, relationships, isLoading: false });
      get().updateStats();
    } catch {
      set({ isLoading: false });
    }
  },

  setMembers: (members) => {
    set({ members });
    get().updateStats();
  },

  setSelectedMember: (member) => set({ selectedMember: member }),

  setSearchQuery: (query) => set({ searchQuery: query }),

  setViewMode: (mode) => set((state) => ({
    viewMode: { ...state.viewMode, ...mode },
  })),

  setTreePosition: (position) => set((state) => ({
    treePosition: { ...state.treePosition, ...position },
  })),

  setEditMode: (enabled) => set({ editMode: enabled }),

  setHasUnsavedChanges: (hasChanges) => set({ hasUnsavedChanges: hasChanges }),

  setCurrentFamilyTreeId: (id: string | null) => set({ currentFamilyTreeId: id }),

  updateStats: () => {
    const { members } = get();
    const currentYear = new Date().getFullYear();

    const stats: FamilyStats = {
      totalMembers: members.length,
      totalGenerations: Math.max(...members.map((m: FamilyMember) => m.generation), 0),
      maleCount: members.filter((m: FamilyMember) => m.gender === 'male').length,
      femaleCount: members.filter((m: FamilyMember) => m.gender === 'female').length,
      ageDistribution: {
        '0-18': 0,
        '19-35': 0,
        '36-60': 0,
        '60+': 0,
      },
      locationDistribution: {},
    };

    members.forEach((member: FamilyMember) => {
      const calculateAge = (m: FamilyMember): number => {
        const birthYear = new Date(m.birthDate).getFullYear();
        if (m.isAlive) return currentYear - birthYear;
        return m.deathDate ? new Date(m.deathDate).getFullYear() - birthYear : 0;
      };

      const age = calculateAge(member);

      if (age <= 18) stats.ageDistribution['0-18']++;
      else if (age <= 35) stats.ageDistribution['19-35']++;
      else if (age <= 60) stats.ageDistribution['36-60']++;
      else stats.ageDistribution['60+']++;

      if (member.currentLocation) {
        stats.locationDistribution[member.currentLocation] =
          (stats.locationDistribution[member.currentLocation] || 0) + 1;
      }
    });

    set({ stats });
  },

  addMember: async (newMember: FamilyMember) => {
    const adapter = getAdapter();
    const treeId = get().currentFamilyTreeId;
    // S-14 U4: no active tree is a real save error, never a silent drop.
    if (!treeId) throw new Error('No active family tree. Please open or create a family tree first, then add the member again.');

    // S-14 fix (QA put-1 T1): id canonical hanya yang dibuat adapter.
    // Kembalikan agar pemanggil (modal reveal) memakai id yang sama dengan store.
    const record = await adapter.createMember(treeId, {
      name: newMember.name,
      nickname: newMember.nickname,
      gender: (newMember.gender as 'male' | 'female' | 'other') || 'male',
      birthDate: newMember.birthDate,
      birthPlace: newMember.birthPlace,
      isAlive: newMember.isAlive ?? true,
      deathDate: newMember.deathDate,
      generation: newMember.generation || 1,
      maritalStatus: newMember.maritalStatus || 'single',
    });

    // Re-fetch to get hydrated members with relationships
    await get().fetchMembers(treeId);
    return record.id;
  },

  updateMember: async (id: string, updates: Partial<FamilyMember>) => {
    const adapter = getAdapter();
    await adapter.updateMember(id, {
      name: updates.name,
      nickname: updates.nickname,
      birthDate: updates.birthDate,
      deathDate: updates.deathDate,
      birthPlace: updates.birthPlace,
      currentLocation: updates.currentLocation,
      profession: updates.profession,
      education: updates.education,
      gender: updates.gender as 'male' | 'female' | 'other',
      photoUrl: updates.photoUrl,
      email: updates.email,
      phone: updates.phone,
      isAlive: updates.isAlive,
      generation: updates.generation,
      maritalStatus: updates.maritalStatus,
    });

    // Optimistic update + re-fetch
    const treeId = get().currentFamilyTreeId;
    if (treeId) await get().fetchMembers(treeId);
    set({ hasUnsavedChanges: true });
  },

  deleteMember: async (id: string) => {
    const adapter = getAdapter();
    await adapter.deleteMember(id);

    const treeId = get().currentFamilyTreeId;
    if (treeId) await get().fetchMembers(treeId);
    set({ hasUnsavedChanges: true });
  },

  addMemberWithRelationship: async (member, relationshipType, targetMemberId) => {
    const adapter = getAdapter();
    const treeId = get().currentFamilyTreeId;
    // S-14 U4: no active tree is a real save error, never a silent drop.
    if (!treeId) throw new Error('No active family tree. Please open or create a family tree first, then add the member again.');

    const { members } = get();
    const targetMember = members.find((m) => m.id === targetMemberId);
    // QA put-1 Temuan-4: target hilang adalah error nyata, jangan senyap.
    // Sebut nama dan id target agar mudah dilacak dari UI maupun log.
    if (!targetMember) {
      throw new Error(
        `Target member for the relationship was not found (id: ${targetMemberId}). Refresh the family tree and try again.`,
      );
    }

    // Calculate generation based on relationship type
    let newGeneration = targetMember.generation;
    switch (relationshipType) {
      case 'father':
      case 'mother':
      case 'grandfather':
      case 'grandmother':
      case 'both_parents':
        newGeneration = targetMember.generation - 1;
        break;
      case 'biological_child':
      case 'step_child':
      case 'adopted_child':
        newGeneration = targetMember.generation + 1;
        break;
      case 'grandchild':
        newGeneration = targetMember.generation + 2;
        break;
      case 'great_grandchild':
        newGeneration = targetMember.generation + 3;
        break;
    }

    // Create member via adapter
    const record = await adapter.createMember(treeId, {
      name: member.name,
      nickname: member.nickname,
      gender: (member.gender as 'male' | 'female' | 'other') || 'male',
      birthDate: member.birthDate,
      birthPlace: member.birthPlace,
      isAlive: member.isAlive ?? true,
      deathDate: member.deathDate,
      generation: newGeneration,
      maritalStatus: member.maritalStatus || 'single',
    });

    // Create relationship via adapter
    const relType = mapRelationshipType(relationshipType);
    if (relType === 'child') {
      // QA put-1 Temuan-2 (OPSI-1): arah relasi anak disimpan sebagai edge
      // parent (memberId = ortu, relatedId = anak) konsisten konvensi seed
      // mock.adapter dan pembaca hydrateMembers yang hanya memahami
      // type 'parent' dengan relatedId === anggota. Tanpa ini edge
      // parentChild tidak pernah terbentuk setelah hidrasi ulang.
      await adapter.createRelationship(treeId, targetMemberId, record.id, 'parent');
    } else if (relType) {
      await adapter.createRelationship(treeId, record.id, targetMemberId, relType);
    }

    // Re-fetch to get consistent state
    await get().fetchMembers(treeId);
    // S-14 fix (QA put-1 T1): kembalikan id record adapter, bukan id lokal
    // member payload. Rantai reveal modal bergantung pada nilai ini.
    return record.id;
  },
}));