export interface FamilyChildrenInput {
  familyId: string;
  childIds: string[];
}

export interface ChildrenPerFamilyBucket {
  children: number;
  familyCount: number;
}

export interface ChildrenPerFamilyDistribution {
  distribution: ChildrenPerFamilyBucket[];
  familyCount: number;
  average: number;
}

export function computeChildrenPerFamilyDistribution(
  families: FamilyChildrenInput[],
): ChildrenPerFamilyDistribution {
  if (families.length === 0) {
    return { distribution: [], familyCount: 0, average: 0 };
  }

  const buckets = new Map<number, number>();
  let totalChildren = 0;

  for (const family of families) {
    const childCount = new Set(family.childIds).size;
    totalChildren += childCount;
    buckets.set(childCount, (buckets.get(childCount) ?? 0) + 1);
  }

  const distribution: ChildrenPerFamilyBucket[] = [...buckets.keys()]
    .sort((a, b) => a - b)
    .map((children) => ({
      children,
      familyCount: buckets.get(children) ?? 0,
    }));

  const average = Math.round((totalChildren / families.length) * 10) / 10;

  return { distribution, familyCount: families.length, average };
}
