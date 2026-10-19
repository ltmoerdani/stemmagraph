import { describe, it, expect } from 'vitest';
import { computeFertilitySpan } from './fertility-span';

describe('computeFertilitySpan', () => {
  it('handles empty input', () => {
    expect(computeFertilitySpan([])).toEqual([]);
  });

  it('handles family with zero or one child with span 0', () => {
    const res = computeFertilitySpan([
      { familyId: 'F1', childBirthDates: [] },
      { familyId: 'F2', childBirthDates: ['2000-01-01'] }
    ]);
    expect(res).toHaveLength(2);
    expect(res[0].spanDays).toBe(0);
    expect(res[1].spanDays).toBe(0);
  });

  it('computes span correctly for multiple children', () => {
    const res = computeFertilitySpan([
      {
        familyId: 'F3',
        childBirthDates: ['2000-01-01', '2005-01-01', '2002-06-15']
      }
    ]);
    expect(res).toHaveLength(1);
    expect(res[0].childCount).toBe(3);
    expect(res[0].spanDays).toBeGreaterThan(0);
    expect(res[0].earliestBirthDate).toBe('2000-01-01');
    expect(res[0].latestBirthDate).toBe('2005-01-01');
  });
});
