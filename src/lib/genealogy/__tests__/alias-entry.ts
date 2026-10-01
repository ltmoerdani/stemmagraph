// Helper test untuk entri alias kekerabatan (preventif v199-ii).
//
// Latar belakang: field AliasEntry.note/depth/region bersifat opsional,
// dan pola berulang penyebab CI merah adalah testfile baru yang memanggil
// method string (includes, dsb.) langsung pada field opsional tanpa
// narrowing (error TS18048 'possibly undefined'). Helper ini memusatkan
// narrowing di satu tempat sehingga testfile baru tidak bisa mengulang
// pola tersebut.
//
// Pemakaian:
//   import { regionalEntry, regionalNote } from './__tests__/alias-entry';
//   expect(regionalNote('Karo', 'eda')).toContain('KBBI VI');

import { expect } from 'vitest';
import { KINSHIP_ALIASES_REGIONAL, type AliasEntry } from '../kinship-aliases';

type RegionalMap = Record<string, Record<string, AliasEntry>>;

/** Ambil entri regional asserted-defined; gagal test bila lema nihil. */
export function regionalEntry(region: string, key: string): AliasEntry {
  const map = (KINSHIP_ALIASES_REGIONAL as unknown as RegionalMap)[region];
  const entry = map?.[key];
  expect(entry, `entri alias regional ${region}.${key} tidak ditemukan`).toBeDefined();
  return entry as AliasEntry;
}

/** Ambil note entri regional asserted-defined sebagai string. */
export function regionalNote(region: string, key: string): string {
  const entry = regionalEntry(region, key);
  expect(
    entry.note,
    `note entri alias regional ${region}.${key} kosong/undefined`,
  ).toBeDefined();
  return entry.note as string;
}

/** Assert note entri regional memuat semua substring yang diberikan. */
export function expectNoteContains(
  region: string,
  key: string,
  substrings: readonly string[],
): void {
  const note = regionalNote(region, key);
  for (const fragment of substrings) {
    expect(note).toContain(fragment);
  }
}
