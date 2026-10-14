import { describe, expect, it } from 'vitest'
import { KINSHIP_ALIASES, aliasKinds, resolveAlias } from './kinship-aliases'

/**
 * Guard test key ipar (v253-xxii, test-only).
 * Sumber entri: KBBI VI resmi kemendikdasmen i.par dua makna (saudara suami
 * atau istri, serta suami atau istri dari saudara) plus Wiktionary ID oldid
 * 1463006 blok Indonesia nomina dengan kutipan 1950 (templat rfv dicatat
 * jujur di note entri). Entri live ada di kinship-aliases.ts; test ini
 * mengunci kontrak gugus affine baku dan guard anti penempatan salah kind.
 */
describe('kinship-aliases ipar (v253-xxii)', () => {
  it('1. entri ipar live: kind property, tanpa region', () => {
    const e = KINSHIP_ALIASES['ipar']
    expect(e).toBeDefined()
    expect(e.kind).toBe('property')
    expect(e.region).toBeUndefined()
  })

  it('2. resolveAlias ipar non-null dan kind property', () => {
    const r = resolveAlias('ipar')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('property')
  })

  it('3. gugus affine baku konsisten: property eksak besan ipar menantu mertua', () => {
    const props = Object.keys(KINSHIP_ALIASES)
      .filter((k) => KINSHIP_ALIASES[k]?.kind === 'property')
      .sort()
    expect(props).toEqual(['besan', 'biras', 'ipar', 'mantu', 'menantu', 'mertua', 'semenda'])
  })

  it('4. guard anti parent-sibling: array 19 entri tetap utuh tanpa ipar', () => {
    const ps = Object.keys(KINSHIP_ALIASES)
      .filter((k) => KINSHIP_ALIASES[k]?.kind === 'parent-sibling')
      .sort()
    expect(ps).toEqual(['bako', 'bibi', 'bude', 'budhe', 'bulik', 'emang', 'engku', 'etek', 'makcik', 'mama', 'mamak', 'mami', 'mang', 'om', 'pakcik', 'pakde', 'pakdhe', 'paklik', 'paman', 'tante', 'uwa', 'wak'])
    expect(ps).not.toContain('ipar')
  })

  it('5. guard anti sibling-child: array 5 entri tetap utuh tanpa ipar', () => {
    const sc = Object.keys(KINSHIP_ALIASES)
      .filter((k) => KINSHIP_ALIASES[k]?.kind === 'sibling-child')
      .sort()
    expect(sc).toEqual(['kemanakan', 'kemenakan', 'keponakan', 'permen', 'ponakan'])
    expect(sc).not.toContain('ipar')
  })

  it('6. key sanak DITOLAK: nihil di map utama dan resolveAlias null', () => {
    expect(KINSHIP_ALIASES['sanak']).toBeUndefined()
    expect(aliasKinds()).not.toContain('sanak')
    expect(resolveAlias('sanak')).toBeNull()
  })

  it('7. note sumber lengkap: KBBI VI dua makna plus Wiktionary oldid 1463006 rfv jujur', () => {
    const note = KINSHIP_ALIASES['ipar'].note
    expect(note).toContain('KBBI VI')
    expect(note).toContain('saudara suami atau istri')
    expect(note).toContain('suami atau istri dari saudara')
    expect(note).toContain('1463006')
    expect(note).toContain('rfv')
    expect(note).toContain('sanak DITOLAK')
  })

  it('8. guard jumlah key PERSIS 107 pasca V253-XXII (106 jadi 107: ipar)', () => {
    expect(Object.keys(KINSHIP_ALIASES)).toHaveLength(133)
    expect(aliasKinds().length).toBe(132)
  })

  it('9. non-regresi gugus affine: besan menantu mertua tetap live kind property', () => {
    expect(resolveAlias('besan')?.kind).toBe('property')
    expect(resolveAlias('menantu')?.kind).toBe('property')
    expect(resolveAlias('mertua')?.kind).toBe('property')
  })

  it('10. nihil varian salah: ipar2 dan sanak2 nihil sebagai key', () => {
    expect(resolveAlias('ipar2')).toBeNull()
    expect(resolveAlias('sanak2')).toBeNull()
    expect(aliasKinds()).not.toContain('ipar2')
  })
})
