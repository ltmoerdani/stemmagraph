// Test v178-ii: karakterisasi ekspansi alias query pada lema fase 3 dan kolektif
// (kinship-aliases.ts rev notes 398 plus 416 plus 417). Melengkapi
// search-filter.alias.test.ts (v169-iii) tanpa duplikasi kasus.
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
  member({ id: 'a1', name: 'Aki Ruma' }),
  member({ id: 'e1', name: 'Eyang Putri' }),
  member({ id: 'b1', name: 'Mbah Dadi' }),
  member({ id: 'n1', name: 'Nini Theng' }),
  member({ id: 'm1', name: 'Misan Uning' }),
  member({ id: 'p1', name: 'Poyang Sanga' }),
  member({ id: 'k1', name: 'Karuhun Urang' }),
  member({ id: 'g1', name: 'Kakek Nenek Tua' }),
  member({ id: 'c1', name: 'Keturunan Tiga' }),
  member({ id: 'x1', name: 'Tanpa Nama Khusus' }),
];

describe('expandAliasQuery fase ii: lema regional dan kolektif', () => {
  it('query kosong dan whitespace kembali identitas tanpa ekspansi', () => {
    expect(expandAliasQuery('')).toEqual(['']);
    expect(expandAliasQuery('   ')).toEqual(['   ']);
  });

  it('query bukan alias kembali satu kandidat', () => {
    expect(expandAliasQuery('gadungan-zz')).toEqual(['gadungan-zz']);
  });

  it('label baku nasional sepupu tidak diekspansi', () => {
    expect(expandAliasQuery('sepupu')).toEqual(['sepupu']);
  });

  it('lema kolektif nenek moyang berlabel diri sehingga satu kandidat', () => {
    expect(expandAliasQuery('nenek moyang')).toEqual(['nenek moyang']);
  });

  it('aki Sunda: dua kandidat [asli, kakek nenek]', () => {
    expect(expandAliasQuery('aki')).toEqual(['aki', 'kakek nenek']);
  });

  it('eyang Jawa hormat: dua kandidat [asli, kakek nenek]', () => {
    expect(expandAliasQuery('eyang')).toEqual(['eyang', 'kakek nenek']);
  });

  it('mbah Jawa: dua kandidat [asli, kakek nenek]', () => {
    expect(expandAliasQuery('mbah')).toEqual(['mbah', 'kakek nenek']);
  });

  it('nini multi region: dua kandidat [asli, kakek nenek]', () => {
    expect(expandAliasQuery('nini')).toEqual(['nini', 'kakek nenek']);
  });

  it('misan Sunda: dua kandidat [asli, sepupu]', () => {
    expect(expandAliasQuery('misan')).toEqual(['misan', 'sepupu']);
  });

  it('poyang depth 4: label memuat kedalaman nenek moyang (4 generasi)', () => {
    expect(expandAliasQuery('poyang')).toEqual(['poyang', 'nenek moyang (4 generasi)']);
  });

  it('karuhun kolektif tanpa metadata regional tetap ekspansi ke nenek moyang', () => {
    expect(expandAliasQuery('karuhun')).toEqual(['karuhun', 'nenek moyang']);
  });

  it('buyut karakterisasi jujur: dua arah KBBI dirender label turun depth 3', () => {
    expect(expandAliasQuery('buyut')).toEqual(['buyut', 'keturunan (3 generasi)']);
  });

  it('case insensitive AKI: kandidat asli dipertahankan, label baku lowercase', () => {
    expect(expandAliasQuery('AKI')).toEqual(['AKI', 'kakek nenek']);
  });

  it('normalisasi spasi: kandidat asli verbatim, label tetap dikenali', () => {
    expect(expandAliasQuery('  aki  ')).toEqual(['  aki  ', 'kakek nenek']);
  });

  it('determinisme poyang: dua panggilan identik', () => {
    const a = expandAliasQuery('poyang');
    const b = expandAliasQuery('poyang');
    expect(a).toEqual(b);
  });
});

describe('searchWithAliases fase ii: dedup first-seen dan kombinasi', () => {
  it('aki menemukan nama lema lalu nama label, urutan kandidat dijaga', () => {
    const result = searchWithAliases(base, 'aki');
    expect(result.map((m) => m.id)).toEqual(['a1', 'g1']);
  });

  it('eyang dan mbah: match lema plus match label gabung urut kandidat', () => {
    expect(searchWithAliases(base, 'eyang').map((m) => m.id)).toEqual(['e1', 'g1']);
    expect(searchWithAliases(base, 'mbah').map((m) => m.id)).toEqual(['b1', 'g1']);
  });

  it('nini: match lema plus match label gabung', () => {
    expect(searchWithAliases(base, 'nini').map((m) => m.id)).toEqual(['n1', 'g1']);
  });

  it('misan menemukan Misan Uning', () => {
    expect(searchWithAliases(base, 'misan').map((m) => m.id)).toEqual(['m1']);
  });

  it('karuhun menemukan Karuhun Urang dan Nenek moyang via label', () => {
    const members = [...base, member({ id: 'k2', name: 'Nenek moyang Punden' })];
    expect(searchWithAliases(members, 'karuhun').map((m) => m.id)).toEqual(['k1', 'k2']);
  });

  it('buyut: label depth 3 hanya match nama memuat frasa label utuh', () => {
    const members = [...base, member({ id: 'c2', name: 'Keturunan (3 generasi) Simanjuntak' })];
    expect(searchWithAliases(members, 'buyut').map((m) => m.id)).toEqual(['c2']);
  });

  it('dedup first-seen: anggota match kedua kandidat muncul sekali di posisi awal', () => {
    const members = [
      member({ id: 'd1', name: 'Aki kakek nenek' }),
      member({ id: 'd2', name: 'Aki Lain' }),
    ];
    const result = searchWithAliases(members, 'aki');
    expect(result.map((m) => m.id)).toEqual(['d1', 'd2']);
    expect(new Set(result.map((m) => m.id)).size).toBe(result.length);
  });

  it('kombinasi options.generation tetap berlaku pada tiap kandidat', () => {
    const members = [
      member({ id: 'q1', name: 'Aki Muda', generation: 2 }),
      member({ id: 'q2', name: 'Aki Tua', generation: 1 }),
    ];
    const result = searchWithAliases(members, 'aki', { generation: 1 });
    expect(result.map((m) => m.id)).toEqual(['q2']);
  });

  it('query bukan alias identik dengan applySearchFilter termasuk hasil kosong', () => {
    expect(searchWithAliases(base, 'gadungan-zz')).toEqual(applySearchFilter(base, 'gadungan-zz'));
    expect(searchWithAliases(base, 'gadungan-zz')).toHaveLength(0);
  });

  it('urutan hasil deterministik antar panggilan identik', () => {
    const a = searchWithAliases(base, 'aki');
    const b = searchWithAliases(base, 'aki');
    expect(a.map((m) => m.id)).toEqual(b.map((m) => m.id));
  });
});
