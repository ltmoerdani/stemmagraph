// Test v169-iii: expandAliasQuery dan searchWithAliases di search-filter.ts.
// Label kanonik merujuk kinship-labels.ts: 'kakek' -> 'kakek nenek',
// 'cicit' -> 'keturunan (3 generasi)', 'anak' -> 'anak' (label == query).
import { describe, it, expect } from 'vitest';
import {
  applySearchFilter,
  expandAliasQuery,
  searchWithAliases,
  type SearchMember,
} from './search-filter';

function member(partial: Partial<SearchMember> & { id: string }): SearchMember {
  return {
    name: partial.id,
    nickname: null,
    profession: null,
    currentLocation: null,
    birthPlace: null,
    birthDate: null,
    deathDate: null,
    gender: 'U',
    generation: 1,
    ...partial,
  };
}

const base: SearchMember[] = [
  member({ id: 'm1', name: 'Cucu Budi' }),
  member({ id: 'm2', name: 'Nenek Sari' }),
  member({ id: 'm3', name: 'Kakek Nenek Family', birthPlace: 'Bandung' }),
  member({ id: 'm4', name: 'Sepupu Andi' }),
  member({ id: 'm5', name: 'Anak Wati' }),
  member({ id: 'm6', name: 'Budi Santoso', birthPlace: 'Jakarta' }),
];

describe('expandAliasQuery', () => {
  it('lema anak: label kanonik sama dengan query sehingga tidak ada duplikat', () => {
    expect(expandAliasQuery('anak')).toEqual(['anak']);
  });

  it('lema kakek: mengembalikan [asli, label kanonik] urutan stabil', () => {
    expect(expandAliasQuery('kakek')).toEqual(['kakek', 'kakek nenek']);
  });

  it('lema cicit (depth 3): label memuat kedalaman 3 generasi', () => {
    expect(expandAliasQuery('cicit')).toEqual(['cicit', 'keturunan (3 generasi)']);
  });

  it('query tidak dikenali kembali tanpa label tambahan', () => {
    expect(expandAliasQuery('bukan-alias')).toEqual(['bukan-alias']);
  });

  it('query kosong konsisten: [query] tanpa ekspansi', () => {
    expect(expandAliasQuery('')).toEqual(['']);
    expect(expandAliasQuery('   ')).toEqual(['   ']);
  });

  it('case-insensitive: KAKEK dikenali, urutan [asli, label] dijaga', () => {
    expect(expandAliasQuery('KAKEK')).toEqual(['KAKEK', 'kakek nenek']);
  });

  it('determinisme: dua kali panggil menghasilkan array identik', () => {
    const a = expandAliasQuery('misan');
    const b = expandAliasQuery('misan');
    expect(a).toEqual(b);
    expect(a).toEqual(['misan', 'sepupu']);
  });

  it('query panjang acak tidak menghasilkan ekspansi liar', () => {
    const noisy = 'zx qwv keren-sekali 12345 kakekzilla';
    expect(expandAliasQuery(noisy)).toEqual([noisy]);
  });
});

describe('searchWithAliases', () => {
  it('ekspansi murni: query kakek menemukan anggota bernama label kanonik', () => {
    const result = searchWithAliases(base, 'kakek');
    expect(result.map((m) => m.id)).toEqual(['m3']);
  });

  it('lema daerah menemukan label kanonik: misan menemukan Sepupu Andi', () => {
    const result = searchWithAliases(base, 'misan');
    expect(result.map((m) => m.id)).toEqual(['m4']);
  });

  it('ekspansi frasa: datuk nenek menemukan anggota bernama Nenek moyang Arsip', () => {
    const members = [
      ...base,
      member({ id: 'm7', name: 'Nenek moyang Arsip' }),
    ];
    const result = searchWithAliases(members, 'datuk nenek');
    expect(result.map((m) => m.id)).toEqual(['m7']);
  });

  it('dedup: anggota yang match query asli dan label hanya muncul sekali', () => {
    const result = searchWithAliases(base, 'kakek');
    const ids = result.map((m) => m.id);
    expect(ids.filter((id) => id === 'm3')).toHaveLength(1);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('query non-alias berperilaku identik dengan applySearchFilter', () => {
    expect(searchWithAliases(base, 'budi')).toEqual(applySearchFilter(base, 'budi'));
    expect(searchWithAliases(base, '')).toEqual(applySearchFilter(base, ''));
  });

  it('kombinasi options.birthPlace tetap jalan bersama ekspansi alias', () => {
    const result = searchWithAliases(base, 'kakek', { birthPlace: 'Bandung' });
    expect(result.map((m) => m.id)).toEqual(['m3']);
  });

  it('urutan hasil deterministik antar panggilan identik', () => {
    const a = searchWithAliases(base, 'kakek');
    const b = searchWithAliases(base, 'kakek');
    expect(a.map((m) => m.id)).toEqual(b.map((m) => m.id));
  });

  it('pertama-seen: kandidat query asli diurut lebih dulu daripada label', () => {
    // 'Kakek Nenek Family' match kedua kandidat; tetap satu kali, posisi dari
    // kandidat pertama ('kakek').
    const result = searchWithAliases(base, 'kakek');
    expect(result[0].id).toBe('m3');
  });
});
