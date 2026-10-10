import { describe, expect, it } from 'vitest'
import { resolveAlias, KINSHIP_ALIASES, KINSHIP_ALIASES_REGIONAL } from './kinship-aliases'
import { expectNoteContains, regionalEntry, regionalNote } from './__tests__/alias-entry'

describe('kinship-aliases boru Toba (v215-i, kind pernikahan, anak boru, kelompok penerima istri, tiga sumber)', () => {
  it('1. positif: boru Toba kind pernikahan, depth 1, region Toba', () => {
    const r = resolveAlias('boru', 'Toba')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('pernikahan')
    expect(r?.depth).toBe(1)
    expect(r?.region).toBe('Toba')
  })

  it('2. case-insensitive dan trim: BORU dan "  Boru " sama dengan boru', () => {
    expect(resolveAlias('BORU', 'Toba')).toEqual(resolveAlias('boru', 'Toba'))
    expect(resolveAlias('  Boru ', 'Toba')).toEqual(resolveAlias('boru', 'Toba'))
  })

  it('3. tanpa region bernilai null, tidak ada di map global', () => {
    expect(resolveAlias('boru')).toBeNull()
    expect(Object.keys(KINSHIP_ALIASES)).not.toContain('boru')
  })

  it('4. region non-Toba (Karo, Jawa) bernilai null', () => {
    expect(resolveAlias('boru', 'Karo')).toBeNull()
    expect(resolveAlias('boru', 'Jawa')).toBeNull()
    expect(Object.keys(KINSHIP_ALIASES_REGIONAL.Karo)).not.toContain('boru')
  })

  it('5. note memuat tiga sumber eksternal beserta lema pendukungnya', () => {
    expectNoteContains('Toba', 'boru', [
      'Vergouwen 1964',
      'anak boru',
      'boru parsadaan',
      'boru sihabolonan',
      'boru gomgoman',
    ])
    expectNoteContains('Toba', 'boru', ['Bruner 1974', 'in-marrying boru families'])
    expectNoteContains('Toba', 'boru', ['Barbier-Mueller 2011', 'Boru X'])
  })

  it('6. note memuat rujukan kamus Tuuk vol 2 dan glosa dochter, schoonzuster tanpa enum terpisah', () => {
    expectNoteContains('Toba', 'boru', [
      'van der Tuuk 1861',
      'vol 2',
      'dochter',
      'bruid',
      'schoonzuster',
      'namora',
      'notes/504',
      'notes/505',
    ])
    expectNoteContains('Toba', 'boru', ['wife-takers', 'affinal'])
    expect(regionalEntry('Toba', 'boru').kind).toBe('pernikahan')
  })

  it('7. bentuk data valid: note non-kosong tanpa em dash dan tanpa dua minus', () => {
    const note = regionalNote('Toba', 'boru')
    expect(note.length).toBeGreaterThan(0)
    expect(note).not.toContain('\u2014')
    expect(note).not.toContain('--')
  })

  it('8. non-regresi: tulang Toba tetap parent-sibling depth 1', () => {
    const r = resolveAlias('tulang', 'Toba')
    expect(r?.kind).toBe('parent-sibling')
    expect(r?.depth).toBe(1)
  })

  it('9. non-regresi: amangboru Toba pernikahan, lemirat Karo pernikahan, eda Karo sibling', () => {
    expect(resolveAlias('amangboru', 'Toba')?.kind).toBe('pernikahan')
    expect(resolveAlias('lemirat', 'Karo')?.kind).toBe('pernikahan')
    expect(resolveAlias('eda', 'Karo')?.kind).toBe('sibling')
  })

  it('10. negatif pengunci: tongah, samangat, dongan tetap null di Toba', () => {
    for (const k of ['tongah', 'samangat', 'dongan']) {
      expect(resolveAlias(k, 'Toba'), `Toba.${k}`).toBeNull()
    }
  })

  it('11. guard Toba: tepat sepuluh key terurut, toHaveLength 10 dan toEqual array', () => {
    const keys = Object.keys(KINSHIP_ALIASES_REGIONAL.Toba)
    expect(keys).toHaveLength(14) // v221-i bump: dongan sa- masuk // v220-i bump: pahompu masuk
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
      'tulang',
    ])
  })

  it('12. idempoten: key boru tepat satu, resolveAlias deterministik, qualifier undefined', () => {
    const keys = Object.keys(KINSHIP_ALIASES_REGIONAL.Toba)
    expect(keys.filter((k) => k === 'boru')).toHaveLength(1)
    expect(new Set(keys).size).toBe(keys.length)
    const a = resolveAlias('boru', 'Toba')
    const b = resolveAlias('boru', 'Toba')
    expect(a).toEqual(b)
    expect(b).toEqual(KINSHIP_ALIASES_REGIONAL.Toba['boru'])
    expect(regionalEntry('Toba', 'boru').qualifier).toBeUndefined()
  })

  it('13. urutan sisip: boru berada tepat setelah tulang di blok Toba', () => {
    const keys = Object.keys(KINSHIP_ALIASES_REGIONAL.Toba)
    expect(keys.indexOf('boru')).toBe(keys.indexOf('tulang') + 1)
  })
})
