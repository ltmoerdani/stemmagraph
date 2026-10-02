import { describe, expect, it } from 'vitest'
import { aliasKinds, resolveAlias, KINSHIP_ALIASES, KINSHIP_ALIASES_REGIONAL } from './kinship-aliases'
import { expectNoteContains, regionalEntry, regionalNote } from './__tests__/alias-entry'

describe('kinship-aliases lae Toba (v213-i, kind sibling, ipar laki-laki, dua sumber)', () => {
  it('1. resolveAlias lae region Toba kembalikan kind sibling', () => {
    const r = resolveAlias('lae', 'Toba')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('sibling')
  })

  it('2. resolveAlias lae region Toba depth 1', () => {
    expect(resolveAlias('lae', 'Toba')?.depth).toBe(1)
  })

  it('3. resolveAlias lae region Toba berregion Toba', () => {
    expect(resolveAlias('lae', 'Toba')?.region).toBe('Toba')
  })

  it('4. normalisasi: LAE huruf besar sama dengan lae', () => {
    expect(resolveAlias('LAE', 'Toba')).toEqual(resolveAlias('lae', 'Toba'))
    expect(resolveAlias('LAE', 'Toba')).not.toBeNull()
  })

  it('5. lae tanpa region bernilai null: hanya ada di map regional Toba', () => {
    expect(resolveAlias('lae')).toBeNull()
    expect(Object.keys(KINSHIP_ALIASES)).not.toContain('lae')
  })

  it('6. lae region non-Toba (Karo, Jawa) bernilai null', () => {
    expect(resolveAlias('lae', 'Karo')).toBeNull()
    expect(resolveAlias('lae', 'Jawa')).toBeNull()
    expect(Object.keys(KINSHIP_ALIASES_REGIONAL.Karo)).not.toContain('lae')
  })

  it('7. note memuat jejak sumber 1: kamusbatak lae.html glosa ipar', () => {
    expectNoteContains('Toba', 'lae', ['kamusbatak', 'lae.html', 'ipar', 'akses 3 Okt 2026'])
  })

  it('8. note memuat jejak sumber 2: Meerwaldt 1904 baris 8029 glosa zwager', () => {
    expectNoteContains('Toba', 'lae', ['Meerwaldt 1904', 'baris 8029', 'zwager', 'brother-in-law'])
  })

  it('9. note menyebut dua sumber dan referensi evidence notes', () => {
    expectNoteContains('Toba', 'lae', ['DUA SUMBER', 'notes/2026-10-03-evidence-tuuk-vol2-seg5-10-namboru-lae-tulang-ngelingkah.md'])
  })

  it('10. note tidak memuat karakter em dash maupun pengganti dua tanda minus', () => {
    const note = regionalNote('Toba', 'lae')
    expect(note.includes('\u2014')).toBe(false)
    expect(note.includes('--')).toBe(false)
  })

  it('11. pengunci homonim anatomi: lae Toba bukan tulang, note tidak mengklaim makna anatomi dan alias holi nihil', () => {
    const note = regionalNote('Toba', 'lae')
    expect(note.toLowerCase()).not.toContain('anatomi')
    expect(note.toLowerCase()).not.toContain('tulang')
    expect(resolveAlias('holi', 'Toba')).toBeNull()
    expect(resolveAlias('holi')).toBeNull()
    expect(regionalEntry('Toba', 'lae').kind).not.toBe('parent-sibling')
  })

  it('12. non-regresi alias affine existing: eda Karo sibling dan pariban Toba cousin tetap', () => {
    expect(resolveAlias('eda', 'Karo')?.kind).toBe('sibling')
    expect(resolveAlias('eda', 'Karo')?.depth).toBe(1)
    expect(resolveAlias('pariban', 'Toba')?.kind).toBe('cousin')
    expect(resolveAlias('pariban', 'Toba')?.depth).toBe(1)
  })

  it('13. non-regresi tetangga Toba: amangboru, butet, namboru, iboto, ompung suhut tetap dengan kind semula', () => {
    expect(resolveAlias('amangboru', 'Toba')?.kind).toBe('pernikahan')
    expect(resolveAlias('butet', 'Toba')?.kind).toBe('child')
    expect(resolveAlias('namboru', 'Toba')?.kind).toBe('parent-sibling')
    expect(resolveAlias('iboto', 'Toba')?.kind).toBe('sibling')
    expect(resolveAlias('ompung suhut', 'Toba')?.kind).toBe('grandparent')
  })

  it('14. idempoten: key lae tepat satu, dua panggilan sama, aliasKinds memuat sibling', () => {
    const keys = Object.keys(KINSHIP_ALIASES_REGIONAL.Toba)
    expect(keys.filter((k) => k === 'lae')).toHaveLength(1)
    expect(resolveAlias('lae', 'Toba')).toEqual(resolveAlias('lae', 'Toba'))
    expect(resolveAlias('lae', 'Toba')).toEqual(KINSHIP_ALIASES_REGIONAL.Toba['lae'])
    expect(aliasKinds()).toContain('sibling')
  })

  it('15. pengunci guard Toba: tepat tujuh key terurut setelah penyisipan lae', () => {
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
})
