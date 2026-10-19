import { describe, expect, it } from 'vitest';
import {
  mostChildrenPerPerson,
  type ParentChildInput,
} from './most-children-per-person';

function rangeChildren(prefix: string, count: number, parentIds: string[]): ParentChildInput[] {
  const rows: ParentChildInput[] = [];
  for (let i = 1; i <= count; i += 1) {
    rows.push({ childId: `${prefix}${i}`, parentIds: [...parentIds] });
  }
  return rows;
}

describe('mostChildrenPerPerson', () => {
  it('kasus 1: agregasi lintas FAMS, orang A menang 5+4+3=12 dari 3 keluarga', () => {
    const input: ParentChildInput[] = [
      ...rangeChildren('f1c', 5, ['A']),
      ...rangeChildren('f2c', 4, ['A']),
      ...rangeChildren('f3c', 3, ['A']),
      ...rangeChildren('d', 8, ['B']),
    ];

    expect(mostChildrenPerPerson(input)).toEqual([
      { parentId: 'A', childCount: 12 },
      { parentId: 'B', childCount: 8 },
    ]);
  });

  it('kasus 2: tie childCount dipecah parentId ASC leksikografis', () => {
    const input: ParentChildInput[] = [
      { childId: 'x1', parentIds: ['X'] },
      { childId: 'x2', parentIds: ['X'] },
      { childId: 'w1', parentIds: ['W'] },
      { childId: 'w2', parentIds: ['W'] },
      { childId: 'y1', parentIds: ['Y'] },
    ];

    expect(mostChildrenPerPerson(input)).toEqual([
      { parentId: 'W', childCount: 2 },
      { parentId: 'X', childCount: 2 },
      { parentId: 'Y', childCount: 1 },
    ]);
  });

  it('kasus 3: dedup pasangan (parentId, childId), baris ganda dan parentIds ganda dihitung sekali', () => {
    const input: ParentChildInput[] = [
      { childId: 'c1', parentIds: ['P'] },
      { childId: 'c1', parentIds: ['P'] },
      { childId: 'c2', parentIds: ['P'] },
      { childId: 'c3', parentIds: ['P', 'P'] },
    ];

    expect(mostChildrenPerPerson(input)).toEqual([
      { parentId: 'P', childCount: 3 },
    ]);
  });

  it('kasus 4: ortu tunggal satu anak masuk, anak tanpa ortu nihil efek', () => {
    const input: ParentChildInput[] = [
      { childId: 'c1', parentIds: ['P'] },
      { childId: 'c2', parentIds: [] },
    ];

    expect(mostChildrenPerPerson(input)).toEqual([
      { parentId: 'P', childCount: 1 },
    ]);
  });

  it('kasus 5: anak dua ortu menghitung untuk kedua ortu', () => {
    const input: ParentChildInput[] = [
      { childId: 'c1', parentIds: ['M', 'F'] },
    ];

    expect(mostChildrenPerPerson(input)).toEqual([
      { parentId: 'F', childCount: 1 },
      { parentId: 'M', childCount: 1 },
    ]);
  });

  it('kasus 6: topN default 10 memotong, topN melebihi jumlah ortu mengembalikan semua', () => {
    const input: ParentChildInput[] = [];
    for (let i = 1; i <= 12; i += 1) {
      input.push(...rangeChildren(`p${i}c`, 1, [`p${String(i).padStart(2, '0')}`]));
    }

    expect(mostChildrenPerPerson(input)).toHaveLength(10);
    expect(mostChildrenPerPerson(input, 20)).toHaveLength(12);
  });

  it('kasus 7: topN 0 dan negatif menghasilkan array kosong', () => {
    const input: ParentChildInput[] = [{ childId: 'c1', parentIds: ['P'] }];

    expect(mostChildrenPerPerson(input, 0)).toEqual([]);
    expect(mostChildrenPerPerson(input, -3)).toEqual([]);
  });

  it('kasus 8: nilai ekstrem 44 dan 69 anak utuh tanpa overflow', () => {
    const input: ParentChildInput[] = [
      ...rangeChildren('n', 44, ['nabatanzi']),
      ...rangeChildren('v', 69, ['vassilyev']),
    ];

    expect(mostChildrenPerPerson(input, 2)).toEqual([
      { parentId: 'vassilyev', childCount: 69 },
      { parentId: 'nabatanzi', childCount: 44 },
    ]);
  });

  it('kasus 9: input kosong menghasilkan array kosong', () => {
    expect(mostChildrenPerPerson([])).toEqual([]);
    expect(mostChildrenPerPerson([], 5)).toEqual([]);
  });

  it('kasus 10: determinisme, input diacak urutannya output identik', () => {
    const input: ParentChildInput[] = [
      ...rangeChildren('a', 3, ['P1']),
      ...rangeChildren('b', 5, ['P2']),
      ...rangeChildren('c', 2, ['P3', 'P1']),
    ];
    const baseline = mostChildrenPerPerson(input, 5);

    const shuffled = [...input];
    for (let i = shuffled.length - 1; i > 0; i -= 1) {
      const j = (i * 7 + 3) % (i + 1);
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    expect(mostChildrenPerPerson(shuffled, 5)).toEqual(baseline);
  });

  it('kasus 11: childCount terurut DESC ketat di seluruh hasil', () => {
    const input: ParentChildInput[] = [
      ...rangeChildren('a', 4, ['PA']),
      ...rangeChildren('b', 7, ['PB']),
      ...rangeChildren('c', 4, ['PC']),
      ...rangeChildren('d', 1, ['PD']),
    ];

    const result = mostChildrenPerPerson(input, 10);
    for (let i = 1; i < result.length; i += 1) {
      expect(result[i - 1].childCount).toBeGreaterThanOrEqual(result[i].childCount);
    }
    expect(result[0].childCount).toBe(7);
  });

  it('kasus 12: orang yang hanya muncul sebagai anak tidak menghasilkan entri childCount 0', () => {
    const input: ParentChildInput[] = [
      { childId: 'K1', parentIds: ['P1'] },
      { childId: 'c2', parentIds: ['P1', 'P2'] },
    ];

    const result = mostChildrenPerPerson(input, 10);
    expect(result).toEqual([
      { parentId: 'P1', childCount: 2 },
      { parentId: 'P2', childCount: 1 },
    ]);
    expect(result.some((entry) => entry.parentId === 'K1')).toBe(false);
  });
});
