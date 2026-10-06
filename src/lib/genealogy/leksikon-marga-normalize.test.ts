import { describe, expect, it } from 'vitest';

import {
  isSameMarga,
  normalizeMarga,
  suggestMargaValues,
  type LeksikonEntry,
} from './leksikon-bank';

function entryWithMarga(lemma: string, margaNote?: string): LeksikonEntry {
  return { lemma, dictionaryRecorded: false, sources: [], margaNote };
}

describe('leksikon-marga-normalize', () => {
  it('kasus 1: normalizeMarga membuang spasi di kedua ujung', () => {
    expect(normalizeMarga('  Ginting\t')).toBe('Ginting');
    expect(normalizeMarga('Karo Karo')).toBe('Karo Karo');
  });

  it('kasus 2: normalizeMarga melipat spasi ganda menjadi satu tanpa mengubah case', () => {
    expect(normalizeMarga('perangin   angin')).toBe('perangin angin');
    expect(normalizeMarga('Perangin-ANGIN')).toBe('Perangin-ANGIN');
  });

  it('kasus 3: isSameMarga case-insensitive menganggap Perangin-angin sama dengan perangin-angin', () => {
    expect(isSameMarga('Perangin-angin', 'perangin-angin')).toBe(true);
  });

  it('kasus 4: isSameMarga menganggap spasi ganda setara bentuk ber-hyfen', () => {
    expect(isSameMarga('Perangin-angin', 'perangin  angin')).toBe(true);
  });

  it('kasus 5: isSameMarga false bila salah satu undefined', () => {
    expect(isSameMarga(undefined, 'Ginting')).toBe(false);
    expect(isSameMarga('Ginting', undefined)).toBe(false);
    expect(isSameMarga(undefined, undefined)).toBe(false);
  });

  it('kasus 6: isSameMarga false bila salah satu kosong atau hanya whitespace', () => {
    expect(isSameMarga('', 'Ginting')).toBe(false);
    expect(isSameMarga('   ', 'Ginting')).toBe(false);
    expect(isSameMarga('Ginting', '')).toBe(false);
  });

  it('kasus 7: isSameMarga false untuk marga yang berbeda', () => {
    expect(isSameMarga('Siregar', 'Ginting')).toBe(false);
    expect(isSameMarga('Karo Karo', 'Karokaro')).toBe(false);
  });

  it('kasus 8: marga input yang isSameMarga dengan salah satu saran terdeteksi', () => {
    const entries: LeksikonEntry[] = [
      entryWithMarga('duman', 'Perangin-angin'),
      entryWithMarga('kalimbubu', 'Ginting'),
    ];
    const saran = suggestMargaValues(entries);
    const inputRancu = '  perangin   angin ';
    expect(saran.some((s) => isSameMarga(inputRancu, s))).toBe(true);
    expect(saran.some((s) => isSameMarga('siregar', s))).toBe(false);
  });
});
