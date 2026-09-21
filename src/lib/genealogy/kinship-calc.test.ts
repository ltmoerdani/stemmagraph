import { describe, expect, it } from 'vitest'
import {
  buildKinshipGraph,
  type ChildLink,
  type KinshipGraph,
} from './kinship'
import { makePartnerRelation } from './relationship'
import { canonicalRelationship, listRelationships } from './kinship-calc'

function link(childId: string, parentId: string): ChildLink {
  return { childId, parentId, type: 'BIRTH' }
}

/** Rantai empat generasi: buyut P1, kakek... eh: P1 tua P2, P2 tua P3, P3 tua P4. */
function chainGraph(): KinshipGraph {
  return buildKinshipGraph(
    ['P1', 'P2', 'P3', 'P4'],
    [],
    [link('P2', 'P1'), link('P3', 'P2'), link('P4', 'P3')],
  )
}

describe('canonicalRelationship', () => {
  it('self: person sama depth 0', () => {
    const g = chainGraph()
    expect(canonicalRelationship(g, 'P2', 'P2')).toEqual({
      kind: 'self',
      depth: 0,
    })
  })

  it('parent: toId adalah orang tua fromId', () => {
    const g = chainGraph()
    expect(canonicalRelationship(g, 'P2', 'P1')).toEqual({
      kind: 'parent',
      depth: 1,
    })
  })

  it('child: toId adalah anak fromId', () => {
    const g = chainGraph()
    expect(canonicalRelationship(g, 'P1', 'P2')).toEqual({
      kind: 'child',
      depth: 1,
    })
  })

  it('partner: dua arah, pasangan tanpa anak', () => {
    const g = buildKinshipGraph(
      ['A', 'B'],
      [makePartnerRelation('A', 'B')],
      [],
    )
    expect(canonicalRelationship(g, 'A', 'B')).toEqual({
      kind: 'partner',
      depth: 1,
    })
    expect(canonicalRelationship(g, 'B', 'A')).toEqual({
      kind: 'partner',
      depth: 1,
    })
  })

  it('sibling: berbagi satu orang tua', () => {
    const g = buildKinshipGraph(
      ['Ayah', 'S1', 'S2'],
      [],
      [link('S1', 'Ayah'), link('S2', 'Ayah')],
    )
    expect(canonicalRelationship(g, 'S1', 'S2')).toEqual({
      kind: 'sibling',
      depth: 1,
    })
  })

  it('grandparent: kakek dua generasi ke atas', () => {
    const g = chainGraph()
    expect(canonicalRelationship(g, 'P3', 'P1')).toEqual({
      kind: 'grandparent',
      depth: 2,
    })
  })

  it('grandchild: cucu dua generasi ke bawah', () => {
    const g = chainGraph()
    expect(canonicalRelationship(g, 'P1', 'P3')).toEqual({
      kind: 'grandchild',
      depth: 2,
    })
  })

  it('parent-sibling: om atau tante dari saudara ayah', () => {
    const g = buildKinshipGraph(
      ['Kakek', 'Ayah', 'Om', 'Anak'],
      [],
      [link('Ayah', 'Kakek'), link('Om', 'Kakek'), link('Anak', 'Ayah')],
    )
    expect(canonicalRelationship(g, 'Anak', 'Om')).toEqual({
      kind: 'parent-sibling',
      depth: 2,
    })
  })

  it('sibling-child: keponakan dari perspektif om', () => {
    const g = buildKinshipGraph(
      ['Kakek', 'Ayah', 'Om', 'Anak'],
      [],
      [link('Ayah', 'Kakek'), link('Om', 'Kakek'), link('Anak', 'Ayah')],
    )
    expect(canonicalRelationship(g, 'Om', 'Anak')).toEqual({
      kind: 'sibling-child',
      depth: 2,
    })
  })

  it('cousin: sepupu kedua anak dari sibling orang tua, depth 2', () => {
    const g = buildKinshipGraph(
      ['Kakek', 'A1', 'A2', 'C1', 'C2'],
      [],
      [
        link('A1', 'Kakek'),
        link('A2', 'Kakek'),
        link('C1', 'A1'),
        link('C2', 'A2'),
      ],
    )
    expect(canonicalRelationship(g, 'C1', 'C2')).toEqual({
      kind: 'cousin',
      depth: 2,
    })
  })

  it('ancestor depth 3: buyut tiga generasi ke atas', () => {
    const g = chainGraph()
    expect(canonicalRelationship(g, 'P4', 'P1')).toEqual({
      kind: 'ancestor',
      depth: 3,
    })
  })

  it('descendant depth 3: cicit tiga generasi ke bawah', () => {
    const g = chainGraph()
    expect(canonicalRelationship(g, 'P1', 'P4')).toEqual({
      kind: 'descendant',
      depth: 3,
    })
  })

  it('prioritas partner atas sibling saat satu person memenuhi dua kategori', () => {
    // P1 dan P2 partners, sekaligus sama-sama anak P3 (sah secara struktur).
    const g = buildKinshipGraph(
      ['P1', 'P2', 'P3'],
      [makePartnerRelation('P1', 'P2')],
      [link('P1', 'P3'), link('P2', 'P3')],
    )
    expect(canonicalRelationship(g, 'P1', 'P2')).toEqual({
      kind: 'partner',
      depth: 1,
    })
  })

  it('graph bersiklus tidak menggantung dan tetap unrelated ke person di luar komponen', () => {
    const g = buildKinshipGraph(
      ['X', 'Y', 'Z'],
      [],
      [link('Y', 'X'), link('X', 'Y')],
    )
    const result = canonicalRelationship(g, 'X', 'Z')
    expect(result).toEqual({ kind: 'unrelated' })
    expect('depth' in result).toBe(false)
  })

  it('unrelated: dua person tanpa sambungan apa pun', () => {
    const g = buildKinshipGraph(['A', 'B'], [], [])
    expect(canonicalRelationship(g, 'A', 'B')).toEqual({
      kind: 'unrelated',
    })
  })
})

describe('listRelationships', () => {
  it('mencakup partner, parent, grandparent, parent-sibling, dan cousin sekaligus', () => {
    const g = buildKinshipGraph(
      ['Kakek', 'Nenek', 'A1', 'A2', 'C1', 'C2'],
      [makePartnerRelation('Kakek', 'Nenek')],
      [
        link('A1', 'Kakek'),
        link('A2', 'Kakek'),
        link('C1', 'A1'),
        link('C2', 'A2'),
      ],
    )
    const list = listRelationships(g, 'C1')
    const byId = new Map(list.map((r) => [r.personId, r]))

    expect(byId.get('A1')).toEqual({ personId: 'A1', kind: 'parent', depth: 1 })
    expect(byId.get('C2')).toEqual({ personId: 'C2', kind: 'cousin', depth: 2 })
    expect(byId.get('A2')).toEqual({
      personId: 'A2',
      kind: 'parent-sibling',
      depth: 2,
    })
    expect(byId.get('Kakek')).toEqual({
      personId: 'Kakek',
      kind: 'grandparent',
      depth: 2,
    })
    // Nenek: pasangan kakek TANPA child link sendiri. Keputusan desain
    // v136-i: parentage murni eksplisit lewat childLinks, partner tidak
    // mewarisi peran orang tua, sehingga canonicalRelationship menghitung
    // dia unrelated meski BFS listRelationships tetap menjangkaunya.
    expect(byId.get('Nenek')).toEqual({
      personId: 'Nenek',
      kind: 'unrelated',
      depth: Number.MAX_SAFE_INTEGER,
    })
  })

  it('urutan deterministik: depth menaik lalu personId alfabetis', () => {
    const g = buildKinshipGraph(
      ['Ayah', 'Budi', 'Ade'],
      [],
      [link('Budi', 'Ayah'), link('Ade', 'Ayah')],
    )
    const list = listRelationships(g, 'Budi')
    expect(list).toEqual([
      { personId: 'Ade', kind: 'sibling', depth: 1 },
      { personId: 'Ayah', kind: 'parent', depth: 1 },
    ])
  })

  it('diri sendiri tidak termasuk hasil', () => {
    const g = buildKinshipGraph(['A'], [], [])
    expect(listRelationships(g, 'A')).toEqual([])
  })
})
