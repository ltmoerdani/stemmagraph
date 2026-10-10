import { describe, expect, it } from 'vitest'
import { KINSHIP_ALIASES, aliasKinds, resolveAlias } from './kinship-aliases'

describe('kinship-aliases grandparent regional fase ii (v231-i)', () => {
  it('embah resolve grandparent jw Jawa', () => {
    const r = resolveAlias('embah')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('grandparent')
    expect(r?.qualifier).toBe('jw')
    expect(r?.region).toBe('Jawa')
  })

  it('engkong resolve grandparent cn Tionghoa', () => {
    const r = resolveAlias('engkong')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('grandparent')
    expect(r?.qualifier).toBe('cn')
    expect(r?.region).toBe('Tionghoa')
  })

  it('inyik resolve grandparent mk hormat', () => {
    const r = resolveAlias('inyik')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('grandparent')
    expect(r?.qualifier).toBe('mk')
    expect(r?.register).toBe('hormat')
  })

  it('embah muncul di map global', () => {
    expect(KINSHIP_ALIASES['embah']).toBeDefined()
  })

  it('engkong muncul di map global', () => {
    expect(KINSHIP_ALIASES['engkong']).toBeDefined()
  })

  it('inyik muncul di map global', () => {
    expect(KINSHIP_ALIASES['inyik']).toBeDefined()
  })

  it('embah bukan polos tanpa jangkar (guard ada di kontrak, key tunggal)', () => {
    const r = resolveAlias('embah embah')
    expect(r).toBeNull()
  })

  it('engkong engkong nihil (key komposit nihil)', () => {
    const r = resolveAlias('engkong engkong')
    expect(r).toBeNull()
  })

  it('inyik inyik nihil (key komposit nihil)', () => {
    const r = resolveAlias('inyik inyik')
    expect(r).toBeNull()
  })

  it('regresi: eyang tetap grandparent jw hormat Jawa', () => {
    const r = resolveAlias('eyang')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('grandparent')
    expect(r?.qualifier).toBe('jw')
    expect(r?.register).toBe('hormat')
  })

  it('regresi: opa tetap grandparent cak Betawi', () => {
    const r = resolveAlias('opa')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('grandparent')
    expect(r?.qualifier).toBe('cak')
    expect(r?.region).toBe('Betawi')
  })

  it('regresi: aki tetap grandparent Sunda, nini tetap grandparent', () => {
    const rAki = resolveAlias('aki')
    expect(rAki?.kind).toBe('grandparent')
    expect(rAki?.region).toBe('Sunda')
    const rNini = resolveAlias('nini')
    expect(rNini?.kind).toBe('grandparent')
  })

  it('regresi rantai naik: buyut tetap descendant depth 3', () => {
    const r = resolveAlias('buyut')
    expect(r?.kind).toBe('descendant')
    expect(r?.depth).toBe(3)
  })

  it('regresi rantai naik: poyang tetap ancestor depth 4', () => {
    const r = resolveAlias('poyang')
    expect(r?.kind).toBe('ancestor')
    expect(r?.depth).toBe(4)
  })

  it('regresi rantai naik: moyang tetap ancestor, nenek tetap grandparent', () => {
    const rMoyang = resolveAlias('moyang')
    expect(rMoyang?.kind).toBe('ancestor')
    const rNenek = resolveAlias('nenek')
    expect(rNenek?.kind).toBe('grandparent')
  })

  it('guard: jumlah key alias naik persis 3 (73 jadi 76)', () => {
    expect(aliasKinds().length).toBe(81)
  })

  it('guard homonim: engkong KBBI tunggal makna kakek, nihil homonim invasif', () => {
    const e = KINSHIP_ALIASES['engkong']
    expect(e?.note).toBeUndefined()
  })
})
