export interface SiblingDeathClusterChild {
  deathDate: string | null;
}

export interface SiblingDeathClusterFamily {
  children: SiblingDeathClusterChild[];
}

export interface SiblingDeathClustersOptions {
  minFamilies?: number;
}

export interface SiblingDeathClusterEntry {
  year: number;
  families: number;
}

const ISO_YEAR_PATTERN = /^(\d{4})-(?:\d{2})-(?:\d{2})/;

function parseDeathYear(deathDate: string | null | undefined): number | null {
  if (deathDate === null || deathDate === undefined) {
    return null;
  }
  const match = ISO_YEAR_PATTERN.exec(deathDate);
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  return Number.isFinite(year) ? year : null;
}

export function computeSiblingDeathClusters(
  families: SiblingDeathClusterFamily[],
  options?: SiblingDeathClustersOptions
): SiblingDeathClusterEntry[] {
  const minFamilies = options?.minFamilies ?? 2;
  const familiesPerYear = new Map<number, Set<number>>();

  families.forEach((family, familyIndex) => {
    if (!family || !Array.isArray(family.children)) {
      return;
    }
    const deathsPerYear = new Map<number, number>();
    for (const child of family.children) {
      const year = parseDeathYear(child?.deathDate);
      if (year === null) {
        continue;
      }
      deathsPerYear.set(year, (deathsPerYear.get(year) ?? 0) + 1);
    }
    for (const [year, count] of deathsPerYear) {
      if (count >= 2) {
        let familySet = familiesPerYear.get(year);
        if (!familySet) {
          familySet = new Set<number>();
          familiesPerYear.set(year, familySet);
        }
        familySet.add(familyIndex);
      }
    }
  });

  return Array.from(familiesPerYear.entries())
    .filter(([, familySet]) => familySet.size >= minFamilies)
    .map(([year, familySet]) => ({ year, families: familySet.size }))
    .sort((a, b) => a.year - b.year);
}
