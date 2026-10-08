import { describe, expect, it } from 'vitest'
import { buildKinshipGraph, type KinshipGraph } from './kinship'
import type { PartnerRelation } from './relationship'
import { resolveKinshipPath } from './kinship-path'

function pr(a: string, b: string): PartnerRelation {
  return { partners: [a, b], type: 'PARTNER' }
}

interface ChildLinkInput {
  childId: string
  parentId: string
  type?: string
}

/**
 * Graph kecil: saya beristri, punya ortu bapak-ibu, bapak-ibu punya
 * anak lain adik. Bapak punya ortu kakek. Bapak beristri kedua
 * istri_bapak (mertua dari istri saya via jalur saya-istri-bapak).
 */
function graphKecil(): KinshipGraph {
  return buildKinshipGraph(
    ['saya', 'istri', 'bapak', 'ibu', 'adik', 'kakek', 'istri_bapak'],
    [
      pr('saya', 'istri'),
      pr('bapak', 'ibu'),
      pr('bapak', 'istri_bapak'),
    ],
    [
      { childId: 'saya', parentId: 'bapak' },
      { childId: 'saya', parentId: 'ibu' },
      { childId: 'adik', parentId: 'bapak' },
      { childId: 'adik', parentId: 'ibu' },
      { childId: 'bapak', parentId: 'kakek' },
    ] as ChildLinkInput[],
  )
}

/**
 * Graph sepupu: ortu dan om adalah siblings (berortu kakek); saya anak
 * ortu, anak_om anak om. Jalur saya ke anak_om: naik ortu, sibling om,
 * turun anak_om (4 hop naik-turun kolateral).
 */
function graphSepupu(): KinshipGraph {
  return buildKinshipGraph(
    ['saya', 'ortu', 'om', 'anak_om', 'kakek_sepupu'],
    [pr('ortu', 'tante')],
    [
      { childId: 'saya', parentId: 'ortu' },
      { childId: 'ortu', parentId: 'kakek_sepupu' },
      { childId: 'om', parentId: 'kakek_sepupu' },
      { childId: 'anak_om', parentId: 'om' },
    ] as ChildLinkInput[],
  )
}

function graphDuaPohon(): KinshipGraph {
  return buildKinshipGraph(
    ['a1', 'a2', 'b1', 'b2'],
    [],
    [
      { childId: 'a2', parentId: 'a1' },
      { childId: 'b2', parentId: 'b1' },
    ] as ChildLinkInput[],
  )
}

describe('resolveKinshipPath', () => {
  it('kasus 1: self identitas, hops self, langsung', () => {
    const r = resolveKinshipPath(graphKecil(), 'saya', 'saya')
    expect(r.found).toBe(true)
    expect(r.hops).toEqual([{ personId: 'saya', kind: 'self' }])
    expect(r.linearity).toBe('langsung')
  })

  it('kasus 2: parent langsung satu hop naik', () => {
    const r = resolveKinshipPath(graphKecil(), 'saya', 'bapak')
    expect(r.found).toBe(true)
    expect(r.hops).toEqual([{ personId: 'bapak', kind: 'parent' }])
    expect(r.linearity).toBe('naik')
  })

  it('kasus 3: child langsung satu hop turun (adik)', () => {
    // graphKecil tidak punya anak utk saya, pakai jalur bapak ke adik
    // via turun langsung.
    const r = resolveKinshipPath(graphKecil(), 'bapak', 'adik')
    expect(r.found).toBe(true)
    expect(r.hops).toEqual([{ personId: 'adik', kind: 'child' }])
    expect(r.linearity).toBe('turun')
  })

  it('kasus 4: partner langsung afinal', () => {
    const r = resolveKinshipPath(graphKecil(), 'saya', 'istri')
    expect(r.found).toBe(true)
    expect(r.hops).toEqual([{ personId: 'istri', kind: 'partner' }])
    expect(r.linearity).toBe('afinal')
  })

  it('kasus 5: sibling satu hop eksplisit, langsung', () => {
    const r = resolveKinshipPath(graphKecil(), 'saya', 'adik')
    expect(r.found).toBe(true)
    expect(r.hops).toEqual([{ personId: 'adik', kind: 'sibling' }])
    expect(r.linearity).toBe('langsung')
  })

  it('kasus 6: grandparent dua hop naik', () => {
    const r = resolveKinshipPath(graphKecil(), 'saya', 'kakek')
    expect(r.found).toBe(true)
    expect(r.hops).toEqual([
      { personId: 'bapak', kind: 'parent' },
      { personId: 'kakek', kind: 'parent' },
    ])
    expect(r.linearity).toBe('naik')
  })

  it('kasus 7: jalur afinal panjang istri ke istri_bapak, afinal', () => {
    // Jalur: istri -> saya (partner) -> bapak (parent) -> istri_bapak
    // (partner). Memuat hop partner sehingga afinal.
    const r = resolveKinshipPath(graphKecil(), 'istri', 'istri_bapak')
    expect(r.found).toBe(true)
    expect(r.hops).toEqual([
      { personId: 'saya', kind: 'partner' },
      { personId: 'bapak', kind: 'parent' },
      { personId: 'istri_bapak', kind: 'partner' },
    ])
    expect(r.linearity).toBe('afinal')
  })

  it('kasus 8: sepupu jalur terpendek 3 hop kolateral, langsung', () => {
    const r = resolveKinshipPath(graphSepupu(), 'saya', 'anak_om')
    expect(r.found).toBe(true)
    expect(r.hops).toHaveLength(3)
    expect(r.hops[0]).toEqual({ personId: 'ortu', kind: 'parent' })
    expect(r.hops[1]).toEqual({ personId: 'om', kind: 'sibling' })
    expect(r.hops[2]).toEqual({ personId: 'anak_om', kind: 'child' })
    expect(r.linearity).toBe('langsung')
  })

  it('kasus 9: dua pohon terpisah tidak terjangkau', () => {
    const r = resolveKinshipPath(graphDuaPohon(), 'a2', 'b2')
    expect(r.found).toBe(false)
    expect(r.hops).toEqual([])
    expect(r.linearity).toBe('langsung')
  })

  it('kasus 10: personId tidak ada di graph, found false', () => {
    const r = resolveKinshipPath(graphKecil(), 'saya', 'hantu')
    expect(r.found).toBe(false)
    expect(r.hops).toEqual([])
  })

  it('kasus 11: determinisme tie-break, dua panggilan stabil', () => {
    const g = graphSepupu()
    const r1 = resolveKinshipPath(g, 'saya', 'anak_om')
    const r2 = resolveKinshipPath(g, 'saya', 'anak_om')
    expect(r1).toEqual(r2)
    // tie-break: jalur via sibling ortu-om dipilih urut ID stabil
    expect(r1.hops.map((h) => h.personId)).toEqual([
      'ortu',
      'om',
      'anak_om',
    ])
  })

  it('kasus 12: siklus palsu ortu-anak melingkar, depth guard', () => {
    const g = buildKinshipGraph(
      ['x', 'y'],
      [],
      [
        { childId: 'y', parentId: 'x' },
        { childId: 'x', parentId: 'y' },
      ] as ChildLinkInput[],
    )
    // x dan y saling ortu-anak: path x ke y tetap ketemu 1 hop, dan
    // panggilan selesai tanpa infinite loop (depth guard).
    const r = resolveKinshipPath(g, 'x', 'y')
    expect(r.found).toBe(true)
    expect(r.hops).toEqual([{ personId: 'y', kind: 'child' }])
  })

  it('kasus 13: jalur partner di tengah rantai naik tetap afinal', () => {
    // Saya ke istri_bapak: saya -> istri? tidak ada jalur; jalur saya
    // -> bapak (parent) -> istri_bapak (partner) memuat partner.
    const r = resolveKinshipPath(graphKecil(), 'saya', 'istri_bapak')
    expect(r.found).toBe(true)
    expect(r.hops).toEqual([
      { personId: 'bapak', kind: 'parent' },
      { personId: 'istri_bapak', kind: 'partner' },
    ])
    expect(r.linearity).toBe('afinal')
  })

  it('kasus 14: asal tidak ada di graph, found false tanpa lempar', () => {
    const r = resolveKinshipPath(graphKecil(), 'tak_ada', 'saya')
    expect(r.found).toBe(false)
    expect(r.hops).toEqual([])
  })
})
