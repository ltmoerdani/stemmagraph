export interface FamilyChildrenInput {
  familyId: string;
  childBirthDates: string[];
}

export interface FertilitySpanResult {
  familyId: string;
  childCount: number;
  spanDays: number;
  spanMonths: number;
  earliestBirthDate: string | null;
  latestBirthDate: string | null;
}

export function computeFertilitySpan(families: FamilyChildrenInput[]): FertilitySpanResult[] {
  const sortedFamilies = [...families].sort((a, b) => a.familyId.localeCompare(b.familyId));
  
  return sortedFamilies.map(fam => {
    const validDates = fam.childBirthDates
      .filter(d => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d))
      .map(d => new Date(d).getTime())
      .filter(t => !isNaN(t))
      .sort((a, b) => a - b);

    const childCount = validDates.length;
    if (childCount < 2) {
      return {
        familyId: fam.familyId,
        childCount,
        spanDays: 0,
        spanMonths: 0,
        earliestBirthDate: childCount === 1 ? new Date(validDates[0]).toISOString().slice(0, 10) : null,
        latestBirthDate: childCount === 1 ? new Date(validDates[0]).toISOString().slice(0, 10) : null,
      };
    }

    const minTime = validDates[0];
    const maxTime = validDates[validDates.length - 1];
    const diffMs = maxTime - minTime;
    const spanDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
    
    const d1 = new Date(minTime);
    const d2 = new Date(maxTime);
    const spanMonths = (d2.getUTCFullYear() - d1.getUTCFullYear()) * 12 + (d2.getUTCMonth() - d1.getUTCMonth());

    return {
      familyId: fam.familyId,
      childCount,
      spanDays,
      spanMonths: Math.max(0, spanMonths),
      earliestBirthDate: d1.toISOString().slice(0, 10),
      latestBirthDate: d2.toISOString().slice(0, 10),
    };
  });
}
