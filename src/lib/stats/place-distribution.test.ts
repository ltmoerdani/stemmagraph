import { describe, it, expect } from 'vitest';
import { computePlaceDistribution } from './place-distribution';

describe('computePlaceDistribution', () => {
  it('satu negara satu wilayah', () => {
    const res = computePlaceDistribution([
      { birthPlace: 'Bandung, Jawa Barat, Indonesia' },
      { birthPlace: 'Depok, Jawa Barat, Indonesia' },
    ]);
    expect(res.totalWithPlace).toBe(2);
    expect(res.excludedNoPlace).toBe(0);
    expect(res.countries).toEqual([
      { country: 'indonesia', count: 2, regions: [{ region: 'jawa barat', count: 2 }] },
    ]);
  });

  it('multi negara urut count desc, tie-break nama asc, currentLocation dipakai saat birthPlace kosong', () => {
    const res = computePlaceDistribution([
      { birthPlace: 'Munich, Bayern, Jerman' },
      { birthPlace: 'Bandung, Indonesia' },
      { birthPlace: 'Jakarta, Indonesia' },
      { currentLocation: 'Kuala Lumpur, Malaysia' },
      { birthPlace: 'Surabaya, Jawa Timur, Indonesia' },
    ]);
    expect(res.countries.map((c) => c.country)).toEqual(['indonesia', 'jerman', 'malaysia']);
    expect(res.countries[0].count).toBe(3);
    expect(res.countries[1].count).toBe(1);
    expect(res.countries[2].count).toBe(1);
    expect(res.totalWithPlace).toBe(5);
  });

  it('semua entry tanpa place masuk excludedNoPlace', () => {
    const res = computePlaceDistribution([
      {},
      { birthPlace: '   ' },
      { currentLocation: '' },
      { birthPlace: '', currentLocation: '  ' },
    ]);
    expect(res.totalWithPlace).toBe(0);
    expect(res.excludedNoPlace).toBe(4);
    expect(res.countries).toEqual([]);
  });

  it('token tunggal tanpa koma: negara saja tanpa wilayah', () => {
    const res = computePlaceDistribution([{ birthPlace: 'Indonesia' }]);
    expect(res.countries).toEqual([{ country: 'indonesia', count: 1, regions: [] }]);
  });

  it('wilayah ganda dalam satu negara terakumulasi, urut count desc', () => {
    const res = computePlaceDistribution([
      { birthPlace: 'Bandung, Jawa Barat, Indonesia' },
      { birthPlace: 'Bogor, Jawa Barat, Indonesia' },
      { birthPlace: 'Semarang, Jawa Tengah, Indonesia' },
    ]);
    expect(res.countries).toHaveLength(1);
    expect(res.countries[0].regions).toEqual([
      { region: 'jawa barat', count: 2 },
      { region: 'jawa tengah', count: 1 },
    ]);
  });

  it('input null throw', () => {
    expect(() => computePlaceDistribution(null)).toThrowError(
      /^place-distribution: input harus array/,
    );
  });

  it('input objek throw', () => {
    expect(() => computePlaceDistribution({})).toThrowError(
      /^place-distribution: input harus array/,
    );
  });
});
