import { create } from 'zustand';
import { FamilyMember, FamilyStats, ViewMode, TreePosition } from '../types/family';
import { getAdapter, FamilyMemberRecord, MemberRelationship } from '@/lib/adapters';

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

    const spouseRel = rels.find((rel) => rel.type === 'spouse');
    const spouseId = spouseRel
      ? spouseRel.memberId === r.id
        ? spouseRel.relatedId
        : spouseRel.memberId
      : undefined;

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
      spouseId,
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
  addMember: (member: FamilyMember) => Promise<void>;
  updateMember: (id: string, updates: Partial<FamilyMember>) => Promise<void>;
  deleteMember: (id: string) => Promise<void>;
  addMemberWithRelationship: (member: FamilyMember, relationshipType: string, targetMemberId: string) => Promise<void>;
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
      set({ members, isLoading: false });
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
    if (!treeId) return;

    await adapter.createMember(treeId, {
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
    if (!treeId) return;

    const { members } = get();
    const targetMember = members.find((m) => m.id === targetMemberId);
    if (!targetMember) return;

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
    if (relType) {
      await adapter.createRelationship(treeId, record.id, targetMemberId, relType);
    }

    // Re-fetch to get consistent state
    await get().fetchMembers(treeId);
  },
}));