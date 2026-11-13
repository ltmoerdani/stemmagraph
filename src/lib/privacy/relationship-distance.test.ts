import { describe, expect, it } from 'vitest'
import {
  calculateRelationshipDistance,
  DEFAULT_RELATIONSHIP_DISTANCE_LIMIT,
  RELATIONSHIP_DISTANCE_MAX_STEPS,
  type RelationshipDistanceEdge,
} from './relationship-privacy'

/**
 * v441 STG Relationship Privacy fase 1 (AC1 + AC5): jarak kekerabatan
 * minimum dua member pada graf keluarga, BFS bidirectional dengan
 * visited terpisah per arah dan guard 12 langkah.
 *
 * Arah baris relasi mengikuti viewer-relation.ts: type 'parent' =
 * memberId orang tua dari relatedId; 'child' = invers; 'spouse' dan
 * 'sibling' simetris. Graf dianggap tak berarah untuk jarak.
 */

function rel(memberId: string, relatedId: string, type: string): RelationshipDistanceEdge {
  return { memberId, relatedId, type }
}

/** Rantai linear nEdge busur, node n0..nEdge. */
function chain(nEdge: number): RelationshipDistanceEdge[] {
  const out: RelationshipDistanceEdge[] = []
  for (let i = 0; i < nEdge; i++) out.push(rel(`n${i}`, `n${i + 1}`, 'parent'))
  return out
}

describe('calculateRelationshipDistance (v441 fase 1)', () => {
  it('1. jarak 0: diri sendiri, bahkan tanpa relasi apa pun', () => {
    expect(calculateRelationshipDistance([], 'a', 'a')).toBe(0)
    const rels = [rel('a', 'b', 'spouse')]
    expect(calculateRelationshipDistance(rels, 'a', 'a')).toBe(0)
  })

  it('2. jarak 1: orang tua (type parent, arah memberId orang tua)', () => {
    const rels = [rel('ayah', 'anak', 'parent')]
    expect(calculateRelationshipDistance(rels, 'ayah', 'anak')).toBe(1)
    expect(calculateRelationshipDistance(rels, 'anak', 'ayah')).toBe(1)
  })

  it('3. jarak 1: anak (type child, invers parent)', () => {
    const rels = [rel('anak', 'ortu', 'child')]
    expect(calculateRelationshipDistance(rels, 'anak', 'ortu')).toBe(1)
    expect(calculateRelationshipDistance(rels, 'ortu', 'anak')).toBe(1)
  })

  it('4. jarak 1: pasangan (spouse simetris)', () => {
    const rels = [rel('suami', 'istri', 'spouse')]
    expect(calculateRelationshipDistance(rels, 'suami', 'istri')).toBe(1)
    expect(calculateRelationshipDistance(rels, 'istri', 'suami')).toBe(1)
  })

  it('5. jarak 2: kakek ke cucu lewat dua busur parent', () => {
    const rels = [rel('kakek', 'ortu', 'parent'), rel('ortu', 'cucu', 'parent')]
    expect(calculateRelationshipDistance(rels, 'kakek', 'cucu')).toBe(2)
    expect(calculateRelationshipDistance(rels, 'cucu', 'kakek')).toBe(2)
  })

  it('6. jarak 2: saudara lewat orang tua sama, dan sibling eksplisit jarak 1', () => {
    const viaParent = [rel('ortu', 'anak1', 'parent'), rel('ortu', 'anak2', 'parent')]
    expect(calculateRelationshipDistance(viaParent, 'anak1', 'anak2')).toBe(2)
    const explicitSibling = [rel('anak1', 'anak2', 'sibling')]
    expect(calculateRelationshipDistance(explicitSibling, 'anak1', 'anak2')).toBe(1)
  })

  it('7. di luar N: jarak 3 terhitung dan lebih besar dari DEFAULT_RELATIONSHIP_DISTANCE_LIMIT', () => {
    const rels = chain(3)
    const d = calculateRelationshipDistance(rels, 'n0', 'n3')
    expect(d).toBe(3)
    // Kategori di luar batas untuk wiring server: null atau > N.
    expect(d === null || d > DEFAULT_RELATIONSHIP_DISTANCE_LIMIT).toBe(true)
    expect(DEFAULT_RELATIONSHIP_DISTANCE_LIMIT).toBe(2)
  })

  it('8. graf siklus pernikahan sesama keturunan selesai tanpa hang', () => {
    // Siklus: A orang tua B, B pasangan C, C orang tua A.
    const cyclic: RelationshipDistanceEdge[] = [
      rel('A', 'B', 'parent'),
      rel('B', 'C', 'spouse'),
      rel('C', 'A', 'parent'),
    ]
    expect(calculateRelationshipDistance(cyclic, 'A', 'B')).toBe(1)
    expect(calculateRelationshipDistance(cyclic, 'A', 'C')).toBe(1)
    expect(calculateRelationshipDistance(cyclic, 'B', 'C')).toBe(1)
    // Rute lebih panjang di sekeliling siklus tidak dipilih (minimum).
    expect(calculateRelationshipDistance(cyclic, 'A', 'A')).toBe(0)
  })

  it('9. graf siklus besar dengan jarak dalam guard tetap benar', () => {
    // Dua jalur paralel dari X ke Y: pendek langsung, panjang memutar
    // lewat siklus tertutup; hasil harus jarak minimum.
    const ring: RelationshipDistanceEdge[] = []
    const size = 10
    for (let i = 0; i < size; i++) {
      ring.push(rel(`r${i}`, `r${(i + 1) % size}`, 'parent'))
    }
    expect(calculateRelationshipDistance(ring, 'r0', 'r1')).toBe(1)
    expect(calculateRelationshipDistance(ring, 'r0', 'r5')).toBe(5)
    expect(calculateRelationshipDistance(ring, 'r0', 'r9')).toBe(1)
  })

  it('10. non-connected component hasil tak terhubung (null)', () => {
    const rels = [rel('a', 'b', 'spouse'), rel('x', 'y', 'parent')]
    expect(calculateRelationshipDistance(rels, 'a', 'x')).toBeNull()
    expect(calculateRelationshipDistance(rels, 'b', 'y')).toBeNull()
  })

  it('11. id nihil atau tidak ada di graf hasil null', () => {
    const rels = [rel('a', 'b', 'spouse')]
    expect(calculateRelationshipDistance(rels, null, 'b')).toBeNull()
    expect(calculateRelationshipDistance(rels, 'a', undefined)).toBeNull()
    expect(calculateRelationshipDistance(rels, 'a', 'asing')).toBeNull()
    expect(calculateRelationshipDistance(rels, 'asing', 'b')).toBeNull()
    expect(calculateRelationshipDistance([], 'a', 'b')).toBeNull()
  })

  it('12. guard 12 langkah: rantai 13 busur dianggap tak terhubung', () => {
    expect(RELATIONSHIP_DISTANCE_MAX_STEPS).toBe(12)
    // Rantai 12 busur = jarak 12, masih tepat di guard.
    expect(calculateRelationshipDistance(chain(12), 'n0', 'n12')).toBe(12)
    // Rantai 13 busur = jarak 13, lewat guard: tak terhubung.
    expect(calculateRelationshipDistance(chain(13), 'n0', 'n13')).toBeNull()
    // Rantai jauh lebih panjang juga null dan selesai cepat.
    expect(calculateRelationshipDistance(chain(50), 'n0', 'n50')).toBeNull()
  })

  it('13. guard juga berlaku saat maxSteps argumen lebih kecil', () => {
    expect(calculateRelationshipDistance(chain(5), 'n0', 'n5', 3)).toBeNull()
    expect(calculateRelationshipDistance(chain(3), 'n0', 'n3', 3)).toBe(3)
  })

  it('14. duplikasi relasi dan self-loop busur tidak merusak hasil', () => {
    const rels = [
      rel('a', 'b', 'spouse'),
      rel('a', 'b', 'spouse'),
      rel('a', 'a', 'parent'),
      rel('b', 'c', 'parent'),
    ]
    expect(calculateRelationshipDistance(rels, 'a', 'c')).toBe(2)
  })
})
