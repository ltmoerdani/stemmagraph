/**
 * Resolver alias leksikon: pencarian entri bank lewat nama alternatif.
 *
 * Pure function: tanpa react, zustand, prisma, atau server. Hanya
 * mengonsumsi tipe dan normalizeQuery dari leksikon-bank.
 *
 * Dua tingkat pencocokan, berhenti di tingkat pertama yang menghasilkan hit:
 * 1. Nama persis setelah normalisasi ejaan oe/u pra-1947 (Loemoet = Lumut).
 * 2. Nama setelah varian generic hidronim di awal dibuang (Aek, Batang, Air,
 *    Lau, Krueng, Way, Kali, Sungai) dan spasi diabaikan, dicocokkan dua arah
 *    (Aek Batanggadis = Batang Gadis).
 *
 * Bila lebih dari satu entri cocok pada tingkat yang sama, hasilnya objek
 * AMBIGUOUS berisi daftar kandidat, bukan pilihan senyap.
 */

import { normalizeQuery } from './leksikon-bank';
import type { LeksikonEntry } from './leksikon-bank';

export interface LeksikonAmbiguous {
  error: 'AMBIGUOUS';
  candidates: LeksikonEntry[];
}

export type ResolveAliasResult = LeksikonEntry | LeksikonAmbiguous | null;

/** Varian generic hidronim per daerah (notes 552: Batang/Lau/Air/Krueng/Way). */
const GENERIC_PREFIXES = ['aek', 'batang', 'air', 'lau', 'krueng', 'way', 'kali', 'sungai'];

/** Sisa nama minimal agar generic yang menempel (Batanggadis) boleh dibuang. */
const MIN_REMAINDER = 3;

/** Ejaan pra-1947: oe dibaca u, selain normalisasi dasar. */
function foldSpelling(name: string): string {
  return normalizeQuery(name).replace(/oe/g, 'u');
}

/** Huruf kecil saja: spasi, tanda baca, dan angka diabaikan. */
function compactKey(name: string): string {
  return foldSpelling(name).replace(/[^a-z]/g, '');
}

function stripGenericPrefixes(key: string): string {
  let current = key;
  for (;;) {
    let next = current;
    for (const prefix of GENERIC_PREFIXES) {
      if (!current.startsWith(prefix)) continue;
      const rest = current.slice(prefix.length);
      if (rest.length >= MIN_REMAINDER) {
        next = rest;
        break;
      }
    }
    if (next === current) return current;
    current = next;
  }
}

function namesOf(entry: LeksikonEntry): string[] {
  return [entry.lemma, ...(entry.alias ?? [])];
}

function pick(candidates: LeksikonEntry[]): ResolveAliasResult | undefined {
  if (candidates.length === 0) return undefined;
  if (candidates.length === 1) return candidates[0];
  return { error: 'AMBIGUOUS', candidates };
}

/**
 * Cari entri untuk query lewat lemma atau alias, toleran ejaan lama (oe/u)
 * dan varian generic hidronim. Mengembalikan entri tunggal, null bila tidak
 * dikenal, atau objek AMBIGUOUS bila lebih dari satu entri cocok.
 */
export function resolveLeksikonAlias(query: string, bank: readonly LeksikonEntry[]): ResolveAliasResult {
  if (normalizeQuery(query) === '') return null;
  if (compactKey(query) === '') return null;

  const exact = foldSpelling(query);
  const exactHit = pick(bank.filter((e) => namesOf(e).some((n) => foldSpelling(n) === exact)));
  if (exactHit !== undefined) return exactHit;

  const looseKeys = new Set([compactKey(query), stripGenericPrefixes(compactKey(query))]);
  const loose = bank.filter((e) =>
    namesOf(e).some((n) => {
      const key = compactKey(n);
      return looseKeys.has(key) || looseKeys.has(stripGenericPrefixes(key));
    }),
  );
  return pick(loose) ?? null;
}
