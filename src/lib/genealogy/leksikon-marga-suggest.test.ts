import { beforeEach, describe, expect, it } from 'vitest';

import {
  addEntry,
  resetLeksikonBank,
  suggestMargaValues,
  type LeksikonEntry,
} from './leksikon-bank';

function entryWithMarga(lemma: string, margaNote?: string): LeksikonEntry {
  return { lemma, dictionaryRecorded: false, sources: [], margaNote };
}

describe('leksikon-marga-suggest', () => {
  beforeEach(() => {
    resetLeksikonBank();
  });

  it('kasus 1: mengembalikan margaNote unik terurut alfabetis', () => {
    addEntry(entryWithMarga('duman', 'Situmorang'));
    addEntry(entryWithMarga('kalimbubu', 'Ginting'));
    addEntry(entryWithMarga('beru', 'Sembiring'));
    expect(suggestMargaValues()).toEqual([
      'Ginting',
      'Perangin-angin',
      'Sembiring',
      'Situmorang',
    ]);
  });

  it('kasus 2: dedup case-insensitive, bentuk kanonik entri pertama menang', () => {
    addEntry(entryWithMarga('nenek ipar', 'perangin-angin'));
    addEntry(entryWithMarga('kale', 'PERANGIN-ANGIN'));
    expect(suggestMargaValues()).toEqual(['Perangin-angin']);
  });

  it('kasus 3: nilai kosong dan whitespace dibuang', () => {
    addEntry(entryWithMarga('tanpa-note'));
    addEntry(entryWithMarga('note-kosong', ''));
    addEntry(entryWithMarga('note-spasi', '   '));
    addEntry(entryWithMarga('note-valid', 'Karokaro'));
    expect(suggestMargaValues()).toEqual(['Karokaro', 'Perangin-angin']);
  });

  it('kasus 4: bank nihil margaNote mengembalikan array kosong', () => {
    expect(suggestMargaValues([])).toEqual([]);
    expect(
      suggestMargaValues([
        entryWithMarga('polos'),
        entryWithMarga('polos-dua', '   '),
      ]),
    ).toEqual([]);
  });

  it('kasus 5: deterministik pasca addEntry dan resetLeksikonBank', () => {
    addEntry(entryWithMarga('senina', 'Siregar'));
    const withAdd = suggestMargaValues();
    expect(withAdd).toEqual(['Perangin-angin', 'Siregar']);
    expect(suggestMargaValues()).toEqual(withAdd);
    resetLeksikonBank();
    expect(suggestMargaValues()).toEqual(['Perangin-angin']);
  });

  it('kasus 6: varian spasi dan hyfen melipat via isSameMarga, bentuk pertama menang', () => {
    addEntry(entryWithMarga('kale', 'Perangin-angin'));
    addEntry(entryWithMarga('duman', 'perangin  angin'));
    addEntry(entryWithMarga('beru', 'PERANGIN ANGIN'));
    addEntry(entryWithMarga('sibayak', 'Perangin-Angin'));
    expect(suggestMargaValues()).toEqual(['Perangin-angin']);
  });

  it('kasus 7: dedup sebelum sort, bentuk kanonik dipakai dalam localeCompare', () => {
    addEntry(entryWithMarga('raja', 'ginting'));
    addEntry(entryWithMarga('pandega', 'GINTING'));
    addEntry(entryWithMarga('kerina', 'Siregar'));
    expect(suggestMargaValues()).toEqual([
      'ginting',
      'Perangin-angin',
      'Siregar',
    ]);
  });

  it('kasus 8: dedup longgar bekerja pada parameter entries langsung', () => {
    const entries: LeksikonEntry[] = [
      entryWithMarga('x', 'Karo Karo'),
      entryWithMarga('y', 'karo karo'),
      entryWithMarga('z', 'Karo-Karo'),
    ];
    expect(suggestMargaValues(entries)).toEqual(['Karo Karo']);
  });
});
