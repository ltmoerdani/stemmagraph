import { describe, it, expect } from 'vitest';
import { computeDeathsByCountry } from './deaths-by-country';

describe('computeDeathsByCountry', () => {
  it('mengambil token terakhir saat deathPlace multi koma', () => {
    const res = computeDeathsByCountry([
      { deathDate: { date: '2020-01-01' }, deathPlace: 'Bandung, Jawa Barat, Indonesia' },
    ]);
    expect(res.items).toEqual([{ label: 'indonesia', count: 1 }]);
    expect(res.totalDated).toBe(1);
  });

  it('memakai seluruh string saat deathPlace tanpa koma', () => {
    const res = computeDeathsByCountry([
      { deathDate: { date: '2020' }, deathPlace: 'Indonesia' },
    ]);
    expect(res.items).toEqual([{ label: 'indonesia', count: 1 }]);
  });

  it('menormalkan label ke lowercase', () => {
    const res = computeDeathsByCountry([
      { deathDate: { date: '2020' }, deathPlace: 'INDONESIA' },
      { deathDate: { date: '2021' }, deathPlace: 'Jakarta, Indonesia' },
    ]);
    expect(res.items).toEqual([{ label: 'indonesia', count: 2 }]);
  });

  it('memotong spasi di sekitar place dan token setelah koma', () => {
    const res = computeDeathsByCountry([
      { deathDate: { date: '2020' }, deathPlace: '  Malaysia  ' },
      { deathDate: { date: '2021' }, deathPlace: 'KL,   Malaysia ' },
    ]);
    expect(res.items).toEqual([{ label: 'malaysia', count: 2 }]);
  });

  it('mengagregasi count dari banyak entri', () => {
    const res = computeDeathsByCountry([
      { deathDate: { date: '2020' }, deathPlace: 'Indonesia' },
      { deathDate: { date: '2020' }, deathPlace: 'Surabaya, Indonesia' },
      { deathDate: { date: '2021' }, deathPlace: 'Malaysia' },
      { deathDate: { date: '2021' }, deathPlace: 'MALAYSIA' },
      { deathDate: { date: '2022' }, deathPlace: 'Jakarta, Malaysia' },
      { deathDate: { date: '2022' }, deathPlace: 'Singapore' },
    ]);
    expect(res.items).toEqual([
      { label: 'malaysia', count: 3 },
      { label: 'indonesia', count: 2 },
      { label: 'singapore', count: 1 },
    ]);
    expect(res.totalDated).toBe(6);
    expect(res.excludedNoPlace).toBe(0);
  });

  it('mengurutkan items berdasarkan count menurun', () => {
    const res = computeDeathsByCountry([
      { deathDate: { date: '2020' }, deathPlace: 'A Country' },
      { deathDate: { date: '2020' }, deathPlace: 'Z Country' },
      { deathDate: { date: '2020' }, deathPlace: 'Z Country' },
    ]);
    expect(res.items.map((row) => row.label)).toEqual(['z country', 'a country']);
  });

  it('mengurutkan tie count secara alphabetical dengan localeCompare', () => {
    const res = computeDeathsByCountry([
      { deathDate: { date: '2020' }, deathPlace: 'zambia' },
      { deathDate: { date: '2020' }, deathPlace: 'brazil' },
      { deathDate: { date: '2020' }, deathPlace: 'argentina' },
    ]);
    expect(res.items.map((row) => row.label)).toEqual(['argentina', 'brazil', 'zambia']);
  });

  it('menghitung totalDated dan excludedNoPlace dengan tepat', () => {
    const res = computeDeathsByCountry([
      { deathDate: { date: '2020' }, deathPlace: 'Indonesia' },
      { deathPlace: 'Malaysia' },
      { deathDate: { date: '2021' } },
      { deathDate: { date: '2022' }, deathPlace: 'Indonesia' },
      {},
    ]);
    expect(res.totalDated).toBe(2);
    expect(res.excludedNoPlace).toBe(3);
    expect(res.items).toEqual([{ label: 'indonesia', count: 2 }]);
  });

  it('mengembalikan hasil nol untuk input kosong', () => {
    const res = computeDeathsByCountry([]);
    expect(res.items).toEqual([]);
    expect(res.totalDated).toBe(0);
    expect(res.excludedNoPlace).toBe(0);
  });

  it('melempar Error saat input bukan array', () => {
    expect(() => computeDeathsByCountry('bukan array')).toThrowError(
      'deaths-by-country: input harus array',
    );
    expect(() => computeDeathsByCountry(undefined)).toThrowError(
      'deaths-by-country: input harus array',
    );
  });

  it('melempar Error ber-index saat entri bukan objek', () => {
    const act = () =>
      computeDeathsByCountry([
        { deathDate: { date: '2020' }, deathPlace: 'Indonesia' },
        42,
      ]);
    expect(act).toThrowError('deaths-by-country: entri index 1 harus objek');
  });

  it('melempar Error saat deathDate ada tapi bukan objek', () => {
    const act = () =>
      computeDeathsByCountry([{ deathDate: '2020-01-01', deathPlace: 'Indonesia' }]);
    expect(act).toThrowError('deaths-by-country: entri index 0 deathDate harus objek');
  });

  it('melempar Error saat deathDate.date ada tapi bukan string', () => {
    const act = () =>
      computeDeathsByCountry([
        { deathDate: { date: 2020 }, deathPlace: 'Indonesia' },
      ]);
    expect(act).toThrowError(
      'deaths-by-country: entri index 0 deathDate.date harus string',
    );
  });

  it('melempar Error saat deathPlace ada tapi bukan string', () => {
    const act = () =>
      computeDeathsByCountry([{ deathDate: { date: '2020' }, deathPlace: 17 }]);
    expect(act).toThrowError(
      'deaths-by-country: entri index 0 deathPlace harus string',
    );
  });

  it('mengecualikan entri dengan deathDate tanpa date', () => {
    const res = computeDeathsByCountry([
      { deathDate: {}, deathPlace: 'Indonesia' },
    ]);
    expect(res.items).toEqual([]);
    expect(res.totalDated).toBe(0);
    expect(res.excludedNoPlace).toBe(1);
  });

  it('mengecualikan entri dengan date string kosong atau spasi', () => {
    const res = computeDeathsByCountry([
      { deathDate: { date: '' }, deathPlace: 'Indonesia' },
      { deathDate: { date: '   ' }, deathPlace: 'Indonesia' },
      { deathDate: { date: '2020' }, deathPlace: 'Indonesia' },
    ]);
    expect(res.items).toEqual([{ label: 'indonesia', count: 1 }]);
    expect(res.totalDated).toBe(1);
    expect(res.excludedNoPlace).toBe(2);
  });

  it('mengecualikan entri dengan deathPlace string kosong atau spasi', () => {
    const res = computeDeathsByCountry([
      { deathDate: { date: '2020' }, deathPlace: '' },
      { deathDate: { date: '2021' }, deathPlace: '  ' },
      { deathDate: { date: '2022' }, deathPlace: 'Malaysia' },
    ]);
    expect(res.items).toEqual([{ label: 'malaysia', count: 1 }]);
    expect(res.totalDated).toBe(1);
    expect(res.excludedNoPlace).toBe(2);
  });

  it('melempar semua Error dengan prefiks deaths-by-country', () => {
    const cases: Array<() => unknown> = [
      () => computeDeathsByCountry(null),
      () => computeDeathsByCountry([null]),
      () => computeDeathsByCountry([{ deathDate: [] }]),
      () => computeDeathsByCountry([{ deathDate: { date: true } }]),
      () => computeDeathsByCountry([{ deathPlace: {} }]),
    ];
    for (const act of cases) {
      expect(act).toThrowError(/^deaths-by-country:/);
    }
  });
});
