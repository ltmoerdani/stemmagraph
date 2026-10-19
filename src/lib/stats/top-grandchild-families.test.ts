import { describe, it, expect } from 'vitest';
import { topGrandchildFamilies, GrandchildFamilyInput } from './top-grandchild-families';

describe('topGrandchildFamilies (v309)', () => {
  it('handles empty input and non-positive topN', () => {
    expect(topGrandchildFamilies([], 10)).toEqual([]);
    expect(topGrandchildFamilies([{ familyId: 'f1', grandchildIds: ['c1'] }], 0)).toEqual([]);
    expect(topGrandchildFamilies([{ familyId: 'f1', grandchildIds: ['c1'] }], -5)).toEqual([]);
  });

  it('ranks families by grandchild count descending with tie-break familyId ascending', () => {
    const families: GrandchildFamilyInput[] = [
      { familyId: 'famB', grandchildIds: ['c1'] },
      { familyId: 'famA', grandchildIds: ['c2', 'c3'] },
      { familyId: 'famC', grandchildIds: ['c4', 'c5'] },
    ];
    const res = topGrandchildFamilies(families, 10);
    expect(res).toEqual([
      { familyId: 'famA', grandchildCount: 2 },
      { familyId: 'famC', grandchildCount: 2 },
      { familyId: 'famB', grandchildCount: 1 },
    ]);
  });

  it('deduplicates grandchild IDs per family (duplicate links counted once)', () => {
    const families: GrandchildFamilyInput[] = [
      { familyId: 'fam1', grandchildIds: ['c1', 'c1', 'c2', 'c2'] },
    ];
    const res = topGrandchildFamilies(families, 10);
    expect(res).toEqual([
      { familyId: 'fam1', grandchildCount: 2 },
    ]);
  });

  it('excludes families with zero unique grandchildren', () => {
    const families: GrandchildFamilyInput[] = [
      { familyId: 'fam1', grandchildIds: [] },
      { familyId: 'fam2', grandchildIds: ['c1'] },
    ];
    const res = topGrandchildFamilies(families, 10);
    expect(res).toEqual([
      { familyId: 'fam2', grandchildCount: 1 },
    ]);
  });

  it('slices correctly with topN', () => {
    const families: GrandchildFamilyInput[] = [
      { familyId: 'f1', grandchildIds: ['c1', 'c2', 'c3'] },
      { familyId: 'f2', grandchildIds: ['c4', 'c5'] },
      { familyId: 'f3', grandchildIds: ['c6'] },
    ];
    expect(topGrandchildFamilies(families, 2)).toEqual([
      { familyId: 'f1', grandchildCount: 3 },
      { familyId: 'f2', grandchildCount: 2 },
    ]);
    expect(topGrandchildFamilies(families, 1)).toEqual([
      { familyId: 'f1', grandchildCount: 3 },
    ]);
  });

  it('handles duplicate grandchildren across multiple children correctly', () => {
    const families: GrandchildFamilyInput[] = [
      {
        familyId: 'famShared',
        grandchildIds: ['childA_kid1', 'childA_kid1', 'childB_kid1'],
      },
    ];
    const res = topGrandchildFamilies(families, 10);
    expect(res).toEqual([
      { familyId: 'famShared', grandchildCount: 2 },
    ]);
  });

  it('distinguishes ranking versus v300 direct children count', () => {
    const families: GrandchildFamilyInput[] = [
      {
        familyId: 'famManyChildrenFewGrand',
        grandchildIds: ['c1'], // many children but 1 grandchild
      },
      {
        familyId: 'famFewChildrenManyGrand',
        grandchildIds: ['g1', 'g2', 'g3', 'g4', 'g5'],
      },
    ];
    const res = topGrandchildFamilies(families, 10);
    expect(res[0].familyId).toBe('famFewChildrenManyGrand');
    expect(res[1].familyId).toBe('famManyChildrenFewGrand');
  });
});
