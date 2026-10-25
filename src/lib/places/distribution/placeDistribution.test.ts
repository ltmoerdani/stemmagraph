// v399: test unit modul agregasi place distribution.
// Cakupan: agregasi sel 2 desimal, count per sel, eksklusi tanpa
// koordinat dan koordinat di luar rentang, validasi input, urutan
// deterministik, dan jaminan payload murni {lat,lng,count}.
import { describe, expect, it } from 'vitest';
import { computePlaceDistribution } from './placeDistribution';

describe('computePlaceDistribution', () => {
  it('melempar error untuk input non-array', () => {
    expect(() => computePlaceDistribution(null)).toThrow('input harus array');
    expect(() => computePlaceDistribution('x')).toThrow('input harus array');
    expect(() => computePlaceDistribution({})).toThrow('input harus array');
  });

  it('melempar error untuk entri non-objek', () => {
    expect(() => computePlaceDistribution([42])).toThrow('entri index 0 harus objek');
    expect(() => computePlaceDistribution([null])).toThrow('entri index 0 harus objek');
    expect(() => computePlaceDistribution([[]])).toThrow('entri index 0 harus objek');
  });

  it('melempar error untuk tipe latitude/longitude salah', () => {
    expect(() => computePlaceDistribution([{ latitude: 'x', longitude: 1 }])).toThrow(
      'entri index 0 latitude harus number atau null',
    );
    expect(() => computePlaceDistribution([{ latitude: 1, longitude: 'y' }])).toThrow(
      'entri index 0 longitude harus number atau null',
    );
    expect(() => computePlaceDistribution([{ latitude: 1, longitude: undefined }])).toThrow(
      'entri index 0 longitude harus number atau null',
    );
  });

  it('agregasi dua koordinat dalam sel 2 desimal yang sama jadi satu titik', () => {
    const result = computePlaceDistribution([
      { latitude: -6.20881, longitude: 106.84559 },
      { latitude: -6.20903, longitude: 106.84521 },
    ]);
    expect(result.points).toHaveLength(1);
    expect(result.points[0]).toEqual({ lat: -6.21, lng: 106.85, count: 2 });
    expect(result.totalPlaced).toBe(2);
    expect(result.excludedNoCoords).toBe(0);
  });

  it('koordinat berbeda sel menghasilkan titik terpisah', () => {
    const result = computePlaceDistribution([
      { latitude: -6.2, longitude: 106.8 },
      { latitude: -6.3, longitude: 106.9 },
    ]);
    expect(result.points).toHaveLength(2);
    expect(result.totalPlaced).toBe(2);
  });

  it('mengesklusikan place tanpa koordinat tanpa memasukkan agregasi', () => {
    const result = computePlaceDistribution([
      { latitude: null, longitude: null },
      { latitude: -6.2, longitude: 106.8 },
    ]);
    expect(result.points).toHaveLength(1);
    expect(result.totalPlaced).toBe(1);
    expect(result.excludedNoCoords).toBe(1);
  });

  it('mengesklusikan koordinat di luar rentang resmi', () => {
    const result = computePlaceDistribution([
      { latitude: 91, longitude: 0 },
      { latitude: -91, longitude: 0 },
      { latitude: 0, longitude: 181 },
      { latitude: 0, longitude: -181 },
      { latitude: Number.POSITIVE_INFINITY, longitude: 0 },
      { latitude: Number.NaN, longitude: Number.NaN },
      { latitude: 0, longitude: 0 },
    ]);
    expect(result.points).toEqual([{ lat: 0, lng: 0, count: 1 }]);
    expect(result.totalPlaced).toBe(1);
    expect(result.excludedNoCoords).toBe(6);
  });

  it('menerima batas rentang ekstrem yang sah', () => {
    const result = computePlaceDistribution([
      { latitude: 90, longitude: 180 },
      { latitude: -90, longitude: -180 },
    ]);
    expect(result.totalPlaced).toBe(2);
    expect(result.excludedNoCoords).toBe(0);
  });

  it('mengurutkan output deterministik: count menurun lalu lat lalu lng', () => {
    const result = computePlaceDistribution([
      { latitude: 1.11, longitude: 2.22 },
      { latitude: 3.33, longitude: 4.44 },
      { latitude: 1.12, longitude: 2.22 },
      { latitude: 3.33, longitude: 4.45 },
      { latitude: -5.5, longitude: 6.6 },
    ]);
    expect(result.points.map((p) => [p.lat, p.lng, p.count])).toEqual([
      [-5.5, 6.6, 1],
      [1.11, 2.22, 1],
      [1.12, 2.22, 1],
      [3.33, 4.44, 1],
      [3.33, 4.45, 1],
    ]);
  });

  it('payload titik murni berisi hanya lat, lng, count', () => {
    const result = computePlaceDistribution([{ latitude: 10.555, longitude: -20.444 }]);
    const keys = Object.keys(result.points[0]).sort();
    expect(keys).toEqual(['count', 'lat', 'lng']);
    expect(result.points[0]).toEqual({ lat: 10.56, lng: -20.44, count: 1 });
  });

  it('array kosong menghasilkan result kosong', () => {
    const result = computePlaceDistribution([]);
    expect(result.points).toEqual([]);
    expect(result.totalPlaced).toBe(0);
    expect(result.excludedNoCoords).toBe(0);
  });

  it('membulatkan -0 ke 0 agar kunci sel stabil', () => {
    const result = computePlaceDistribution([
      { latitude: -0.001, longitude: -0.001 },
      { latitude: 0.001, longitude: 0.001 },
    ]);
    expect(result.points).toEqual([{ lat: 0, lng: 0, count: 2 }]);
  });
});
