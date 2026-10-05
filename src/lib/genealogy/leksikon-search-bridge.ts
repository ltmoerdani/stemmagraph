/**
 * Jembatan leksikon ke pencarian anggota (v245i).
 *
 * Pure function: tanpa react, zustand, prisma, atau server. Menggabungkan
 * resolver alias leksikon (leksikon-alias) dengan mesin pencarian
 * (search-filter) tanpa mengubah keduanya.
 *
 * Ekspansi query: [query asli, lemma, ...alias] bila resolver menemukan satu
 * entri. Hasil AMBIGUOUS atau null hanya mengembalikan [query asli], karena
 * memilih salah satu kandidat secara senyap akan menyesatkan pencarian.
 */

import { getLeksikonBank, normalizeQuery } from './leksikon-bank';
import { resolveLeksikonAlias } from './leksikon-alias';
import { searchWithAliases } from './search-filter';
import type { SearchFilterOptions, SearchMember } from './search-filter';

/**
 * Ekspansi query lewat bank leksikon. Query asli selalu di indeks 0,
 * duplikat dibuang tanpa membedakan huruf besar kecil, urutan deterministik.
 * Query kosong atau hanya spasi menghasilkan array kosong.
 */
export function expandQueryWithLeksikon(query: string): string[] {
  const originalKey = normalizeQuery(query);
  if (originalKey === '') return [];

  const terms: string[] = [query];
  const seen = new Set<string>([originalKey]);

  const resolved = resolveLeksikonAlias(query, getLeksikonBank());
  if (resolved === null || 'error' in resolved) return terms;

  for (const name of [resolved.lemma, ...(resolved.alias ?? [])]) {
    const key = normalizeQuery(name);
    if (key === '' || seen.has(key)) continue;
    seen.add(key);
    terms.push(name);
  }
  return terms;
}

/**
 * Cari anggota dengan semua bentuk hasil ekspansi leksikon. Tiap bentuk
 * dijalankan lewat searchWithAliases, hasil digabung dengan dedup by
 * member.id pada urutan pertama dilihat.
 *
 * Bila ekspansi kosong (query kosong), perilaku mengikuti searchWithAliases
 * apa adanya agar filter terstruktur tetap berlaku.
 *
 * Pure: input tidak dimutasi, output array baru.
 */
export function searchMembersWithLeksikon(
  members: SearchMember[],
  query: string,
  options: SearchFilterOptions = {},
): SearchMember[] {
  const terms = expandQueryWithLeksikon(query);
  if (terms.length === 0) {
    return searchWithAliases(members, query, options);
  }

  const seen = new Set<string>();
  const result: SearchMember[] = [];
  for (const term of terms) {
    for (const member of searchWithAliases(members, term, options)) {
      if (seen.has(member.id)) continue;
      seen.add(member.id);
      result.push(member);
    }
  }
  return result;
}
