import { describe, expect, it } from 'vitest'
import { resolveAlias, KINSHIP_ALIASES, KINSHIP_ALIASES_REGIONAL } from './kinship-aliases'
import { expectNoteContains, regionalEntry, regionalNote } from './__tests__/alias-entry'

describe('kinship-aliases anggi Simalungun (v216-i, kind sibling, adik kandung gender-netral, dua sumber)', () => {
  it('1. positif: anggi Simalungun kind sibling, depth 1, region Simalungun', () => {
    const r = resolveAlias('anggi', 'Simalungun')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('sibling')
    expect(r?.depth).toBe(1)
    expect(r?.region).toBe('Simalungun')
  })

  it('2. case-insensitive dan trim: ANGGI dan "  Anggi " sama dengan anggi', () => {
    expect(resolveAlias('ANGGI', 'Simalungun')).toEqual(resolveAlias('anggi', 'Simalungun'))
    expect(resolveAlias('  Anggi ', 'Simalungun')).toEqual(resolveAlias('anggi', 'Simalungun'))
  })

  it('3. tanpa region bernilai null, tidak ada di map global', () => {
    expect(resolveAlias('anggi')).toBeNull()
    expect(Object.keys(KINSHIP_ALIASES)).not.toContain('anggi')
  })

  it('4. region non-Simalungun (Karo, Toba, Jawa) bernilai null', () => {
    expect(resolveAlias('anggi', 'Karo')).toBeNull()
    expect(resolveAlias('anggi', 'Toba')).toBeNull()
    expect(resolveAlias('anggi', 'Jawa')).toBeNull()
  })

  it('5. note memuat dua sumber eksternal: Wiktionary EN dan Kamus Simalungun-Indonesia 2015', () => {
    expectNoteContains('Simalungun', 'anggi', [
      'Wiktionary EN',
      'little brother or sister',
      'oldid 84794146',
    ])
    expectNoteContains('Simalungun', 'anggi', [
      'Kamus Bahasa Simalungun-Indonesia 2015',
      'Balai Bahasa Sumatra Utara',
    ])
  })

  it('6. note memuat penanda layer bahasa terpisah dan rujukan draft goal', () => {
    expectNoteContains('Simalungun', 'anggi', [
      'layer bahasa Simalungun terpisah',
      'gender-netral',
      'reports/draft-goal-v216i-stg-anggi-2026-10-03',
    ])
  })

  it('7. bentuk data valid: note non-kosong tanpa em dash dan tanpa dua minus', () => {
    const note = regionalNote('Simalungun', 'anggi')
    expect(note.length).toBeGreaterThan(0)
    expect(note).not.toContain('\u2014')
    expect(note).not.toContain('--')
  })

  it('8. negatif pengunci homonim: makna Indonesia (makanan berbumbu) dan Tagalog (air hujan) tidak dipetakan', () => {
    // Homonim lintas bahasa: anggi dalam bahasa Indonesia bermakna makanan berbumbu,
    // dalam Tagalog bermakna air hujan. Keduanya bukan kinship dan tidak jadi entri.
    // Hanya makna kinship Simalungun yang dipetakan, dan hanya sebagai sibling.
    const r = regionalEntry('Simalungun', 'anggi')
    expect(r.kind).toBe('sibling')
    expect(r.kind).not.toBe('pernikahan')
    expect(regionalNote('Simalungun', 'anggi')).not.toContain('air hujan')
    expect(regionalNote('Simalungun', 'anggi')).not.toContain('makanan berbumbu')
  })

  it('9. negatif pengunci layer: anggi tidak ada di Toba maupun Karo', () => {
    expect(Object.keys(KINSHIP_ALIASES_REGIONAL.Toba)).not.toContain('anggi')
    expect(Object.keys(KINSHIP_ALIASES_REGIONAL.Karo)).not.toContain('anggi')
  })

  it('10. non-regresi: boru, tulang, iboto Toba dan kaka Karo tetap resolved', () => {
    expect(resolveAlias('boru', 'Toba')?.kind).toBe('pernikahan')
    expect(resolveAlias('tulang', 'Toba')?.kind).toBe('parent-sibling')
    expect(resolveAlias('iboto', 'Toba')?.kind).toBe('sibling')
    expect(resolveAlias('kaka', 'Karo')).not.toBeNull()
  })

  it('11. guard region Simalungun: tepat dua key (abang, anggi), terurut', () => {
    const keys = Object.keys(KINSHIP_ALIASES_REGIONAL.Simalungun).sort()
    expect(keys).toHaveLength(2)
    expect(keys).toEqual(['abang', 'anggi'])
  })

  it('12. guard daftar region: Karo, Simalungun, Toba', () => {
    expect(Object.keys(KINSHIP_ALIASES_REGIONAL).sort()).toEqual(['Karo', 'Langkat', 'Simalungun', 'Toba']) // v252-ix bump: Langkat masuk)
  })

  it('13. idempoten: resolveAlias deterministik dan sama dengan entri map, qualifier undefined', () => {
    const a = resolveAlias('anggi', 'Simalungun')
    const b = resolveAlias('anggi', 'Simalungun')
    expect(a).toEqual(b)
    expect(b).toEqual(KINSHIP_ALIASES_REGIONAL.Simalungun['anggi'])
    expect(regionalEntry('Simalungun', 'anggi').qualifier).toBeUndefined()
  })
})
