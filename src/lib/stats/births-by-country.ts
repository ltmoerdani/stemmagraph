export interface BirthsByCountryInput {
  birthDate?: { date?: string };
  birthPlace?: string;
}

export interface BirthsByCountryRow {
  label: string;
  count: number;
}

export interface BirthsByCountryResult {
  items: BirthsByCountryRow[];
  totalDated: number;
  excludedNoPlace: number;
}

const ERROR_PREFIX = 'births-by-country';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function extractCountry(place: string): string {
  const trimmed = place.trim();
  const lastToken = trimmed.includes(',')
    ? trimmed.slice(trimmed.lastIndexOf(',') + 1)
    : trimmed;
  return lastToken.trim().toLowerCase();
}

export function computeBirthsByCountry(entries: unknown): BirthsByCountryResult {
  if (!Array.isArray(entries)) {
    throw new Error(`${ERROR_PREFIX}: input harus array`);
  }

  const counts = new Map<string, number>();
  let totalDated = 0;
  let excludedNoPlace = 0;

  for (let index = 0; index < entries.length; index += 1) {
    const entry: unknown = entries[index];
    if (!isRecord(entry)) {
      throw new Error(`${ERROR_PREFIX}: entri index ${index} harus objek`);
    }

    const rawBirthDate: unknown = entry.birthDate;
    if (rawBirthDate !== undefined && !isRecord(rawBirthDate)) {
      throw new Error(`${ERROR_PREFIX}: entri index ${index} birthDate harus objek`);
    }

    const rawDate: unknown =
      rawBirthDate === undefined ? undefined : rawBirthDate.date;
    if (rawDate !== undefined && typeof rawDate !== 'string') {
      throw new Error(`${ERROR_PREFIX}: entri index ${index} birthDate.date harus string`);
    }

    const rawPlace: unknown = entry.birthPlace;
    if (rawPlace !== undefined && typeof rawPlace !== 'string') {
      throw new Error(`${ERROR_PREFIX}: entri index ${index} birthPlace harus string`);
    }

    const hasDatedPlace =
      typeof rawDate === 'string' &&
      rawDate.trim() !== '' &&
      typeof rawPlace === 'string' &&
      rawPlace.trim() !== '';

    if (!hasDatedPlace) {
      excludedNoPlace += 1;
      continue;
    }

    totalDated += 1;
    const label = extractCountry(rawPlace);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  const items: BirthsByCountryRow[] = [];
  for (const [label, count] of counts) {
    if (count > 0) {
      items.push({ label, count });
    }
  }
  items.sort(
    (a, b) => b.count - a.count || a.label.localeCompare(b.label),
  );

  return { items, totalDated, excludedNoPlace };
}
