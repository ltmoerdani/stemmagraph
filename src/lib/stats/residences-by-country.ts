export interface ResidencesByCountryEntry {
  personId: string;
  residences: string[];
}

export interface ResidencesByCountryRow {
  country: string;
  count: number;
}

export interface ResidencesByCountryResult {
  countries: ResidencesByCountryRow[];
  totalEntries: number;
  uniquePersons: number;
  totalResidences: number;
}

const ERROR_PREFIX = 'residences-by-country';
const PAIR_SEPARATOR = '\u0000';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function computeResidencesByCountry(
  entries: unknown,
): ResidencesByCountryResult {
  if (!Array.isArray(entries)) {
    throw new Error(`${ERROR_PREFIX}: input harus array`);
  }

  const seenPairs = new Set<string>();
  const countryCounts = new Map<string, number>();
  const personIds = new Set<string>();

  for (let index = 0; index < entries.length; index += 1) {
    const entry: unknown = entries[index];
    if (!isRecord(entry)) {
      throw new Error(`${ERROR_PREFIX}: entri index ${index} harus objek`);
    }

    const rawPersonId: unknown = entry.personId;
    if (typeof rawPersonId !== 'string') {
      throw new Error(`${ERROR_PREFIX}: entri index ${index} personId harus string`);
    }

    const rawResidences: unknown = entry.residences;
    if (!Array.isArray(rawResidences)) {
      throw new Error(`${ERROR_PREFIX}: entri index ${index} residences harus array`);
    }

    for (let resIndex = 0; resIndex < rawResidences.length; resIndex += 1) {
      const rawCountry: unknown = rawResidences[resIndex];
      if (typeof rawCountry !== 'string') {
        throw new Error(
          `${ERROR_PREFIX}: entri index ${index} residences[${resIndex}] harus string`,
        );
      }
      const pairKey = `${rawPersonId}${PAIR_SEPARATOR}${rawCountry}`;
      if (!seenPairs.has(pairKey)) {
        seenPairs.add(pairKey);
        countryCounts.set(rawCountry, (countryCounts.get(rawCountry) ?? 0) + 1);
      }
    }

    personIds.add(rawPersonId);
  }

  const countries: ResidencesByCountryRow[] = [];
  for (const [country, count] of countryCounts) {
    countries.push({ country, count });
  }
  countries.sort((a, b) => a.country.localeCompare(b.country));

  return {
    countries,
    totalEntries: entries.length,
    uniquePersons: personIds.size,
    totalResidences: seenPairs.size,
  };
}
