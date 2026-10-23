import { describe, it, expect } from 'vitest';
import { getAncestorCountDistribution } from './ancestor-count';

describe('Ancestor Count Distribution additional', () => {
  it('handles empty input', () => {
    const res = getAncestorCountDistribution([]);
    expect(res.items).toEqual([]);
    expect(res.totalPersons).toBe(0);
    expect(res.totalKnownAncestors).toBe(0);
  });
});
