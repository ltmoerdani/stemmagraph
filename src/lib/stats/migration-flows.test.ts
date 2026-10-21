import { describe, expect, it } from 'vitest';
import {
  computeMigrationFlows,
  type MigrationRecord,
} from './migration-flows';

describe('computeMigrationFlows', () => {
  it('kasus 1: records kosong menghasilkan result nol tanpa throw', () => {
    expect(computeMigrationFlows([], { topLinks: 5 })).toEqual({
      links: [],
      totalPersons: 0,
      withBothCountries: 0,
      droppedSameCountry: 0,
    });
  });

  it('kasus 2: satu arus lintas negara', () => {
    const records: MigrationRecord[] = [
      { id: 'p1', birthPlace: 'Amsterdam, Netherlands', deathPlace: 'Bandung, Indonesia' },
    ];
    expect(computeMigrationFlows(records, { topLinks: 5 })).toEqual({
      links: [{ source: 'netherlands', target: 'indonesia', value: 1 }],
      totalPersons: 1,
      withBothCountries: 1,
      droppedSameCountry: 0,
    });
  });

  it('kasus 3: agregasi bobot dua record pasangan sama menjadi value 2', () => {
    const records: MigrationRecord[] = [
      { id: 'p1', birthPlace: 'Italy', deathPlace: 'France' },
      { id: 'p2', birthPlace: 'Rome, Italy', deathPlace: 'Paris, France' },
    ];
    const result = computeMigrationFlows(records, { topLinks: 5 });
    expect(result.links).toEqual([{ source: 'italy', target: 'france', value: 2 }]);
    expect(result.withBothCountries).toBe(2);
  });

  it('kasus 4: same-country dibuang dari links dan dihitung droppedSameCountry', () => {
    const records: MigrationRecord[] = [
      { id: 'p1', birthPlace: 'Bandung, Indonesia', deathPlace: 'Jakarta, Indonesia' },
    ];
    const result = computeMigrationFlows(records, { topLinks: 5 });
    expect(result.links).toEqual([]);
    expect(result.droppedSameCountry).toBe(1);
    expect(result.withBothCountries).toBe(1);
    expect(result.totalPersons).toBe(1);
  });

  it('kasus 5: birthPlace null dikecualikan tanpa throw', () => {
    const records: MigrationRecord[] = [
      { id: 'p1', birthPlace: null, deathPlace: 'Indonesia' },
    ];
    const result = computeMigrationFlows(records, { topLinks: 5 });
    expect(result.links).toEqual([]);
    expect(result.withBothCountries).toBe(0);
    expect(result.totalPersons).toBe(1);
  });

  it('kasus 6: deathPlace null dikecualikan tanpa throw', () => {
    const records: MigrationRecord[] = [
      { id: 'p1', birthPlace: 'Indonesia', deathPlace: null },
    ];
    const result = computeMigrationFlows(records, { topLinks: 5 });
    expect(result.links).toEqual([]);
    expect(result.withBothCountries).toBe(0);
  });

  it('kasus 7: string kosong dikecualikan, tidak masuk withBothCountries', () => {
    const records: MigrationRecord[] = [
      { id: 'p1', birthPlace: '   ', deathPlace: 'Indonesia' },
      { id: 'p2', birthPlace: 'Italy', deathPlace: '' },
    ];
    const result = computeMigrationFlows(records, { topLinks: 5 });
    expect(result.links).toEqual([]);
    expect(result.withBothCountries).toBe(0);
    expect(result.totalPersons).toBe(2);
  });

  it('kasus 8: token terakhir setelah koma dipakai sebagai negara', () => {
    const records: MigrationRecord[] = [
      { id: 'p1', birthPlace: 'Springfield, IL, USA', deathPlace: 'Denpasar, Bali, Indonesia' },
    ];
    expect(computeMigrationFlows(records, { topLinks: 5 }).links).toEqual([
      { source: 'usa', target: 'indonesia', value: 1 },
    ]);
  });

  it('kasus 9: tanpa koma seluruh string dipakai sebagai negara', () => {
    const records: MigrationRecord[] = [
      { id: 'p1', birthPlace: 'Norway', deathPlace: 'Sweden' },
    ];
    expect(computeMigrationFlows(records, { topLinks: 5 }).links).toEqual([
      { source: 'norway', target: 'sweden', value: 1 },
    ]);
  });

  it('kasus 10: lowercase menyatukan varian kapitalisasi', () => {
    const records: MigrationRecord[] = [
      { id: 'p1', birthPlace: 'ITALY', deathPlace: 'SPAIN' },
      { id: 'p2', birthPlace: 'Italy', deathPlace: 'Spain' },
      { id: 'p3', birthPlace: 'italy', deathPlace: 'spain' },
    ];
    expect(computeMigrationFlows(records, { topLinks: 5 }).links).toEqual([
      { source: 'italy', target: 'spain', value: 3 },
    ]);
  });

  it('kasus 11: topLinks memotong daftar terurut value DESC', () => {
    const records: MigrationRecord[] = [
      { id: 'a1', birthPlace: 'x1', deathPlace: 'y1' },
      { id: 'a2', birthPlace: 'x1', deathPlace: 'y1' },
      { id: 'a3', birthPlace: 'x1', deathPlace: 'y1' },
      { id: 'b1', birthPlace: 'x2', deathPlace: 'y2' },
      { id: 'b2', birthPlace: 'x2', deathPlace: 'y2' },
      { id: 'c1', birthPlace: 'x3', deathPlace: 'y3' },
    ];
    const result = computeMigrationFlows(records, { topLinks: 2 });
    expect(result.links).toEqual([
      { source: 'x1', target: 'y1', value: 3 },
      { source: 'x2', target: 'y2', value: 2 },
    ]);
  });

  it('kasus 12: tie value diurutkan source ASC lalu target ASC', () => {
    const records: MigrationRecord[] = [
      { id: 'p1', birthPlace: 'b', deathPlace: 'z' },
      { id: 'p2', birthPlace: 'a', deathPlace: 'z' },
      { id: 'p3', birthPlace: 'a', deathPlace: 'y' },
    ];
    const result = computeMigrationFlows(records, { topLinks: 10 });
    expect(result.links).toEqual([
      { source: 'a', target: 'y', value: 1 },
      { source: 'a', target: 'z', value: 1 },
      { source: 'b', target: 'z', value: 1 },
    ]);
  });

  it('kasus 13: topLinks 0 throw', () => {
    expect(() => computeMigrationFlows([], { topLinks: 0 })).toThrow('migration-flows');
  });

  it('kasus 14: topLinks pecahan 1.5 throw', () => {
    expect(() => computeMigrationFlows([], { topLinks: 1.5 })).toThrow('migration-flows');
  });

  it('kasus 15: id kosong throw ber-index', () => {
    const records = [{ id: '', birthPlace: 'a', deathPlace: 'b' }];
    expect(() => computeMigrationFlows(records, { topLinks: 5 })).toThrow(
      'migration-flows: record index 0',
    );
  });

  it('kasus 16: birthPlace number throw', () => {
    const records = [
      { id: 'p1', birthPlace: 42, deathPlace: 'b' },
    ];
    expect(() => computeMigrationFlows(records, { topLinks: 5 })).toThrow(
      'migration-flows: record index 0',
    );
  });

  it('kasus tambahan validasi: topLinks NaN dan non-number, records non-array, entri non-objek, deathPlace number semuanya throw', () => {
    expect(() => computeMigrationFlows([], { topLinks: Number.NaN })).toThrow('migration-flows');
    expect(() => computeMigrationFlows([], { topLinks: '3' as unknown as number })).toThrow(
      'migration-flows',
    );
    expect(() =>
      computeMigrationFlows('bukan array' as unknown as MigrationRecord[], { topLinks: 5 }),
    ).toThrow('migration-flows');
    expect(() =>
      computeMigrationFlows([null as unknown as MigrationRecord], { topLinks: 5 }),
    ).toThrow('migration-flows');
    expect(() =>
      computeMigrationFlows(
        [{ id: 'p1', birthPlace: 'a', deathPlace: 9 } as unknown as MigrationRecord],
        { topLinks: 5 },
      ),
    ).toThrow('migration-flows');
  });

  it('kasus tambahan: trim dan spasi sekitar koma ditangani, negara hasil parsing kosong dikecualikan', () => {
    const records: MigrationRecord[] = [
      { id: 'p1', birthPlace: '  Oslo , Norway  ', deathPlace: '  Denmark ' },
      { id: 'p2', birthPlace: 'Oslo, ', deathPlace: 'Denmark' },
    ];
    const result = computeMigrationFlows(records, { topLinks: 5 });
    expect(result.links).toEqual([{ source: 'norway', target: 'denmark', value: 1 }]);
    expect(result.withBothCountries).toBe(1);
  });

  it('kasus tambahan: determinisme, dua panggilan identik menghasilkan deep equal', () => {
    const records: MigrationRecord[] = [
      { id: 'p1', birthPlace: 'A, x', deathPlace: 'B, y' },
      { id: 'p2', birthPlace: 'A, x', deathPlace: 'B, y' },
      { id: 'p3', birthPlace: 'A, x', deathPlace: 'A, x' },
      { id: 'p4', birthPlace: null, deathPlace: 'B, y' },
    ];
    const first = computeMigrationFlows(records, { topLinks: 3 });
    const second = computeMigrationFlows(records, { topLinks: 3 });
    expect(first).toEqual(second);
  });
});
