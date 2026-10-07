/**
 * Test GOAL v252-iii: pencarian marga toleran ortografi.
 * Add-only testfile baru, kasus deterministik, pure engine.
 * Non-regresi: kasus v252-i di search-filter.marga.test.ts tetap hijau
 * tanpa perubahan pada file itu.
 */

import { describe, expect, it } from 'vitest';

import {
  applySearchFilter,
  matchesMargaTolerant,
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
    id: 'mt1',
    name: 'Berdia Sembiring',
    marga: 'Sembiring Meliala',
    gender: 'M',
    generation: 1,
  }),
  makeMember({
    id: 'mt2',
    name: 'Serpas Ginting',
    marga: 'Sembiring',
    gender: 'F',
    generation: 2,
  }),
  makeMember({
    id: 'mt3',
    name: 'Dewanata Perangin',
    marga: 'Perangin-Angin',
    gender: 'M',
    generation: 2,
  }),
  makeMember({
    id: 'mt4',
    name: 'Rosalina Simanjuntak',
    marga: 'Simanjuntak',
    gender: 'F',
    generation: 1,
  }),
  makeMember({
    id: 'mt5',
    name: 'Tanpa Marga',
    marga: null,
    gender: 'U',
    generation: 3,
  }),
];

describe('matchesMargaTolerant (v252-iii)', () => {
  it('kasus t1: query Sembiring menemukan tercatat Sembiring Meliala', () => {
    expect(matchesMargaTolerant('Sembiring Meliala', 'Sembiring')).toBe(true);
  });

  it('kasus t2: arah balik, query Sembiring Meliala menemukan tercatat Sembiring', () => {
    expect(matchesMargaTolerant('Sembiring', 'Sembiring Meliala')).toBe(true);
  });

  it('kasus t3: tiga ortografi Perangin Angin saling cocok dengan tercatat Perangin-Angin', () => {
    expect(matchesMargaTolerant('Perangin-Angin', 'Perangin Angin')).toBe(true);
    expect(matchesMargaTolerant('Perangin-Angin', 'Perangin-angin')).toBe(true);
    expect(matchesMargaTolerant('Perangin-Angin', 'peranginangin')).toBe(true);
  });

  it('kasus t4: negatif marga beda akar nihil', () => {
    expect(matchesMargaTolerant('Simanjuntak', 'Ginting')).toBe(false);
    expect(matchesMargaTolerant('Ginting', 'Simanjuntak')).toBe(false);
  });

  it('kasus t5: marga null atau undefined tidak match dan tidak error', () => {
    expect(matchesMargaTolerant(null, 'Ginting')).toBe(false);
    expect(matchesMargaTolerant(undefined, 'Ginting')).toBe(false);
    expect(matchesMargaTolerant('Ginting', null)).toBe(false);
    expect(matchesMargaTolerant('Ginting', undefined)).toBe(false);
    expect(matchesMargaTolerant(null, null)).toBe(false);
  });

  it('kasus t6: query kosong atau whitespace tidak meloloskan via jalur marga', () => {
    expect(matchesMargaTolerant('Ginting', '')).toBe(false);
    expect(matchesMargaTolerant('Ginting', '   ')).toBe(false);
    expect(matchesMargaTolerant('Ginting', '-')).toBe(false);
    expect(matchesMargaTolerant('', 'Ginting')).toBe(false);
  });

  it('kasus t7: spasi ganda dan kapitalisasi rapi tetap cocok', () => {
    expect(matchesMargaTolerant('SEMBIRING  MELIALA', 'sembiring meliala')).toBe(true);
    const result = applySearchFilter(members, 'sembiring  meliala');
    // dua arah: mt1 cocok eksak komposit, mt2 cocok via arah balik kunci rapat
    expect(result.map((m) => m.id)).toEqual(['mt1', 'mt2']);
  });

  it('kasus t8: searchWithAliases query non-alias kandidat tunggal, dedup by id benar', () => {
    const result = searchWithAliases(members, 'Perangin Angin');
    expect(result.map((m) => m.id)).toEqual(['mt3']);
    const idSet = new Set(result.map((m) => m.id));
    expect(idSet.size).toBe(result.length);
  });
});

describe('applySearchFilter marga toleran (v252-iii)', () => {
  it('kasus t9: query Sembiring menemukan mt1 lewat marga, bukan lewat nama', () => {
    const byName = applySearchFilter(
      members.map((m) => ({ ...m, name: 'X' })),
      'Sembiring',
    );
    expect(byName.map((m) => m.id).sort()).toEqual(['mt1', 'mt2']);
  });

  it('kasus t10: anggota tanpa marga tidak match query marga', () => {
    const result = applySearchFilter(members, 'Ginting Sembiring');
    expect(result.map((m) => m.id)).not.toContain('mt5');
  });

  it('kasus t11: non-regresi query nama tetap jalan seperti sebelumnya', () => {
    const result = applySearchFilter(members, 'rosalina');
    expect(result.map((m) => m.id)).toEqual(['mt4']);
  });
});
