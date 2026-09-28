import { describe, expect, it } from 'vitest'
import { KINSHIP_ALIASES_REGIONAL, resolveAlias } from './kinship-aliases'

describe('kinship-aliases impal Karo (v189-i regional map)', () => {
  it('resolveAlias impal tanpa region bernilai null: impal hanya ada di map regional Karo', () => {
    expect(resolveAlias('impal')).toBeNull()
  })

  it('resolveAlias Impal region Karo kembalikan entri cousin tanpa depth', () => {
    const r = resolveAlias('Impal ', 'Karo')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('cousin')
    expect(r?.depth).toBeUndefined()
  })

  it('resolveAlias impal region Sunda bernilai null: Sunda tidak terdaftar sebagai pemilik impal', () => {
    expect(resolveAlias('impal', 'Sunda')).toBeNull()
  })

  it('normalize spasi: impal dengan spasi pinggir tetap kena', () => {
    const r = resolveAlias(' impal ', 'Karo')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('cousin')
  })

  it('normalize titik tengah: impal· tetap kena lewat normalize, titik biasa tidak dibuang normalize', () => {
    const r = resolveAlias('impal·', 'Karo')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('cousin')
    expect(resolveAlias('impal.', 'Karo')).toBeNull()
  })

  it('regresi: entri kaka Karo tetap ada dengan kind sibling depth 1', () => {
    const karo = KINSHIP_ALIASES_REGIONAL.Karo
    expect(karo.kaka).toBeDefined()
    expect(karo.kaka.kind).toBe('sibling')
    expect(karo.kaka.depth).toBe(1)
  })

  it('resolveAlias kaka region Karo tetap regional sibling, bukan entri global Sunda', () => {
    const r = resolveAlias('kaka', 'Karo')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('sibling')
    expect(r?.region).toBe('Karo')
  })

  it('regresi: resolveAlias kaka tanpa region tetap entri global Sunda yang sudah ada', () => {
    const r = resolveAlias('kaka')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('sibling')
    expect(r?.depth).toBe(1)
    expect(r?.qualifier).toBe('sunda')
    expect(r?.region).toBeUndefined()
  })

  it('struktur entri impal: region Karo dan note memuat sumber Sembiring', () => {
    const karo = KINSHIP_ALIASES_REGIONAL.Karo
    expect(karo.impal).toBeDefined()
    expect(karo.impal.region).toBe('Karo')
    expect(karo.impal.note).toContain('Sembiring')
  })

  it('determinisme: dua panggilan berurutan hasil identik (deep equal)', () => {
    const a = resolveAlias('impal', 'Karo')
    const b = resolveAlias('impal', 'Karo')
    expect(a).toEqual(b)
    expect(b).toEqual(KINSHIP_ALIASES_REGIONAL.Karo.impal)
  })

  it('regresi: resolveAlias nini tetap entri global grandparent multi region', () => {
    const r = resolveAlias('nini')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('grandparent')
    expect(r?.region).toContain('Karo')
  })

  it('guard: objek Karo di KINSHIP_ALIASES_REGIONAL berisi tepat 2 key, kaka dan impal', () => {
    const keys = Object.keys(KINSHIP_ALIASES_REGIONAL.Karo).sort()
    expect(keys).toEqual(['impal', 'kaka'])
    expect(keys.length).toBe(2)
  })
})
