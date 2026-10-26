/**
 * Relationship-based privacy fase 1 (v412): filter daftar relasi
 * structural berdasarkan keputusan visibility per anggota.
 *
 * Modul PURE: tanpa import, tanpa I/O, tanpa clock, tanpa dependency.
 * Urutan hasil mengikuti urutan input sehingga dua panggilan dengan
 * input sama menghasilkan output sama (deterministik).
 *
 * Sumber keputusan berasal dari applyMemberVisibility (v261-i): null
 * berarti hidden, objek name-only berarti name-only, objek input yang
 * kembali utuh berarti full. Peta yang diterima modul ini memuat
 * keputusan akhir normalisasi ke kamus full, name-only, hidden.
 *
 * Aturan inti fase 1: relasi dihilangkan bila SALAH SATU ujungnya
 * hidden bagi viewer tersebut. Ujung name-only tetap lolos karena
 * identitas anggota masih boleh diketahui; yang dilindungi adalah
 * keberadaan anggota hidden, keberadaan busur relasinya ikut
 * tersembunyi.
 *
 * Keputusan fail closed: ujung relasi yang tidak tercantum di peta
 * (anggota hilang dari sumber, data orphan, nilai di luar kamus)
 * diperlakukan hidden. Konsisten safe default modul v260-i dan
 * v261-i: yang meragukan dilindungi.
 *
 * Arah produk: VISION-stemmagraph 0.8, consent dan privasi living
 * persons, pilar 6 privasi kelas satu, prinsip 4 default privat.
 */

/** Kamus keputusan visibility per anggota, satu-satu dengan v260-i. */
export type MemberVisibilityDecision = 'full' | 'name-only' | 'hidden';

/** Bentuk minimum relasi yang dibutuhkan filter (dua ujung saja). */
export interface StructuralRelationship {
  memberId: string;
  relatedId: string;
}

export interface FilterRelationshipsInput<R extends StructuralRelationship> {
  /** Peta memberId ke keputusan visibility bagi viewer yang dilayani. */
  visibilityByMemberId: Record<string, MemberVisibilityDecision>;
  /** Daftar relasi structural pohon, urutan bebas dan dipertahankan. */
  relationships: R[];
}

/**
 * Saring relasi: sisakan hanya relasi yang kedua ujungnya terlihat
 * bagi viewer. Hidden pada salah satu ujung membuang relasi; ujung
 * absen dari peta membuang juga (fail closed). Output mempertahankan
 * urutan dan referensi elemen input, tanpa duplikasi dan tanpa
 * perubahan bentuk.
 */
export function filterRelationshipsForViewer<
  R extends StructuralRelationship,
>(input: FilterRelationshipsInput<R>): R[] {
  const kept: R[] = [];
  for (const rel of input.relationships) {
    const start = input.visibilityByMemberId[rel.memberId];
    const end = input.visibilityByMemberId[rel.relatedId];
    if (start !== 'full' && start !== 'name-only') continue;
    if (end !== 'full' && end !== 'name-only') continue;
    kept.push(rel);
  }
  return kept;
}
