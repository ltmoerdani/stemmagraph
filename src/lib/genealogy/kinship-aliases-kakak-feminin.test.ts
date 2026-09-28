import { describe, expect, it } from 'vitest'

import { KINSHIP_ALIASES, resolveAlias } from './kinship-aliases'

describe('alias kakak feminin KBBI VI (v184-ii)', () => {
  it('uni resolve ke sibling region Mk', () => {
    const e = resolveAlias('uni')
    expect(e).not.toBeNull()
    expect(e?.kind).toBe('sibling')
    expect(e?.region).toBe('Mk')
  })

  it('taci resolve ke sibling region Cn', () => {
    const e = resolveAlias('taci')
    expect(e).not.toBeNull()
    expect(e?.kind).toBe('sibling')
    expect(e?.region).toBe('Cn')
  })

  it('cici ter-normalisasi exact-key: cici, Cici, cici ber spasi', () => {
    for (const phrase of ['cici', 'Cici', ' cici ']) {
      const e = resolveAlias(phrase)
      expect(e).not.toBeNull()
      expect(e?.kind).toBe('sibling')
      expect(e?.region).toBe('Cn')
    }
  })

  it('homonim cicit nihil masuk alias: hasil resolve sibling, bukan descendant depth 3', () => {
    const e = resolveAlias('cici')
    expect(e?.kind).toBe('sibling')
    expect(e?.kind).not.toBe('descendant')
    expect(resolveAlias('cicit')?.depth).toBe(3)
    expect(resolveAlias('cici')?.depth).toBe(1)
  })

  it('mbak resolve ke sibling', () => {
    const e = resolveAlias('mbak')
    expect(e).not.toBeNull()
    expect(e?.kind).toBe('sibling')
    expect(e?.depth).toBe(1)
  })

  it('mbakyu region Jw', () => {
    const e = resolveAlias('mbakyu')
    expect(e).not.toBeNull()
    expect(e?.kind).toBe('sibling')
    expect(e?.region).toBe('Jw')
  })

  it('embak qualifier cak', () => {
    const e = resolveAlias('embak')
    expect(e).not.toBeNull()
    expect(e?.kind).toBe('sibling')
    expect(e?.qualifier).toBe('cak')
  })

  it('ayunda register hormat region hor', () => {
    const e = resolveAlias('ayunda')
    expect(e).not.toBeNull()
    expect(e?.kind).toBe('sibling')
    expect(e?.register).toBe('hormat')
    expect(e?.region).toBe('hor')
  })

  it('kakanda blok lama maskulin tak terganggu: sibling register hormat', () => {
    const e = resolveAlias('kakanda')
    expect(e).not.toBeNull()
    expect(e?.kind).toBe('sibling')
    expect(e?.register).toBe('hormat')
  })

  it('negatif: bang nihil', () => {
    expect(resolveAlias('bang')).toBeNull()
  })

  it('negatif: engkang nihil', () => {
    expect(resolveAlias('engkang')).toBeNull()
  })

  it('negatif: bli nihil', () => {
    expect(resolveAlias('bli')).toBeNull()
  })

  it('determinisme: dua panggilan sama hasil', () => {
    const a = resolveAlias('uni')
    const b = resolveAlias('uni')
    expect(a).toEqual(b)
  })

  it('normalisasi TACI ber spasi dan cici awal spasi resolve', () => {
    expect(resolveAlias('TACI ')?.region).toBe('Cn')
    expect(resolveAlias(' cici')?.region).toBe('Cn')
  })

  it('total entri sibling: 15 basis v184-i, +7 feminin v184-ii = 22, +2 karo agi turang = 24, +1 dik v185-i = 25, +2 sembuyak senina v186-i = 27, +1 nande v187-i = 28', () => {
    const before = 15
    const total = Object.values(KINSHIP_ALIASES).filter((e) => e.kind === 'sibling').length
    expect(before).toBe(15)
    expect(total).toBe(28)
  })
})
