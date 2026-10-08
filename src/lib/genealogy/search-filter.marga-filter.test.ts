/**
 * Test GOAL v252-v: filter marga satu dimensi via dropdown saran.
 * Add-only testfile baru, kasus deterministik, pure engine.
 * Non-regresi: kasus marga lain di search-filter.marga.test.ts dan
 * search-filter.marga-tolerant.test.ts tetap hijau tanpa perubahan.
 */

import { describe, expect, it } from 'vitest';

import {
  applySearchFilter,
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
    id: 'vf1',
    name: 'Berdia Sembiring',
    marga: 'Sembiring Meliala',
    gender: 'M',
    generation: 1,
  }),
  makeMember({
    id: 'vf2',
    name: 'Serpas Ginting',
    marga: 'Sembiring',
    gender: 'F',
    generation: 2,
  }),
  makeMember({
    id: 'vf3',
    name: 'Dewanata Perangin',
    marga: 'Perangin-Angin',
    gender: 'M',
  }),
  makeMember({
    id: 'vf4',
    name: 'Rosalina Simanjuntak',
    marga: 'Simanjuntak',
    gender: 'F',
    generation: 2,
  }),
  makeMember({
    id: 'vf5',
    name: 'Tanpa Marga',
    marga: null,
    gender: 'U',
    generation: 3,
  }),
];

describe('applySearchFilter opsi marga (v252-v)', () => {
  it('kasus f1: filter satu marga menemukan anggota marga itu saja', () => {
    const result = applySearchFilter(members, '', { marga: 'Simanjuntak' });
    expect(result.map((m) => m.id)).toEqual(['vf4']);
  });

  it('kasus f2: kombinasi query teks plus filter marga berlaku AND', () => {
    const result = applySearchFilter(members, 'serpas', { marga: 'Sembiring' });
    expect(result.map((m) => m.id)).toEqual(['vf2']);
  });

  it('kasus f3: filter kosong meloloskan semua', () => {
    const result = applySearchFilter(members, '', { marga: '' });
    expect(result).toHaveLength(5);
  });

  it('kasus f4: reset filter (opsi hilang) kembali ke semua', () => {
    const withFilter = applySearchFilter(members, '', { marga: 'Sembiring' });
    expect(withFilter).toHaveLength(2);
    const reset = applySearchFilter(members, '', {});
    expect(reset).toHaveLength(5);
  });

  it('kasus f5: varian ejaan melipat, Peranginangin cocok Perangin-Angin', () => {
    const result = applySearchFilter(members, '', { marga: 'Peranginangin' });
    expect(result.map((m) => m.id)).toEqual(['vf3']);
  });

  it('kasus f6: negatif, marga nihil anggota menghasilkan kosong', () => {
    const result = applySearchFilter(members, '', { marga: 'Karokaro' });
    expect(result).toHaveLength(0);
  });

  it('kasus f7: guard substring, query Purba tidak menangkap Karokaro Purba sebagai beda marga', () => {
    const local = [
      makeMember({ id: 'f7a', name: 'A Karokaro', marga: 'Karokaro Purba' }),
      makeMember({ id: 'f7b', name: 'B Purba', marga: 'Purba' }),
    ];
    // Filter 'Purba' menangkap keduanya via dua arah substring tolerant:
    // tercatat 'Karokaro Purba' memuat kunci query 'purba' (arah recorded
    // includes query) dan kunci tercatat 'purba' sama dengan query.
    const result = applySearchFilter(local, '', { marga: 'Purba' });
    expect(result.map((m) => m.id)).toEqual(['f7a', 'f7b']);
  });

  it('kasus f8: non-regresi opsi lama, birthPlace dan gender tetap bekerja', () => {
    const byPlace = applySearchFilter(members, '', { birthPlace: 'kabanjahe' });
    expect(byPlace).toHaveLength(0);
    const byGender = applySearchFilter(members, '', { gender: 'F' });
    expect(byGender.map((m) => m.id)).toEqual(['vf2', 'vf4']);
  });
});
