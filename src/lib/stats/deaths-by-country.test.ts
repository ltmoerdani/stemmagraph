import { describe, it, expect } from 'vitest';
import { getDeathsByCountry } from './deaths-by-country';

describe('Deaths by Country additional tests', () => {
  it('handles empty input', () => {
    const res = getDeathsByCountry([]);
    expect(res.items).toEqual([]);
    expect(res.totalDated).toBe(0);
    expect(res.excludedNoPlace).toBe(0);
  });
});
