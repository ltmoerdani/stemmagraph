export interface NamePassdownPair {
  parentGivn: string;
  childGivn: string;
  childBirthYear: number | null;
  parentSex: string | null;
}

export interface NamePassdownResult {
  categories: number[];
  fatherSon: (number | null)[];
  motherDaughter: (number | null)[];
}

interface CenturyBucket {
  total: number;
  matches: number;
}

const MIN_COHORT_SIZE = 10;

function normalizeToken(token: string): string {
  return token
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function tokenize(givn: string): Set<string> {
  const tokens = new Set<string>();
  if (typeof givn !== 'string') {
    return tokens;
  }
  for (const raw of givn.split(' ')) {
    const token = normalizeToken(raw.trim());
    if (token.length >= 2) {
      tokens.add(token);
    }
  }
  return tokens;
}

function toCentury(year: number): number {
  return Math.floor(year / 100) * 100;
}

function hasSharedToken(parentTokens: Set<string>, childTokens: Set<string>): boolean {
  for (const token of parentTokens) {
    if (childTokens.has(token)) {
      return true;
    }
  }
  return false;
}

function seriesValue(bucket: CenturyBucket | undefined): number | null {
  if (!bucket || bucket.total < MIN_COHORT_SIZE) {
    return null;
  }
  return Math.round((bucket.matches / bucket.total) * 10000) / 10000;
}

export function computeSameSexNamePassdown(pairs: NamePassdownPair[]): NamePassdownResult {
  if (!Array.isArray(pairs)) {
    throw new Error('pairs must be an array');
  }

  const fatherSon = new Map<number, CenturyBucket>();
  const motherDaughter = new Map<number, CenturyBucket>();

  for (const pair of pairs) {
    if (!pair) {
      continue;
    }
    const year = pair.childBirthYear;
    if (
      year === null ||
      year === undefined ||
      typeof year !== 'number' ||
      Number.isNaN(year) ||
      year === 0
    ) {
      continue;
    }
    const sex = typeof pair.parentSex === 'string' ? pair.parentSex.toUpperCase() : null;
    if (sex !== 'M' && sex !== 'F') {
      continue;
    }
    const parentTokens = tokenize(pair.parentGivn);
    const childTokens = tokenize(pair.childGivn);
    if (parentTokens.size === 0 || childTokens.size === 0) {
      continue;
    }

    const century = toCentury(year);
    const series = sex === 'M' ? fatherSon : motherDaughter;
    const bucket = series.get(century) ?? { total: 0, matches: 0 };
    bucket.total += 1;
    if (hasSharedToken(parentTokens, childTokens)) {
      bucket.matches += 1;
    }
    series.set(century, bucket);
  }

  const centurySet = new Set<number>([...fatherSon.keys(), ...motherDaughter.keys()]);
  const categories = [...centurySet].sort((a, b) => a - b);

  return {
    categories,
    fatherSon: categories.map((century) => seriesValue(fatherSon.get(century))),
    motherDaughter: categories.map((century) => seriesValue(motherDaughter.get(century))),
  };
}
