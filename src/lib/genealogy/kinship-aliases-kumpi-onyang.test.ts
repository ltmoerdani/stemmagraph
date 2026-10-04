import { describe, expect, it } from 'vitest'
import { KINSHIP_ALIASES, KINSHIP_ALIASES_REGIONAL, resolveAlias } from './kinship-aliases'

describe('kinship-aliases kumpi (v230-i, kind ancestor, region Jakarta, gender-netral)', () => {
  it('entri kumpi terdaftar dengan empat field', () => {
    const e = KINSHIP_ALIASES.kumpi
    expect(e).toBeDefined()
    expect(e.kind).toBe('ancestor')
    expect(e.region).toBe('Jakarta')
    expect((e.note ?? '').length).toBeGreaterThan(30)
  })

  it('kumpi resolve lewat resolveAlias tanpa dan dengan argumen', () => {
    expect(resolveAlias('kumpi')?.kind).toBe('ancestor')
    expect(resolveAlias('Kumpi ')?.region).toBe('Jakarta')
  })

  it('note memuat jangkar KBBI VI dan gender-netral', () => {
    const note = resolveAlias('kumpi')?.note ?? ''
    expect(note).toContain('KBBI VI')
    expect(note).toContain('gender-netral')
  })

  it('negatif homonim kum.pi2: note tidak memuat makna karung atau terasi sbg pemetaan', () => {
    const note = resolveAlias('kumpi')?.note ?? ''
    expect(note).toContain('karung daun nipah')
    expect(note).toContain('tidak dipetakan')
  })

  it('negatif arah: kumpi tanpa depth eksplisit, konsisten pola moyang', () => {
    expect(KINSHIP_ALIASES.kumpi.depth).toBeUndefined()
    expect(KINSHIP_ALIASES.moyang.depth).toBeUndefined()
  })

  it('normalisasi kapital dan spasi tetap resolve', () => {
    expect(resolveAlias('KUMPI')?.kind).toBe('ancestor')
  })
})

describe('kinship-aliases onyang (v230-i, kind ancestor, arkais)', () => {
  it('entri onyang terdaftar kind ancestor tanpa region', () => {
    const e = KINSHIP_ALIASES.onyang
    expect(e).toBeDefined()
    expect(e.kind).toBe('ancestor')
    expect(e.region).toBeUndefined()
    expect(e.depth).toBeUndefined()
  })

  it('onyang resolve penuh', () => {
    expect(resolveAlias('onyang')?.kind).toBe('ancestor')
    expect(resolveAlias(' Onyang')?.kind).toBe('ancestor')
  })

  it('note memuat label arkais dan dua jangkar institusional, status jujur nihil sumber ketiga', () => {
    const note = resolveAlias('onyang')?.note ?? ''
    expect(note).toContain('ark')
    expect(note).toContain('KBBI VI')
    expect(note).toContain('nihil sumber akademik independen ketiga')
  })

  it('regresi karuhun pitarah leluhur moyang tetap ancestor utuh', () => {
    expect(resolveAlias('karuhun')?.kind).toBe('ancestor')
    expect(resolveAlias('pitarah')?.kind).toBe('ancestor')
    expect(resolveAlias('leluhur')?.kind).toBe('ancestor')
    expect(resolveAlias('moyang')?.kind).toBe('ancestor')
  })

  it('regresi rantai naik: buyut depth 3 dan poyang depth 4 tetap', () => {
    expect(resolveAlias('buyut')?.depth).toBe(3)
    expect(resolveAlias('poyang')?.depth).toBe(4)
  })

  it('regresi phrase: nenek moyang tetap phrase ancestor, kumpi dan onyang tidak mengubahnya', () => {
    expect(resolveAlias('nenek moyang')?.kind).toBe('ancestor')
  })

  it('negatif: onyang nihil di map regional Toba dan Karo, entri hidup di map global', () => {
    expect(KINSHIP_ALIASES_REGIONAL.Toba['onyang']).toBeUndefined()
    expect(KINSHIP_ALIASES_REGIONAL.Karo['onyang']).toBeUndefined()
    expect(KINSHIP_ALIASES_REGIONAL.Simalungun['onyang']).toBeUndefined()
  })
})
