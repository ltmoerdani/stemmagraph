import { describe, expect, it } from 'vitest'
import { KINSHIP_ALIASES_REGIONAL, aliasKinds, resolveAlias } from './kinship-aliases'

describe('kinship-aliases Karo lanjutan (v189-ii kempu bibi)', () => {
  it('resolveAlias kempu region Karo kembalikan entri Karo: kind grandchild depth 1 region Karo', () => {
    const r = resolveAlias('kempu', 'Karo')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('grandchild')
    expect(r?.depth).toBe(1)
    expect(r?.region).toBe('Karo')
  })

  it('resolveAlias kempu tanpa region null: tidak boleh bocor ke map utama', () => {
    const r = resolveAlias('kempu')
    expect(r).toBeNull()
  })

  it('resolveAlias bibi region Karo kembalikan entri Karo: kind parent-sibling depth 1 region Karo', () => {
    const r = resolveAlias('bibi', 'Karo')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('parent-sibling')
    expect(r?.depth).toBe(1)
    expect(r?.region).toBe('Karo')
  })

  it('resolveAlias bibi tanpa region null: homograf Indonesia tetap nihil di map utama', () => {
    const r = resolveAlias('bibi')
    expect(r).toBeNull()
  })

  it('resolveAlias bere tanpa region null: ditahan keputusan PM, belum ditambahkan', () => {
    const r = resolveAlias('bere')
    expect(r).toBeNull()
  })

  it('resolveAlias bere region Karo tetap null: ditahan keputusan PM, tidak ada di map regional Karo', () => {
    const r = resolveAlias('bere', 'Karo')
    expect(r).toBeNull()
  })

  it('regresi: kaka Karo tetap resolve kind sibling depth 1 region Karo', () => {
    const r = resolveAlias('kaka', 'Karo')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('sibling')
    expect(r?.depth).toBe(1)
    expect(r?.region).toBe('Karo')
  })

  it('regresi: impal Karo tetap resolve kind cousin region Karo', () => {
    const r = resolveAlias('impal', 'Karo')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('cousin')
    expect(r?.region).toBe('Karo')
  })

  it('jumlah key bagian Karo di KINSHIP_ALIASES_REGIONAL tetap 4: kaka impal kempu bibi', () => {
    const keys = Object.keys(KINSHIP_ALIASES_REGIONAL.Karo).sort()
    expect(keys).toEqual(['bibi', 'impal', 'kaka', 'kempu'])
    expect(keys.length).toBe(4)
  })

  it('rantai aliasKinds() panjang tetap 71: entri kempu bibi Karo regional tidak menambah map utama', () => {
    expect(aliasKinds().length).toBe(71)
    expect(aliasKinds()).not.toContain('kempu')
    expect(aliasKinds()).not.toContain('bibi')
  })

  it('normalize konsisten untuk kempu: uppercase dan spasi ganda sama hasilnya dengan key bersih', () => {
    const clean = resolveAlias('kempu', 'Karo')
    const upper = resolveAlias('  KEMPU  ', 'Karo')
    const spaced = resolveAlias('Kempu', 'Karo')
    expect(upper).toEqual(clean)
    expect(spaced).toEqual(clean)
  })

  it('guard U87 notes/448: bibi Karo bukan homograf KBVI Bt (mangga padi), entri ini murni kekerabatan saudara ibu atau ayah', () => {
    const entry = KINSHIP_ALIASES_REGIONAL.Karo.bibi
    expect(entry).toBeDefined()
    expect(entry.kind).toBe('parent-sibling')
    expect(entry.note).toContain('namespace terpisah dari homograf Indonesia')
    expect(entry.note).toContain('notes/448')
  })

  it('entri kempu Karo punya tiga sumber di note: kamus 2001, Wiktionary btx, Sembiring 1991', () => {
    const entry = KINSHIP_ALIASES_REGIONAL.Karo.kempu
    expect(entry).toBeDefined()
    expect(entry.note).toContain('Kamus Bahasa Karo Indonesia 2001')
    expect(entry.note).toContain('Wiktionary ID')
    expect(entry.note).toContain('Sembiring 1991')
    expect(entry.note).toContain('notes/448')
  })

  it('determinisme: resolve berulang kempu dan bibi Karo hasil identik', () => {
    expect(resolveAlias('kempu', 'Karo')).toEqual(resolveAlias('kempu', 'Karo'))
    expect(resolveAlias('bibi', 'Karo')).toEqual(resolveAlias('bibi', 'Karo'))
  })
})
