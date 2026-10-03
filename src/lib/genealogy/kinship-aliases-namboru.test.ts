import { describe, expect, it } from 'vitest'
import { aliasKinds, resolveAlias, KINSHIP_ALIASES_REGIONAL } from './kinship-aliases'
import { expectNoteContains, regionalNote } from './__tests__/alias-entry'

describe('kinship-aliases namboru Toba (v212-i, kind parent-sibling, empat sumber)', () => {
  it('1. resolveAlias namboru region Toba kembalikan kind parent-sibling', () => {
    const r = resolveAlias('namboru', 'Toba')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('parent-sibling')
  })

  it('2. resolveAlias namboru region Toba depth 1', () => {
    expect(resolveAlias('namboru', 'Toba')?.depth).toBe(1)
  })

  it('3. resolveAlias namboru region Toba berregion Toba', () => {
    expect(resolveAlias('namboru', 'Toba')?.region).toBe('Toba')
  })

  it('4. homonim: NAMBORU huruf besar sama dengan namboru (normalisasi lowercase)', () => {
    expect(resolveAlias('NAMBORU', 'Toba')).toEqual(resolveAlias('namboru', 'Toba'))
    expect(resolveAlias('NAMBORU', 'Toba')).not.toBeNull()
  })

  it('5. namboru tanpa region bernilai null: hanya ada di map regional Toba', () => {
    expect(resolveAlias('namboru')).toBeNull()
  })

  it('6. namboru region non-Toba (Karo, Jawa) bernilai null', () => {
    expect(resolveAlias('namboru', 'Karo')).toBeNull()
    expect(resolveAlias('namboru', 'Jawa')).toBeNull()
  })

  it('7. note memuat jejak sumber 1: kamusbatak glosa saudari ayah', () => {
    expectNoteContains('Toba', 'namboru', ['kamusbatak', 'namboru.html', 'saudari ayah'])
  })

  it('8. note memuat jejak sumber 2 dan 3: van der Tuuk 1861 vol 2 dan vol 1 glosa vader zuster', () => {
    expectNoteContains('Toba', 'namboru', ['van der Tuuk 1861', 'baris 43749', 'baris 43993', 'vader zuster'])
  })

  it('9. note memuat jejak sumber 4: Meerwaldt 1904 baris 8343', () => {
    expectNoteContains('Toba', 'namboru', ['Meerwaldt 1904', 'baris 8343', 'zuster van iemands vader'])
  })

  it('10. note menyebut empat sumber dan referensi evidence notes', () => {
    expectNoteContains('Toba', 'namboru', ['EMPAT SUMBER', 'notes/2026-10-03-evidence-tuuk-vol2-seg5-10-namboru'])
  })

  it('11. note tidak memuat karakter em dash maupun pengganti dua tanda minus', () => {
    const note = regionalNote('Toba', 'namboru')
    expect(note.includes('\u2014')).toBe(false)
    expect(note.includes('--')).toBe(false)
  })

  it('12. aliasKinds memuat parent-sibling dan kind entri adalah anggota sah KinshipKind', async () => {
    expect(aliasKinds()).toBeDefined()
    const kinds = new Set(Object.values(KINSHIP_ALIASES_REGIONAL).flatMap((m) => Object.values(m).map((e) => e.kind)))
    expect(kinds.has('parent-sibling')).toBe(true)
    const labels = await import('./kinship-labels')
    expect(Object.keys(labels.KINSHIP_LABELS)).toContain('parent-sibling')
  })

  it('13. non-regresi: tetangga amangboru dan iboto tetap ada di Toba dengan kind semula', () => {
    expect(resolveAlias('amangboru', 'Toba')?.kind).toBe('pernikahan')
    expect(resolveAlias('iboto', 'Toba')).not.toBeNull()
    expect(resolveAlias('butet', 'Toba')?.kind).toBe('child')
  })

  it('14. pengunci guard Toba: tepat enam key terurut setelah penyisipan namboru', () => {
    expect(Object.keys(KINSHIP_ALIASES_REGIONAL.Toba).sort()).toEqual([
      'amangboru',
      'boru',
      'butet',
      'haha',
      'iboto',
      'lae',
      'namboru',
      'ompung suhut',
      'pariban',
      'tulang',
    ])
  })
})
