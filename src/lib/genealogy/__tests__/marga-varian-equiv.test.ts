import { describe, expect, it } from 'vitest';

import {
  MARGA_VARIAN_EQUIV,
  isSameMarga,
  varianEquiv,
} from '../leksikon-bank';
import {
  applySearchFilter,
  type SearchMember,
} from '../search-filter';

function member(id: string, marga?: string): SearchMember {
  return {
    id,
    name: `Anggota ${id}`,
    marga: marga ?? null,
    gender: 'M',
    generation: 1,
  };
}

describe('marga-varian-equiv', () => {
  it('kasus 1: komposit rapat Peranginangin cocok Perangin-angin dua arah di pencarian', () => {
    const members1 = [member('m1', 'Perangin-angin')];
    expect(applySearchFilter(members1, 'Peranginangin', {}).map((m) => m.id)).toEqual(['m1']);
    const members2 = [member('m2', 'Peranginangin')];
    expect(applySearchFilter(members2, 'Perangin-angin', {}).map((m) => m.id)).toEqual(['m2']);
    expect(varianEquiv('Perangin-angin')).toContain('Peranginangin');
    expect(varianEquiv('Peranginangin')).toContain('Peranginangin');
  });

  it('kasus 2: Galingging dan Sigalingging saling cocok dua arah di pencarian teks', () => {
    const members = [member('m1', 'Sigalingging'), member('m2', 'Karo')];
    const hasil = applySearchFilter(members, 'Galingging', {});
    expect(hasil.map((m) => m.id)).toEqual(['m1']);
    const members2 = [member('m3', 'Galingging'), member('m4', 'Karo')];
    const hasil2 = applySearchFilter(members2, 'Sigalingging', {});
    expect(hasil2.map((m) => m.id)).toEqual(['m3']);
  });

  it('kasus 3: filter opsi marga mengenali varian Galingging vs tercatat Sigalingging', () => {
    const members = [member('m1', 'Sigalingging'), member('m2', 'Ginting')];
    const hasil = applySearchFilter(members, '', { marga: 'Galingging' });
    expect(hasil.map((m) => m.id)).toEqual(['m1']);
  });

  it('kasus 4: NEGATIF pengunci, Garingging TIDAK sama dengan Sigalingging', () => {
    const members = [member('m1', 'Sigalingging')];
    const hasil = applySearchFilter(members, 'Garingging', {});
    expect(hasil).toHaveLength(0);
    expect(applySearchFilter(members, '', { marga: 'Garingging' })).toHaveLength(0);
  });

  it('kasus 5: NEGATIF pengunci, Garingging TIDAK sama dengan Galingging', () => {
    const members = [member('m1', 'Galingging')];
    const hasil = applySearchFilter(members, 'Garingging', {});
    expect(hasil).toHaveLength(0);
  });

  it('kasus 6: NEGATIF, Gultom TIDAK sama dengan Gurning', () => {
    const members = [member('m1', 'Gultom'), member('m2', 'Gurning')];
    expect(applySearchFilter(members, 'Gultom', {}).map((m) => m.id)).toEqual(['m1']);
    expect(applySearchFilter(members, 'Gurning', {}).map((m) => m.id)).toEqual(['m2']);
  });

  it('kasus 7: varianEquiv input tanpa kelompok mengembalikan komposit rapat dirinya', () => {
    expect(varianEquiv('Sembiring')).toEqual(['Sembiring']);
    expect(varianEquiv('Perangin-angin')).toEqual(['Peranginangin']);
    expect(varianEquiv('Perangin Angin')).toEqual(['PeranginAngin']);
  });

  it('kasus 8: varianEquiv kelompok mengembalikan varian lain plus bentuk rapat', () => {
    const hasil = varianEquiv('Galingging');
    expect(hasil).toContain('Sigalingging');
    expect(hasil).toContain('Galingging');
    const hasil2 = varianEquiv('sigalingging');
    expect(hasil2).toContain('Galingging');
  });

  it('kasus 9: case-insensitive di seluruh lapis', () => {
    expect(isSameMarga(varianEquiv('GALINGGING')[0], 'sigalingging')).toBe(true);
    const members = [member('m1', 'sigalingging')];
    expect(applySearchFilter(members, 'GALINGGING', {})).toHaveLength(1);
  });

  it('kasus 10: guard kosong, undefined, dan whitespace aman', () => {
    expect(varianEquiv(undefined)).toEqual([]);
    expect(varianEquiv('')).toEqual([]);
    expect(varianEquiv('   ')).toEqual([]);
    const members = [member('m1', 'Sigalingging')];
    expect(applySearchFilter(members, '', {})).toHaveLength(1);
  });

  it('kasus 11: non-regresi, isSameMarga perilaku lama hyfen dan spasi tidak berubah', () => {
    expect(isSameMarga('Perangin-angin', 'perangin-angin')).toBe(true);
    expect(isSameMarga('Perangin-angin', 'perangin  angin')).toBe(true);
    expect(isSameMarga(undefined, 'Ginting')).toBe(false);
    expect(isSameMarga('', 'Ginting')).toBe(false);
  });

  it('kasus 12: seed berisi tepat pasangan Galingging Sigalingging tanpa Garingging', () => {
    expect(MARGA_VARIAN_EQUIV).toHaveLength(1);
    expect(MARGA_VARIAN_EQUIV[0]).toContain('Galingging');
    expect(MARGA_VARIAN_EQUIV[0]).toContain('Sigalingging');
    const semua = MARGA_VARIAN_EQUIV.flat();
    expect(semua).not.toContain('Garingging');
  });
});
