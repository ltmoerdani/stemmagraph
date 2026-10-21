import { describe, it, expect } from 'vitest';

export function getDeathsByCountry(persons: any[]) {
  const counts: Record<string, number> = {};
  let dated = 0;
  let excludedNoPlace = 0;

  for (const p of persons) {
    const death = p.deathDate || p.death;
    const place = p.deathPlace || p.place;
    if (death && death.date && place) {
      dated++;
      const country = String(place).trim().toLowerCase();
      counts[country] = (counts[country] || 0) + 1;
    } else {
      excludedNoPlace++;
    }
  }

  const items = Object.entries(counts)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  return { items, totalDated: dated, excludedNoPlace };
}

describe('Deaths by Country', () => {
  it('counts deaths by country correctly', () => {
    const persons = [
      { deathDate: { date: '2020' }, deathPlace: 'Indonesia' },
      { deathDate: { date: '2021' }, deathPlace: 'Indonesia' },
      { deathDate: { date: '2022' }, deathPlace: 'Malaysia' },
      { deathDate: { date: '2023' } }, // excluded
    ];
    const res = getDeathsByCountry(persons);
    expect(res.items).toEqual([
      { label: 'indonesia', count: 2 },
      { label: 'malaysia', count: 1 },
    ]);
    expect(res.totalDated).toBe(3);
    expect(res.excludedNoPlace).toBe(1);
  });
});
