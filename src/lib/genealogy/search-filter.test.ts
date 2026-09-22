/**
 * Test untuk pure search-filter engine (GOAL v150 fase i).
 * Semua kasus deterministik: input sama menghasilkan output sama.
 */

import { describe, expect, it } from 'vitest';

import {
  applySearchFilter,
  filterAndSort,
  type SearchMember,
} from './search-filter';

function makeMember(overrides: Partial<SearchMember> & { id: string }): SearchMember {
  return {
    name: 'Tanpa Nama',
    gender: 'U',
    generation: 1,
    ...overrides,
  };
}

const members: SearchMember[] = [
  makeMember({
    id: 'm1',
    name: 'Budi Santoso',
    nickname: 'Budi',
    profession: 'Guru',
    currentLocation: 'Bandung',
    birthPlace: 'Bandung',
    gender: 'M',
    generation: 1,
    birthDate: '1950-01-01',
  }),
  makeMember({
    id: 'm2',
    name: 'Siti Rahayu',
    nickname: 'Iti',
    profession: 'Dokter',
    currentLocation: 'Surabaya',
    birthPlace: 'Solo',
    gender: 'F',
    generation: 2,
    birthDate: '1975-05-10',
    deathDate: '2020-08-01',
  }),
  makeMember({
    id: 'm3',
    name: 'Andi Wijaya',
    profession: 'guru ngaji',
    currentLocation: 'bandung timur',
    birthPlace: 'Bandung',
    gender: 'X',
    generation: 2,
    birthDate: '1980-03-15',
  }),
  makeMember({
    id: 'm4',
    name: 'Rina Mala',
    profession: 'Perawat',
    currentLocation: 'Yogyakarta',
    birthPlace: 'Kediri',
    gender: 'U',
    generation: 3,
  }),
];

describe('applySearchFilter', () => {
  it('kasus 1: query kosong mengembalikan semua anggota', () => {
    expect(applySearchFilter(members, '')).toHaveLength(4);
    expect(applySearchFilter(members, '   ')).toHaveLength(4);
  });

  it('kasus 2: query cocok pada name', () => {
    const result = applySearchFilter(members, 'Santoso');
    expect(result.map((m) => m.id)).toEqual(['m1']);
  });

  it('kasus 3: query cocok pada profession', () => {
    const result = applySearchFilter(members, 'Dokter');
    expect(result.map((m) => m.id)).toEqual(['m2']);
  });

  it('kasus 4: query cocok pada currentLocation', () => {
    const result = applySearchFilter(members, 'Yogyakarta');
    expect(result.map((m) => m.id)).toEqual(['m4']);
  });

  it('kasus 5: query cocok pada nickname', () => {
    const result = applySearchFilter(members, 'Iti');
    expect(result.map((m) => m.id)).toEqual(['m2']);
  });

  it('kasus 6: pencarian case-insensitive', () => {
    const result = applySearchFilter(members, 'budi');
    expect(result.map((m) => m.id)).toEqual(['m1']);
  });

  it('kasus 7: filter birthPlace substring case-insensitive', () => {
    const result = applySearchFilter(members, '', { birthPlace: 'band' });
    expect(result.map((m) => m.id)).toEqual(['m1', 'm3']);
  });

  it('kasus 8: filter gender X dan U', () => {
    const genderX = applySearchFilter(members, '', { gender: 'X' });
    expect(genderX.map((m) => m.id)).toEqual(['m3']);
    const genderU = applySearchFilter(members, '', { gender: 'U' });
    expect(genderU.map((m) => m.id)).toEqual(['m4']);
  });

  it('kasus 9: filter generation', () => {
    const result = applySearchFilter(members, '', { generation: 2 });
    expect(result.map((m) => m.id)).toEqual(['m2', 'm3']);
  });

  it('kasus 10: filter isAlive true hanya yang deathDate null', () => {
    const result = applySearchFilter(members, '', { isAlive: true });
    expect(result.map((m) => m.id)).toEqual(['m1', 'm3', 'm4']);
  });

  it('kasus 11: filter isAlive false hanya yang deathDate terisi', () => {
    const result = applySearchFilter(members, '', { isAlive: false });
    expect(result.map((m) => m.id)).toEqual(['m2']);
  });

  it('kasus 12: kombinasi multi-filter (query + birthPlace + isAlive)', () => {
    const result = applySearchFilter(members, 'a', {
      birthPlace: 'Bandung',
      isAlive: true,
    });
    // m1: 'Santoso' mengandung 'a', birthPlace Bandung, hidup. m3: 'Andi', Bandung, hidup.
    expect(result.map((m) => m.id)).toEqual(['m1', 'm3']);
  });

  it('kasus 13: deterministik, dua panggilan input sama hasil sama', () => {
    const first = applySearchFilter(members, 'a', { gender: 'M' });
    const second = applySearchFilter(members, 'a', { gender: 'M' });
    expect(first).toEqual(second);
    // Input tidak dimutasi.
    expect(members).toHaveLength(4);
  });
});

describe('filterAndSort', () => {
  it('kasus 14: sortBy name asc urut alfabetis (showAlive)', () => {
    const result = filterAndSort(members, {
      viewMode: 'showAlive',
      sortBy: 'name',
      sortDirection: 'asc',
    });
    expect(result.map((m) => m.name)).toEqual([
      'Andi Wijaya',
      'Budi Santoso',
      'Rina Mala',
    ]);
  });

  it('kasus 15: sortBy name desc kebalikan asc', () => {
    const result = filterAndSort(members, {
      viewMode: 'showAlive',
      sortBy: 'name',
      sortDirection: 'desc',
    });
    expect(result.map((m) => m.name)).toEqual([
      'Rina Mala',
      'Budi Santoso',
      'Andi Wijaya',
    ]);
  });

  it('kasus 16: sortBy birthDate asc, tanggal null di akhir', () => {
    const result = filterAndSort(members, {
      viewMode: 'showAlive',
      sortBy: 'birthDate',
      sortDirection: 'asc',
    });
    expect(result.map((m) => m.id)).toEqual(['m1', 'm3', 'm4']);
  });

  it('kasus 17: viewMode selectedGeneration dan showDeceased', () => {
    const gen2 = filterAndSort(members, {
      viewMode: 'selectedGeneration',
      generation: 2,
      sortBy: 'name',
      sortDirection: 'asc',
    });
    expect(gen2.map((m) => m.id)).toEqual(['m3', 'm2']);
    const deceased = filterAndSort(members, {
      viewMode: 'showDeceased',
      sortBy: 'name',
      sortDirection: 'asc',
    });
    expect(deceased.map((m) => m.id)).toEqual(['m2']);
  });

  it('kasus 18: deterministik, dua panggilan filterAndSort input sama hasil sama', () => {
    const options = {
      viewMode: 'showAlive' as const,
      sortBy: 'name' as const,
      sortDirection: 'asc' as const,
    };
    const first = filterAndSort(members, options);
    const second = filterAndSort(members, options);
    expect(first).toEqual(second);
  });
});
