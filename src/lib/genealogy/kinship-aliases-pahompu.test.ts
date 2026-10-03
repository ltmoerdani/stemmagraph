import { describe, expect, it } from 'vitest'
import { aliasKinds, resolveAlias, KINSHIP_ALIASES, KINSHIP_ALIASES_REGIONAL } from './kinship-aliases'
import { expectNoteContains, regionalEntry, regionalNote } from './__tests__/alias-entry'

describe('kinship-aliases pahompu Toba (v220-i, kind grandchild, cucu, dua sumber)', () => {
  it('1. positif: pahompu Toba kind grandchild, depth 2, region Toba', () => {
    const r = resolveAlias('pahompu', 'Toba')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('grandchild')
    expect(r?.depth).toBe(2)
    expect(r?.region).toBe('Toba')
  })

  it('2. normalisasi huruf besar dan spasi tepi menghasilkan entri yang sama', () => {
    expect(resolveAlias('PAHOMPU', 'Toba')).toEqual(resolveAlias('pahompu', 'Toba'))
    expect(resolveAlias('  Pahompu ', 'Toba')).toEqual(resolveAlias('pahompu', 'Toba'))
  })

  it('3. tanpa region pahompu tidak ada di peta global', () => {
    expect(resolveAlias('pahompu')).toBeNull()
    expect(Object.keys(KINSHIP_ALIASES)).not.toContain('pahompu')
  })

  it('4. negatif region lain: Karo, Simalungun, Jawa null, key tidak bocor', () => {
    expect(resolveAlias('pahompu', 'Karo')).toBeNull()
    expect(resolveAlias('pahompu', 'Simalungun')).toBeNull()
    expect(resolveAlias('pahompu', 'Jawa')).toBeNull()
    expect(Object.keys(KINSHIP_ALIASES_REGIONAL.Karo)).not.toContain('pahompu')
    expect(Object.keys(KINSHIP_ALIASES_REGIONAL.Simalungun)).not.toContain('pahompu')
  })

  it('5. note memuat dua sumber: bahasabataktoba cucu dan Wikikamus oldid 1327552', () => {
    expectNoteContains('Toba', 'pahompu', ['bahasabataktoba', 'cucu'])
    expectNoteContains('Toba', 'pahompu', ['Wikikamus', '1327552'])
  })

  it('6. note: DUA SUMBER, glosa cucu, penguat Pasaribu, nihil Tuuk dan KBBI dicatat jujur', () => {
    const note = regionalNote('Toba', 'pahompu')
    expect(note).toContain('DUA SUMBER')
    expect(note).toContain('cucu')
    expect(note).toContain('Pasaribu')
    expect(note).toContain('nihil')
    expect(note).toContain('grandchild')
  })

  it('7. note tidak memuat em dash maupun double hyphen', () => {
    const note = regionalNote('Toba', 'pahompu')
    expect(note.includes('\u2014')).toBe(false)
    expect(note.includes('--')).toBe(false)
  })

  it('8. negatif homonim dan bentuk mirip: pahompuh, hompu, ompu null di Toba dan global', () => {
    for (const k of ['pahompuh', 'hompu', 'ompu']) {
      expect(resolveAlias(k, 'Toba'), `Toba.${k}`).toBeNull()
      expect(resolveAlias(k), `global.${k}`).toBeNull()
    }
  })

  it('9. negatif arah: pahompu cucu, bukan anak langsung (butet child) dan bukan kakek nenek (ompung suhut grandparent)', () => {
    expect(resolveAlias('butet', 'Toba')?.kind).toBe('child')
    expect(resolveAlias('ompung suhut', 'Toba')?.kind).toBe('grandparent')
    expect(resolveAlias('pahompu', 'Toba')?.kind).toBe('grandchild')
    const note = regionalNote('Toba', 'pahompu')
    expect(note).toContain('bukan anak langsung')
    expect(note).toContain('bukan kakek nenek')
  })

  it('10. non-regresi Toba existing: kind 10 entri lama tidak berubah', () => {
    expect(resolveAlias('amangboru', 'Toba')?.kind).toBe('pernikahan')
    expect(resolveAlias('butet', 'Toba')?.kind).toBe('child')
    expect(resolveAlias('haha', 'Toba')?.kind).toBe('sibling')
    expect(resolveAlias('iboto', 'Toba')?.kind).toBe('sibling')
    expect(resolveAlias('lae', 'Toba')?.kind).toBe('sibling')
    expect(resolveAlias('namboru', 'Toba')?.kind).toBe('parent-sibling')
    expect(resolveAlias('pariban', 'Toba')?.kind).toBe('cousin')
    expect(resolveAlias('tulang', 'Toba')?.kind).toBe('parent-sibling')
    expect(resolveAlias('boru', 'Toba')?.kind).toBe('pernikahan')
    expect(resolveAlias('ompung suhut', 'Toba')?.kind).toBe('grandparent')
  })

  it('11. idempoten: key pahompu tepat satu, peta Toba unik, entri identik dengan isi peta', () => {
    const keys = Object.keys(KINSHIP_ALIASES_REGIONAL.Toba)
    expect(keys.filter((k) => k === 'pahompu')).toHaveLength(1)
    expect(new Set(keys).size).toBe(keys.length)
    expect(resolveAlias('pahompu', 'Toba')).toEqual(KINSHIP_ALIASES_REGIONAL.Toba['pahompu'])
    expect(regionalEntry('Toba', 'pahompu').kind).toBe('grandchild')
  })

  it('12. aliasKinds tidak bocor: key global terurut tidak memuat pahompu', () => {
    const keys = aliasKinds()
    expect(keys).toEqual(Object.keys(KINSHIP_ALIASES).sort())
    expect(keys).not.toContain('pahompu')
  })

  it('13. pengunci guard Toba: tepat 11 key terurut, pahompu di posisi alfabetis', () => {
    const keys = Object.keys(KINSHIP_ALIASES_REGIONAL.Toba)
    expect(keys).toHaveLength(11)
    expect([...keys].sort()).toEqual([
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

  it('14. non-regresi anggi dan abang Simalungun tetap sibling depth 1', () => {
    expect(resolveAlias('anggi', 'Simalungun')?.kind).toBe('sibling')
    expect(resolveAlias('abang', 'Simalungun')?.kind).toBe('sibling')
    expect(resolveAlias('anggi', 'Simalungun')?.depth).toBe(1)
    expect(resolveAlias('abang', 'Simalungun')?.depth).toBe(1)
  })
})
