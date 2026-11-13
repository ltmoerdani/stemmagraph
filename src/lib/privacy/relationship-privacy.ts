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
 * v441 fase 1: batas jarak kekerabatan default untuk read path detail
 * member. Konstanta eksportable; konfigurasi per keluarga TIDAK dibangun
 * di fase ini.
 */
export const DEFAULT_RELATIONSHIP_DISTANCE_LIMIT = 2

/**
 * v441 fase 1: guard iterasi keras BFS bidirectional. Lewat guard
 * berarti dianggap tak terhubung.
 */
export const RELATIONSHIP_DISTANCE_MAX_STEPS = 12

/** Bentuk minimum baris relasi untuk graf jarak (subset prisma). */
export interface RelationshipDistanceEdge {
  memberId: string
  relatedId: string
  type: string
}

/**
 * Jarak kekerabatan minimum dua member pada graf keluarga dari daftar
 * relasi (semua tipe relasi sistem: parent, child, spouse, sibling,
 * dst; setiap baris dianggap busur tak berarah).
 *
 * BFS bidirectional: visited set terpisah per arah (forward dari A,
 * backward dari B), ekspansi bergantian, berhenti saat frontier bertemu.
 * Guard iterasi keras maks RELATIONSHIP_DISTANCE_MAX_STEPS langkah;
 * lewat guard berarti dianggap tak terhubung (null). Graf siklus aman
 * karena visited mencegah loop.
 *
 * Return: 0 = diri sendiri, 1 = parent/child/spouse langsung, dst.
 * null = tak terhubung, id nihil, atau melewati guard langkah.
 */
export function calculateRelationshipDistance(
  relationships: RelationshipDistanceEdge[],
  startId: string | null | undefined,
  targetId: string | null | undefined,
  maxSteps: number = RELATIONSHIP_DISTANCE_MAX_STEPS,
): number | null {
  if (!startId || !targetId) return null
  if (startId === targetId) return 0
  if (!relationships || relationships.length === 0) return null

  const limit = Math.min(maxSteps, RELATIONSHIP_DISTANCE_MAX_STEPS)

  // Adjacency tak berarah: parent/child/spouse/sibling semuanya busur.
  const adj = new Map<string, Set<string>>()
  for (const r of relationships) {
    if (!r.memberId || !r.relatedId) continue
    if (!adj.has(r.memberId)) adj.set(r.memberId, new Set())
    if (!adj.has(r.relatedId)) adj.set(r.relatedId, new Set())
    adj.get(r.memberId)!.add(r.relatedId)
    adj.get(r.relatedId)!.add(r.memberId)
  }

  if (!adj.has(startId) || !adj.has(targetId)) return null

  const forwardQueue: string[] = [startId]
  const backwardQueue: string[] = [targetId]

  // Visited terpisah per arah: jarak dari ujung masing-masing.
  const forwardVisited = new Map<string, number>()
  const backwardVisited = new Map<string, number>()

  forwardVisited.set(startId, 0)
  backwardVisited.set(targetId, 0)

  let steps = 0

  while (forwardQueue.length > 0 && backwardQueue.length > 0) {
    if (steps >= limit) return null
    steps++

    // Ekspansi forward satu level dari A.
    const forwardNext: string[] = []
    for (const curr of forwardQueue) {
      const d = forwardVisited.get(curr) as number
      const neighbors = adj.get(curr)
      if (!neighbors) continue
      for (const n of neighbors) {
        if (backwardVisited.has(n)) {
          const total = d + 1 + (backwardVisited.get(n) as number)
          return total <= limit ? total : null
        }
        if (!forwardVisited.has(n) && d + 1 <= limit) {
          forwardVisited.set(n, d + 1)
          forwardNext.push(n)
        }
      }
    }
    forwardQueue.length = 0
    forwardQueue.push(...forwardNext)

    if (forwardQueue.length === 0 && backwardQueue.length === 0) break

    // Ekspansi backward satu level dari B.
    const backwardNext: string[] = []
    for (const curr of backwardQueue) {
      const d = backwardVisited.get(curr) as number
      const neighbors = adj.get(curr)
      if (!neighbors) continue
      for (const n of neighbors) {
        if (forwardVisited.has(n)) {
          const total = d + 1 + (forwardVisited.get(n) as number)
          return total <= limit ? total : null
        }
        if (!backwardVisited.has(n) && d + 1 <= limit) {
          backwardVisited.set(n, d + 1)
          backwardNext.push(n)
        }
      }
    }
    backwardQueue.length = 0
    backwardQueue.push(...backwardNext)

    if (steps >= limit) return null
  }

  return null
}

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
