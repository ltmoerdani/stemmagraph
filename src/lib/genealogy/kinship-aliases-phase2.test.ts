import { describe, expect, it } from 'vitest'
import { KINSHIP_ALIASES, aliasKinds, resolveAlias } from './kinship-aliases'

describe('kinship-aliases fase II (v174-i)', () => {
  it('aki resolve grandparent', () => {
    const r = resolveAlias('aki')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('grandparent')
  })

  it('sepupu kedua resolve cousin', () => {
    const r = resolveAlias('sepupu kedua')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('cousin')
  })

  it('misan tetap cousin qualifier sunda', () => {
    const r = resolveAlias('misan')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('cousin')
    expect(r?.qualifier).toBe('sunda')
  })

  it('sepupu tetap cousin tanpa qualifier', () => {
    const r = resolveAlias('sepupu')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('cousin')
    expect(r?.qualifier).toBeUndefined()
  })

  it('frasa nenek moyang resolve ancestor', () => {
    const r = resolveAlias('nenek moyang')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('ancestor')
  })

  it('frasa datuk poyang resolve ancestor', () => {
    const r = resolveAlias('datuk poyang')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('ancestor')
  })

  it('poyang tetap ancestor dengan note makna 2', () => {
    const r = resolveAlias('poyang')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('ancestor')
    expect(r?.note).toContain('makna 2')
  })

  it('buyut tetap descendant depth 3 dengan note dua arah (koreksi notes 412)', () => {
    const r = resolveAlias('buyut')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('descendant')
    expect(r?.depth).toBe(3)
    expect(r?.note).toContain('dua arah')
  })

  it('piut descendant depth 4', () => {
    const r = resolveAlias('piut')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('descendant')
    expect(r?.depth).toBe(4)
  })

  it('normalisasi spasi ganda Sepupu Kedua sama dengan sepupu kedua', () => {
    const a = resolveAlias('Sepupu  Kedua')
    const b = resolveAlias('sepupu kedua')
    expect(a).not.toBeNull()
    expect(b).not.toBeNull()
    expect(a).toEqual(b)
  })

  it('normalisasi titik tengah tetap bekerja untuk lema existing', () => {
    const a = resolveAlias('mo\u00B7yang')
    const b = resolveAlias('moyang')
    expect(a).not.toBeNull()
    expect(a).toEqual(b)
  })

  it('aliasKinds terurut dan memuat aki dan sepupu kedua', () => {
    const kinds = aliasKinds()
    const sorted = [...kinds].sort()
    expect(kinds).toEqual(sorted)
    expect(kinds).toContain('aki')
    expect(kinds).toContain('sepupu kedua')
  })
})

// Jaga export KINSHIP_ALIASES tetap terpakai di test (regresi bentuk objek)
it('KINSHIP_ALIASES memuat entri baru fase II', () => {
  expect(KINSHIP_ALIASES['aki']).toBeDefined()
  expect(KINSHIP_ALIASES['sepupu kedua']).toBeDefined()
})
