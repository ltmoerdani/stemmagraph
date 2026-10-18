export interface TopFamiliesInput {
  familyId: string;
  childIds: string[];
}

export interface RankedFamily {
  familyId: string;
  childCount: number;
}

export function rankFamiliesByChildren(
  families: TopFamiliesInput[],
  topN = 10,
): RankedFamily[] {
  if (topN <= 0) {
    return [];
  }

  const ranked: RankedFamily[] = [];
  for (const family of families) {
    const childCount = family.childIds.length;
    if (childCount > 0) {
      ranked.push({ familyId: family.familyId, childCount });
    }
  }

  ranked.sort((a, b) => {
    if (b.childCount !== a.childCount) {
      return b.childCount - a.childCount;
    }
    if (a.familyId < b.familyId) {
      return -1;
    }
    if (a.familyId > b.familyId) {
      return 1;
    }
    return 0;
  });

  return ranked.slice(0, topN);
}
