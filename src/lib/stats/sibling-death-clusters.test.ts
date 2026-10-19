import { describe, it, expect } from 'vitest';
import { computeSiblingDeathClusters } from './sibling-death-clusters';

function family(deathYears: Array<number | null>) {
  return {
    children: deathYears.map((year) => ({
      deathDate: year === null ? null : `${String(year).padStart(4, '0')}-03-14`,
    })),
  };
}

describe('computeSiblingDeathClusters', () => {
  it('1. returns empty array for empty input', () => {
    expect(computeSiblingDeathClusters([])).toEqual([]);
  });

  it('2. ignores children with null deathDate', () => {
    const families = [
      { children: [{ deathDate: null }, { deathDate: '1888-01-10' }] },
      { children: [{ deathDate: null }] },
    ];
    expect(computeSiblingDeathClusters(families)).toEqual([]);
  });

  it('3. ignores children with invalid deathDate format per record', () => {
    const families = [
      { children: [{ deathDate: 'not-a-date' }, { deathDate: '1888-01-10' }] },
      { children: [{ deathDate: '13/07/1888' }, { deathDate: '1888-06-02' }] },
    ];
    expect(computeSiblingDeathClusters(families)).toEqual([]);
  });

  it('4. single family losing two children in one year does not qualify at default minFamilies', () => {
    const families = [family([1888, 1888, 1890])];
    expect(computeSiblingDeathClusters(families)).toEqual([]);
  });

  it('5. two families losing two children each in the same year form one cluster', () => {
    const families = [family([1888, 1888]), family([1888, 1888])];
    expect(computeSiblingDeathClusters(families)).toEqual([{ year: 1888, families: 2 }]);
  });

  it('6. counts distinct families even when one loses three children in a year', () => {
    const families = [family([1888, 1888, 1888]), family([1888, 1888])];
    expect(computeSiblingDeathClusters(families)).toEqual([{ year: 1888, families: 2 }]);
  });

  it('7. siblings dying in different years do not cluster for that family', () => {
    const families = [family([1887, 1889]), family([1887, 1889])];
    expect(computeSiblingDeathClusters(families)).toEqual([]);
  });

  it('8. aggregates three families per year', () => {
    const families = [family([1902, 1902]), family([1902, 1902]), family([1902, 1902])];
    expect(computeSiblingDeathClusters(families)).toEqual([{ year: 1902, families: 3 }]);
  });

  it('9. only years meeting minFamilies are included', () => {
    const families = [
      family([1902, 1902]),
      family([1902, 1902]),
      family([1905, 1905]),
      family([1905, 1905]),
    ];
    expect(computeSiblingDeathClusters(families, { minFamilies: 2 })).toEqual([
      { year: 1902, families: 2 },
      { year: 1905, families: 2 },
    ]);
  });

  it('10. honors custom minFamilies option', () => {
    const families = [
      family([1902, 1902]),
      family([1902, 1902]),
      family([1902, 1902]),
      family([1905, 1905]),
      family([1905, 1905]),
    ];
    expect(computeSiblingDeathClusters(families, { minFamilies: 3 })).toEqual([
      { year: 1902, families: 3 },
    ]);
  });

  it('11. minFamilies of one admits a single family cluster', () => {
    const families = [family([1888, 1888])];
    expect(computeSiblingDeathClusters(families, { minFamilies: 1 })).toEqual([
      { year: 1888, families: 1 },
    ]);
  });

  it('12. sorts results by year ascending', () => {
    const families = [
      family([1950, 1950]),
      family([1917, 1917]),
      family([1945, 1945]),
      family([1917, 1917]),
      family([1945, 1945]),
      family([1950, 1950]),
    ];
    expect(computeSiblingDeathClusters(families)).toEqual([
      { year: 1917, families: 2 },
      { year: 1945, families: 2 },
      { year: 1950, families: 2 },
    ]);
  });

  it('13. single family tragedies in other years are excluded while clusters remain', () => {
    const families = [
      family([1888, 1888]),
      family([1888, 1888]),
      family([1889]),
      family([1889]),
      family([1891, 1891]),
    ];
    expect(computeSiblingDeathClusters(families)).toEqual([{ year: 1888, families: 2 }]);
  });
});
