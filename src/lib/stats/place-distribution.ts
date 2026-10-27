export interface PlaceDistributionEntry {
  birthPlace?: string;
  currentLocation?: string;
}

export interface PlaceRegionRow {
  region: string;
  count: number;
}

export interface PlaceCountryRow {
  country: string;
  count: number;
  regions: PlaceRegionRow[];
}

export interface PlaceDistributionResult {
  countries: PlaceCountryRow[];
  totalWithPlace: number;
  excludedNoPlace: number;
}

interface AccRegion {
  region: string;
  count: number;
}

interface AccCountry {
  country: string;
  count: number;
  regions: Map<string, AccRegion>;
}

export function computePlaceDistribution(entries: unknown): PlaceDistributionResult {
  if (!Array.isArray(entries)) {
    throw new Error('place-distribution: input harus array');
  }

  const byCountry = new Map<string, AccCountry>();
  let totalWithPlace = 0;
  let excludedNoPlace = 0;

  for (const entry of entries) {
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
      continue;
    }
    const raw = entry as Record<string, unknown>;
    let place = '';
    const birth = raw['birthPlace'];
    const current = raw['currentLocation'];
    if (typeof birth === 'string' && birth.trim() !== '') {
      place = birth.trim();
    } else if (typeof current === 'string' && current.trim() !== '') {
      place = current.trim();
    }

    if (place === '') {
      excludedNoPlace += 1;
      continue;
    }
    totalWithPlace += 1;

    const tokens = place.split(',');
    const country = tokens[tokens.length - 1].trim().toLowerCase();
    let region = '';
    if (tokens.length >= 2) {
      const candidate = tokens[tokens.length - 2].trim().toLowerCase();
      if (candidate !== '') {
        region = candidate;
      }
    }

    let acc = byCountry.get(country);
    if (!acc) {
      acc = { country, count: 0, regions: new Map<string, AccRegion>() };
      byCountry.set(country, acc);
    }
    acc.count += 1;
    if (region !== '') {
      const existing = acc.regions.get(region);
      if (existing) {
        existing.count += 1;
      } else {
        acc.regions.set(region, { region, count: 1 });
      }
    }
  }

  const byName = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
  const countries: PlaceCountryRow[] = Array.from(byCountry.values())
    .map((c) => ({
      country: c.country,
      count: c.count,
      regions: Array.from(c.regions.values()).sort(
        (a, b) => b.count - a.count || byName(a.region, b.region),
      ),
    }))
    .sort((a, b) => b.count - a.count || byName(a.country, b.country));

  return { countries, totalWithPlace, excludedNoPlace };
}
