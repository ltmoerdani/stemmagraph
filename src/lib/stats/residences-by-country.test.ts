import { describe, it, expect } from 'vitest';
import { computeResidencesByCountry } from './residences-by-country';

describe('computeResidencesByCountry', () => {
  it('menghitung distribusi dasar multi negara', () => {
    const res = computeResidencesByCountry([
      { personId: 'p1', residences: ['Indonesia'] },
      { personId: 'p2', residences: ['Malaysia'] },
      { personId: 'p3', residences: ['Indonesia'] },
    ]);
    expect(res.countries).toEqual([
      { country: 'Indonesia', count: 2 },
      { country: 'Malaysia', count: 1 },
    ]);
    expect(res.totalEntries).toBe(3);
    expect(res.uniquePersons).toBe(3);
    expect(res.totalResidences).toBe(3);
  });

  it('memasukkan satu orang tiga negara ke ketiganya', () => {
    const res = computeResidencesByCountry([
      { personId: 'p1', residences: ['Jerman', 'Amerika Serikat', 'Prancis'] },
    ]);
    expect(res.countries).toEqual([
      { country: 'Amerika Serikat', count: 1 },
      { country: 'Jerman', count: 1 },
      { country: 'Prancis', count: 1 },
    ]);
    expect(res.uniquePersons).toBe(1);
    expect(res.totalResidences).toBe(3);
  });

  it('mendedupe pasangan sama orang sama negara sama dua entri dihitung 1', () => {
    const res = computeResidencesByCountry([
      { personId: 'p1', residences: ['Indonesia'] },
      { personId: 'p1', residences: ['Indonesia'] },
    ]);
    expect(res.countries).toEqual([{ country: 'Indonesia', count: 1 }]);
    expect(res.totalEntries).toBe(2);
    expect(res.uniquePersons).toBe(1);
    expect(res.totalResidences).toBe(1);
  });

  it('mendedupe negara ganda di residences satu orang', () => {
    const res = computeResidencesByCountry([
      { personId: 'p1', residences: ['Indonesia', 'Indonesia', 'Malaysia', 'Indonesia'] },
    ]);
    expect(res.countries).toEqual([
      { country: 'Indonesia', count: 1 },
      { country: 'Malaysia', count: 1 },
    ]);
    expect(res.totalResidences).toBe(2);
  });

  it('menghasilkan hasil identik saat urutan input diacak', () => {
    const urut = computeResidencesByCountry([
      { personId: 'p1', residences: ['Indonesia', 'Malaysia'] },
      { personId: 'p2', residences: ['Indonesia'] },
      { personId: 'p3', residences: ['Jepang'] },
    ]);
    const acak = computeResidencesByCountry([
      { personId: 'p3', residences: ['Jepang'] },
      { personId: 'p2', residences: ['Indonesia'] },
      { personId: 'p1', residences: ['Malaysia', 'Indonesia'] },
    ]);
    expect(acak).toEqual(urut);
  });

  it('menghitung totalEntries dan uniquePersons dengan tepat', () => {
    const res = computeResidencesByCountry([
      { personId: 'p1', residences: ['Indonesia'] },
      { personId: 'p1', residences: ['Malaysia'] },
      { personId: 'p2', residences: ['Indonesia'] },
      { personId: 'p3', residences: [] },
    ]);
    expect(res.totalEntries).toBe(4);
    expect(res.uniquePersons).toBe(3);
  });

  it('menyamakan totalResidences dengan jumlah count countries', () => {
    const res = computeResidencesByCountry([
      { personId: 'p1', residences: ['A', 'B', 'C'] },
      { personId: 'p2', residences: ['A', 'A'] },
      { personId: 'p3', residences: ['B'] },
    ]);
    const sum = res.countries.reduce((acc, row) => acc + row.count, 0);
    expect(res.totalResidences).toBe(sum);
    expect(res.totalResidences).toBe(5);
  });

  it('mengurutkan countries alfabetis naik', () => {
    const res = computeResidencesByCountry([
      { personId: 'p1', residences: ['zambia', 'brazil', 'argentina', 'brazil'] },
    ]);
    expect(res.countries.map((row) => row.country)).toEqual([
      'argentina',
      'brazil',
      'zambia',
    ]);
  });

  it('mengembalikan negara kosong untuk input kosong', () => {
    const res = computeResidencesByCountry([]);
    expect(res.countries).toEqual([]);
    expect(res.totalEntries).toBe(0);
    expect(res.uniquePersons).toBe(0);
    expect(res.totalResidences).toBe(0);
  });

  it('memperlakukan string kosong sebagai negara valid', () => {
    const res = computeResidencesByCountry([
      { personId: 'p1', residences: [''] },
      { personId: 'p2', residences: [''] },
      { personId: 'p1', residences: [''] },
    ]);
    expect(res.countries).toEqual([{ country: '', count: 2 }]);
    expect(res.totalResidences).toBe(2);
  });

  it('memperlakukan residences array kosong sebagai entri tanpa negara', () => {
    const res = computeResidencesByCountry([
      { personId: 'p1', residences: [] },
    ]);
    expect(res.countries).toEqual([]);
    expect(res.totalEntries).toBe(1);
    expect(res.uniquePersons).toBe(1);
    expect(res.totalResidences).toBe(0);
  });

  it('memisahkan pasangan saat personId mengandung karakter khusus', () => {
    const res = computeResidencesByCountry([
      { personId: 'a:b', residences: ['X'] },
      { personId: 'a', residences: ['b:X'] },
    ]);
    expect(res.countries).toHaveLength(2);
    expect(res.countries).toEqual(
      expect.arrayContaining([
        { country: 'X', count: 1 },
        { country: 'b:X', count: 1 },
      ]),
    );
    expect(res.uniquePersons).toBe(2);
    expect(res.totalResidences).toBe(2);
  });

  it('melempar Error saat input bukan array', () => {
    expect(() => computeResidencesByCountry('bukan array')).toThrowError(
      'residences-by-country: input harus array',
    );
    expect(() => computeResidencesByCountry(undefined)).toThrowError(
      'residences-by-country: input harus array',
    );
  });

  it('melempar Error ber-index saat entri bukan objek termasuk null dan array', () => {
    expect(() =>
      computeResidencesByCountry([
        { personId: 'p1', residences: ['Indonesia'] },
        null,
      ]),
    ).toThrowError('residences-by-country: entri index 1 harus objek');
    expect(() => computeResidencesByCountry([[1, 2]])).toThrowError(
      'residences-by-country: entri index 0 harus objek',
    );
  });

  it('melempar Error ber-index saat personId hilang atau bukan string', () => {
    expect(() => computeResidencesByCountry([{ residences: ['X'] }])).toThrowError(
      'residences-by-country: entri index 0 personId harus string',
    );
    expect(() =>
      computeResidencesByCountry([{ personId: 7, residences: ['X'] }]),
    ).toThrowError('residences-by-country: entri index 0 personId harus string');
  });

  it('melempar Error ber-index saat residences hilang atau bukan array', () => {
    expect(() => computeResidencesByCountry([{ personId: 'p1' }])).toThrowError(
      'residences-by-country: entri index 0 residences harus array',
    );
    expect(() =>
      computeResidencesByCountry([{ personId: 'p1', residences: 'X' }]),
    ).toThrowError('residences-by-country: entri index 0 residences harus array');
  });

  it('melempar Error ber-index ganda saat elemen residences bukan string', () => {
    expect(() =>
      computeResidencesByCountry([
        { personId: 'p1', residences: ['Indonesia'] },
        { personId: 'p2', residences: ['Malaysia', 42] },
      ]),
    ).toThrowError(
      'residences-by-country: entri index 1 residences[1] harus string',
    );
  });

  it('melempar semua Error dengan prefiks residences-by-country via regex', () => {
    const cases: Array<() => unknown> = [
      () => computeResidencesByCountry(42),
      () => computeResidencesByCountry([null]),
      () => computeResidencesByCountry([{}]),
      () => computeResidencesByCountry([{ personId: 'p1' }]),
      () => computeResidencesByCountry([{ personId: 'p1', residences: [true] }]),
    ];
    for (const act of cases) {
      expect(act).toThrowError(/^residences-by-country:/);
    }
  });
});
