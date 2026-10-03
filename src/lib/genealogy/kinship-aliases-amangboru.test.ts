import { describe, expect, it } from 'vitest'
import { resolveAlias, KINSHIP_ALIASES_REGIONAL } from './kinship-aliases'
import { expectNoteContains, regionalEntry, regionalNote } from './__tests__/alias-entry'

describe('kinship-aliases amangboru Toba (v209-i, kind pernikahan, FBH, simpul affinal satu pernikahan)', () => {
  it('1. positif: resolveAlias amangboru region Toba kind pernikahan, depth 1, region Toba', () => {
    const r = resolveAlias('amangboru', 'Toba')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('pernikahan')
    expect(r?.depth).toBe(1)
    expect(r?.region).toBe('Toba')
  })

  it('2. case-insensitive: AMANGBORU sama dengan amangboru', () => {
    expect(resolveAlias('AMANGBORU', 'Toba')).not.toBeNull()
    expect(resolveAlias('AMANGBORU', 'Toba')).toEqual(resolveAlias('amangboru', 'Toba'))
  })

  it('3. entri ada di KINSHIP_ALIASES_REGIONAL.Toba dan sama dengan hasil resolveAlias', () => {
    expect(Object.keys(KINSHIP_ALIASES_REGIONAL.Toba)).toContain('amangboru')
    expect(resolveAlias('amangboru', 'Toba')).toEqual(KINSHIP_ALIASES_REGIONAL.Toba['amangboru'])
  })

  it('4. note memuat Bruner 1974 dan DOI Nainggolan 2014', () => {
    expectNoteContains('Toba', 'amangboru', ['Bruner 1974', '10.7603/s40742-014-0003-9'])
  })

  it('5. note memuat glosa FBH dan simpul affinal satu pernikahan', () => {
    expectNoteContains('Toba', 'amangboru', [
      'father sister husband',
      'FBH',
      'affinal',
      'satu pernikahan',
    ])
  })

  it('6. note memuat tujuh sumber: Tuuk, Bruner, Iwabuchi, Bibliografi, Barbier-Muller, Nainggolan, detikcom', () => {
    expectNoteContains('Toba', 'amangboru', [
      'Tuuk 1861',
      'h631',
      'Bruner 1974',
      'h38',
      'Iwabuchi 1994',
      'h320',
      'Bibliografi 1974',
      'h506',
      'Barbier-Muller 2002',
      'h382',
      'Nainggolan 2014',
      'GSTF Journal on Education',
      'detikcom 14 Jun 2023',
    ])
  })

  it('7. nihil di blok Karo: resolveAlias null dan key tidak ada', () => {
    expect(resolveAlias('amangboru', 'Karo')).toBeNull()
    expect(Object.keys(KINSHIP_ALIASES_REGIONAL.Karo)).not.toContain('amangboru')
  })

  it('8. tanpa region bernilai null: amangboru hanya di map regional Toba', () => {
    expect(resolveAlias('amangboru')).toBeNull()
  })

  it('9. non-regresi: butet child, pariban cousin, ompung suhut grandparent, lemirat Karo pernikahan', () => {
    expect(resolveAlias('butet', 'Toba')?.kind).toBe('child')
    expect(resolveAlias('pariban', 'Toba')?.kind).toBe('cousin')
    expect(resolveAlias('ompung suhut', 'Toba')?.kind).toBe('grandparent')
    expect(resolveAlias('lemirat', 'Karo')?.kind).toBe('pernikahan')
  })

  it('10. kind pernikahan anggota sah union KinshipKind dan label terdaftar', async () => {
    const labels = await import('./kinship-labels')
    expect(Object.keys(labels.KINSHIP_LABELS)).toContain('pernikahan')
    expect(labels.KINSHIP_LABELS['pernikahan'].en).toBe('affinal relation')
  })

  it('11. bentuk data valid: note non-kosong tanpa em dash dan tanpa dua minus', () => {
    const note = regionalNote('Toba', 'amangboru')
    expect(note.length).toBeGreaterThan(0)
    expect(note).not.toContain('\u2014')
    expect(note).not.toContain('--')
  })

  it('12. guard Toba berisi tepat 6 key terurut (v212-i bump, namboru add-only)', () => {
    expect(Object.keys(KINSHIP_ALIASES_REGIONAL.Toba).sort()).toEqual([
      'amangboru',
      'boru',
      'butet',
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

  it('13. idempoten: key amangboru tepat satu, dua panggilan sama, entri tidak punya qualifier', () => {
    const keys = Object.keys(KINSHIP_ALIASES_REGIONAL.Toba)
    expect(keys.filter((k) => k === 'amangboru')).toHaveLength(1)
    expect(new Set(keys).size).toBe(keys.length)
    expect(resolveAlias('amangboru', 'Toba')).toEqual(resolveAlias('amangboru', 'Toba'))
    expect(regionalEntry('Toba', 'amangboru').qualifier).toBeUndefined()
  })

  it('14. negatif pengunci: istilah dekat (amang) tidak ikut terdaftar di Toba (v214-i: tulang, v215-i: boru keluar dari daftar negatif karena kini terdaftar)', () => {
    for (const k of ['amang']) {
      expect(resolveAlias(k, 'Toba'), `Toba.${k}`).toBeNull()
    }
  })
})
