/**
 * Relationship-based privacy fase i: resolusi visibilitas anggota
 * berdasarkan relasi viewer terhadap anggota, dipadukan dengan
 * privacyStatus consent yang sudah ada.
 *
 * Modul PURE: tanpa import eksternal, tanpa efek samping, mudah dites.
 * Fase i TANPA wiring: konsumen read path API/UI adalah goal serial
 * berikutnya.
 *
 * Arah produk: VISION-stemmagraph gap 3, relationship-based privacy.
 * VISION mencatat pola ini belum dimiliki bahkan Gramps Web sehingga
 * menjadi peluang memimpin kategori. Fondasi yang dipakai: kolom
 * FamilyMember.privacyStatus ('shared'/'private'), export gate
 * privacy fase 1 (exportPrivacyGate.ts), dan safe default
 * anggap-hidup (living-privacy.ts).
 *
 * Keputusan desain fase i:
 * - Kerabat inti = partner, child, parent. Mereka boleh melihat nama
 *   anggota hidup yang belum memberi consent, detail tetap ter-redaksi.
 * - sibling TIDAK termasuk kerabat inti fase i: generasi sama dengan
 *   jangkauan kerabat yang lebih luas, risiko bocor lebih tinggi.
 *   Longgarkan lewat goal lanjutan, jangan longgarkan di sini.
 * - privacyStatus NULL atau nilai tak dikenal pada anggota hidup
 *   diperlakukan 'private'. Safe default konsisten living-privacy.ts
 *   dan exportPrivacyGate.ts.
 */

export type ViewerRelation = 'self' | 'partner' | 'child' | 'parent' | 'sibling' | 'other'

export interface RelationshipPrivacyInput {
  /** Relasi viewer terhadap anggota yang dilihat. */
  viewerRelation: ViewerRelation
  /** Status consent anggota. null/undefined berarti belum tercatat. */
  privacyStatus?: 'shared' | 'private' | null
  /** Anggota hidup atau meninggal. */
  isAlive: boolean
}

export type RelationshipVisibility = 'full' | 'name-only' | 'hidden'

/**
 * Aturan resolusi, dievaluasi berurutan, aturan lebih awal menang:
 *
 * 1. viewerRelation 'self' SELALU 'full'. Pemilik data melihat
 *    datanya sendiri tanpa syarat.
 * 2. isAlive false SELALU 'full'. Anggota meninggal tidak terdampak;
 *    konsisten exportPrivacyGate yang hanya meredact living.
 * 3. privacyStatus 'shared' SELALU 'full'. Consent eksplisit menang
 *    atas aturan relasi apa pun.
 * 4. Anggota hidup sisanya (private atau belum tercatat):
 *    - partner, child, parent: 'name-only'. Kerabat inti boleh tahu
 *      identitas, detail tetap ter-redaksi sampai consent.
 *    - sibling, other: 'hidden'. Set non-inti lebih luas, aman dulu.
 * 5. privacyStatus null/undefined pada living diperlakukan 'private'
 *    (sudah tercakup aturan 4).
 * 6. Nilai privacyStatus tak dikenal diperlakukan 'private'.
 */
export function resolveRelationshipVisibility(
  input: RelationshipPrivacyInput,
): RelationshipVisibility {
  if (input.viewerRelation === 'self') return 'full'
  if (!input.isAlive) return 'full'
  if (input.privacyStatus === 'shared') return 'full'

  // Living sisanya: private, null, undefined, atau nilai tak dikenal
  // semuanya jatuh ke jalur konservatif yang sama.
  if (
    input.viewerRelation === 'partner' ||
    input.viewerRelation === 'child' ||
    input.viewerRelation === 'parent'
  ) {
    return 'name-only'
  }

  return 'hidden'
}
