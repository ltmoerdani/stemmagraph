import { describe, expect, it } from 'vitest';
import { computeBirthIntervals, summarizeIntervals } from './birth-interval';

describe('computeBirthIntervals', () => {
  it('3 anak jarak 18 dan 24 bulan menghasilkan 2 interval terurut asc', () => {
    const result = computeBirthIntervals([
      { familyId: 'F1', childBirthDates: ['2020-01-01', '2021-07-01', '2023-07-01'] },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].familyId).toBe('F1');
    expect(result[0].childCount).toBe(3);
    expect(result[0].intervalCount).toBe(2);
    expect(result[0].intervalsDays).toEqual([547, 730]);
    expect(result[0].intervalsMonths).toEqual([18, 24]);
  });

  it('1 anak menghasilkan interval kosong tanpa throw', () => {
    const result = computeBirthIntervals([
      { familyId: 'F1', childBirthDates: ['2020-01-01'] },
    ]);
    expect(result[0].childCount).toBe(1);
    expect(result[0].intervalCount).toBe(0);
    expect(result[0].intervalsDays).toEqual([]);
    expect(result[0].intervalsMonths).toEqual([]);
  });

  it('0 anak menghasilkan interval kosong tanpa throw', () => {
    const result = computeBirthIntervals([
      { familyId: 'F2', childBirthDates: [] },
    ]);
    expect(result[0].childCount).toBe(0);
    expect(result[0].intervalCount).toBe(0);
    expect(result[0].intervalsDays).toEqual([]);
    expect(result[0].intervalsMonths).toEqual([]);
  });

  it('tanggal duplikat sah dengan interval 0 hari', () => {
    const result = computeBirthIntervals([
      { familyId: 'F3', childBirthDates: ['2020-05-10', '2020-05-10'] },
    ]);
    expect(result[0].intervalCount).toBe(1);
    expect(result[0].intervalsDays).toEqual([0]);
    expect(result[0].intervalsMonths).toEqual([0]);
  });

  it('tanggal input acak diurut ulang asc sebelum dihitung', () => {
    const result = computeBirthIntervals([
      { familyId: 'F4', childBirthDates: ['2023-01-01', '2020-01-01', '2021-01-01', '2022-01-01'] },
    ]);
    expect(result[0].intervalsDays).toEqual([366, 365, 365]);
    expect(result[0].intervalsMonths).toEqual([12, 12, 12]);
  });

  it('tanggal invalid format dilempar Error ber-index birth-interval', () => {
    expect(() => computeBirthIntervals([
      { familyId: 'F5', childBirthDates: ['2020-1-01'] },
    ])).toThrowError(/birth-interval/);
  });

  it('31 Feb dilempar Error', () => {
    expect(() => computeBirthIntervals([
      { familyId: 'F6', childBirthDates: ['2021-02-31'] },
    ])).toThrowError(/birth-interval/);
  });

  it('29 Feb tahun kabisat sah', () => {
    const result = computeBirthIntervals([
      { familyId: 'F7', childBirthDates: ['2019-02-28', '2020-02-29'] },
    ]);
    expect(result[0].intervalsDays).toEqual([366]);
    expect(result[0].intervalsMonths).toEqual([12]);
  });

  it('whole months anniversary tercapai: 1 Mar ke 1 Mar berikutnya = 12', () => {
    const result = computeBirthIntervals([
      { familyId: 'F8', childBirthDates: ['2021-03-01', '2022-03-01'] },
    ]);
    expect(result[0].intervalsMonths).toEqual([12]);
  });

  it('whole months anniversary belum tercapai: 1 Mar ke 28 Feb = 11', () => {
    const result = computeBirthIntervals([
      { familyId: 'F9', childBirthDates: ['2021-03-01', '2022-02-28'] },
    ]);
    expect(result[0].intervalsMonths).toEqual([11]);
  });

  it('family output diurut by familyId localeCompare', () => {
    const result = computeBirthIntervals([
      { familyId: 'FB', childBirthDates: [] },
      { familyId: 'FA', childBirthDates: [] },
    ]);
    expect(result.map((r) => r.familyId)).toEqual(['FA', 'FB']);
  });

  it('struktur input salah: families bukan array dilempar Error', () => {
    expect(() => computeBirthIntervals('bukan-array' as unknown as [])).toThrowError(/birth-interval/);
  });

  it('struktur input salah: familyId kosong dilempar Error', () => {
    expect(() => computeBirthIntervals([
      { familyId: '', childBirthDates: [] },
    ])).toThrowError(/birth-interval/);
  });

  it('struktur input salah: childBirthDates berisi non-string dilempar Error', () => {
    expect(() => computeBirthIntervals([
      { familyId: 'FC', childBirthDates: [20200101] as unknown as string[] },
    ])).toThrowError(/birth-interval/);
  });

  it('struktur input salah: elemen family bukan objek dilempar Error', () => {
    expect(() => computeBirthIntervals([42] as unknown as [])).toThrowError(/birth-interval/);
  });
});

describe('summarizeIntervals', () => {
  it('bucket 12 bulan menghasilkan bucket 0-11 dan 12-23 hanya yang berisi', () => {
    const buckets = summarizeIntervals([0, 5, 11, 12, 23]);
    expect(buckets).toEqual([
      { bucketStart: 0, bucketEnd: 11, count: 3 },
      { bucketStart: 12, bucketEnd: 23, count: 2 },
    ]);
  });

  it('bucket size 6 membagi benar dan terurut asc', () => {
    const buckets = summarizeIntervals([6, 0, 12, 5, 11], 6);
    expect(buckets).toEqual([
      { bucketStart: 0, bucketEnd: 5, count: 2 },
      { bucketStart: 6, bucketEnd: 11, count: 2 },
      { bucketStart: 12, bucketEnd: 17, count: 1 },
    ]);
  });

  it('input kosong menghasilkan array kosong', () => {
    expect(summarizeIntervals([])).toEqual([]);
  });

  it('bucketSize 0, -1, dan 2.5 dilempar Error ber-index', () => {
    expect(() => summarizeIntervals([1], 0)).toThrowError(/birth-interval/);
    expect(() => summarizeIntervals([1], -1)).toThrowError(/birth-interval/);
    expect(() => summarizeIntervals([1], 2.5)).toThrowError(/birth-interval/);
  });

  it('intervalsMonths berisi string dilempar Error', () => {
    expect(() => summarizeIntervals(['3'] as unknown as number[])).toThrowError(/birth-interval/);
  });

  it('intervalsMonths berisi non-integer atau negatif dilempar Error', () => {
    expect(() => summarizeIntervals([1.5])).toThrowError(/birth-interval/);
    expect(() => summarizeIntervals([-2])).toThrowError(/birth-interval/);
  });
});
