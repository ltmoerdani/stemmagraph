import { describe, it, expect } from 'vitest';
import { computeBirthsByCountry } from './births-by-country';

describe('computeBirthsByCountry', () => {
  it('mengambil token terakhir saat birthPlace multi koma', () => {
    const res = computeBirthsByCountry([
      { birthDate: { date: '1990-01-01' }, birthPlace: 'Bandung, Jawa Barat, Indonesia' },
    ]);
    expect(res.items).toEqual([{ label: 'indonesia', count: 1 }]);
    expect(res.totalDated).toBe(1);
  });

  it('memakai seluruh string saat birthPlace tanpa koma', () => {
    const res = computeBirthsByCountry([
      { birthDate: { date: '1990' }, birthPlace: 'Indonesia' },
    ]);
    expect(res.items).toEqual([{ label: 'indonesia', count: 1 }]);
  });

  it('menormalkan label ke lowercase', () => {
    const res = computeBirthsByCountry([
      { birthDate: { date: '1990' }, birthPlace: 'INDONESIA' },
      { birthDate: { date: '1991' }, birthPlace: 'Jakarta, Indonesia' },
    ]);
    expect(res.items).toEqual([{ label: 'indonesia', count: 2 }]);
  });

  it('memotong spasi di sekitar place dan token setelah koma', () => {
    const res = computeBirthsByCountry([
      { birthDate: { date: '1990' }, birthPlace: '  Malaysia  ' },
      { birthDate: { date: '1991' }, birthPlace: 'KL,   Malaysia ' },
    ]);
    expect(res.items).toEqual([{ label: 'malaysia', count: 2 }]);
  });

  it('mengagregasi count dari banyak entri', () => {
    const res = computeBirthsByCountry([
      { birthDate: { date: '1990' }, birthPlace: 'Indonesia' },
      { birthDate: { date: '1990' }, birthPlace: 'Surabaya, Indonesia' },
      { birthDate: { date: '1991' }, birthPlace: 'Malaysia' },
      { birthDate: { date: '1991' }, birthPlace: 'MALAYSIA' },
      { birthDate: { date: '1992' }, birthPlace: 'Jakarta, Malaysia' },
      { birthDate: { date: '1992' }, birthPlace: 'Singapore' },
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
    const res = computeBirthsByCountry([
      { birthDate: { date: '1990' }, birthPlace: 'A Country' },
      { birthDate: { date: '1990' }, birthPlace: 'Z Country' },
      { birthDate: { date: '1990' }, birthPlace: 'Z Country' },
    ]);
    expect(res.items.map((row) => row.label)).toEqual(['z country', 'a country']);
  });

  it('mengurutkan tie count secara alphabetical dengan localeCompare', () => {
    const res = computeBirthsByCountry([
      { birthDate: { date: '1990' }, birthPlace: 'zambia' },
      { birthDate: { date: '1990' }, birthPlace: 'brazil' },
      { birthDate: { date: '1990' }, birthPlace: 'argentina' },
    ]);
    expect(res.items.map((row) => row.label)).toEqual(['argentina', 'brazil', 'zambia']);
  });

  it('menghitung totalDated dan excludedNoPlace dengan tepat', () => {
    const res = computeBirthsByCountry([
      { birthDate: { date: '1990' }, birthPlace: 'Indonesia' },
      { birthPlace: 'Malaysia' },
      { birthDate: { date: '1991' } },
      { birthDate: { date: '1992' }, birthPlace: 'Indonesia' },
      {},
    ]);
    expect(res.totalDated).toBe(2);
    expect(res.excludedNoPlace).toBe(3);
    expect(res.items).toEqual([{ label: 'indonesia', count: 2 }]);
  });

  it('mengembalikan hasil nol untuk input kosong', () => {
    const res = computeBirthsByCountry([]);
    expect(res.items).toEqual([]);
    expect(res.totalDated).toBe(0);
    expect(res.excludedNoPlace).toBe(0);
  });

  it('melempar Error saat input bukan array', () => {
    expect(() => computeBirthsByCountry('bukan array')).toThrowError(
      'births-by-country: input harus array',
    );
    expect(() => computeBirthsByCountry(undefined)).toThrowError(
      'births-by-country: input harus array',
    );
  });

  it('melempar Error ber-index saat entri bukan objek', () => {
    const act = () =>
      computeBirthsByCountry([
        { birthDate: { date: '1990' }, birthPlace: 'Indonesia' },
        42,
      ]);
    expect(act).toThrowError('births-by-country: entri index 1 harus objek');
  });

  it('melempar Error saat birthDate ada tapi bukan objek', () => {
    const act = () =>
      computeBirthsByCountry([{ birthDate: '1990-01-01', birthPlace: 'Indonesia' }]);
    expect(act).toThrowError('births-by-country: entri index 0 birthDate harus objek');
  });

  it('melempar Error saat birthDate.date ada tapi bukan string', () => {
    const act = () =>
      computeBirthsByCountry([
        { birthDate: { date: 1990 }, birthPlace: 'Indonesia' },
      ]);
    expect(act).toThrowError(
      'births-by-country: entri index 0 birthDate.date harus string',
    );
  });

  it('melempar Error saat birthPlace ada tapi bukan string', () => {
    const act = () =>
      computeBirthsByCountry([{ birthDate: { date: '1990' }, birthPlace: 17 }]);
    expect(act).toThrowError(
      'births-by-country: entri index 0 birthPlace harus string',
    );
  });

  it('mengecualikan entri dengan birthDate tanpa date', () => {
    const res = computeBirthsByCountry([
      { birthDate: {}, birthPlace: 'Indonesia' },
    ]);
    expect(res.items).toEqual([]);
    expect(res.totalDated).toBe(0);
    expect(res.excludedNoPlace).toBe(1);
  });

  it('mengecualikan entri dengan date string kosong atau spasi', () => {
    const res = computeBirthsByCountry([
      { birthDate: { date: '' }, birthPlace: 'Indonesia' },
      { birthDate: { date: '   ' }, birthPlace: 'Indonesia' },
      { birthDate: { date: '1990' }, birthPlace: 'Indonesia' },
    ]);
    expect(res.items).toEqual([{ label: 'indonesia', count: 1 }]);
    expect(res.totalDated).toBe(1);
    expect(res.excludedNoPlace).toBe(2);
  });

  it('mengecualikan entri dengan birthPlace string kosong atau spasi', () => {
    const res = computeBirthsByCountry([
      { birthDate: { date: '1990' }, birthPlace: '' },
      { birthDate: { date: '1991' }, birthPlace: '  ' },
      { birthDate: { date: '1992' }, birthPlace: 'Malaysia' },
    ]);
    expect(res.items).toEqual([{ label: 'malaysia', count: 1 }]);
    expect(res.totalDated).toBe(1);
    expect(res.excludedNoPlace).toBe(2);
  });

  it('melempar semua Error dengan prefiks births-by-country', () => {
    const cases: Array<() => unknown> = [
      () => computeBirthsByCountry(null),
      () => computeBirthsByCountry([null]),
      () => computeBirthsByCountry([{ birthDate: [] }]),
      () => computeBirthsByCountry([{ birthDate: { date: true } }]),
      () => computeBirthsByCountry([{ birthPlace: {} }]),
    ];
    for (const act of cases) {
      expect(act).toThrowError(/^births-by-country:/);
    }
  });
});
