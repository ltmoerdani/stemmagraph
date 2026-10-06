import { beforeEach, describe, expect, it } from 'vitest';

import {
  addEntry,
  getLeksikonBank,
  lookupLeksikon,
  normalizeQuery,
  resetLeksikonBank,
} from './leksikon-bank';

describe('leksikon-bank', () => {
  beforeEach(() => {
    resetLeksikonBank();
  });

  it('kasus 1: lookup by lemma', () => {
    expect(lookupLeksikon('Batang')?.lemma).toBe('Batang');
  });

  it('kasus 2: lookup by alias arah 1 (Eik Simawangon resolve ke Kali Lumut)', () => {
    expect(lookupLeksikon('Eik Simawangon')?.lemma).toBe('Kali Lumut');
  });

  it('kasus 3: lookup by alias arah 2 (Kali Lumut resolve ke entri yang sama)', () => {
    const a = lookupLeksikon('Kali Lumut');
    const b = lookupLeksikon('Eik Simawangon');
    expect(a).toBeDefined();
    expect(a).toEqual(b);
    expect(a?.alias).toEqual(['Eik Simawangon']);
  });

  it('kasus 4: query tak dikenal dan query kosong mengembalikan undefined', () => {
    expect(lookupLeksikon('tidak-ada')).toBeUndefined();
    expect(lookupLeksikon('   ')).toBeUndefined();
  });

  it('kasus 5: entri tanpa makna tetap sah', () => {
    const res = addEntry({ lemma: 'Aek Nauli', dictionaryRecorded: false, sources: [] });
    expect(res.ok).toBe(true);
    const hit = lookupLeksikon('aek nauli');
    expect(hit?.lemma).toBe('Aek Nauli');
    expect(hit?.makna).toBeUndefined();
  });

  it('kasus 6: tolak duplikat lemma tanpa alias (guard)', () => {
    const res = addEntry({ lemma: 'Batang', makna: 'lain', dictionaryRecorded: true, sources: [] });
    expect(res).toEqual({ ok: false, error: 'duplicate-lemma', lemma: 'Batang' });
    expect(lookupLeksikon('Batang')?.makna).not.toBe('lain');
  });

  it('kasus 7: tolak lemma yang bentrok dengan alias entri lain tanpa penghubung', () => {
    const res = addEntry({ lemma: 'Eik Simawangon', dictionaryRecorded: false, sources: [] });
    expect(res.ok).toBe(false);
    expect(lookupLeksikon('Eik Simawangon')?.lemma).toBe('Kali Lumut');
  });

  it('kasus 8: duplikat lewat alias diterima sebagai alias baru', () => {
    const res = addEntry({
      lemma: 'Kali Lumut',
      alias: ['Eik Simawangon', 'Aek Lumut'],
      dictionaryRecorded: false,
      sources: [],
    });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.merged).toBe(true);
    const hit = lookupLeksikon('Aek Lumut');
    expect(hit?.lemma).toBe('Kali Lumut');
    expect(hit?.alias).toEqual(['Eik Simawangon', 'Aek Lumut']);
  });

  it('kasus 9: struktur sources (karya, lokasi, kutipan) pada kedua entri awal', () => {
    const batang = lookupLeksikon('Batang');
    expect(batang?.sources).toHaveLength(2);
    expect(batang?.sources[0]).toEqual({
      karya: 'Tuuk, vol 2',
      lokasi: 'byte 445197, hlm sekitar 113',
      kutipan: "den stam van een' boom",
    });
    expect(batang?.sources[1].karya).toBe('Junghuhn 1847, vol 2');
    expect(batang?.sources[1].lokasi).toBe('byte 435544');
    expect(batang?.sources[1].kutipan).toContain('Hauptzufluss');
    const lumut = lookupLeksikon('Kali Lumut');
    expect(lumut?.sources[0].karya).toBe('notes 551');
    expect(lumut?.sources[0].lokasi).toBe('footnote Dolok-Eik, hlm 95-96');
  });

  it('kasus 10: dictionaryRecorded false terbaca pada kedua entri awal', () => {
    expect(lookupLeksikon('Batang')?.dictionaryRecorded).toBe(false);
    expect(lookupLeksikon('Kali Lumut')?.dictionaryRecorded).toBe(false);
  });

  it('kasus 11: normalisasi query trim, lowercase, dan spasi ganda', () => {
    expect(normalizeQuery('  Kali   LUMUT ')).toBe('kali lumut');
    expect(lookupLeksikon('  kali lumut  ')?.lemma).toBe('Kali Lumut');
    expect(lookupLeksikon('EIK SIMAWANGON')?.lemma).toBe('Kali Lumut');
  });

  it('kasus 12: hasil lookup berupa salinan, mutasi tidak mengubah bank', () => {
    const hit = lookupLeksikon('Batang');
    if (hit) hit.sources.length = 0;
    expect(lookupLeksikon('Batang')?.sources).toHaveLength(2);
  });

  it('kasus 13: lookup bengkila dan silih ketemu, makna terisi', () => {
    const bengkila = lookupLeksikon('bengkila');
    const silih = lookupLeksikon('silih');
    expect(bengkila?.lemma).toBe('bengkila');
    expect(bengkila?.makna).toContain('suami dari saudara bapak');
    expect(silih?.lemma).toBe('silih');
    expect(silih?.makna).toContain('saudara laki-laki dari istri');
  });

  it('kasus 14: lookup tidak peka huruf besar dan spasi tepi', () => {
    expect(lookupLeksikon('  BENGKILA ')?.lemma).toBe('bengkila');
    expect(lookupLeksikon('Silih')?.lemma).toBe('silih');
  });

  it('kasus 15: bengkila dan silih tidak memakai alias', () => {
    expect(lookupLeksikon('bengkila')?.alias).toBeUndefined();
    expect(lookupLeksikon('silih')?.alias).toBeUndefined();
  });

  it('kasus 16: dictionaryRecorded false pada kedua entri baru', () => {
    expect(lookupLeksikon('bengkila')?.dictionaryRecorded).toBe(false);
    expect(lookupLeksikon('silih')?.dictionaryRecorded).toBe(false);
  });

  it('kasus 17: sources minimal 2 per entri, bengkila memuat 3 sumber', () => {
    expect(lookupLeksikon('bengkila')?.sources.length).toBeGreaterThanOrEqual(2);
    expect(lookupLeksikon('bengkila')?.sources).toHaveLength(3);
    expect(lookupLeksikon('silih')?.sources.length).toBeGreaterThanOrEqual(2);
  });

  it('kasus 18: kutipan bengkila memuat substring kunci dari tiap sumber', () => {
    const sources = lookupLeksikon('bengkila')?.sources ?? [];
    expect(sources[0].karya).toContain('KamusLengkap');
    expect(sources[0].kutipan).toContain('suami dari saudara bapak');
    expect(sources[1].karya).toContain('Rambe 2025');
    expect(sources[1].kutipan).toContain("Bengkila (the husband of the father's sister)");
    expect(sources[2].karya).toContain('Noviani 2025');
    expect(sources[2].kutipan).toContain('uncle, aunt, bengkila');
  });

  it('kasus 19: kutipan silih memuat substring kunci dari tiap sumber', () => {
    const sources = lookupLeksikon('silih')?.sources ?? [];
    expect(sources[0].karya).toContain('KamusLengkap');
    expect(sources[0].kutipan).toContain('saudara laki-laki dari istri');
    expect(sources[1].karya).toContain('Ginting 2017');
    expect(sources[1].kutipan).toContain('saudara dari istri');
  });

  it('kasus 20: duplikat lemma bengkila dan silih ditolak duplicate-lemma', () => {
    const a = addEntry({ lemma: 'bengkila', dictionaryRecorded: false, sources: [] });
    const b = addEntry({ lemma: 'Silih', dictionaryRecorded: false, sources: [] });
    expect(a).toEqual({ ok: false, error: 'duplicate-lemma', lemma: 'bengkila' });
    expect(b).toEqual({ ok: false, error: 'duplicate-lemma', lemma: 'Silih' });
  });

  it('kasus 21: reset bank tetap memuat bengkila dan silih, entri tambahan hilang', () => {
    addEntry({ lemma: 'Aek Nauli', dictionaryRecorded: false, sources: [] });
    resetLeksikonBank();
    expect(lookupLeksikon('bengkila')).toBeDefined();
    expect(lookupLeksikon('silih')).toBeDefined();
    expect(lookupLeksikon('Aek Nauli')).toBeUndefined();
  });

  it('kasus 22: seed naik tepat 2 entri dan entri lama tidak berubah', () => {
    const bank = getLeksikonBank();
    expect(bank).toHaveLength(4);
    expect(bank.map((e) => e.lemma)).toEqual(['Batang', 'Kali Lumut', 'bengkila', 'silih']);
    expect(bank[0].sources).toHaveLength(2);
    expect(bank[1].alias).toEqual(['Eik Simawangon']);
  });
});
