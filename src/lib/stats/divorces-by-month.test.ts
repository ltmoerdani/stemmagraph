import { describe, it, expect } from 'vitest';
import { computeDivorcesByMonth } from './divorces-by-month';

describe('computeDivorcesByMonth', () => {
  it('1. menghitung distribusi 12 bulan dasar dan akumulasi multi-entri', () => {
    const data = [
      { personId: 'p1', divorceDate: '2020-01-15' },
      { personId: 'p2', divorceDate: '2020-01-20' },
      { personId: 'p3', divorceDate: '2020-02-10' },
      { personId: 'p4', divorceDate: '2020-03-05' },
      { personId: 'p5', divorceDate: '2020-04-12' },
      { personId: 'p6', divorceDate: '2020-05-22' },
      { personId: 'p7', divorceDate: '2020-06-30' },
      { personId: 'p8', divorceDate: '2020-07-01' },
      { personId: 'p9', divorceDate: '2020-08-15' },
      { personId: 'p10', divorceDate: '2020-09-18' },
      { personId: 'p11', divorceDate: '2020-10-25' },
      { personId: 'p12', divorceDate: '2020-11-11' },
      { personId: 'p13', divorceDate: '2020-12-31' }
    ];
    const res = computeDivorcesByMonth(data);
    expect(res.total).toBe(13);
    expect(res.months[0]).toBe(2);
    expect(res.peakMonth).toBe(1);
    expect(res.peakCount).toBe(2);
  });

  it('2. urutan input diacak menghasilkan hasil yang identik', () => {
    const data1 = [
      { personId: 'p1', divorceDate: '2020-05-01' },
      { personId: 'p2', divorceDate: '2020-05-02' },
      { personId: 'p3', divorceDate: '2020-08-10' }
    ];
    const data2 = [
      { personId: 'p3', divorceDate: '2020-08-10' },
      { personId: 'p1', divorceDate: '2020-05-01' },
      { personId: 'p2', divorceDate: '2020-05-02' }
    ];
    expect(computeDivorcesByMonth(data1)).toEqual(computeDivorcesByMonth(data2));
  });

  it('3. peakMonth memilih bulan terkecil saat terjadi tie count', () => {
    const data = [
      { personId: 'p1', divorceDate: '2020-07-01' },
      { personId: 'p2', divorceDate: '2020-03-01' }
    ];
    const res = computeDivorcesByMonth(data);
    expect(res.peakMonth).toBe(3);
    expect(res.peakCount).toBe(1);
  });

  it('4. mengembalikan nilai kosong atau null saat total 0', () => {
    const res = computeDivorcesByMonth([]);
    expect(res.total).toBe(0);
    expect(res.months).toEqual(new Array(12).fill(0));
    expect(res.peakMonth).toBeNull();
    expect(res.peakCount).toBeNull();
  });

  it('5. menerima 29 Februari pada tahun kabisat', () => {
    const data = [{ personId: 'p1', divorceDate: '2020-02-29' }];
    const res = computeDivorcesByMonth(data);
    expect(res.months[1]).toBe(1);
  });

  it('6. throw jika input bukan array', () => {
    expect(() => computeDivorcesByMonth(null)).toThrow(/divorces-by-month/);
    expect(() => computeDivorcesByMonth({})).toThrow(/divorces-by-month/);
  });

  it('7. throw jika entri bukan objek', () => {
    expect(() => computeDivorcesByMonth(['invalid'])).toThrow(/divorces-by-month/);
  });

  it('8. throw jika personId hilang atau bukan string', () => {
    expect(() => computeDivorcesByMonth([{ divorceDate: '2020-01-01' }])).toThrow(/divorces-by-month/);
  });

  it('9. throw jika divorceDate hilang atau bukan string', () => {
    expect(() => computeDivorcesByMonth([{ personId: 'p1' }])).toThrow(/divorces-by-month/);
  });

  it('10. throw jika format divorceDate salah atau tanggal tidak valid kalender', () => {
    expect(() => computeDivorcesByMonth([{ personId: 'p1', divorceDate: '2020/01/01' }])).toThrow(/divorces-by-month/);
    expect(() => computeDivorcesByMonth([{ personId: 'p1', divorceDate: '2020-00-01' }])).toThrow(/divorces-by-month/);
    expect(() => computeDivorcesByMonth([{ personId: 'p1', divorceDate: '2020-13-01' }])).toThrow(/divorces-by-month/);
    expect(() => computeDivorcesByMonth([{ personId: 'p1', divorceDate: '2021-02-29' }])).toThrow(/divorces-by-month/);
  });
});
