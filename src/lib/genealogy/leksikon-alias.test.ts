import { describe, expect, it } from 'vitest';
import { resetLeksikonBank, type LeksikonEntry } from './leksikon-bank';
import { resolveLeksikonAlias } from './leksikon-alias';

const toru: LeksikonEntry = {
  lemma: 'Toru',
  makna: 'Nama sungai besar di pantai barat, ejaan kolonial Toroe.',
  alias: ['Toroe'],
  dictionaryRecorded: false,
  sources: [
    { karya: 'Junghuhn 1847, vol 2', lokasi: 'byte 421102, hlm sekitar 174', kutipan: 'Aneka varian nama Sungai Toru' },
  ],
};

const batangGadis: LeksikonEntry = {
  lemma: 'Batang Gadis',
  makna: 'Sungai di Mandailing, generic lokal Aek.',
  alias: ['Aek Batanggadis'],
  dictionaryRecorded: false,
  sources: [
    { karya: 'notes 552', lokasi: 'Geonames Aek Batanggadis', kutipan: 'Aek Batanggadis' },
  ],
};

const kaliLumut: LeksikonEntry = {
  lemma: 'Kali Lumut',
  alias: ['Eik Simawangon', 'Loemoet'],
  dictionaryRecorded: false,
  sources: [
    { karya: 'notes 551', lokasi: 'footnote Dolok-Eik, hlm 95-96', kutipan: 'Dolok-Eik' },
  ],
};

function lemmaOf(result: ReturnType<typeof resolveLeksikonAlias>): string | null {
  return result && !('error' in result) ? result.lemma : null;
}

describe('resolveLeksikonAlias', () => {
  it('kasus 1: lemma persis', () => {
    expect(lemmaOf(resolveLeksikonAlias('Toru', [toru]))).toBe('Toru');
  });

  it('kasus 2: ejaan pra-1947 Loemoet resolve ke entri Lumut', () => {
    expect(lemmaOf(resolveLeksikonAlias('Loemoet', [kaliLumut]))).toBe('Kali Lumut');
  });

  it('kasus 3: ejaan kolonial Toroe resolve ke Toru', () => {
    expect(lemmaOf(resolveLeksikonAlias('Toroe', [toru]))).toBe('Toru');
  });

  it('kasus 4: Aek Batanggadis (alias ber-generic menempel) resolve ke Batang Gadis', () => {
    expect(lemmaOf(resolveLeksikonAlias('Aek Batanggadis', [batangGadis]))).toBe('Batang Gadis');
  });

  it('kasus 5: generic berpisah Aek Batang Gadis resolve sama', () => {
    expect(lemmaOf(resolveLeksikonAlias('Aek Batang Gadis', [batangGadis]))).toBe('Batang Gadis');
  });

  it('kasus 6: alias dua arah Eik Simawangon resolve ke entri jangkar Kali Lumut', () => {
    expect(lemmaOf(resolveLeksikonAlias('Eik Simawangon', [kaliLumut]))).toBe('Kali Lumut');
  });

  it('kasus 7: nama tak dikenal null', () => {
    expect(resolveLeksikonAlias('Sihaporas', [toru])).toBeNull();
  });

  it('kasus 8: query kosong dan spasi saja null', () => {
    expect(resolveLeksikonAlias('', [toru])).toBeNull();
    expect(resolveLeksikonAlias('   ', [toru])).toBeNull();
  });

  it('kasus 9: case campuran dan spasi pinggir tetap hit', () => {
    expect(lemmaOf(resolveLeksikonAlias('  tOROE  ', [toru]))).toBe('Toru');
  });

  it('kasus 10: dua entri cocok tingkat sama mengembalikan AMBIGUOUS dengan kandidat', () => {
    const kembar: LeksikonEntry = { ...kaliLumut, lemma: 'Lumut', alias: ['Eik Simawangon'] };
    const hit = resolveLeksikonAlias('Eik Simawangon', [kaliLumut, kembar]);
    expect(hit).not.toBeNull();
    expect('error' in hit && hit.error).toBe('AMBIGUOUS');
    if ('error' in hit) {
      expect(hit.candidates).toHaveLength(2);
    }
  });

  it('kasus 11: generic saja tanpa nama inti tetap null, tidak salah resolve', () => {
    expect(resolveLeksikonAlias('Batang', [batangGadis])).toBeNull();
    expect(resolveLeksikonAlias('Aek', [batangGadis])).toBeNull();
  });

  it('kasus 12: alias persis menang dan tidak terganggu entri lain di bank', () => {
    expect(lemmaOf(resolveLeksikonAlias('Toroe', [toru, kaliLumut]))).toBe('Toru');
  });

  it('kasus 13: internal bank leksikon tetap bisa direset tanpa efek samping', () => {
    resetLeksikonBank();
    expect(lemmaOf(resolveLeksikonAlias('Toroe', [toru]))).toBe('Toru');
  });
});
