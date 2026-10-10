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

  it('7. note memuat jejak sumber 1: kamusbatak glosa ipar (v253-i)', () => {
    expectNoteContains('Toba', 'lae', ['kamusbatak', 'glosa ipar', 'sumber 1'])
  })

  it('8. note memuat jejak sumber 3: Meerwaldt 1904 entri Lae zwager IA leaf 176 (v253-i)', () => {
    expectNoteContains('Toba', 'lae', ['Meerwaldt 1904', 'entri Lae zwager', 'IA batakschetaal00jhme leaf 176', 'akses 9 Okt 2026'])
  })

  it('9. note menyebut sumber 2 tersier Wiktionary EN oldid per 8 Okt 2026 (v253-i)', () => {
    expectNoteContains('Toba', 'lae', ['Wiktionary EN oldid 92350735', 'sumber 2 tersier per 8 Okt 2026'])
  })

  it('10. note tidak memuat karakter em dash maupun pengganti dua tanda minus', () => {
    const note = regionalNote('Toba', 'lae')
    expect(note.includes('\u2014')).toBe(false)
    expect(note.includes('--')).toBe(false)
  })

  it('11. pengunci homonim anatomi: lae Toba bukan tulang, note tidak mengklaim makna anatomi dan alias holi nihil', () => {
    const note = regionalNote('Toba', 'lae')
    expect(note.toLowerCase()).not.toContain('anatomi')
    const noteTanpaRujukan = note.replace(/notes\/\S+\.md/, '')
    expect(noteTanpaRujukan.toLowerCase()).not.toContain('tulang')
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
    expect(aliasKinds()).toBeDefined()
    expect(regionalEntry('Toba', 'lae').kind).toBe('sibling')
  })

  it('15. pengunci guard Toba: tepat sembilan key terurut setelah penyisipan boru', () => {
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
      'tulang',
    ])
  })

  it('16. v253-i dual-source makna inti: KBBI VI makna 1 sejalan Wiktionary EN mengutip Warneck 1906 hal. 108', () => {
    expectNoteContains('Toba', 'lae', ['Dual-source makna inti', 'KBBI VI makna 1', 'suami dari saudara perempuan, saudara laki-laki istri, konteks Batak', "wife's brother or sister's husband", 'Warneck 1906 hal. 108'])
  })

  it('17. v253-i pembatas register sapaan klan lain dipakai penutur laki-laki, kind depth region tetap (v253-i)', () => {
    expectNoteContains('Toba', 'lae', ['pembatas register', 'klan lain', 'used by male speakers', 'tanpa mengubah kind maupun enum'])
    expect(regionalEntry('Toba', 'lae').kind).toBe('sibling')
    expect(regionalEntry('Toba', 'lae').depth).toBe(1)
    expect(regionalEntry('Toba', 'lae').region).toBe('Toba')
  })

  it("18. v253-i status primer Warneck dicatat jujur: tidak terverifikasi langsung, resolver KB Den Haag gagal diakses", () => {
    expectNoteContains('Toba', 'lae', ['primer Warneck p. 108', '[tidak terverifikasi langsung, resolver KB Den Haag gagal diakses]'])
  })
})
