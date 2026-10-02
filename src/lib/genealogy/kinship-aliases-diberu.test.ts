import { describe, expect, it } from 'vitest'
import { KINSHIP_ALIASES_REGIONAL, resolveAlias } from './kinship-aliases'

describe('kinship-aliases diberu Karo (v194-i salvase PM, jalur buku Search Inside)', () => {
  it('resolveAlias diberu tanpa region bernilai null: diberu hanya ada di map regional Karo', () => {
    expect(resolveAlias('diberu')).toBeNull()
  })

  it('resolveAlias diberu region Karo kembalikan entri partner depth 1', () => {
    const r = resolveAlias('diberu', 'Karo')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('partner')
    expect(r?.depth).toBe(1)
    expect(r?.region).toBe('Karo')
  })

  it('resolveAlias diberu region Toba bernilai null: Toba tidak mewarisi Karo', () => {
    expect(resolveAlias('diberu', 'Toba')).toBeNull()
  })

  it('resolveAlias diberu region Sunda bernilai null: region tak terdaftar tidak mewarisi', () => {
    expect(resolveAlias('diberu', 'Sunda')).toBeNull()
  })

  it('normalisasi spasi: diberu dengan spasi pinggir tetap kena', () => {
    const r = resolveAlias(' diberu ', 'Karo')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('partner')
  })

  it('struktur entri diberu: note memuat tiga sumber buku dan referensi evidence', () => {
    const karo = KINSHIP_ALIASES_REGIONAL.Karo.diberu
    expect(karo).toBeDefined()
    expect(karo.note).toContain('Singarimbun')
    expect(karo.note).toContain('Steedly')
    expect(karo.note).toContain('Katoppo')
    expect(karo.note).toContain('notes/464')
  })

  it('regresi: sukut Karo dari v192-i tidak tertimpa entri diberu', () => {
    const r = resolveAlias('sukut', 'Karo')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('sibling')
    expect(r?.depth).toBe(1)
  })

  it('determinisme: dua panggilan berurutan hasil identik (deep equal)', () => {
    const a = resolveAlias('diberu', 'Karo')
    const b = resolveAlias('diberu', 'Karo')
    expect(a).toEqual(b)
    expect(b).toEqual(KINSHIP_ALIASES_REGIONAL.Karo.diberu)
  })

  it('guard: objek Karo di KINSHIP_ALIASES_REGIONAL berisi tepat 17 key, diberu masuk (v196-i bump)', () => {
    const keys = Object.keys(KINSHIP_ALIASES_REGIONAL.Karo).sort()
    expect(keys.length).toBe(19)
    expect(keys).toContain('diberu')
  })

  it('guard: objek Toba tetap 1 key butet dan map regional tetap dua region (v194-i nihil sentuh)', () => {
    expect(Object.keys(KINSHIP_ALIASES_REGIONAL.Toba).sort()).toEqual(['butet', 'pariban'])
    expect(Object.keys(KINSHIP_ALIASES_REGIONAL).sort()).toEqual(['Karo', 'Toba'])
  })
})
