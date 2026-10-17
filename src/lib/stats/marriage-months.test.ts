/**
 * Test dedikasi v283 fase i: computeMarriageMonths
 * (src/lib/stats/marriage-months.ts). Test-only, pure: nihil DB, nihil
 * jaringan, nihil jam nyata.
 *
 * 14 kasus kontrak kukuh v283 (18 Okt 2026): kosong; satu pasangan Jan;
 * 12 bulan lengkap tiap bucket 1; dedup orang dua FAM terhitung sekali di
 * bulan terawal; tahun-only gugur; MARR tanpa bulan gugur; ABT dengan bulan
 * masuk; RANGE dengan bulan masuk; dua pasangan orang sama satu masuk satu
 * gugur; pasangan kedua gugur karena satu orang sudah menikah lebih awal;
 * monthStart 13 dan 0 gugur; monthStart pecahan gugur; urutan input acak
 * identik plus tie pairId deterministik; dateKind kosong dengan bulan masuk.
 */
import { describe, expect, it } from 'vitest';
import {
  computeMarriageMonths,
  type MarriagePairInput,
} from './marriage-months';

const ALL_MONTHS = [
  'JAN',
  'FEB',
  'MAR',
  'APR',
  'MAY',
  'JUN',
  'JUL',
  'AUG',
  'SEP',
  'OCT',
  'NOV',
  'DEC',
];

function pair(
  pairId: string,
  spouseAId: string,
  spouseBId: string,
  dateKind: string,
  yearStart: number | null,
  monthStart: number | null,
  dayStart: number | null
): MarriagePairInput {
  return {
    pairId,
    spouseAId,
    spouseBId,
    dateKind,
    yearStart,
    monthStart,
    dayStart,
  };
}

function zeroCounts(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const m of ALL_MONTHS) {
    out[m] = 0;
  }
  return out;
}

describe('v283 computeMarriageMonths fase i', () => {
  it('kasus 1: input kosong, 12 kunci tetap ada semua bernilai 0', () => {
    const r = computeMarriageMonths([]);
    expect(Object.keys(r.countsByMonth)).toEqual(ALL_MONTHS);
    expect(r.countsByMonth).toEqual(zeroCounts());
    expect(r.marriageCount).toBe(0);
    expect(r.excludedCount).toBe(0);
  });

  it('kasus 2: satu pasangan Januari masuk bucket JAN', () => {
    const r = computeMarriageMonths([
      pair('p1', 'A', 'B', 'EXACT', 1900, 1, 15),
    ]);
    const expected = zeroCounts();
    expected.JAN = 1;
    expect(r.countsByMonth).toEqual(expected);
    expect(r.marriageCount).toBe(1);
    expect(r.excludedCount).toBe(0);
  });

  it('kasus 3: 12 pasangan sebulan sekali, tiap bucket tepat 1', () => {
    const pairs: MarriagePairInput[] = [];
    for (let i = 1; i <= 12; i += 1) {
      pairs.push(
        pair(
          'p' + i,
          'ga' + i,
          'gb' + i,
          'EXACT',
          1880 + i,
          i,
          i
        )
      );
    }
    const r = computeMarriageMonths(pairs);
    const expected = zeroCounts();
    for (const m of ALL_MONTHS) {
      expected[m] = 1;
    }
    expect(r.countsByMonth).toEqual(expected);
    expect(r.marriageCount).toBe(12);
    expect(r.excludedCount).toBe(0);
  });

  it('kasus 4: orang menikah di dua FAM terhitung sekali di bulan terawal', () => {
    // f1 disebut lebih dulu di input, tapi f2 (1890) lebih awal secara tanggal.
    const r = computeMarriageMonths([
      pair('f1', 'A', 'B', 'EXACT', 1900, 5, 10),
      pair('f2', 'A', 'C', 'EXACT', 1890, 1, 20),
    ]);
    const expected = zeroCounts();
    expected.JAN = 1;
    expect(r.countsByMonth).toEqual(expected);
    expect(r.countsByMonth.MAY).toBe(0);
    expect(r.marriageCount).toBe(1);
    expect(r.excludedCount).toBe(0);
  });

  it('kasus 5: tahun-only (monthStart null) gugur, excludedCount naik', () => {
    const r = computeMarriageMonths([
      pair('p1', 'A', 'B', 'EXACT', 1888, null, null),
    ]);
    expect(r.countsByMonth).toEqual(zeroCounts());
    expect(r.marriageCount).toBe(0);
    expect(r.excludedCount).toBe(1);
  });

  it('kasus 6: MARR dengan monthStart null gugur', () => {
    const r = computeMarriageMonths([
      pair('p1', 'A', 'B', 'MARR', 1871, null, 10),
    ]);
    expect(r.marriageCount).toBe(0);
    expect(r.excludedCount).toBe(1);
  });

  it('kasus 7: ABT dengan bulan terisi masuk bucket bulan itu', () => {
    const r = computeMarriageMonths([
      pair('p1', 'A', 'B', 'ABT', 1902, 7, null),
    ]);
    const expected = zeroCounts();
    expected.JUL = 1;
    expect(r.countsByMonth).toEqual(expected);
    expect(r.marriageCount).toBe(1);
    expect(r.excludedCount).toBe(0);
  });

  it('kasus 8: RANGE dengan bulan terisi masuk bucket bulan itu', () => {
    const r = computeMarriageMonths([
      pair('p1', 'A', 'B', 'RANGE', 1899, 11, null),
    ]);
    const expected = zeroCounts();
    expected.NOV = 1;
    expect(r.countsByMonth).toEqual(expected);
    expect(r.marriageCount).toBe(1);
  });

  it('kasus 9: dua pasangan orang sama persis, satu masuk satu gugur', () => {
    // Tanggal identik, tie dipecah pairId ascending: t-a masuk, t-b gugur.
    const r = computeMarriageMonths([
      pair('t-b', 'A', 'B', 'EXACT', 1900, 3, 5),
      pair('t-a', 'A', 'B', 'EXACT', 1900, 3, 5),
    ]);
    const expected = zeroCounts();
    expected.MAR = 1;
    expect(r.countsByMonth).toEqual(expected);
    expect(r.marriageCount).toBe(1);
    expect(r.excludedCount).toBe(0);
  });

  it('kasus 10: pasangan kedua gugur karena satu orang sudah menikah lebih awal', () => {
    const r = computeMarriageMonths([
      pair('m1', 'A', 'B', 'EXACT', 1890, 2, 1),
      pair('m2', 'C', 'A', 'EXACT', 1895, 9, 30),
    ]);
    const expected = zeroCounts();
    expected.FEB = 1;
    expect(r.countsByMonth).toEqual(expected);
    expect(r.countsByMonth.SEP).toBe(0);
    expect(r.marriageCount).toBe(1);
    expect(r.excludedCount).toBe(0);
  });

  it('kasus 11: monthStart 13 dan 0 gugur filter', () => {
    const r = computeMarriageMonths([
      pair('p1', 'A', 'B', 'EXACT', 1901, 13, 1),
      pair('p2', 'C', 'D', 'EXACT', 1902, 0, 1),
    ]);
    expect(r.countsByMonth).toEqual(zeroCounts());
    expect(r.marriageCount).toBe(0);
    expect(r.excludedCount).toBe(2);
  });

  it('kasus 12: monthStart pecahan gugur, hanya integer 1 sampai 12 sah', () => {
    const r = computeMarriageMonths([
      pair('p1', 'A', 'B', 'EXACT', 1903, 6.5, 1),
      pair('p2', 'C', 'D', 'EXACT', 1904, 6, 1),
    ]);
    const expected = zeroCounts();
    expected.JUN = 1;
    expect(r.countsByMonth).toEqual(expected);
    expect(r.marriageCount).toBe(1);
    expect(r.excludedCount).toBe(1);
  });

  it('kasus 13: urutan input acak identik dengan hasil urut, tie pairId deterministik', () => {
    const base: MarriagePairInput[] = [
      pair('d01', 'A', 'B', 'EXACT', 1900, 3, 5),
      pair('d02', 'C', 'D', 'ABT', 1900, 3, null),
      pair('t-a', 'E', 'F', 'EXACT', 1901, 7, 1),
      pair('t-b', 'E', 'F', 'EXACT', 1901, 7, 1),
      pair('t-c', 'G', 'E', 'EST', 1899, 12, 25),
      pair('t-d', 'H', 'I', '', 1902, 13, 1),
      pair('t-e', 'J', 'K', 'MARR', null, null, null),
    ];
    const expected = zeroCounts();
    expected.MAR = 2;
    expected.DEC = 1;
    // t-c (1899) masuk duluan sehingga E kena seen; t-a dan t-b gugur dedup.
    const expectedMain = {
      countsByMonth: expected,
      marriageCount: 3,
      excludedCount: 2,
    };
    const sorted = computeMarriageMonths(base);
    const reversed = computeMarriageMonths([...base].reverse());
    const rotated = computeMarriageMonths([
      ...base.slice(3),
      ...base.slice(0, 3),
    ]);
    expect(sorted).toEqual(expectedMain);
    expect(reversed).toEqual(expectedMain);
    expect(rotated).toEqual(expectedMain);
  });

  it('kasus 14: dateKind kosong tidak melarang, bulan terisi tetap masuk', () => {
    const r = computeMarriageMonths([pair('p1', 'A', 'B', '', 1905, 4, 2)]);
    const expected = zeroCounts();
    expected.APR = 1;
    expect(r.countsByMonth).toEqual(expected);
    expect(r.marriageCount).toBe(1);
    expect(r.excludedCount).toBe(0);
  });
});
