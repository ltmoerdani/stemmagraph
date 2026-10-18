import { describe, expect, it } from 'vitest';
import {
  rankFamiliesByChildren,
  type TopFamiliesInput,
} from './top-largest-families';

describe('rankFamiliesByChildren', () => {
  it('mengurutkan childCount menurun pada ranking dasar', () => {
    const input: TopFamiliesInput[] = [
      { familyId: 'f1', childIds: ['c1'] },
      { familyId: 'f2', childIds: ['c1', 'c2', 'c3'] },
      { familyId: 'f3', childIds: ['c1', 'c2'] },
    ];

    expect(rankFamiliesByChildren(input)).toEqual([
      { familyId: 'f2', childCount: 3 },
      { familyId: 'f3', childCount: 2 },
      { familyId: 'f1', childCount: 1 },
    ]);
  });

  it('tie-break familyId naik saat childCount sama', () => {
    const input: TopFamiliesInput[] = [
      { familyId: 'zeta', childIds: ['a', 'b'] },
      { familyId: 'alpha', childIds: ['c', 'd'] },
      { familyId: 'mid', childIds: ['e', 'f'] },
    ];

    expect(rankFamiliesByChildren(input).map((r) => r.familyId)).toEqual([
      'alpha',
      'mid',
      'zeta',
    ]);
  });

  it('hasil array kosong bila semua childIds kosong', () => {
    const input: TopFamiliesInput[] = [
      { familyId: 'f1', childIds: [] },
      { familyId: 'f2', childIds: [] },
    ];

    expect(rankFamiliesByChildren(input)).toEqual([]);
  });

  it('topN memotong hasil setelah penyortiran', () => {
    const input: TopFamiliesInput[] = [
      { familyId: 'a', childIds: ['1'] },
      { familyId: 'b', childIds: ['1', '2', '3', '4'] },
      { familyId: 'c', childIds: ['1', '2', '3'] },
      { familyId: 'd', childIds: ['1', '2'] },
    ];

    expect(rankFamiliesByChildren(input, 2)).toEqual([
      { familyId: 'b', childCount: 4 },
      { familyId: 'c', childCount: 3 },
    ]);
  });

  it('topN 0 menghasilkan array kosong', () => {
    const input: TopFamiliesInput[] = [
      { familyId: 'a', childIds: ['1'] },
    ];

    expect(rankFamiliesByChildren(input, 0)).toEqual([]);
  });

  it('topN negatif menghasilkan array kosong', () => {
    const input: TopFamiliesInput[] = [
      { familyId: 'a', childIds: ['1'] },
    ];

    expect(rankFamiliesByChildren(input, -3)).toEqual([]);
  });

  it('single family bukan kosong dan terperingkat', () => {
    const input: TopFamiliesInput[] = [
      { familyId: 'only', childIds: ['c1', 'c2', 'c3', 'c4'] },
    ];

    expect(rankFamiliesByChildren(input, 10)).toEqual([
      { familyId: 'only', childCount: 4 },
    ]);
  });

  it('default topN 10 dipakai bila argumen kedua tidak diberikan', () => {
    const input: TopFamiliesInput[] = [];
    for (let i = 0; i < 15; i += 1) {
      input.push({
        familyId: `f${i.toString().padStart(2, '0')}`,
        childIds: [`c${i}`],
      });
    }

    const result = rankFamiliesByChildren(input);
    expect(result).toHaveLength(10);
    expect(result[0]).toEqual({ familyId: 'f00', childCount: 1 });
  });

  it('duplikat familyId diperbolehkan dan hasil tetap deterministik', () => {
    const input: TopFamiliesInput[] = [
      { familyId: 'dup', childIds: ['a', 'b'] },
      { familyId: 'dup', childIds: ['a', 'b'] },
      { familyId: 'other', childIds: ['a'] },
    ];

    const first = rankFamiliesByChildren(input);
    const second = rankFamiliesByChildren(input);

    expect(first).toEqual([
      { familyId: 'dup', childCount: 2 },
      { familyId: 'dup', childCount: 2 },
      { familyId: 'other', childCount: 1 },
    ]);
    expect(first).toEqual(second);
  });

  it('urutan input diacak memberi hasil sama persis', () => {
    const base: TopFamiliesInput[] = [
      { familyId: 'a', childIds: ['1', '2', '3'] },
      { familyId: 'b', childIds: ['1'] },
      { familyId: 'c', childIds: ['1', '2'] },
      { familyId: 'd', childIds: ['1'] },
    ];
    const shuffled = [
      base[3],
      base[1],
      base[0],
      base[2],
    ];

    expect(rankFamiliesByChildren(shuffled)).toEqual(
      rankFamiliesByChildren(base),
    );
  });

  it('array input tidak dimutasi', () => {
    const input: TopFamiliesInput[] = [
      { familyId: 'b', childIds: ['1', '2'] },
      { familyId: 'a', childIds: ['1', '2', '3'] },
    ];
    const snapshot: TopFamiliesInput[] = JSON.parse(JSON.stringify(input));

    rankFamiliesByChildren(input);

    expect(input).toEqual(snapshot);
    expect(input.map((f) => f.familyId)).toEqual(['b', 'a']);
  });

  it('isi childIds tidak dimutasi', () => {
    const childIds = ['c2', 'c1', 'c3'];
    const input: TopFamiliesInput[] = [{ familyId: 'f1', childIds }];
    const childSnapshot = [...childIds];

    rankFamiliesByChildren(input);

    expect(childIds).toEqual(childSnapshot);
  });

  it('menghitung childCount dari panjang childIds termasuk duplikat elemen', () => {
    const input: TopFamiliesInput[] = [
      { familyId: 'f1', childIds: ['x', 'x', 'y'] },
    ];

    expect(rankFamiliesByChildren(input)).toEqual([
      { familyId: 'f1', childCount: 3 },
    ]);
  });
});
