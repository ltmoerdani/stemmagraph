import { describe, expect, it } from 'vitest'
import {
  buildKinshipGraph,
  makePartnerRelation,
  type ChildLink,
} from './kinship'

function link(
  childId: string,
  parentId: string,
  type: ChildLink['type'] = 'BIRTH',
): ChildLink {
  return { childId, parentId, type }
}

describe('buildKinshipGraph', () => {
  it('kasus 1: anak dengan dua orang tua, satu BIRTH satu ADOPTED', () => {
    const g = buildKinshipGraph(
      ['anak', 'ayah', 'ibuAngkat'],
      [],
      [link('anak', 'ayah', 'BIRTH'), link('anak', 'ibuAngkat', 'ADOPTED')],
    )
    expect(g.parentsOf('anak').sort()).toEqual(['ayah', 'ibuAngkat'])
    expect(g.childrenOf('ayah')).toEqual(['anak'])
    expect(g.childrenOf('ibuAngkat')).toEqual(['anak'])
  })

  it('kasus 2: saudara via shared parent, anak lain ibu tetap saudara tiri', () => {
    const g = buildKinshipGraph(
      ['a1', 'a2', 'ibu', 'b1'],
      [],
      [
        link('a1', 'ibu'),
        link('a2', 'ibu'),
        link('b1', 'ibu', 'FOSTER'),
      ],
    )
    expect(g.siblingsOf('a1')).toEqual(['a2', 'b1'])
    expect(g.siblingsOf('a2')).toEqual(['a1', 'b1'])
  })

  it('kasus 3: satu person punya dua PARTNER (legal remarriage)', () => {
    const g = buildKinshipGraph(
      ['andi', 'beta', 'citra'],
      [makePartnerRelation('andi', 'beta'), makePartnerRelation('andi', 'citra')],
      [],
    )
    expect(g.partners.get('andi')).toEqual(['beta', 'citra'])
    expect(g.partners.get('beta')).toEqual(['andi'])
    expect(g.partners.get('citra')).toEqual(['andi'])
  })

  it('kasus 4: partner sama di-link dua kali tidak diduplikasi', () => {
    const g = buildKinshipGraph(
      ['x', 'y'],
      [makePartnerRelation('x', 'y'), makePartnerRelation('x', 'y')],
      [],
    )
    expect(g.partners.get('x')).toEqual(['y'])
    expect(g.partners.get('y')).toEqual(['x'])
  })

  it('kasus 5: child link duplikat tidak menduplikasi hasil', () => {
    const g = buildKinshipGraph(
      ['c', 'p'],
      [],
      [link('c', 'p'), link('c', 'p', 'BIRTH')],
    )
    expect(g.parentsOf('c')).toEqual(['p'])
    expect(g.childrenOf('p')).toEqual(['c'])
  })

  it('kasus 6: ancestor chain 3 level dengan maxDepth 2 terbatas', () => {
    const g = buildKinshipGraph(
      ['c', 'p', 'gp', 'ggp'],
      [],
      [link('c', 'p'), link('p', 'gp'), link('gp', 'ggp')],
    )
    expect(g.ancestorsOf('c', 2).sort()).toEqual(['gp', 'p'])
    expect(g.ancestorsOf('c', 3).sort()).toEqual(['ggp', 'gp', 'p'])
    expect(g.ancestorsOf('c', 1)).toEqual(['p'])
  })

  it('kasus 7: descendants 3 level dengan maxDepth bounded', () => {
    const g = buildKinshipGraph(
      ['root', 'a', 'b', 'x'],
      [],
      [link('a', 'root'), link('b', 'root'), link('x', 'a')],
    )
    expect(g.descendantsOf('root', 1).sort()).toEqual(['a', 'b'])
    expect(g.descendantsOf('root', 2).sort()).toEqual(['a', 'b', 'x'])
    expect(g.descendantsOf('a', 1)).toEqual(['x'])
  })

  it('kasus 8: ancestors dan descendants tidak melingkar tanpa batas', () => {
    // guard: siklus tak mungkin di data sah, tapi loop harus berhenti di maxDepth
    const g = buildKinshipGraph(['m', 'n'], [], [link('m', 'n')])
    expect(g.ancestorsOf('m', 99)).toEqual(['n'])
    expect(g.descendantsOf('n', 99)).toEqual(['m'])
  })

  it('kasus 9: person tanpa relasi apa pun menghasilkan array kosong', () => {
    const g = buildKinshipGraph(['solo'], [], [])
    expect(g.parentsOf('solo')).toEqual([])
    expect(g.childrenOf('solo')).toEqual([])
    expect(g.siblingsOf('solo')).toEqual([])
    expect(g.ancestorsOf('solo', 3)).toEqual([])
    expect(g.descendantsOf('solo', 3)).toEqual([])
    expect(g.partners.get('solo')).toBeUndefined()
  })

  it('kasus 10: query person yang tidak ada di set tetap array kosong', () => {
    const g = buildKinshipGraph(['a'], [], [])
    expect(g.parentsOf('hantu')).toEqual([])
    expect(g.siblingsOf('hantu')).toEqual([])
  })

  it('kasus 11: idempoten terhadap urutan input childLinks', () => {
    const persons = ['c', 'p1', 'p2']
    const l1 = [link('c', 'p1'), link('c', 'p2')]
    const l2 = [link('c', 'p2'), link('c', 'p1')]
    const g1 = buildKinshipGraph(persons, [], l1)
    const g2 = buildKinshipGraph(persons, [], l2)
    expect(g1.parentsOf('c').sort()).toEqual(g2.parentsOf('c').sort())
    expect(g1.siblingsOf('c')).toEqual(g2.siblingsOf('c'))
  })

  it('kasus 12: idempoten terhadap urutan input partnerLinks', () => {
    const g1 = buildKinshipGraph(
      ['a', 'b'],
      [makePartnerRelation('a', 'b')],
      [],
    )
    const g2 = buildKinshipGraph(
      ['a', 'b'],
      [makePartnerRelation('b', 'a')],
      [],
    )
    expect([...g1.partners.entries()].sort()).toEqual(
      [...g2.partners.entries()].sort(),
    )
  })

  it('kasus 13: self link dan link ke person di luar set diabaikan', () => {
    const g = buildKinshipGraph(
      ['a'],
      [],
      [link('a', 'a'), link('a', 'takada'), link('takada2', 'a')],
    )
    expect(g.parentsOf('a')).toEqual([])
    expect(g.childrenOf('a')).toEqual([])
  })

  it('kasus 14: re-export tipe dan helper dari modul merged tetap hidup', async () => {
    const mod = await import('./kinship')
    expect(mod.EVENT_TYPES).toContain('BIRT')
    expect(mod.makeEvent('MARR').type).toBe('MARR')
    expect(mod.makePartnerRelation('a', 'b').type).toBe('PARTNER')
  })
})
