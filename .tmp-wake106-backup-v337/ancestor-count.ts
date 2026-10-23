import { describe, it, expect } from 'vitest';

export function getAncestorCountDistribution(persons: any[]) {
  const buckets: Record<string, number> = {};
  let totalPersons = persons.length;
  let totalKnownAncestors = 0;

  for (const p of persons) {
    const count = Number(p.ancestorCount || p.ancestorsCount || 0);
    totalKnownAncestors += count;
    const bucket = `${Math.floor(count / 4) * 4}-${Math.floor(count / 4) * 4 + 3}`;
    buckets[bucket] = (buckets[bucket] || 0) + 1;
  }

  const items = Object.entries(buckets)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => a.label.localeCompare(b.label));

  return { items, totalPersons, totalKnownAncestors };
}

describe('Ancestor Count Distribution', () => {
  it('computes distribution correctly', () => {
    const persons = [
      { ancestorCount: 2 },
      { ancestorCount: 5 },
      { ancestorCount: 12 },
    ];
    const res = getAncestorCountDistribution(persons);
    expect(res.totalPersons).toBe(3);
    expect(res.totalKnownAncestors).toBe(19);
  });
});
