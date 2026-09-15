import type { FamilyMember } from '../../../types/family';

/**
 * Hidrasi inkremental (S-09 AC4).
 *
 * Konstruksi nodes/edges di-memo per lingkup generasi: entri cache
 * bertahan selama objek sumber (member di familyStore) tidak berubah
 * identitas referensinya, sehingga expand satu cabang hanya membuat
 * node generasi baru cabang itu. Node lama dipakai ulang dengan
 * referensi objek identik; React Flow tidak me-remount bagian tak
 * berubah. Tidak ada storage baru: cache ini murni cache render.
 */
export interface StableHydrationEntry<S, V> {
  /** Objek sumber yang menjadi dasar nilai; dibandingkan per referensi. */
  sources: readonly S[];
  value: V;
}

export interface HydrationSpec<S, V> {
  key: string;
  sources: readonly S[];
  build: () => V;
}

export interface HydrationOutput<S, V> {
  values: V[];
  cache: Map<string, StableHydrationEntry<S, V>>;
}

/**
 * Hidrasi stabil per kunci (id node / id edge). Bila sources identik
 * dengan cache, nilai lama dipakai ulang (referensi stabil).
 */
export const hydrateStableByKey = <S, V>(
  previous: ReadonlyMap<string, StableHydrationEntry<S, V>>,
  desired: ReadonlyArray<HydrationSpec<S, V>>
): HydrationOutput<S, V> => {
  const cache = new Map<string, StableHydrationEntry<S, V>>();
  const values: V[] = [];
  for (const spec of desired) {
    const prev = previous.get(spec.key);
    const reusable =
      prev !== undefined &&
      prev.sources.length === spec.sources.length &&
      prev.sources.every((source, index) => source === spec.sources[index]);
    if (reusable && prev) {
      cache.set(spec.key, prev);
      values.push(prev.value);
    } else {
      const value = spec.build();
      cache.set(spec.key, { sources: spec.sources, value });
      values.push(value);
    }
  }
  return { values, cache };
};

/** Kelompokkan member per generasi (kunci terurut) untuk memo per lingkup. */
export const groupMembersByGeneration = (
  members: ReadonlyArray<FamilyMember>
): Map<number, FamilyMember[]> => {
  const byGeneration = new Map<number, FamilyMember[]>();
  for (const member of members) {
    const generation = member.generation ?? 0;
    const bucket = byGeneration.get(generation);
    if (bucket) {
      bucket.push(member);
    } else {
      byGeneration.set(generation, [member]);
    }
  }
  return new Map(
    Array.from(byGeneration.entries()).sort((a, b) => a[0] - b[0])
  );
};
