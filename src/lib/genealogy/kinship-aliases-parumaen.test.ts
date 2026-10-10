import { describe, expect, it } from 'vitest'
import { resolveAlias, KINSHIP_ALIASES_REGIONAL } from './kinship-aliases'
import { expectNoteContains, regionalNote } from './__tests__/alias-entry'

describe('kinship-aliases parumaen Toba (v253-v, kind property, KBBI VI plus Wikipedia Partuturan Toba)', () => {
  it('1. resolveAlias parumaen region Toba live, kind property', () => {
    const r = resolveAlias('parumaen', 'Toba')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('property')
  })

  it('2. resolveAlias parumaen region Toba depth 1', () => {
    expect(resolveAlias('parumaen', 'Toba')?.depth).toBe(1)
  })

  it('3. resolveAlias parumaen region Toba region Toba', () => {
    expect(resolveAlias('parumaen', 'Toba')?.region).toBe('Toba')
  })

  it('4. guard non-regresi tetangga: pariban cousin, tulang parent-sibling, boru pernikahan', () => {
    expect(resolveAlias('pariban', 'Toba')?.kind).toBe('cousin')
    expect(resolveAlias('tulang', 'Toba')?.kind).toBe('parent-sibling')
    expect(resolveAlias('boru', 'Toba')?.kind).toBe('pernikahan')
  })

  it('5. jumlah key Toba tepat 15', () => {
    expect(Object.keys(KINSHIP_ALIASES_REGIONAL.Toba)).toHaveLength(15)
  })

  it('6. daftar key Toba urut 15 termasuk pariban lalu parumaen lalu tulang', () => {
    expect(Object.keys(KINSHIP_ALIASES_REGIONAL.Toba).sort()).toEqual([
      'amangboru',
      'boru',
      'butet',
      'dongan sa-',
      'haha',
      'hula-hula',
      'iboto',
      'lae',
      'namboru',
      'ompung suhut',
      'opung',
      'pahompu',
      'pariban',
      'parumaen',
      'tulang',
    ])
  })

  it('7. urutan raw blok Toba: pariban sebelum parumaen sebelum tulang', () => {
    const keys = Object.keys(KINSHIP_ALIASES_REGIONAL.Toba)
    expect(keys.indexOf('pariban')).toBeLessThan(keys.indexOf('parumaen'))
    expect(keys.indexOf('parumaen')).toBeLessThan(keys.indexOf('tulang'))
  })

  it('8. paruma standalone tetap null', () => {
    expect(resolveAlias('paruma', 'Toba')).toBeNull()
    expect(resolveAlias('paruma')).toBeNull()
  })

  it('9. note memuat sumber 1: KBBI VI entri parumaen glosa menantu perempuan', () => {
    expectNoteContains('Toba', 'parumaen', ['kbbi.kemendikdasmen.go.id/entri/parumaen', 'menantu perempuan'])
  })

  it('10. note memuat sumber 2: Wikipedia ID Partuturan Toba oldid 28958723', () => {
    expectNoteContains('Toba', 'parumaen', ['Partuturan Toba', '28958723'])
  })

  it('11. note memuat resiprokal kategori pemberian istri', () => {
    expectNoteContains('Toba', 'parumaen', ['pemberian istri'])
  })

  it('12. note tidak memuat em dash maupun dua tanda minus', () => {
    const note = regionalNote('Toba', 'parumaen')
    expect(note.includes('\u2014')).toBe(false)
    expect(note.includes('--')).toBe(false)
  })

  it('13. nihil key duplikat di objek Toba, parumaen tepat satu', () => {
    const keys = Object.keys(KINSHIP_ALIASES_REGIONAL.Toba)
    expect(new Set(keys).size).toBe(keys.length)
    expect(keys.filter((k) => k === 'parumaen').length).toBe(1)
  })
})
