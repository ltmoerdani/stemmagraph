import { describe, expect, it } from 'vitest'

import { KINSHIP_ALIASES, aliasKinds, resolveAlias } from './kinship-aliases'

describe('alias adik (v185-i)', () => {
  it('dik resolve ke sibling depth 1', () => {
    const e = resolveAlias('dik')
    expect(e).not.toBeNull()
    expect(e?.kind).toBe('sibling')
    expect(e?.depth).toBe(1)
  })

  it('Dik ter-normalisasi case-insensitive', () => {
    const e = resolveAlias('Dik')
    expect(e).not.toBeNull()
    expect(e?.kind).toBe('sibling')
    expect(e?.depth).toBe(1)
  })

  it("' dik ' dengan spasi ter-trim", () => {
    const e = resolveAlias(' dik ')
    expect(e).not.toBeNull()
    expect(e?.kind).toBe('sibling')
  })

  it('nihil homonim: resolveAlias dik entri tunggal satu makna', () => {
    const e = resolveAlias('dik')
    expect(e).not.toBeNull()
    expect(e?.note).toContain('satu makna nihil homonim')
    const keysDik = Object.keys(KINSHIP_ALIASES).filter((k) => k === 'dik')
    expect(keysDik).toEqual(['dik'])
  })

  it('negatif: ariq nihil, tidak terdaftar', () => {
    expect(resolveAlias('ariq')).toBeNull()
  })

  it('negatif: adhi nihil, tidak terdaftar', () => {
    expect(resolveAlias('adhi')).toBeNull()
  })

  it('negatif: dhek nihil, tidak terdaftar', () => {
    expect(resolveAlias('dhek')).toBeNull()
  })

  it('negatif: adina nihil, tidak terdaftar', () => {
    expect(resolveAlias('adina')).toBeNull()
  })

  it('negatif: adik kata dasar bukan alias terdaftar', () => {
    expect(resolveAlias('adik')).toBeNull()
  })

  it('entri punya note evidence klaster adik', () => {
    const e = resolveAlias('dik')
    expect(e?.note).toContain('evidence notes/2026-09-28-evidence-stg-klaster-adik-pm')
  })

  it('aliasKinds memuat dik', () => {
    const kinds = aliasKinds()
    expect(kinds).toContain('dik')
    const sorted = [...kinds].sort()
    expect(kinds).toEqual(sorted)
  })

  it('struktur entri dik persis 3 field kind depth note tanpa region', () => {
    const e = resolveAlias('dik')
    expect(e).not.toBeNull()
    expect(Object.keys(e as object).sort()).toEqual(['depth', 'kind', 'note'])
    expect(e?.note).toContain('KBBI VI')
  })
})
