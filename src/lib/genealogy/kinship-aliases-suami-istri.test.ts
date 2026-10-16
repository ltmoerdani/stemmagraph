import { describe, expect, it } from 'vitest'
import { KINSHIP_ALIASES, KINSHIP_ALIASES_REGIONAL, aliasKinds, resolveAlias } from './kinship-aliases'

/**
 * Guard test lema suami + istri (gel39, kind partner depth 1 baku nasional, test-only).
 * Dua sumber first-hand 15 Okt 2026: KBBI VI resmi
 * kbbi.kemendikdasmen.go.id/entri/suami (pria yang menikah dengan wanita
 * secara sah, makna 1 relasi; makna 2 kiasan tidak dipetakan) dan
 * /entri/istri (wanita yang menikah dengan pria secara sah makna 1 plus
 * wanita yang dinikahi makna 2, keduanya relasi pasangan) plus Wiktionary
 * ID api.php pageid 38739 revid 1365835 (suami) dan pageid 38924 revid
 * 1365849 (istri) blok bahasa Indonesia nomina konvergen. Baku nasional
 * pertama kind partner: pola diberu turangku kind partner TAPI keduanya
 * regional Karo. Entri live di kinship-aliases.ts; test ini mengunci
 * kontrak gel39. Guard: kiasan suami makna 2 tidak dipetakan, turunan
 * bersuami beristri menikahi tidak dipetakan; anti-difusi diberu dan
 * turangku tetap partner Karo key sendiri. Total map 140 menjadi 141.
 */
describe('kinship-aliases suami istri (gel39)', () => {
  const GUARD_KEYS = 145

  it('1. positif: suami live kind partner depth 1', () => {
    const e = KINSHIP_ALIASES['suami']
    expect(e).toBeDefined()
    expect(e.kind).toBe('partner')
    expect(e.depth).toBe(1)
    expect(resolveAlias('suami')?.kind).toBe('partner')
  })

  it('2. positif: istri live kind partner depth 1', () => {
    const e = KINSHIP_ALIASES['istri']
    expect(e).toBeDefined()
    expect(e.kind).toBe('partner')
    expect(e.depth).toBe(1)
    expect(resolveAlias('istri')?.kind).toBe('partner')
  })

  it('3. baku nasional: tanpa region tanpa register tanpa qualifier keduanya', () => {
    for (const k of ['suami', 'istri']) {
      const e = KINSHIP_ALIASES[k]
      expect(e.region).toBeUndefined()
      expect(e.register).toBeUndefined()
      expect(e.qualifier).toBeUndefined()
    }
  })

  it('4. negasi kiasan suami makna 2: frasa padi suami nihil match via exact-phrase', () => {
    expect(resolveAlias('padi suami')).toBeNull()
    expect(resolveAlias('suami padi')).toBeNull()
  })

  it('5. negasi turunan: bersuami nihil key', () => {
    expect(KINSHIP_ALIASES['bersuami']).toBeUndefined()
    expect(resolveAlias('bersuami')).toBeNull()
  })

  it('6. negasi turunan: beristri nihil key', () => {
    expect(KINSHIP_ALIASES['beristri']).toBeUndefined()
    expect(resolveAlias('beristri')).toBeNull()
  })

  it('7. negasi turunan: menikahi nihil key', () => {
    expect(KINSHIP_ALIASES['menikahi']).toBeUndefined()
    expect(resolveAlias('menikahi')).toBeNull()
  })

  it('8. sanity: mertua tetap key lama tanpa perubahan (nihil difusi dari gel39)', () => {
    const e = KINSHIP_ALIASES['mertua']
    expect(e).toBeDefined()
    expect(resolveAlias('mertua')).toEqual(e)
  })

  it('9. anti-difusi: diberu tetap partner Karo key sendiri (map REGIONAL, bukan map global)', () => {
    const e = KINSHIP_ALIASES_REGIONAL['Karo']['diberu']
    expect(e).toBeDefined()
    expect(e.kind).toBe('partner')
    expect(e.region).toBe('Karo')
    expect(e).not.toBe(KINSHIP_ALIASES['istri'])
  })

  it('10. anti-difusi: turangku tetap partner Karo key sendiri (map REGIONAL, bukan map global)', () => {
    const e = KINSHIP_ALIASES_REGIONAL['Karo']['turangku']
    expect(e).toBeDefined()
    expect(e.kind).toBe('partner')
    expect(e.region).toBe('Karo')
    expect(e).not.toBe(KINSHIP_ALIASES['suami'])
  })

  it('11. urutan sisip alfabetis: istri antara ipar dan permen, suami sebelum sulung', () => {
    const keys = Object.keys(KINSHIP_ALIASES)
    expect(keys[keys.indexOf('istri') - 1]).toBe('ipar')
    expect(keys[keys.indexOf('istri') + 1]).toBe('pasangan')
    expect(keys[keys.indexOf('suami') + 1]).toBe('sulung')
  })

  it('12. total map PERSIS 144 dan aliasKinds 144 pasca gel40 (GUARD_KEYS bump 142 jadi 144)', () => {
    expect(Object.keys(KINSHIP_ALIASES)).toHaveLength(GUARD_KEYS)
    expect(aliasKinds().length).toBe(GUARD_KEYS)
  })
})
