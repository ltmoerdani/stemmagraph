export interface GrandchildFamilyInput {
  familyId: string;
  grandchildIds: string[];
}

export interface RankedGrandchildFamily {
  familyId: string;
  grandchildCount: number;
}

export function topGrandchildFamilies(families: GrandchildFamilyInput[], topN = 10): RankedGrandchildFamily[] {
  // Handle empty input
  if (!families || families.length === 0) {
    return [];
  }

  // Handle non-positive topN
  if (topN <= 0) {
    return [];
  }

  // Process each family: deduplicate grandchild IDs and count unique
  const processed = families.map((family) => {
    const uniqueGrandchildren = new Set(family.grandchildIds);
    const count = uniqueGrandchildren.size;

    // Exclude families with zero unique grandchildren
    if (count === 0) {
      return null;
    }

    return {
      familyId: family.familyId,
      grandchildCount: count,
    };
  });

  // Filter out null entries (families with 0 unique grandchildren)
  const validFamilies = processed.filter((f): f is NonNullable<typeof f> => f !== null);

  // Sort by grandchildCount DESC, then familyId ASC for tie-breaking
  const sorted = validFamilies.sort((a, b) => {
    if (b.grandchildCount !== a.grandchildCount) {
      return b.grandchildCount - a.grandchildCount;
    }
    return a.familyId.localeCompare(b.familyId);
  });

  // Slice to topN
  return sorted.slice(0, topN);
}