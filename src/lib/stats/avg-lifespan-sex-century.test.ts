/**
 * Test v322 fase i: rerata umur kematian per sex per abad kelahiran.
 * Kasus mengikuti daftar kontrak: boundary abad, guard MIN_SAMPLES,
 * round 1 desimal, kolom sex, counter invalid dan excludedUnknown,
 * parser strict dengan nama field dan indeks, determinisme, payload
 * utuh pada input kosong.
 */

import { describe, it, expect } from 'vitest';
import {
  MIN_SAMPLES,
  parseLifespanEntries,
  computeAvgLifespanBySexCentury,
  type LifespanEntry,
} from './avg-lifespan-sex-century';

function entries(n: number): LifespanEntry[] {
  return Array.from({ length: n }, () => ({
    sex: 'F' as const,
    birthYear: 1850,
    deathYear: 1900,
  }));
}

function sameSex(n: number, sex: 'M' | 'F', birth: number, death: number): LifespanEntry[] {
  return Array.from({ length: n }, () => ({ sex, birthYear: birth, deathYear: death }));
}

describe('MIN_SAMPLES', () => {
  it('nilainya 10 sesuai kontrak dan terekspor const', () => {
    expect(MIN_SAMPLES).toBe(10);
  });
});

describe('computeAvgLifespanBySexCentury', () => {
  it('umur 0 (deathYear == birthYear) dihitung valid', () => {
    const payload = computeAvgLifespanBySexCentury(sameSex(10, 'F', 1900, 1900));
    expect(payload.validLifespans).toBe(10);
    expect(payload.invalidLifespans).toBe(0);
    expect(payload.matrix[0][0]).toBe(0);
  });

  it('boundary abad: 1899 masuk 1800-1899, 1900 masuk 1900-1999', () => {
    const payload = computeAvgLifespanBySexCentury([
      ...sameSex(10, 'F', 1899, 1950),
      ...sameSex(10, 'M', 1900, 1950),
    ]);
    expect(payload.centuries.map((c) => c.label)).toEqual(['1800-1899', '1900-1999']);
    expect(payload.matrix[0][0]).toBe(51);
    expect(payload.matrix[1][1]).toBe(50);
  });

  it('boundary 1800: floor menghasilkan start 1800, label 1800-1899', () => {
    const payload = computeAvgLifespanBySexCentury(sameSex(10, 'F', 1800, 1860));
    expect(payload.centuries).toEqual([{ start: 1800, label: '1800-1899' }]);
  });

  it('guard: sel 9 sampel mengembalikan null, sampleSizes tetap 9', () => {
    const payload = computeAvgLifespanBySexCentury(entries(9));
    expect(payload.matrix[0]).toEqual([null, null]);
    expect(payload.sampleSizes[0]).toEqual([9, 0]);
    expect(payload.validLifespans).toBe(9);
  });

  it('guard: sel 10 sampel mengembalikan rerata', () => {
    const payload = computeAvgLifespanBySexCentury(entries(10));
    expect(payload.matrix[0][0]).toBe(50);
    expect(payload.matrix[0][1]).toBeNull();
  });

  it('rerata round 1 desimal: 10 sampel total 805 menjadi 80.5', () => {
    const list: LifespanEntry[] = [];
    for (let i = 0; i < 10; i += 1) {
      const death = i < 5 ? 1930 : 1931;
      list.push({ sex: 'M', birthYear: 1850, deathYear: death });
    }
    const payload = computeAvgLifespanBySexCentury(list);
    expect(payload.matrix[0][1]).toBe(80.5);
  });

  it('sex F masuk kolom index 0, sex M kolom index 1', () => {
    const payload = computeAvgLifespanBySexCentury([
      ...sameSex(10, 'F', 1850, 1910),
      ...sameSex(10, 'M', 1850, 1900),
    ]);
    expect(payload.matrix[0][0]).toBe(60);
    expect(payload.matrix[0][1]).toBe(50);
    expect(payload.sampleSizes[0]).toEqual([10, 10]);
  });

  it("sex 'U' dan sex null masuk excludedUnknown, tidak masuk sel", () => {
    const list: LifespanEntry[] = [
      ...entries(10),
      { sex: 'U', birthYear: 1850, deathYear: 1900 },
      { sex: null, birthYear: 1850, deathYear: 1900 },
    ];
    const payload = computeAvgLifespanBySexCentury(list);
    expect(payload.excludedUnknown).toBe(2);
    expect(payload.validLifespans).toBe(10);
    expect(payload.sampleSizes[0][0]).toBe(10);
    expect(payload.matrix[0][1]).toBeNull();
  });

  it('umur negatif (deathYear < birthYear) masuk invalidLifespans', () => {
    const list: LifespanEntry[] = [
      ...entries(10),
      { sex: 'M', birthYear: 1900, deathYear: 1899 },
    ];
    const payload = computeAvgLifespanBySexCentury(list);
    expect(payload.invalidLifespans).toBe(1);
    expect(payload.validLifespans).toBe(10);
  });

  it('birthYear 0 (guard BCE) masuk invalidLifespans', () => {
    const payload = computeAvgLifespanBySexCentury([
      { sex: 'M', birthYear: 0, deathYear: 50 },
    ]);
    expect(payload.invalidLifespans).toBe(1);
    expect(payload.validLifespans).toBe(0);
  });

  it('birthYear negatif masuk invalidLifespans', () => {
    const payload = computeAvgLifespanBySexCentury([
      { sex: 'F', birthYear: -50, deathYear: 10 },
    ]);
    expect(payload.invalidLifespans).toBe(1);
  });

  it('birthYear null masuk invalidLifespans', () => {
    const payload = computeAvgLifespanBySexCentury([
      { sex: 'F', birthYear: null, deathYear: 1900 },
    ]);
    expect(payload.invalidLifespans).toBe(1);
    expect(payload.excludedUnknown).toBe(0);
  });

  it('deathYear null masuk invalidLifespans', () => {
    const payload = computeAvgLifespanBySexCentury([
      { sex: 'M', birthYear: 1850, deathYear: null },
    ]);
    expect(payload.invalidLifespans).toBe(1);
  });

  it('parser throw bila payload bukan array', () => {
    expect(() => computeAvgLifespanBySexCentury({ not: 'array' })).toThrow(Error);
    expect(() => parseLifespanEntries('abc')).toThrow(/payload harus array/);
  });

  it('parser throw elemen bukan objek dengan indeks di pesan', () => {
    expect(() => parseLifespanEntries([{ sex: 'F', birthYear: 1, deathYear: 2 }, 42]))
      .toThrow(/elemen\[1\] harus objek/);
  });

  it("parser throw sex di luar enum dengan field dan indeks", () => {
    expect(() => parseLifespanEntries([{ sex: 'X', birthYear: 1, deathYear: 2 }]))
      .toThrow(/elemen\[0\]\.sex/);
  });

  it('parser throw birthYear bukan number dengan nama field di pesan', () => {
    expect(() => parseLifespanEntries([
      { sex: 'F', birthYear: 1, deathYear: 2 },
      { sex: 'F', birthYear: '1800', deathYear: 2 },
    ])).toThrow(/elemen\[1\]\.birthYear harus number atau null/);
  });

  it('multi abad ascending dan deterministik terhadap urutan input', () => {
    const ordered = [
      ...sameSex(10, 'F', 1750, 1810),
      ...sameSex(10, 'F', 1850, 1910),
      ...sameSex(10, 'M', 1950, 2010),
    ];
    const a = computeAvgLifespanBySexCentury(ordered);
    const reversed = computeAvgLifespanBySexCentury([...ordered].reverse());
    expect(a.centuries.map((c) => c.start)).toEqual([1700, 1800, 1900]);
    expect(a.centuries.map((c) => c.label)).toEqual(['1700-1799', '1800-1899', '1900-1999']);
    expect(JSON.stringify(a)).toBe(JSON.stringify(reversed));
  });

  it('input kosong tetap payload utuh tanpa throw', () => {
    const payload = computeAvgLifespanBySexCentury([]);
    expect(payload).toEqual({
      sexes: ['F', 'M'],
      centuries: [],
      matrix: [],
      sampleSizes: [],
      validLifespans: 0,
      invalidLifespans: 0,
      excludedUnknown: 0,
    });
  });
});
