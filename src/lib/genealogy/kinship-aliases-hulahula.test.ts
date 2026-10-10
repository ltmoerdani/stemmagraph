import { describe, expect, it } from 'vitest'
import { aliasKinds, resolveAlias, KINSHIP_ALIASES, KINSHIP_ALIASES_REGIONAL } from './kinship-aliases'
import { expectNoteContains, regionalEntry, regionalNote } from './__tests__/alias-entry'

describe('kinship-aliases hula-hula Toba (v253-iv, kind pernikahan, wife-givers, dual-source-plus)', () => {
  it('1. positif: hula-hula Toba kind pernikahan, depth 1, region Toba', () => {
    const r = resolveAlias('hula-hula', 'Toba')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('pernikahan')
    expect(r?.depth).toBe(1)
    expect(r?.region).toBe('Toba')
  })

  it('2. normalisasi huruf besar dan spasi tepi menghasilkan entri yang sama', () => {
    expect(resolveAlias('HULA-HULA', 'Toba')).toEqual(resolveAlias('hula-hula', 'Toba'))
    expect(resolveAlias('  Hula-Hula ', 'Toba')).toEqual(resolveAlias('hula-hula', 'Toba'))
  })

  it('3. tanpa region hula-hula tidak ada di peta global', () => {
    expect(resolveAlias('hula-hula')).toBeNull()
    expect(Object.keys(KINSHIP_ALIASES)).not.toContain('hula-hula')
  })

  it('4. negatif region lain: Karo, Langkat, Simalungun, Jawa null, key tidak bocor', () => {
    expect(resolveAlias('hula-hula', 'Karo')).toBeNull()
    expect(resolveAlias('hula-hula', 'Langkat')).toBeNull()
    expect(resolveAlias('hula-hula', 'Simalungun')).toBeNull()
    expect(resolveAlias('hula-hula', 'Jawa')).toBeNull()
    expect(Object.keys(KINSHIP_ALIASES_REGIONAL.Karo)).not.toContain('hula-hula')
    expect(Object.keys(KINSHIP_ALIASES_REGIONAL.Simalungun)).not.toContain('hula-hula')
  })

  it('5. note memuat tiga sumber: KBBI VI pemberi gadis, WP Pernikahan adat Batak oldid, WP Dalihan Na Tolu oldid', () => {
    expectNoteContains('Toba', 'hula-hula', ['kbbi.kemendikdasmen.go.id/entri/hula-hula', 'pemberi gadis'])
    expectNoteContains('Toba', 'hula-hula', ['oldid 29331041', 'pihak pemberi istri'])
    expectNoteContains('Toba', 'hula-hula', ['oldid 28663463', 'somba marhulahula'])
  })

  it('6. note: Vergouwen 1964 penguat, pasangan kategori boru, varian hulahula tanpa strip tidak dijadikan key', () => {
    const note = regionalNote('Toba', 'hula-hula')
    expect(note).toContain('Vergouwen 1964')
    expect(note).toContain('boru')
    expect(note).toContain('wife-givers')
    expect(note).toContain('hulahula')
  })

  it('7. note tidak memuat karakter em dash maupun pengganti dua tanda minus', () => {
    const note = regionalNote('Toba', 'hula-hula')
    expect(note.includes('\u2014')).toBe(false)
    expect(note.includes('--')).toBe(false)
  })

  it('8. guard homonim tarian: hula-hula2 tarian Hawaii tidak dipetakan, varian tanpa strip null', () => {
    expect(resolveAlias('hula-hula2', 'Toba')).toBeNull()
    expect(resolveAlias('hula-hula 2', 'Toba')).toBeNull()
    expect(resolveAlias('hulahula', 'Toba')).toBeNull()
    expect(resolveAlias('hula', 'Toba')).toBeNull()
    expect(Object.keys(KINSHIP_ALIASES_REGIONAL.Toba)).not.toContain('hulahula')
    expect(regionalNote('Toba', 'hula-hula')).toContain('tarian Hawaii')
  })

  it('9. guard pasangan kategori: boru tetap pernikahan non-regresi, keduanya terpisah', () => {
    const boru = resolveAlias('boru', 'Toba')
    expect(boru?.kind).toBe('pernikahan')
    expect(boru).not.toEqual(resolveAlias('hula-hula', 'Toba'))
    expect(regionalNote('Toba', 'boru')).toContain('hula-hula')
  })

  it('10. pengunci guard Toba: tepat 14 key terurut, hula-hula antara haha dan iboto', () => {
    const keys = Object.keys(KINSHIP_ALIASES_REGIONAL.Toba)
    expect(keys).toHaveLength(15) // v253-v bump: parumaen masuk // v253-iv bump: hula-hula masuk // v253-iii bump: opung masuk
    expect([...keys].sort()).toEqual([
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
    expect(keys.filter((k) => k === 'hula-hula')).toHaveLength(1)
    expect(new Set(keys).size).toBe(keys.length)
    expect(regionalEntry('Toba', 'hula-hula').kind).toBe('pernikahan')
  })

  it('11. non-regresi tetangga Toba: butet child, pariban cousin, tulang parent-sibling; aliasKinds tidak bocor', () => {
    expect(resolveAlias('butet', 'Toba')?.kind).toBe('child')
    expect(resolveAlias('pariban', 'Toba')?.kind).toBe('cousin')
    expect(resolveAlias('tulang', 'Toba')?.kind).toBe('parent-sibling')
    const keys = aliasKinds()
    expect(keys).toEqual(Object.keys(KINSHIP_ALIASES).sort())
    expect(keys).not.toContain('hula-hula')
  })
})
