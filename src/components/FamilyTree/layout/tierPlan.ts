/**
 * v458 fase 1: inti murni perhitungan tier layout (TB).
 *
 * Modul ini TIDAK mengimpor tipe React Flow maupun komponen apa pun,
 * hanya data plain, supaya bisa dijalankan identik di main thread dan
 * di dalam Web Worker (payload lolos structured clone tanpa callback).
 * Konstanta dan urutan langkah dipertahankan dari tierLayout.ts lama
 * agar hasil layout identik (refactor non-regresi).
 */
import { compareNames } from '../../../utils/collator';

/** Input minimal per anggota, plain object, aman di-postMessage. */
export interface TierPlanMemberInput {
  id: string;
  name: string;
  generation: number;
  parentIds?: string[];
  spouseId?: string;
}

export interface TierPlanPosition {
  x: number;
  y: number;
}

/** Rencana tier: generasi, posisi Y baris, dan urutan member terurut. */
export interface TierPlanTier {
  generation: number;
  y: number;
  members: string[];
}

/** Hasil rencana tier, seluruhnya plain serializable. */
export interface TierPlanResult {
  positions: Record<string, TierPlanPosition>;
  tiers: TierPlanTier[];
  /** Family group per member id, dipakai stamping data node di main thread. */
  familyGroups: Record<string, string>;
}

// Konstanta dipindah apa adanya dari tierLayout.ts lama.
const TIER_HEIGHT = 350;
const NODE_WIDTH = 280;
const HORIZONTAL_SPACING = 120;
const START_Y = 200;

/**
 * Family group id, dipindah apa adanya dari helper lama di tierLayout.ts:
 * sibling dikelompokkan lewat parentIds, pasangan lewat spouseId.
 */
export const getTierFamilyGroupId = (
  member: Pick<TierPlanMemberInput, 'id' | 'parentIds' | 'spouseId'> | null
): string => {
  if (!member) return 'unknown';
  if (member.parentIds && member.parentIds.length > 0) {
    const sortedParentIds = [...member.parentIds].sort((a, b) => a.localeCompare(b));
    return sortedParentIds.join('-');
  }
  if (member.spouseId) {
    const spouseGroup = [member.id, member.spouseId].sort((a, b) => a.localeCompare(b));
    return spouseGroup.join('-spouse');
  }
  return member.id;
};

/**
 * Inti murni tier layout: menghasilkan rencana posisi + tiers + family
 * groups dari input minimal. Deterministik: input sama menghasilkan
 * rencana sama (urutan sortir stabil via collator).
 */
export const computeTierPlan = (members: TierPlanMemberInput[]): TierPlanResult => {
  // Kelompokkan per generasi.
  const generationMap = new Map<number, TierPlanMemberInput[]>();
  members.forEach((member) => {
    const generation = member.generation ?? 0;
    if (!generationMap.has(generation)) {
      generationMap.set(generation, []);
    }
    generationMap.get(generation)!.push(member);
  });

  const sortedGenerations = Array.from(generationMap.keys()).sort((a, b) => a - b);

  const positions: Record<string, TierPlanPosition> = {};
  const tiers: TierPlanTier[] = [];
  const familyGroups: Record<string, string> = {};

  sortedGenerations.forEach((generation, tierIndex) => {
    const membersInGeneration = generationMap.get(generation)!;
    const y = START_Y + tierIndex * TIER_HEIGHT;

    // Sortir dipertahankan dari tierLayout.ts lama: kelompok keluarga
    // bersebelahan, pasangan berdampingan, lalu nama.
    const sortedMembers = [...membersInGeneration].sort((a, b) => {
      const familyGroupA = getTierFamilyGroupId(a);
      const familyGroupB = getTierFamilyGroupId(b);
      if (familyGroupA !== familyGroupB) {
        return compareNames(familyGroupA, familyGroupB);
      }
      if (a.spouseId === b.id) return -1;
      if (b.spouseId === a.id) return 1;
      return compareNames(a.name, b.name);
    });

    const totalWidth =
      sortedMembers.length * NODE_WIDTH + (sortedMembers.length - 1) * HORIZONTAL_SPACING;
    const startX = -totalWidth / 2;

    sortedMembers.forEach((member, index) => {
      const x = startX + index * (NODE_WIDTH + HORIZONTAL_SPACING);
      positions[member.id] = { x, y };
      familyGroups[member.id] = getTierFamilyGroupId(member);
    });

    tiers.push({
      generation,
      y,
      members: sortedMembers.map((m) => m.id),
    });
  });

  return { positions, tiers, familyGroups };
};
