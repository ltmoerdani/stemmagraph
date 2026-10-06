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
});
