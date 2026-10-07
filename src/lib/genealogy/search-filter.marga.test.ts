/**
 * Test GOAL v252-i: pencarian teks mencocokkan field marga.
 * Add-only di atas search-filter.test.ts, kasus deterministik, pure engine.
 */

import { describe, expect, it } from 'vitest';

import {
  applySearchFilter,
  searchWithAliases,
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
    id: 'mg1',
    name: 'Berdia Simanjuntak',
    marga: 'Simanjuntak',
    gender: 'M',
    generation: 1,
  }),
  makeMember({
    id: 'mg2',
    name: 'Rosita Ginting',
    marga: 'Ginting',
    gender: 'F',
    generation: 2,
  }),
  makeMember({
    id: 'mg3',
    name: 'Andi Wijaya',
    gender: 'M',
    generation: 2,
  }),
  makeMember({
    id: 'mg4',
    name: 'Sari Lestari',
    marga: null,
    gender: 'F',
    generation: 1,
  }),
];

describe('applySearchFilter marga (v252-i)', () => {
  it('kasus m1: query marga persis menemukan anggota bermarga itu', () => {
    const result = applySearchFilter(members, 'Simanjuntak');
    expect(result.map((m) => m.id)).toEqual(['mg1']);
  });

  it('kasus m2: query marga case-insensitive', () => {
    const result = applySearchFilter(members, 'simanjuntak');
    expect(result.map((m) => m.id)).toEqual(['mg1']);
  });

  it('kasus m3: anggota tanpa marga (undefined) tidak match query marga', () => {
    const result = applySearchFilter(members, 'ginting');
    expect(result.map((m) => m.id)).toEqual(['mg2']);
    expect(result.map((m) => m.id)).not.toContain('mg3');
  });

  it('kasus m4: marga null tidak match dan tidak error', () => {
    const result = applySearchFilter(members, 'lestari');
    // cocok lewat nama karena Lestari ada di name mg4, bukan lewat marga null
    expect(result.map((m) => m.id)).toEqual(['mg4']);
    const byMargaOnly = applySearchFilter(
      members.map((m) => ({ ...m, name: 'X' })),
      'lestari',
    );
    expect(byMargaOnly).toHaveLength(0);
  });

  it('kasus m5: non-regresi query nama tetap jalan seperti sebelumnya', () => {
    const result = applySearchFilter(members, 'andi');
    expect(result.map((m) => m.id)).toEqual(['mg3']);
  });

  it('kasus m6: query yang bukan marga tidak meloloskan anggota marga itu', () => {
    const result = applySearchFilter(members, 'simoal');
    expect(result).toHaveLength(0);
    const partial = applySearchFilter(members, 'siman');
    // substring case-insensitive pada marga tetap diizinkan sesuai kontrak matchesField
    expect(partial.map((m) => m.id)).toEqual(['mg1']);
  });

  it('kasus m7: searchWithAliases query bukan lema alias = kandidat tunggal, dedup benar', () => {
    const result = searchWithAliases(members, 'Simanjuntak');
    expect(result.map((m) => m.id)).toEqual(['mg1']);
    // marga match tidak menduplikasi lewat jalur alias
    const idSet = new Set(result.map((m) => m.id));
    expect(idSet.size).toBe(result.length);
  });

  it('kasus m8: nilai marga dengan spasi ujung tetap match setelah trim', () => {
    const padded = members.map((m) =>
      m.id === 'mg2' ? { ...m, marga: ' Ginting ' } : m,
    );
    const result = applySearchFilter(padded, '  ginting  ');
    expect(result.map((m) => m.id)).toEqual(['mg2']);
  });
});
