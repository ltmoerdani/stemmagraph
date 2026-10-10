import { describe, expect, it } from 'vitest'
import { KINSHIP_ALIASES_REGIONAL, resolveAlias } from './kinship-aliases'

describe('kinship-aliases butet Toba (v193-i regional map, panggilan sayang anak perempuan)', () => {
  it('resolveAlias butet tanpa region bernilai null: butet hanya ada di map regional Toba', () => {
    expect(resolveAlias('butet')).toBeNull()
  })

  it('resolveAlias butet region Toba kembalikan entri child depth 1', () => {
    const r = resolveAlias('butet', 'Toba')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('child')
    expect(r?.depth).toBe(1)
    expect(r?.region).toBe('Toba')
  })

  it('resolveAlias butet region Karo bernilai null: Karo tidak memilik entri butet', () => {
    expect(resolveAlias('butet', 'Karo')).toBeNull()
  })

  it('resolveAlias butet region Sunda bernilai null: region tak terdaftar tidak mewarisi Toba', () => {
    expect(resolveAlias('butet', 'Sunda')).toBeNull()
  })

  it('normalize spasi: butet dengan spasi pinggir tetap kena', () => {
    const r = resolveAlias(' butet ', 'Toba')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('child')
  })

  it('struktur entri butet: note memuat dua sumber independen dan referensi evidence', () => {
    const toba = KINSHIP_ALIASES_REGIONAL.Toba
    expect(toba.butet).toBeDefined()
    expect(toba.butet.region).toBe('Toba')
    expect(toba.butet.note).toContain('Wikikamus')
    expect(toba.butet.note).toContain('1166752')
    expect(toba.butet.note).toContain('BatakKeren')
  })

  it('determinisme: dua panggilan berurutan hasil identik (deep equal)', () => {
    const a = resolveAlias('butet', 'Toba')
    const b = resolveAlias('butet', 'Toba')
    expect(a).toEqual(b)
    expect(b).toEqual(KINSHIP_ALIASES_REGIONAL.Toba.butet)
  })

  it('regresi: sukut Karo dari v192-i tidak tertimpa entri butet Toba', () => {
    const r = resolveAlias('sukut', 'Karo')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('sibling')
    expect(r?.depth).toBe(1)
  })

  it('regresi: kaka Karo tetap entri regional sibling yang sudah ada', () => {
    const r = resolveAlias('kaka', 'Karo')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('sibling')
  })

  it('guard: objek Toba berisi tepat 5 key amangboru butet iboto ompung suhut pariban (v209-i bump, amangboru add-only)', () => {
    const keys = Object.keys(KINSHIP_ALIASES_REGIONAL.Toba).sort()
    expect(keys).toEqual(['amangboru', 'boru', 'butet', 'dongan sa-', 'haha', 'hula-hula', 'iboto', 'lae', 'namboru', 'ompung suhut', 'opung', 'pahompu','pariban', 'tulang'])
  })

  it('guard: objek Karo tetap 17 key (v196-i bump), tidak tersentuh penambahan Toba', () => {
    const keys = Object.keys(KINSHIP_ALIASES_REGIONAL.Karo).sort()
    expect(keys.length).toBe(36) // v239-i bump 35 jadi 36 (alias perkembaren); v238-i bump 34 jadi 35 (alias kalimbubu singalo perninin); v236-i bump 32 jadi 33 (alias kalimbubu singalo ulu emas);  v235-i bump 31 jadi 32 (alias anak beru menteri); v234-i bump 30 jadi 31 (alias puang ni puang); v232-i bump 28 jadi 29 (alias kalimbubu simada dareh) (alias singerana) (alias kalimbubu siperdemui)
    expect(keys).toContain('sukut')
  })

  it('guard: map regional kini berisi tepat dua region Karo dan Toba', () => {
    const regions = Object.keys(KINSHIP_ALIASES_REGIONAL).sort()
    expect(regions).toEqual(['Karo', 'Langkat', 'Simalungun', 'Toba']) // v252-ix bump: Langkat masuk)
  })
})
