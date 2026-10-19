import { describe, it, expect } from 'vitest';
import { computeFertilitySpan } from './fertility-span';

describe('computeFertilitySpan', () => {
  it('returns empty array for empty input', () => {
    expect(computeFertilitySpan([])).toEqual([]);
  });

  it('returns span 0 for a family with zero or one child', () => {
    const res = computeFertilitySpan([
      { familyId: 'F-empty', childBirthDates: [] },
      { familyId: 'F-one', childBirthDates: ['2000-01-01'] },
    ]);
    expect(res).toHaveLength(2);
    expect(res[0]).toMatchObject({ childCount: 0, spanDays: 0, spanMonths: 0, earliestBirthDate: null, latestBirthDate: null });
    expect(res[1]).toMatchObject({ childCount: 1, spanDays: 0, spanMonths: 0, earliestBirthDate: '2000-01-01', latestBirthDate: '2000-01-01' });
  });

  it('returns span 0 when two children share the same date', () => {
    const res = computeFertilitySpan([
      { familyId: 'F-same', childBirthDates: ['2003-07-10', '2003-07-10'] },
    ]);
    expect(res[0]).toMatchObject({ childCount: 2, spanDays: 0, spanMonths: 0, earliestBirthDate: '2003-07-10', latestBirthDate: '2003-07-10' });
  });

  it('computes span for two normal children', () => {
    const res = computeFertilitySpan([
      { familyId: 'F-normal', childBirthDates: ['2000-01-01', '2000-04-01'] },
    ]);
    expect(res[0]).toMatchObject({ childCount: 2, spanDays: 91, spanMonths: 3, earliestBirthDate: '2000-01-01', latestBirthDate: '2000-04-01' });
  });

  it('keeps whole-month boundary at 2 vs 3 months anniversary aware', () => {
    const res = computeFertilitySpan([
      { familyId: 'F-under', childBirthDates: ['2000-01-15', '2000-04-14'] },
      { familyId: 'F-exact', childBirthDates: ['2000-01-15', '2000-04-15'] },
    ]);
    expect(res[0].spanMonths).toBe(3);
    expect(res[1].spanMonths).toBe(2);
  });

  it('handles leap year 29 February dates', () => {
    const res = computeFertilitySpan([
      { familyId: 'F-leap', childBirthDates: ['2000-02-28', '2000-02-29'] },
    ]);
    expect(res[0]).toMatchObject({ childCount: 2, spanDays: 1, spanMonths: 0, earliestBirthDate: '2000-02-28', latestBirthDate: '2000-02-29' });
  });

  it('gives identical results for unsorted and sorted input', () => {
    const unsorted = computeFertilitySpan([
      { familyId: 'F-order', childBirthDates: ['2005-01-01', '2000-01-01'] },
    ]);
    const sorted = computeFertilitySpan([
      { familyId: 'F-order', childBirthDates: ['2000-01-01', '2005-01-01'] },
    ]);
    expect(unsorted).toEqual(sorted);
    expect(unsorted[0].spanDays).toBe(1827);
    expect(unsorted[0].spanMonths).toBe(60);
  });

  it('throws on invalid calendar dates', () => {
    expect(() => computeFertilitySpan([{ familyId: 'F', childBirthDates: ['2000-13-40'] }])).toThrow(Error);
    expect(() => computeFertilitySpan([{ familyId: 'F', childBirthDates: ['abc'] }])).toThrow(Error);
    expect(() => computeFertilitySpan([{ familyId: 'F', childBirthDates: ['2001-02-29'] }])).toThrow(Error);
  });

  it('throws on non strict YYYY-MM-DD formats', () => {
    expect(() => computeFertilitySpan([{ familyId: 'F', childBirthDates: ['2000/01/01'] }])).toThrow(Error);
  });

  it('counts duplicate dates without inflating span', () => {
    const res = computeFertilitySpan([
      { familyId: 'F-dup', childBirthDates: ['2001-05-05', '2001-05-05', '2001-05-05'] },
    ]);
    expect(res[0]).toMatchObject({ childCount: 3, spanDays: 0, spanMonths: 0 });
  });

  it('returns exact whole months across years', () => {
    const res = computeFertilitySpan([
      { familyId: 'F-cross', childBirthDates: ['1999-06-15', '2001-06-15'] },
    ]);
    expect(res[0].spanMonths).toBe(24);
    expect(res[0].spanDays).toBe(731);
  });

  it('is deterministic across two calls', () => {
    const input = [{ familyId: 'F-det', childBirthDates: ['2002-03-03', '1998-11-20', '2000-06-01'] }];
    expect(computeFertilitySpan(input)).toEqual(computeFertilitySpan(input));
  });

  it('preserves familyId verbatim', () => {
    const res = computeFertilitySpan([
      { familyId: ' fAm-01_X ', childBirthDates: ['2000-01-01'] },
    ]);
    expect(res[0].familyId).toBe(' fAm-01_X ');
  });
});
