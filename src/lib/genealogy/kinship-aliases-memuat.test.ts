import { describe, expect, it } from 'vitest'
import { aliasKinds, resolveAlias } from './kinship-aliases'

describe('kinship-aliases memuat alias (v174-ii)', () => {
  it('dansanak resolve kind sibling', () => {
    const r = resolveAlias('dansanak')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('sibling')
  })

  it('dansa-dansi resolve kind sibling', () => {
    const r = resolveAlias('dansa-dansi')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('sibling')
  })

  it('dansanak dan dansa-dansi hasil identik', () => {
    const a = resolveAlias('dansanak')
    const b = resolveAlias('dansa-dansi')
    expect(a).toEqual(b)
  })

  it('negatif polysemy: ayah resolveAlias null', () => {
    expect(resolveAlias('ayah')).toBeNull()
  })

  it('negatif: ibu resolveAlias null', () => {
    expect(resolveAlias('ibu')).toBeNull()
  })

  it('mertua live sejak v253-vi: kind property', () => {
    const r = resolveAlias('mertua')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('property')
  })

  it('negatif hyphen: nenek-moyang null (key tabel pakai spasi, resolver tidak membelah hyphen)', () => {
    expect(resolveAlias('nenek-moyang')).toBeNull()
  })

  it('nenek moyang tetap resolve ancestor (tidak rusak oleh entri baru)', () => {
    const r = resolveAlias('nenek moyang')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('ancestor')
  })

  it('dansanak tidak menabrak entri existing lain (aliasKinds memuat tepat 2 key baru)', () => {
    const kinds = aliasKinds()
    expect(kinds).toContain('dansanak')
    expect(kinds).toContain('dansa-dansi')
    const newKeys = kinds.filter((k) => k === 'dansanak' || k === 'dansa-dansi')
    expect(newKeys).toHaveLength(2)
  })

  it('note kedua entri memuat penanda sumber', () => {
    const a = resolveAlias('dansanak')
    const b = resolveAlias('dansa-dansi')
    expect(a?.note).toContain('kbbi.web.id')
    expect(b?.note).toContain('kbbi.web.id')
  })

  it('roundtrip normalize spasi ekstra tetap resolve', () => {
    const r = resolveAlias(' Dansanak ')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('sibling')
  })

  it('kinship-alias lain tak berubah (contoh keponakan tetap sibling-child)', () => {
    const r = resolveAlias('keponakan')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('sibling-child')
  })
})
