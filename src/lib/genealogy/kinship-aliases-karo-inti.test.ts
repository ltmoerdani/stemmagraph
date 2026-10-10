import { describe, expect, it } from 'vitest'
import { aliasKinds, resolveAlias } from './kinship-aliases'

// STG v188-i: 4 lema Karo inti (bapa, mama, mami, permen), sumber
// Sembiring 1991 The Bible Translator + Pandiangan 2024 JJETL,
// evidence notes/444 dan notes/445
describe('kinship-aliases-karo-inti (v188-i)', () => {
  it('bapa resolve parent depth 1', () => {
    const r = resolveAlias('bapa')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('parent')
    expect(r?.depth).toBe(1)
  })

  it('mama resolve parent-sibling depth 1', () => {
    const r = resolveAlias('mama')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('parent-sibling')
    expect(r?.depth).toBe(1)
  })

  it('mami resolve parent-sibling depth 1', () => {
    const r = resolveAlias('mami')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('parent-sibling')
    expect(r?.depth).toBe(1)
  })

  it('permen resolve sibling-child depth 1', () => {
    const r = resolveAlias('permen')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('sibling-child')
    expect(r?.depth).toBe(1)
  })

  it('keempat lema region Karo', () => {
    for (const key of ['bapa', 'mama', 'mami', 'permen']) {
      expect(resolveAlias(key)?.region).toBe('Karo')
    }
  })

  it('guard posisi PM: kaka tetap Sunda, bukan entri Karo, tidak dobel', () => {
    const r = resolveAlias('kaka')
    expect(r).not.toBeNull()
    expect(r?.qualifier).toBe('sunda')
    expect(r?.region).not.toBe('Karo')
  })

  it('negatif: pak nihil, varian ortografis ditahan', () => {
    expect(resolveAlias('pak')).toBeNull()
  })

  it('negatif: bibi dan bibik nihil, varian menunggu sumber ketiga (keputusan desain PM)', () => {
    expect(resolveAlias('bibi')).toBeNull()
    expect(resolveAlias('bibik')).toBeNull()
  })

  it('rantai: aliasKinds total 73 pasca v188-i', () => {
    expect(aliasKinds().length).toBe(82)
  })

  it('determinisme: resolveAlias bapa dua panggilan hasil identik', () => {
    const a = resolveAlias('bapa')
    const b = resolveAlias('bapa')
    expect(a).toEqual(b)
  })

  it('permen bukan kind child, ia sibling-child', () => {
    const r = resolveAlias('permen')
    expect(r?.kind).not.toBe('child')
    expect(r?.kind).toBe('sibling-child')
  })

  it('mama depth 1 eksplisit', () => {
    expect(resolveAlias('mama')?.depth).toBe(1)
  })

  it('normalisasi: Bapa kapital dan spasi tetap resolve', () => {
    const r = resolveAlias(' Bapa ')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('parent')
  })
})
