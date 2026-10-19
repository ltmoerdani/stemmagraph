export interface SexRatioChild {
  sex: string | null;
}

export interface SexRatioFamily {
  children: SexRatioChild[];
}

export interface SexRatioAnomaliesOptions {
  minChildren?: number;
  skewThreshold?: number;
  limit?: number;
}

export interface SexRatioAnomalyEntry {
  maleCount: number;
  femaleCount: number;
  sexedCount: number;
  dominantShare: number;
}

interface SexRatioCandidate extends SexRatioAnomalyEntry {
  index: number;
}

export function computeSexRatioAnomalies(
  families: SexRatioFamily[],
  options?: SexRatioAnomaliesOptions
): SexRatioAnomalyEntry[] {
  if (!Array.isArray(families)) {
    throw new Error('families must be an array');
  }
  const minChildren = options?.minChildren ?? 6;
  const skewThreshold = options?.skewThreshold ?? 0.8;
  const limit = options?.limit ?? 10;

  const candidates: SexRatioCandidate[] = [];

  families.forEach((family, index) => {
    if (!family || !Array.isArray(family.children)) {
      return;
    }
    let maleCount = 0;
    let femaleCount = 0;
    for (const child of family.children) {
      const sex = child?.sex;
      if (sex === null || sex === undefined) {
        continue;
      }
      if (typeof sex !== 'string') {
        throw new Error('child sex must be a string or null');
      }
      const normalized = sex.toUpperCase();
      if (normalized === 'M') {
        maleCount += 1;
      } else if (normalized === 'F') {
        femaleCount += 1;
      }
    }
    const sexedCount = maleCount + femaleCount;
    if (sexedCount < minChildren) {
      return;
    }
    const dominantShare = Math.max(maleCount, femaleCount) / sexedCount;
    if (dominantShare < skewThreshold) {
      return;
    }
    candidates.push({ maleCount, femaleCount, sexedCount, dominantShare, index });
  });

  candidates.sort(
    (a, b) =>
      b.dominantShare - a.dominantShare ||
      b.sexedCount - a.sexedCount ||
      a.index - b.index
  );

  return candidates.slice(0, limit).map((candidate) => ({
    maleCount: candidate.maleCount,
    femaleCount: candidate.femaleCount,
    sexedCount: candidate.sexedCount,
    dominantShare: candidate.dominantShare,
  }));
}
