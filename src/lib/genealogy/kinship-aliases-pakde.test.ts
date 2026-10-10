import { describe, it, expect } from 'vitest'
import {
  KINSHIP_ALIASES,
  KINSHIP_ALIASES_REGIONAL,
  resolveAlias,
} from './kinship-aliases'

/**
 * v253-ii: pakde (uncle Jawa, dual-source, kontrak kontrak-v253ii-stg-pakde-2026-10-09.md).
 * Kontrak menyebut kind 'uncle'; keputusan PM: union KinshipKind nihil 'uncle',
 * preseden tulang (maternal uncle) memakai 'parent-sibling' depth 1. Teks PM menang.
 */
describe('kinship-aliases pakde (v253-ii, kind parent-sibling depth 1 Jawa)', () => {
  it('1. positif: pakde resolve parent-sibling depth 1 qualifier jw region Jawa', () => {
    const r = resolveAlias('pakde')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('parent-sibling')
    expect(r?.depth).toBe(1)
    expect(r?.qualifier).toBe('jw')
    expect(r?.region).toBe('Jawa')
  })

  it('2. case-insensitive dan trim: PAKDE dan "  Pakde " sama dengan pakde', () => {
    expect(resolveAlias('PAKDE')).toEqual(resolveAlias('pakde'))
    expect(resolveAlias('  Pakde ')).toEqual(resolveAlias('pakde'))
  })

  it('3. normalisasi titik tengah pak·de sama dengan pakde', () => {
    expect(resolveAlias('pak·de')).toEqual(resolveAlias('pakde'))
  })

  it('4. guard homonim nihil: query pakde hanya mengembalikan entri pakde', () => {
    const entries = Object.values(KINSHIP_ALIASES).filter(
      (e) =>
        e.kind === 'parent-sibling' && e.region === 'Jawa' && e.qualifier === 'jw',
    )
    expect(entries).toHaveLength(1)
    expect(entries[0]).toEqual(resolveAlias('pakde'))
  })

  it('5. uak dan pakcik DITAHAN: nihil sbg key, query keduanya nihil alias', () => {
    expect(Object.keys(KINSHIP_ALIASES)).not.toContain('uak')
    expect(Object.keys(KINSHIP_ALIASES)).not.toContain('uwak')
    expect(Object.keys(KINSHIP_ALIASES)).not.toContain('pakcik')
    expect(resolveAlias('uak')).toBeNull()
    expect(resolveAlias('pakcik')).toBeNull()
  })

  it('6. guard homonim Kankanaey: entri tetap kind kekerabatan Jawa, homonim upacara kurban terdokumentasi TIDAK dipetakan', () => {
    const r = resolveAlias('pakde')
    expect(r?.kind).toBe('parent-sibling')
    expect(r?.region).toBe('Jawa')
    const note = r?.note ?? ''
    expect(note).toContain('Kankanaey')
    expect(note).toContain('TIDAK dipetakan')
  })

  it('7. jumlah total key 82 pasca v253-vii mamak (v253-vi trio in-law dulu naik PERSIS 1 dari baseline kontrak 77 ke 81)', () => {
    expect(Object.keys(KINSHIP_ALIASES)).toHaveLength(82)
  })

  it('8. regional nihil untuk pakde: key tidak masuk blok regional mana pun', () => {
    for (const region of Object.keys(KINSHIP_ALIASES_REGIONAL)) {
      expect(KINSHIP_ALIASES_REGIONAL[region]['pakde']).toBeUndefined()
    }
    expect(resolveAlias('pakde', 'Toba')?.kind).toBe('parent-sibling')
  })

  it('9. non-regresi kunci tetangga gugus saudara orang tua: tulang regional Toba utuh, om nihil', () => {
    expect(resolveAlias('tulang', 'Toba')?.kind).toBe('parent-sibling')
    expect(resolveAlias('tulang', 'Toba')?.region).toBe('Toba')
    expect(resolveAlias('om')).toBeNull()
    expect(KINSHIP_ALIASES['pakde']?.kind).toBe('parent-sibling')
  })

  it('10. note memuat dua sumber dan pembeda senioritas', () => {
    const note = resolveAlias('pakde')?.note ?? ''
    expect(note).toContain('DUA SUMBER')
    expect(note).toContain('kbbi.web.id/pakde')
    expect(note).toContain('1231552')
    expect(note).toContain('bapak gede')
  })
})
