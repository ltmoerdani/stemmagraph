import { describe, expect, it } from 'vitest'
import { aliasKinds, resolveAlias, KINSHIP_ALIASES, KINSHIP_ALIASES_REGIONAL } from './kinship-aliases'
import { expectNoteContains, regionalEntry, regionalNote } from './__tests__/alias-entry'

describe('kinship-aliases tulang Toba (v214-i, kind parent-sibling, saudara laki-laki ibu MB, dua sumber)', () => {
  it('1. positif: tulang Toba kind parent-sibling, depth 1, region Toba', () => {
    const r = resolveAlias('tulang', 'Toba')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('parent-sibling')
    expect(r?.depth).toBe(1)
    expect(r?.region).toBe('Toba')
  })

  it('2. normalisasi huruf besar dan spasi tepi menghasilkan entri yang sama', () => {
    expect(resolveAlias('TULANG', 'Toba')).toEqual(resolveAlias('tulang', 'Toba'))
    expect(resolveAlias('  Tulang ', 'Toba')).toEqual(resolveAlias('tulang', 'Toba'))
  })

  it('3. tanpa region tulang tidak ada di peta global', () => {
    expect(resolveAlias('tulang')).toBeNull()
    expect(Object.keys(KINSHIP_ALIASES)).not.toContain('tulang')
  })

  it('4. negatif Karo dan Jawa: null, key tidak bocor ke Karo', () => {
    expect(resolveAlias('tulang', 'Karo')).toBeNull()
    expect(resolveAlias('tulang', 'Jawa')).toBeNull()
    expect(Object.keys(KINSHIP_ALIASES_REGIONAL.Karo)).not.toContain('tulang')
  })

  it('5. note memuat dua sumber: Wiktionary Toba Batak maternal uncle dan KBBI VI tulang2 Bt', () => {
    expectNoteContains('Toba', 'tulang', ['Wiktionary', 'Toba Batak', 'maternal uncle'])
    expectNoteContains('Toba', 'tulang', ['KBBI VI', 'tulang2', 'saudara laki-laki dari ibu'])
  })

  it('6. note: DUA SUMBER, makna MB saja, sense mertua ditahan single-source, homonim holi dicatat', () => {
    const note = regionalNote('Toba', 'tulang')
    expect(note).toContain('DUA SUMBER')
    expect(note).toContain('MB saja')
    expect(note).toContain('mertua')
    expect(note).toContain('single-source')
    expect(note).toContain('holi')
  })

  it('7. note tidak memuat karakter em dash maupun pengganti dua tanda minus', () => {
    const note = regionalNote('Toba', 'tulang')
    expect(note.includes('\u2014')).toBe(false)
    expect(note.includes('--')).toBe(false)
  })

  it('8. negatif homonim anatomi: holi null di Toba dan global, bukan key Toba', () => {
    expect(resolveAlias('holi', 'Toba')).toBeNull()
    expect(resolveAlias('holi')).toBeNull()
    expect(Object.keys(KINSHIP_ALIASES_REGIONAL.Toba)).not.toContain('holi')
  })

  it('9. non-regresi: namboru parent-sibling, lae sibling, pariban cousin, iboto sibling, eda Karo sibling depth 1', () => {
    expect(resolveAlias('namboru', 'Toba')?.kind).toBe('parent-sibling')
    expect(resolveAlias('lae', 'Toba')?.kind).toBe('sibling')
    expect(resolveAlias('pariban', 'Toba')?.kind).toBe('cousin')
    expect(resolveAlias('iboto', 'Toba')?.kind).toBe('sibling')
    expect(resolveAlias('eda', 'Karo')?.kind).toBe('sibling')
    expect(resolveAlias('eda', 'Karo')?.depth).toBe(1)
  })

  it('10. idempoten: key tulang tepat satu, dua panggilan sama, sama dengan isi peta Toba', () => {
    const keys = Object.keys(KINSHIP_ALIASES_REGIONAL.Toba)
    expect(keys.filter((k) => k === 'tulang')).toHaveLength(1)
    expect(new Set(keys).size).toBe(keys.length)
    expect(resolveAlias('tulang', 'Toba')).toEqual(resolveAlias('tulang', 'Toba'))
    expect(resolveAlias('tulang', 'Toba')).toEqual(KINSHIP_ALIASES_REGIONAL.Toba['tulang'])
    expect(regionalEntry('Toba', 'tulang').kind).toBe('parent-sibling')
  })

  it('11. aliasKinds tidak bocor: key global terurut tidak memuat tulang maupun holi', () => {
    const keys = aliasKinds()
    expect(keys).toEqual(Object.keys(KINSHIP_ALIASES).sort())
    expect(keys).not.toContain('tulang')
    expect(keys).not.toContain('holi')
  })

  it('12. pengunci guard Toba: tepat sembilan key terurut, toHaveLength 9 dan toEqual array', () => {
    const keys = Object.keys(KINSHIP_ALIASES_REGIONAL.Toba)
    expect(keys).toHaveLength(9)
    expect([...keys].sort()).toEqual([
      'amangboru',
      'boru',
      'butet',
      'iboto',
      'lae',
      'namboru',
      'ompung suhut',
      'pariban',
      'tulang',
    ])
  })
})
