/**
 * Statistik migration flows (polanya wt_statistic.php baris 1228, jangkar getMigrationFlows).
 * Pure function, tanpa I/O, tanpa Date, tanpa random, deterministik.
 */

export interface MigrationRecord {
  id: string;
  birthPlace: string | null;
  deathPlace: string | null;
}

export interface MigrationFlowsResult {
  links: Array<{ source: string; target: string; value: number }>;
  totalPersons: number;
  withBothCountries: number;
  droppedSameCountry: number;
}

const ERROR_PREFIX = 'migration-flows';

function extractCountry(place: string): string {
  const trimmed = place.trim();
  const lastToken = trimmed.includes(',')
    ? trimmed.slice(trimmed.lastIndexOf(',') + 1)
    : trimmed;
  return lastToken.trim().toLowerCase();
}

function assertTopLinks(value: unknown): void {
  if (typeof value !== 'number') {
    throw new Error(`${ERROR_PREFIX}: options.topLinks harus number`);
  }
  if (Number.isNaN(value)) {
    throw new Error(`${ERROR_PREFIX}: options.topLinks tidak boleh NaN`);
  }
  if (!Number.isInteger(value)) {
    throw new Error(`${ERROR_PREFIX}: options.topLinks harus integer`);
  }
  if (value < 1) {
    throw new Error(`${ERROR_PREFIX}: options.topLinks harus >= 1`);
  }
}

/**
 * Hitung arus migrasi antarnegara dari tempat lahir ke tempat meninggal.
 * Record dengan birthPlace/deathPlace null, kosong, atau negara hasil parsing kosong
 * dikecualikan tanpa error. Pasangan source sama dengan target dibuang dari links
 * dan dihitung droppedSameCountry.
 */
export function computeMigrationFlows(
  records: MigrationRecord[],
  options: { topLinks: number },
): MigrationFlowsResult {
  if (!Array.isArray(records)) {
    throw new Error(`${ERROR_PREFIX}: records harus array`);
  }

  assertTopLinks(options.topLinks);

  const counts = new Map<string, number>();
  let withBothCountries = 0;
  let droppedSameCountry = 0;

  for (let index = 0; index < records.length; index += 1) {
    const record: unknown = records[index];
    if (typeof record !== 'object' || record === null || Array.isArray(record)) {
      throw new Error(`${ERROR_PREFIX}: record index ${index} bukan objek`);
    }
    const entry = record as Record<string, unknown>;

    if (typeof entry.id !== 'string' || entry.id === '') {
      throw new Error(`${ERROR_PREFIX}: record index ${index} id harus string non-kosong`);
    }

    if (entry.birthPlace !== null && typeof entry.birthPlace !== 'string') {
      throw new Error(`${ERROR_PREFIX}: record index ${index} birthPlace harus string atau null`);
    }
    if (entry.deathPlace !== null && typeof entry.deathPlace !== 'string') {
      throw new Error(`${ERROR_PREFIX}: record index ${index} deathPlace harus string atau null`);
    }

    const birthValid =
      typeof entry.birthPlace === 'string' && extractCountry(entry.birthPlace) !== '';
    const deathValid =
      typeof entry.deathPlace === 'string' && extractCountry(entry.deathPlace) !== '';

    if (!birthValid || !deathValid) {
      continue;
    }

    withBothCountries += 1;

    const source = extractCountry(entry.birthPlace as string);
    const target = extractCountry(entry.deathPlace as string);

    if (source === target) {
      droppedSameCountry += 1;
      continue;
    }

    const key = `${source}\u0000${target}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const links = Array.from(counts.entries())
    .map(([key, value]) => {
      const separatorIndex = key.indexOf('\u0000');
      return {
        source: key.slice(0, separatorIndex),
        target: key.slice(separatorIndex + 1),
        value,
      };
    })
    .sort((a, b) => {
      if (b.value !== a.value) {
        return b.value - a.value;
      }
      if (a.source !== b.source) {
        return a.source < b.source ? -1 : 1;
      }
      return a.target < b.target ? -1 : a.target > b.target ? 1 : 0;
    })
    .slice(0, options.topLinks);

  return {
    links,
    totalPersons: records.length,
    withBothCountries,
    droppedSameCountry,
  };
}
