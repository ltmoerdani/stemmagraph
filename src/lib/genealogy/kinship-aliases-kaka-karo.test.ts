import { describe, expect, it } from 'vitest'
import { KINSHIP_ALIASES_REGIONAL, aliasKinds, resolveAlias } from './kinship-aliases'

describe('kinship-aliases kaka Karo (v188-ii regional map)', () => {
  it('resolveAlias kaka tanpa region tetap entri Sunda: kind sibling qualifier sunda (perilaku existing tak berubah)', () => {
    const r = resolveAlias('kaka')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('sibling')
    expect(r?.depth).toBe(1)
    expect(r?.qualifier).toBe('sunda')
    expect(r?.region).toBeUndefined()
  })

  it('resolveAlias kaka region Karo kembalikan entri Karo: kind sibling depth 1 region Karo', () => {
    const r = resolveAlias('kaka', 'Karo')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('sibling')
    expect(r?.depth).toBe(1)
    expect(r?.region).toBe('Karo')
  })

  it('region yang tidak terdaftar fallback ke map utama (entri Sunda)', () => {
    const r = resolveAlias('kaka', 'Mandailing')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('sibling')
    expect(r?.qualifier).toBe('sunda')
  })

  it('region terdaftar tapi key tidak ada di map regional juga fallback ke map utama', () => {
    const r = resolveAlias('misan', 'Karo')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('cousin')
    expect(r?.qualifier).toBe('sunda')
  })

  it('normalize konsisten: uppercase dan spasi ganda sama hasilnya dengan key bersih', () => {
    const clean = resolveAlias('kaka', 'Karo')
    const upper = resolveAlias('  KAKA  ', 'Karo')
    const spaced = resolveAlias('Kaka', 'Karo')
    expect(upper).toEqual(clean)
    expect(spaced).toEqual(clean)
  })

  it('guard: kaka Karo BUKAN kind parent (kaka berarti kakak, bukan orang tua)', () => {
    const r = resolveAlias('kaka', 'Karo')
    expect(r?.kind).not.toBe('parent')
  })

  it('rantai aliasKinds() panjang tetap 73: regional TIDAK menambah key map utama', () => {
    expect(aliasKinds().length).toBe(82)
    expect(aliasKinds()).not.toContain('kaka karo')
  })

  it('regional map nihil efek pada daftar key utama: kaka tetap satu-satunya key kaka di map utama', () => {
    const kinds = aliasKinds()
    expect(kinds.filter((k) => k === 'kaka').length).toBe(1)
  })

  it('determinisme: resolve berulang region Karo dan tanpa region hasil identik', () => {
    expect(resolveAlias('kaka', 'Karo')).toEqual(resolveAlias('kaka', 'Karo'))
    expect(resolveAlias('kaka')).toEqual(resolveAlias('kaka'))
  })

  it('permen tetap sibling-child (v188-i tidak terganggu regional map)', () => {
    const r = resolveAlias('permen')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('sibling-child')
    expect(r?.region).toBe('Karo')
  })

  it('bapa Karo masih resolve kind parent (regresi v188-i)', () => {
    const r = resolveAlias('bapa', 'Karo')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('parent')
    expect(r?.region).toBe('Karo')
  })

  it('entri regional kaka Karo punya dua sumber di note: audio Wiktionary btx plus Kamus Karo 2001', () => {
    const entry = KINSHIP_ALIASES_REGIONAL.Karo.kaka
    expect(entry).toBeDefined()
    expect(entry.note).toContain('LL-Q33012 btx HaidirAndiNovianto-kaka.wav')
    expect(entry.note).toContain('Kamus Bahasa Karo Indonesia 2001')
    expect(entry.note).toContain('notes/446')
  })
})
