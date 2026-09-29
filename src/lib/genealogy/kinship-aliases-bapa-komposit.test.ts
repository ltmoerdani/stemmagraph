import { describe, expect, it } from 'vitest'
import { KINSHIP_ALIASES, KINSHIP_ALIASES_REGIONAL, aliasKinds, resolveAlias } from './kinship-aliases'

describe('kinship-aliases bapa komposit Karo (v191-ii salvase PM)', () => {
  it('resolveAlias bapa tua region Karo: kind parent depth 1 region Karo', () => {
    const r = resolveAlias('bapa tua', 'Karo')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('parent')
    expect(r?.depth).toBe(1)
    expect(r?.region).toBe('Karo')
  })

  it('resolveAlias bapa nguda region Karo: kind parent depth 1', () => {
    const r = resolveAlias('bapa nguda', 'Karo')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('parent')
    expect(r?.depth).toBe(1)
  })

  it('resolveAlias pak tua region Karo: kind parent depth 1', () => {
    const r = resolveAlias('pak tua', 'Karo')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('parent')
    expect(r?.depth).toBe(1)
  })

  it('resolveAlias pak uda region Karo: kind parent depth 1', () => {
    const r = resolveAlias('pak uda', 'Karo')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('parent')
    expect(r?.depth).toBe(1)
  })

  it('resolveAlias bapa tua tanpa region null: komposit belum dinaikkan ke map utama', () => {
    expect(resolveAlias('bapa tua')).toBeNull()
  })

  it('resolveAlias bapa nguda tanpa region null', () => {
    expect(resolveAlias('bapa nguda')).toBeNull()
  })

  it('resolveAlias pak tua tanpa region null', () => {
    expect(resolveAlias('pak tua')).toBeNull()
  })

  it('resolveAlias pak uda tanpa region null', () => {
    expect(resolveAlias('pak uda')).toBeNull()
  })

  it('resolveAlias bapa tanpa region tetap entri utama map utama, bukan komposit', () => {
    const r = resolveAlias('bapa')
    expect(r).not.toBeNull()
    expect(r).toEqual(KINSHIP_ALIASES.bapa)
    expect(r?.kind).toBe('parent')
    expect(r?.depth).toBe(1)
  })

  it('komposit dengan region selain Karo nihil: bapa tua Sunda null', () => {
    expect(resolveAlias('bapa tua', 'Sunda')).toBeNull()
  })

  it('komposit dengan region selain Karo nihil: pak uda Jawa null', () => {
    expect(resolveAlias('pak uda', 'Jawa')).toBeNull()
  })

  it('guard: objek Karo di KINSHIP_ALIASES_REGIONAL berisi tepat 11 key setelah 4 komposit bapa (v191-ii add-only)', () => {
    const keys = Object.keys(KINSHIP_ALIASES_REGIONAL.Karo).sort()
    expect(keys).toEqual([
      'bapa nguda',
      'bapa tua',
      'bibi',
      'impal',
      'kaka',
      'kempu',
      'nini',
      'nini bulang',
      'nini ribu',
      'pak tua',
      'pak uda',
    ])
    expect(keys.length).toBe(11)
  })

  it('entri komposit tidak menimpa lema utama bapa: kind depth region tetap', () => {
    expect(KINSHIP_ALIASES.bapa.kind).toBe('parent')
    expect(KINSHIP_ALIASES.bapa.depth).toBe(1)
    expect(KINSHIP_ALIASES.bapa.region).toBe('Karo')
    expect(KINSHIP_ALIASES.bapa).not.toBe(KINSHIP_ALIASES_REGIONAL.Karo['bapa tua'])
  })

  it('rantai aliasKinds() tetap 71: 4 komposit regional tidak menambah map utama', () => {
    expect(aliasKinds().length).toBe(71)
    expect(aliasKinds()).not.toContain('bapa tua')
    expect(aliasKinds()).not.toContain('pak uda')
  })
})
