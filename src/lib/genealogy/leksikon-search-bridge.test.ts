import { beforeEach, describe, expect, it } from 'vitest';
import {
  addEntry,
  getLeksikonBank,
  resetLeksikonBank,
  type LeksikonEntry,
} from './leksikon-bank';
import {
  expandQueryWithLeksikon,
  searchMembersWithLeksikon,
} from './leksikon-search-bridge';
import type { SearchMember } from './search-filter';

// Jangkar data: seed bank (Batang tanpa alias, Kali Lumut alias Eik Simawangon).
beforeEach(() => {
  resetLeksikonBank();
});

function member(partial: Partial<SearchMember> & { id: string; name: string }): SearchMember {
  return {
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

describe('expandQueryWithLeksikon', () => {
  it('kasus 1: query kosong dan spasi saja menghasilkan array kosong', () => {
    expect(expandQueryWithLeksikon('')).toEqual([]);
    expect(expandQueryWithLeksikon('   ')).toEqual([]);
  });

  it('kasus 2: query tak dikenal hanya mengembalikan query asli', () => {
    expect(expandQueryWithLeksikon('Sihaporas')).toEqual(['Sihaporas']);
  });

  it('kasus 3: lemma dikenal tanpa alias tidak menduplikasi query asli', () => {
    expect(expandQueryWithLeksikon('Batang')).toEqual(['Batang']);
  });

  it('kasus 4: query lemma menghasilkan lemma plus alias tanpa duplikat', () => {
    expect(expandQueryWithLeksikon('Kali Lumut')).toEqual(['Kali Lumut', 'Eik Simawangon']);
  });

  it('kasus 5: query alias menghasilkan query asli di indeks 0 lalu lemma', () => {
    expect(expandQueryWithLeksikon('Eik Simawangon')).toEqual([
      'Eik Simawangon',
      'Kali Lumut',
    ]);
  });

  it('kasus 6: ejaan pra-1947 Loemoet mengembalikan query asli plus bentuk bank', () => {
    expect(expandQueryWithLeksikon('Loemoet')).toEqual([
      'Loemoet',
      'Kali Lumut',
      'Eik Simawangon',
    ]);
  });

  it('kasus 7: hasil AMBIGUOUS hanya mengembalikan query asli (tanpa pilihan senyap)', () => {
    const kembar: LeksikonEntry = {
      lemma: 'Lumut Baru',
      alias: ['Eik Simawangon'],
      dictionaryRecorded: false,
      sources: [{ karya: 'tes', lokasi: 'tes', kutipan: 'tes' }],
    };
    const merged = addEntry(kembar);
    expect(merged.ok).toBe(true);
    expect(expandQueryWithLeksikon('Eik Simawangon')).toEqual(['Eik Simawangon']);
  });

  it('kasus 8: dedup case-insensitive, query asli tetap verbatim di indeks 0', () => {
    // Query asli dipertahankan apa adanya di indeks 0; lemma 'Kali Lumut' dianggap
    // duplikat key dari asli sehingga hanya alias yang ditambahkan.
    expect(expandQueryWithLeksikon('  kali lumut ')).toEqual([
      '  kali lumut ',
      'Eik Simawangon',
    ]);
  });

  it('kasus 9: hasil ekspansi salinan dalam, mutasi tidak merusak bank', () => {
    const terms = expandQueryWithLeksikon('Kali Lumut');
    terms.push('racun');
    expect(getLeksikonBank()).toHaveLength(5);
    expect(expandQueryWithLeksikon('Kali Lumut')).toHaveLength(2);
  });
});

describe('searchMembersWithLeksikon', () => {
  const members: SearchMember[] = [
    member({ id: 'm1', name: 'Si Toru Panjaitan' }),
    member({ id: 'm2', name: 'Lumut Siregar', nickname: 'Eik Simawangon' }),
    member({ id: 'm3', name: 'Budi Simatupang', gender: 'M' }),
  ];

  it('kasus 10: pencarian menemukan anggota lewat alias ekspansi yang tidak kena query asli', () => {
    // 'Kali Lumut' tidak ada di teks m2, tapi alias hasil ekspansi 'Eik Simawangon' kena nickname.
    const result = searchMembersWithLeksikon(members, 'Kali Lumut');
    expect(result.map((m) => m.id)).toEqual(['m2']);
  });

  it('kasus 11: anggota yang cocok beberapa term ekspansi tetap muncul satu kali (dedup by id)', () => {
    const ganda = member({ id: 'm4', name: 'Kali Lumut', nickname: 'Eik Simawangon' });
    const result = searchMembersWithLeksikon([...members, ganda], 'Kali Lumut');
    expect(result.filter((m) => m.id === 'm4')).toHaveLength(1);
  });

  it('kasus 12: query kosong berperilaku persis searchWithAliases, filter terstruktur tetap berlaku', () => {
    const result = searchMembersWithLeksikon(members, '', { gender: 'M' });
    expect(result.map((m) => m.id)).toEqual(['m3']);
  });

  it('kasus 13: query tak dikenal berperilaku pencarian biasa (substring)', () => {
    const result = searchMembersWithLeksikon(members, 'budi');
    expect(result.map((m) => m.id)).toEqual(['m3']);
  });

  it('kasus 14: kondisi AMBIGUOUS mematikan ekspansi sehingga anggota alias tidak ditemukan', () => {
    const kembar: LeksikonEntry = {
      lemma: 'Lumut Baru',
      alias: ['Eik Simawangon'],
      dictionaryRecorded: false,
      sources: [{ karya: 'tes', lokasi: 'tes', kutipan: 'tes' }],
    };
    addEntry(kembar);
    const result = searchMembersWithLeksikon(members, 'Eik Simawangon');
    expect(result.map((m) => m.id)).toEqual(['m2']);
  });

  it('kasus 15: filter isAlive tetap dievaluasi pada hasil ekspansi', () => {
    const almarhum = member({
      id: 'm5',
      name: 'Almarhum Toru',
      deathDate: '2001-01-01',
    });
    const result = searchMembersWithLeksikon([...members, almarhum], 'Toru', {
      isAlive: true,
    });
    expect(result.map((m) => m.id)).toEqual(['m1']);
  });

  it('kasus 16: urutan hasil deterministik mengikuti term pertama dilihat', () => {
    const result = searchMembersWithLeksikon(members, 'Loemoet');
    expect(result.map((m) => m.id)).toEqual(['m2']);
  });
});
