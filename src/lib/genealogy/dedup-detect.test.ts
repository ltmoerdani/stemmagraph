import { describe, expect, it } from 'vitest';

import { findDuplicatePairs } from './dedup-detect';

describe('findDuplicatePairs', () => {
  it('kasus 1: list kosong mengembalikan array kosong', () => {
    expect(findDuplicatePairs([])).toEqual([]);
  });

  it('kasus 2: nama depan sama case-insensitive dan trim bernilai 45', () => {
    const persons = [
      { id: 'p1', firstName: ' Budi ' },
      { id: 'p2', firstName: 'budi' },
    ];
    expect(findDuplicatePairs(persons, { threshold: 45 })).toEqual([
      { idA: 'p1', idB: 'p2', score: 45, reasons: ['SAME_FIRST_NAME'] },
    ]);
    expect(findDuplicatePairs(persons)).toEqual([]);
  });

  it('kasus 3: nama depan beda tidak menghasilkan pasangan', () => {
    const persons = [
      { id: 'a', firstName: 'Budi' },
      { id: 'b', firstName: 'Santi' },
    ];
    expect(findDuplicatePairs(persons, { threshold: 1 })).toEqual([]);
  });

  it('kasus 4: nama belakang sama bernilai 35, di bawah threshold default ditolak', () => {
    const persons = [
      { id: 'a', lastName: ' Santoso ' },
      { id: 'b', lastName: 'santoso' },
    ];
    expect(findDuplicatePairs(persons)).toEqual([]);
    expect(findDuplicatePairs(persons, { threshold: 35 })).toEqual([
      { idA: 'a', idB: 'b', score: 35, reasons: ['SAME_LAST_NAME'] },
    ]);
  });

  it('kasus 5: tahun lahir sama bernilai 20 dari format tanggal berbeda', () => {
    const persons = [
      { id: 'a', firstName: 'A', birthDate: '1990-05-01' },
      { id: 'b', firstName: 'B', birthDate: '01/05/1990' },
    ];
    expect(findDuplicatePairs(persons, { threshold: 20 })).toEqual([
      { idA: 'a', idB: 'b', score: 20, reasons: ['SAME_BIRTH_YEAR'] },
    ]);
  });

  it('kasus 6: tanpa tanggal tidak ada bonus tahun (nihil bonus)', () => {
    const persons = [
      { id: 'a', firstName: 'X', lastName: 'Y' },
      { id: 'b', firstName: 'X', lastName: 'Y' },
    ];
    expect(findDuplicatePairs(persons)).toEqual([
      { idA: 'a', idB: 'b', score: 80, reasons: ['SAME_FIRST_NAME', 'SAME_LAST_NAME'] },
    ]);
  });

  it('kasus 7: boundary threshold, skor 65 di bawah 79 ditolak dan skor 80 tepat di 80 diterima', () => {
    const skorRendah = [
      { id: 'a', firstName: 'A', birthDate: '1990-01-01' },
      { id: 'b', firstName: 'A', birthDate: '1990-01-01' },
    ];
    expect(findDuplicatePairs(skorRendah, { threshold: 79 })).toEqual([]);
    expect(findDuplicatePairs(skorRendah, { threshold: 65 })).toHaveLength(1);

    const skorPas = [
      { id: 'a', firstName: 'X', lastName: 'Y' },
      { id: 'b', firstName: 'X', lastName: 'Y' },
    ];
    expect(findDuplicatePairs(skorPas, { threshold: 80 })).toHaveLength(1);
    expect(findDuplicatePairs(skorPas, { threshold: 81 })).toEqual([]);
  });

  it('kasus 8: skor penuh 100 dengan tiga reasons berurutan', () => {
    const persons = [
      { id: 'a', firstName: 'Budi', lastName: 'Santoso', birthDate: '1990-05-01' },
      { id: 'b', firstName: 'budi', lastName: 'santoso', birthDate: '01/05/1990' },
    ];
    expect(findDuplicatePairs(persons)).toEqual([
      {
        idA: 'a',
        idB: 'b',
        score: 100,
        reasons: ['SAME_FIRST_NAME', 'SAME_LAST_NAME', 'SAME_BIRTH_YEAR'],
      },
    ]);
  });

  it('kasus 9: pasangan reversed id tunggal dinormalisasi idA lebih kecil dari idB', () => {
    const persons = [
      { id: 'z9', firstName: 'Budi' },
      { id: 'a1', firstName: 'Budi' },
    ];
    expect(findDuplicatePairs(persons, { threshold: 45 })).toEqual([
      { idA: 'a1', idB: 'z9', score: 45, reasons: ['SAME_FIRST_NAME'] },
    ]);
  });

  it('kasus 10: person tanpa nama di-skip', () => {
    const persons = [
      { id: 'n1' },
      { id: 'n2', firstName: '   ' },
      { id: 'n3', lastName: '' },
      { id: 'ok1', firstName: 'Budi' },
      { id: 'ok2', firstName: 'Budi' },
    ];
    expect(findDuplicatePairs(persons, { threshold: 45 })).toEqual([
      { idA: 'ok1', idB: 'ok2', score: 45, reasons: ['SAME_FIRST_NAME'] },
    ]);
  });

  it('kasus 11: pasangan id sama tidak menghasilkan pasangan', () => {
    const persons = [
      { id: 'same', firstName: 'Budi' },
      { id: 'same', firstName: 'Budi' },
      { id: 'other', firstName: 'Budi' },
    ];
    expect(findDuplicatePairs(persons, { threshold: 45 })).toEqual([
      { idA: 'other', idB: 'same', score: 45, reasons: ['SAME_FIRST_NAME'] },
    ]);
  });

  it('kasus 12: banyak pasangan lintas, terurut idA lalu idB', () => {
    const persons = [
      { id: 'c', firstName: 'Budi', lastName: 'S', birthDate: '1980-01-01' },
      { id: 'a', firstName: 'Budi', lastName: 'S', birthDate: '1980-01-01' },
      { id: 'b', firstName: 'Budi', lastName: 'S', birthDate: '1980-01-01' },
    ];
    const pairs = findDuplicatePairs(persons);
    expect(pairs).toHaveLength(3);
    expect(pairs.map((p) => [p.idA, p.idB])).toEqual([
      ['a', 'b'],
      ['a', 'c'],
      ['b', 'c'],
    ]);
    expect(pairs.every((p) => p.score === 100)).toBe(true);
  });

  it('kasus 13: determinisme terhadap urutan input diacak', () => {
    const base = [
      { id: 'k5', firstName: 'Dewi', lastName: 'Lestari', birthDate: '1975-03-03' },
      { id: 'k1', firstName: 'Dewi', lastName: 'Lestari', birthDate: '1975-03-03' },
      { id: 'k3', firstName: 'Dewi', lastName: 'Lestari', birthDate: '1975-03-03' },
      { id: 'k2', firstName: 'Dewi', lastName: 'Lestari', birthDate: '1975-03-03' },
    ];
    const acak1 = [base[1], base[3], base[0], base[2]];
    const acak2 = [base[2], base[1], base[3], base[0]];
    const hasil = findDuplicatePairs(base);
    expect(findDuplicatePairs(acak1)).toEqual(hasil);
    expect(findDuplicatePairs(acak2)).toEqual(hasil);
    expect(hasil.map((p) => [p.idA, p.idB])).toEqual([
      ['k1', 'k2'],
      ['k1', 'k3'],
      ['k1', 'k5'],
      ['k2', 'k3'],
      ['k2', 'k5'],
      ['k3', 'k5'],
    ]);
  });

  it('kasus 14: threshold kustom, rendah menangkap skor kecil dan tinggi menyaring semua', () => {
    const persons = [
      { id: 'm2', firstName: 'Ani', birthDate: '2000-01-01' },
      { id: 'm1', firstName: 'Ani', birthDate: '2000-01-01' },
    ];
    expect(findDuplicatePairs(persons, { threshold: 0 })).toHaveLength(1);
    expect(findDuplicatePairs(persons, { threshold: 44 })).toHaveLength(1);
    expect(findDuplicatePairs(persons, { threshold: 101 })).toEqual([]);
  });
});
