import type { FamilyMember } from '../../../types/family';

/**
 * Batas generasi default (S-09 AC2): pohon dibuka hanya generasi 1-5
 * dari akar tertua yang dirender penuh. Angka 5 final-via-acceptance-test.
 */
export const DEFAULT_GENERATION_LIMIT = 5;

/** State batas generasi; murni data, disimpan komponen. */
export interface GenerationLimitState {
  /** Jumlah generasi (dari akar tertua) yang dirender penuh. */
  maxGenerations: number;
  /** Cabang (node id) yang diekspansi melewati batas. */
  expandedBranches: ReadonlySet<string>;
  /** Ekspansi penuh seluruh pohon via kontrol eksplisit. */
  fullExpand: boolean;
}

export const DEFAULT_GENERATION_LIMIT_STATE: GenerationLimitState = {
  maxGenerations: DEFAULT_GENERATION_LIMIT,
  expandedBranches: new Set<string>(),
  fullExpand: false,
};

export interface GenerationLimitResult {
  /** Member yang boleh dirender. */
  visibleMembers: FamilyMember[];
  /** Generasi akar tertua sebagai baseline hitungan. */
  rootGeneration: number;
  /** id member terlihat yang punya keturunan tersembunyi -> jumlahnya. */
  hiddenDescendantCounts: Map<string, number>;
  /** Batas generasi tertinggi yang dirender penuh (eksklusif), dari rootGeneration. */
  renderCutoffGeneration: number;
}

/**
 * Indeks anak per orang tua, dari parentIds (otoritatif).
 * Pure: tidak menyentuh store.
 */
export const buildChildMap = (members: FamilyMember[]): Map<string, string[]> => {
  const childMap = new Map<string, string[]>();
  for (const member of members) {
    if (!member.parentIds || member.parentIds.length === 0) continue;
    for (const parentId of member.parentIds) {
      const bucket = childMap.get(parentId);
      if (bucket) {
        bucket.push(member.id);
      } else {
        childMap.set(parentId, [member.id]);
      }
    }
  }
  return childMap;
};

/** Generasi akar tertua (nilai generasi minimum di dataset). */
export const findRootGeneration = (members: FamilyMember[]): number => {
  if (members.length === 0) return 0;
  let root = Number.POSITIVE_INFINITY;
  for (const member of members) {
    const generation = member.generation ?? 0;
    if (generation < root) root = generation;
  }
  return Number.isFinite(root) ? root : 0;
};

/** Apakah member punya leluhur yang sedang diekspansi (cabang terbuka). */
const hasExpandedAncestor = (
  member: FamilyMember,
  byId: Map<string, FamilyMember>,
  expandedBranches: ReadonlySet<string>
): boolean => {
  let frontier: string[] | undefined = member.parentIds;
  const seen = new Set<string>([member.id]);
  while (frontier && frontier.length > 0) {
    const next: string[] = [];
    for (const parentId of frontier) {
      if (expandedBranches.has(parentId)) return true;
      if (seen.has(parentId)) continue;
      seen.add(parentId);
      const parent = byId.get(parentId);
      if (parent?.parentIds) next.push(...parent.parentIds);
    }
    frontier = next;
  }
  return false;
};

/**
 * Terapkan batas generasi (S-09 AC2), pure function.
 *
 * Aturan visibilitas: member terlihat bila generasinya masuk jendela
 * [rootGeneration, rootGeneration + maxGenerations) ATAU ada leluhur
 * yang diekspansi (expand per cabang menurunkan seluruh keturunan
 * cabang itu). fullExpand menampilkan semuanya.
 */
export const applyGenerationLimit = (
  members: FamilyMember[],
  state: GenerationLimitState = DEFAULT_GENERATION_LIMIT_STATE
): GenerationLimitResult => {
  const rootGeneration = findRootGeneration(members);
  const cutoff = rootGeneration + Math.max(1, state.maxGenerations);

  if (state.fullExpand) {
    return {
      visibleMembers: members,
      rootGeneration,
      hiddenDescendantCounts: new Map<string, number>(),
      renderCutoffGeneration: Number.POSITIVE_INFINITY,
    };
  }

  const byId = new Map(members.map((member) => [member.id, member]));
  const visible = new Map<string, FamilyMember>();
  for (const member of members) {
    const generation = member.generation ?? 0;
    const withinWindow = generation < cutoff && generation >= rootGeneration;
    if (withinWindow || hasExpandedAncestor(member, byId, state.expandedBranches)) {
      visible.set(member.id, member);
    }
  }

  // Hitung keturunan tersembunyi per member terlihat (untuk indikator +N).
  const childMap = buildChildMap(members);
  const subtreeSize = new Map<string, number>();
  const countSubtree = (id: string): number => {
    const cached = subtreeSize.get(id);
    if (cached !== undefined) return cached;
    let total = 1; // diri sendiri
    for (const childId of childMap.get(id) ?? []) {
      total += countSubtree(childId);
    }
    subtreeSize.set(id, total);
    return total;
  };
  const hiddenDescendantCounts = new Map<string, number>();
  const countHidden = (id: string): number => {
    let hidden = 0;
    for (const childId of childMap.get(id) ?? []) {
      if (!visible.has(childId)) {
        hidden += countSubtree(childId);
      } else {
        hidden += countHidden(childId);
      }
    }
    return hidden;
  };
  for (const id of visible.keys()) {
    const hidden = countHidden(id);
    if (hidden > 0) hiddenDescendantCounts.set(id, hidden);
  }

  return {
    visibleMembers: Array.from(visible.values()),
    rootGeneration,
    hiddenDescendantCounts,
    renderCutoffGeneration: cutoff,
  };
};

/** Buka satu cabang: menambah node id ke expandedBranches (immutable). */
export const expandBranch = (
  state: GenerationLimitState,
  branchNodeId: string
): GenerationLimitState => ({
  ...state,
  fullExpand: false,
  expandedBranches: new Set(state.expandedBranches).add(branchNodeId),
});

/**
 * Tutup semua cabang + matikan ekspansi penuh: batas kembali default
 * (S-09 AC2: collapse mengembalikan batas).
 */
export const collapseToDefaultLimit = (
  state: GenerationLimitState,
  maxGenerations: number = state.maxGenerations
): GenerationLimitState => ({
  maxGenerations,
  expandedBranches: new Set<string>(),
  fullExpand: false,
});

/** Ekspansi penuh seluruh pohon (kontrol eksplisit, UI wajib konfirmasi). */
export const expandAllGenerations = (state: GenerationLimitState): GenerationLimitState => ({
  ...state,
  fullExpand: true,
});
