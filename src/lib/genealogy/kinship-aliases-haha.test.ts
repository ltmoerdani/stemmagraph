import { describe, expect, it } from 'vitest'
import { aliasKinds, resolveAlias, KINSHIP_ALIASES, KINSHIP_ALIASES_REGIONAL } from './kinship-aliases'
import { expectNoteContains, regionalEntry, regionalNote } from './__tests__/alias-entry'

describe('kinship-aliases haha Toba (v219-i, kind sibling, kakak laki-laki, dua sumber)', () => {
  it('1. positif: haha Toba kind sibling, depth 1, region Toba', () => {
    const r = resolveAlias('haha', 'Toba')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('sibling')
    expect(r?.depth).toBe(1)
    expect(r?.region).toBe('Toba')
  })

  it('2. normalisasi huruf besar dan spasi tepi menghasilkan entri yang sama', () => {
    expect(resolveAlias('HAHA', 'Toba')).toEqual(resolveAlias('haha', 'Toba'))
    expect(resolveAlias('  Haha ', 'Toba')).toEqual(resolveAlias('haha', 'Toba'))
  })

  it('3. tanpa region haha tidak ada di peta global', () => {
    expect(resolveAlias('haha')).toBeNull()
    expect(Object.keys(KINSHIP_ALIASES)).not.toContain('haha')
  })

  it('4. negatif region lain: Karo, Simalungun, Jawa null, key tidak bocor', () => {
    expect(resolveAlias('haha', 'Karo')).toBeNull()
    expect(resolveAlias('haha', 'Simalungun')).toBeNull()
    expect(resolveAlias('haha', 'Jawa')).toBeNull()
    expect(Object.keys(KINSHIP_ALIASES_REGIONAL.Karo)).not.toContain('haha')
    expect(Object.keys(KINSHIP_ALIASES_REGIONAL.Simalungun)).not.toContain('haha')
  })

  it('5. note memuat dua sumber: Stap 1912 oudere broeder dan Vergouwen 1964 dahahang anggi', () => {
    expectNoteContains('Toba', 'haha', ['Stap 1912', 'Nederlandsch-Tobasche woordenlijst', 'oudere broeder'])
    expectNoteContains('Toba', 'haha', ['Vergouwen 1964', 'dahahang', 'anggi', 'the younger'])
  })

  it('6. note: DUA SUMBER, glosa kakak laki-laki, homonim tawa dicatat', () => {
    const note = regionalNote('Toba', 'haha')
    expect(note).toContain('DUA SUMBER')
    expect(note).toContain('kakak laki-laki')
    expect(note).toContain('elder brother')
    expect(note).toContain('tawa')
  })

  it('7. note tidak memuat karakter em dash maupun pengganti dua tanda minus', () => {
    const note = regionalNote('Toba', 'haha')
    expect(note.includes('\u2014')).toBe(false)
    expect(note.includes('--')).toBe(false)
  })

  it('8. negatif homonim tawa: hahaha dan tawa bukan entri Toba maupun global', () => {
    for (const k of ['hahaha', 'tawa', 'ha ha']) {
      expect(resolveAlias(k, 'Toba'), `Toba.${k}`).toBeNull()
      expect(resolveAlias(k), `global.${k}`).toBeNull()
    }
    expect(Object.keys(KINSHIP_ALIASES_REGIONAL.Toba)).not.toContain('hahaha')
  })

  it('9. negatif arah: haha kakak, bukan adik; anggi tidak ada di Toba dan tidak dipetakan ke haha', () => {
    expect(resolveAlias('anggi', 'Toba')).toBeNull()
    expect(Object.keys(KINSHIP_ALIASES_REGIONAL.Toba)).not.toContain('anggi')
    const note = regionalNote('Toba', 'haha')
    expect(note).toContain('kakak')
    expect(note).not.toContain('adik kandung')
    expect(note).not.toContain('little brother')
  })

  it('10. non-regresi anggi Simalungun: key tetap ada, sibling depth 1, region Simalungun', () => {
    expect(Object.keys(KINSHIP_ALIASES_REGIONAL.Simalungun)).toContain('anggi')
    const r = resolveAlias('anggi', 'Simalungun')
    expect(r?.kind).toBe('sibling')
    expect(r?.depth).toBe(1)
    expect(r?.region).toBe('Simalungun')
    expect(regionalNote('Simalungun', 'anggi')).toContain('little brother or sister')
  })

  it('11. non-regresi Toba existing: kind sembilan entri lama tidak berubah', () => {
    expect(resolveAlias('namboru', 'Toba')?.kind).toBe('parent-sibling')
    expect(resolveAlias('lae', 'Toba')?.kind).toBe('sibling')
    expect(resolveAlias('pariban', 'Toba')?.kind).toBe('cousin')
    expect(resolveAlias('tulang', 'Toba')?.kind).toBe('parent-sibling')
    expect(resolveAlias('boru', 'Toba')?.kind).toBe('pernikahan')
    expect(resolveAlias('ompung suhut', 'Toba')?.kind).toBe('grandparent')
    expect(resolveAlias('iboto', 'Toba')?.kind).toBe('sibling')
    expect(resolveAlias('amangboru', 'Toba')?.kind).toBe('pernikahan')
    expect(resolveAlias('butet', 'Toba')?.kind).toBe('child')
  })

  it('12. idempoten: key haha tepat satu, dua panggilan sama, sama dengan isi peta Toba', () => {
    const keys = Object.keys(KINSHIP_ALIASES_REGIONAL.Toba)
    expect(keys.filter((k) => k === 'haha')).toHaveLength(1)
    expect(new Set(keys).size).toBe(keys.length)
    expect(resolveAlias('haha', 'Toba')).toEqual(resolveAlias('haha', 'Toba'))
    expect(resolveAlias('haha', 'Toba')).toEqual(KINSHIP_ALIASES_REGIONAL.Toba['haha'])
    expect(regionalEntry('Toba', 'haha').kind).toBe('sibling')
  })

  it('13. aliasKinds tidak bocor: key global terurut tidak memuat haha', () => {
    const keys = aliasKinds()
    expect(keys).toEqual(Object.keys(KINSHIP_ALIASES).sort())
    expect(keys).not.toContain('haha')
  })

  it('14. pengunci guard Toba: tepat sepuluh key terurut, haha di posisi alfabetis', () => {
    const keys = Object.keys(KINSHIP_ALIASES_REGIONAL.Toba)
    expect(keys).toHaveLength(12) // v221-i bump: dongan sa- masuk // v220-i bump: pahompu masuk
    expect([...keys].sort()).toEqual([
      'amangboru',
      'boru',
      'butet',
      'dongan sa-',
      'haha',
      'iboto',
      'lae',
      'namboru',
      'ompung suhut',
      'pahompu',
      'pariban',
      'tulang',
    ])
  })
})
