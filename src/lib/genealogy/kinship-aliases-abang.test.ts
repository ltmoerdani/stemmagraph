import { describe, expect, it } from 'vitest'
import { resolveAlias, KINSHIP_ALIASES, KINSHIP_ALIASES_REGIONAL } from './kinship-aliases'
import { expectNoteContains, regionalEntry, regionalNote } from './__tests__/alias-entry'

describe('kinship-aliases abang Simalungun (v218-i, kind sibling, kakak laki-laki, single anchor)', () => {
  it('1. positif: abang Simalungun kind sibling, depth 1, region Simalungun', () => {
    const r = resolveAlias('abang', 'Simalungun')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('sibling')
    expect(r?.depth).toBe(1)
    expect(r?.region).toBe('Simalungun')
  })

  it('2. case-insensitive dan trim: ABANG dan "  Abang " sama dengan abang', () => {
    expect(resolveAlias('ABANG', 'Simalungun')).toEqual(resolveAlias('abang', 'Simalungun'))
    expect(resolveAlias('  Abang ', 'Simalungun')).toEqual(resolveAlias('abang', 'Simalungun'))
  })

  it('3. region lain (Toba, Karo) fallback ke entri GLOBAL (revisi gel28 rev 2, semula null)', () => {
    // Revisi transparan gel28: sejak lema global abang masuk map utama,
    // region tanpa entri regional kembalikan entri global (region undefined).
    const toba = resolveAlias('abang', 'Toba')
    expect(toba).not.toBeNull()
    expect(toba?.kind).toBe('sibling')
    expect(toba?.region).toBeUndefined()
    const karo = resolveAlias('abang', 'Karo')
    expect(karo).not.toBeNull()
    expect(karo?.kind).toBe('sibling')
    expect(karo?.region).toBeUndefined()
  })

  it('4. tanpa region kembalikan entri GLOBAL dan ada di map utama (revisi gel28 rev 2, semula null dan nihil key)', () => {
    // Revisi transparan gel28: abang kini key global baku di KINSHIP_ALIASES.
    const r = resolveAlias('abang')
    expect(r).not.toBeNull()
    expect(r).toEqual(KINSHIP_ALIASES['abang'])
    expect(r?.kind).toBe('sibling')
    expect(Object.keys(KINSHIP_ALIASES)).toContain('abang')
  })

  it('5. note memuat jangkar kamus Simalungun-Indonesia 2015 dan penanda single anchor', () => {
    expectNoteContains('Simalungun', 'abang', [
      'Kamus Bahasa Simalungun-Indonesia 2015',
      'Balai Bahasa Sumut',
      'SINGLE ANCHOR',
      'kakak laki-laki',
    ])
  })

  it('6. note mencatat Wiktionary EN tidak dihitung sumber kedua dan guard homonim KBBI', () => {
    expectNoteContains('Simalungun', 'abang', [
      'TIDAK dihitung sumber kedua',
      'Zufri Hidayat et al. 2015',
      'abang2 Jawa',
      'abang3 Lay',
      'abang5 Ldy',
    ])
  })

  it('7. non-regresi: anggi Simalungun tetap utuh sebagai sibling depth 1', () => {
    const r = resolveAlias('anggi', 'Simalungun')
    expect(r?.kind).toBe('sibling')
    expect(r?.depth).toBe(1)
    expect(r?.region).toBe('Simalungun')
    expect(regionalNote('Simalungun', 'anggi')).toContain('little brother or sister')
  })

  it('8. homonim KBBI abang Jawa Lay Ldy nihil di map regional lain; region lain fallback GLOBAL konsisten (revisi gel28 rev 2, semula null)', () => {
    // Revisi transparan gel28: assertion null Toba/Karo/Jawa diganti fallback
    // entri global; nihil abang di map regional Toba dan Karo TETAP dijaga.
    expect(resolveAlias('abang', 'Toba')?.region).toBeUndefined()
    expect(resolveAlias('abang', 'Karo')?.region).toBeUndefined()
    expect(Object.keys(KINSHIP_ALIASES_REGIONAL.Toba)).not.toContain('abang')
    expect(Object.keys(KINSHIP_ALIASES_REGIONAL.Karo)).not.toContain('abang')
    expect(resolveAlias('abang', 'Jawa')).toEqual(KINSHIP_ALIASES['abang'])
    expect(regionalEntry('Simalungun', 'abang').kind).toBe('sibling')
  })

  it('9. bentuk data valid: note non-kosong tanpa em dash dan tanpa dua minus', () => {
    const note = regionalNote('Simalungun', 'abang')
    expect(note.length).toBeGreaterThan(0)
    expect(note).not.toContain('\u2014')
    expect(note).not.toContain('--')
  })
})
