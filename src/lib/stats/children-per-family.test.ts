import { describe, expect, it } from 'vitest';
import {
  computeChildrenPerFamilyDistribution,
  type FamilyChildrenInput,
} from './children-per-family';

describe('computeChildrenPerFamilyDistribution', () => {
  it('happy path multi keluarga menghasilkan bucket children ASC', () => {
    const input: FamilyChildrenInput[] = [
      { familyId: 'f1', childIds: ['c1', 'c2', 'c3'] },
      { familyId: 'f2', childIds: ['c1'] },
      { familyId: 'f3', childIds: ['c1', 'c2'] },
    ];

    expect(computeChildrenPerFamilyDistribution(input)).toEqual({
      distribution: [
        { children: 1, familyCount: 1 },
        { children: 2, familyCount: 1 },
        { children: 3, familyCount: 1 },
      ],
      familyCount: 3,
      average: 2,
    });
  });

  it('keluarga tanpa anak masuk bucket children 0 di posisi awal', () => {
    const input: FamilyChildrenInput[] = [
      { familyId: 'f1', childIds: ['c1', 'c2'] },
      { familyId: 'f2', childIds: [] },
      { familyId: 'f3', childIds: ['c1'] },
    ];

    expect(computeChildrenPerFamilyDistribution(input)).toEqual({
      distribution: [
        { children: 0, familyCount: 1 },
        { children: 1, familyCount: 1 },
        { children: 2, familyCount: 1 },
      ],
      familyCount: 3,
      average: 1,
    });
  });

  it('childIds ganda dalam satu keluarga dihitung sekali (dedup Set)', () => {
    const input: FamilyChildrenInput[] = [
      { familyId: 'f1', childIds: ['x', 'x', 'y', 'x', 'z'] },
    ];

    expect(computeChildrenPerFamilyDistribution(input)).toEqual({
      distribution: [{ children: 3, familyCount: 1 }],
      familyCount: 1,
      average: 3,
    });
  });

  it('dedup berlaku per keluarga, bukan lintas keluarga', () => {
    const input: FamilyChildrenInput[] = [
      { familyId: 'f1', childIds: ['a', 'a'] },
      { familyId: 'f2', childIds: ['a', 'b'] },
    ];

    expect(computeChildrenPerFamilyDistribution(input)).toEqual({
      distribution: [
        { children: 1, familyCount: 1 },
        { children: 2, familyCount: 1 },
      ],
      familyCount: 2,
      average: 1.5,
    });
  });

  it('average dibulatkan 1 desimal (2 dibagi 3 menjadi 0.7)', () => {
    const input: FamilyChildrenInput[] = [
      { familyId: 'f1', childIds: ['c1'] },
      { familyId: 'f2', childIds: ['c1'] },
      { familyId: 'f3', childIds: [] },
    ];

    expect(computeChildrenPerFamilyDistribution(input).average).toBe(0.7);
  });

  it('average 1.5 untuk total 3 anak dari 2 keluarga', () => {
    const input: FamilyChildrenInput[] = [
      { familyId: 'f1', childIds: ['c1', 'c2'] },
      { familyId: 'f2', childIds: ['c1'] },
    ];

    expect(computeChildrenPerFamilyDistribution(input).average).toBe(1.5);
  });

  it('input kosong menghasilkan average 0 dan distribution kosong', () => {
    expect(computeChildrenPerFamilyDistribution([])).toEqual({
      distribution: [],
      familyCount: 0,
      average: 0,
    });
  });

  it('single family menghasilkan satu bucket dan average sama childCount', () => {
    const input: FamilyChildrenInput[] = [
      { familyId: 'only', childIds: ['c1', 'c2', 'c3', 'c4'] },
    ];

    expect(computeChildrenPerFamilyDistribution(input)).toEqual({
      distribution: [{ children: 4, familyCount: 1 }],
      familyCount: 1,
      average: 4,
    });
  });

  it('familyCount menghitung semua keluarga termasuk yang 0 anak', () => {
    const input: FamilyChildrenInput[] = [
      { familyId: 'f1', childIds: [] },
      { familyId: 'f2', childIds: [] },
      { familyId: 'f3', childIds: ['c1'] },
    ];

    const result = computeChildrenPerFamilyDistribution(input);

    expect(result.familyCount).toBe(3);
    expect(result.distribution).toEqual([
      { children: 0, familyCount: 2 },
      { children: 1, familyCount: 1 },
    ]);
  });

  it('semua keluarga tanpa anak menghasilkan average 0 dan hanya bucket 0', () => {
    const input: FamilyChildrenInput[] = [
      { familyId: 'f1', childIds: [] },
      { familyId: 'f2', childIds: [] },
    ];

    expect(computeChildrenPerFamilyDistribution(input)).toEqual({
      distribution: [{ children: 0, familyCount: 2 }],
      familyCount: 2,
      average: 0,
    });
  });

  it('bucket tanpa data nyata tidak muncul di antara bucket lain', () => {
    const input: FamilyChildrenInput[] = [
      { familyId: 'f1', childIds: ['c1'] },
      { familyId: 'f2', childIds: ['c1', 'c2', 'c3', 'c4'] },
    ];

    const result = computeChildrenPerFamilyDistribution(input);

    expect(result.distribution).toEqual([
      { children: 1, familyCount: 1 },
      { children: 4, familyCount: 1 },
    ]);
  });

  it('urutan input diacak memberi hasil sama persis (deterministik)', () => {
    const base: FamilyChildrenInput[] = [
      { familyId: 'a', childIds: ['1', '2', '3'] },
      { familyId: 'b', childIds: ['1'] },
      { familyId: 'c', childIds: ['1', '2'] },
      { familyId: 'd', childIds: [] },
    ];
    const shuffled = [base[3], base[1], base[0], base[2]];

    expect(computeChildrenPerFamilyDistribution(shuffled)).toEqual(
      computeChildrenPerFamilyDistribution(base),
    );
  });

  it('input dan childIds tidak dimutasi', () => {
    const childIds = ['c2', 'c1', 'c2'];
    const input: FamilyChildrenInput[] = [{ familyId: 'f1', childIds }];
    const snapshot: FamilyChildrenInput[] = JSON.parse(JSON.stringify(input));

    computeChildrenPerFamilyDistribution(input);

    expect(input).toEqual(snapshot);
    expect(childIds).toEqual(['c2', 'c1', 'c2']);
  });
});
