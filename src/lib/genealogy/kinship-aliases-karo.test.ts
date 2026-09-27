import { describe, expect, it } from 'vitest'

import { KINSHIP_ALIASES, aliasKinds, resolveAlias } from './kinship-aliases'

describe('alias Karo (v185-i)', () => {
  it('agi resolve ke sibling depth 1 region Karo', () => {
    const e = resolveAlias('agi')
    expect(e).not.toBeNull()
    expect(e?.kind).toBe('sibling')
    expect(e?.depth).toBe(1)
    expect(e?.region).toBe('Karo')
  })

  it('Agi ter-normalisasi case-insensitive', () => {
    const e = resolveAlias('Agi')
    expect(e).not.toBeNull()
    expect(e?.kind).toBe('sibling')
    expect(e?.depth).toBe(1)
    expect(e?.region).toBe('Karo')
  })

  it('turang resolve ke sibling depth 1 region Karo', () => {
    const e = resolveAlias('turang')
    expect(e).not.toBeNull()
    expect(e?.kind).toBe('sibling')
    expect(e?.depth).toBe(1)
    expect(e?.region).toBe('Karo')
  })

  it(' Turang dengan spasi ter-trim', () => {
    const e = resolveAlias(' Turang ')
    expect(e).not.toBeNull()
    expect(e?.kind).toBe('sibling')
    expect(e?.region).toBe('Karo')
  })

  it('negatif: kalimbubu nihil, istilah afinal ditahan goal terpisah', () => {
    expect(resolveAlias('kalimbubu')).toBeNull()
  })

  it('negatif: aguni nihil, homonim Wiktionary bukan alias terdaftar', () => {
    expect(resolveAlias('aguni')).toBeNull()
  })

  it('negatif: string kosong dan spasi nihil', () => {
    expect(resolveAlias('')).toBeNull()
    expect(resolveAlias('   ')).toBeNull()
  })

  it('aliasKinds memuat agi dan turang terurut', () => {
    const kinds = aliasKinds()
    expect(kinds).toContain('agi')
    expect(kinds).toContain('turang')
    expect(kinds.indexOf('agi')).toBeLessThan(kinds.indexOf('turang'))
    const sorted = [...kinds].sort()
    expect(kinds).toEqual(sorted)
  })

  it('determinisme: dua panggilan hasil identik deep equal', () => {
    const a = resolveAlias('turang')
    const b = resolveAlias('turang')
    expect(a).toEqual(b)
  })

  it('negatif: kaka tidak ikut terdaftar sebagai entri Karo, area baru tepat 2', () => {
    const kaka = resolveAlias('kaka')
    if (kaka !== null) {
      expect(kaka.region).not.toBe('Karo')
    }
    const karo = Object.entries(KINSHIP_ALIASES).filter(
      ([, e]) => e.region === 'Karo',
    )
    expect(karo.length).toBe(2)
    expect(karo.map(([k]) => k).sort()).toEqual(['agi', 'turang'])
  })

  it('struktur entri agi persis 4 field kind depth region note', () => {
    const e = resolveAlias('agi')
    expect(e).not.toBeNull()
    expect(Object.keys(e as object).sort()).toEqual(['depth', 'kind', 'note', 'region'])
    expect(e?.note).toContain('Wiktionary btx')
  })

  it('struktur entri turang persis 4 field kind depth region note', () => {
    const e = resolveAlias('turang')
    expect(e).not.toBeNull()
    expect(Object.keys(e as object).sort()).toEqual(['depth', 'kind', 'note', 'region'])
    expect(e?.note).toContain('Kamus Bahasa Karo-Indonesia 2001')
  })
})
