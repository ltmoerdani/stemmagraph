import { describe, expect, it } from 'vitest'

import {
  KINSHIP_ALIASES,
  aliasKinds,
  resolveAlias,
} from './kinship-aliases'

describe('alias Karo kelompok kekerabatan (v186-i)', () => {
  it('sembuyak resolve ke sibling depth 1 region Karo', () => {
    const e = resolveAlias('sembuyak')
    expect(e).not.toBeNull()
    expect(e?.kind).toBe('sibling')
    expect(e?.depth).toBe(1)
    expect(e?.region).toBe('Karo')
  })

  it('senina resolve ke sibling depth 1 region Karo', () => {
    const e = resolveAlias('senina')
    expect(e).not.toBeNull()
    expect(e?.kind).toBe('sibling')
    expect(e?.depth).toBe(1)
    expect(e?.region).toBe('Karo')
  })

  it('sembuyak ter-normalisasi case-insensitive dan trim', () => {
    expect(resolveAlias('Sembuyak')).not.toBeNull()
    expect(resolveAlias(' Sembuyak ')).not.toBeNull()
  })

  it('senina ter-normalisasi case-insensitive dan trim', () => {
    expect(resolveAlias('Senina')).not.toBeNull()
    expect(resolveAlias(' Senina ')).not.toBeNull()
  })

  it('sembuyak dan senina dua key terpisah', () => {
    const keys = Object.keys(KINSHIP_ALIASES).filter(
      (k) => k === 'sembuyak' || k === 'senina',
    )
    expect(keys).toEqual(['sembuyak', 'senina'])
  })

  it('negatif: ersemina nihil, istilah kekerabatan Karo berbeda tidak terdaftar', () => {
    expect(resolveAlias('ersemina')).toBeNull()
  })

  it('negatif: sembuyak2 (gelar marga fiktif) nihil', () => {
    expect(resolveAlias('sembuyak2')).toBeNull()
  })

  it('negatif: kalin tidak terdaftar (potongan lemma kalin bukan key; kalimbubu penuh live sejak v222-i)', () => {
    expect(resolveAlias('kalin')).toBeNull()
  })

  it('entri punya note evidence notes 440 dan jangkar kelompok', () => {
    expect(resolveAlias('sembuyak')?.note).toContain('segalur')
    expect(resolveAlias('sembuyak')?.note).toContain('evidence notes/440')
    expect(resolveAlias('senina')?.note).toContain('silima')
    expect(resolveAlias('senina')?.note).toContain('evidence notes/440')
  })

  it('struktur entri sembuyak persis 4 field kind depth region note', () => {
    const e = resolveAlias('sembuyak')
    expect(e).not.toBeNull()
    expect(Object.keys(e as object).sort()).toEqual(['depth', 'kind', 'note', 'region'])
  })

  it('struktur entri senina persis 4 field kind depth region note', () => {
    const e = resolveAlias('senina')
    expect(e).not.toBeNull()
    expect(Object.keys(e as object).sort()).toEqual(['depth', 'kind', 'note', 'region'])
  })

  it('aliasKinds memuat sembuyak dan senina, tetap sorted', () => {
    const kinds = aliasKinds()
    expect(kinds).toContain('sembuyak')
    expect(kinds).toContain('senina')
    const sorted = [...kinds].sort()
    expect(kinds).toEqual(sorted)
  })
})
