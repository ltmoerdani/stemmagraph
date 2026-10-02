import { describe, expect, it } from 'vitest'
import { resolveAlias, KINSHIP_ALIASES_REGIONAL } from './kinship-aliases'
import { expectNoteContains, regionalNote } from './__tests__/alias-entry'

describe('kinship-aliases iboto Toba (v210-i, cross-sibling, enam sumber)', () => {
  it('1. resolveAlias iboto region Toba kembalikan sibling depth 1 region Toba', () => {
    const r = resolveAlias('iboto', 'Toba')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('sibling')
    expect(r?.depth).toBe(1)
    expect(r?.region).toBe('Toba')
  })

  it('2. note memuat sumber kunci: Wiktionary oldid, kamusbatak, Meerwaldt, Vergouwen, Holle, Dammerboer', () => {
    expectNoteContains('Toba', 'iboto', [
      '91176215',
      'kamusbatak',
      'Meerwaldt',
      'Vergouwen',
      'Holle',
      'Dammerboer',
    ])
  })

  it('3. note menyebut ENAM SUMBER dan makna cross-sibling', () => {
    const note = regionalNote('Toba', 'iboto')
    expect(note).toContain('ENAM SUMBER')
    expect(note).toContain('cross-sibling')
  })

  it('4. negatif pengunci komposit dan bentuk lain: ito, itong, tanpa region bernilai null', () => {
    expect(resolveAlias('ito', 'Toba')).toBeNull()
    expect(resolveAlias('itong', 'Toba')).toBeNull()
    expect(resolveAlias('iboto')).toBeNull()
  })

  it('5. homonim: region Karo null, uppercase sama dengan lowercase', () => {
    expect(resolveAlias('iboto', 'Karo')).toBeNull()
    expect(resolveAlias('IBOTO', 'Toba')).toEqual(resolveAlias('iboto', 'Toba'))
    expect(resolveAlias('IBOTO', 'Toba')).not.toBeNull()
  })

  it('6. guard Toba berisi tepat 6 key terurut (v212-i bump, namboru add-only)', () => {
    expect(Object.keys(KINSHIP_ALIASES_REGIONAL.Toba).sort()).toEqual([
      'amangboru',
      'butet',
      'iboto',
      'lae',
      'namboru',
      'ompung suhut',
      'pariban',
    ])
  })

  it('7. non-duplikat struktural: key iboto tepat satu di blok Toba', () => {
    const keys = Object.keys(KINSHIP_ALIASES_REGIONAL.Toba)
    expect(keys.filter((k) => k === 'iboto').length).toBe(1)
  })

  it('8. non-regresi: butet child, pariban cousin, ompung suhut grandparent, eda Karo sibling', () => {
    expect(resolveAlias('butet', 'Toba')?.kind).toBe('child')
    expect(resolveAlias('pariban', 'Toba')?.kind).toBe('cousin')
    expect(resolveAlias('ompung suhut', 'Toba')?.kind).toBe('grandparent')
    expect(resolveAlias('eda', 'Karo')?.kind).toBe('sibling')
  })

  it('9. negatif pengunci Karo: iboto, suhut, bao, kalin bernilai null', () => {
    for (const k of ['iboto', 'suhut', 'bao', 'kalin']) {
      expect(resolveAlias(k, 'Karo'), `Karo.${k}`).toBeNull()
    }
  })

  it('10. negatif pengunci alias nasional: iboto nihil di KINSHIP_ALIASES global', () => {
    expect(resolveAlias('iboto', 'Sunda')).toBeNull()
    expect(resolveAlias('iboto', 'Jawa')).toBeNull()
  })

  it('11. bentuk data valid: note non-kosong tanpa em dash dan tanpa dua minus', () => {
    const note = regionalNote('Toba', 'iboto')
    expect(note.length).toBeGreaterThan(0)
    expect(note).not.toContain('—')
    expect(note).not.toContain('--')
  })

  it('12. idempoten: dua panggilan sama, sama dengan map regional, key Toba tanpa duplikat', () => {
    const a = resolveAlias('iboto', 'Toba')
    const b = resolveAlias('iboto', 'Toba')
    expect(a).toEqual(b)
    expect(b).toEqual(KINSHIP_ALIASES_REGIONAL.Toba['iboto'])
    const keys = Object.keys(KINSHIP_ALIASES_REGIONAL.Toba)
    expect(new Set(keys).size).toBe(keys.length)
    expect(keys).toHaveLength(6) // v212-i bump: namboru masuk
  })

  it('13. kind sibling anggota sah union: label id saudara, en sibling', async () => {
    const { KINSHIP_LABELS } = await import('./kinship-labels')
    expect(KINSHIP_LABELS['sibling'].id).toBe('saudara')
    expect(KINSHIP_LABELS['sibling'].en).toBe('sibling')
  })

  it('14. aliasKinds tidak berubah: map regional tidak bocor ke alias global', () => {
    const kinds = Object.keys(KINSHIP_ALIASES_REGIONAL)
    expect(kinds.sort()).toEqual(['Karo', 'Toba'])
  })
})
